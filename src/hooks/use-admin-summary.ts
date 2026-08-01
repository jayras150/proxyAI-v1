'use client'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'

export interface AdminSummary {
  revenue_today: string; revenue_month: string; revenue_previous_month: string
  wallet_float: string; total_wallet_balance: string; active_users: number
  new_users_today: number; active_api_keys: number; active_models: number
  provider_healthy: boolean; requests_today: number; requests_month: number
  pending_refunds: number; recent_activities: { id: string; type: string; description: string; admin_id: string | null; created_at: string }[]
}

export function useAdminSummary() {
  return useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/summary')
      const body = await res.json()
      if (body.success) return body.data as AdminSummary
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    },
    staleTime: 30_000,
  })
}
