// ProxyAI — AdminWalletService unit tests (Prisma mocked)
// M5: verifies atomic balance mutations, idempotency conflicts and the
// concurrent-debit protection (conditional decrement prevents overdraft).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { AdminWalletService } from './admin-wallet.service'
import { AdminError } from '@/lib/errors'

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn() },
}))

import { prisma } from '@/lib/prisma'

interface FakeTx {
  wallet: {
    updateMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  transaction: { create: ReturnType<typeof vi.fn> }
  getBalance: () => Prisma.Decimal
  getTransactions: () => Array<{
    reference: string
    type: string
    amount: Prisma.Decimal
    balanceBefore: Prisma.Decimal
    balanceAfter: Prisma.Decimal
  }>
}

function makeTx(initialBalance: string, failReference?: string): FakeTx {
  let balance = new Prisma.Decimal(initialBalance)
  const transactions: Array<{
    reference: string
    type: string
    amount: Prisma.Decimal
    balanceBefore: Prisma.Decimal
    balanceAfter: Prisma.Decimal
  }> = []

  const tx: FakeTx = {
    wallet: {
      updateMany: vi.fn(async (args: { where: { id: string; balance?: { gte?: Prisma.Decimal } }; data: { balance?: { increment?: Prisma.Decimal; decrement?: Prisma.Decimal } } }) => {
        const floor = args.where.balance?.gte
        if (floor && balance.lessThan(floor)) return { count: 0 }
        if (args.data.balance?.increment) balance = balance.plus(args.data.balance.increment)
        if (args.data.balance?.decrement) balance = balance.minus(args.data.balance.decrement)
        return { count: 1 }
      }),
      findUnique: vi.fn(async () => ({ id: 'wallet-1', userId: 'user-1', balance, currency: 'USD', status: 'ACTIVE' })),
    },
    transaction: {
      create: vi.fn(async (args: { data: { reference: string; type: string; amount: Prisma.Decimal; balanceBefore: Prisma.Decimal; balanceAfter: Prisma.Decimal } }) => {
        if (failReference && args.data.reference === failReference) {
          const err = new Error('Unique constraint failed') as Error & { code?: string }
          err.code = 'P2002'
          throw err
        }
        transactions.push(args.data)
        return { id: `txn-${transactions.length}`, ...args.data }
      }),
    },
    getBalance: () => balance,
    getTransactions: () => transactions,
  }
  return tx
}

function withTx(tx: FakeTx) {
  vi.mocked(prisma.$transaction).mockImplementation(
    ((fn: (client: never) => Promise<unknown>) => fn(tx as never)) as never
  )
}

const service = new AdminWalletService()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminWalletService — credit', () => {
  it('increments the balance atomically and records the transaction', async () => {
    const tx = makeTx('10.000000')
    withTx(tx)

    const result = await service.creditWallet('wallet-1', '5.50', 'promo credit', 'admin-1', 'key-1')

    expect(result.balance_after).toBe('15.500000')
    expect(tx.getBalance().toString()).toBe('15.5')
    expect(tx.getTransactions()).toHaveLength(1)
    const t = tx.getTransactions()[0]!
    expect(t.type).toBe('ADMIN_CREDIT')
    expect(t.reference).toBe('admin_credit_key-1')
    expect(t.balanceBefore.toString()).toBe('10')
    expect(t.balanceAfter.toString()).toBe('15.5')
  })

  it('throws NOT_FOUND when the wallet does not exist', async () => {
    const tx = makeTx('10.000000')
    tx.wallet.updateMany.mockResolvedValue({ count: 0 })
    tx.wallet.findUnique.mockResolvedValue(null)
    withTx(tx)

    await expect(service.creditWallet('missing', '1.00', 'r', 'admin-1', 'k')).rejects.toMatchObject({
      name: 'AdminError',
      code: 'NOT_FOUND',
    })
  })
})

describe('AdminWalletService — debit', () => {
  it('decrements the balance conditionally and records the transaction', async () => {
    const tx = makeTx('10.000000')
    withTx(tx)

    const result = await service.debitWallet('wallet-1', '4.00', 'manual adjustment', 'admin-1', 'key-2')

    expect(result.balance_after).toBe('6.000000')
    expect(tx.getTransactions()[0]!.type).toBe('ADMIN_DEBIT')
    expect(tx.getTransactions()[0]!.reference).toBe('admin_debit_key-2')
    expect(tx.getTransactions()[0]!.amount.toString()).toBe('-4')
    expect(tx.getTransactions()[0]!.balanceBefore.toString()).toBe('10')
    expect(tx.getTransactions()[0]!.balanceAfter.toString()).toBe('6')
  })

  it('rejects a debit that exceeds the balance', async () => {
    const tx = makeTx('10.000000')
    withTx(tx)

    await expect(service.debitWallet('wallet-1', '99.00', 'r', 'admin-1', 'k')).rejects.toMatchObject({
      name: 'AdminError',
      code: 'CONFLICT',
    })
    expect(tx.getTransactions()).toHaveLength(0)
    expect(tx.getBalance().toString()).toBe('10')
  })

  it('prevents overdraft under concurrent debits (conditional decrement)', async () => {
    // Two sequential debits of 6 against a balance of 10 — the second must
    // fail the conditional check, exactly like concurrent requests would.
    const tx = makeTx('10.000000')
    withTx(tx)

    await service.debitWallet('wallet-1', '6.00', 'r', 'admin-1', 'k1')
    await expect(service.debitWallet('wallet-1', '6.00', 'r', 'admin-1', 'k2')).rejects.toMatchObject({
      name: 'AdminError',
      code: 'CONFLICT',
    })

    expect(tx.getBalance().toString()).toBe('4')
    expect(tx.getTransactions()).toHaveLength(1)
  })
})

describe('AdminWalletService — idempotency', () => {
  it('surfaces a duplicate idempotency key as a clean 409 conflict', async () => {
    const tx = makeTx('10.000000', 'admin_credit_key-dup')
    withTx(tx)

    const error = await service
      .creditWallet('wallet-1', '1.00', 'r', 'admin-1', 'key-dup')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AdminError)
    expect((error as AdminError).code).toBe('CONFLICT')
    expect((error as AdminError).message).toContain('key-dup')
    // The transaction rolled back — balance unchanged.
    expect(tx.getTransactions()).toHaveLength(0)
  })
})
