'use client'

// ProxyAI — Analytics Filter Bar (Milestone 4)
// Range picker (today/yesterday/7d/30d/custom) + provider/model/user filters.
// Emits a plain filters object; parent owns the state.
//
// Provider/model use text inputs with datalist suggestions so every analytics
// page can offer the same filters without extra data fetches.

import { useState } from 'react'
import type { AnalyticsFilters } from '@/hooks/use-admin-analytics'

export interface FilterBarProps {
  value: AnalyticsFilters
  onChange: (filters: AnalyticsFilters) => void
  /** Provider suggestions (datalist). */
  providers?: string[]
  /** Model suggestions (datalist). */
  models?: string[]
  showUserFilter?: boolean
}

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
] as const

const selectClass =
  'h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900'
const inputClass =
  'h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900'

export function FilterBar({ value, onChange, providers = [], models = [], showUserFilter = true }: FilterBarProps) {
  const [customFrom, setCustomFrom] = useState(value.from ?? '')
  const [customTo, setCustomTo] = useState(value.to ?? '')

  const setRange = (range: AnalyticsFilters['range']) => {
    if (range === 'custom') {
      onChange({ ...value, range, from: customFrom || undefined, to: customTo || undefined })
    } else {
      onChange({ ...value, range, from: null, to: null })
    }
  }

  const applyCustom = () => {
    onChange({ ...value, range: 'custom', from: customFrom || null, to: customTo || null })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:flex-row lg:flex-wrap lg:items-end">
      {/* Range */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500" htmlFor="analytics-range">Period</label>
        <select
          id="analytics-range"
          className={selectClass}
          value={value.range ?? 'today'}
          onChange={(e) => setRange(e.target.value as AnalyticsFilters['range'])}
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Custom range */}
      {value.range === 'custom' && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500" htmlFor="analytics-from">From</label>
            <input
              id="analytics-from"
              type="date"
              className={inputClass}
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500" htmlFor="analytics-to">To</label>
            <input
              id="analytics-to"
              type="date"
              className={inputClass}
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={applyCustom}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </>
      )}

      {/* Provider */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500" htmlFor="analytics-provider">Provider</label>
        <input
          id="analytics-provider"
          type="text"
          className={inputClass}
          list="analytics-provider-list"
          placeholder="All providers"
          value={value.provider ?? ''}
          onChange={(e) => onChange({ ...value, provider: e.target.value || null })}
        />
        {providers.length > 0 && (
          <datalist id="analytics-provider-list">
            {providers.map((p) => <option key={p} value={p} />)}
          </datalist>
        )}
      </div>

      {/* Model */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500" htmlFor="analytics-model">Model</label>
        <input
          id="analytics-model"
          type="text"
          className={inputClass}
          list="analytics-model-list"
          placeholder="All models"
          value={value.model ?? ''}
          onChange={(e) => onChange({ ...value, model: e.target.value || null })}
        />
        {models.length > 0 && (
          <datalist id="analytics-model-list">
            {models.map((m) => <option key={m} value={m} />)}
          </datalist>
        )}
      </div>

      {/* User */}
      {showUserFilter && (
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-zinc-500" htmlFor="analytics-user">User ID</label>
          <input
            id="analytics-user"
            type="text"
            className={inputClass}
            placeholder="Filter by user id"
            value={value.user ?? ''}
            onChange={(e) => onChange({ ...value, user: e.target.value || null })}
          />
        </div>
      )}
    </div>
  )
}
