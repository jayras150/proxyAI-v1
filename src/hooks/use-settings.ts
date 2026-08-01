'use client'

// ProxyAI — Settings hook (Milestone 6)
// Read & update user settings (default model, temperature, max tokens, timezone).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'
import { STALE_TIMES } from '@/lib/query-client'

export interface UserSettings {
  defaultModel: string | null
  defaultTemperature: number | null
  defaultMaxTokens: number | null
  timezone: string | null
  language: string | null
}

const SETTINGS_KEYS = ['settings'] as const

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEYS,
    queryFn: async () => {
      const res = await fetch('/api/v1/settings')
      const body = await res.json()
      if (body.success) return body.data as UserSettings
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'FETCH_ERROR',
        message: body.error?.message ?? 'Failed to load settings.',
      })
    },
    staleTime: STALE_TIMES.lists,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<{
      default_model: string | null
      default_temperature: number | null
      default_max_tokens: number | null
      timezone: string | null
      language: string | null
    }>) => {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (body.success) return body.data as UserSettings
      throw new ApiError({
        status: res.status,
        code: body.error?.code ?? 'UPDATE_ERROR',
        message: body.error?.message ?? 'Failed to update settings.',
      })
    },
    // Optimistic: update cache immediately
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_KEYS })
      const previous = queryClient.getQueryData<UserSettings>(SETTINGS_KEYS)
      queryClient.setQueryData<UserSettings>(SETTINGS_KEYS, (old) => {
        if (!old) return old
        return {
          ...old,
          ...(newData.default_model !== undefined && { defaultModel: newData.default_model }),
          ...(newData.default_temperature !== undefined && { defaultTemperature: newData.default_temperature }),
          ...(newData.default_max_tokens !== undefined && { defaultMaxTokens: newData.default_max_tokens }),
          ...(newData.timezone !== undefined && { timezone: newData.timezone }),
          ...(newData.language !== undefined && { language: newData.language }),
        }
      })
      return { previous }
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SETTINGS_KEYS, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS })
    },
  })
}
