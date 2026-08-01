'use client'

// ProxyAI — Transactions Page (Milestone 3)
// Cursor-paginated transaction list with search, type, status, and date filters.
// Desktop: table. Mobile: cards.

import { useState, useCallback } from 'react'
import { useTransactions, type TransactionFilters } from '@/hooks/use-transactions'
import { PageHeader } from '@/components/ui/page-header'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { TransactionFilters as FilterBar, type TransactionFilterValues } from '@/components/dashboard/transaction-filters'
import { TransactionDetailDialog } from '@/components/dashboard/transaction-detail-dialog'
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

const TYPE_TONE: Record<TransactionType, 'success' | 'neutral' | 'info' | 'warning' | 'primary' | 'danger'> = {
  TOPUP: 'success',
  AI_USAGE: 'neutral',
  REFUND: 'info',
  ADJUSTMENT: 'warning',
  ADMIN_CREDIT: 'success',
  ADMIN_DEBIT: 'danger',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REVERSED: 'neutral',
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({ limit: 20 })
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading, error } = useTransactions(filters)

  const items = data?.items ?? []

  const handleFilterChange = useCallback((values: TransactionFilterValues) => {
    setFilters({
      search: values.search || undefined,
      type: values.type || undefined,
      status: values.status || undefined,
      date_from: values.dateFrom || undefined,
      date_to: values.dateTo || undefined,
      cursor: undefined,
      limit: 20,
    })
  }, [])

  const handleNextPage = useCallback(() => {
    const nc = data?.next_cursor
    if (nc) {
      setFilters((prev) => ({ ...prev, cursor: nc }))
    }
  }, [data?.next_cursor])

  const handlePrevPage = useCallback(() => {
    setFilters((prev) => ({ ...prev, cursor: undefined }))
  }, [])

  const handleRowClick = useCallback((tx: TransactionItem) => {
    setSelectedTx(tx)
    setDetailOpen(true)
  }, [])

  const hasPrevPage = !!filters.cursor
  const hasNextPage = data?.has_more ?? false

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Topups, AI usage, refunds and adjustments." />

      <FilterBar
        values={{
          search: filters.search ?? '',
          type: (filters.type as TransactionType | '') ?? '',
          status: filters.status ?? '',
          dateFrom: filters.date_from ?? '',
          dateTo: filters.date_to ?? '',
        }}
        onChange={handleFilterChange}
      />

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <ErrorState
          title="Failed to Load Transactions"
          error={error as { message?: string }}
          onRetry={() => setFilters((prev) => ({ ...prev }))}
        />
      )}

      {/* Empty */}
      {!isLoading && !error && items.length === 0 && (
        <EmptyState title="No transactions" description="No transactions match your filters." />
      )}

      {/* Data — Desktop table */}
      {!isLoading && !error && items.length > 0 && (
        <>
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
                  <TR
                    key={tx.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(tx)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View transaction ${tx.reference}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(tx) }}
                  >
                    <TD>
                      <Badge tone={TYPE_TONE[tx.type] ?? 'neutral'}>
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
                    <TD className="tabular-nums text-zinc-500">{formatRelativeTime(tx.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Data — Mobile cards */}
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
            {items.map((tx) => (
              <div
                key={tx.id}
                className="flex cursor-pointer items-center justify-between px-5 py-3"
                onClick={() => handleRowClick(tx)}
                tabIndex={0}
                role="button"
                aria-label={`View transaction ${tx.reference}`}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(tx) }}
              >
                <div className="space-y-1">
                  <Badge tone={TYPE_TONE[tx.type] ?? 'neutral'}>
                    {TYPE_LABELS[tx.type] ?? tx.type}
                  </Badge>
                  <p className="text-xs text-zinc-500">{formatRelativeTime(tx.created_at)}</p>
                  <p className="text-xs text-zinc-500">{formatMoney(tx.balance_after, tx.currency)}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums font-medium">
                    {formatSignedAmount(tx.type, tx.amount, tx.currency)}
                  </p>
                  <Badge tone={STATUS_TONE[tx.status] ?? 'neutral'}>{tx.status}</Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Showing {items.length} transaction{items.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              {hasPrevPage && (
                <Button variant="outline" size="sm" onClick={handlePrevPage} aria-label="Previous page">
                  Previous
                </Button>
              )}
              {hasNextPage && (
                <Button variant="outline" size="sm" onClick={handleNextPage} aria-label="Next page">
                  Next
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <TransactionDetailDialog
        transaction={selectedTx}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
