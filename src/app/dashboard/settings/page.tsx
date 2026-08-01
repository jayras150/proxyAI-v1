'use client'

// ProxyAI — Settings Page (Milestone 6)
// Theme, default model/temperature/max tokens, timezone, danger zone.

import { useState, useCallback } from 'react'
import { useSettings, useUpdateSettings } from '@/hooks/use-settings'
import { useModels } from '@/hooks/use-models'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { useTheme, type Theme } from '@/lib/theme'

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const TIMEZONE_OPTIONS = [
  { value: '', label: 'Browser default' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT+8)' },
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (GMT+7)' },
  { value: 'America/New_York', label: 'America/New York (GMT-5)' },
  { value: 'America/Chicago', label: 'America/Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'America/Denver (GMT-7)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (GMT-8)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (GMT+8)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (GMT+10)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (GMT+12)' },
  { value: 'UTC', label: 'UTC' },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { data: settings, isLoading, error } = useSettings()
  const { data: modelsData } = useModels()
  const updateSettingsMutation = useUpdateSettings()

  const models = modelsData?.data ?? []
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Local state for model settings
  const [defaultModel, setDefaultModel] = useState<string>('')
  const [defaultTemperature, setDefaultTemperature] = useState<string>('')
  const [defaultMaxTokens, setDefaultMaxTokens] = useState<string>('')
  const [timezone, setTimezone] = useState<string>('')
  const [initialized, setInitialized] = useState(false)

  // Sync settings on load
  if (settings && !initialized) {
    setDefaultModel(settings.defaultModel ?? '')
    setDefaultTemperature(settings.defaultTemperature != null ? String(settings.defaultTemperature) : '')
    setDefaultMaxTokens(settings.defaultMaxTokens != null ? String(settings.defaultMaxTokens) : '')
    setTimezone(settings.timezone ?? '')
    setInitialized(true)
  }

  const hasModelChanges =
    defaultModel !== (settings?.defaultModel ?? '') ||
    defaultTemperature !== (settings?.defaultTemperature != null ? String(settings.defaultTemperature) : '') ||
    defaultMaxTokens !== (settings?.defaultMaxTokens != null ? String(settings.defaultMaxTokens) : '')

  const handleSaveModelSettings = useCallback(async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      await updateSettingsMutation.mutateAsync({
        default_model: defaultModel || null,
        default_temperature: defaultTemperature ? Number(defaultTemperature) : null,
        default_max_tokens: defaultMaxTokens ? Number(defaultMaxTokens) : null,
        timezone: timezone || null,
      })
      setSaveSuccess(true)
    } catch {
      // Error shown
    } finally {
      setSaving(false)
    }
  }, [defaultModel, defaultTemperature, defaultMaxTokens, timezone, updateSettingsMutation])

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [setTheme])

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Theme, defaults and preferences." />

      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      )}

      {error && !isLoading && (
        <ErrorState title="Failed to Load Settings" error={error} />
      )}

      {/* ─── Theme ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleThemeChange(opt.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  theme === opt.value
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
                aria-pressed={theme === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Model Defaults ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Model Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="default-model" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Default Model
            </label>
            <select
              id="default-model"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">No default (use dashboard default)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name} ({m.id})</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="default-temperature" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Default Temperature (0–2)
              </label>
              <Input
                id="default-temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={defaultTemperature}
                onChange={(e) => setDefaultTemperature(e.target.value)}
                placeholder="e.g. 0.7"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="default-max-tokens" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Default Max Tokens
              </label>
              <Input
                id="default-max-tokens"
                type="number"
                min="1"
                step="1"
                value={defaultMaxTokens}
                onChange={(e) => setDefaultMaxTokens(e.target.value)}
                placeholder="e.g. 4096"
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSaveModelSettings} isLoading={saving} disabled={!hasModelChanges}>
              Save
            </Button>
          </div>

          {saveSuccess && (
            <Alert tone="success">Settings saved.</Alert>
          )}

          {updateSettingsMutation.isError && (
            <Alert tone="danger">
              {(updateSettingsMutation.error as Error)?.message ?? 'Failed to save settings.'}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ─── Regional ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Regional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Timezone
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Language
            </label>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Language selection coming soon.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Danger Zone ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Delete Account</p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <div className="mt-3">
              <Button variant="outline" size="sm" disabled className="border-red-300 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400">
                Delete Account
              </Button>
            </div>
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              Coming soon. Contact support to delete your account.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
