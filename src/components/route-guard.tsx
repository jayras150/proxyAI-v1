'use client'

// ProxyAI — RouteGuard (design doc §3, auth guard)
// - isLoading  → full-screen skeleton (no redirect flash).
// - !authed    → redirect /login?next=<current path>, render nothing.
// - authed     → render children.
//
// The API client's global unauthorized handler (expired session mid-use)
// also routes here via AuthContext.logout() + this redirect.

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LoadingSpinner } from '@/components/ui/spinner'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading || isAuthenticated) return
    const next = encodeURIComponent(pathname)
    router.replace(`/login?next=${next}`)
  }, [isLoading, isAuthenticated, pathname, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Checking session">
        <LoadingSpinner label="Checking session" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
