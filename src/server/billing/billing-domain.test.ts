// ProxyAI — Billing Domain Value Objects Unit Tests

import { describe, it, expect } from 'vitest'
import { TokenUsage, TokenUsageError } from '@/server/billing/token-usage'
import { PricingSnapshot, PricingSnapshotError } from '@/server/billing/pricing-snapshot'
import { CostBreakdown, CostBreakdownError } from '@/server/billing/cost-breakdown'
import { Money } from '@/lib/money'

describe('TokenUsage', () => {
  it('computes total tokens', () => {
    const usage = TokenUsage.create({ promptTokens: 10, completionTokens: 20, cachedTokens: 5 })
    expect(usage.totalTokens).toBe(35)
  })

  it('defaults cachedTokens to 0', () => {
    const usage = TokenUsage.create({ promptTokens: 10, completionTokens: 20 })
    expect(usage.cachedTokens).toBe(0)
    expect(usage.totalTokens).toBe(30)
  })

  it('rejects negative or non-integer token counts', () => {
    expect(() => TokenUsage.create({ promptTokens: -1, completionTokens: 0 })).toThrow(TokenUsageError)
    expect(() => TokenUsage.create({ promptTokens: 1.5, completionTokens: 0 })).toThrow(TokenUsageError)
  })

  it('merges usage via add()', () => {
    const a = TokenUsage.create({ promptTokens: 10, completionTokens: 5 })
    const b = TokenUsage.create({ promptTokens: 2, completionTokens: 3, cachedTokens: 4 })
    const merged = a.add(b)
    expect(merged.promptTokens).toBe(12)
    expect(merged.completionTokens).toBe(8)
    expect(merged.cachedTokens).toBe(4)
  })
})

describe('PricingSnapshot', () => {
  const base = {
    pricingVersionId: 'pv-1',
    inputPrice: Money.fromString('0.15', 'USD'), // per 1M tokens
    outputPrice: Money.fromString('0.60', 'USD'),
    markupPercent: 10,
    serviceFee: Money.fromString('0.000001', 'USD'),
  }

  it('creates a valid snapshot', () => {
    const snap = PricingSnapshot.create(base)
    expect(snap.currency).toBe('USD')
    expect(snap.toPersistence().inputPrice.toString()).toBe('0.15')
    expect(snap.toPersistence().markupPercent).toBe(10)
  })

  it('rejects non-positive prices', () => {
    expect(() =>
      PricingSnapshot.create({ ...base, inputPrice: Money.fromString('0', 'USD') })
    ).toThrow(PricingSnapshotError)
  })

  it('rejects negative markup or service fee', () => {
    expect(() => PricingSnapshot.create({ ...base, markupPercent: -5 })).toThrow(PricingSnapshotError)
    expect(() =>
      PricingSnapshot.create({ ...base, serviceFee: Money.fromString('-0.01', 'USD') })
    ).toThrow(PricingSnapshotError)
  })

  it('rejects currency mismatch across components', () => {
    expect(() =>
      PricingSnapshot.create({ ...base, inputPrice: Money.fromString('0.15', 'IDR') })
    ).toThrow(PricingSnapshotError)
  })
})

describe('CostBreakdown', () => {
  const breakdownParams = () => ({
    providerCost: Money.fromString('0.001', 'USD'),
    markupCost: Money.fromString('0.0001', 'USD'),
    serviceFee: Money.fromString('0.000001', 'USD'),
    subtotal: Money.fromString('0.0011', 'USD'),
    totalCost: Money.fromString('0.001101', 'USD'),
  })

  it('creates a valid breakdown with all components', () => {
    const breakdown = CostBreakdown.create(breakdownParams())
    expect(breakdown.currency).toBe('USD')
    expect(breakdown.totalCost.toString()).toBe('0.001101')
    expect(breakdown.providerCost.toString()).toBe('0.001000')
  })

  it('rejects negative costs', () => {
    expect(() =>
      CostBreakdown.create({
        ...breakdownParams(),
        totalCost: Money.fromString('-0.01', 'USD'),
      })
    ).toThrow(CostBreakdownError)
  })

  it('rejects currency mismatch', () => {
    expect(() =>
      CostBreakdown.create({
        ...breakdownParams(),
        markupCost: Money.fromString('0.0001', 'IDR'),
      })
    ).toThrow(CostBreakdownError)
  })
})
