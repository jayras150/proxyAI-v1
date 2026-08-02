'use client'

// ProxyAI — Analytics Tabs (Milestone 4)
// Sub-navigation between business / usage / financial / provider analytics.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const TABS = [
  { href: '/admin/analytics', label: 'Business' },
  { href: '/admin/analytics/usage', label: 'Usage' },
  { href: '/admin/analytics/financial', label: 'Financial' },
  { href: '/admin/analytics/providers', label: 'Providers' },
] as const

export function AnalyticsTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Analytics sections" className="flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isActive
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
