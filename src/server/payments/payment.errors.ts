// ProxyAI — Payment Error Types
// Business-rule errors for the payment domain. Mapped to API error codes
// at the route layer (Milestone 4+).

export class PaymentError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'PaymentError'
  }
}

export const PaymentErrorCode = {
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  UNSUPPORTED_PROVIDER: 'UNSUPPORTED_PROVIDER',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  UNSUPPORTED_STATUS: 'UNSUPPORTED_STATUS',
} as const

export type PaymentErrorCodeValue = (typeof PaymentErrorCode)[keyof typeof PaymentErrorCode]
