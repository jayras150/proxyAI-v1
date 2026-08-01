'use client'

// ProxyAI — Recent AI Usage Widget (Milestone 2)
// The 5 most recent AI requests: model, cost, tokens, time.
// View all → /dashboard/usage.

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatMoney, formatNumber, formatRelativeTime } from '@/lib/format'
import type { DashboardUsageItem } from '@/types/dashboard'

export interface RecentUsageWidgetProps {
  usage: DashboardUsageItem[]
}

export function RecentUsageWidget({ usage }: RecentUsageWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Recent AI Usage</CardTitle>
          <CardDescription>Your latest AI requests</CardDescription>
        </div>
        <Link
          href="/dashboard/usage"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {usage.length === 0 ? (
          <EmptyState
            title="No AI usage yet"
            description="Once you make your first AI request, it will appear here."
          />
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {usage.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {log.model}
                    </p>
                    <Badge tone={log.status === 'COMPLETED' ? 'success' : log.status === 'FAILED' ? 'danger' : 'neutral'}>
                      {log.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatNumber(log.total_tokens)} tokens · {formatRelativeTime(log.created_at)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatMoney(log.user_cost, log.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
