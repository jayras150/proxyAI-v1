'use client'

// ProxyAI — Recent Balance Changes (Milestone 3)
// Shows the latest wallet transactions inline on the Wallet page.

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatSignedAmount, formatRelativeTime } from '@/lib/format'
import type { TransactionItem, TransactionType } from '@/types/wallet'

const TYPE_LABELS: Record<TransactionType, string> = {
  TOPUP: 'Topup',
  AI_USAGE: 'AI Usage',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
  ADMIN_CREDIT: 'Admin Credit',
  ADMIN_DEBIT: 'Admin Debit',
}

const TYPE_BADGE_TONE: Record<TransactionType, 'success' | 'neutral' | 'info' | 'warning' | 'primary'> = {
  TOPUP: 'success',
  AI_USAGE: 'neutral',
  REFUND: 'info',
  ADJUSTMENT: 'warning',
  ADMIN_CREDIT: 'success',
  ADMIN_DEBIT: 'warning',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REVERSED: 'neutral',
}

interface RecentBalanceChangesProps {
  items: TransactionItem[] | undefined
  isLoading: boolean
}

export function RecentBalanceChanges({ items, isLoading }: RecentBalanceChangesProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Balance Changes</CardTitle>
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
          <CardTitle>Recent Balance Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="No transactions" description="Your recent balance changes will appear here." />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Balance Changes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="hidden md:block">
          <Table>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Amount</TH>
                <TH>Balance</TH>
                <TH>Status</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((tx) => (
                <TR key={tx.id}>
                  <TD>
                    <Badge tone={TYPE_BADGE_TONE[tx.type] ?? 'neutral'}>
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </Badge>
                  </TD>
                  <TD className="tabular-nums font-medium">
                    {formatSignedAmount(tx.type, tx.amount, tx.currency)}
                  </TD>
                  <TD className="tabular-nums text-zinc-500">
                    {formatMoney(tx.balance_after, tx.currency)}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[tx.status] ?? 'neutral'}>{tx.status}</Badge>
                  </TD>
                  <TD className="tabular-nums text-zinc-500">
                    {formatRelativeTime(tx.created_at)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
          {items.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-3">
              <div className="space-y-1">
                <Badge tone={TYPE_BADGE_TONE[tx.type] ?? 'neutral'}>
                  {TYPE_LABELS[tx.type] ?? tx.type}
                </Badge>
                <p className="text-xs text-zinc-500">{formatRelativeTime(tx.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="tabular-nums font-medium">
                  {formatSignedAmount(tx.type, tx.amount, tx.currency)}
                </p>
                <p className="text-xs tabular-nums text-zinc-500">
                  {formatMoney(tx.balance_after, tx.currency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
