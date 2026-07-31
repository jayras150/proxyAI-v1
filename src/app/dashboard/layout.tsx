'use client'

// ProxyAI — Dashboard Layout
// Blueprint Reference: Sprint 5 — User Dashboard

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen">
      {/* Dashboard Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold">
            ProxyAI
          </Link>

          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Dashboard
              </Link>
            </nav>
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
