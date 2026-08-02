'use client'

// ProxyAI — Admin Pricing Hook (Milestone 3)
// Pricing version management for admin dashboard.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'

export interface AdminPricingItem {
  id: string
  model_id: string
  model_name: string
  provider: string
  version: number
  input_price: string
  output_price: string
  markup_percent: string
  service_fee: string
  currency: string
  effective_from: string
  effective_to: string | null
  status: string
  created_at: string
}

export interface AdminPricingListResponse {
  items: AdminPricingItem[]
  next_cursor: string | null
  has_more: boolean
}

const ADMIN_PRICING_KEY = ['admin', 'pricing'] as const

export function useAdminPricing(params: {
  cursor?: string | null
  limit?: number
  model_id?: string
  status?: string
}) {
  const searchParams = new URLSearchParams()
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.model_id) searchParams.set('model_id', params.model_id)
  if (params.status) searchParams.set('status', params.status)

  return useQuery({
    queryKey: [...ADMIN_PRICING_KEY, params],
    queryFn: async () => {
      const res = await apiFetch<AdminPricingListResponse>(`/api/admin/pricing?${searchParams.toString()}`)
      return res.data
    },
  })
}

export function usePricingHistory(modelId: string | null) {
  return useQuery({
    queryKey: [...ADMIN_PRICING_KEY, 'history', modelId],
    queryFn: async () => {
      if (!modelId) return { items: [] }
      const res = await apiFetch<{ items: AdminPricingItem[] }>(`/api/admin/pricing/history?model_id=${modelId}`)
      return res.data
    },
    enabled: !!modelId,
  })
}

export function usePricingCompare(a: string | null, b: string | null) {
  return useQuery({
    queryKey: [...ADMIN_PRICING_KEY, 'compare', a, b],
    queryFn: async () => {
      if (!a || !b) return null
      const res = await apiFetch<Record<string, unknown>>(`/api/admin/pricing/compare?a=${a}&b=${b}`)
      return res.data
    },
    enabled: !!a && !!b,
  })
}

export function useCreatePricingVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      model_id: string
      input_price: string
      output_price: string
      markup_percent?: string
      service_fee?: string
      currency?: string
      effective_from: string
      effective_to?: string | null
    }) => {
      const res = await apiFetch<{ id: string; version: number; status: string }>('/api/admin/pricing', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_PRICING_KEY })
    },
  })
}

export function useActivatePricingVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch<{ id: string; status: string }>(`/api/admin/pricing/${id}/activate`, {
        method: 'POST',
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_PRICING_KEY })
    },
  })
}

export function useArchivePricingVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch<{ id: string; status: string }>(`/api/admin/pricing/${id}/archive`, {
        method: 'POST',
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_PRICING_KEY })
    },
  })
}
