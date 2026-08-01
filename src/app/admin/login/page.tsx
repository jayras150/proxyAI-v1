'use client'

// ProxyAI — Admin Login Page (Milestone 1)
// Email/password → TOTP verification (if enabled) → dashboard.

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

export default function AdminLoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Step 1: Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpToken, setTotpToken] = useState('')

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.data.totp_required) {
          setTotpRequired(true)
        } else {
          queryClient.invalidateQueries({ queryKey: ['admin', 'auth'] })
          router.replace('/admin')
        }
      } else {
        setError(data.error?.message || 'Login failed.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [email, password, router, queryClient])

  const handleTotpVerify = useCallback(async () => {
    if (totpToken.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: totpToken }),
      })
      const data = await res.json()
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'auth'] })
        router.replace('/admin')
      } else {
        setError(data.error?.message || 'Invalid code.')
      }
    } catch {
      setError('Verification failed.')
    } finally {
      setLoading(false)
    }
  }, [totpToken, router, queryClient])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">ProxyAI Admin</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {totpRequired ? 'Enter authentication code' : 'Sign in to admin dashboard'}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {!totpRequired ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Email
                </label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="mt-1"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="mt-1"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && <Alert tone="danger">{error}</Alert>}

              <Button type="submit" className="w-full" isLoading={loading} disabled={!email.trim() || !password}>
                Sign In
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Enter the 6-digit code from your authenticator app for <strong>{email}</strong>.
              </p>

              <div>
                <label htmlFor="admin-totp" className="sr-only">Authentication Code</label>
                <input
                  id="admin-totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={totpToken}
                  onChange={(e) => {
                    setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))
                    setError('')
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && totpToken.length === 6) handleTotpVerify() }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-2xl tracking-widest text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>

              {error && <Alert tone="danger">{error}</Alert>}

              <Button
                type="button"
                className="w-full"
                onClick={handleTotpVerify}
                isLoading={loading}
                disabled={totpToken.length !== 6}
              >
                Verify
              </Button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          <a href="/login" className="hover:text-zinc-700 dark:hover:text-zinc-300">User login</a>
        </p>
      </div>
    </div>
  )
}
