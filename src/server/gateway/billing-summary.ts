// ProxyAI — BillingSummary
// Billing Milestone 7 — AI Gateway / Billing Orchestrator
//
// Immutable summary of a settled AI request. Every money value is a Money
// value object (never a JS number). Built by the gateway from the
// ChargeService result — the gateway adds no pricing or wallet logic.

import { Money, type CurrencyCode } from '@/lib/money'

export class BillingSummaryError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'BillingSummaryError'
  }
}

export const BillingSummaryErrorCode = {
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
} as const

export interface BillingSummaryParams {
  transactionId: string
  usageLogId: string
  pricingVersionId: string
  totalCost: Money
  currency: CurrencyCode
  walletBalanceBefore: Money
  walletBalanceAfter: Money
  walletStatusAfter: string
}

export class BillingSummary {
  readonly transactionId: string
  readonly usageLogId: string
  readonly pricingVersionId: string
  readonly totalCost: Money
  readonly currency: CurrencyCode
  readonly walletBalanceBefore: Money
  readonly walletBalanceAfter: Money
  readonly walletStatusAfter: string

  private constructor(params: BillingSummaryParams) {
    this.transactionId = params.transactionId
    this.usageLogId = params.usageLogId
    this.pricingVersionId = params.pricingVersionId
    this.totalCost = params.totalCost
    this.currency = params.currency
    this.walletBalanceBefore = params.walletBalanceBefore
    this.walletBalanceAfter = params.walletBalanceAfter
    this.walletStatusAfter = params.walletStatusAfter
  }

  static create(params: BillingSummaryParams): BillingSummary {
    const moneyFields = [params.totalCost, params.walletBalanceBefore, params.walletBalanceAfter]
    for (const money of moneyFields) {
      if (money.currency !== params.currency) {
        throw new BillingSummaryError(
          BillingSummaryErrorCode.CURRENCY_MISMATCH,
          `Billing summary currency mismatch: ${money.currency} vs ${params.currency}.`
        )
      }
    }
    return new BillingSummary(params)
  }
}
