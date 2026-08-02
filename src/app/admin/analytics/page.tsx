'use client'

// ProxyAI — Business Analytics Page (Milestone 4)
// Revenue, users, requests, wallet activity, top users + charts.

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { AnalyticsTabs } from '@/components/admin/analytics/analytics-tabs'
import { FilterBar } from '@/components/admin/analytics/filter-bar'
import { ExportButton } from '@/components/admin/analytics/export-button'
import { ChartCard } from '@/components/admin/analytics/chart-card'
import { KpiCard, type KpiTone } from '@/components/admin/analytics/kpi-card'
import { useAdminAnalytics, type AnalyticsFilters } from '@/hooks/use-admin-analytics'
import { useAdminProviders } from '@/hooks/use-admin-providers'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { formatMoney, formatNumber } from '@/lib/format'

// Lazy-load charts (recharts stays out of the main bundle).
const AnalyticsAreaChart = dynamic(
  () => import('@/components/admin/analytics/charts').then((m) => m.AnalyticsAreaChart),
  { ssr: false, loading: () => <div className="py-6"><SkeletonCard lines={2} /></div> }
)
const AnalyticsBarChart = dynamic(
  () => import('@/components/admin/analytics/charts').then((m) => m.AnalyticsBarChart),
  { ssr: false, loading: () => <div className="py-6"><SkeletonCard lines={2} /></div> }
)
const AnalyticsPieChart = dynamic(
  () => import('@/components/admin/analytics/charts').then((m) => m.AnalyticsPieChart),
  { ssr: false, loading: () => <div className="py-6"><SkeletonCard lines={2} /></div> }
)

export default function AdminAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ range: 'today' })
  const { data, isLoading, error } = useAdminAnalytics(filters)
  const { data: providersData } = useAdminProviders()

  const providerOptions = useMemo(
    () => (providersData?.items ?? []).map((p) => p.name),
    [providersData]
  )

  const chartData = useMemo(
    () => (data?.timeline ?? []).map((t) => ({ ...t, revenue_num: parseFloat(t.revenue) })),
    [data]
  )

  const requestStatusPie = useMemo(() => {
    const requests = data?.api_requests
    if (!requests || requests.total === 0) return []
    return [
      { name: 'Success', value: requests.success },
      { name: 'Failed', value: requests.error },
    ]
  }, [data])

  const growthTone: KpiTone = data && parseFloat(data.revenue.growth_percent) >= 0 ? 'success' : 'danger'

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Business performance overview.</p>
        </div>

        <AnalyticsTabs />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterBar value={filters} onChange={setFilters} providers={providerOptions} />
          <ExportButton type="business" filters={filters} />
        </div>

        {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /></div>}
        {error && !isLoading && <ErrorState title="Failed to Load Analytics" error={error} />}

        {data && !isLoading && (
          <>
            {/* Revenue */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Revenue Today" value={formatMoney(data.revenue.today)} />
              <KpiCard label="Revenue Yesterday" value={formatMoney(data.revenue.yesterday)} />
              <KpiCard label="Revenue This Month" value={formatMoney(data.revenue.month)} />
              <KpiCard label="Growth (window vs yesterday)" value={`${data.revenue.growth_percent}%`} tone={growthTone} hint={data.range.label} />
            </div>

            {/* Users & requests */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Active Users" value={formatNumber(data.users.active)} />
              <KpiCard label="New Users" value={formatNumber(data.users.new)} />
              <KpiCard label="Returning Users" value={formatNumber(data.users.returning)} />
              <KpiCard label="ARPU" value={formatMoney(data.arpu)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="API Requests" value={formatNumber(data.api_requests.total)} hint={`${data.api_requests.success_rate}% success`} />
              <KpiCard label="Wallet Topups" value={formatNumber(data.wallet.topups_count)} hint={formatMoney(data.wallet.topups_amount)} />
              <KpiCard label="Refunds" value={formatNumber(data.wallet.refunds_count)} hint={formatMoney(data.wallet.refunds_amount)} />
              <KpiCard label="Errors" value={formatNumber(data.api_requests.error)} tone={data.api_requests.error > 0 ? 'warning' : 'default'} />
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Revenue Over Time"
                summary={`Revenue by day: ${chartData.map((d) => `${d.date}: ${d.revenue}`).join(', ')}`}
                isLoading={isLoading}
                error={error}
                isEmpty={chartData.length === 0}
              >
                <AnalyticsAreaChart data={chartData} xKey="date" yKey="revenue_num" yLabel="Revenue (USD)" />
              </ChartCard>
              <ChartCard
                title="Top Users by Spend"
                summary={`Top users: ${data.top_users.map((u) => `${u.email}: ${u.spend}`).join(', ')}`}
                isLoading={isLoading}
                error={error}
                isEmpty={data.top_users.length === 0}
              >
                <AnalyticsBarChart
                  data={data.top_users.slice(0, 8).map((u) => ({ ...u, spend_num: parseFloat(u.spend), label: u.email.split('@')[0] }))}
                  xKey="label"
                  yKey="spend_num"
                  yLabel="Spend (USD)"
                />
              </ChartCard>
              <ChartCard
                title="Request Outcomes"
                summary={`Requests: ${requestStatusPie.map((d) => `${d.name}: ${d.value}`).join(', ')}`}
                isLoading={isLoading}
                error={error}
                isEmpty={requestStatusPie.length === 0}
              >
                <AnalyticsPieChart data={requestStatusPie} />
              </ChartCard>

              {/* Top users table */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top Users</h3>
                {data.top_users.length === 0 ? (
                  <p className="text-sm text-zinc-500">No user activity in this period.</p>
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>User</TH>
                        <TH>Requests</TH>
                        <TH>Spend</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {data.top_users.slice(0, 6).map((u) => (
                        <TR key={u.user_id}>
                          <TD className="font-medium">{u.email}</TD>
                          <TD className="tabular-nums">{formatNumber(u.requests)}</TD>
                          <TD className="tabular-nums">{formatMoney(u.spend)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
