// ProxyAI — TransactionService Unit Tests (cursor pagination)

import { describe, it, expect } from 'vitest'
import { TransactionService } from '@/server/transactions/transaction.service'
import type { TransactionRepository, TransactionCursor, TransactionPage } from '@/server/transactions/transaction.repository'
import { Prisma } from '@prisma/client'
import type { Transaction } from '@prisma/client'

function makeTransaction(id: string, createdAt: Date): Transaction {
  return {
    id,
    walletId: 'wallet-1',
    userId: 'user-1',
    amount: new Prisma.Decimal(1),
    balanceBefore: new Prisma.Decimal(0),
    balanceAfter: new Prisma.Decimal(1),
    currency: 'USD',
    type: 'TOPUP',
    reference: `ref-${id}`,
    status: 'COMPLETED',
    description: null,
    requestId: null,
    providerReference: null,
    createdBy: null,
    ipAddress: null,
    userAgent: null,
    createdAt,
  }
}

class FakePaginatedRepo implements TransactionRepository {
  constructor(private rows: Transaction[]) {}

  async create(): Promise<Transaction> {
    throw new Error('not used in this test')
  }

  async findByReference() {
    return null
  }

  async findByWalletIdPaginated(
    _walletId: string,
    cursor: TransactionCursor | null,
    limit: number
  ): Promise<TransactionPage> {
    // Keyset filter over (createdAt desc, id desc)
    let filtered = this.rows
    if (cursor) {
      filtered = this.rows.filter((t) => {
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

describe('TransactionService cursor pagination', () => {
  const base = new Date('2026-07-31T10:00:00.000Z')
  const rows = [
    makeTransaction('txn-1', base),
    makeTransaction('txn-2', new Date(base.getTime() + 1000)),
    makeTransaction('txn-3', new Date(base.getTime() + 2000)),
    makeTransaction('txn-4', new Date(base.getTime() + 3000)),
    makeTransaction('txn-5', new Date(base.getTime() + 4000)),
  ]

  it('returns the first page with a next_cursor when more exist', async () => {
    const service = new TransactionService(new FakePaginatedRepo(rows))
    const page = await service.getWalletHistory('wallet-1', null, 2)

    expect(page.items.map((t) => t.id)).toEqual(['txn-5', 'txn-4'])
    expect(page.hasMore).toBe(true)
    expect(page.nextCursor).toBeTruthy()
  })

  it('walks all pages via cursor without duplicates or gaps', async () => {
    const service = new TransactionService(new FakePaginatedRepo(rows))
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0

    do {
      const page = await service.getWalletHistory('wallet-1', cursor, 2)
      seen.push(...page.items.map((t) => t.id))
      cursor = page.nextCursor
      pages += 1
      if (!page.hasMore) break
    } while (cursor)

    expect(pages).toBe(3)
    expect(seen).toEqual(['txn-5', 'txn-4', 'txn-3', 'txn-2', 'txn-1'])
  })

  it('returns hasMore=false on the last page', async () => {
    const service = new TransactionService(new FakePaginatedRepo(rows))
    const page = await service.getWalletHistory('wallet-1', null, 100)
    expect(page.hasMore).toBe(false)
    expect(page.nextCursor).toBeNull()
  })

  it('clamps limit to [1, 100]', async () => {
    const service = new TransactionService(new FakePaginatedRepo(rows))
    const tooBig = await service.getWalletHistory('wallet-1', null, 9999)
    expect(tooBig.items.length).toBe(5) // clamped to 100, but only 5 rows

    const tooSmall = await service.getWalletHistory('wallet-1', null, 0)
    expect(tooSmall.items.length).toBe(1) // clamped to 1
  })

  it('round-trips cursor encode/decode', async () => {
    const service = new TransactionService(new FakePaginatedRepo(rows))
    const cursor: TransactionCursor = { createdAt: base, id: 'txn-1' }
    const encoded = service.encodeCursor(cursor)
    const decoded = service.decodeCursor(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded!.id).toBe('txn-1')
    expect(decoded!.createdAt.toISOString()).toBe(base.toISOString())
  })

  it('returns null for malformed cursors', async () => {
    const service = new TransactionService(new FakePaginatedRepo(rows))
    expect(service.decodeCursor('not-base64!!')).toBeNull()
    expect(service.decodeCursor(Buffer.from('{"no":"fields"}').toString('base64url'))).toBeNull()
  })
})
