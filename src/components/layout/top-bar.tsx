'use client'

// ProxyAI — TopBar (all breakpoints, design doc §2.1)
// Brand · system status dot (M2 wires real /v1/health) · theme toggle ·
// avatar → user menu (Profile/Security/Settings/Logout).

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme'
import { DropdownMenu } from '@/components/ui/dropdown'
import { Glyphs } from '@/components/icons'
import { cn } from '@/lib/cn'

function initials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email
  return source.slice(0, 2).toUpperCase()
}

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, logout } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  const userMenuItems = [
    { label: 'Profile', onSelect: () => router.push('/dashboard/profile') },
    { label: 'Security', onSelect: () => router.push('/dashboard/security') },
    { label: 'Settings', onSelect: () => router.push('/dashboard/settings') },
    { label: 'Logout', onSelect: handleLogout, destructive: true, icon: <Glyphs.Logout /> },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden dark:hover:bg-zinc-800"
        >
          <Glyphs.Menu />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            ProxyAI
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <span
            role="status"
            aria-label="System status"
            title="System status"
            className="hidden items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 sm:flex dark:border-zinc-800 dark:text-zinc-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Operational
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            className={cn(
              'rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            )}
          >
            {resolvedTheme === 'dark' ? <Glyphs.Sun /> : <Glyphs.Moon />}
          </button>

          {user && (
            <DropdownMenu
              triggerLabel="User menu"
              items={userMenuItems}
              trigger={
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white"
                >
                  {initials(user.name, user.email)}
                </span>
              }
            />
          )}
        </div>
      </div>
    </header>
  )
}
