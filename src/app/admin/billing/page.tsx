'use client'

// ProxyAI — Admin Billing Page (Milestone 3)
// Billing overview: pricing summary, cost calculator preview.

import { useState } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminModels } from '@/hooks/use-admin-models'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/format'

export default function AdminBillingPage() {
  const { data: modelsData, isLoading, error } = useAdminModels({ enabled: true })

  const models = modelsData?.items?.filter((m) => m.pricing_version) ?? []

  // Cost calculator
  const [calcModel, setCalcModel] = useState<string>('')
  const [promptTokens, setPromptTokens] = useState('1000')
  const [completionTokens, setCompletionTokens] = useState('500')

  const selectedModel = models.find((m) => m.id === calcModel)
  const pricing = selectedModel?.pricing_version

  const calculateCost = () => {
    if (!pricing) return null
    const input = parseFloat(pricing.input_price) * parseInt(promptTokens || '0') / 1_000_000
    const output = parseFloat(pricing.output_price) * parseInt(completionTokens || '0') / 1_000_000
    const total = input + output
    return { input, output, total, currency: pricing.currency }
  }

  const cost = calculateCost()

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Billing</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">AI billing and pricing overview.</p>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Models with Pricing</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold tabular-nums">{models.length}</p></CardContent>
          </Card>
        </div>

        {/* Cost Calculator */}
        <Card>
          <CardHeader><CardTitle>Cost Calculator</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <select value={calcModel} onChange={(e) => setCalcModel(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="">Select a model...</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} (${m.pricing_version!.input_price}/1M in · ${m.pricing_version!.output_price}/1M out)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Prompt Tokens</label>
                <Input type="number" min="0" value={promptTokens} onChange={(e) => setPromptTokens(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Completion Tokens</label>
                <Input type="number" min="0" value={completionTokens} onChange={(e) => setCompletionTokens(e.target.value)} />
              </div>
            </div>

            {cost && pricing && (
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h3 className="text-sm font-semibold mb-3">Cost Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Input Cost</span>
                    <span className="tabular-nums">{formatMoney(cost.input.toFixed(6), cost.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Output Cost</span>
                    <span className="tabular-nums">{formatMoney(cost.output.toFixed(6), cost.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total (no markup/fee in calc)</span>
                    <span className="tabular-nums">{formatMoney(cost.total.toFixed(6), cost.currency)}</span>
                  </div>
                  <hr className="border-zinc-200 dark:border-zinc-800" />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMoney(cost.total.toFixed(6), cost.currency)}</span>
                  </div>
                </div>
              </div>
            )}

            {!calcModel && <p className="text-sm text-zinc-500">Select a model to see cost estimates.</p>}
          </CardContent>
        </Card>

        {/* Models with pricing */}
        {models.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Pricing Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {models.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{m.display_name}</p>
                      <p className="text-xs text-zinc-500">{m.model_id}</p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="text-xs text-zinc-500">
                        ${m.pricing_version!.input_price} in / ${m.pricing_version!.output_price} out
                      </p>
                      {false && <p className="text-xs text-zinc-400">markup</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  )
}
