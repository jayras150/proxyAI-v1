// ProxyAI — Financial Analytics Service (Milestone 4)
// Read-only financial aggregates: wallet float, charges, refunds,
// topups, provider cost and profit estimates.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { resolveTimeRange, type AnalyticsRange } from './time-range'

export interface FinancialAnalyticsFilters {
  range: AnalyticsRange
  from?: string | null
  to?: string | null
  provider?: string | null
  model?: string | null
  user?: string | null
}

export interface FinancialAnalytics {
  range: { from: string; to: string; label: string }
  wallet_float: string
  negative_balance_users: number
  outstanding_balance: string
  charges: { count: number; amount: string }
  refunds: { count: number; amount: string }
  topups: { count: number; amount: string }
  provider_cost: string
  markup_revenue: string
  net_revenue: string
  profit_estimate: string
}

export class FinancialAnalyticsService {
  async getAnalytics(filters: FinancialAnalyticsFilters): Promise<FinancialAnalytics> {
    const range = resolveTimeRange(filters.range, filters.from, filters.to)

    const usageWhere: Prisma.UsageLogWhereInput = {
      createdAt: { gte: range.from, lt: range.to },
    }
    if (filters.provider) usageWhere.provider = filters.provider
    if (filters.model) usageWhere.model = filters.model
    if (filters.user) usageWhere.userId = filters.user

    const [
      walletAgg,
      negativeWallets,
      chargesAgg,
      refundsAgg,
      topupsAgg,
      usageCostAgg,
    ] = await Promise.all([
      // Wallet float: sum of all non-suspended wallets
      prisma.wallet.aggregate({
        _sum: { balance: true },
        where: { status: { not: 'SUSPENDED' } },
      }),
      // Negative balance wallets
      prisma.wallet.findMany({
        where: { balance: { lt: 0 }, status: { not: 'SUSPENDED' } },
        select: { balance: true },
      }),
      // Charges: AI_USAGE transactions in window
      prisma.transaction.aggregate({
        where: { type: 'AI_USAGE', status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      // Refunds in window
      prisma.refundRequest.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      // Topups in window
      prisma.transaction.aggregate({
        where: { type: 'TOPUP', status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      // Provider vs user cost from usage logs (filtered)
      prisma.usageLog.aggregate({
        where: { ...usageWhere, status: 'COMPLETED' },
        _sum: { providerCost: true, userCost: true },
      }),
    ])

    const walletFloat = walletAgg._sum.balance ?? new Prisma.Decimal(0)

    let outstanding = new Prisma.Decimal(0)
    for (const w of negativeWallets) {
      outstanding = outstanding.plus(w.balance.abs())
    }

    const chargesAmount = chargesAgg._sum.amount ?? new Prisma.Decimal(0)
    const refundsAmount = refundsAgg._sum.amount ?? new Prisma.Decimal(0)
    const topupsAmount = topupsAgg._sum.amount ?? new Prisma.Decimal(0)
    const providerCost = usageCostAgg._sum.providerCost ?? new Prisma.Decimal(0)
    const userCost = usageCostAgg._sum.userCost ?? new Prisma.Decimal(0)

    // markup = gross charges − provider cost (usage-level)
    const markupRevenue = userCost.minus(providerCost)
    // net = markup − refunds (refunds reduce revenue)
    const netRevenue = markupRevenue.minus(refundsAmount)
    // profit estimate = net usage margin (topups are customer deposits, not revenue)
    const profitEstimate = netRevenue

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      wallet_float: walletFloat.toFixed(6),
      negative_balance_users: negativeWallets.length,
      outstanding_balance: outstanding.toFixed(6),
      charges: { count: chargesAgg._count._all, amount: chargesAmount.toFixed(6) },
      refunds: { count: refundsAgg._count._all, amount: refundsAmount.toFixed(6) },
      topups: { count: topupsAgg._count._all, amount: topupsAmount.toFixed(6) },
      provider_cost: providerCost.toFixed(6),
      markup_revenue: markupRevenue.toFixed(6),
      net_revenue: netRevenue.toFixed(6),
      profit_estimate: profitEstimate.toFixed(6),
    }
  }
}
