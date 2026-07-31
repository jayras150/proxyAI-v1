// @vitest-environment jsdom
// ProxyAI — Sidebar navigation tests (active state + hrefs)

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/layout/sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mocks = vi.hoisted(() => ({ pathname: '/dashboard' }))

describe('Sidebar navigation', () => {
  it('marks /dashboard as active only on the exact home path', () => {
    mocks.pathname = '/dashboard'
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Wallet' })).not.toHaveAttribute('aria-current')
  })

  it('marks a nested route active without highlighting the home item', () => {
    mocks.pathname = '/dashboard/wallet'
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: 'Wallet' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it('marks sub-pages active for their group and renders correct hrefs', () => {
    mocks.pathname = '/dashboard/settings'
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/dashboard/settings')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'API Keys' })).toHaveAttribute('href', '/dashboard/api-keys')
  })

  it('does not highlight a sibling route', () => {
    mocks.pathname = '/dashboard/usage'
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: 'Transactions' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Usage' })).toHaveAttribute('aria-current', 'page')
  })
})
