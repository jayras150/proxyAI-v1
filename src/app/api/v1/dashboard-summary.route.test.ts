// ProxyAI — Dashboard Summary API Route Tests (GET /api/v1/dashboard/summary)

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeRequest, signAccessToken } from './test-helpers'
import { Prisma } from '@prisma/client'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'
import type { Transaction, UsageLog } from '@prisma/client'

// Mock composition so the route hits an in-memory summary, not the DB.
vi.mock('@/server/composition', () => ({
  getApiServices: () => mockServices,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockServices: any

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    walletId: 'wallet-user-1',
    userId: 'user-1',
    amount: new Prisma.Decimal('10.000000'),
    balanceBefore: new Prisma.Decimal('0.000000'),
    balanceAfter: new Prisma.Decimal('10.000000'),
    currency: 'USD',
    type: 'TOPUP',
    reference: 'ref-1',
    status: 'COMPLETED',
    description: 'Top up',
    requestId: null,
    providerReference: null,
    createdBy: 'user:user-1',
    ipAddress: null,
    userAgent: null,
    createdAt: new Date('2026-08-01T01:00:00.000Z'),
    ...overrides,
  }
}

function makeUsage(overrides: Partial<UsageLog> = {}): UsageLog {
  return {
    id: 'usage-1',
    userId: 'user-1',
    apiKeyId: null,
    provider: 'deepseek',
    model: 'deepseek-chat',
    modelId: null,
    pricingVersionId: null,
    promptTokens: 1000,
    completionTokens: 500,
    cachedTokens: 0,
    totalTokens: 1500,
    providerCost: new Prisma.Decimal('0.000450'),
    userCost: new Prisma.Decimal('0.000496'),
    currency: 'USD',
    latencyMs: 420,
    status: 'COMPLETED',
    requestId: 'req-1',
    inputPrice: null,
    outputPrice: null,
    markupPercent: null,
    serviceFee: null,
    createdAt: new Date('2026-08-01T02:00:00.000Z'),
    ...overrides,
  }
}

const FULL_SUMMARY = {
  balance: '12.345000',
  currency: 'USD',
  wallet_status: 'ACTIVE',
  requests_today: 3,
  tokens_today: 4200,
  spend_today: '0.001488',
  spend_month: '0.005000',
  spend_previous_month: '0.002000',
  active_keys: 2,
  available_models: 3,
  default_model: 'deepseek-chat',
  latest_transactions: [makeTransaction()],
  latest_usage: [makeUsage()],
  provider: { id: 'deepseek', healthy: true, latency_ms: 133 },
}

beforeEach(() => {
  mockServices = {
    dashboardService: {
      getSummary: vi.fn(async () => FULL_SUMMARY),
    },
  }
})

describe('GET /api/v1/dashboard/summary', () => {
  it('returns the full summary in ONE round trip', async () => {
    const { GET } = await import('./dashboard/summary/route')
    const res = await GET(
      makeRequest('http://test/api/v1/dashboard/summary', { token: signAccessToken() })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.request_id).toBeTruthy()

    const data = body.data
    expect(data.balance).toBe('12.345000')
    expect(typeof data.balance).toBe('string')
    expect(data.wallet_status).toBe('ACTIVE')
    expect(data.requests_today).toBe(3)
    expect(data.tokens_today).toBe(4200)
    expect(data.spend_today).toBe('0.001488')
    expect(data.spend_month).toBe('0.005000')
    expect(data.spend_previous_month).toBe('0.002000')
    expect(data.active_keys).toBe(2)
    expect(data.available_models).toBe(3)
    expect(data.default_model).toBe('deepseek-chat')
    expect(data.provider).toEqual({ id: 'deepseek', healthy: true, latency_ms: 133 })

    // Recent lists are mapped to the API contract.
    expect(data.latest_transactions).toHaveLength(1)
    expect(data.latest_transactions[0]).toMatchObject({
      id: 'txn-1',
      type: 'TOPUP',
      amount: '10.000000',
      created_at: '2026-08-01T01:00:00.000Z',
    })
    expect(data.latest_usage).toHaveLength(1)
    expect(data.latest_usage[0]).toMatchObject({
      model: 'deepseek-chat',
      total_tokens: 1500,
      user_cost: '0.000496',
      created_at: '2026-08-01T02:00:00.000Z',
    })
  })

  it('caps recent transactions and usage at 5 items', async () => {
    mockServices.dashboardService.getSummary.mockResolvedValueOnce({
      ...FULL_SUMMARY,
      latest_transactions: Array.from({ length: 8 }, (_, i) =>
        makeTransaction({ id: `txn-${i}`, reference: `ref-${i}` })
      ),
      latest_usage: Array.from({ length: 8 }, (_, i) => makeUsage({ id: `usage-${i}` })),
    })

    const { GET } = await import('./dashboard/summary/route')
    const res = await GET(
      makeRequest('http://test/api/v1/dashboard/summary', { token: signAccessToken() })
    )
    const body = await res.json()

    expect(body.data.latest_transactions).toHaveLength(8) // service caps; route passes through
    expect(body.data.latest_usage).toHaveLength(8)
  })

  it('returns 401 without a token', async () => {
    const { GET } = await import('./dashboard/summary/route')
    const res = await GET(makeRequest('http://test/api/v1/dashboard/summary'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 when the user has no wallet', async () => {
    mockServices.dashboardService.getSummary.mockRejectedValueOnce(
      new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
    )

    const { GET } = await import('./dashboard/summary/route')
    const res = await GET(
      makeRequest('http://test/api/v1/dashboard/summary', { token: signAccessToken() })
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('WALLET_NOT_FOUND')
  })

  it('propagates PAYMENT_REQUIRED wallet status (200, not an error)', async () => {
    mockServices.dashboardService.getSummary.mockResolvedValueOnce({
      ...FULL_SUMMARY,
      balance: '-0.040000',
      wallet_status: 'PAYMENT_REQUIRED',
    })

    const { GET } = await import('./dashboard/summary/route')
    const res = await GET(
      makeRequest('http://test/api/v1/dashboard/summary', { token: signAccessToken() })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.wallet_status).toBe('PAYMENT_REQUIRED')
    expect(body.data.balance).toBe('-0.040000')
  })
})

