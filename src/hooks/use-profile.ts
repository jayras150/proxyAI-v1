'use client'

// ProxyAI — Profile hook (Milestone 6)
// Read & update user profile.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'
import { QUERY_KEYS } from '@/lib/query-client'
import type { UserProfile } from '@/types/auth'

export function useProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: async () => {
      const res = await fetch('/api/auth/me')
      const body = await res.json()
      if (body.success) return body.data as UserProfile
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'FETCH_ERROR',
        message: body.error?.message ?? 'Failed to load profile.',
      })
    },
    staleTime: Infinity, // Profile rarely changes
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name?: string }) => {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (body.success) return body.data as UserProfile
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'UPDATE_ERROR',
        message: body.error?.message ?? 'Failed to update profile.',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: {
      current_password: string
      new_password: string
      confirm_password: string
    }) => {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (body.success) return body.data
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'CHANGE_ERROR',
        message: body.error?.message ?? 'Failed to change password.',
      })
    },
  })
}
