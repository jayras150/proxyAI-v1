'use client'

// ProxyAI — Dashboard Home
// Blueprint Reference: Sprint 5 — User Dashboard

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ApiKeySection } from '@/components/api-keys-section'

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-6 h-6 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome, {user.name || user.email}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
          {user.email} &middot; {user.role}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Wallet Balance</p>
          <p className="text-2xl font-bold mt-1">$0.00</p>
        </div>
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Active API Keys</p>
          <p className="text-2xl font-bold mt-1">0</p>
        </div>
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Requests Today</p>
          <p className="text-2xl font-bold mt-1">0</p>
        </div>
      </div>

      {/* API Keys */}
      <ApiKeySection />
    </div>
  )
}
