'use client'

// ProxyAI — Wallet Balance Card (Milestone 3)
// Shows current balance, wallet status, currency, and status banners.

import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/lib/format'
import type { WalletResponse } from '@/types/wallet'

interface WalletBalanceCardProps {
  wallet: WalletResponse | undefined
  isLoading: boolean
}

const STATUS_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  PAYMENT_REQUIRED: { label: 'Payment Required', tone: 'warning' },
  LOCKED: { label: 'Locked', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
}

export function WalletBalanceCard({ wallet, isLoading }: WalletBalanceCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-16" />
        </CardContent>
      </Card>
    )
  }

  if (!wallet) return null

  const statusInfo = STATUS_LABELS[wallet.status] ?? { label: wallet.status, tone: 'info' as const }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Current Balance</p>
              <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {formatMoney(wallet.balance, wallet.currency)}
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500">{wallet.currency}</p>
            </div>
            <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Status Banners */}
      {wallet.status === 'PAYMENT_REQUIRED' && (
        <Alert tone="warning" title="Payment Required">
          Your balance is negative. Please top up to continue using AI services.
        </Alert>
      )}
      {wallet.status === 'LOCKED' && (
        <Alert tone="danger" title="Wallet Locked">
          Your wallet has been locked. Please contact support for assistance.
        </Alert>
      )}
      {wallet.status === 'SUSPENDED' && (
        <Alert tone="danger" title="Wallet Suspended">
          Your wallet has been suspended. Please contact support for assistance.
        </Alert>
      )}
    </div>
  )
}
