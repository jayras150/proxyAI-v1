'use client'

// ProxyAI — Admin System Hook (Milestone 3)
// System configuration and feature flags for admin dashboard.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

export interface SystemConfig {
  default_provider: string | null
  default_model: string | null
  maintenance_mode: boolean
  registration_open: boolean
  allow_new_api_keys: boolean
  wallet_negative_balance_policy: string
  maximum_negative_balance: string
  rate_limits: Record<string, number>
  streaming_enabled: boolean
  refund_enabled: boolean
  feature_flags: Record<string, boolean>
}

export interface FeatureFlagsResponse {
  flags: Record<string, { enabled: boolean; description: string }>
}

const ADMIN_SYSTEM_KEY = ['admin', 'system'] as const

export function useAdminSystemConfig() {
  return useQuery({
    queryKey: ADMIN_SYSTEM_KEY,
    queryFn: async () => {
      const res = await apiFetch<SystemConfig>('/api/admin/system')
      return res.data
    },
  })
}

export function useSaveSystemConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: Partial<SystemConfig>) => {
      const res = await apiFetch<{ updated: boolean }>('/api/admin/system', {
        method: 'PUT',
        body: JSON.stringify(config),
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_SYSTEM_KEY })
    },
  })
}

export function useResetSystemConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ reset: boolean }>('/api/admin/system/reset', {
        method: 'POST',
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_SYSTEM_KEY })
    },
  })
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: [...ADMIN_SYSTEM_KEY, 'feature-flags'],
    queryFn: async () => {
      const res = await apiFetch<FeatureFlagsResponse>('/api/admin/feature-flags')
      return res.data
    },
  })
}

export function useToggleFeatureFlag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      const res = await apiFetch<{ name: string; enabled: boolean }>(`/api/admin/feature-flags/${name}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...ADMIN_SYSTEM_KEY, 'feature-flags'] })
    },
  })
}
