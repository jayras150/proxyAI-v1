// ProxyAI — Skeleton loading placeholder (presentational, shimmer-free:
// respects prefers-reduced-motion; subtle pulse only).

import { cn } from '@/lib/cn'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-zinc-200/80 dark:bg-zinc-800',
        'motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  )
}

export interface SkeletonCardProps {
  lines?: number
  className?: string
}

/** Skeleton layout matching the standard Card (title + n lines). */
export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}
    >
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}
