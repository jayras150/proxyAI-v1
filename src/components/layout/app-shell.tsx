'use client'

// ProxyAI — AppShell (dashboard layout, design doc §2/§3)
// RouteGuard → TopBar + Sidebar (desktop) + BottomNav (mobile) + MoreDrawer.
// Content area: max-width container with bottom padding for the mobile bar.
//
// The API client's unauthorized handler is wired here so an expired session
// (401 mid-use) signs the user out and redirects to /login.

import { useEffect, useState } from 'react'
import { setUnauthorizedHandler } from '@/lib/api-client'
import { RouteGuard } from '@/components/route-guard'
import { TopBar } from '@/components/layout/top-bar'
import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { MoreDrawer } from '@/components/layout/more-drawer'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout()
      router.replace('/login')
    })
    return () => setUnauthorizedHandler(null)
  }, [logout, router])

  return (
    <RouteGuard>
      <div className="min-h-screen">
        <TopBar onOpenMenu={() => setDrawerOpen(true)} />
        <div className="mx-auto flex max-w-[1400px]">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
        <BottomNav onOpenMore={() => setDrawerOpen(true)} />
        <MoreDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    </RouteGuard>
  )
}
