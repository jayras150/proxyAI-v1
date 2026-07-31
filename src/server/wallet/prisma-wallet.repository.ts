// ProxyAI — Prisma WalletRepository
// Milestone 2 — Repository implementation (Wallet)

import { prisma } from '@/lib/prisma'
import type { Wallet, WalletStatus, Currency, Prisma } from '@prisma/client'
import type { WalletRepository } from './wallet.repository'

export class PrismaWalletRepository implements WalletRepository {
  async findById(id: string): Promise<Wallet | null> {
    return prisma.wallet.findUnique({ where: { id } })
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    return prisma.wallet.findUnique({ where: { userId } })
  }

  async findByUserIdAndStatus(userId: string, status: WalletStatus): Promise<Wallet | null> {
    return prisma.wallet.findFirst({ where: { userId, status } })
  }

  async create(
    userId: string,
    currency: Currency,
    tx?: Prisma.TransactionClient
  ): Promise<Wallet> {
    const client = tx ?? prisma
    return client.wallet.create({
      data: {
        userId,
        currency,
      },
    })
  }

  async credit(id: string, amount: Prisma.Decimal, tx?: Prisma.TransactionClient): Promise<Wallet> {
    const client = tx ?? prisma
    return client.wallet.update({
      where: { id },
      data: {
        balance: { increment: amount },
        version: { increment: 1 },
      },
    })
  }

  async debitIfSufficient(
    id: string,
    amount: Prisma.Decimal,
    tx?: Prisma.TransactionClient
  ): Promise<Wallet | null> {
    const client = tx ?? prisma

    // Atomic conditional update: only decrements when balance >= amount.
    // count === 0 means insufficient balance (or wallet not found).
    const result = await client.wallet.updateMany({
      where: {
        id,
        balance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
        version: { increment: 1 },
      },
    })

    if (result.count === 0) return null

    return client.wallet.findUnique({ where: { id } })
  }

  async debitWithFloor(
    id: string,
    amount: Prisma.Decimal,
    floor: Prisma.Decimal,
    tx?: Prisma.TransactionClient
  ): Promise<Wallet | null> {
    const client = tx ?? prisma

    // Atomic conditional update: succeeds when balance >= amount - floor
    // (post-debit balance may go negative, but never below -floor).
    // count === 0 means the floor would be exceeded (or wallet not found).
    const result = await client.wallet.updateMany({
      where: {
        id,
        balance: { gte: amount.minus(floor) },
      },
      data: {
        balance: { decrement: amount },
        version: { increment: 1 },
      },
    })

    if (result.count === 0) return null

    return client.wallet.findUnique({ where: { id } })
  }

  async updateStatus(id: string, status: WalletStatus, tx?: Prisma.TransactionClient): Promise<Wallet> {
    const client = tx ?? prisma
    return client.wallet.update({
      where: { id },
      data: { status },
    })
  }
}
