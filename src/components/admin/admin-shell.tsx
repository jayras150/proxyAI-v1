'use client'

// ProxyAI — Admin Shell (Milestone 1)
// Admin layout with sidebar, top nav, and content area.
// Auth guard with RBAC and TOTP verification check.

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AdminTopNav } from '@/components/admin/admin-top-nav'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { ErrorState } from '@/components/error-state'
import { SkeletonCard } from '@/components/ui/skeleton'

interface AdminShellProps {
  children: React.ReactNode
}

export function AdminShell({ children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { data: admin, isLoading, error } = useAdminAuth()

  useEffect(() => {
    if (!isLoading && !error && !admin) {
      router.replace('/admin/login')
    }
  }, [isLoading, error, admin, router])

  // TOTP check
  const needsTotp = admin && admin.totp_enabled && !admin.totp_verified

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-3">
          <SkeletonCard lines={3} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <ErrorState title="Authentication Error" error={error} />
      </div>
    )
  }

  if (!admin) return null

  if (needsTotp) {
    // Render TOTP verification inline
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <TotpVerification
          email={admin.email}
          onVerified={() => router.refresh()}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminTopNav
        pathname={pathname}
        userName={admin.name ?? ''}
        userEmail={admin.email}
        role={admin.role}
        onLogout={async () => {
          await fetch('/api/admin/auth/logout', { method: 'POST' })
          router.replace('/admin/login')
        }}
        onOpenMenu={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-zinc-200 p-4 lg:block dark:border-zinc-800">
          <AdminSidebar role={admin.role} />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative w-64 bg-white p-4 shadow-lg dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Admin</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>
              <AdminSidebar role={admin.role} onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

// ─── Inline TOTP Verification ─────────────────────────────────

function TotpVerification({
  email,
  onVerified,
}: {
  email: string
  onVerified: () => void
}) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    if (token.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (data.success) {
        onVerified()
      } else {
        setError(data.error?.message || 'Invalid code.')
      }
    } catch {
      setError('Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Two-Factor Authentication</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Enter the 6-digit code from your authenticator app for <strong>{email}</strong>.
      </p>

      <div className="mt-4">
        <label htmlFor="totp-token" className="sr-only">TOTP Code</label>
        <input
          id="totp-token"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={token}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6)
            setToken(cleaned)
            setError('')
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && token.length === 6) handleVerify() }}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-2xl tracking-widest text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          autoFocus
          autoComplete="one-time-code"
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleVerify}
        disabled={token.length !== 6 || loading}
        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? 'Verifying...' : 'Verify'}
      </button>
    </div>
  )
}
