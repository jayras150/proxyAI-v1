'use client'

// ProxyAI — System Monitoring Page (Milestone 4)
// Component health, uptime, build info, rates with auto-refresh.

import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminMonitoring } from '@/hooks/use-admin-monitoring'
import { KpiCard } from '@/components/admin/analytics/kpi-card'
import { AutoRefresh } from '@/components/admin/analytics/auto-refresh'
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'

const COMPONENT_TONE: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  ok: 'success',
  degraded: 'warning',
  down: 'danger',
  not_configured: 'neutral',
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function AdminMonitoringPage() {
  const { data, isLoading, error, refetch, isFetching } = useAdminMonitoring()

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">System Monitoring</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Health, uptime and operational rates.</p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <Badge tone={data.status === 'ok' ? 'success' : data.status === 'degraded' ? 'warning' : 'danger'}>
                {data.status.toUpperCase()}
              </Badge>
            )}
            <AutoRefresh refetch={() => refetch()} />
          </div>
        </div>

        {isFetching && !isLoading && (
          <p className="text-xs text-zinc-400" aria-live="polite">Refreshing…</p>
        )}

        {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /></div>}
        {error && !isLoading && <ErrorState title="Failed to Load Monitoring" error={error} />}

        {data && !isLoading && (
          <>
            {/* Rates */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Uptime" value={formatUptime(data.uptime_seconds)} />
              <KpiCard label="Response Time" value={data.avg_response_time_ms !== null ? `${data.avg_response_time_ms}ms` : '—'} />
              <KpiCard label="Requests / sec" value={data.requests_per_sec.toFixed(2)} />
              <KpiCard label="Success Rate" value={`${data.success_rate}%`} tone="success" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Error Rate" value={`${data.error_rate}%`} tone={parseFloat(data.error_rate) > 5 ? 'danger' : 'default'} />
              <KpiCard label="Version" value={data.version} />
              <KpiCard label="Environment" value={data.environment} />
              <KpiCard label="Checked At" value={new Date(data.checked_at).toLocaleTimeString()} />
            </div>

            {/* Components */}
            <section aria-label="Component status">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Components</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.components.map((c) => (
                  <div key={c.name} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                      <Badge tone={COMPONENT_TONE[c.status] ?? 'neutral'}>{c.status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{c.detail}</p>
                    {c.latency_ms !== null && (
                      <p className="mt-1 text-xs tabular-nums text-zinc-400">{c.latency_ms}ms</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Build info */}
            <section aria-label="Build information">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Build</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard label="Node" value={data.build_info.node} />
                <KpiCard label="Platform" value={`${data.build_info.platform} / ${data.build_info.arch}`} />
                <KpiCard label="Status" value="Operational" tone="success" />
              </div>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  )
}
