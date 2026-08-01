'use client'

// ProxyAI — Recent Transactions Widget (Milestone 2)
// The 5 most recent wallet transactions; View All → /dashboard/transactions.

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
import { ButtonLink } from '@/components/ui/button-link'
import { formatDateTime, formatSignedAmount } from '@/lib/format'
import type { DashboardTransactionItem } from '@/types/dashboard'

const TYPE_LABELS: Record<DashboardTransactionItem['type'], string> = {
  TOPUP: 'Top up',
  AI_USAGE: 'AI usage',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
  ADMIN_CREDIT: 'Credit',
  ADMIN_DEBIT: 'Debit',
}

const TYPE_TONES: Record<DashboardTransactionItem['type'], 'success' | 'neutral' | 'info'> = {
  TOPUP: 'success',
  AI_USAGE: 'neutral',
  REFUND: 'info',
  ADJUSTMENT: 'neutral',
  ADMIN_CREDIT: 'success',
  ADMIN_DEBIT: 'neutral',
}

export interface RecentTransactionsWidgetProps {
  transactions: DashboardTransactionItem[]
}

export function RecentTransactionsWidget({ transactions }: RecentTransactionsWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest wallet activity</CardDescription>
        </div>
        <Link
          href="/dashboard/transactions"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Top-ups and AI usage charges will show up here."
            action={
              <ButtonLink href="/dashboard/topup" variant="outline" size="sm">
                Top up
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {tx.description ?? TYPE_LABELS[tx.type] ?? tx.type}
                    </p>
                    <Badge tone={TYPE_TONES[tx.type] ?? 'neutral'}>{TYPE_LABELS[tx.type] ?? tx.type}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(tx.created_at)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    tx.amount.startsWith('-')
                      ? 'text-red-600 dark:text-red-400'
                      : tx.type === 'AI_USAGE' || tx.type === 'ADMIN_DEBIT'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {formatSignedAmount(tx.type, tx.amount, tx.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
