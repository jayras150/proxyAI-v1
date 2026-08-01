'use client'

// ProxyAI — Usage hook (Milestone 4)
// Cursor-paginated usage history with search, date range, model & status filters.

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'

export interface UsageItem {
  id: string
  model: string
  provider: string
  status: string
  pricing_version?: string | null
  prompt_tokens: number
  completion_tokens: number
  cached_tokens: number
  total_tokens: number
  user_cost: string
  currency: string
  latency_ms?: number | null
  request_id: string | null
  created_at: string
}

export interface UsagePage {
  items: UsageItem[]
  next_cursor: string | null
  has_more: boolean
}

export interface UsageDetailItem extends UsageItem {
  reasoning_tokens?: number | null
  pricing_version_id?: string | null
  input_price?: string | null
  output_price?: string | null
  markup_percent?: string | null
  service_fee?: string | null
}

export interface UsageFilters {
  cursor?: string | null
  limit?: number
  search?: string
  model?: string
  status?: string
  date_from?: string
  date_to?: string
}

export function useUsage(filters: UsageFilters = {}) {
  const { cursor, limit, search, model, status, date_from, date_to } = filters
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  if (search) params.set('search', search)
  if (model) params.set('model', model)
  if (status) params.set('status', status)
  if (date_from) params.set('date_from', date_from)
  if (date_to) params.set('date_to', date_to)

  return useQuery({
    queryKey: [...QUERY_KEYS.usage, cursor, limit, search, model, status, date_from, date_to],
    queryFn: async () => {
      const qs = params.toString()
      const res = await apiFetch<UsagePage>(`/api/v1/usage${qs ? `?${qs}` : ''}`)
      return res.data
    },
    staleTime: STALE_TIMES.lists,
  })
}
