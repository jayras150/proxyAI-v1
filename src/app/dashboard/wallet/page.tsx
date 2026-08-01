'use client'

// ProxyAI — Wallet Page (Milestone 3)
// Displays balance, status banners, topup button, recent balance changes.

import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/use-wallet'
import { useTransactions } from '@/hooks/use-transactions'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { WalletBalanceCard } from '@/components/dashboard/wallet-balance-card'
import { RecentBalanceChanges } from '@/components/dashboard/recent-balance-changes'
import { ErrorState } from '@/components/error-state'

export default function WalletPage() {
  const router = useRouter()
  const { data: wallet, isLoading: walletLoading, error: walletError } = useWallet()
  const { data: txPage, isLoading: txLoading } = useTransactions({ limit: 10 })

  // Handle errors
  if (walletError && !walletLoading) {
    const apiErr = walletError as { status?: number; code?: string; message?: string }
    return (
      <div className="space-y-6">
        <PageHeader title="Wallet" description="Your balance, top-ups and payment status." />
        <ErrorState
          title={
            apiErr.status === 401 ? 'Unauthorized' :
            apiErr.status === 404 ? 'Wallet Not Found' :
            apiErr.status === 429 ? 'Rate Limited' :
            'Failed to Load Wallet'
          }
          error={apiErr}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        description="Your balance, top-ups and payment status."
        actions={
          <Button onClick={() => router.push('/dashboard/topup')}>
            Top Up
          </Button>
        }
      />

      <WalletBalanceCard wallet={wallet} isLoading={walletLoading} />

      <RecentBalanceChanges
        items={txPage?.items}
        isLoading={txLoading}
      />
    </div>
  )
}
