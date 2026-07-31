// ProxyAI Prisma Client Singleton + Decimal boundary conversions
// Prisma.Decimal and decimal.js Decimal share the same runtime (decimal.js),
// but their TS types differ. Convert explicitly at the infra boundary so the
// domain (Money VO) stays free of Prisma types.

import { PrismaClient, Prisma } from '@prisma/client'
import Decimal from 'decimal.js'
import { Money } from '@/lib/money'
import type { Currency } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/** Instance type of decimal.js Decimal (types are incomplete in @types/decimal.js). */
type DecimalValue = InstanceType<typeof Decimal>

/** Money (decimal.js) → Prisma.Decimal (for persistence queries). */
export function moneyToPrisma(money: Money): Prisma.Decimal {
  return new Prisma.Decimal(money.toString())
}

/** decimal.js Decimal → Prisma.Decimal. */
export function decimalToPrisma(value: DecimalValue): Prisma.Decimal {
  return new Prisma.Decimal(value.toString())
}

/** Prisma.Decimal → decimal.js Decimal (for domain arithmetic). */
export function prismaToDecimal(value: Prisma.Decimal | { toString(): string }): DecimalValue {
  return new Decimal(value.toString())
}

/** Prisma.Decimal → Money. */
export function prismaToMoney(value: Prisma.Decimal, currency: Currency): Money {
  return Money.fromDecimal(new Decimal(value.toString()), currency)
}
