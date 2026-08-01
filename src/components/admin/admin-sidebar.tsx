'use client'

// ProxyAI — Admin Sidebar (Milestone 1)
// Navigation for admin dashboard. Purpose-built (not reusing user sidebar).

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { hasPermission, type AdminPermission } from '@/lib/admin/permissions'
import type { AdminRole } from '@/lib/admin/permissions'

interface AdminNavItem {
  href: string
  label: string
  icon: string
  permission?: AdminPermission
}

const NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: '◈', permission: 'admin:access' },
  { href: '/admin/users', label: 'Users', icon: '👤', permission: 'admin:users:read' },
  { href: '/admin/wallet', label: 'Wallet', icon: '💰', permission: 'admin:wallet:read' },
  { href: '/admin/refunds', label: 'Refunds', icon: '↩', permission: 'admin:refund:read' },
  { href: '/admin/billing', label: 'Billing', icon: '📊', permission: 'admin:billing:read' },
  { href: '/admin/providers', label: 'Providers', icon: '🔌', permission: 'admin:providers:read' },
  { href: '/admin/pricing', label: 'Pricing', icon: '🏷️', permission: 'admin:pricing:read' },
  { href: '/admin/audit', label: 'Audit', icon: '📋', permission: 'admin:audit:read' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈', permission: 'admin:analytics:read' },
  { href: '/admin/admins', label: 'Admins', icon: '🔐', permission: 'admin:admins:read' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️', permission: 'admin:settings:read' },
]

interface AdminSidebarProps {
  role: string
  onNavigate?: () => void
}

export function AdminSidebar({ role, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(role, item.permission)
  )

  return (
    <nav aria-label="Admin navigation" className="space-y-1">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isActive
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <span aria-hidden="true" className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
