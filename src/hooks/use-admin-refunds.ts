'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'

export interface AdminRefundItem { id: string; user_id: string; usage_log_id: string; amount: string; currency: string; status: string; reason: string | null; requested_by: string | null; approved_by: string | null; created_at: string }

export function useAdminRefunds(filters: { cursor?: string | null; limit?: number; status?: string; search?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.cursor) params.set('cursor', filters.cursor)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  return useQuery({
    queryKey: ['admin', 'refunds', filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/refunds?${params}`)
      const body = await res.json()
      if (body.success) return body.data as { items: AdminRefundItem[]; next_cursor: string | null; has_more: boolean }
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    }, staleTime: 15_000,
  })
}

export function useApproveRefund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/refunds/${id}/approve`, { method: 'POST' })
      const body = await res.json()
      if (body.success) return body.data
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'refunds'] }); qc.invalidateQueries({ queryKey: ['admin', 'summary'] }) },
  })
}

export function useRejectRefund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await fetch(`/api/admin/refunds/${id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const body = await res.json()
      if (body.success) return body.data
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'refunds'] }),
  })
}
