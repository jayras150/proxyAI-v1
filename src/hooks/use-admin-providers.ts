'use client'

// ProxyAI — Admin Providers Hook (Milestone 3)
// Provider management for admin dashboard.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

export interface AdminProviderItem {
  id: string
  name: string
  display_name: string
  enabled: boolean
  priority: number
  base_url: string
  capabilities: string[]
  models: string[]
  api_key_status: 'configured' | 'missing' | 'expired'
  timeout_ms: number
  retry_count: number
  circuit_breaker: {
    enabled: boolean
    failure_threshold: number
    recovery_timeout_ms: number
  }
  failover_priority: number
}

const ADMIN_PROVIDERS_KEY = ['admin', 'providers'] as const

export function useAdminProviders() {
  return useQuery({
    queryKey: ADMIN_PROVIDERS_KEY,
    queryFn: async () => {
      const res = await apiFetch<{ items: AdminProviderItem[] }>('/api/admin/providers')
      return res.data
    },
  })
}

export function useAdminProviderDetail(name: string | null) {
  return useQuery({
    queryKey: [...ADMIN_PROVIDERS_KEY, 'detail', name],
    queryFn: async () => {
      if (!name) return null
      const res = await apiFetch<AdminProviderItem>(`/api/admin/providers/${name}`)
      return res.data
    },
    enabled: !!name,
  })
}

export function useUpdateProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, ...updates }: { name: string; [key: string]: unknown }) => {
      const res = await apiFetch<{ name: string }>(`/api/admin/providers/${name}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_PROVIDERS_KEY })
    },
  })
}

export function useTestProviderConnection() {
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch<{ success: boolean; latency_ms: number; error?: string }>(
        `/api/admin/providers/${name}/test`,
        { method: 'POST' }
      )
      return res.data
    },
  })
}
