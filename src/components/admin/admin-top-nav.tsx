'use client'

// ProxyAI — Admin Top Navigation (Milestone 1)
// Top bar with breadcrumb, user avatar, and logout.

import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { Glyphs } from '@/components/icons'
import { cn } from '@/lib/cn'

const BREADCRUMB_LABELS: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/wallets': 'Wallets',
  '/admin/billing': 'Billing',
  '/admin/providers': 'Providers',
  '/admin/pricing': 'Pricing',
  '/admin/audit': 'Audit',
  '/admin/analytics': 'Analytics',
  '/admin/admins': 'Admins',
  '/admin/settings': 'Settings',
}

interface AdminTopNavProps {
  pathname: string
  userName: string
  userEmail: string
  role: string
  onLogout: () => void
  onOpenMenu: () => void
}

export function AdminTopNav({ pathname, userName, userEmail, role, onLogout, onOpenMenu }: AdminTopNavProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const router = useRouter()

  // Build breadcrumb from path
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: { href: string; label: string }[] = []
  let accumulated = ''
  for (const segment of segments) {
    accumulated += `/${segment}`
    const base = ['admin', 'dashboard'].includes(segment) ? undefined : segment
    const label = BREADCRUMB_LABELS[accumulated] ?? (base ? base.charAt(0).toUpperCase() + base.slice(1).replace(/-/g, ' ') : segment)
    breadcrumbs.push({ href: accumulated, label })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden dark:hover:bg-zinc-800"
        >
          <Glyphs.Menu />
        </button>

        {/* Brand */}
        <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Admin
        </span>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 ml-2">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {index > 0 && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-3.5 w-3.5 text-zinc-400">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
              {index < breadcrumbs.length - 1 ? (
                <button
                  onClick={() => router.push(crumb.href)}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Theme toggle */}
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

          {/* User info */}
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {(userName || userEmail).slice(0, 2).toUpperCase()}
            </span>
            <div className="text-left">
              <p className="text-sm font-medium leading-tight text-zinc-900 dark:text-zinc-100">
                {userName || userEmail}
              </p>
              <p className="text-xs text-zinc-500">{role}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className={cn(
              'rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            )}
          >
            <Glyphs.Logout />
          </button>
        </div>
      </div>
    </header>
  )
}
