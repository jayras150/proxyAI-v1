// ProxyAI — TopupService Unit Tests (with in-memory fakes)

import { describe, it, expect, beforeEach } from 'vitest'
import { TopupService, TopupError } from '@/server/topup/topup.service'
import { assertTopupTransition } from '@/server/topup/topup.service'
import { Money } from '@/lib/money'
import { Prisma } from '@prisma/client'
import type { TopupRequest, TopupStatus } from '@prisma/client'
import type { WalletService } from '@/server/wallet/wallet.service'
import type { PaymentService } from '@/server/payments/payment.service'
import type { TransactionManager, TxClient } from '@/server/db/transaction-manager'
import type { TopupRequestRepository } from '@/server/topup/topup-request.repository'

// ─── Fakes ──────────────────────────────────────────────────────────────

class FakeTopupRepo implements TopupRequestRepository {
  rows = new Map<string, TopupRequest>()
  seq = 0

  async create(input: { userId: string; walletId: string; amount: Prisma.Decimal; currency: string; provider: TopupRequest['provider']; expiresAt: Date }) {
    const row: TopupRequest = {
      id: `topup-${++this.seq}`,
      userId: input.userId,
      walletId: input.walletId,
      amount: input.amount,
      currency: input.currency as TopupRequest['currency'],
      status: 'PENDING',
      provider: input.provider,
      providerReference: null,
      transactionId: null,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.rows.set(row.id, row)
    return row
  }

  async findByIdAndUserId(id: string, userId: string) {
    const r = this.rows.get(id)
    return r && r.userId === userId ? r : null
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }

  async findByProviderReference(ref: string) {
    for (const r of this.rows.values()) if (r.providerReference === ref) return r
    return null
  }

  async updateProviderReference(id: string, ref: string) {
    const r = this.rows.get(id)!
    r.providerReference = ref
    return r
  }

  async updateStatus(id: string, status: TopupStatus) {
    const r = this.rows.get(id)!
    r.status = status
    return r
  }

  async markPaid(id: string, transactionId: string) {
    const r = this.rows.get(id)
    if (!r || r.status !== 'PENDING') return null
    r.status = 'PAID'
    r.transactionId = transactionId
    return r
  }
}

const fakeWalletService = {
  getWallet: async (userId: string) => {
    if (userId === 'suspended') return { id: 'wallet-1', userId, balance: new Prisma.Decimal(0), currency: 'USD', status: 'SUSPENDED', version: 1, createdAt: new Date(), updatedAt: new Date() }
    if (userId === 'locked') return { id: 'wallet-1', userId, balance: new Prisma.Decimal(0), currency: 'USD', status: 'LOCKED', version: 1, createdAt: new Date(), updatedAt: new Date() }
    if (userId === 'idr') return { id: 'wallet-idr', userId, balance: new Prisma.Decimal(0), currency: 'IDR', status: 'ACTIVE', version: 1, createdAt: new Date(), updatedAt: new Date() }
    if (userId === 'missing') return null
    return { id: 'wallet-1', userId, balance: new Prisma.Decimal(0), currency: 'USD', status: 'ACTIVE', version: 1, createdAt: new Date(), updatedAt: new Date() }
  },
} as unknown as WalletService

const fakePaymentService = {
  providerName: 'mock',
  createPayment: async (input: { amount: string; topupRequestId: string }) => ({
    providerReference: `mock_pay_${input.topupRequestId}`,
    checkoutUrl: `https://checkout.mock/${input.topupRequestId}`,
    token: 'tok_123',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  }),
} as unknown as PaymentService

const fakeTxManager: TransactionManager = {
  withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return fn({} as TxClient)
  },
}

// ─── Tests ──────────────────────────────────────────────────────────────

let repo: FakeTopupRepo
let service: TopupService

beforeEach(() => {
  repo = new FakeTopupRepo()
  service = new TopupService(repo, fakeWalletService, fakePaymentService, fakeTxManager)
})

describe('TopupService.createTopup', () => {
  it('creates a PENDING topup without touching the wallet balance', async () => {
    const result = await service.createTopup({
      userId: 'user-1',
      amount: Money.fromString('50.00', 'USD'),
    })

    expect(result.topup.status).toBe('PENDING')
    expect(result.topup.providerReference).toBe('mock_pay_topup-1')
    expect(result.topup.amount.toString()).toBe('50')
    expect(result.topup.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(result.payment.checkoutUrl).toContain('topup-1')
  })

  it('rejects non-positive amount', async () => {
    await expect(
      service.createTopup({ userId: 'user-1', amount: Money.fromString('0', 'USD') })
    ).rejects.toThrow()
  })

  it('rejects missing wallet', async () => {
    await expect(
      service.createTopup({ userId: 'missing', amount: Money.fromString('10.00', 'USD') })
    ).rejects.toThrow()
  })

  it('rejects suspended and locked wallets', async () => {
    await expect(
      service.createTopup({ userId: 'suspended', amount: Money.fromString('10.00', 'USD') })
    ).rejects.toThrow()
    await expect(
      service.createTopup({ userId: 'locked', amount: Money.fromString('10.00', 'USD') })
    ).rejects.toThrow()
  })

  it('rejects currency mismatch with wallet', async () => {
    await expect(
      service.createTopup({ userId: 'idr', amount: Money.fromString('10.00', 'USD') })
    ).rejects.toThrow()
  })
})

describe('TopupService status transitions', () => {
  it('allows PENDING → PAID | FAILED | EXPIRED', () => {
    expect(() => assertTopupTransition('PENDING', 'PAID')).not.toThrow()
    expect(() => assertTopupTransition('PENDING', 'FAILED')).not.toThrow()
    expect(() => assertTopupTransition('PENDING', 'EXPIRED')).not.toThrow()
  })

  it('rejects invalid transitions', () => {
    expect(() => assertTopupTransition('PAID', 'PENDING')).toThrow(TopupError)
    expect(() => assertTopupTransition('FAILED', 'PAID')).toThrow(TopupError)
    expect(() => assertTopupTransition('EXPIRED', 'PAID')).toThrow(TopupError)
    expect(() => assertTopupTransition('PAID', 'FAILED')).toThrow(TopupError)
  })

  it('markPaid only succeeds from PENDING', async () => {
    const { topup } = await service.createTopup({ userId: 'user-1', amount: Money.fromString('10.00', 'USD') })
    const paid = await service.markPaid(topup.id, 'txn-1')
    expect(paid?.status).toBe('PAID')

    // Second markPaid on the same (now PAID) topup → invalid transition.
    await expect(service.markPaid(topup.id, 'txn-2')).rejects.toThrow(TopupError)
  })
})

describe('TopupService.getTopup', () => {
  it('returns the topup scoped to the owner', async () => {
    const { topup } = await service.createTopup({ userId: 'user-1', amount: Money.fromString('10.00', 'USD') })
    const found = await service.getTopup(topup.id, 'user-1')
    expect(found.id).toBe(topup.id)

    await expect(service.getTopup(topup.id, 'other-user')).rejects.toThrow(TopupError)
  })
})
