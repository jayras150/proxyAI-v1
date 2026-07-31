// ProxyAI — CostBreakdown Value Object
// Billing Design Review v2 — Cost Calculation
// Pure domain object: no database dependency.

import { Money } from '@/lib/money'
import type { Currency } from '@prisma/client'

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

/**
 * Result of cost calculation: provider cost (internal, never exposed)
 * and user cost (what the customer is charged).
 */
export class CostBreakdown {
  readonly providerCost: Money
  readonly userCost: Money

  private constructor(providerCost: Money, userCost: Money) {
    this.providerCost = providerCost
    this.userCost = userCost
  }

  static create(providerCost: Money, userCost: Money): CostBreakdown {
    if (providerCost.isNegative() || userCost.isNegative()) {
      throw new CostBreakdownError(
        CostBreakdownErrorCode.NEGATIVE_COST,
        'Costs must not be negative.'
      )
    }

    if (providerCost.currency !== userCost.currency) {
      throw new CostBreakdownError(
        CostBreakdownErrorCode.CURRENCY_MISMATCH,
        'Provider and user cost must share the same currency.'
      )
    }

    return new CostBreakdown(providerCost, userCost)
  }

  get currency(): Currency {
    return this.userCost.currency
  }
}
