'use client'

// ProxyAI — Usage Page (Milestone 4)
// Cursor-paginated usage history with search, status, and date range filters.
// Desktop: table. Mobile: cards.
// Includes daily/monthly summary stat cards.

import { useState, useCallback } from 'react'
import { useUsage, type UsageFilters, type UsageItem, type UsageDetailItem } from '@/hooks/use-usage'
import { PageHeader } from '@/components/ui/page-header'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { UsageFilters as UsageFilterBar, type UsageFilterValues } from '@/components/dashboard/usage-filters'
import { UsageDetailDialog } from '@/components/dashboard/usage-detail-dialog'
import { formatMoney, formatNumber, formatRelativeTime } from '@/lib/format'

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'neutral',
}

export default function UsagePage() {
  const [filters, setFilters] = useState<UsageFilters>({ limit: 20 })
  const [selectedUsage, setSelectedUsage] = useState<UsageDetailItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading, error } = useUsage(filters)
  const items = data?.items ?? []

  // Compute summary stats from current page
  const totalTokens = items.reduce((sum, item) => sum + item.total_tokens, 0)
  const totalCost = items.reduce((sum, item) => sum + Number.parseFloat(item.user_cost), 0)
  const totalPromptTokens = items.reduce((sum, item) => sum + item.prompt_tokens, 0)
  const totalCompletionTokens = items.reduce((sum, item) => sum + item.completion_tokens, 0)

  const handleFilterChange = useCallback((values: UsageFilterValues) => {
    setFilters({
      search: values.search || undefined,
      model: values.model || undefined,
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

  const handleRowClick = useCallback((item: UsageItem) => {
    // Convert to detail shape
    const detail: UsageDetailItem = {
      ...item,
      reasoning_tokens: null,
      pricing_version_id: item.pricing_version,
      input_price: null,
      output_price: null,
      markup_percent: null,
      service_fee: null,
    }
    setSelectedUsage(detail)
    setDetailOpen(true)
  }, [])

  const hasPrevPage = !!filters.cursor
  const hasNextPage = data?.has_more ?? false

  return (
    <div className="space-y-6">
      <PageHeader title="Usage" description="Token consumption and cost breakdown." />

      {/* Summary cards */}
      {!isLoading && !error && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Tokens" value={formatNumber(totalTokens)} hint="Current page" />
          <StatCard label="Total Cost" value={formatMoney(totalCost.toFixed(6))} hint="Current page" />
          <StatCard label="Prompt Tokens" value={formatNumber(totalPromptTokens)} hint="Current page" />
          <StatCard label="Completion Tokens" value={formatNumber(totalCompletionTokens)} hint="Current page" />
        </div>
      )}

      {/* Filters */}
      <UsageFilterBar
        values={{
          search: filters.search ?? '',
          model: filters.model ?? '',
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
          title="Failed to Load Usage"
          error={error}
          onRetry={() => setFilters((prev) => ({ ...prev }))}
        />
      )}

      {/* Empty */}
      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          title="No usage records"
          description={
            filters.search || filters.status || filters.date_from
              ? 'No usage records match your filters.'
              : 'You have no usage records yet. Start making API calls to see your usage here.'
          }
        />
      )}

      {/* Data — Desktop table */}
      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Model</TH>
                  <TH>Provider</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Tokens</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Latency</TH>
                  <TH>Date</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => (
                  <TR
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(item)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View usage for ${item.model}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(item) }}
                  >
                    <TD className="font-medium text-zinc-900 dark:text-zinc-100">{item.model}</TD>
                    <TD className="text-zinc-500">{item.provider}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</Badge>
                    </TD>
                    <TD className="tabular-nums text-right">{formatNumber(item.total_tokens)}</TD>
                    <TD className="tabular-nums text-right font-medium">
                      {formatMoney(item.user_cost, item.currency)}
                    </TD>
                    <TD className="tabular-nums text-right text-zinc-500">
                      {item.latency_ms != null ? `${item.latency_ms}ms` : '—'}
                    </TD>
                    <TD className="tabular-nums text-zinc-500 whitespace-nowrap">
                      {formatRelativeTime(item.created_at)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Data — Mobile cards */}
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex cursor-pointer items-center justify-between px-5 py-3"
                onClick={() => handleRowClick(item)}
                tabIndex={0}
                role="button"
                aria-label={`View usage for ${item.model}`}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(item) }}
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.model}</p>
                  <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</Badge>
                  <p className="text-xs text-zinc-500">{formatRelativeTime(item.created_at)}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="tabular-nums font-medium">{formatMoney(item.user_cost, item.currency)}</p>
                  <p className="tabular-nums text-xs text-zinc-500">{formatNumber(item.total_tokens)} tokens</p>
                  <p className="text-xs text-zinc-500">{item.provider}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Showing {items.length} record{items.length !== 1 ? 's' : ''}
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

      {/* Usage Detail Dialog */}
      <UsageDetailDialog
        usage={selectedUsage}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
