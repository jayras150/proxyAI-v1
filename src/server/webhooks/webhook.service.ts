// ProxyAI — WebhookService
// Blueprint Reference: Design Review Wallet §12 — Webhook Replay Protection
// Flow:
//   verify signature → dedupe event (provider+eventId) → validate amount/
//   currency → single DB tx: credit wallet + mark PAID + mark processed →
//   emit topup.completed AFTER commit.
// Replay of the same event never credits twice (unique provider_event_id +
// PENDING-only markPaid guard).

import { Prisma } from '@prisma/client'
import { Money } from '@/lib/money'
import { prismaToDecimal } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sha256Hex } from '@/lib/crypto'
import { createDomainEvent } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { TransactionManager } from '@/server/db/transaction-manager'
import type { PaymentService } from '@/server/payments/payment.service'
import type { WalletService } from '@/server/wallet/wallet.service'
import type { TopupService } from '@/server/topup/topup.service'
import type { WebhookEventRepository } from './webhook-event.repository'
import { TopupError, TopupErrorCode } from '@/server/topup/topup.service'
import type { PaymentProvider as PrismaPaymentProvider } from '@prisma/client'

export interface WebhookResult {
  outcome: 'processed' | 'duplicate' | 'ignored'
  eventId?: string
  topupId?: string
  transactionId?: string
}

export class WebhookService {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
    private readonly topupService: TopupService,
    private readonly webhookEventRepository: WebhookEventRepository,
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  /**
   * Handle a payment webhook delivery. Always safe to call multiple times
   * with the same payload — at most one credit is ever applied.
   */
  async handlePaymentWebhook(
    rawBody: string,
    signature: string,
    headers: Record<string, string>
  ): Promise<WebhookResult> {
    const provider = this.paymentService.providerName as PrismaPaymentProvider

    // 1. Signature verification (authenticity).
    const verified = await this.paymentService.verifyWebhook(rawBody, signature, headers)
    const payloadHash = sha256Hex(rawBody)

    // 2. Replay protection: same (provider, providerEventId) processed once.
    const existing = await this.webhookEventRepository.findByProviderEventId(
      provider,
      verified.providerEventId
    )
    if (existing) {
      logger.info('webhook.duplicate', {
        provider,
        provider_reference: verified.providerReference,
        provider_event_id: verified.providerEventId,
        status: existing.status,
      })
      return {
        outcome: existing.status === 'PROCESSED' ? 'duplicate' : 'ignored',
        eventId: existing.id,
      }
    }

    const event = await this.webhookEventRepository.create({
      provider,
      providerEventId: verified.providerEventId,
      payloadHash,
      payload: JSON.parse(rawBody) as object,
    }).catch(async (error) => {
      // Concurrent duplicate delivery: unique (provider, providerEventId)
      // constraint (Prisma P2002) means another request already recorded it.
      if ((error as { code?: string }).code === 'P2002') {
        const concurrent = await this.webhookEventRepository.findByProviderEventId(
          provider,
          verified.providerEventId
        )
        if (concurrent) {
          logger.info('webhook.duplicate_concurrent', {
            provider,
            provider_reference: verified.providerReference,
            provider_event_id: verified.providerEventId,
            status: concurrent.status,
          })
          return concurrent
        }
      }
      throw error
    })

    if (event.status !== 'RECEIVED') {
      // Already processed (or failed) by the concurrent/previous delivery.
      return {
        outcome: event.status === 'PROCESSED' ? 'duplicate' : 'ignored',
        eventId: event.id,
      }
    }

    // 3. Locate the top-up request by provider reference.
    const topup = await this.topupService.getTopupByProviderReference(verified.providerReference)
    if (!topup) {
      await this.webhookEventRepository.markFailed(event.id, 'No matching topup request')
      logger.warn('webhook.no_topup_match', {
        provider,
        provider_reference: verified.providerReference,
        provider_event_id: verified.providerEventId,
      })
      return { outcome: 'ignored', eventId: event.id }
    }

    // 4. Validate payment amount & currency against the topup request.
    try {
      this.assertPaymentMatches(topup, verified.amount, verified.currency)
    } catch (error) {
      await this.webhookEventRepository.markFailed(
        event.id,
        error instanceof Error ? error.message : String(error)
      )
      throw error
    }

    // 4b. EXPIRED PAYMENT GUARD (P1): a payment arriving after expiresAt
    // must NEVER credit the wallet. Mark EXPIRED, record event as processed,
    // and ack so the provider stops redelivering.
    if (topup.expiresAt < new Date()) {
      await this.transactionManager.withTransaction(async (tx) => {
        await this.topupService.markExpiredInTransaction(tx, topup.id)
        await this.webhookEventRepository.markProcessed(event.id, tx)
      })
      this.eventDispatcher.emit(
        createDomainEvent('topup.failed', {
          userId: topup.userId,
          walletId: topup.walletId,
          topupId: topup.id,
          provider,
          providerReference: topup.providerReference ?? verified.providerReference,
          amount: topup.amount.toFixed(6),
          currency: topup.currency,
        })
      )
      logger.warn('webhook.topup_expired', {
        provider,
        provider_reference: verified.providerReference,
        provider_event_id: verified.providerEventId,
        topup_id: topup.id,
        expires_at: topup.expiresAt.toISOString(),
      })
      return { outcome: 'processed', eventId: event.id, topupId: topup.id }
    }

    // FAILED status from the provider: mark the topup FAILED, no credit.
    if (verified.status === 'FAILED') {
      await this.transactionManager.withTransaction(async (tx) => {
        await this.topupService.markFailedInTransaction(tx, topup.id)
        await this.webhookEventRepository.markProcessed(event.id, tx)
      })
      this.eventDispatcher.emit(
        createDomainEvent('topup.failed', {
          userId: topup.userId,
          walletId: topup.walletId,
          topupId: topup.id,
          provider,
          providerReference: topup.providerReference ?? verified.providerReference,
          amount: topup.amount.toFixed(6),
          currency: topup.currency,
        })
      )
      return { outcome: 'processed', eventId: event.id, topupId: topup.id }
    }

    // 5. Single DB transaction: credit wallet + mark PAID + mark processed.
    let result: { transactionId: string }
    try {
      result = await this.transactionManager.withTransaction(async (tx) => {
        const { transaction } = await this.walletService.creditInTransaction(
          tx,
          topup.userId,
          this.amountToMoney(topup),
          {
            reference: `topup_${topup.id}`,
            type: 'TOPUP',
            description: `Top-up via ${provider}`,
            requestId: headers['x-request-id'],
            providerReference: topup.providerReference ?? verified.providerReference,
            createdBy: 'system',
          }
        )

        const paid = await this.topupService.markPaidInTransaction(tx, topup.id, transaction.id)
        if (!paid) {
          throw new TopupError(
            TopupErrorCode.INVALID_STATE_TRANSITION,
            'Topup is no longer PENDING — refusing to credit twice.'
          )
        }

        await this.webhookEventRepository.markProcessed(event.id, tx)
        return { transactionId: transaction.id }
      })
    } catch (error) {
      await this.webhookEventRepository.markFailed(
        event.id,
        error instanceof Error ? error.message : String(error)
      ).catch(() => undefined)
      throw error
    }

    // 6. Emit AFTER commit.
    this.eventDispatcher.emit(
      createDomainEvent('topup.completed', {
        userId: topup.userId,
        walletId: topup.walletId,
        topupId: topup.id,
        transactionId: result.transactionId,
        provider,
        providerReference: topup.providerReference ?? verified.providerReference,
        amount: topup.amount.toFixed(6),
        currency: topup.currency,
      })
    )

    logger.info('webhook.processed', {
      provider,
      provider_reference: verified.providerReference,
      provider_event_id: verified.providerEventId,
      topup_id: topup.id,
      wallet_id: topup.walletId,
      user_id: topup.userId,
      transaction_id: result.transactionId,
    })

    return { outcome: 'processed', eventId: event.id, topupId: topup.id, transactionId: result.transactionId }
  }

  private assertPaymentMatches(
    topup: { amount: Prisma.Decimal; currency: string },
    amount: string,
    currency: string
  ): void {
    const paidAmount = new Prisma.Decimal(amount)
    if (!paidAmount.equals(topup.amount)) {
      throw new TopupError(
        TopupErrorCode.PAYMENT_AMOUNT_MISMATCH,
        `Payment amount ${amount} does not match topup amount ${topup.amount.toFixed(6)}.`
      )
    }
    if (currency !== topup.currency) {
      throw new TopupError(
        TopupErrorCode.PAYMENT_CURRENCY_MISMATCH,
        `Payment currency ${currency} does not match topup currency ${topup.currency}.`
      )
    }
  }

  private amountToMoney(topup: { amount: Prisma.Decimal; currency: string }) {
    return Money.fromDecimal(prismaToDecimal(topup.amount), topup.currency as 'USD' | 'IDR' | 'SGD')
  }
}
