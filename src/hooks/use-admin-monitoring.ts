'use client'

// ProxyAI — Admin Monitoring Hooks (Milestone 4)
// System monitoring + system health queries with auto-refresh support.

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'

export interface ComponentStatus {
  name: string
  status: 'ok' | 'degraded' | 'down' | 'not_configured'
  latency_ms: number | null
  detail: string
}

export interface SystemMonitoring {
  status: 'ok' | 'degraded' | 'down'
  uptime_seconds: number
  environment: string
  version: string
  build_info: {
    node: string
    platform: string
    arch: string
  }
  components: ComponentStatus[]
  requests_per_sec: number
  avg_response_time_ms: number | null
  success_rate: string
  error_rate: string
  checked_at: string
}

export function useAdminMonitoring(refreshIntervalMs?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.adminMonitoring,
    queryFn: async () => {
      const res = await apiFetch<SystemMonitoring>('/api/admin/monitoring')
      return res.data
    },
    staleTime: STALE_TIMES.monitoring,
    refetchInterval: refreshIntervalMs,
  })
}

/**
 * System health alias — shares the monitoring endpoint but has its own
 * query key so health-only consumers can refresh independently.
 */
export function useAdminSystemHealth(refreshIntervalMs?: number) {
  return useQuery({
    queryKey: QUERY_KEYS.adminSystemHealth,
    queryFn: async () => {
      const res = await apiFetch<SystemMonitoring>('/api/admin/monitoring')
      return res.data
    },
    staleTime: STALE_TIMES.monitoring,
    refetchInterval: refreshIntervalMs,
  })
}
