// ProxyAI — Money Value Object
// Blueprint Reference: Sprint 4 §19-22 — Wallet & Billing
// Business Rule: money is ALWAYS Decimal (decimal.js), never JS number, for
// business ops. Serialization to string happens only at the API layer.
//
// Uses decimal.js directly (NOT Prisma.Decimal) so the billing domain has
// zero dependency on Prisma / database — pure domain requirement.

import Decimal from 'decimal.js'

const DECIMAL_PLACES = 6

/** Instance type of decimal.js Decimal. */
type DecimalValue = InstanceType<typeof Decimal>

/**
 * Supported currencies — domain-level union that mirrors the DB enum values.
 * Keeps the billing domain free of any Prisma import.
 */
export type CurrencyCode = 'USD' | 'IDR' | 'SGD'

export class MoneyError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'MoneyError'
  }
}

/**
 * Immutable money value. Wraps decimal.js Decimal so business logic never
 * touches float numbers. All arithmetic goes through this class.
 */
export class Money {
  private constructor(
    readonly amount: DecimalValue,
    readonly currency: CurrencyCode
  ) {}

  /** Create from a decimal-string representation, e.g. "50.00". */
  static fromString(value: string, currency: CurrencyCode): Money {
    let decimal: DecimalValue
    try {
      decimal = new Decimal(value)
    } catch {
      throw new MoneyError('INVALID_MONEY', `Invalid money value: "${value}"`)
    }

    if (!decimal.isFinite()) {
      throw new MoneyError('INVALID_MONEY', `Invalid money value: "${value}"`)
    }

    return new Money(decimal, currency)
  }

  static fromDecimal(amount: DecimalValue, currency: CurrencyCode): Money {
    return new Money(amount, currency)
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(new Decimal(0), currency)
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

  /** Multiply by a numeric factor (e.g. token count, markup rate). */
  multiply(factor: DecimalValue | number | string): Money {
    const f = factor instanceof Decimal ? factor : new Decimal(factor)
    return new Money(this.amount.times(f), this.currency)
  }

  /** Divide by a numeric factor (e.g. tokens-per-million). */
  divide(factor: DecimalValue | number | string): Money {
    const f = factor instanceof Decimal ? factor : new Decimal(factor)
    return new Money(this.amount.div(f), this.currency)
  }

  /** Round DOWN (floor) to the given decimal places — never overcharge. */
  floorTo(places: number = DECIMAL_PLACES): Money {
    return new Money(this.amount.toDecimalPlaces(places, Decimal.ROUND_DOWN), this.currency)
  }

  /**
   * The larger of this and other (same currency) — used for minimum charge.
   */
  max(other: Money): Money {
    this.assertSameCurrency(other)
    return this.amount.greaterThan(other.amount) ? this : other
  }

  /** Negate the value (used for the negative-balance floor). */
  negate(): Money {
    return new Money(this.amount.negated(), this.currency)
  }

  /** -1 | 0 | 1 */
  compareTo(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other)
    return this.amount.comparedTo(other.amount) as -1 | 0 | 1
  }

  /** True when this < other (same currency). */
  lessThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.amount.lessThan(other.amount)
  }

  /** True when this <= other (same currency). */
  lessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.amount.lessThanOrEqualTo(other.amount)
  }

  /**
   * Canonical string form with fixed 6 decimal places,
   * e.g. "50.000000". Safe for API responses and event payloads.
   */
  toString(): string {
    return this.amount.toFixed(DECIMAL_PLACES)
  }

  /** Raw decimal for persistence (repository layer only). */
  get value(): DecimalValue {
    return this.amount
  }
}
