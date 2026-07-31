// ProxyAI — PricingSnapshot Value Object
// Billing Design Review v2 — Revision 2 (Pricing Snapshot)
// Immutable audit snapshot of the pricing applied to a charge.
// Pure domain object: no database dependency.

import { Money, type CurrencyCode } from '@/lib/money'

export class PricingSnapshotError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'PricingSnapshotError'
  }
}

export const PricingSnapshotErrorCode = {
  INVALID_PRICE: 'INVALID_PRICE',
  INVALID_MARKUP: 'INVALID_MARKUP',
  INVALID_SERVICE_FEE: 'INVALID_SERVICE_FEE',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
} as const

export interface PricingSnapshotParams {
  pricingVersionId: string
  /** price per 1M input tokens */
  inputPrice: Money
  /** price per 1M output tokens */
  outputPrice: Money
  /** markup percent, e.g. 10 = +10% */
  markupPercent: number
  /** fixed service fee per request */
  serviceFee: Money
}

/**
 * Immutable snapshot of the exact pricing applied when a charge was made.
 * Stored on UsageLog so later pricing changes never invalidate the audit.
 */
export class PricingSnapshot {
  readonly pricingVersionId: string
  readonly inputPrice: Money
  readonly outputPrice: Money
  readonly markupPercent: number
  readonly serviceFee: Money

  private constructor(params: PricingSnapshotParams) {
    this.pricingVersionId = params.pricingVersionId
    this.inputPrice = params.inputPrice
    this.outputPrice = params.outputPrice
    this.markupPercent = params.markupPercent
    this.serviceFee = params.serviceFee
  }

  static create(params: PricingSnapshotParams): PricingSnapshot {
    if (!params.inputPrice.isPositive() || !params.outputPrice.isPositive()) {
      throw new PricingSnapshotError(
        PricingSnapshotErrorCode.INVALID_PRICE,
        'Input and output prices must be positive.'
      )
    }

    if (!Number.isFinite(params.markupPercent) || params.markupPercent < 0) {
      throw new PricingSnapshotError(
        PricingSnapshotErrorCode.INVALID_MARKUP,
        'Markup percent must be a non-negative finite number.'
      )
    }

    if (params.serviceFee.isNegative()) {
      throw new PricingSnapshotError(
        PricingSnapshotErrorCode.INVALID_SERVICE_FEE,
        'Service fee must not be negative.'
      )
    }

    if (
      params.inputPrice.currency !== params.outputPrice.currency ||
      params.inputPrice.currency !== params.serviceFee.currency
    ) {
      throw new PricingSnapshotError(
        PricingSnapshotErrorCode.CURRENCY_MISMATCH,
        'All pricing components must share the same currency.'
      )
    }

    return new PricingSnapshot(params)
  }

  get currency(): CurrencyCode {
    return this.inputPrice.currency
  }

  /** Serialized form for persistence (UsageLog pricing snapshot columns). */
  toPersistence() {
    return {
      pricingVersionId: this.pricingVersionId,
      inputPrice: this.inputPrice.value,
      outputPrice: this.outputPrice.value,
      markupPercent: this.markupPercent,
      serviceFee: this.serviceFee.value,
      currency: this.currency,
    }
  }
}
