// ProxyAI — PaymentProvider Abstraction
// Blueprint Reference: Design Review Wallet §11 — Payment Provider Abstraction
// Wallet and Topup must never know the concrete provider. New providers
// (Xendit, Stripe) only implement this interface.

/** Domain input for creating a payment intent. */
export interface CreatePaymentInput {
  topupRequestId: string
  userId: string
  walletId: string
  amount: string // decimal string (never number)
  currency: string
  expiresAt: Date
}

/** Payment intent returned to the client for checkout. */
export interface PaymentIntent {
  providerReference: string
  checkoutUrl: string | null
  token: string | null
  expiresAt: Date
}

/** Verified webhook payload mapped into the domain. */
export interface VerifiedPayment {
  providerEventId: string
  providerReference: string
  amount: string // decimal string as signed by provider
  currency: string
  status: 'PAID' | 'FAILED'
}

export interface PaymentProvider {
  readonly name: string

  /** Create a payment intent for a top-up request. */
  createPayment(input: CreatePaymentInput): Promise<PaymentIntent>

  /**
   * Verify a webhook delivery: signature authenticity + payload mapping.
   * Throws PaymentError(INVALID_SIGNATURE) when the signature is invalid.
   */
  verifyWebhook(
    rawBody: string,
    signature: string,
    headers: Record<string, string>
  ): Promise<VerifiedPayment>
}
