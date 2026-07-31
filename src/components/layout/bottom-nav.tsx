'use client'

// ProxyAI — BottomNav (mobile <768px, design doc §2.1)
// First five nav items as a fixed bottom tab bar; "More" opens the drawer.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRIMARY_NAV_ITEMS, isNavItemActive } from '@/lib/nav'
import { Icon } from '@/components/icons'
import { Glyphs } from '@/components/icons'
import { cn } from '@/lib/cn'

export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <ul className="grid grid-cols-6">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item.href, pathname)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                )}
              >
                <Icon name={item.icon} className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={onOpenMore}
            aria-label="Open more menu"
            className="flex w-full flex-col items-center gap-1 py-2 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <Glyphs.Menu className="h-5 w-5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}
