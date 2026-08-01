// ProxyAI — GET /api/admin/users/:id
// Admin user detail with wallet, usage, API keys, transactions, topups summaries.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:users:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true, status: true, createdAt: true,
        wallet: { select: { id: true, balance: true, currency: true, status: true, version: true } },
        _count: { select: { apiKeys: true, sessions: true, usageLogs: true } },
      },
    })

    if (!user) {
      return jsonError('NOT_FOUND', 'User not found.', { status: 404 })
    }

    // Recent usage
    const recentUsage = await prisma.usageLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, model: true, status: true, totalTokens: true, userCost: true, createdAt: true },
    })

    // Recent transactions
    const recentTransactions = user.wallet
      ? await prisma.transaction.findMany({
          where: { walletId: user.wallet.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : []

    // Recent topups
    const recentTopups = user.wallet
      ? await prisma.topupRequest.findMany({
          where: { walletId: user.wallet.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : []

    // Sessions
    const sessions = await prisma.session.findMany({
      where: { userId: id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    })

    // API Keys
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, keyPrefix: true, status: true, lastUsedAt: true, createdAt: true },
    })

    return jsonSuccess({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      created_at: user.createdAt.toISOString(),
      wallet: user.wallet ? {
        id: user.wallet.id,
        balance: user.wallet.balance.toFixed(6),
        currency: user.wallet.currency,
        status: user.wallet.status,
      } : null,
      stats: {
        api_keys_count: user._count.apiKeys,
        sessions_count: user._count.sessions,
        usage_count: user._count.usageLogs,
      },
      recent_usage: recentUsage.map((u) => ({
        id: u.id, model: u.model, status: u.status,
        total_tokens: u.totalTokens, user_cost: u.userCost.toFixed(6),
        created_at: u.createdAt.toISOString(),
      })),
      recent_transactions: recentTransactions.map((t) => ({
        id: t.id, type: t.type, amount: t.amount.toFixed(6),
        balance_after: t.balanceAfter.toFixed(6), currency: t.currency,
        status: t.status, description: t.description,
        created_at: t.createdAt.toISOString(),
      })),
      recent_topups: recentTopups.map((t) => ({
        id: t.id, status: t.status, amount: t.amount.toFixed(6),
        currency: t.currency, created_at: t.createdAt.toISOString(),
      })),
      sessions: sessions.map((s) => ({
        id: s.id, user_agent: s.userAgent, ip_address: s.ipAddress,
        created_at: s.createdAt.toISOString(),
      })),
      api_keys: apiKeys.map((k) => ({
        id: k.id, name: k.name, key_prefix: k.keyPrefix, status: k.status,
        last_used_at: k.lastUsedAt?.toISOString() ?? null,
        created_at: k.createdAt.toISOString(),
      })),
    }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
