'use client'
import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminSummary } from '@/hooks/use-admin-summary'
import { formatMoney, formatNumber } from '@/lib/format'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'

export default function AdminPage() {
  const { data, isLoading, error } = useAdminSummary()

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">ProxyAI operations overview.</p>
        </div>

        {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} lines={1} />)}</div>}
        {error && !isLoading && <ErrorState title="Failed to Load Dashboard" error={error} />}

        {data && (
          <>
            {/* Revenue */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Revenue</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Today" value={formatMoney(data.revenue_today)} hint={`${formatNumber(data.requests_today)} requests`} />
                <StatCard label="This Month" value={formatMoney(data.revenue_month)} hint={`${formatNumber(data.requests_month)} requests`} />
                <StatCard label="Previous Month" value={formatMoney(data.revenue_previous_month)} />
              </div>
            </div>

            {/* Platform */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Platform</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Active Users" value={formatNumber(data.active_users)} hint={`+${data.new_users_today} today`} />
                <StatCard label="Wallet Float" value={formatMoney(data.total_wallet_balance)} />
                <StatCard label="Active API Keys" value={formatNumber(data.active_api_keys)} />
                <StatCard label="Active Models" value={formatNumber(data.active_models)} />
              </div>
            </div>

            {/* System */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">System</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Provider Status" value={data.provider_healthy ? 'Operational' : 'Degraded'} tone={data.provider_healthy ? 'success' : 'danger'} />
                <StatCard label="Pending Refunds" value={formatNumber(data.pending_refunds)} tone={data.pending_refunds > 0 ? 'warning' : undefined} />
              </div>
            </div>

            {/* Recent Activities */}
            {data.recent_activities.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wide">Recent Activity</h2>
                <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-200 dark:border-zinc-800 dark:divide-zinc-800">
                  {data.recent_activities.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-zinc-700 dark:text-zinc-300">{a.description}</span>
                      <span className="text-xs text-zinc-500">{formatRelativeTime(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  )
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'success' | 'warning' | 'danger' }) {
  const toneColors = { success: 'text-emerald-600 dark:text-emerald-400', warning: 'text-amber-600 dark:text-amber-400', danger: 'text-red-600 dark:text-red-400' }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100 ${tone ? toneColors[tone] : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}
