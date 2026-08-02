// ProxyAI — Time Range helper unit tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveTimeRange, dayBuckets, utcDayKey, percentString } from '../time-range'

describe('resolveTimeRange', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('today: starts at UTC midnight and ends now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T15:30:00.000Z'))
    const range = resolveTimeRange('today')
    expect(range.from.toISOString()).toBe('2026-08-02T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-08-02T15:30:00.000Z')
    expect(range.label).toBe('Today')
  })

  it('yesterday: covers the full previous UTC day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T08:00:00.000Z'))
    const range = resolveTimeRange('yesterday')
    expect(range.from.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-08-02T00:00:00.000Z')
  })

  it('7d: window is 7 days back from now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'))
    const range = resolveTimeRange('7d')
    expect(range.from.toISOString()).toBe('2026-08-03T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })

  it('30d: window is 30 days back from now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'))
    const range = resolveTimeRange('30d')
    expect(range.from.toISOString()).toBe('2026-07-11T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })

  it('custom: uses provided from/to', () => {
    const range = resolveTimeRange('custom', '2026-08-01', '2026-08-05')
    expect(range.from.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-08-05T00:00:00.000Z')
  })

  it('custom: falls back to 7d when from is missing or invalid', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'))
    const missing = resolveTimeRange('custom', null, null)
    expect(missing.from.toISOString()).toBe('2026-08-03T00:00:00.000Z')

    const invalid = resolveTimeRange('custom', 'not-a-date', '2026-08-05')
    expect(invalid.from.toISOString()).toBe('2026-08-03T00:00:00.000Z')
  })

  it('custom: swaps invalid range (to <= from) to from → now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'))
    const range = resolveTimeRange('custom', '2026-08-10', '2026-08-01')
    expect(range.from.toISOString()).toBe('2026-08-10T00:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })
})

describe('dayBuckets & utcDayKey', () => {
  it('enumerates inclusive day buckets between from and to', () => {
    const from = new Date('2026-08-01T10:00:00.000Z')
    const to = new Date('2026-08-04T10:00:00.000Z')
    expect(dayBuckets(from, to)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'])
  })

  it('utcDayKey slices the ISO date', () => {
    expect(utcDayKey(new Date('2026-08-02T23:59:59.000Z'))).toBe('2026-08-02')
  })
})

describe('percentString', () => {
  it('computes a percentage string', () => {
    expect(percentString(95, 100)).toBe('95.00')
  })

  it('returns 0.00 when denominator is zero', () => {
    expect(percentString(10, 0)).toBe('0.00')
  })

  it('honours decimals argument', () => {
    expect(percentString(1, 3, 1)).toBe('33.3')
  })
})
