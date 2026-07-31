// ProxyAI — PaymentService
// Blueprint Reference: Design Review Wallet §11 — Payment Provider Abstraction
// Orchestration only: selects the provider, creates payment intents,
// verifies webhooks, maps provider responses into the domain.
// NO wallet business logic lives here.

import { logger } from '@/lib/logger'
import { PaymentError, PaymentErrorCode } from './payment.errors'
import type { PaymentProvider, CreatePaymentInput, PaymentIntent, VerifiedPayment } from './provider'

export class PaymentService {
  constructor(private readonly provider: PaymentProvider) {}

  /** Provider name — used to tag TopupRequest rows. */
  get providerName(): string {
    return this.provider.name
  }

  /** Create a payment intent for a top-up request. */
  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    logger.info('payment.intent.create', {
      user_id: input.userId,
      wallet_id: input.walletId,
      topup_id: input.topupRequestId,
      provider: this.provider.name,
      amount: input.amount,
      currency: input.currency,
    })

    try {
      const intent = await this.provider.createPayment(input)
      logger.info('payment.intent.created', {
        user_id: input.userId,
        topup_id: input.topupRequestId,
        provider: this.provider.name,
        provider_reference: intent.providerReference,
      })
      return intent
    } catch (error) {
      logger.error('payment.intent.failed', {
        user_id: input.userId,
        topup_id: input.topupRequestId,
        provider: this.provider.name,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new PaymentError(
        PaymentErrorCode.PROVIDER_ERROR,
        'Payment provider failed to create the payment intent.'
      )
    }
  }

  /**
   * Verify an incoming webhook: signature authenticity + domain mapping.
   * Throws PaymentError(INVALID_SIGNATURE) when the signature is invalid.
   */
  async verifyWebhook(
    rawBody: string,
    signature: string,
    headers: Record<string, string>
  ): Promise<VerifiedPayment> {
    const verified = await this.provider.verifyWebhook(rawBody, signature, headers)

    logger.info('payment.webhook.verified', {
      provider: this.provider.name,
      provider_reference: verified.providerReference,
      provider_event_id: verified.providerEventId,
      amount: verified.amount,
      currency: verified.currency,
      status: verified.status,
    })

    return verified
  }
}
