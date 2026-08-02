'use client'

// ProxyAI — Export Button (Milestone 4)
// Downloads the current analytics view as CSV or JSON.

import { useState } from 'react'
import { downloadExport } from '@/hooks/use-admin-logs'
import type { AnalyticsFilters } from '@/hooks/use-admin-analytics'

export interface ExportButtonProps {
  type: 'business' | 'usage' | 'financial' | 'provider' | 'logs'
  filters: AnalyticsFilters
  className?: string
}

export function ExportButton({ type, filters, className }: ExportButtonProps) {
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (format: 'csv' | 'json') => {
    setBusy(format)
    setError(null)
    try {
      await downloadExport({
        type,
        format,
        range: filters.range,
        from: filters.from,
        to: filters.to,
        provider: filters.provider,
        model: filters.model,
        user: filters.user,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="sr-only">Export {type} analytics</span>
        <button
          type="button"
          onClick={() => handleExport('csv')}
          disabled={busy !== null}
          className="h-9 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {busy === 'csv' ? 'Exporting…' : 'CSV'}
        </button>
        <button
          type="button"
          onClick={() => handleExport('json')}
          disabled={busy !== null}
          className="h-9 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {busy === 'json' ? 'Exporting…' : 'JSON'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  )
}
