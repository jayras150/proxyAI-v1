'use client'

// ProxyAI — Usage Detail Dialog (Milestone 4)
// Read-only dialog with full usage log information.

import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatNumber, formatDateTime } from '@/lib/format'
import type { UsageDetailItem } from '@/hooks/use-usage'

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'neutral',
}

interface UsageDetailDialogProps {
  usage: UsageDetailItem | null
  open: boolean
  onClose: () => void
}

export function UsageDetailDialog({ usage, open, onClose }: UsageDetailDialogProps) {
  if (!usage) return null

  return (
    <Dialog open={open} onClose={onClose} title="Usage Detail" description="Read-only usage information.">
      <div className="space-y-4">
        {/* Status & Request ID */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</p>
            <Badge tone={STATUS_TONE[usage.status] ?? 'neutral'}>{usage.status}</Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Request ID</p>
            <p className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">
              {usage.request_id ?? '—'}
            </p>
          </div>
        </div>

        {/* Model & Provider */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Model</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{usage.model}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Provider</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{usage.provider}</p>
          </div>
        </div>

        {/* Token Usage */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Token Usage
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Prompt Tokens</p>
              <p className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatNumber(usage.prompt_tokens)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Completion Tokens</p>
              <p className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatNumber(usage.completion_tokens)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Cached Tokens</p>
              <p className="tabular-nums text-zinc-700 dark:text-zinc-300">
                {formatNumber(usage.cached_tokens)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Reasoning Tokens</p>
              <p className="tabular-nums text-zinc-700 dark:text-zinc-300">
                {usage.reasoning_tokens != null ? formatNumber(usage.reasoning_tokens) : '—'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Tokens</p>
              <p className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                {formatNumber(usage.total_tokens)}
              </p>
            </div>
          </div>
        </div>

        {/* Cost & Pricing */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Cost & Pricing
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Total Cost</span>
              <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoney(usage.user_cost, usage.currency)}
              </span>
            </div>
            {usage.input_price && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Input Price (per 1M)</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatMoney(usage.input_price, usage.currency)}
                </span>
              </div>
            )}
            {usage.output_price && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Output Price (per 1M)</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatMoney(usage.output_price, usage.currency)}
                </span>
              </div>
            )}
            {usage.markup_percent && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Markup</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {usage.markup_percent}%
                </span>
              </div>
            )}
            {usage.service_fee && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Service Fee</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatMoney(usage.service_fee, usage.currency)}
                </span>
              </div>
            )}
            {usage.pricing_version_id && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Pricing Version</span>
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  {usage.pricing_version_id.slice(0, 8)}…
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Created */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Created Time</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{formatDateTime(usage.created_at)}</p>
        </div>
      </div>
    </Dialog>
  )
}
