'use client'

// ProxyAI — Quick Actions (Milestone 2)
// Topup (always active), Create API Key, Documentation, Playground (future).
//
// PAYMENT_REQUIRED UX: the only useful action while the wallet is in arrears
// is a top-up, so the AI-facing actions (Create API Key, Playground) are
// disabled; Topup stays active and is highlighted. Design doc §7.1.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button-link'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/cn'

export interface QuickActionsProps {
  /** Wallet is PAYMENT_REQUIRED → AI-facing actions disabled. */
  paymentRequired: boolean
}

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.proxyai.live'

export function QuickActions({ paymentRequired }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Shortcuts for common tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3" role="group" aria-label="Quick actions">
          <ButtonLink
            href="/dashboard/topup"
            variant={paymentRequired ? 'danger' : 'primary'}
            className={cn(paymentRequired && 'animate-pulse motion-reduce:animate-none')}
          >
            <Icon name="topup" className="h-4 w-4" />
            Topup
          </ButtonLink>

          <ButtonLink
            href="/dashboard/api-keys"
            variant="outline"
            disabled={paymentRequired}
            title={
              paymentRequired
                ? 'Top up your wallet before creating API keys'
                : 'Create a new API key'
            }
          >
            <Icon name="api-keys" className="h-4 w-4" />
            Create API Key
          </ButtonLink>

          <ButtonLink href={DOCS_URL} variant="outline" target="_blank" rel="noopener noreferrer">
            <Icon name="models" className="h-4 w-4" />
            Documentation
          </ButtonLink>

          <ButtonLink href="/dashboard" variant="ghost" disabled title="Coming soon">
            <Icon name="usage" className="h-4 w-4" />
            Playground
            <span className="text-xs opacity-70">Coming soon</span>
          </ButtonLink>
        </div>
        {paymentRequired && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400" role="status">
            Top up your wallet to re-enable AI actions.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
