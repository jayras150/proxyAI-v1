'use client'

// ProxyAI — Transaction hooks (Milestone 3)
// Cursor-paginated list with search, date range, type & status filters.

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'
import type { TransactionPage, TransactionType } from '@/types/wallet'

export interface TransactionFilters {
  cursor?: string | null
  limit?: number
  search?: string
  type?: TransactionType | ''
  status?: string
  date_from?: string
  date_to?: string
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { cursor, limit, search, type, status, date_from, date_to } = filters
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  if (search) params.set('search', search)
  if (type) params.set('type', type)
  if (status) params.set('status', status)
  if (date_from) params.set('date_from', date_from)
  if (date_to) params.set('date_to', date_to)

  return useQuery({
    queryKey: [...QUERY_KEYS.transactions, cursor, limit, search, type, status, date_from, date_to],
    queryFn: async () => {
      const qs = params.toString()
      const res = await apiFetch<TransactionPage>(`/api/v1/wallet/transactions${qs ? `?${qs}` : ''}`)
      return res.data
    },
    staleTime: STALE_TIMES.lists,
  })
}
