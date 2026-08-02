'use client'

// ProxyAI — Model Detail Dialog (Milestone 4)
// Read-only dialog with full model information.

import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatNumber } from '@/lib/format'
import type { ModelItem } from '@/hooks/use-models'

interface ModelDetailDialogProps {
  model: ModelItem | null
  open: boolean
  onClose: () => void
}

function renderModelStatus(status?: string): React.ReactNode {
  if (!status) return <Badge tone="neutral">Unknown</Badge>
  if (status === 'active') return <Badge tone="success">Active</Badge>
  if (status === 'disabled') return <Badge tone="danger">Disabled</Badge>
  return <Badge tone="neutral">{status}</Badge>
}

function renderCapability(value: unknown): React.ReactNode {
  if (typeof value === 'boolean') {
    return value
      ? <span className="text-emerald-600 dark:text-emerald-400">✓</span>
      : <span className="text-zinc-400 dark:text-zinc-600">—</span>
  }
  return <span className="text-zinc-700 dark:text-zinc-300">{String(value)}</span>
}

export function ModelDetailDialog({ model, open, onClose }: ModelDetailDialogProps) {
  if (!model) return null

  const caps = model.capabilities ?? {}

  return (
    <Dialog open={open} onClose={onClose} title={model.display_name} description={model.id}>
      <div className="space-y-4">
        {/* Model Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Model ID</p>
            <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{model.id}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</p>
            <div>{renderModelStatus(model.enabled ? 'active' : 'disabled')}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Provider</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{model.owned_by}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Max Context</p>
            <p className="tabular-nums text-sm text-zinc-700 dark:text-zinc-300">
              {formatNumber(model.context_window)} tokens
            </p>
          </div>
        </div>

        {/* Capabilities */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Capabilities
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Streaming</span>
              {renderCapability(caps.streaming)}
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Reasoning</span>
              {renderCapability(caps.reasoning)}
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Vision</span>
              {renderCapability(caps.vision)}
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">JSON Mode</span>
              {renderCapability(caps.json_mode)}
            </div>
          </div>
        </div>

        {/* Pricing */}
        {model.pricing && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Pricing ({model.pricing.currency})
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Input Price (per 1M tokens)</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatMoney(model.pricing.input_price, model.pricing.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Output Price (per 1M tokens)</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatMoney(model.pricing.output_price, model.pricing.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Markup</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {model.pricing.markup_percent}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Service Fee</span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatMoney(model.pricing.service_fee, model.pricing.currency)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
