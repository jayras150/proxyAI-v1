'use client'

// ProxyAI — API Keys hook (Milestone 5)
// List, create, revoke, and rotate API keys.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'

export interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  status: string
  lastUsedAt: string | null
  createdAt: string
}

export interface CreatedApiKeyResponse extends ApiKeyItem {
  fullKey: string
}

// The existing list endpoint returns ApiKeyItem[] directly (not wrapped in envelope shape)
// because it's under /api/api-keys (legacy), not /api/v1/. We handle both shapes.

export function useApiKeys() {
  return useQuery({
    queryKey: QUERY_KEYS.apiKeys,
    queryFn: async () => {
      const res = await fetch('/api/api-keys')
      const body = await res.json()
      // The legacy endpoint returns { success: true, data: [...] }
      if (body.success) return body.data as ApiKeyItem[]
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'FETCH_ERROR',
        message: body.error?.message ?? 'Failed to load API keys.',
      })
    },
    staleTime: STALE_TIMES.lists,
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const body = await res.json()
      if (body.success) return body.data as CreatedApiKeyResponse
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'CREATE_ERROR',
        message: body.error?.message ?? 'Failed to create API key.',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.apiKeys })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardSummary })
    },
  })
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (keyId: string) => {
      const res = await fetch(`/api/api-keys/${keyId}`, { method: 'DELETE' })
      const body = await res.json()
      if (body.success) return body.data
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'REVOKE_ERROR',
        message: body.error?.message ?? 'Failed to revoke API key.',
      })
    },
    // Optimistic update: remove from cache immediately
    onMutate: async (keyId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.apiKeys })
      const previous = queryClient.getQueryData<ApiKeyItem[]>(QUERY_KEYS.apiKeys)
      queryClient.setQueryData<ApiKeyItem[]>(QUERY_KEYS.apiKeys, (old) =>
        old ? old.filter((k) => k.id !== keyId) : []
      )
      return { previous }
    },
    onError: (_err, _keyId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEYS.apiKeys, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.apiKeys })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardSummary })
    },
  })
}

export function useRotateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (keyId: string) => {
      const res = await fetch(`/api/api-keys/${keyId}?action=rotate`, { method: 'POST' })
      const body = await res.json()
      if (body.success) return body.data as CreatedApiKeyResponse
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'ROTATE_ERROR',
        message: body.error?.message ?? 'Failed to rotate API key.',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.apiKeys })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardSummary })
    },
  })
}
