// ProxyAI — Payment Provider Factory
// Blueprint Reference: Design Review Wallet §11 — Payment Provider Abstraction
// Selects the concrete provider from env (PAYMENT_PROVIDER). Business logic
// only ever sees the PaymentProvider interface.

import { env } from '@/config/env'
import { PaymentError, PaymentErrorCode } from './payment.errors'
import type { PaymentProvider } from './provider'
import { MockProvider } from './mock-provider'

let instance: PaymentProvider | null = null

export function createPaymentProvider(): PaymentProvider {
  switch (env.paymentProvider) {
    case 'mock':
      return new MockProvider()
    // Future: case 'xendit': return new XenditProvider()
    // Future: case 'stripe': return new StripeProvider()
    default:
      throw new PaymentError(
        PaymentErrorCode.UNSUPPORTED_PROVIDER,
        `Unsupported payment provider: ${env.paymentProvider}`
      )
  }
}

/** Lazily-created singleton. Use this everywhere. */
export function getPaymentProvider(): PaymentProvider {
  if (!instance) {
    instance = createPaymentProvider()
  }
  return instance
}
