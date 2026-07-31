// ProxyAI — Badge primitive (presentational)

import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  primary:
    'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning:
    'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  danger:
    'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  info:
    'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  )
}
