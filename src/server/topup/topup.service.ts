// ProxyAI — TopupService
// Blueprint Reference: Sprint 4 §19, Design Review Wallet §2 (revisi)
// Business rules:
//  - TopupRequest created BEFORE any payment; wallet untouched at create.
//  - amount > 0, currency == wallet currency, expiry required.
//  - provider reference unique.
//  - Explicit state machine: PENDING → PAID | FAILED | EXPIRED (no reverse).

import { Money } from '@/lib/money'
import { logger } from '@/lib/logger'
import { env } from '@/config/env'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'
import type { WalletService } from '@/server/wallet/wallet.service'
import type { PaymentService } from '@/server/payments/payment.service'
import type { TransactionManager } from '@/server/db/transaction-manager'
import type { TopupRequestRepository } from './topup-request.repository'
import type { TopupRequest, TopupStatus } from '@prisma/client'
import type { TxClient } from '@/server/db/transaction-manager'

export class TopupError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'TopupError'
  }
}

export const TopupErrorCode = {
  TOPUP_NOT_FOUND: 'TOPUP_NOT_FOUND',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  PAYMENT_CURRENCY_MISMATCH: 'PAYMENT_CURRENCY_MISMATCH',
  PROVIDER_REFERENCE_MISSING: 'PROVIDER_REFERENCE_MISSING',
} as const

export type TopupErrorCodeValue = (typeof TopupErrorCode)[keyof typeof TopupErrorCode]

// ─── Explicit state machine ─────────────────────────────────────────────
// PENDING → PAID | FAILED | EXPIRED. Nothing may leave PAID/FAILED/EXPIRED.

const ALLOWED_TRANSITIONS: Record<TopupStatus, TopupStatus[]> = {
  PENDING: ['PAID', 'FAILED', 'EXPIRED'],
  PAID: [],
  FAILED: [],
  EXPIRED: [],
}

export function assertTopupTransition(from: TopupStatus, to: TopupStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new TopupError(
      TopupErrorCode.INVALID_STATE_TRANSITION,
      `Invalid topup status transition: ${from} → ${to}`
    )
  }
}

export interface CreateTopupInput {
  userId: string
  amount: Money
  requestId?: string
  correlationId?: string
  ipAddress?: string
  userAgent?: string
}

export interface CreateTopupResult {
  topup: TopupRequest
  payment: {
    providerReference: string
    checkoutUrl: string | null
    token: string | null
    expiresAt: Date
  }
}

export class TopupService {
  constructor(
    private readonly topupRepository: TopupRequestRepository,
    private readonly walletService: WalletService,
    private readonly paymentService: PaymentService,
    private readonly transactionManager: TransactionManager
  ) {}

  /**
   * Create a top-up request. Does NOT touch the wallet balance.
   * Flow: validate → create TopupRequest(PENDING) → payment intent →
   * store provider reference.
   */
  async createTopup(input: CreateTopupInput): Promise<CreateTopupResult> {
    const { userId, amount, requestId, correlationId } = input

    if (!amount.isPositive()) {
      throw new WalletError(WalletErrorCode.INVALID_AMOUNT, 'Top-up amount must be positive.')
    }

    const wallet = await this.walletService.getWallet(userId)
    if (!wallet) {
      throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
    }
    if (wallet.status === 'SUSPENDED') {
      throw new WalletError(WalletErrorCode.WALLET_SUSPENDED, 'Wallet is suspended.')
    }
    if (wallet.status === 'LOCKED') {
      throw new WalletError(WalletErrorCode.WALLET_LOCKED, 'Wallet is locked.')
    }
    if (wallet.currency !== amount.currency) {
      throw new WalletError(
        WalletErrorCode.CURRENCY_MISMATCH,
        `Currency mismatch: wallet ${wallet.currency} vs ${amount.currency}.`
      )
    }

    const expiresAt = new Date(Date.now() + env.topupExpiryMinutes * 60 * 1000)

    // 1. Create PENDING topup request (no wallet mutation).
    const topup = await this.topupRepository.create({
      userId,
      walletId: wallet.id,
      amount: amount.value,
      currency: amount.currency,
      provider: this.paymentService.providerName as TopupRequest['provider'],
      expiresAt,
    })

    // 2. Create payment intent with the provider.
    const intent = await this.paymentService.createPayment({
      topupRequestId: topup.id,
      userId,
      walletId: wallet.id,
      amount: amount.toString(),
      currency: amount.currency,
      expiresAt,
    })

    // 3. Persist provider reference (unique).
    const withReference = await this.topupRepository.updateProviderReference(
      topup.id,
      intent.providerReference
    )

    logger.info('topup.created', {
      request_id: requestId,
      correlation_id: correlationId,
      user_id: userId,
      wallet_id: wallet.id,
      topup_id: topup.id,
      provider: this.paymentService.providerName,
      provider_reference: intent.providerReference,
      amount: amount.toString(),
      currency: amount.currency,
    })

    return {
      topup: withReference,
      payment: {
        providerReference: intent.providerReference,
        checkoutUrl: intent.checkoutUrl,
        token: intent.token,
        expiresAt: intent.expiresAt,
      },
    }
  }

  /** Read a top-up request scoped to its owner. */
  async getTopup(id: string, userId: string): Promise<TopupRequest> {
    const topup = await this.topupRepository.findByIdAndUserId(id, userId)
    if (!topup) {
      throw new TopupError(TopupErrorCode.TOPUP_NOT_FOUND, 'Top-up request not found.')
    }
    return topup
  }

  /** Find by provider reference (webhook path). */
  async getTopupByProviderReference(providerReference: string): Promise<TopupRequest | null> {
    return this.topupRepository.findByProviderReference(providerReference)
  }

  /** PENDING → PAID, linking the wallet transaction. Returns null if not PENDING. */
  async markPaid(id: string, transactionId: string): Promise<TopupRequest | null> {
    const topup = await this.topupRepository.findById(id)
    if (topup) assertTopupTransition(topup.status, 'PAID')
    return this.topupRepository.markPaid(id, transactionId)
  }

  /** PENDING → PAID inside the caller's transaction (webhook path). */
  async markPaidInTransaction(
    tx: TxClient,
    id: string,
    transactionId: string
  ): Promise<TopupRequest | null> {
    return this.topupRepository.markPaid(id, transactionId, tx)
  }

  /** PENDING → FAILED */
  async markFailed(id: string): Promise<TopupRequest> {
    const topup = await this.topupRepository.findById(id)
    if (!topup) {
      throw new TopupError(TopupErrorCode.TOPUP_NOT_FOUND, 'Top-up request not found.')
    }
    assertTopupTransition(topup.status, 'FAILED')
    return this.topupRepository.updateStatus(id, 'FAILED')
  }

  /** PENDING → FAILED inside the caller's transaction (webhook path). */
  async markFailedInTransaction(tx: TxClient, id: string): Promise<TopupRequest> {
    return this.topupRepository.updateStatus(id, 'FAILED', tx)
  }

  /** PENDING → EXPIRED */
  async markExpired(id: string): Promise<TopupRequest> {
    const topup = await this.topupRepository.findById(id)
    if (!topup) {
      throw new TopupError(TopupErrorCode.TOPUP_NOT_FOUND, 'Top-up request not found.')
    }
    assertTopupTransition(topup.status, 'EXPIRED')
    return this.topupRepository.updateStatus(id, 'EXPIRED')
  }
}
