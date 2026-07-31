// ProxyAI — PricingEngine
// Billing Design Review v2 — Revision 1/2/9, ADR-0001
//
// Pure domain service: deterministic, stateless, no side effects.
// NO database / Prisma / HTTP / provider / repository dependency.
// All money operations go through the Money value object — never raw
// Decimal arithmetic outside Money.
//
// Responsibility: calculate cost ONLY. Never debits, never persists,
// never emits events.

import Decimal from 'decimal.js'
import { Money, type CurrencyCode } from '@/lib/money'
import { TokenUsage } from './token-usage'
import { PricingSnapshot } from './pricing-snapshot'
import { CostBreakdown } from './cost-breakdown'

export class PricingError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'PricingError'
  }
}

export const PricingErrorCode = {
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  INVALID_MINIMUM_CHARGE: 'INVALID_MINIMUM_CHARGE',
} as const

export interface CalculateInput {
  snapshot: PricingSnapshot
  usage: TokenUsage
  /** Optional override; defaults to snapshot.serviceFee. */
  serviceFee?: Money
  /** Optional override; defaults to the engine default minimum charge. */
  minimumCharge?: Money
}

/** Tokens per unit price (prices are expressed per 1M tokens). */
const TOKENS_PER_UNIT = 1_000_000

/**
 * Default minimum charge per request (USD, 6dp) — protects against
 * zero-token abuse. Business policy, server-configurable.
 */
export const DEFAULT_MINIMUM_CHARGE_STRING = '0.000001'

// ─── Formulas (documented) ──────────────────────────────────────────────
//
// 1. Input cost      = inputPrice  × promptTokens     / 1_000_000
// 2. Output cost     = outputPrice × completionTokens / 1_000_000
// 3. Cached cost     = inputPrice  × cachedTokens     / 1_000_000
//                     (V1: cached billed at input rate; future: cachedPrice)
// 4. Provider cost   = input cost + output cost + cached cost
// 5. Markup cost     = providerCost × markupPercent / 100
// 6. Subtotal        = providerCost + markupCost
// 7. Total (user)    = subtotal + serviceFee
// 8. Rounding        = floor (ROUND_DOWN) to 6 decimal places — applied
//                      ONCE on the final total; never overcharges the user.
// 9. Minimum charge  = max(total, minimumCharge) — charged when total is
//                      below the configured floor (e.g. zero-token request).
//
// All intermediate steps keep full decimal.js precision; only the final
// user-facing total is rounded. Deterministic: same inputs → same outputs.

export class PricingEngine {
  /**
   * Calculate the cost breakdown for a usage measurement.
   * Pure function — no I/O, no state, no side effects.
   */
  calculate(input: CalculateInput): CostBreakdown {
    const { snapshot, usage } = input
    const currency: CurrencyCode = snapshot.currency

    const serviceFee = input.serviceFee ?? snapshot.serviceFee
    if (serviceFee.currency !== currency) {
      throw new PricingError(
        PricingErrorCode.CURRENCY_MISMATCH,
        `Service fee currency ${serviceFee.currency} does not match ${currency}.`
      )
    }

    const minimumCharge = input.minimumCharge ?? this.defaultMinimumCharge(currency)
    if (minimumCharge.currency !== currency) {
      throw new PricingError(
        PricingErrorCode.CURRENCY_MISMATCH,
        `Minimum charge currency ${minimumCharge.currency} does not match ${currency}.`
      )
    }

    // 1-3. Component costs (per 1M tokens).
    const inputCost = snapshot.inputPrice
      .multiply(usage.promptTokens)
      .divide(TOKENS_PER_UNIT)
    const outputCost = snapshot.outputPrice
      .multiply(usage.completionTokens)
      .divide(TOKENS_PER_UNIT)
    const cachedCost = snapshot.inputPrice
      .multiply(usage.cachedTokens)
      .divide(TOKENS_PER_UNIT)

    // 4. Provider cost (internal).
    const providerCost = inputCost.add(outputCost).add(cachedCost)

    // 5. Markup cost.
    const markupFactor = new Decimal(snapshot.markupPercent).div(100)
    const markupCost = providerCost.multiply(markupFactor)

    // 6. Subtotal.
    const subtotal = providerCost.add(markupCost)

    // 7. Total before rounding.
    const totalPreRound = subtotal.add(serviceFee)

    // 8. Rounding policy: floor to 6dp, once, on the final total.
    const totalRounded = totalPreRound.floorTo(6)

    // 9. Minimum charge.
    const totalCost = totalRounded.max(minimumCharge)

    return CostBreakdown.create({
      providerCost,
      markupCost,
      serviceFee,
      subtotal,
      totalCost,
    })
  }

  private defaultMinimumCharge(currency: CurrencyCode): Money {
    return Money.fromString(DEFAULT_MINIMUM_CHARGE_STRING, currency)
  }
}

