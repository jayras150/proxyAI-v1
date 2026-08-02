'use client'

// ProxyAI — Chart Card (Milestone 4)
// Wrapper around a chart: title, summary (a11y), skeleton, empty and error states.

import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { EmptyState } from '@/components/ui/empty-state'

export interface ChartCardProps {
  title: string
  /** Accessible text summary of the chart (required for screen readers). */
  summary: string
  isLoading?: boolean
  error?: Error | null
  isEmpty?: boolean
  emptyText?: string
  children: React.ReactNode
  action?: React.ReactNode
}

export function ChartCard({
  title,
  summary,
  isLoading,
  error,
  isEmpty,
  emptyText = 'No data available for this period.',
  children,
  action,
}: ChartCardProps) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        {action}
      </div>

      <p className="sr-only">{summary}</p>

      {isLoading && <div className="py-6"><SkeletonCard lines={3} /></div>}
      {error && !isLoading && <ErrorState title="Failed to Load Chart" error={error} />}
      {!isLoading && !error && isEmpty && <div className="py-8"><EmptyState title="No data" description={emptyText} /></div>}
      {!isLoading && !error && !isEmpty && <div className="min-h-[200px]">{children}</div>}
    </section>
  )
}
