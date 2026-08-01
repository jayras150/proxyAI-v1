'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'

export interface AdminUserItem { id: string; email: string; name: string | null; role: string; status: string; api_keys_count: number; sessions_count: number; created_at: string }
export interface AdminUserDetail { id: string; email: string; name: string | null; role: string; status: string; created_at: string; wallet: { id: string; balance: string; currency: string; status: string } | null; stats: { api_keys_count: number; sessions_count: number; usage_count: number }; recent_usage: Record<string, unknown>[]; recent_transactions: Record<string, unknown>[]; recent_topups: Record<string, unknown>[]; sessions: Record<string, unknown>[]; api_keys: Record<string, unknown>[] }

export function useAdminUsers(filters: { cursor?: string | null; limit?: number; search?: string; role?: string; status?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.cursor) params.set('cursor', filters.cursor)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.search) params.set('search', filters.search)
  if (filters.role) params.set('role', filters.role)
  if (filters.status) params.set('status', filters.status)
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?${params}`)
      const body = await res.json()
      if (body.success) return body.data as { items: AdminUserItem[]; next_cursor: string | null; has_more: boolean }
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    }, staleTime: 30_000,
  })
}

export function useAdminUserDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'users', id], enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${id}`)
      const body = await res.json()
      if (body.success) return body.data as AdminUserDetail
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    },
  })
}

export function useUpdateUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string; status: string; reason?: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      })
      const body = await res.json()
      if (body.success) return body.data
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); qc.invalidateQueries({ queryKey: ['admin', 'summary'] }) },
  })
}
