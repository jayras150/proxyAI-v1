// ProxyAI — PricingEngine Unit Tests
// Pure domain: deterministic, stateless, no dependencies.

import { describe, it, expect } from 'vitest'
import { PricingEngine, PricingError } from '@/server/billing/pricing-engine'
import { PricingSnapshot } from '@/server/billing/pricing-snapshot'
import { TokenUsage } from '@/server/billing/token-usage'
import { Money } from '@/lib/money'

const engine = new PricingEngine()

/** DeepSeek-like model: $0.15/1M input, $0.60/1M output, 10% markup, $0.000001 fee. */
function snapshot(overrides: Partial<Parameters<typeof PricingSnapshot.create>[0]> = {}) {
  return PricingSnapshot.create({
    pricingVersionId: 'pv-1',
    inputPrice: Money.fromString('0.15', 'USD'),
    outputPrice: Money.fromString('0.60', 'USD'),
    markupPercent: 10,
    serviceFee: Money.fromString('0.000001', 'USD'),
    ...overrides,
  })
}

function usage(prompt: number, completion: number, cached = 0) {
  return TokenUsage.create({ promptTokens: prompt, completionTokens: completion, cachedTokens: cached })
}

describe('PricingEngine — cost calculation', () => {
  it('input tokens only', () => {
    // 1,000,000 input × $0.15/1M = $0.15; +10% = $0.165; +fee = $0.165001
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(1_000_000, 0) })
    expect(result.providerCost.toString()).toBe('0.150000')
    expect(result.markupCost.toString()).toBe('0.015000')
    expect(result.subtotal.toString()).toBe('0.165000')
    expect(result.totalCost.toString()).toBe('0.165001')
  })

  it('output tokens only', () => {
    // 1,000,000 output × $0.60/1M = $0.60; +10% = $0.66; +fee = $0.660001
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(0, 1_000_000) })
    expect(result.providerCost.toString()).toBe('0.600000')
    expect(result.totalCost.toString()).toBe('0.660001')
  })

  it('mixed input + output tokens', () => {
    // 1,000 input ($0.00015) + 500 output ($0.0003) = $0.00045; +10% = $0.000495; +fee
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(1_000, 500) })
    expect(result.providerCost.toString()).toBe('0.000450')
    expect(result.totalCost.toString()).toBe('0.000496') // 0.000495 + 0.000001 = 0.000496
  })

  it('cached tokens billed at input rate (V1 policy)', () => {
    // 100,000 cached × $0.15/1M = $0.015
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(0, 0, 100_000) })
    expect(result.providerCost.toString()).toBe('0.015000')
    expect(result.totalCost.toString()).toBe('0.016501') // +10% + fee
  })

  it('zero tokens → minimum charge applies', () => {
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(0, 0) })
    // subtotal + fee = 0.000001, floored; max(0.000001, min 0.000001) = 0.000001
    expect(result.providerCost.toString()).toBe('0.000000')
    expect(result.totalCost.toString()).toBe('0.000001')
  })

  it('minimum charge raises a below-floor total', () => {
    // 1 token input: $0.00000015 → +10% → $0.000000165 → +fee → $0.000001165 → floor 0.000001
    const result = engine.calculate({
      snapshot: snapshot(),
      usage: usage(1, 0),
      minimumCharge: Money.fromString('0.000010', 'USD'),
    })
    expect(result.totalCost.toString()).toBe('0.000010')
  })

  it('service fee override', () => {
    const result = engine.calculate({
      snapshot: snapshot(),
      usage: usage(1_000_000, 0),
      serviceFee: Money.fromString('0.010000', 'USD'),
    })
    // 0.15 + 0.015 + 0.01 = 0.175
    expect(result.totalCost.toString()).toBe('0.175000')
  })

  it('markup of 0 → no markup cost', () => {
    const result = engine.calculate({
      snapshot: snapshot({ markupPercent: 0 }),
      usage: usage(1_000_000, 0),
    })
    expect(result.markupCost.toString()).toBe('0.000000')
    expect(result.totalCost.toString()).toBe('0.150001')
  })
})

describe('PricingEngine — rounding policy', () => {
  it('floors (ROUND_DOWN) the final total to 6dp — never overcharges', () => {
    // 3,333 input × $0.15/1M = $0.00049995 → +10% = $0.000549945 → +fee = $0.000550945
    // floor → $0.000550 (not rounded up to 0.000551)
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(3_333, 0) })
    expect(result.totalCost.toString()).toBe('0.000550')
  })

  it('keeps intermediate components at full precision (no early rounding)', () => {
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(333, 0) })
    // provider = 333 × 0.15/1M = 0.00004995 (display via toFixed truncates; value full)
    expect(result.providerCost.value.eq(0.00004995)).toBe(true)
  })
})

describe('PricingEngine — precision & determinism', () => {
  it('high precision values stay exact', () => {
    // 1 token output: $0.60/1M = $0.0000006 → +10% → $0.00000066 → +fee → $0.00000166
    // floor → 0.000001, then max(min 0.000001) = 0.000001
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(0, 1) })
    expect(result.providerCost.value.eq(0.0000006)).toBe(true)
    expect(result.totalCost.toString()).toBe('0.000001')
  })

  it('large request (100M tokens) computes without overflow', () => {
    const result = engine.calculate({ snapshot: snapshot(), usage: usage(50_000_000, 50_000_000) })
    // input $7.50 + output $30 = $37.50; +10% = $41.25; +fee = $41.250001
    expect(result.providerCost.toString()).toBe('37.500000')
    expect(result.totalCost.toString()).toBe('41.250001')
  })

  it('is 100% deterministic — same inputs, same outputs', () => {
    const a = engine.calculate({ snapshot: snapshot(), usage: usage(12_345, 6_789) })
    const b = engine.calculate({ snapshot: snapshot(), usage: usage(12_345, 6_789) })
    expect(a.totalCost.toString()).toBe(b.totalCost.toString())
    expect(a.providerCost.toString()).toBe(b.providerCost.toString())
    expect(a.totalCost.compareTo(b.totalCost)).toBe(0)
  })

  it('rejects service fee currency mismatch', () => {
    expect(() =>
      engine.calculate({
        snapshot: snapshot(),
        usage: usage(100, 100),
        serviceFee: Money.fromString('0.01', 'IDR'),
      })
    ).toThrow(PricingError)
  })

  it('rejects minimum charge currency mismatch', () => {
    expect(() =>
      engine.calculate({
        snapshot: snapshot(),
        usage: usage(100, 100),
        minimumCharge: Money.fromString('0.01', 'SGD'),
      })
    ).toThrow(PricingError)
  })
})
