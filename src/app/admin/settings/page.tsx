'use client'

// ProxyAI — Admin Settings Page (Milestone 3)
// System configuration and feature flags management.

import { useState, useCallback } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminSystemConfig, useSaveSystemConfig, useResetSystemConfig, useFeatureFlags, useToggleFeatureFlag, type SystemConfig } from '@/hooks/use-admin-system'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'

export default function AdminSettingsPage() {
  const { data: config, isLoading, error } = useAdminSystemConfig()
  const { data: featureFlagsData } = useFeatureFlags()
  const saveMutation = useSaveSystemConfig()
  const resetMutation = useResetSystemConfig()
  const toggleFlagMutation = useToggleFeatureFlag()
  const [resetConfirm, setResetConfirm] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const flags = featureFlagsData?.flags ?? {}

  // Local form state
  const [form, setForm] = useState<Partial<SystemConfig> | null>(null)
  const effectiveConfig = form ?? config

  const handleChange = useCallback(<K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    setForm((prev) => ({ ...(prev ?? config ?? {}), [key]: value } as Partial<SystemConfig>))
  }, [config])

  const handleSave = useCallback(async () => {
    if (!form || !config) return
    setSaved('saving')
    try {
      await saveMutation.mutateAsync(form)
      setForm(null)
      setSaved('saved')
      setTimeout(() => setSaved('idle'), 3000)
    } catch {
      setSaved('error')
    }
  }, [form, config, saveMutation])

  if (isLoading) return <AdminShell><SkeletonCard lines={8} /></AdminShell>
  if (error) return <AdminShell><ErrorState title="Failed to Load Settings" error={error} /></AdminShell>
  if (!config) return null

  const hasChanges = form !== null

  return (
    <AdminShell>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <PageHeader title="Settings" description="System-wide configuration and feature flags." />
          <div className="flex gap-2">
            {saved === 'saved' && <span className="text-sm text-emerald-600">Saved ✓</span>}
            {hasChanges && (
              <>
                <Button variant="outline" size="sm" onClick={() => setForm(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} isLoading={saved === 'saving'}>Save Changes</Button>
              </>
            )}
          </div>
        </div>

        {/* General Configuration */}
        <Card>
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Default Provider</label>
                <Input value={effectiveConfig?.default_provider ?? ''} onChange={(e) => handleChange('default_provider', e.target.value || null)} placeholder="deepseek" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default Model</label>
                <Input value={effectiveConfig?.default_model ?? ''} onChange={(e) => handleChange('default_model', e.target.value || null)} placeholder="Model ID" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operational Controls */}
        <Card>
          <CardHeader><CardTitle>Operations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={Boolean(effectiveConfig?.maintenance_mode)} onChange={(e) => handleChange('maintenance_mode', e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700" />
                Maintenance Mode
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={Boolean(effectiveConfig?.registration_open)} onChange={(e) => handleChange('registration_open', e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700" />
                Allow Registration
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={Boolean(effectiveConfig?.allow_new_api_keys)} onChange={(e) => handleChange('allow_new_api_keys', e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700" />
                Allow New API Keys
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={Boolean(effectiveConfig?.streaming_enabled)} onChange={(e) => handleChange('streaming_enabled', e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700" />
                Streaming Enabled
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={Boolean(effectiveConfig?.refund_enabled)} onChange={(e) => handleChange('refund_enabled', e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700" />
                Refund Enabled
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Wallet */}
        <Card>
          <CardHeader><CardTitle>Wallet & Billing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Negative Balance Policy</label>
                <select value={String(effectiveConfig?.wallet_negative_balance_policy ?? 'controlled')} onChange={(e) => handleChange('wallet_negative_balance_policy', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="controlled">Controlled (Allowed up to max)</option>
                  <option value="block">Block (No negative balance)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Maximum Negative Balance</label>
                <Input value={String(effectiveConfig?.maximum_negative_balance ?? '0.10')} onChange={(e) => handleChange('maximum_negative_balance', e.target.value)} placeholder="0.10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card>
          <CardHeader><CardTitle>Rate Limits (requests/min)</CardTitle></CardHeader>
          <CardContent>
            {effectiveConfig?.rate_limits && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(effectiveConfig.rate_limits).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-1 capitalize">{key.replace(/_/g, ' ')}</label>
                    <Input type="number" value={String(value)} onChange={(e) => {
                      const rl = { ...(effectiveConfig?.rate_limits ?? {}), [key]: parseInt(e.target.value) || 60 }
                      handleChange('rate_limits', rl)
                    }} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Feature Flags</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(flags).length === 0 ? (
              <p className="text-sm text-zinc-500">No feature flags configured.</p>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {Object.entries(flags).map(([name, meta]) => (
                  <div key={name} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium capitalize">{name.replace(/_/g, ' ')}</p>
                      {meta.description && <p className="text-xs text-zinc-500">{meta.description}</p>}
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" checked={meta.enabled} onChange={() => toggleFlagMutation.mutate({ name, enabled: !meta.enabled })}
                        className="peer sr-only" aria-label={`Toggle ${name}`} />
                      <div className="h-6 w-11 rounded-full bg-zinc-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 dark:bg-zinc-600" />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card>
          <CardHeader><CardTitle>Danger Zone</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500 mb-3">Reset all system configuration to defaults. This cannot be undone.</p>
            <Button variant="danger" size="sm" onClick={() => setResetConfirm(true)}>Reset Configuration</Button>
          </CardContent>
        </Card>
      </div>

      {/* Reset Confirm Dialog */}
      <Dialog open={resetConfirm} onClose={() => setResetConfirm(false)} title="Reset Configuration">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Are you sure you want to reset all system configuration to defaults?
          This will clear all system settings and feature flags.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setResetConfirm(false)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={async () => {
            await resetMutation.mutateAsync()
            setResetConfirm(false)
            setForm(null)
          }} isLoading={resetMutation.isPending}>Reset</Button>
        </div>
      </Dialog>
    </AdminShell>
  )
}
