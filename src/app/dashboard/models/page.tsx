'use client'

// ProxyAI — Models Page (Milestone 4)
// Available models with capabilities, pricing, and status.
// Renders as responsive cards.

import { useState } from 'react'
import { useModels, type ModelItem } from '@/hooks/use-models'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { ModelDetailDialog } from '@/components/dashboard/model-detail-dialog'
import { formatNumber, formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'

function ModelStatusBadge({ status, enabled }: { status?: string; enabled?: boolean }) {
  const active = status === 'active' || enabled !== false
  if (active) return <Badge tone="success">Active</Badge>
  return <Badge tone="danger">Disabled</Badge>
}

function CapabilityDot({ supported, label }: { supported: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        supported
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
      )}
      aria-label={`${label}: ${supported ? 'supported' : 'not supported'}`}
    >
      {supported ? '✓' : '—'} {label}
    </span>
  )
}

export default function ModelsPage() {
  const { data, isLoading, error } = useModels()
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const models = data?.data ?? []

  const handleCardClick = (model: ModelItem) => {
    setSelectedModel(model)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Models" description="Available models, capabilities and pricing." />

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <ErrorState title="Failed to Load Models" error={error} />
      )}

      {/* Empty */}
      {!isLoading && !error && models.length === 0 && (
        <EmptyState
          title="No models available"
          description="No models are configured yet. Models will appear here once they are added."
        />
      )}

      {/* Model Cards */}
      {!isLoading && !error && models.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => {
            const caps = model.capabilities ?? {}
            return (
              <Card
                key={model.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleCardClick(model)}
                tabIndex={0}
                role="button"
                aria-label={`View model details for ${model.display_name}`}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(model) }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{model.display_name}</CardTitle>
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {model.id}
                      </p>
                    </div>
                    <ModelStatusBadge status={model.status} enabled={model.enabled} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Provider & Context */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">Provider</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{model.owned_by}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">Max Context</span>
                      <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatNumber(model.context_window)} tokens
                      </span>
                    </div>

                    {/* Capabilities */}
                    <div className="flex flex-wrap gap-1.5">
                      <CapabilityDot supported={caps.streaming ?? true} label="Streaming" />
                      <CapabilityDot supported={caps.reasoning ?? false} label="Reasoning" />
                      <CapabilityDot supported={caps.vision ?? false} label="Vision" />
                      <CapabilityDot supported={caps.json_mode ?? true} label="JSON" />
                    </div>

                    {/* Pricing preview */}
                    {model.pricing && (
                      <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          From {formatMoney(model.pricing.input_price, model.pricing.currency)} / 1M input
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Model Detail Dialog */}
      <ModelDetailDialog
        model={selectedModel}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
