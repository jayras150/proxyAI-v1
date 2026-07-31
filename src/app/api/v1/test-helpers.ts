// ProxyAI — API Test Helpers
// Shared helpers for testing route handlers with in-memory fakes.

import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { Prisma } from '@prisma/client'
import type { Wallet, Transaction, TransactionStatus } from '@prisma/client'
import type { WalletRepository } from '@/server/wallet/wallet.repository'
import type { TransactionRepository, TransactionCreateInput } from '@/server/transactions/transaction.repository'

/** Build a NextRequest for a route handler test. */
export function makeRequest(
  url: string,
  options: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}
): NextRequest {
  const headers = new Headers(options.headers ?? {})
  if (options.token) {
    headers.set('cookie', `proxyai_access=${options.token}`)
  }
  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  return new NextRequest(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

/** Sign a valid access token for tests. */
export function signAccessToken(overrides: { sub?: string; email?: string; role?: string } = {}): string {
  return jwt.sign(
    {
      sub: overrides.sub ?? 'user-1',
      email: overrides.email ?? 'user@test.dev',
      role: overrides.role ?? 'USER',
      type: 'access',
    },
    process.env.JWT_SECRET ?? 'test-secret',
    { expiresIn: '15m' }
  )
}

/** In-memory wallet repo (same pattern as service tests). */
export class FakeWalletRepo implements WalletRepository {
  wallets = new Map<string, Wallet>()

  async findById(id: string) {
    return this.wallets.get(id) ?? null
  }

  async findByUserId(userId: string) {
    for (const w of this.wallets.values()) if (w.userId === userId) return w
    return null
  }

  async findByUserIdAndStatus(userId: string, status: Wallet['status']) {
    const w = await this.findByUserId(userId)
    return w && w.status === status ? w : null
  }

  async create(userId: string, currency: Wallet['currency']) {
    const wallet: Wallet = {
      id: `wallet-${userId}`,
      userId,
      balance: new Prisma.Decimal(0),
      currency,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.wallets.set(wallet.id, wallet)
    return wallet
  }

  async credit(id: string, amount: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    this.wallets.set(id, { ...w, balance: w.balance.plus(amount), version: w.version + 1 })
    return this.wallets.get(id)!
  }

  async debitIfSufficient(id: string, amount: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    if (w.balance.lessThan(amount)) return null
    this.wallets.set(id, { ...w, balance: w.balance.minus(amount), version: w.version + 1 })
    return this.wallets.get(id)!
  }
  async debitWithFloor(id: string, amount: Prisma.Decimal, floor: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    if (w.balance.plus(floor).lessThan(amount)) return null
    this.wallets.set(id, { ...w, balance: w.balance.minus(amount), version: w.version + 1 })
    return this.wallets.get(id)!
  }

  async updateStatus(id: string, status: Wallet['status']) {
    const w = this.wallets.get(id)!
    this.wallets.set(id, { ...w, status })
    return this.wallets.get(id)!
  }
}

/** In-memory transaction repo with keyset pagination. */
export class FakeTxRepo implements TransactionRepository {
  transactions: Transaction[] = []
  seq = 0

  async create(input: TransactionCreateInput) {
    if (this.transactions.some((t) => t.reference === input.reference)) {
      throw new Error('duplicate reference')
    }
    const tx: Transaction = {
      id: `txn-${++this.seq}`,
      walletId: input.walletId,
      userId: input.userId,
      amount: input.amount,
      balanceBefore: input.balanceBefore,
      balanceAfter: input.balanceAfter,
      currency: input.currency,
      type: input.type,
      reference: input.reference,
      status: (input.status ?? 'COMPLETED') as TransactionStatus,
      description: input.description ?? null,
      requestId: input.requestId ?? null,
      providerReference: input.providerReference ?? null,
      createdBy: input.createdBy ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date(),
    }
    this.transactions.push(tx)
    return tx
  }

  async findByReference(ref: string) {
    return this.transactions.find((t) => t.reference === ref) ?? null
  }

  async findByWalletIdPaginated(
    walletId: string,
    cursor: { createdAt: Date; id: string } | null,
    limit: number
  ) {
    let filtered = this.transactions.filter((t) => t.walletId === walletId)
    if (cursor) {
      filtered = filtered.filter((t) => {
        if (t.createdAt < cursor.createdAt) return true
        if (t.createdAt.getTime() === cursor.createdAt.getTime() && t.id < cursor.id) return true
        return false
      })
    }
    const sorted = filtered.sort((a, b) => {
      const byDate = b.createdAt.getTime() - a.createdAt.getTime()
      return byDate !== 0 ? byDate : b.id.localeCompare(a.id)
    })
    const hasMore = sorted.length > limit
    const items = hasMore ? sorted.slice(0, limit) : sorted
    const last = items[items.length - 1]
    return {
      items,
      nextCursor: last ? { createdAt: last.createdAt, id: last.id } : null,
      hasMore,
    }
  }
}
