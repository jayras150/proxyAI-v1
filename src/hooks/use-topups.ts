'use client'

// ProxyAI — Topup hooks (Milestone 3)
// - useTopups: cursor-paginated list
// - useCreateTopup: mutation with optimistic update for PENDING topup
// - useTopupPoll: individual topup status polling (3s interval)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'
import type { TopupPage, TopupItem } from '@/types/wallet'

// ── List topups (cursor pagination) ──────────────────────────────────────

export interface UseTopupsOptions {
  cursor?: string | null
  limit?: number
}

export function useTopups({ cursor, limit }: UseTopupsOptions = {}) {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))

  return useQuery({
    queryKey: [...QUERY_KEYS.topups, cursor, limit],
    queryFn: async () => {
      const qs = params.toString()
      const res = await apiFetch<TopupPage>(`/api/v1/wallet/topups${qs ? `?${qs}` : ''}`)
      return res.data
    },
    staleTime: STALE_TIMES.lists,
  })
}

// ── Create topup mutation ────────────────────────────────────────────────

export interface CreateTopupInput {
  amount: string
  idempotencyKey: string
}

export function useCreateTopup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTopupInput) => {
      const res = await apiFetch<{
        topup: { id: string; status: string; amount: string; currency: string; expires_at: string }
        payment: { provider_reference: string; checkout_url: string | null; token: string | null; expires_at: string }
      }>('/api/v1/wallet/topups', {
        method: 'POST',
        body: { amount: input.amount },
        headers: { 'x-idempotency-key': input.idempotencyKey },
      })
      return res.data
    },
    onSuccess: () => {
      // Invalidate topups list so the new PENDING entry appears.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.topups })
    },
  })
}

// ── Poll single topup status (for payment flow) ──────────────────────────

export function useTopupPoll(topupId: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEYS.topups, 'detail', topupId],
    queryFn: async () => {
      if (!topupId) throw new Error('No topup id')
      const res = await apiFetch<TopupItem>(`/api/v1/wallet/topups/${topupId}`)
      return res.data
    },
    enabled: !!topupId,
    refetchInterval: (query) => {
      const data = query.state.data
      // Stop polling when terminal.
      if (data && (data.status === 'PAID' || data.status === 'FAILED' || data.status === 'EXPIRED')) {
        return false
      }
      return 3000
    },
    staleTime: 0,
  })
}
