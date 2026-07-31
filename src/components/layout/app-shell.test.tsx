// @vitest-environment jsdom
// ProxyAI — AppShell layout tests (shell + navigation + user menu)

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/components/layout/app-shell'
import { ThemeProvider } from '@/lib/theme'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard',
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mocks.useAuth(),
}))

const authenticated = {
  user: { id: 'u1', email: 'ada@proxyai.live', name: 'Ada', role: 'USER', status: 'ACTIVE', createdAt: '' },
  isLoading: false,
  isAuthenticated: true,
  logout: vi.fn(),
  logoutAll: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}

function renderShell(children: React.ReactNode = <p>Content</p>) {
  return render(<ThemeProvider><AppShell>{children}</AppShell></ThemeProvider>)
}

beforeEach(() => {
  mocks.useAuth.mockReset()
  mocks.replace.mockReset()
  mocks.push.mockReset()
  mocks.useAuth.mockReturnValue(authenticated)
})

describe('AppShell', () => {
  it('renders the top bar with brand, status and theme toggle', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'ProxyAI' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'System status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mode/i })).toBeInTheDocument()
  })

  it('renders all 10 navigation items in the sidebar', () => {
    renderShell()
    const sidebar = within(screen.getByRole('navigation', { name: 'Main navigation' }))
    const labels = [
      'Dashboard',
      'Wallet',
      'Topup',
      'Usage',
      'Transactions',
      'API Keys',
      'Models',
      'Profile',
      'Security',
      'Settings',
    ]
    for (const label of labels) {
      expect(sidebar.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('renders the five primary items plus More in the mobile bottom nav', () => {
    renderShell()
    const bottomNav = screen.getByRole('navigation', { name: 'Primary navigation' })
    for (const label of ['Dashboard', 'Wallet', 'Topup', 'Usage', 'Transactions']) {
      expect(bottomNav.querySelector(`a[aria-label], a`)).toBeDefined()
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThanOrEqual(1)
    }
    expect(screen.getByRole('button', { name: 'Open more menu' })).toBeInTheDocument()
  })

  it('shows the user avatar initials and opens the user menu on click', async () => {
    const user = userEvent.setup()
    renderShell()
    expect(screen.getByText('AD')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'User menu' }))
    expect(screen.getByRole('menu', { name: 'User menu' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }))
    expect(mocks.push).toHaveBeenCalledWith('/dashboard/profile')
  })

  it('renders page content inside the content area', () => {
    renderShell(<p>Page content here</p>)
    expect(screen.getByText('Page content here')).toBeInTheDocument()
  })

  it('opens the More drawer and closes it on Escape', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: 'Open more menu' }))
    const dialog = screen.getByRole('dialog', { name: 'Navigation menu' })
    expect(dialog).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument()
    })
  })

  it('wires logout through the user menu', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: 'User menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Logout' }))
    expect(authenticated.logout).toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith('/login')
  })
})
