'use client'

// ProxyAI — Dashboard summary query hook (Milestone 2)
// The Dashboard Home renders from EXACTLY ONE query. Widgets are pure
// presentational components fed by this hook's data — they never fetch.
//
// Invalidation contract (design doc §5.2): any mutation that touches
// wallet / usage / transactions / api-keys invalidates those keys; the
// summary key rides along so Home stays consistent (M3+ mutations wire it).

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'
import type { DashboardSummary } from '@/types/dashboard'

export function useDashboardSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.dashboardSummary,
    queryFn: async () => {
      const res = await apiFetch<DashboardSummary>('/api/v1/dashboard/summary')
      return res.data
    },
    staleTime: STALE_TIMES.dashboard,
  })
}
