// ProxyAI — WalletService Unit Tests
// Uses in-memory fakes for repositories + transaction manager so no DB is
// required. Also covers concurrency (atomic debit) scenarios.

import { describe, it, expect, beforeEach } from 'vitest'
import { WalletService } from '@/server/wallet/wallet.service'
import { WalletError } from '@/server/wallet/wallet.errors'
import { Money } from '@/lib/money'
import { LocalEventDispatcher } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { WalletRepository } from '@/server/wallet/wallet.repository'
import type {
  TransactionRepository,
  TransactionCreateInput,
} from '@/server/transactions/transaction.repository'
import type { TransactionManager, TxClient } from '@/server/db/transaction-manager'
import { Prisma } from '@prisma/client'
import type { Wallet, Transaction, TransactionStatus } from '@prisma/client'

// ─── Fakes ──────────────────────────────────────────────────────────────

class FakeWalletRepository implements WalletRepository {
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

  // Synchronous check+decrement = atomic within the event loop.
  async credit(id: string, amount: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    w.balance = w.balance.plus(amount)
    w.version += 1
    return w
  }

  async debitIfSufficient(id: string, amount: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    if (w.balance.lessThan(amount)) return null
    w.balance = w.balance.minus(amount)
    w.version += 1
    return w
  }

  async debitWithFloor(id: string, amount: Prisma.Decimal, floor: Prisma.Decimal) {
    const w = this.wallets.get(id)!
    if (w.balance.plus(floor).lessThan(amount)) return null
    w.balance = w.balance.minus(amount)
    w.version += 1
    return w
  }

  async updateStatus(id: string, status: Wallet['status']) {
    const w = this.wallets.get(id)!
    w.status = status
    return w
  }
}

class FakeTransactionRepository implements TransactionRepository {
  transactions: Transaction[] = []
  private seq = 0

  async create(input: TransactionCreateInput) {
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
    if (this.transactions.some((t) => t.reference === input.reference)) {
      throw new Error('Unique constraint: reference already exists')
    }
    this.transactions.push(tx)
    return tx
  }

  async findByReference(reference: string) {
    return this.transactions.find((t) => t.reference === reference) ?? null
  }

  async findByWalletIdPaginated(walletId: string) {
    const items = this.transactions
      .filter((t) => t.walletId === walletId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return { items, nextCursor: null, hasMore: false }
  }
}

class FakeTransactionManager implements TransactionManager {
  withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    // No real DB: run the fn with a dummy client. Commit = resolve.
    return fn({} as TxClient)
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────

let walletRepo: FakeWalletRepository
let txRepo: FakeTransactionRepository
let dispatcher: EventDispatcher
let service: WalletService
let emitted: string[]

beforeEach(async () => {
  walletRepo = new FakeWalletRepository()
  txRepo = new FakeTransactionRepository()
  dispatcher = new LocalEventDispatcher()
  emitted = []
  dispatcher.subscribe('wallet.credited', (e) => emitted.push(`credited:${e.metadata.amount}`))
  dispatcher.subscribe('wallet.debited', (e) => emitted.push(`debited:${e.metadata.amount}`))

  service = new WalletService(walletRepo, txRepo, new FakeTransactionManager(), dispatcher)
  await walletRepo.create('user-1', 'USD')
})

const USD = (v: string) => Money.fromString(v, 'USD')

// ─── Tests ──────────────────────────────────────────────────────────────

describe('WalletService.credit', () => {
  it('credits balance and creates an immutable transaction', async () => {
    const tx = await service.credit('user-1', USD('50.00'), {
      reference: 'ref-1',
      type: 'TOPUP',
      requestId: 'req-1',
    })

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('50')
    expect(tx.balanceBefore.toString()).toBe('0')
    expect(tx.balanceAfter.toString()).toBe('50')
    expect(tx.currency).toBe('USD')
    expect(tx.requestId).toBe('req-1')
  })

  it('emits wallet.credited after commit', async () => {
    await service.credit('user-1', USD('10.00'), { reference: 'ref-1', type: 'TOPUP' })
    expect(emitted).toEqual(['credited:10.000000'])
  })

  it('rejects non-positive amounts', async () => {
    await expect(
      service.credit('user-1', USD('0'), { reference: 'r', type: 'TOPUP' })
    ).rejects.toThrow(WalletError)
    await expect(
      service.credit('user-1', USD('-5'), { reference: 'r', type: 'TOPUP' })
    ).rejects.toThrow(WalletError)
  })

  it('rejects credit on a suspended wallet', async () => {
    const wallet = await walletRepo.findByUserId('user-1')!
    await walletRepo.updateStatus(wallet!.id, 'SUSPENDED')

    await expect(
      service.credit('user-1', USD('10.00'), { reference: 'r', type: 'TOPUP' })
    ).rejects.toMatchObject({ code: 'WALLET_SUSPENDED' })
  })

  it('rejects currency mismatch', async () => {
    await expect(
      service.credit('user-1', Money.fromString('10.00', 'IDR'), {
        reference: 'r',
        type: 'TOPUP',
      })
    ).rejects.toMatchObject({ code: 'CURRENCY_MISMATCH' })
  })

  it('does not emit when the transaction fails (rollback)', async () => {
    // Second credit with the same reference violates the unique constraint.
    await service.credit('user-1', USD('10.00'), { reference: 'dup', type: 'TOPUP' })
    await expect(
      service.credit('user-1', USD('10.00'), { reference: 'dup', type: 'TOPUP' })
    ).rejects.toThrow()

    expect(emitted.filter((e) => e === 'credited:10.000000')).toHaveLength(1)
  })
})

describe('WalletService.debit', () => {
  it('debits balance and creates a transaction', async () => {
    await service.credit('user-1', USD('100.00'), { reference: 'c1', type: 'TOPUP' })
    const tx = await service.debit('user-1', USD('30.00'), {
      reference: 'd1',
      type: 'AI_USAGE',
    })

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('70')
    expect(tx.balanceBefore.toString()).toBe('100')
    expect(tx.balanceAfter.toString()).toBe('70')
    expect(emitted).toContain('debited:30.000000')
  })

  it('throws INSUFFICIENT_BALANCE and leaves balance unchanged', async () => {
    await expect(
      service.debit('user-1', USD('10.00'), { reference: 'd1', type: 'AI_USAGE' })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })

    const wallet = await walletRepo.findByUserId('user-1')!
    expect(wallet!.balance.toString()).toBe('0')
    expect(emitted).toHaveLength(0)
  })

  it('rejects debit on a locked wallet', async () => {
    await service.credit('user-1', USD('100.00'), { reference: 'c1', type: 'TOPUP' })
    const wallet = await walletRepo.findByUserId('user-1')!
    await walletRepo.updateStatus(wallet!.id, 'LOCKED')

    await expect(
      service.debit('user-1', USD('10.00'), { reference: 'd1', type: 'AI_USAGE' })
    ).rejects.toMatchObject({ code: 'WALLET_LOCKED' })
  })

  it('allows credit on a locked wallet (lock blocks spending only)', async () => {
    const wallet = await walletRepo.findByUserId('user-1')!
    await walletRepo.updateStatus(wallet!.id, 'LOCKED')

    await service.credit('user-1', USD('50.00'), { reference: 'c1', type: 'TOPUP' })
    const updated = await walletRepo.findByUserId('user-1')!
    expect(updated!.balance.toString()).toBe('50')
  })
})

describe('WalletService concurrency (race condition)', () => {
  it('two parallel debits cannot overdraw a shared balance', async () => {
    await service.credit('user-1', USD('10.00'), { reference: 'c1', type: 'TOPUP' })

    const results = await Promise.allSettled([
      service.debit('user-1', USD('7.00'), { reference: 'd1', type: 'AI_USAGE' }),
      service.debit('user-1', USD('7.00'), { reference: 'd2', type: 'AI_USAGE' }),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length
    const rejected = results.filter((r) => r.status === 'rejected').length

    expect(fulfilled).toBe(1)
    expect(rejected).toBe(1)

    const wallet = await walletRepo.findByUserId('user-1')!
    // Exactly one debit of 7 applied: 10 - 7 = 3, never negative.
    expect(wallet!.balance.toString()).toBe('3')
  })
})

describe('WalletService.validateBalance', () => {
  it('passes when balance is sufficient', async () => {
    await service.credit('user-1', USD('100.00'), { reference: 'c1', type: 'TOPUP' })
    await expect(service.validateBalance('user-1', USD('99.99'))).resolves.toBeUndefined()
  })

  it('throws when balance is insufficient', async () => {
    await expect(service.validateBalance('user-1', USD('0.01'))).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })
  })
})
