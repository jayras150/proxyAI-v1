'use client'

// ProxyAI — Profile Page (Milestone 6)
// Display name, email, joined date, avatar placeholder.

import { useState, useCallback } from 'react'
import { useProfile, useUpdateProfile } from '@/hooks/use-profile'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { Alert } from '@/components/ui/alert'
import { formatDateTime } from '@/lib/format'

export default function ProfilePage() {
  const { data: profile, isLoading, error, refetch } = useProfile()
  const updateMutation = useUpdateProfile()

  // Use the name from profile on first load, then track via dirty detection
  const [name, setName] = useState(profile?.name ?? '')
  const [dirty, setDirty] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = useCallback((value: string) => {
    setName(value)
    setDirty(value !== (profile?.name ?? ''))
    setSuccess(false)
  }, [profile?.name])

  const handleSave = useCallback(async () => {
    if (!dirty) return
    try {
      await updateMutation.mutateAsync({ name: name || undefined })
      setDirty(false)
      setSuccess(true)
    } catch {
      // Error shown by mutation
    }
  }, [dirty, name, updateMutation])

  const handleCancel = useCallback(() => {
    setName(profile?.name ?? '')
    setDirty(false)
    setSuccess(false)
  }, [profile?.name])

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account information." />

      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
        </div>
      )}

      {error && !isLoading && (
        <ErrorState title="Failed to Load Profile" error={error} onRetry={() => refetch()} />
      )}

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                {(profile.name || profile.email).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{profile.name || 'No name set'}</p>
                <p className="text-sm text-zinc-500">{profile.email}</p>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Display Name
              </label>
              <Input
                id="display-name"
                type="text"
                value={name}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Your name"
                className="mt-1"
              />
              {dirty && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  You have unsaved changes.
                </p>
              )}
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">Email</label>
              <p className="mt-1 text-zinc-900 dark:text-zinc-100">{profile.email}</p>
            </div>

            {/* Joined */}
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">Joined</label>
              <p className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDateTime(profile.createdAt)}</p>
            </div>

            {/* Save/Cancel */}
            {dirty && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} isLoading={updateMutation.isPending} disabled={!dirty}>
                  Save Changes
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
                  Cancel
                </Button>
              </div>
            )}

            {success && (
              <Alert tone="success">Profile updated successfully.</Alert>
            )}

            {updateMutation.isError && (
              <Alert tone="danger">
                {(updateMutation.error as Error)?.message ?? 'Failed to update profile.'}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
