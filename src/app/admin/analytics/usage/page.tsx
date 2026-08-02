'use client'

// ProxyAI — AI Usage Analytics Page (Milestone 4)
// Tokens, latency, requests by model & provider.

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { AnalyticsTabs } from '@/components/admin/analytics/analytics-tabs'
import { FilterBar } from '@/components/admin/analytics/filter-bar'
import { ExportButton } from '@/components/admin/analytics/export-button'
import { ChartCard } from '@/components/admin/analytics/chart-card'
import { KpiCard } from '@/components/admin/analytics/kpi-card'
import { useAdminUsageAnalytics, type AnalyticsFilters } from '@/hooks/use-admin-analytics'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { formatMoney, formatNumber } from '@/lib/format'

const AnalyticsAreaChart = dynamic(
  () => import('@/components/admin/analytics/charts').then((m) => m.AnalyticsAreaChart),
  { ssr: false, loading: () => <div className="py-6"><SkeletonCard lines={2} /></div> }
)
const AnalyticsPieChart = dynamic(
  () => import('@/components/admin/analytics/charts').then((m) => m.AnalyticsPieChart),
  { ssr: false, loading: () => <div className="py-6"><SkeletonCard lines={2} /></div> }
)

export default function AdminUsageAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ range: 'today' })
  const { data, isLoading, error } = useAdminUsageAnalytics(filters)

  const modelOptions = useMemo(() => (data?.by_model ?? []).map((m) => m.model), [data])
  const providerOptions = useMemo(() => (data?.by_provider ?? []).map((p) => p.provider), [data])

  const tokenTimeline = useMemo(
    () => (data?.timeline ?? []).map((t) => ({ ...t, tokens_num: t.tokens })),
    [data]
  )

  const modelPie = useMemo(
    () => (data?.by_model ?? []).slice(0, 6).map((m) => ({ name: m.model, value: m.requests })),
    [data]
  )

  const providerPie = useMemo(
    () => (data?.by_provider ?? []).slice(0, 6).map((p) => ({ name: p.provider, value: p.requests })),
    [data]
  )

  const totals = data?.totals

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Usage Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Token consumption and model performance.</p>
        </div>

        <AnalyticsTabs />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <FilterBar value={filters} onChange={setFilters} providers={providerOptions} models={modelOptions} />
          <ExportButton type="usage" filters={filters} />
        </div>

        {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /></div>}
        {error && !isLoading && <ErrorState title="Failed to Load Usage Analytics" error={error} />}

        {data && totals && !isLoading && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Requests" value={formatNumber(totals.requests)} />
              <KpiCard label="Total Tokens" value={formatNumber(totals.total_tokens)} />
              <KpiCard label="Avg Latency" value={totals.avg_latency_ms !== null ? `${totals.avg_latency_ms}ms` : '—'} />
              <KpiCard label="Avg Cost" value={formatMoney(totals.avg_cost)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Prompt Tokens" value={formatNumber(totals.prompt_tokens)} />
              <KpiCard label="Completion Tokens" value={formatNumber(totals.completion_tokens)} />
              <KpiCard label="Cached Tokens" value={formatNumber(totals.cached_tokens)} />
              <KpiCard label="User Cost" value={formatMoney(totals.user_cost)} hint={`provider ${formatMoney(totals.provider_cost)}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Tokens Over Time"
                summary={`Tokens by day: ${tokenTimeline.map((d) => `${d.date}: ${d.tokens_num}`).join(', ')}`}
                isLoading={isLoading}
                error={error}
                isEmpty={tokenTimeline.length === 0}
              >
                <AnalyticsAreaChart data={tokenTimeline} xKey="date" yKey="tokens_num" yLabel="Tokens" />
              </ChartCard>
              <ChartCard
                title="Requests by Model"
                summary={`Requests per model: ${modelPie.map((d) => `${d.name}: ${d.value}`).join(', ')}`}
                isLoading={isLoading}
                error={error}
                isEmpty={modelPie.length === 0}
              >
                <AnalyticsPieChart data={modelPie} />
              </ChartCard>
              <ChartCard
                title="Requests by Provider"
                summary={`Requests per provider: ${providerPie.map((d) => `${d.name}: ${d.value}`).join(', ')}`}
                isLoading={isLoading}
                error={error}
                isEmpty={providerPie.length === 0}
              >
                <AnalyticsPieChart data={providerPie} />
              </ChartCard>

              {/* Top models table */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top Models</h3>
                {data.by_model.length === 0 ? (
                  <p className="text-sm text-zinc-500">No usage in this period.</p>
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Model</TH>
                        <TH>Requests</TH>
                        <TH>Tokens</TH>
                        <TH>Avg Latency</TH>
                        <TH>Cost</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {data.by_model.slice(0, 8).map((m) => (
                        <TR key={m.model}>
                          <TD className="font-medium">{m.model}</TD>
                          <TD className="tabular-nums">{formatNumber(m.requests)}</TD>
                          <TD className="tabular-nums">{formatNumber(m.tokens)}</TD>
                          <TD className="tabular-nums">{m.avg_latency_ms !== null ? `${m.avg_latency_ms}ms` : '—'}</TD>
                          <TD className="tabular-nums">{formatMoney(m.cost)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </div>
            </div>

            {/* Providers table */}
            {data.by_provider.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Providers</h3>
                <Table>
                  <THead>
                    <TR>
                      <TH>Provider</TH>
                      <TH>Requests</TH>
                      <TH>Tokens</TH>
                      <TH>Success Rate</TH>
                      <TH>Cost</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.by_provider.map((p) => (
                      <TR key={p.provider}>
                        <TD className="font-medium">{p.provider}</TD>
                        <TD className="tabular-nums">{formatNumber(p.requests)}</TD>
                        <TD className="tabular-nums">{formatNumber(p.tokens)}</TD>
                        <TD><Badge tone={parseFloat(p.success_rate) >= 95 ? 'success' : 'warning'}>{p.success_rate}%</Badge></TD>
                        <TD className="tabular-nums">{formatMoney(p.cost)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  )
}
