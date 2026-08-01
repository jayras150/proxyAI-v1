'use client'

// ProxyAI — Transaction Detail Dialog (Milestone 3)
// Read-only dialog with audit information: request ID, provider reference, etc.

import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatSignedAmount, formatDateTime } from '@/lib/format'
import type { TransactionItem } from '@/types/wallet'

interface TransactionDetailDialogProps {
  transaction: TransactionItem | null
  open: boolean
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  TOPUP: 'Topup',
  AI_USAGE: 'AI Usage',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
  ADMIN_CREDIT: 'Admin Credit',
  ADMIN_DEBIT: 'Admin Debit',
}

export function TransactionDetailDialog({ transaction, open, onClose }: TransactionDetailDialogProps) {
  if (!transaction) return null

  return (
    <Dialog open={open} onClose={onClose} title="Transaction Detail" description="Read-only transaction information.">
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Type</p>
            <Badge>{TYPE_LABELS[transaction.type] ?? transaction.type}</Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</p>
            <Badge>{transaction.status}</Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Amount</p>
            <p className="tabular-nums font-medium">{formatSignedAmount(transaction.type, transaction.amount, transaction.currency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Balance After</p>
            <p className="tabular-nums text-zinc-700 dark:text-zinc-300">
              {formatMoney(transaction.balance_after, transaction.currency)}
            </p>
          </div>
        </div>

        {/* Balance Before */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Balance Before</p>
          <p className="tabular-nums text-zinc-700 dark:text-zinc-300">
            {formatMoney(transaction.balance_before, transaction.currency)}
          </p>
        </div>

        {/* Description */}
        {transaction.description && (
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Description</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{transaction.description}</p>
          </div>
        )}

        {/* Reference */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Reference</p>
          <p className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{transaction.reference}</p>
        </div>

        {/* Date */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Created</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{formatDateTime(transaction.created_at)}</p>
        </div>

        {/* Audit Information (read-only) */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Audit Information
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Request ID</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {(transaction as unknown as Record<string, unknown>).request_id as string ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Provider Reference</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {(transaction as unknown as Record<string, unknown>).provider_reference as string ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Created By</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {(transaction as unknown as Record<string, unknown>).created_by as string ?? 'system'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
