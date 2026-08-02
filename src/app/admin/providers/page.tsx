'use client'

// ProxyAI — Admin Providers Page (Milestone 3)
// Provider management: list, enable/disable, configure, test connection.

import { useState, useCallback } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminProviders, useUpdateProvider, useTestProviderConnection, type AdminProviderItem } from '@/hooks/use-admin-providers'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/alert'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'

export default function AdminProvidersPage() {
  const { data, isLoading, error } = useAdminProviders()
  const updateMutation = useUpdateProvider()
  const testMutation = useTestProviderConnection()
  const [detailProvider, setDetailProvider] = useState<AdminProviderItem | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; latency_ms: number; error?: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const providers = data?.items ?? []

  const handleToggle = useCallback(async (name: string, enabled: boolean) => {
    await updateMutation.mutateAsync({ name, enabled })
  }, [updateMutation])

  const handleTest = useCallback(async (name: string) => {
    setTestLoading(true)
    setTestResult(null)
    try {
      const result = await testMutation.mutateAsync(name)
      setTestResult(result)
    } catch {
      setTestResult({ success: false, latency_ms: 0, error: 'Test failed' })
    } finally {
      setTestLoading(false)
    }
  }, [testMutation])

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader title="Providers" description="Configure AI providers and check connection status." />

        {isLoading && <SkeletonCard lines={4} />}
        {error && !isLoading && <ErrorState title="Failed to Load Providers" error={error} />}
        {!isLoading && !error && providers.length === 0 && <EmptyState title="No providers configured" description="Add a provider configuration in system settings." />}

        {providers.map((p) => (
          <Card key={p.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{p.display_name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge tone={p.enabled ? 'success' : 'danger'}>{p.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  <Badge tone={p.api_key_status === 'configured' ? 'success' : p.api_key_status === 'expired' ? 'warning' : 'danger'}>
                    {p.api_key_status === 'configured' ? 'API Key OK' : p.api_key_status === 'expired' ? 'Expired' : 'No Key'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-zinc-500">Base URL</p>
                  <p className="text-sm font-mono truncate">{p.base_url}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Priority</p>
                  <p className="text-sm">{p.priority}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Timeout</p>
                  <p className="text-sm">{(p.timeout_ms / 1000).toFixed(0)}s</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Failover Priority</p>
                  <p className="text-sm">{p.failover_priority}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Retry Count</p>
                  <p className="text-sm">{p.retry_count}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Circuit Breaker</p>
                  <p className="text-sm">{p.circuit_breaker.enabled ? `${p.circuit_breaker.failure_threshold} failures / ${(p.circuit_breaker.recovery_timeout_ms / 1000).toFixed(0)}s recovery` : 'Disabled'}</p>
                </div>
              </div>

              {/* Capabilities */}
              {p.capabilities.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-zinc-500 mb-1">Capabilities</p>
                  <div className="flex flex-wrap gap-1">
                    {p.capabilities.map((c) => <Badge key={c} tone="info">{c}</Badge>)}
                  </div>
                </div>
              )}

              {/* Supported Models */}
              {p.models.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-zinc-500 mb-1">Supported Models</p>
                  <div className="flex flex-wrap gap-1">
                    {p.models.map((m) => <Badge key={m} tone="neutral">{m}</Badge>)}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant={p.enabled ? 'outline' : 'primary'} onClick={() => handleToggle(p.name, !p.enabled)}>
                  {p.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleTest(p.name)} isLoading={testLoading}>
                  Test Connection
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDetailProvider(p)}>Edit</Button>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`mt-3 rounded-lg p-3 text-sm ${testResult.success ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
                  {testResult.success
                    ? `✅ Connected. Latency: ${testResult.latency_ms}ms`
                    : `❌ Failed: ${testResult.error ?? 'Unknown'} (${testResult.latency_ms}ms)`
                  }
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Provider Dialog */}
      <Dialog open={!!detailProvider} onClose={() => setDetailProvider(null)} title={`Edit: ${detailProvider?.display_name ?? ''}`}>
        {detailProvider && <EditProviderForm provider={detailProvider} onSave={async (updates) => {
          await updateMutation.mutateAsync({ name: detailProvider.name, ...updates })
          setDetailProvider(null)
        }} isPending={updateMutation.isPending} error={updateMutation.error} />}
      </Dialog>
    </AdminShell>
  )
}

// ─── Edit Provider Form ────────────────────────────────────

function EditProviderForm({
  provider,
  onSave,
  isPending,
  error,
}: {
  provider: AdminProviderItem
  onSave: (updates: Record<string, unknown>) => Promise<void>
  isPending: boolean
  error: Error | null
}) {
  const [form, setForm] = useState({
    base_url: provider.base_url,
    priority: String(provider.priority),
    timeout_ms: String(provider.timeout_ms),
    retry_count: String(provider.retry_count),
    failover_priority: String(provider.failover_priority),
  })

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error.message}</Alert>}

      <div>
        <label className="block text-sm font-medium mb-1">Base URL</label>
        <Input value={form.base_url} onChange={(e) => setForm((p) => ({ ...p, base_url: e.target.value }))} placeholder="https://api.deepseek.com" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <Input type="number" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Failover Priority</label>
          <Input type="number" value={form.failover_priority} onChange={(e) => setForm((p) => ({ ...p, failover_priority: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Timeout (ms)</label>
          <Input type="number" value={form.timeout_ms} onChange={(e) => setForm((p) => ({ ...p, timeout_ms: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Retry Count</label>
          <Input type="number" value={form.retry_count} onChange={(e) => setForm((p) => ({ ...p, retry_count: e.target.value }))} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => {}}>Cancel</Button>
        <Button size="sm" onClick={() => onSave({
          base_url: form.base_url,
          priority: parseInt(form.priority) || 0,
          timeout_ms: parseInt(form.timeout_ms) || 30000,
          retry_count: parseInt(form.retry_count) || 2,
          failover_priority: parseInt(form.failover_priority) || 0,
        })} isLoading={isPending}>Save</Button>
      </div>
    </div>
  )
}
