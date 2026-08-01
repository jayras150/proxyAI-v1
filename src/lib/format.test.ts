// ProxyAI — formatting helpers unit tests (dashboard display layer)
// Covers money/number/time formatting used by the Dashboard Home widgets.

import { describe, it, expect } from 'vitest'
import {
  formatMoney,
  formatSignedAmount,
  formatNumber,
  formatRelativeTime,
  formatDateTime,
  formatLongDate,
  greetingForHour,
} from '@/lib/format'

describe('formatMoney', () => {
  it('formats USD with two decimals', () => {
    expect(formatMoney('50.000000', 'USD')).toBe('$50.00')
    expect(formatMoney('0.001488', 'USD')).toBe('$0.00')
  })

  it('formats IDR without decimals', () => {
    const out = formatMoney('50000.000000', 'IDR')
    // Symbol depends on runtime locale (Rp in id-ID, ISO code elsewhere);
    // the invariant is the grouping and the absence of decimals.
    expect(out).toContain('50,000')
    expect(out).not.toContain('.')
  })

  it('formats SGD with two decimals', () => {
    const out = formatMoney('12.500000', 'SGD')
    // Symbol depends on runtime locale (S$ in en-SG, ISO code elsewhere).
    expect(out).toContain('12.50')
  })

  it('handles negative balances', () => {
    expect(formatMoney('-0.040000', 'USD')).toBe('-$0.04')
  })

  it('falls back to the raw string for unparseable input', () => {
    expect(formatMoney('not-a-number', 'USD')).toBe('not-a-number')
  })
})

describe('formatSignedAmount', () => {
  it('prefixes TOPUP and REFUND with +', () => {
    expect(formatSignedAmount('TOPUP', '10.000000', 'USD')).toBe('+$10.00')
    expect(formatSignedAmount('REFUND', '2.500000', 'USD')).toBe('+$2.50')
    expect(formatSignedAmount('ADMIN_CREDIT', '5.000000', 'USD')).toBe('+$5.00')
  })

  it('prefixes AI_USAGE and ADMIN_DEBIT with a minus', () => {
    expect(formatSignedAmount('AI_USAGE', '0.001488', 'USD')).toBe('−$0.00')
    expect(formatSignedAmount('ADMIN_DEBIT', '1.000000', 'USD')).toBe('−$1.00')
  })

  it('uses the value sign for ADJUSTMENT', () => {
    expect(formatSignedAmount('ADJUSTMENT', '3.000000', 'USD')).toBe('+$3.00')
    expect(formatSignedAmount('ADJUSTMENT', '-3.000000', 'USD')).toBe('−$3.00')
  })

  it('renders zero unsigned', () => {
    expect(formatSignedAmount('TOPUP', '0.000000', 'USD')).toBe('$0.00')
  })
})

describe('formatNumber', () => {
  it('adds locale separators', () => {
    expect(formatNumber(12345)).toContain('12')
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-01T12:00:00.000Z')

  it('returns "just now" under a minute', () => {
    expect(formatRelativeTime('2026-08-01T11:59:40.000Z', now)).toBe('just now')
  })

  it('returns minutes ago', () => {
    expect(formatRelativeTime('2026-08-01T11:55:00.000Z', now)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    expect(formatRelativeTime('2026-08-01T09:00:00.000Z', now)).toBe('3h ago')
  })

  it('returns days ago for less than a week', () => {
    expect(formatRelativeTime('2026-07-30T12:00:00.000Z', now)).toBe('2d ago')
  })

  it('falls back to an absolute date beyond a week', () => {
    const out = formatRelativeTime('2026-06-01T12:00:00.000Z', now)
    expect(out).not.toMatch(/ago$/)
  })

  it('returns the input string for invalid dates', () => {
    expect(formatRelativeTime('nope', now)).toBe('nope')
  })
})

describe('formatDateTime / formatLongDate', () => {
  it('formats a date-time', () => {
    const out = formatDateTime('2026-08-01T01:00:00.000Z')
    expect(out).toContain('2026')
  })

  it('formats a long date', () => {
    const out = formatLongDate(new Date('2026-08-01T12:00:00.000Z'))
    expect(out).toContain('August')
  })

  it('returns the input string for invalid dates', () => {
    expect(formatDateTime('nope')).toBe('nope')
  })
})

describe('greetingForHour', () => {
  it('maps hours to greetings', () => {
    expect(greetingForHour(3)).toBe('Good night')
    expect(greetingForHour(9)).toBe('Good morning')
    expect(greetingForHour(14)).toBe('Good afternoon')
    expect(greetingForHour(19)).toBe('Good evening')
    expect(greetingForHour(23)).toBe('Good night')
  })
})
