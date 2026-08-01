'use client'

// ProxyAI — System Status Widget (Milestone 2)
// Provider / API / Wallet status. Never color-only: each row pairs the
// status dot with a text label (a11y: color-blind safe).

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WalletStatus } from '@/types/dashboard'

export interface SystemStatusProps {
  provider: { id: string; healthy: boolean }
  walletStatus: WalletStatus
}

const WALLET_LABELS: Record<WalletStatus, string> = {
  ACTIVE: 'Active',
  LOCKED: 'Locked',
  SUSPENDED: 'Suspended',
  PAYMENT_REQUIRED: 'Payment required',
}

export function SystemStatus({ provider, walletStatus }: SystemStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
        <CardDescription>Live health of the platform</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm">
          <li className="flex items-center justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Provider</span>
            <Badge tone={provider.healthy ? 'success' : 'danger'}>
              {provider.healthy ? 'Operational' : 'Degraded'}
            </Badge>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">API</span>
            <Badge tone="success">Operational</Badge>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Wallet</span>
            <Badge
              tone={
                walletStatus === 'ACTIVE'
                  ? 'success'
                  : walletStatus === 'LOCKED'
                    ? 'warning'
                    : 'danger'
              }
            >
              {WALLET_LABELS[walletStatus] ?? walletStatus}
            </Badge>
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}
