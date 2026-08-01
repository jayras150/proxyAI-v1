'use client'

// ProxyAI — Wallet query hook (Milestone 3)
// TanStack Query: key ['wallet'], staleTime wallet (15s).

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-client'
import type { WalletResponse } from '@/types/wallet'

export function useWallet() {
  return useQuery({
    queryKey: QUERY_KEYS.wallet,
    queryFn: async () => {
      const res = await apiFetch<WalletResponse>('/api/v1/wallet')
      return res.data
    },
    staleTime: STALE_TIMES.wallet,
  })
}
