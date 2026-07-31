// ProxyAI — MockProvider
// Blueprint Reference: Design Review Wallet §11 — Payment Provider Abstraction
// Default development provider. Realistic enough to test the full payment
// flow: creates payment intents, generates HMAC-SHA256 signatures, and can
// simulate signed webhook payloads.

import crypto from 'crypto'
import { env } from '@/config/env'
import { hmacSha256Hex, timingSafeEqualHex } from '@/lib/crypto'
import { PaymentError, PaymentErrorCode } from './payment.errors'
import type {
  PaymentProvider,
  CreatePaymentInput,
  PaymentIntent,
  VerifiedPayment,
} from './provider'

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature'
export const MOCK_EVENT_ID_HEADER = 'x-mock-event-id'

interface MockWebhookPayload {
  eventId: string
  providerReference: string
  amount: string
  currency: string
  status: 'PAID' | 'FAILED'
  timestamp: string
}

export class MockProvider implements PaymentProvider {
  readonly name = 'mock'

  private get secret(): string {
    return env.mockPaymentWebhookSecret
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    const providerReference = `mock_${crypto.randomUUID()}`
    const token = crypto.randomBytes(24).toString('base64url')

    // Dummy checkout URL that a client could open in development.
    const checkoutUrl = `${env.appUrl}/mock-checkout/${providerReference}?token=${token}`

    return {
      providerReference,
      checkoutUrl,
      token,
      expiresAt: input.expiresAt,
    }
  }

  async verifyWebhook(
    rawBody: string,
    signature: string,
    headers: Record<string, string>
  ): Promise<VerifiedPayment> {
    if (!signature || !timingSafeEqualHex(signature, this.sign(rawBody))) {
      throw new PaymentError(PaymentErrorCode.INVALID_SIGNATURE, 'Webhook signature is invalid.')
    }

    let payload: MockWebhookPayload
    try {
      payload = JSON.parse(rawBody) as MockWebhookPayload
    } catch {
      throw new PaymentError(PaymentErrorCode.INVALID_PAYLOAD, 'Webhook payload is not valid JSON.')
    }

    if (!payload.providerReference || !payload.amount || !payload.currency) {
      throw new PaymentError(
        PaymentErrorCode.INVALID_PAYLOAD,
        'Webhook payload is missing required fields.'
      )
    }

    if (payload.status !== 'PAID' && payload.status !== 'FAILED') {
      throw new PaymentError(
        PaymentErrorCode.UNSUPPORTED_STATUS,
        `Unsupported payment status: ${payload.status}`
      )
    }

    // providerEventId from header (like real providers), fallback to payload.
    const providerEventId = headers[MOCK_EVENT_ID_HEADER] ?? payload.eventId

    return {
      providerEventId,
      providerReference: payload.providerReference,
      amount: payload.amount,
      currency: payload.currency,
      status: payload.status,
    }
  }

  /**
   * Sign a raw body with the mock webhook secret (HMAC-SHA256 hex).
   */
  sign(rawBody: string): string {
    return hmacSha256Hex(this.secret, rawBody)
  }

  /**
   * Simulate a signed webhook delivery — used by tests and the dev
   * payment simulator (Milestone 4). Returns everything a client would
   * POST to the webhook endpoint.
   */
  simulateWebhook(input: {
    providerReference: string
    amount: string
    currency: string
    status: 'PAID' | 'FAILED'
    eventId?: string
  }): { rawBody: string; signature: string; headers: Record<string, string> } {
    const eventId = input.eventId ?? `evt_${crypto.randomUUID()}`
    const payload: MockWebhookPayload = {
      eventId,
      providerReference: input.providerReference,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      timestamp: new Date().toISOString(),
    }

    const rawBody = JSON.stringify(payload)
    const signature = this.sign(rawBody)

    return {
      rawBody,
      signature,
      headers: {
        [MOCK_SIGNATURE_HEADER]: signature,
        [MOCK_EVENT_ID_HEADER]: eventId,
      },
    }
  }
}
