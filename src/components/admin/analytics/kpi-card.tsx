'use client'

// ProxyAI — KPI Card (Milestone 4)
// Presentational stat card for analytics dashboards.

import { cn } from '@/lib/cn'

export type KpiTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

const TONE_TEXT: Record<KpiTone, string> = {
  default: 'text-zinc-900 dark:text-zinc-100',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-sky-600 dark:text-sky-400',
}

export interface KpiCardProps {
  label: string
  value: string
  hint?: string
  tone?: KpiTone
  className?: string
}

export function KpiCard({ label, value, hint, tone = 'default', className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums tracking-tight', TONE_TEXT[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  )
}
