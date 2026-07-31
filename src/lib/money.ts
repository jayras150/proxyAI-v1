// ProxyAI — Money Value Object
// Blueprint Reference: Sprint 4 §19-22 — Wallet & Billing
// Business Rule: money is ALWAYS Decimal, never JS number, for business ops.
// Serialization to string happens only at the API layer (Design Review §3).

import { Prisma } from '@prisma/client'
import type { Currency } from '@prisma/client'

const DECIMAL_PLACES = 6

export class MoneyError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'MoneyError'
  }
}

/**
 * Immutable money value. Wraps Prisma.Decimal (decimal.js) so business
 * logic never touches float numbers.
 */
export class Money {
  private constructor(
    readonly amount: Prisma.Decimal,
    readonly currency: Currency
  ) {}

  /** Create from a decimal-string representation, e.g. "50.00". */
  static fromString(value: string, currency: Currency): Money {
    let decimal: Prisma.Decimal
    try {
      decimal = new Prisma.Decimal(value)
    } catch {
      throw new MoneyError('INVALID_MONEY', `Invalid money value: "${value}"`)
    }

    if (!decimal.isFinite()) {
      throw new MoneyError('INVALID_MONEY', `Invalid money value: "${value}"`)
    }

    return new Money(decimal, currency)
  }

  static fromDecimal(amount: Prisma.Decimal, currency: Currency): Money {
    return new Money(amount, currency)
  }

  static zero(currency: Currency): Money {
    return new Money(new Prisma.Decimal(0), currency)
  }

  isPositive(): boolean {
    return this.amount.greaterThan(0)
  }

  isNegative(): boolean {
    return this.amount.lessThan(0)
  }

  isZero(): boolean {
    return this.amount.isZero()
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyError(
        'CURRENCY_MISMATCH',
        `Currency mismatch: ${this.currency} vs ${other.currency}`
      )
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount.plus(other.amount), this.currency)
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount.minus(other.amount), this.currency)
  }

  /** -1 | 0 | 1 */
  compareTo(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other)
    return this.amount.comparedTo(other.amount) as -1 | 0 | 1
  }

  /**
   * Canonical string form with fixed 6 decimal places,
   * e.g. "50.000000". Safe for API responses and event payloads.
   */
  toString(): string {
    return this.amount.toFixed(DECIMAL_PLACES)
  }

  /** Raw decimal for persistence (repository layer only). */
  get value(): Prisma.Decimal {
    return this.amount
  }
}
