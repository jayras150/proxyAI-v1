'use client'

// ProxyAI — Provider Analytics Page (Milestone 4)
// Per-provider latency, success/failure rates, tokens, cost, health timeline.

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { AnalyticsTabs } from '@/components/admin/analytics/analytics-tabs'
import { FilterBar } from '@/components/admin/analytics/filter-bar'
import { ExportButton } from '@/components/admin/analytics/export-button'
import { ChartCard } from '@/components/admin/analytics/chart-card'
import { Badge } from '@/components/ui/badge'
import { useAdminProviderAnalytics, type AnalyticsFilters, type ProviderAnalyticsRow } from '@/hooks/use-admin-analytics'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { formatMoney, formatNumber } from '@/lib/format'

const AnalyticsLineChart = dynamic(
  () => import('@/components/admin/analytics/charts').then((m) => m.AnalyticsLineChart),
  { ssr: false, loading: () => <div className="py-6"><SkeletonCard lines={2} /></div> }
)

const STATUS_TONE: Record<ProviderAnalyticsRow['current_status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  operational: 'success',
  degraded: 'warning',
  down: 'danger',
  no_traffic: 'neutral',
}

export default function AdminProviderAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ range: '7d' })
  const { data, isLoading, error } = useAdminProviderAnalytics(filters)

  const providerOptions = useMemo(() => (data?.providers ?? []).map((p) => p.name), [data])

  const healthChart = useMemo(() => {
    const rows: Array<{ date: string; [key: string]: unknown }> = []
    for (const p of data?.providers ?? []) {
      for (const point of p.health_timeline) {
        const existing = rows.find((r) => r.date === point.date)
        if (existing) {
          existing[p.name] = parseFloat(point.success_rate)
        } else {
          rows.push({ date: point.date, [p.name]: parseFloat(point.success_rate) })
        }
      }
    }
    return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [data])

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Provider Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Provider health and performance.</p>
        </div>

        <AnalyticsTabs />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterBar value={filters} onChange={setFilters} providers={providerOptions} />
          <ExportButton type="provider" filters={filters} />
        </div>

        {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><SkeletonCard lines={3} /><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>}
        {error && !isLoading && <ErrorState title="Failed to Load Provider Analytics" error={error} />}

        {data && !isLoading && (
          <>
            {/* Provider cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.providers.map((p) => (
                <div key={p.name} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.display_name}</p>
                    <Badge tone={STATUS_TONE[p.current_status]}>{p.current_status.replace('_', ' ')}</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-xs text-zinc-500">Requests</dt><dd className="tabular-nums font-medium">{formatNumber(p.requests)}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Success Rate</dt><dd className="tabular-nums font-medium">{p.success_rate}%</dd></div>
                    <div><dt className="text-xs text-zinc-500">Avg Latency</dt><dd className="tabular-nums">{p.avg_latency_ms !== null ? `${p.avg_latency_ms}ms` : '—'}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Est. Cost</dt><dd className="tabular-nums">{formatMoney(p.estimated_cost)}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Tokens</dt><dd className="tabular-nums">{formatNumber(p.tokens)}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Failures</dt><dd className="tabular-nums">{formatNumber(p.failure_count)}</dd></div>
                  </dl>
                  <div className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
                    Circuit breaker: {p.circuit_breaker.enabled ? `${p.circuit_breaker.status} (${p.circuit_breaker.failure_threshold} failures / ${Math.round(p.circuit_breaker.recovery_timeout_ms / 1000)}s)` : 'disabled'}
                  </div>
                </div>
              ))}
            </div>

            {/* Health timeline */}
            <ChartCard
              title="Health Timeline (success rate %)"
              summary={`Success rate by day: ${healthChart.map((d) => `${d.date}: ${Object.entries(d).filter(([k]) => k !== 'date').map(([k, v]) => `${k}=${v}%`).join(' ')}`).join('; ')}`}
              isLoading={isLoading}
              error={error}
              isEmpty={healthChart.length === 0}
            >
              <AnalyticsLineChart data={healthChart} xKey="date" yKey={data.providers[0]?.name ?? 'value'} yLabel="Success rate %" />
            </ChartCard>

            {/* Detail table */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">Provider Details</h3>
              <Table>
                <THead>
                  <TR>
                    <TH>Provider</TH>
                    <TH>Requests</TH>
                    <TH>Success</TH>
                    <TH>Failures</TH>
                    <TH>Success Rate</TH>
                    <TH>Tokens</TH>
                    <TH>Est. Cost</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.providers.map((p) => (
                    <TR key={p.name}>
                      <TD className="font-medium">{p.display_name}</TD>
                      <TD className="tabular-nums">{formatNumber(p.requests)}</TD>
                      <TD className="tabular-nums">{formatNumber(p.success_count)}</TD>
                      <TD className="tabular-nums">{formatNumber(p.failure_count)}</TD>
                      <TD><Badge tone={parseFloat(p.success_rate) >= 95 ? 'success' : 'warning'}>{p.success_rate}%</Badge></TD>
                      <TD className="tabular-nums">{formatNumber(p.tokens)}</TD>
                      <TD className="tabular-nums">{formatMoney(p.estimated_cost)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
