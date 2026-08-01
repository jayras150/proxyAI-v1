'use client'

// ProxyAI — Security Page (Milestone 6)
// Change password with strength meter, session management.

import { useState, useCallback } from 'react'
import { useChangePassword } from '@/hooks/use-profile'
import { useSessions, useRevokeSession } from '@/hooks/use-sessions'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { Alert } from '@/components/ui/alert'
import { formatRelativeTime } from '@/lib/format'
import { useAuth } from '@/lib/auth-context'

// ─── Password strength meter ────────────────────────────────────

type Strength = 'weak' | 'fair' | 'strong' | 'very-strong'

function evaluateStrength(password: string): { strength: Strength; score: number; label: string } {
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 2) return { strength: 'weak', score, label: 'Weak' }
  if (score <= 3) return { strength: 'fair', score, label: 'Fair' }
  if (score <= 5) return { strength: 'strong', score, label: 'Strong' }
  return { strength: 'very-strong', score, label: 'Very Strong' }
}

const STRENGTH_COLORS: Record<Strength, string> = {
  weak: 'bg-red-500',
  fair: 'bg-amber-500',
  strong: 'bg-emerald-500',
  'very-strong': 'bg-emerald-600',
}

const STRENGTH_TEXT_COLORS: Record<Strength, string> = {
  weak: 'text-red-600 dark:text-red-400',
  fair: 'text-amber-600 dark:text-amber-400',
  strong: 'text-emerald-600 dark:text-emerald-400',
  'very-strong': 'text-emerald-700 dark:text-emerald-300',
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null
  const { strength, score, label } = evaluateStrength(password)
  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < score ? STRENGTH_COLORS[strength] : 'bg-zinc-200 dark:bg-zinc-700'}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${STRENGTH_TEXT_COLORS[strength]}`}>{label}</p>
    </div>
  )
}

// ─── Password validation helpers ────────────────────────────────

function getPasswordErrors(password: string): string[] {
  const errors: string[] = []
  if (password.length > 0 && password.length < 8) errors.push('At least 8 characters')
  if (password.length > 0 && !/[A-Z]/.test(password)) errors.push('At least one uppercase letter')
  if (password.length > 0 && !/[a-z]/.test(password)) errors.push('At least one lowercase letter')
  if (password.length > 0 && !/[0-9]/.test(password)) errors.push('At least one number')
  if (password.length > 0 && !/[^A-Za-z0-9]/.test(password)) errors.push('At least one special character')
  return errors
}

// ─── Security Page ──────────────────────────────────────────────

export default function SecurityPage() {
  const { logoutAll } = useAuth()

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const changePasswordMutation = useChangePassword()

  // Sessions
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useSessions()
  const revokeMutation = useRevokeSession()

  const passwordMatch = confirmPassword.length === 0 || newPassword === confirmPassword
  const passwordSameAsOld = newPassword.length > 0 && currentPassword.length > 0 && currentPassword === newPassword
  const passwordErrors = getPasswordErrors(newPassword)

  const canSubmitPassword =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    passwordMatch &&
    passwordErrors.length === 0 &&
    !passwordSameAsOld

  const handleChangePassword = useCallback(async () => {
    if (!canSubmitPassword) return
    setPasswordSuccess(false)
    try {
      await changePasswordMutation.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
    } catch {
      // Error shown by mutation
    }
  }, [canSubmitPassword, currentPassword, newPassword, confirmPassword, changePasswordMutation])

  const handleLogoutAll = useCallback(async () => {
    await logoutAll()
  }, [logoutAll])

  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Password and session management." />

      {/* ─── Change Password ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Current Password
            </label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setPasswordSuccess(false) }}
              placeholder="Enter current password"
              className="mt-1"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              New Password
            </label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordSuccess(false) }}
              placeholder="Enter new password"
              className="mt-1"
              autoComplete="new-password"
              invalid={newPassword.length > 0 && passwordErrors.length > 0}
            />
            <PasswordStrengthMeter password={newPassword} />
            {newPassword.length > 0 && passwordErrors.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {passwordErrors.map((err) => (
                  <li key={err} className="text-xs text-red-600 dark:text-red-400">{err}</li>
                ))}
              </ul>
            )}
            {passwordSameAsOld && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                New password must be different from current password.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Confirm New Password
            </label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSuccess(false) }}
              placeholder="Confirm new password"
              className="mt-1"
              autoComplete="new-password"
              invalid={confirmPassword.length > 0 && !passwordMatch}
            />
            {confirmPassword.length > 0 && !passwordMatch && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">Passwords do not match.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleChangePassword}
              isLoading={changePasswordMutation.isPending}
              disabled={!canSubmitPassword}
            >
              Update Password
            </Button>
          </div>

          {passwordSuccess && (
            <Alert tone="success">Password updated successfully.</Alert>
          )}

          {changePasswordMutation.isError && (
            <Alert tone="danger">
              {(changePasswordMutation.error as Error)?.message ?? 'Failed to change password.'}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ─── Active Sessions ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Sessions</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleLogoutAll} className="text-red-600 hover:text-red-700 dark:text-red-400">
              Logout All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading */}
          {sessionsLoading && (
            <div className="space-y-2">
              <SkeletonCard lines={1} />
              <SkeletonCard lines={1} />
            </div>
          )}

          {/* Error */}
          {sessionsError && !sessionsLoading && (
            <ErrorState title="Failed to Load Sessions" error={sessionsError} />
          )}

          {/* Empty */}
          {!sessionsLoading && !sessionsError && (!sessions || sessions.length === 0) && (
            <EmptyState title="No sessions" description="No active sessions found." />
          )}

          {/* Session list */}
          {!sessionsLoading && !sessionsError && sessions && sessions.length > 0 && (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {session.user_agent
                          ? parseBrowser(session.user_agent)
                          : 'Unknown browser'}
                      </span>
                      {session.is_current && <Badge tone="primary">Current</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      {session.ip_address && <span>IP: {session.ip_address}</span>}
                      {session.user_agent && <span className="truncate max-w-[200px]">{session.user_agent}</span>}
                      <span>Active {formatRelativeTime(session.created_at)}</span>
                    </div>
                  </div>
                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeMutation.mutate(session.id)}
                      isLoading={revokeMutation.isPending}
                      className="shrink-0 text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Extract browser name from user agent string (simple parse). */
function parseBrowser(ua: string): string {
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/')) return 'Safari'
  if (ua.includes('Edge/')) return 'Edge'
  return 'Browser'
}
