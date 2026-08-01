// ProxyAI — TanStack Query client factory
//
// Single source of truth for query defaults:
// - Retry policy aligned with the API client (retry transient 5xx/network only).
// - Stale times per domain (wallet is fresher than models).
// - Query keys are centralized here as constants (see design doc §5.2).

import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'

export const STALE_TIMES = {
  wallet: 15_000,
  dashboard: 15_000,
  lists: 30_000,
  models: 5 * 60_000,
  health: 60_000,
} as const

export const QUERY_KEYS = {
  wallet: ['wallet'] as const,
  dashboardSummary: ['dashboard', 'summary'] as const,
  transactions: ['transactions'] as const,
  usage: ['usage'] as const,
  topups: ['topups'] as const,
  apiKeys: ['api-keys'] as const,
  models: ['models'] as const,
  providers: ['providers'] as const,
  health: ['health'] as const,
  me: ['me'] as const,
} as const

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIMES.lists,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.status >= 500 || error.status === 0) return failureCount < 2
            return false
          }
          return failureCount < 2
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 500) return failureCount < 1
          return false
        },
      },
    },
  })
}
