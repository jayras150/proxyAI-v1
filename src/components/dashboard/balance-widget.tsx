'use client'

// ProxyAI — Balance Widget (Milestone 2)
// Current balance + wallet status + currency, with the wallet status
// banners (PAYMENT_REQUIRED / LOCKED / SUSPENDED — design doc §7.1: the
// payment-required state is the single most important state in the app).

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { ButtonLink } from '@/components/ui/button-link'
import { formatMoney } from '@/lib/format'
import type { WalletStatus } from '@/types/dashboard'

export interface BalanceWidgetProps {
  balance: string
  currency: string
  status: WalletStatus
}

const STATUS_META: Record<WalletStatus, { label: string; tone: 'neutral' | 'warning' | 'danger' | 'success' }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  LOCKED: { label: 'Locked', tone: 'warning' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  PAYMENT_REQUIRED: { label: 'Payment required', tone: 'danger' },
}

export function BalanceWidget({ balance, currency, status }: BalanceWidgetProps) {
  const meta = STATUS_META[status] ?? STATUS_META.ACTIVE
  const negative = Number(balance) < 0

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Current balance</p>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>

        <p
          className={`text-3xl font-bold tabular-nums tracking-tight ${
            negative
              ? 'text-red-600 dark:text-red-400'
              : 'text-zinc-900 dark:text-zinc-100'
          }`}
        >
          {formatMoney(balance, currency)}
        </p>
        <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {currency}
        </p>

        {status === 'PAYMENT_REQUIRED' && (
          <Alert tone="danger" title="Your wallet needs a top-up" className="space-y-3">
            <p className="text-sm">
              AI requests are paused until your balance is back above zero.
            </p>
            <ButtonLink href="/dashboard/topup" variant="danger" size="sm" className="w-full">
              Topup Now
            </ButtonLink>
          </Alert>
        )}

        {status === 'LOCKED' && (
          <Alert tone="warning" title="Wallet locked">
            <p className="text-sm">Your wallet is locked. Contact support to unlock it.</p>
          </Alert>
        )}

        {status === 'SUSPENDED' && (
          <Alert tone="danger" title="Wallet suspended">
            <p className="text-sm">Your wallet is suspended. Contact support to resolve this.</p>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
