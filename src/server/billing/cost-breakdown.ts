// ProxyAI — CostBreakdown Value Object
// Billing Design Review v2 — Cost Calculation
// Pure domain object: no database dependency.
//
// Breakdown produced by PricingEngine:
//   providerCost — raw cost from provider prices (internal, never exposed)
//   markupCost   — markup applied on provider cost
//   serviceFee   — fixed fee per request
//   subtotal     — providerCost + markupCost
//   totalCost    — subtotal + serviceFee, floored + min-charge applied (user cost)

import { Money, type CurrencyCode } from '@/lib/money'

export class CostBreakdownError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'CostBreakdownError'
  }
}

export const CostBreakdownErrorCode = {
  NEGATIVE_COST: 'NEGATIVE_COST',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
} as const

export interface CostBreakdownParams {
  providerCost: Money
  markupCost: Money
  serviceFee: Money
  subtotal: Money
  totalCost: Money
}

export class CostBreakdown {
  readonly providerCost: Money
  readonly markupCost: Money
  readonly serviceFee: Money
  readonly subtotal: Money
  readonly totalCost: Money

  private constructor(params: CostBreakdownParams) {
    this.providerCost = params.providerCost
    this.markupCost = params.markupCost
    this.serviceFee = params.serviceFee
    this.subtotal = params.subtotal
    this.totalCost = params.totalCost
  }

  static create(params: CostBreakdownParams): CostBreakdown {
    const all = [
      params.providerCost,
      params.markupCost,
      params.serviceFee,
      params.subtotal,
      params.totalCost,
    ]

    for (const cost of all) {
      if (cost.isNegative()) {
        throw new CostBreakdownError(
          CostBreakdownErrorCode.NEGATIVE_COST,
          'Costs must not be negative.'
        )
      }
    }

    const currency = all[0].currency
    for (const cost of all) {
      if (cost.currency !== currency) {
        throw new CostBreakdownError(
          CostBreakdownErrorCode.CURRENCY_MISMATCH,
          `All cost components must share the same currency (expected ${currency}).`
        )
      }
    }

    return new CostBreakdown(params)
  }

  get currency(): CurrencyCode {
    return this.totalCost.currency
  }
}
