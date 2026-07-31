// ProxyAI — Money Value Object Unit Tests

import { describe, it, expect } from 'vitest'
import { Money, MoneyError } from '@/lib/money'
import { Prisma } from '@prisma/client'

describe('Money', () => {
  describe('fromString', () => {
    it('creates money from a decimal string', () => {
      const money = Money.fromString('50.00', 'USD')
      expect(money.value.toString()).toBe('50')
      expect(money.currency).toBe('USD')
    })

    it('rejects invalid strings', () => {
      expect(() => Money.fromString('abc', 'USD')).toThrow(MoneyError)
      expect(() => Money.fromString('', 'USD')).toThrow(MoneyError)
    })

    it('rejects non-finite values', () => {
      expect(() => Money.fromString('NaN', 'USD')).toThrow(MoneyError)
    })
  })

  describe('comparisons', () => {
    it('isPositive / isNegative / isZero', () => {
      expect(Money.fromString('1.00', 'USD').isPositive()).toBe(true)
      expect(Money.fromString('-1.00', 'USD').isNegative()).toBe(true)
      expect(Money.fromString('0', 'USD').isZero()).toBe(true)
    })

    it('compareTo works', () => {
      const a = Money.fromString('10.00', 'USD')
      const b = Money.fromString('20.00', 'USD')
      expect(a.compareTo(b)).toBe(-1)
      expect(b.compareTo(a)).toBe(1)
      expect(a.compareTo(Money.fromString('10.00', 'USD'))).toBe(0)
    })
  })

  describe('arithmetic', () => {
    it('adds same-currency money', () => {
      const sum = Money.fromString('10.50', 'USD').add(Money.fromString('0.25', 'USD'))
      expect(sum.toString()).toBe('10.750000')
    })

    it('subtracts same-currency money', () => {
      const diff = Money.fromString('10.00', 'USD').subtract(Money.fromString('3.50', 'USD'))
      expect(diff.toString()).toBe('6.500000')
    })

    it('throws on currency mismatch', () => {
      expect(() =>
        Money.fromString('10.00', 'USD').add(Money.fromString('10.00', 'IDR'))
      ).toThrow(MoneyError)
      expect(() =>
        Money.fromString('10.00', 'USD').subtract(Money.fromString('10.00', 'SGD'))
      ).toThrow(MoneyError)
    })
  })

  describe('serialization', () => {
    it('toString is fixed 6 decimals (never float)', () => {
      expect(Money.fromString('0.1', 'USD').toString()).toBe('0.100000')
      expect(Money.fromString('1234567890.123456', 'USD').toString()).toBe('1234567890.123456')
    })

    it('preserves Decimal for persistence', () => {
      const money = Money.fromString('1.5', 'USD')
      expect(money.value).toBeInstanceOf(Prisma.Decimal)
    })
  })
})
