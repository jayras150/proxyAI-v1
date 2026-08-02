'use client'

// ProxyAI — Admin Pricing Page (Milestone 3)
// Pricing version management: list, create, activate, archive, compare.

import { useState, useCallback } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import {
  useAdminPricing,
  useCreatePricingVersion,
  useActivatePricingVersion,
  useArchivePricingVersion,
  usePricingHistory,
  usePricingCompare,
} from '@/hooks/use-admin-pricing'
import { PageHeader } from '@/components/ui/page-header'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/alert'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { formatMoney } from '@/lib/format'

const STATUS_TONE: Record<string, 'success' | 'neutral' | 'warning'> = {
  ACTIVE: 'success',
  ARCHIVED: 'neutral',
}

export default function AdminPricingPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursors, setCursors] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [historyModelId, setHistoryModelId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<{ a: string | null; b: string | null }>({ a: null, b: null })
  const [compareOpen, setCompareOpen] = useState(false)

  const { data, isLoading, error } = useAdminPricing({
    cursor,
    status: statusFilter || undefined,
  })
  const items = data?.items ?? []
  const createMutation = useCreatePricingVersion()
  const activateMutation = useActivatePricingVersion()
  const archiveMutation = useArchivePricingVersion()
  const { data: history } = usePricingHistory(historyModelId)
  const { data: comparison } = usePricingCompare(compareIds.a, compareIds.b)

  // Form state
  const [form, setForm] = useState({
    model_id: '',
    input_price: '',
    output_price: '',
    markup_percent: '0',
    service_fee: '0',
    currency: 'USD',
    effective_from: new Date().toISOString().slice(0, 16),
    effective_to: '',
  })

  const handlePrev = useCallback(() => {
    const prev: string | null = cursors.length >= 2 ? cursors[cursors.length - 2]! : null
    setCursors(cursors.slice(0, -1))
    setCursor(prev)
  }, [cursors])

  const handleNext = useCallback(() => {
    if (data?.next_cursor) {
      setCursors([...cursors, data.next_cursor])
      setCursor(data.next_cursor)
    }
  }, [data?.next_cursor, cursors])

  const handleCreate = useCallback(async () => {
    await createMutation.mutateAsync({
      model_id: form.model_id,
      input_price: form.input_price,
      output_price: form.output_price,
      markup_percent: form.markup_percent,
      service_fee: form.service_fee,
      currency: form.currency,
      effective_from: new Date(form.effective_from).toISOString(),
      effective_to: form.effective_to ? new Date(form.effective_to).toISOString() : null,
    })
    setCreateOpen(false)
    setForm({ model_id: '', input_price: '', output_price: '', markup_percent: '0', service_fee: '0', currency: 'USD', effective_from: new Date().toISOString().slice(0, 16), effective_to: '' })
  }, [form, createMutation])

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="Pricing Versions" description="Manage model pricing and service fees." />
          <Button size="sm" onClick={() => setCreateOpen(true)}>New Version</Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCursor(null); setCursors([]) }}
            aria-label="Filter by status"
            className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Compare shortcut */}
          {items.length >= 2 && (
            <Button variant="outline" size="sm" onClick={() => {
              setCompareIds({ a: items[0].id, b: items[1].id })
              setCompareOpen(true)
            }}>
              Compare Top 2
            </Button>
          )}
        </div>

        {/* Loading */}
        {isLoading && <SkeletonCard lines={3} />}
        {error && !isLoading && <ErrorState title="Failed to Load Pricing" error={error} />}
        {!isLoading && !error && items.length === 0 && <EmptyState title="No pricing versions" description="Create a pricing version for a model." />}

        {/* Table */}
        {items.length > 0 && (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Model</TH>
                  <TH>Version</TH>
                  <TH>Input Price</TH>
                  <TH>Output Price</TH>
                  <TH>Markup</TH>
                  <TH>Fee</TH>
                  <TH>Effective</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {items.map((v) => (
                  <TR key={v.id}>
                    <TD>
                      <button type="button" className="font-medium hover:underline text-left" onClick={() => setHistoryModelId(v.model_id)}>
                        {v.model_name}
                      </button>
                    </TD>
                    <TD className="tabular-nums">v{v.version}</TD>
                    <TD className="tabular-nums">${v.input_price}</TD>
                    <TD className="tabular-nums">${v.output_price}</TD>
                    <TD className="tabular-nums">{v.markup_percent}%</TD>
                    <TD className="tabular-nums">{formatMoney(v.service_fee, v.currency)}</TD>
                    <TD className="text-xs text-zinc-500">{new Date(v.effective_from).toLocaleDateString()}</TD>
                    <TD><Badge tone={STATUS_TONE[v.status] ?? 'neutral'}>{v.status}</Badge></TD>
                    <TD>
                      <div className="flex gap-1">
                        {v.status === 'ACTIVE' && (
                          <Button variant="ghost" size="sm" onClick={() => archiveMutation.mutate(v.id)}>Archive</Button>
                        )}
                        {v.status === 'ARCHIVED' && (
                          <Button variant="ghost" size="sm" onClick={() => activateMutation.mutate(v.id)}>Activate</Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => { setCompareIds({ a: v.id, b: null }); setCompareOpen(true) }}>Compare</Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{items.length} version{items.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                {cursors.length > 0 && <Button variant="outline" size="sm" onClick={handlePrev}>Previous</Button>}
                {data?.has_more && <Button variant="outline" size="sm" onClick={handleNext}>Next</Button>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* History Dialog */}
      <Dialog open={!!historyModelId} onClose={() => setHistoryModelId(null)} title="Pricing History">
        {history ? (
          <div className="space-y-3">
            {history.items.length === 0 && <p className="text-sm text-zinc-500">No history available.</p>}
            {history.items.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <div>
                  <p className="font-medium">v{v.version}</p>
                  <p className="text-xs text-zinc-500">${v.input_price} / ${v.output_price} · {v.markup_percent}% markup</p>
                </div>
                <div className="text-right">
                  <Badge tone={v.status === 'ACTIVE' ? 'success' : 'neutral'}>{v.status}</Badge>
                  <p className="text-xs text-zinc-500 mt-1">{new Date(v.effective_from).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <SkeletonCard lines={3} />}
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={compareOpen} onClose={() => setCompareOpen(false)} title="Version Compare">
        <div className="space-y-4">
          {/* Version A selector */}
          <div>
            <label className="block text-sm font-medium mb-1">Version A</label>
            <select value={compareIds.a ?? ''} onChange={(e) => setCompareIds((p) => ({ ...p, a: e.target.value || null }))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">Select...</option>
              {items.map((v) => <option key={v.id} value={v.id}>v{v.version} - {v.model_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Version B</label>
            <select value={compareIds.b ?? ''} onChange={(e) => setCompareIds((p) => ({ ...p, b: e.target.value || null }))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">Select...</option>
              {items.map((v) => <option key={v.id} value={v.id}>v{v.version} - {v.model_name}</option>)}
            </select>
          </div>

          {comparison ? (
            <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-200 dark:border-zinc-800 dark:divide-zinc-800">
              <div className="grid grid-cols-3 gap-4 p-4 text-sm font-medium bg-zinc-50 dark:bg-zinc-900">
                <span>Field</span><span>Version A</span><span>Version B</span>
              </div>
              {['input_price', 'output_price', 'markup_percent', 'service_fee', 'currency', 'effective_from', 'status'].map((field) => (
                <div key={field} className="grid grid-cols-3 gap-4 p-3 text-sm">
                  <span className="text-zinc-500">{field.replace(/_/g, ' ')}</span>
                  <span className="tabular-nums">{String((comparison.version_a as Record<string, unknown>)?.[field] ?? '—')}</span>
                  <span className="tabular-nums">{String((comparison.version_b as Record<string, unknown>)?.[field] ?? '—')}</span>
                </div>
              ))}
              <div className="p-3 text-sm text-zinc-500">
                Model: {String(comparison.model_name)} ({String(comparison.provider)})
              </div>
            </div>
          ) : compareIds.a && compareIds.b ? (
            <p className="text-sm text-zinc-500">Select both versions to compare.</p>
          ) : null}
        </div>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New Pricing Version">
        {createMutation.isError && <Alert tone="danger">{(createMutation.error as Error).message}</Alert>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Model ID</label>
            <Input value={form.model_id} onChange={(e) => setForm((p) => ({ ...p, model_id: e.target.value }))} placeholder="Model UUID" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Input Price (per 1M)</label>
              <Input type="text" placeholder="0.15" value={form.input_price} onChange={(e) => setForm((p) => ({ ...p, input_price: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Output Price (per 1M)</label>
              <Input type="text" placeholder="0.60" value={form.output_price} onChange={(e) => setForm((p) => ({ ...p, output_price: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Markup %</label>
              <Input type="text" placeholder="0" value={form.markup_percent} onChange={(e) => setForm((p) => ({ ...p, markup_percent: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Service Fee</label>
              <Input type="text" placeholder="0" value={form.service_fee} onChange={(e) => setForm((p) => ({ ...p, service_fee: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
              <option value="SGD">SGD</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Effective From</label>
              <Input type="datetime-local" value={form.effective_from} onChange={(e) => setForm((p) => ({ ...p, effective_from: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Effective Until (optional)</label>
              <Input type="datetime-local" value={form.effective_to} onChange={(e) => setForm((p) => ({ ...p, effective_to: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} isLoading={createMutation.isPending} disabled={!form.model_id || !form.input_price || !form.output_price}>Create</Button>
          </div>
        </div>
      </Dialog>
    </AdminShell>
  )
}
