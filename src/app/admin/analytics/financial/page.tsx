'use client'

// ProxyAI — Financial Analytics Page (Milestone 4)
// Wallet float, charges, refunds, topups, provider cost, profit estimates.

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { AnalyticsTabs } from '@/components/admin/analytics/analytics-tabs'
import { FilterBar } from '@/components/admin/analytics/filter-bar'
import { ExportButton } from '@/components/admin/analytics/export-button'
import { ChartCard } from '@/components/admin/analytics/chart-card'
import { KpiCard, type KpiTone } from '@/components/admin/analytics/kpi-card'
import { useAdminFinancial, type AnalyticsFilters } from '@/hooks/use-admin-analytics'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { formatMoney, formatNumber } from '@/lib/format'

const AnalyticsBarChart = dynamic(
  () => import('@/components/admin/analytics/charts').then((m) => m.AnalyticsBarChart),
  { ssr: false, loading: () => <div className="py-6"><SkeletonCard lines={2} /></div> }
)
const AnalyticsPieChart = dynamic(
  () => import('@/components/admin/analytics/charts').then((m) => m.AnalyticsPieChart),
  { ssr: false, loading: () => <div className="py-6"><SkeletonCard lines={2} /></div> }
)

export default function AdminFinancialAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ range: 'today' })
  const { data, isLoading, error } = useAdminFinancial(filters)

  const flowPie = useMemo(() => {
    if (!data) return []
    return [
      { name: 'Charges', value: parseFloat(data.charges.amount) },
      { name: 'Topups', value: parseFloat(data.topups.amount) },
      { name: 'Refunds', value: parseFloat(data.refunds.amount) },
    ]
  }, [data])

  const marginBar = useMemo(() => {
    if (!data) return []
    return [
      { key: 'Provider Cost', amount: parseFloat(data.provider_cost) },
      { key: 'Markup Revenue', amount: parseFloat(data.markup_revenue) },
      { key: 'Net Revenue', amount: parseFloat(data.net_revenue) },
    ]
  }, [data])

  const netTone: KpiTone = data && parseFloat(data.net_revenue) >= 0 ? 'success' : 'danger'
  const floatTone: KpiTone = data && parseFloat(data.wallet_float) < 0 ? 'danger' : 'default'

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Financial Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Wallet, billing and profitability.</p>
        </div>

        <AnalyticsTabs />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterBar value={filters} onChange={setFilters} />
          <ExportButton type="financial" filters={filters} />
        </div>

        {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /></div>}
        {error && !isLoading && <ErrorState title="Failed to Load Financial Analytics" error={error} />}

        {data && !isLoading && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Wallet Float" value={formatMoney(data.wallet_float)} tone={floatTone} />
              <KpiCard label="Negative Balance Users" value={formatNumber(data.negative_balance_users)} tone={data.negative_balance_users > 0 ? 'warning' : 'default'} />
              <KpiCard label="Outstanding Balance" value={formatMoney(data.outstanding_balance)} />
              <KpiCard label="Profit Estimate" value={formatMoney(data.profit_estimate)} tone={netTone} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Charges" value={formatMoney(data.charges.amount)} hint={`${formatNumber(data.charges.count)} transactions`} />
              <KpiCard label="Refunds" value={formatMoney(data.refunds.amount)} hint={`${formatNumber(data.refunds.count)} refunds`} />
              <KpiCard label="Topups" value={formatMoney(data.topups.amount)} hint={`${formatNumber(data.topups.count)} topups`} />
              <KpiCard label="Provider Cost" value={formatMoney(data.provider_cost)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Markup Revenue" value={formatMoney(data.markup_revenue)} />
              <KpiCard label="Net Revenue" value={formatMoney(data.net_revenue)} tone={netTone} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Money Flow"
                summary={`Money flow: ${flowPie.map((d) => `${d.name}: ${d.value}`).join(', ')}`}
                isLoading={isLoading}
                error={error}
                isEmpty={flowPie.length === 0 || flowPie.every((d) => d.value === 0)}
              >
                <AnalyticsPieChart data={flowPie} />
              </ChartCard>
              <ChartCard
                title="Cost vs Revenue"
                summary={`Cost vs revenue: ${marginBar.map((d) => `${d.key}: ${d.amount}`).join(', ')}`}
                isLoading={isLoading}
                error={error}
                isEmpty={marginBar.length === 0}
              >
                <AnalyticsBarChart data={marginBar} xKey="key" yKey="amount" yLabel="USD" />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
