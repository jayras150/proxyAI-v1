'use client'

// ProxyAI — Admin Models Page (Milestone 3)
// AI model management: list, search, filter, create, edit, enable/disable, archive.

import { useState, useCallback } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import {
  useAdminModels,
  useCreateModel,
  useUpdateModel,
  useToggleModel,
  useArchiveModel,
  type AdminModelItem,
} from '@/hooks/use-admin-models'
import { PageHeader } from '@/components/ui/page-header'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchBox } from '@/components/ui/search-box'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { formatRelativeTime } from '@/lib/format'

const PROVIDERS = ['', 'deepseek', 'openai', 'anthropic', 'google']

export default function AdminModelsPage() {
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursors, setCursors] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editModel, setEditModel] = useState<AdminModelItem | null>(null)
  const [detailModel, setDetailModel] = useState<AdminModelItem | null>(null)
  const [archiveConfirm, setArchiveConfirm] = useState<AdminModelItem | null>(null)

  const { data, isLoading, error } = useAdminModels({
    cursor,
    search: search || undefined,
    provider: providerFilter || undefined,
  })
  const items = data?.items ?? []
  const createMutation = useCreateModel()
  const updateMutation = useUpdateModel()
  const toggleMutation = useToggleModel()
  const archiveMutation = useArchiveModel()

  // Form state
  const [form, setForm] = useState({
    displayName: '',
    provider: 'deepseek',
    modelId: '',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    streaming: true,
    reasoning: true,
    vision: false,
    jsonMode: true,
    toolCalling: false,
    embeddings: false,
    imageGeneration: false,
    enabled: true,
  })

  const resetForm = useCallback(() => {
    setForm({
      displayName: '', provider: 'deepseek', modelId: '', contextWindow: 64000,
      maxOutputTokens: 8192, streaming: true, reasoning: true, vision: false,
      jsonMode: true, toolCalling: false, embeddings: false, imageGeneration: false, enabled: true,
    })
  }, [])

  const handleCreate = useCallback(async () => {
    await createMutation.mutateAsync({
      displayName: form.displayName,
      provider: form.provider,
      modelId: form.modelId,
      contextWindow: form.contextWindow,
      maxOutputTokens: form.maxOutputTokens,
      enabled: form.enabled,
      capabilities: {
        streaming: form.streaming,
        reasoning: form.reasoning,
        vision: form.vision,
        jsonMode: form.jsonMode,
        toolCalling: form.toolCalling,
        embeddings: form.embeddings,
        imageGeneration: form.imageGeneration,
      },
    })
    setCreateOpen(false)
    resetForm()
  }, [form, createMutation, resetForm])

  const handleEdit = useCallback(async () => {
    if (!editModel) return
    await updateMutation.mutateAsync({
      id: editModel.id,
      displayName: form.displayName,
      provider: form.provider,
      modelId: form.modelId,
      contextWindow: form.contextWindow,
      maxOutputTokens: form.maxOutputTokens,
      enabled: form.enabled,
      capabilities: {
        streaming: form.streaming,
        reasoning: form.reasoning,
        vision: form.vision,
        jsonMode: form.jsonMode,
        toolCalling: form.toolCalling,
        embeddings: form.embeddings,
        imageGeneration: form.imageGeneration,
      },
    })
    setEditOpen(false)
    setEditModel(null)
    resetForm()
  }, [editModel, form, updateMutation, resetForm])

  const openEdit = useCallback((model: AdminModelItem) => {
    setEditModel(model)
    const caps = model.capabilities as Record<string, unknown> | null
    setForm({
      displayName: model.display_name,
      provider: model.provider,
      modelId: model.model_id,
      contextWindow: model.context_window,
      maxOutputTokens: model.max_output_tokens ?? 8192,
      streaming: Boolean(caps?.streaming ?? false),
      reasoning: Boolean(caps?.reasoning ?? false),
      vision: Boolean(caps?.vision ?? false),
      jsonMode: Boolean(caps?.jsonMode ?? false),
      toolCalling: Boolean(caps?.toolCalling ?? false),
      embeddings: Boolean(caps?.embeddings ?? false),
      imageGeneration: Boolean(caps?.imageGeneration ?? false),
      enabled: model.enabled,
    })
    setEditOpen(true)
  }, [])

  const handleFilter = useCallback(() => {
    setCursor(null)
    setCursors([])
  }, [])

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

    return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="AI Models" description="Manage AI models and their capabilities." />
          <Button size="sm" onClick={() => { resetForm(); setCreateOpen(true) }}>Add Model</Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <SearchBox value={search} onChange={(v) => { setSearch(v); handleFilter() }} placeholder="Search models..." />
          </div>
          <select value={providerFilter} onChange={(e) => { setProviderFilter(e.target.value); handleFilter() }}
            aria-label="Filter by provider"
            className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">All Providers</option>
            {PROVIDERS.filter(Boolean).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Loading */}
        {isLoading && <div className="space-y-3"><SkeletonCard lines={1} /><SkeletonCard lines={1} /></div>}
        {error && !isLoading && <ErrorState title="Failed to Load Models" error={error} />}
        {!isLoading && !error && items.length === 0 && <EmptyState title="No models found" description="Add your first AI model to get started." />}

        {/* Table */}
        {items.length > 0 && (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Provider</TH>
                    <TH>Model ID</TH>
                    <TH>Context</TH>
                    <TH>Capabilities</TH>
                    <TH>Pricing</TH>
                    <TH>Status</TH>
                    <TH>Updated</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((m) => (
                    <TR key={m.id}>
                      <TD className="font-medium">
                        <button type="button" className="hover:underline text-left" onClick={() => setDetailModel(m)}>
                          {m.display_name}
                        </button>
                      </TD>
                      <TD className="text-zinc-500">{m.provider}</TD>
                      <TD className="font-mono text-xs">{m.model_id}</TD>
                      <TD className="tabular-nums text-zinc-500">{(m.context_window / 1000).toFixed(0)}K</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {Boolean((m.capabilities as Record<string, unknown> | null)?.streaming) && <Badge tone="info">Stream</Badge>}
                          {Boolean((m.capabilities as Record<string, unknown> | null)?.reasoning) && <Badge tone="info">Reason</Badge>}
                          {Boolean((m.capabilities as Record<string, unknown> | null)?.vision) && <Badge tone="info">Vision</Badge>}
                          {Boolean((m.capabilities as Record<string, unknown> | null)?.jsonMode) && <Badge tone="info">JSON</Badge>}
                        </div>
                      </TD>
                      <TD className="tabular-nums text-xs text-zinc-500">
                        {m.pricing_version ? `${m.pricing_version.input_price} / ${m.pricing_version.output_price}` : '—'}
                      </TD>
                      <TD>
                        <Badge tone={m.enabled ? 'success' : 'danger'}>{m.enabled ? 'Active' : 'Disabled'}</Badge>
                      </TD>
                      <TD className="tabular-nums text-xs text-zinc-500">{formatRelativeTime(m.updated_at)}</TD>
                      <TD>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: m.id, enabled: !m.enabled })}>
                            {m.enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setArchiveConfirm(m)}>Archive</Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-zinc-200 md:hidden dark:divide-zinc-800">
              {items.map((m) => (
                <div key={m.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <button type="button" className="font-medium hover:underline" onClick={() => setDetailModel(m)}>{m.display_name}</button>
                    <Badge tone={m.enabled ? 'success' : 'danger'}>{m.enabled ? 'Active' : 'Disabled'}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{m.model_id} · {m.provider}</p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{items.length} model{items.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                {cursors.length > 0 && <Button variant="outline" size="sm" onClick={handlePrev}>Previous</Button>}
                {data?.has_more && <Button variant="outline" size="sm" onClick={handleNext}>Next</Button>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailModel} onClose={() => setDetailModel(null)} title={detailModel?.display_name ?? ''}>
        {detailModel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-zinc-500">Model ID</p><p className="font-mono">{detailModel.model_id}</p></div>
              <div><p className="text-xs text-zinc-500">Provider</p><p>{detailModel.provider}</p></div>
              <div><p className="text-xs text-zinc-500">Context Window</p><p>{detailModel.context_window.toLocaleString()} tokens</p></div>
              <div><p className="text-xs text-zinc-500">Max Output</p><p>{detailModel.max_output_tokens?.toLocaleString() ?? 'Default'} tokens</p></div>
              <div><p className="text-xs text-zinc-500">Status</p><Badge tone={detailModel.enabled ? 'success' : 'danger'}>{detailModel.enabled ? 'Enabled' : 'Disabled'}</Badge></div>
              <div><p className="text-xs text-zinc-500">Created</p><p>{formatRelativeTime(detailModel.created_at)}</p></div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Capabilities</p>
              <div className="flex flex-wrap gap-2">
                {(detailModel.capabilities as Record<string, unknown>)?.streaming ? <Badge tone="success">Streaming</Badge> : <Badge tone="neutral">No Streaming</Badge>}
                {(detailModel.capabilities as Record<string, unknown>)?.reasoning ? <Badge tone="success">Reasoning</Badge> : <Badge tone="neutral">No Reasoning</Badge>}
                {(detailModel.capabilities as Record<string, unknown>)?.vision ? <Badge tone="success">Vision</Badge> : <Badge tone="neutral">No Vision</Badge>}
                {(detailModel.capabilities as Record<string, unknown>)?.jsonMode ? <Badge tone="success">JSON Mode</Badge> : <Badge tone="neutral">No JSON Mode</Badge>}
                {(detailModel.capabilities as Record<string, unknown>)?.toolCalling ? <Badge tone="success">Tool Calling</Badge> : <Badge tone="neutral">No Tool Calling</Badge>}
                {(detailModel.capabilities as Record<string, unknown>)?.embeddings ? <Badge tone="success">Embeddings</Badge> : <Badge tone="neutral">No Embeddings</Badge>}
                {(detailModel.capabilities as Record<string, unknown>)?.imageGeneration ? <Badge tone="success">Image Gen</Badge> : <Badge tone="neutral">No Image Gen</Badge>}
              </div>
            </div>
            {detailModel.pricing_version && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Active Pricing (v{detailModel.pricing_version.version})</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-xs text-zinc-500">Input Price</p><p className="tabular-nums">${detailModel.pricing_version.input_price}/1M</p></div>
                  <div><p className="text-xs text-zinc-500">Output Price</p><p className="tabular-nums">${detailModel.pricing_version.output_price}/1M</p></div>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); resetForm() }} title="Add AI Model">
        {createMutation.isError && <Alert tone="danger">{(createMutation.error as Error).message}</Alert>}
        <div className="space-y-4">
          <ModelFormFields form={form} onChange={setForm as React.Dispatch<React.SetStateAction<Record<string, unknown>>>} providers={PROVIDERS.filter(Boolean)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); resetForm() }}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} isLoading={createMutation.isPending} disabled={!form.displayName || !form.modelId}>Create</Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => { setEditOpen(false); setEditModel(null); resetForm() }} title={`Edit: ${editModel?.display_name ?? ''}`}>
        {updateMutation.isError && <Alert tone="danger">{(updateMutation.error as Error).message}</Alert>}
        <div className="space-y-4">
          <ModelFormFields form={form} onChange={setForm as React.Dispatch<React.SetStateAction<Record<string, unknown>>>} providers={PROVIDERS.filter(Boolean)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditOpen(false); setEditModel(null); resetForm() }}>Cancel</Button>
            <Button size="sm" onClick={handleEdit} isLoading={updateMutation.isPending}>Save</Button>
          </div>
        </div>
      </Dialog>

      {/* Archive Confirm Dialog */}
      <Dialog open={!!archiveConfirm} onClose={() => setArchiveConfirm(null)} title="Archive Model">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Are you sure you want to archive <strong>{archiveConfirm?.display_name}</strong>? 
          This will disable the model and prevent it from being used in new requests.
        </p>
        {archiveMutation.isError && <Alert tone="danger">{(archiveMutation.error as Error).message}</Alert>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setArchiveConfirm(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={async () => { await archiveMutation.mutateAsync(archiveConfirm!.id); setArchiveConfirm(null) }} isLoading={archiveMutation.isPending}>Archive</Button>
        </div>
      </Dialog>
    </AdminShell>
  )
}

// ─── Reusable Form Fields ─────────────────────────────────

function ModelFormFields({
  form,
  onChange,
  providers,
}: {
  form: Record<string, unknown>
  onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  providers: string[]
}) {
  const set = (key: string, value: unknown) => onChange((p: Record<string, unknown>) => ({ ...p, [key]: value }))

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <Input value={String(form.displayName ?? '')} onChange={(e) => set('displayName', e.target.value)} placeholder="DeepSeek V4 Flash" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Provider</label>
          <select value={String(form.provider)} onChange={(e) => set('provider', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Model ID</label>
        <Input value={String(form.modelId ?? '')} onChange={(e) => set('modelId', e.target.value)} placeholder="deepseek-chat" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Context Window</label>
          <Input type="number" value={String(form.contextWindow ?? '')} onChange={(e) => set('contextWindow', parseInt(e.target.value) || 64000)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Output Tokens</label>
          <Input type="number" value={String(form.maxOutputTokens ?? '')} onChange={(e) => set('maxOutputTokens', parseInt(e.target.value) || 8192)} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Capabilities</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {['streaming', 'reasoning', 'vision', 'jsonMode', 'toolCalling', 'embeddings', 'imageGeneration'].map((cap) => (
            <label key={cap} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={Boolean(form[cap])} onChange={(e) => set(cap, e.target.checked)}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700" />
              {cap === 'jsonMode' ? 'JSON Mode' : cap === 'toolCalling' ? 'Tool Calling' : cap === 'imageGeneration' ? 'Image Gen' : cap.charAt(0).toUpperCase() + cap.slice(1)}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={Boolean(form.enabled)} onChange={(e) => set('enabled', e.target.checked)}
          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700" />
        Enabled on creation
      </label>
    </>
  )
}
