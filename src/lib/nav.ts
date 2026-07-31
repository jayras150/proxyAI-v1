// ProxyAI — Navigation configuration (single source of truth)
//
// Design doc §2: 10 top-level items. First five are primary (mobile bottom nav),
// remaining four grouped under "Account" in the drawer/sidebar.

export type IconName =
  | 'home'
  | 'wallet'
  | 'topup'
  | 'usage'
  | 'transactions'
  | 'api-keys'
  | 'models'
  | 'profile'
  | 'security'
  | 'settings'

export interface NavItem {
  href: string
  label: string
  icon: IconName
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'home' },
      { href: '/dashboard/wallet', label: 'Wallet', icon: 'wallet' },
      { href: '/dashboard/topup', label: 'Topup', icon: 'topup' },
      { href: '/dashboard/usage', label: 'Usage', icon: 'usage' },
      { href: '/dashboard/transactions', label: 'Transactions', icon: 'transactions' },
      { href: '/dashboard/api-keys', label: 'API Keys', icon: 'api-keys' },
      { href: '/dashboard/models', label: 'Models', icon: 'models' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/profile', label: 'Profile', icon: 'profile' },
      { href: '/dashboard/security', label: 'Security', icon: 'security' },
      { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

/** Mobile bottom nav — first five items (design doc §2.1). */
export const PRIMARY_NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.slice(0, 5)

/** Exact-match active state: /dashboard must not highlight for /dashboard/wallet. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
