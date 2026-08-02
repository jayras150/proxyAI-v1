'use client'

// ProxyAI — Topup Page (Milestone 3)
// Create topup with presets/custom amount, polling status, retry.

import { useState, useCallback, useEffect } from 'react'
import { useWallet } from '@/hooks/use-wallet'
import { useTopups, useCreateTopup, useTopupPoll } from '@/hooks/use-topups'
import { PageHeader } from '@/components/ui/page-header'
import { TopupForm } from '@/components/dashboard/topup-form'
import { TopupPendingList } from '@/components/dashboard/topup-pending-list'
import { Alert } from '@/components/ui/alert'
import { ErrorState } from '@/components/error-state'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-client'

export default function TopupPage() {
  const queryClient = useQueryClient()
  const { data: wallet, isLoading: walletLoading, error: walletError } = useWallet()
  const { data: topupPage, isLoading: topupsLoading, error: topupsError } = useTopups({ limit: 20 })
  const createTopup = useCreateTopup()

  const [createdTopup, setCreatedTopup] = useState<{
    id: string
    payment: { checkout_url: string | null; token: string | null }
  } | null>(null)

  const [formError, setFormError] = useState<string | null>(null)

  // Poll the latest created topup when it's pending (hook stops polling at terminal)
  const pollId = createdTopup?.id ?? null
  const { data: pollData } = useTopupPoll(pollId)
  const isTerminal = !!pollData && (pollData.status === 'PAID' || pollData.status === 'FAILED' || pollData.status === 'EXPIRED')

  // When polling detects terminal status, invalidate (no setState in effect)
  useEffect(() => {
    if (isTerminal) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.wallet })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardSummary })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
    }
  }, [isTerminal, queryClient])

  const handleCreateTopup = useCallback(async (amount: string) => {
    setFormError(null)
    setCreatedTopup(null)
    try {
      const idempotencyKey = `topup_${crypto.randomUUID()}`
      const result = await createTopup.mutateAsync({ amount, idempotencyKey })
      setCreatedTopup({ id: result.topup.id, payment: result.payment })
    } catch (err: unknown) {
      const apiErr = err as { message?: string; code?: string }
      setFormError(apiErr.message ?? 'Failed to create topup.')
    }
  }, [createTopup])

  const handleRetry = useCallback(async (item: { amount: string }) => {
    setFormError(null)
    setCreatedTopup(null)
    await handleCreateTopup(item.amount)
  }, [handleCreateTopup])

  // Error states
  if (walletError && !walletLoading) {
    const apiErr = walletError as { status?: number; message?: string }
    return (
      <div className="space-y-6">
        <PageHeader title="Topup" description="Add credits to your wallet." />
        <ErrorState
          title={
            apiErr.status === 401 ? 'Unauthorized' :
            apiErr.status === 404 ? 'Not Found' :
            'Failed to Load Wallet'
          }
          error={apiErr}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  const currency = wallet?.currency ?? 'USD'

  return (
    <div className="space-y-6">
      <PageHeader title="Topup" description="Add credits to your wallet." />

      <TopupForm
        currency={currency}
        onCreateTopup={handleCreateTopup}
        isCreating={createTopup.isPending}
        error={formError}
        createdTopup={isTerminal ? null : createdTopup}
      />

      {/* Polling status indicator */}
      {!isTerminal && createdTopup && (
        <Alert tone="info" title="Waiting for Payment">
          <p>Your payment is being processed. This page will update automatically when confirmed.</p>
          {pollData && (
            <p className="mt-1 text-xs">
              Status: <span className="font-medium">{pollData.status}</span>
            </p>
          )}
        </Alert>
      )}

      <TopupPendingList
        items={topupPage?.items}
        isLoading={topupsLoading}
        onRetry={handleRetry}
      />

      {topupsError && (
        <ErrorState
          title="Failed to Load Topups"
          error={topupsError as { message?: string }}
          onRetry={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.topups })}
        />
      )}
    </div>
  )
}
