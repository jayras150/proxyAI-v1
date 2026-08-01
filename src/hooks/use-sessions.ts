'use client'

// ProxyAI — Sessions hook (Milestone 6)
// List and revoke active sessions.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-client'

export interface SessionItem {
  id: string
  is_current: boolean
  user_agent: string | null
  ip_address: string | null
  created_at: string
  expires_at: string
}

const SESSION_KEYS = ['sessions'] as const

export function useSessions() {
  return useQuery({
    queryKey: SESSION_KEYS,
    queryFn: async () => {
      const res = await fetch('/api/auth/sessions')
      const body = await res.json()
      if (body.success) return body.data as SessionItem[]
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'FETCH_ERROR',
        message: body.error?.message ?? 'Failed to load sessions.',
      })
    },
    staleTime: STALE_TIMES.lists,
  })
}

export function useRevokeSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/auth/sessions/${sessionId}/revoke`, { method: 'POST' })
      const body = await res.json()
      if (body.success) return body.data
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'REVOKE_ERROR',
        message: body.error?.message ?? 'Failed to revoke session.',
      })
    },
    // Optimistic update
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: SESSION_KEYS })
      const previous = queryClient.getQueryData<SessionItem[]>(SESSION_KEYS)
      queryClient.setQueryData<SessionItem[]>(SESSION_KEYS, (old) =>
        old ? old.filter((s) => s.id !== sessionId) : []
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SESSION_KEYS, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEYS })
    },
  })
}
