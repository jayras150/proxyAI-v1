'use client'

// ProxyAI — Admin Auth hook (Milestone 1)
// Fetches admin profile with permissions and TOTP status.
// Separate from user auth — dedicated endpoint and shape.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'
import type { UserProfile } from '@/types/auth'
import type { AdminPermission } from '@/lib/admin/permissions'

export interface AdminProfile extends UserProfile {
  totp_enabled: boolean
  totp_verified: boolean
  permissions: AdminPermission[]
}

export function useAdminAuth() {
  return useQuery({
    queryKey: ['admin', 'auth'],
    queryFn: async () => {
      const res = await fetch('/api/admin/auth/me')
      if (res.status === 401) {
        // Not authenticated — return null (not an error)
        return null
      }
      const body = await res.json()
      if (body.success) return body.data as AdminProfile
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'FETCH_ERROR',
        message: body.error?.message ?? 'Failed to load admin profile.',
      })
    },
    retry: (failureCount, error) => {
      // Don't retry on 401 (just means not logged in)
      if (error instanceof ApiError && error.status === 401) return false
      return failureCount < 2
    },
    staleTime: 30_000, // 30s
    refetchOnWindowFocus: true,
  })
}

export function useAdminLogout() {
  const queryClient = useQueryClient()

  return async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    queryClient.setQueryData(['admin', 'auth'], null)
    queryClient.clear()
  }
}
