// ProxyAI — Dashboard route loading state (skeleton-first, design doc §4.2)

import { SkeletonCard } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-zinc-200/80 dark:bg-zinc-800 animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-72 rounded bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <SkeletonCard lines={4} />
    </div>
  )
}
