'use client'

// ProxyAI — Transaction Filters (Milestone 3)
// Search, type, status, date range filters for the transaction list.

import { useState } from 'react'
import { SearchBox } from '@/components/ui/search-box'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { TransactionType } from '@/types/wallet'

const TRANSACTION_TYPES: { value: TransactionType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'TOPUP', label: 'Topup' },
  { value: 'AI_USAGE', label: 'AI Usage' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'ADMIN_CREDIT', label: 'Admin Credit' },
  { value: 'ADMIN_DEBIT', label: 'Admin Debit' },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REVERSED', label: 'Reversed' },
]

export interface TransactionFilterValues {
  search: string
  type: TransactionType | ''
  status: string
  dateFrom: string
  dateTo: string
}

interface TransactionFiltersProps {
  values: TransactionFilterValues
  onChange: (values: TransactionFilterValues) => void
}

export function TransactionFilters({ values, onChange }: TransactionFiltersProps) {
  const [expanded, setExpanded] = useState(false)

  const update = (partial: Partial<TransactionFilterValues>) => {
    onChange({ ...values, ...partial })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <SearchBox
            value={values.search}
            onChange={(search) => update({ search })}
            placeholder="Search transactions..."
            aria-label="Search transactions"
          />
        </div>
        <div className="flex gap-2">
          <div className="w-full sm:w-auto">
            <select
              value={values.type}
              onChange={(e) => update({ type: e.target.value as TransactionType | '' })}
              aria-label="Filter by transaction type"
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {TRANSACTION_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <select
              value={values.status}
              onChange={(e) => update({ status: e.target.value })}
              aria-label="Filter by transaction status"
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide date range' : 'Show date range'}
            className="hidden sm:inline-flex"
          >
            {expanded ? 'Hide Dates' : 'Dates'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="date-from" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              From
            </label>
            <Input
              id="date-from"
              type="date"
              value={values.dateFrom}
              onChange={(e) => update({ dateFrom: e.target.value })}
              aria-label="Filter from date"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="date-to" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              To
            </label>
            <Input
              id="date-to"
              type="date"
              value={values.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
              aria-label="Filter to date"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ dateFrom: '', dateTo: '' })}
              aria-label="Clear date range"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
