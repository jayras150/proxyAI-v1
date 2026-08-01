'use client'

// ProxyAI — Models hook (Milestone 4)
// Lists available models with capabilities, pricing, and status.

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'

export interface ModelCapabilities {
  streaming?: boolean
  reasoning?: boolean
  vision?: boolean
  json_mode?: boolean
  [key: string]: unknown
}

export interface ModelPricing {
  input_price: string
  output_price: string
  markup_percent: string
  service_fee: string
  currency: string
}

export interface ModelItem {
  id: string
  object: string
  created: number
  owned_by: string
  display_name: string
  context_window: number
  capabilities?: ModelCapabilities
  pricing?: ModelPricing
  enabled?: boolean
}

export interface ModelsResponse {
  object: string
  data: ModelItem[]
}

export function useModels() {
  return useQuery({
    queryKey: QUERY_KEYS.models,
    queryFn: async () => {
      const res = await apiFetch<ModelsResponse>('/api/v1/models')
      return res.data
    },
    staleTime: STALE_TIMES.models,
  })
}
