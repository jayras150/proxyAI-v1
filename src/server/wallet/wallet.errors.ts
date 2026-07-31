// ProxyAI — Wallet Error Types
// Business-rule errors for the wallet domain. Mapped to API error codes
// at the route layer (Milestone 4+).

export class WalletError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'WalletError'
  }
}

export const WalletErrorCode = {
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  WALLET_SUSPENDED: 'WALLET_SUSPENDED',
  WALLET_LOCKED: 'WALLET_LOCKED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
} as const

export type WalletErrorCodeValue = (typeof WalletErrorCode)[keyof typeof WalletErrorCode]
