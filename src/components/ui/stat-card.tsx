// ProxyAI — StatCard (presentational)
// Label + value + optional hint/tone. Values should use tabular-nums.

import { cn } from '@/lib/cn'
import { Badge, type BadgeTone } from '@/components/ui/badge'

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: BadgeTone
}

export function StatCard({ label, value, hint, tone, className, ...props }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
        {tone && <Badge tone={tone}>{tone}</Badge>}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  )
}
