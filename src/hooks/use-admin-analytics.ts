'use client'

// ProxyAI — Admin Analytics Hooks (Milestone 4)
// Business, usage, financial and provider analytics queries.

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'

export interface AnalyticsFilters {
  range?: 'today' | 'yesterday' | '7d' | '30d' | 'custom'
  from?: string | null
  to?: string | null
  provider?: string | null
  model?: string | null
  user?: string | null
}

function buildQueryString(filters: AnalyticsFilters): string {
  const params = new URLSearchParams()
  if (filters.range) params.set('range', filters.range)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.provider) params.set('provider', filters.provider)
  if (filters.model) params.set('model', filters.model)
  if (filters.user) params.set('user', filters.user)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export interface BusinessAnalytics {
  range: { from: string; to: string; label: string }
  revenue: {
    today: string
    yesterday: string
    month: string
    growth_percent: string
  }
  users: { active: number; new: number; returning: number }
  api_requests: { total: number; success: number; error: number; success_rate: string }
  wallet: { topups_count: number; topups_amount: string; refunds_count: number; refunds_amount: string }
  arpu: string
  top_users: Array<{ user_id: string; email: string; requests: number; spend: string }>
  timeline: Array<{ date: string; requests: number; revenue: string }>
}

export interface UsageAnalytics {
  range: { from: string; to: string; label: string }
  totals: {
    requests: number
    prompt_tokens: number
    completion_tokens: number
    cached_tokens: number
    total_tokens: number
    provider_cost: string
    user_cost: string
    avg_latency_ms: number | null
    avg_cost: string
  }
  by_model: Array<{ model: string; requests: number; tokens: number; cost: string; avg_latency_ms: number | null }>
  by_provider: Array<{ provider: string; requests: number; tokens: number; cost: string; success_rate: string }>
  timeline: Array<{ date: string; requests: number; tokens: number; cost: string }>
}

export interface FinancialAnalytics {
  range: { from: string; to: string; label: string }
  wallet_float: string
  negative_balance_users: number
  outstanding_balance: string
  charges: { count: number; amount: string }
  refunds: { count: number; amount: string }
  topups: { count: number; amount: string }
  provider_cost: string
  markup_revenue: string
  net_revenue: string
  profit_estimate: string
}

export interface ProviderAnalyticsRow {
  name: string
  display_name: string
  enabled: boolean
  requests: number
  success_count: number
  failure_count: number
  success_rate: string
  timeout_count: number | null
  retry_count: number | null
  avg_latency_ms: number | null
  tokens: number
  estimated_cost: string
  circuit_breaker: {
    enabled: boolean
    failure_threshold: number
    recovery_timeout_ms: number
    status: 'closed' | 'open' | 'half_open' | 'unknown'
  }
  current_status: 'operational' | 'degraded' | 'down' | 'no_traffic'
  health_timeline: Array<{ date: string; requests: number; success_rate: string }>
}

export interface ProviderAnalytics {
  range: { from: string; to: string; label: string }
  providers: ProviderAnalyticsRow[]
}

export function useAdminAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.adminAnalytics, filters],
    queryFn: async () => {
      const res = await apiFetch<BusinessAnalytics>(`/api/admin/analytics${buildQueryString(filters)}`)
      return res.data
    },
    staleTime: STALE_TIMES.analytics,
  })
}

export function useAdminUsageAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.adminUsageAnalytics, filters],
    queryFn: async () => {
      const res = await apiFetch<UsageAnalytics>(`/api/admin/analytics/usage${buildQueryString(filters)}`)
      return res.data
    },
    staleTime: STALE_TIMES.analytics,
  })
}

export function useAdminFinancial(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.adminFinancial, filters],
    queryFn: async () => {
      const res = await apiFetch<FinancialAnalytics>(`/api/admin/analytics/financial${buildQueryString(filters)}`)
      return res.data
    },
    staleTime: STALE_TIMES.analytics,
  })
}

export function useAdminProviderAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.adminProviderAnalytics, filters],
    queryFn: async () => {
      const res = await apiFetch<ProviderAnalytics>(`/api/admin/providers/analytics${buildQueryString(filters)}`)
      return res.data
    },
    staleTime: STALE_TIMES.analytics,
  })
}
