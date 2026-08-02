'use client'

// ProxyAI — Admin Models Hook (Milestone 3)
// AI model CRUD for admin dashboard.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

export interface AdminModelItem {
  id: string
  display_name: string
  provider: string
  model_id: string
  context_window: number
  max_output_tokens: number | null
  enabled: boolean
  capabilities: Record<string, unknown> | null
  default_model: boolean
  pricing_version: {
    id: string
    version: number
    status: string
    input_price: string
    output_price: string
    currency: string
  } | null
  created_at: string
  updated_at: string
}

export interface AdminModelListResponse {
  items: AdminModelItem[]
  next_cursor: string | null
  has_more: boolean
}

const ADMIN_MODELS_KEY = ['admin', 'models'] as const

export function useAdminModels(params: {
  cursor?: string | null
  limit?: number
  search?: string
  provider?: string
  enabled?: boolean
}) {
  const searchParams = new URLSearchParams()
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.search) searchParams.set('search', params.search)
  if (params.provider) searchParams.set('provider', params.provider)
  if (params.enabled !== undefined) searchParams.set('enabled', String(params.enabled))

  return useQuery({
    queryKey: [...ADMIN_MODELS_KEY, params],
    queryFn: async () => {
      const res = await apiFetch<AdminModelListResponse>(`/api/admin/models?${searchParams.toString()}`)
      return res.data
    },
  })
}

export function useAdminModelDetail(id: string | null) {
  return useQuery({
    queryKey: [...ADMIN_MODELS_KEY, 'detail', id],
    queryFn: async () => {
      if (!id) return null
      const res = await apiFetch<AdminModelItem>(`/api/admin/models/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      displayName: string
      provider: string
      modelId: string
      contextWindow: number
      maxOutputTokens?: number
      enabled?: boolean
      capabilities?: {
        streaming?: boolean
        reasoning?: boolean
        vision?: boolean
        jsonMode?: boolean
        toolCalling?: boolean
        embeddings?: boolean
        imageGeneration?: boolean
      }
    }) => {
      const res = await apiFetch<{ id: string }>('/api/admin/models', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_MODELS_KEY })
    },
  })
}

export function useUpdateModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: {
      id: string
      displayName?: string
      provider?: string
      modelId?: string
      contextWindow?: number
      maxOutputTokens?: number
      enabled?: boolean
      capabilities?: {
        streaming?: boolean
        reasoning?: boolean
        vision?: boolean
        jsonMode?: boolean
        toolCalling?: boolean
        embeddings?: boolean
        imageGeneration?: boolean
      }
    }) => {
      const res = await apiFetch<{ id: string }>(`/api/admin/models/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_MODELS_KEY })
    },
  })
}

export function useToggleModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiFetch<{ id: string; enabled: boolean }>(`/api/admin/models/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_MODELS_KEY })
    },
  })
}

export function useArchiveModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch<{ id: string; archived: boolean }>(`/api/admin/models/${id}/archive`, {
        method: 'PATCH',
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_MODELS_KEY })
    },
  })
}
