'use client'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'

export interface AuditItem { id: string; admin_id: string; action: string; resource: string; before_value: Record<string, unknown> | null; after_value: Record<string, unknown> | null; status: string; ip_address: string | null; created_at: string }

export function useAdminAudit(filters: { cursor?: string | null; limit?: number; admin_id?: string; action?: string; search?: string; date_from?: string; date_to?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.cursor) params.set('cursor', filters.cursor)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.admin_id) params.set('admin_id', filters.admin_id)
  if (filters.action) params.set('action', filters.action)
  if (filters.search) params.set('search', filters.search)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  return useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit?${params}`)
      const body = await res.json()
      if (body.success) return body.data as { items: AuditItem[]; next_cursor: string | null; has_more: boolean }
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    }, staleTime: 30_000,
  })
}
