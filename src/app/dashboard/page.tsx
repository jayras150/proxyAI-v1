'use client'

// ProxyAI — Dashboard Home (Milestone 2)
//
// Renders ENTIRELY from ONE query (GET /api/v1/dashboard/summary via
// useDashboardSummary). Widgets are presentational — they never fetch.
// Loading → skeleton; error/offline/429/402/500 → ErrorState + retry;
// wallet PAYMENT_REQUIRED → red banner + AI quick actions disabled.

import { useAuth } from '@/lib/auth-context'
import { useDashboardSummary } from '@/hooks/use-dashboard-summary'
import { ErrorState } from '@/components/error-state'
import { Alert } from '@/components/ui/alert'
import { ButtonLink } from '@/components/ui/button-link'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { WelcomeHeader } from '@/components/dashboard/welcome-header'
import { BalanceWidget } from '@/components/dashboard/balance-widget'
import { TodayUsageWidget } from '@/components/dashboard/today-usage-widget'
import { MonthlySpendingWidget } from '@/components/dashboard/monthly-spending-widget'
import { RecentTransactionsWidget } from '@/components/dashboard/recent-transactions-widget'
import { RecentUsageWidget } from '@/components/dashboard/recent-usage-widget'
import { ApiKeysWidget } from '@/components/dashboard/api-keys-widget'
import { ModelsWidget } from '@/components/dashboard/models-widget'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { SystemStatus } from '@/components/dashboard/system-status'

export default function DashboardHomePage() {
  const { user } = useAuth()
  const summary = useDashboardSummary()

  const displayName =
    user?.name ?? (user?.email ? user.email.split('@')[0] : null) ?? null

  if (summary.isLoading) {
    return <DashboardSkeleton />
  }

  if (summary.isError || !summary.data) {
    return (
      <div className="space-y-6">
        <WelcomeHeader name={displayName} />
        <ErrorState
          title="Could not load your dashboard"
          error={summary.error}
          onRetry={() => void summary.refetch()}
        />
      </div>
    )
  }

  const data = summary.data
  const paymentRequired = data.wallet_status === 'PAYMENT_REQUIRED'

  return (
    <div className="space-y-6">
      <WelcomeHeader name={displayName} />

      {paymentRequired && (
        <Alert tone="danger" title="Payment required" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Your balance is {data.balance.startsWith('-') ? 'negative' : 'low'} — AI requests are
            paused until you top up.
          </p>
          <ButtonLink href="/dashboard/topup" variant="danger" size="sm" className="shrink-0">
            Topup Now
          </ButtonLink>
        </Alert>
      )}

      {/* Stats row: balance + today's usage */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2 xl:col-span-1">
          <BalanceWidget balance={data.balance} currency={data.currency} status={data.wallet_status} />
        </div>
        <div className="md:col-span-2 xl:col-span-3">
          <TodayUsageWidget
            requests={data.requests_today}
            tokens={data.tokens_today}
            cost={data.spend_today}
            currency={data.currency}
          />
        </div>
      </div>

      {/* Middle widgets: monthly spending + keys + models */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MonthlySpendingWidget
          cost={data.spend_month}
          previousCost={data.spend_previous_month}
          currency={data.currency}
        />
        <ApiKeysWidget activeKeys={data.active_keys} />
        <ModelsWidget
          availableModels={data.available_models}
          defaultModel={data.default_model}
          provider={data.provider}
        />
      </div>

      {/* Lists: recent transactions + recent AI usage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentTransactionsWidget transactions={data.latest_transactions} />
        <RecentUsageWidget usage={data.latest_usage} />
      </div>

      {/* Quick actions + system status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickActions paymentRequired={paymentRequired} />
        <SystemStatus provider={data.provider} walletStatus={data.wallet_status} />
      </div>
    </div>
  )
}
