'use client'

// ProxyAI — Logs Viewer (Milestone 4)
// Read-only unified log stream with type filter and cursor pagination.

import { useState } from 'react'
import { useAdminLogs, type LogType } from '@/hooks/use-admin-logs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { formatRelativeTime } from '@/lib/format'

const TYPE_OPTIONS: Array<{ value: '' | LogType; label: string }> = [
  { value: '', label: 'All' },
  { value: 'error', label: 'Errors' },
  { value: 'request', label: 'Requests' },
  { value: 'admin_action', label: 'Admin Actions' },
  { value: 'refund', label: 'Refunds' },
  { value: 'wallet', label: 'Wallet' },
]

const TYPE_TONE: Record<LogType, 'danger' | 'info' | 'primary' | 'warning' | 'neutral'> = {
  error: 'danger',
  request: 'info',
  admin_action: 'primary',
  refund: 'warning',
  wallet: 'neutral',
}

export function LogsViewer() {
  const [type, setType] = useState<'' | LogType>('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursors, setCursors] = useState<string[]>([])

  const { data, isLoading, error } = useAdminLogs({ type: type || undefined, cursor })
  const items = data?.items ?? []

  const changeType = (next: '' | LogType) => {
    setType(next)
    setCursor(null)
    setCursors([])
  }

  const handlePrev = () => {
    const prev = cursors.length >= 2 ? cursors[cursors.length - 2]! : null
    setCursors(cursors.slice(0, -1))
    setCursor(prev)
  }

  const handleNext = () => {
    if (data?.next_cursor) {
      setCursors([...cursors, data.next_cursor])
      setCursor(data.next_cursor)
    }
  }

  return (
    <div className="space-y-4">
      {/* Type filter */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter logs by type">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => changeType(opt.value)}
            aria-pressed={type === opt.value}
            className={`h-9 rounded-lg px-3 text-sm font-medium transition-colors ${
              type === opt.value
                ? 'bg-blue-600 text-white'
                : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading && <SkeletonCard lines={4} />}
      {error && !isLoading && <ErrorState title="Failed to Load Logs" error={error} />}
      {!isLoading && !error && items.length === 0 && <EmptyState title="No log entries" description="Nothing matches this filter." />}

      {items.length > 0 && (
        <>
          <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {items.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={TYPE_TONE[entry.type]}>{entry.type.replace('_', ' ')}</Badge>
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{entry.title}</span>
                  </div>
                  {entry.detail && <p className="mt-0.5 truncate text-xs text-zinc-500">{entry.detail}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-zinc-500">{formatRelativeTime(entry.created_at)}</p>
                  {entry.user_id && <p className="mt-0.5 font-mono text-[10px] text-zinc-400">{entry.user_id.slice(0, 12)}…</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{items.length} entr{items.length === 1 ? 'y' : 'ies'}</p>
            <div className="flex gap-2">
              {cursors.length > 0 && <Button variant="outline" size="sm" onClick={handlePrev}>Previous</Button>}
              {data?.has_more && <Button variant="outline" size="sm" onClick={handleNext}>Next</Button>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
