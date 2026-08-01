'use client'

// ProxyAI — Pending Topup List (Milestone 3)
// Shows pending/expired/failed topups with polling and retry.

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonCard } from '@/components/ui/skeleton'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatMoney, formatRelativeTime } from '@/lib/format'
import type { TopupItem, TopupStatus } from '@/types/wallet'

const STATUS_TONE: Record<TopupStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  EXPIRED: 'neutral',
}

const STATUS_LABEL: Record<TopupStatus, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
}

interface TopupPendingListProps {
  items: TopupItem[] | undefined
  isLoading: boolean
  onRetry: (item: TopupItem) => void
  onCancel?: (item: TopupItem) => void
}

export function TopupPendingList({ items, isLoading, onRetry }: TopupPendingListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Topups</CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonCard lines={3} />
        </CardContent>
      </Card>
    )
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Topups</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="No topups" description="Your top-up history will appear here." />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Topups</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="hidden md:block">
          <Table>
            <THead>
              <TR>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH>Expires</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((topup) => (
                <TR key={topup.id}>
                  <TD className="tabular-nums font-medium">
                    {formatMoney(topup.amount, topup.currency)}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[topup.status]}>{STATUS_LABEL[topup.status]}</Badge>
                  </TD>
                  <TD className="tabular-nums text-zinc-500">{formatRelativeTime(topup.created_at)}</TD>
                  <TD className="tabular-nums text-zinc-500">{formatRelativeTime(topup.expires_at)}</TD>
                  <TD className="text-right">
                    {topup.status === 'FAILED' && (
                      <Button size="sm" variant="outline" onClick={() => onRetry(topup)}>
                        Retry
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
          {items.map((topup) => (
            <div key={topup.id} className="flex items-center justify-between px-5 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{formatMoney(topup.amount, topup.currency)}</p>
                <Badge tone={STATUS_TONE[topup.status]}>{STATUS_LABEL[topup.status]}</Badge>
                <p className="text-xs text-zinc-500">{formatRelativeTime(topup.created_at)}</p>
              </div>
              {topup.status === 'FAILED' && (
                <Button size="sm" variant="outline" onClick={() => onRetry(topup)}>
                  Retry
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
