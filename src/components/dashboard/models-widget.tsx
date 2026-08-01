'use client'

// ProxyAI — Models Widget (Milestone 2)
// Available model count, default model and provider status.

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/format'

export interface ModelsWidgetProps {
  availableModels: number
  defaultModel: string | null
  provider: { id: string; healthy: boolean }
}

export function ModelsWidget({ availableModels, defaultModel, provider }: ModelsWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Models</CardTitle>
        <CardDescription>Available to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
          {formatNumber(availableModels)}{' '}
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
            {availableModels === 1 ? 'model' : 'models'}
          </span>
        </p>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Default model</dt>
            <dd className="font-mono text-zinc-900 dark:text-zinc-100">
              {defaultModel ?? <span className="text-zinc-400 dark:text-zinc-500">Not set</span>}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Provider</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono text-zinc-900 dark:text-zinc-100">{provider.id}</span>
              <Badge tone={provider.healthy ? 'success' : 'danger'}>
                {provider.healthy ? 'Operational' : 'Degraded'}
              </Badge>
            </dd>
          </div>
        </dl>
        <Link
          href="/dashboard/models"
          className="inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Browse models
        </Link>
      </CardContent>
    </Card>
  )
}
