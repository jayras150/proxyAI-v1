// ProxyAI — Admin Dashboard Summary Service (Milestone 2)
// Aggregates overview data from various repositories.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface AdminDashboardSummary {
  revenue_today: string
  revenue_month: string
  revenue_previous_month: string
  wallet_float: string
  total_wallet_balance: string
  active_users: number
  new_users_today: number
  active_api_keys: number
  active_models: number
  provider_healthy: boolean
  requests_today: number
  requests_month: number
  pending_refunds: number
  recent_activities: ActivityItem[]
}

export interface ActivityItem {
  id: string
  type: string
  description: string
  admin_id: string | null
  created_at: string
}

export class AdminDashboardService {
  async getSummary(): Promise<AdminDashboardSummary> {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      userCount,
      newUsersToday,
      activeKeys,
      activeModels,
      pendingRefundsCount,
      usageToday,
      usageMonth,
      usagePrevMonth,
      walletAgg,
      recentActivities,
    ] = await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: { createdAt: { gte: startOfDay } },
      }),

      prisma.apiKey.count({
        where: { status: 'ACTIVE' },
      }),

      prisma.aiModel.count({
        where: { enabled: true },
      }),

      prisma.refundRequest.count({
        where: { status: 'REQUESTED' },
      }),

      // Today usage
      prisma.usageLog.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: startOfDay } },
        _count: { _all: true },
        _sum: { totalTokens: true, userCost: true },
      }),

      // Month usage
      prisma.usageLog.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: startOfMonth } },
        _count: { _all: true },
        _sum: { totalTokens: true, userCost: true },
      }),

      // Previous month usage
      prisma.usageLog.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: startOfPrevMonth, lt: endOfPrevMonth } },
        _count: { _all: true },
        _sum: { userCost: true },
      }),

      // Total wallet balance
      prisma.wallet.aggregate({
        _sum: { balance: true },
        where: { status: { not: 'SUSPENDED' } },
      }),

      // Recent activities (last 10 from audit log)
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    const walletFloat = walletAgg._sum.balance ?? new Prisma.Decimal(0)

    return {
      revenue_today: (usageToday._sum.userCost ?? new Prisma.Decimal(0)).toFixed(6),
      revenue_month: (usageMonth._sum.userCost ?? new Prisma.Decimal(0)).toFixed(6),
      revenue_previous_month: (usagePrevMonth._sum.userCost ?? new Prisma.Decimal(0)).toFixed(6),
      wallet_float: walletFloat.toFixed(6),
      total_wallet_balance: walletFloat.toFixed(6),
      active_users: userCount,
      new_users_today: newUsersToday,
      active_api_keys: activeKeys,
      active_models: activeModels,
      provider_healthy: true,
      requests_today: usageToday._count._all,
      requests_month: usageMonth._count._all,
      pending_refunds: pendingRefundsCount,
      recent_activities: recentActivities.map((a) => ({
        id: a.id,
        type: a.action,
        description: `${a.action} on ${a.resource}`,
        admin_id: a.adminId,
        created_at: a.createdAt.toISOString(),
      })),
    }
  }
}
