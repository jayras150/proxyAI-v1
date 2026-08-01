'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api-client'

export function useAdminCreditWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { wallet_id: string; amount: string; reason: string; idempotency_key: string }) => {
      const res = await fetch('/api/admin/wallet/credit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (body.success) return body.data
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useAdminDebitWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { wallet_id: string; amount: string; reason: string; idempotency_key: string }) => {
      const res = await fetch('/api/admin/wallet/debit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (body.success) return body.data
      throw new ApiError({ status: res.status, code: body.error?.code ?? 'ERROR', message: body.error?.message ?? '' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}
