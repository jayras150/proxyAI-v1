'use client'

// ProxyAI — API Keys Widget (Milestone 2)
// Active key count + quick "Manage API Keys" entry point.

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ButtonLink } from '@/components/ui/button-link'
import { formatNumber } from '@/lib/format'

export interface ApiKeysWidgetProps {
  activeKeys: number
}

export function ApiKeysWidget({ activeKeys }: ApiKeysWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>Keys for programmatic access</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeKeys === 0 ? (
          <EmptyState
            title="No API keys yet"
            description="Create your first key to start building."
            action={
              <ButtonLink href="/dashboard/api-keys" variant="outline" size="sm">
                Create API Key
              </ButtonLink>
            }
          />
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatNumber(activeKeys)}{' '}
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                active {activeKeys === 1 ? 'key' : 'keys'}
              </span>
            </p>
            <ButtonLink href="/dashboard/api-keys" variant="outline" size="sm">
              Manage API Keys
            </ButtonLink>
          </>
        )}
      </CardContent>
    </Card>
  )
}
