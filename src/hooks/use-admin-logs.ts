'use client'

// ProxyAI — Admin Logs + Export Hooks (Milestone 4)

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'

export type LogType = 'error' | 'request' | 'admin_action' | 'refund' | 'wallet'

export interface LogEntry {
  id: string
  type: LogType
  title: string
  detail: string | null
  user_id: string | null
  admin_id: string | null
  created_at: string
}

export interface LogsPage {
  items: LogEntry[]
  next_cursor: string | null
  has_more: boolean
}

export function useAdminLogs(params: { type?: string; cursor?: string | null; limit?: number }) {
  const searchParams = new URLSearchParams()
  if (params.type) searchParams.set('type', params.type)
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.limit) searchParams.set('limit', String(params.limit))
  const qs = searchParams.toString()

  return useQuery({
    queryKey: [...QUERY_KEYS.adminLogs, params],
    queryFn: async () => {
      const res = await apiFetch<LogsPage>(`/api/admin/logs${qs ? `?${qs}` : ''}`)
      return res.data
    },
    staleTime: STALE_TIMES.logs,
  })
}

/**
 * Download an analytics export (CSV or JSON) as a file.
 * Returns the filename on success.
 */
export async function downloadExport(
  params: {
    type: 'business' | 'usage' | 'financial' | 'provider' | 'logs'
    format: 'csv' | 'json'
    range?: string
    from?: string | null
    to?: string | null
    provider?: string | null
    model?: string | null
    user?: string | null
  }
): Promise<string> {
  const searchParams = new URLSearchParams()
  searchParams.set('type', params.type)
  searchParams.set('format', params.format)
  if (params.range) searchParams.set('range', params.range)
  if (params.from) searchParams.set('from', params.from)
  if (params.to) searchParams.set('to', params.to)
  if (params.provider) searchParams.set('provider', params.provider)
  if (params.model) searchParams.set('model', params.model)
  if (params.user) searchParams.set('user', params.user)

  const response = await fetch(`/api/admin/export?${searchParams.toString()}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = `Export failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      message = body.error?.message ?? message
    } catch {
      // non-JSON error body
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] ?? `proxyai-export.${params.format}`

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return filename
}
