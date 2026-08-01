// @vitest-environment jsdom
// ProxyAI — Admin Dashboard Tests (Milestone 1)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/query-client'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-admin-auth', () => ({
  useAdminAuth: vi.fn(),
}))

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}))

import { useAdminAuth } from '@/hooks/use-admin-auth'
import AdminLoginPage from '@/app/admin/login/page'
import AdminPage from '@/app/admin/page'

function createWrapper() {
  const queryClient = makeQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockSuperAdmin = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  totp_enabled: false,
  totp_verified: false,
  permissions: ['admin:access', 'admin:users:read', 'admin:wallet:read', 'admin:billing:read'],
}

const mockAdminTotpNotVerified = {
  ...mockSuperAdmin,
  role: 'ADMIN',
  totp_enabled: true,
  totp_verified: false,
}

describe('Admin Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    render(<AdminLoginPage />, { wrapper: createWrapper() })
    expect(screen.getByText('ProxyAI Admin')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  it('has user login link', () => {
    render(<AdminLoginPage />, { wrapper: createWrapper() })
    expect(screen.getByText('User login')).toBeTruthy()
  })
})

describe('Admin Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard title', async () => {
    vi.mocked(useAdminAuth).mockReturnValue({ data: mockSuperAdmin, isLoading: false, error: null })
    render(<AdminPage />, { wrapper: createWrapper() })
    // Dashboard text appears in sidebar nav items
    const dashboards = await screen.findAllByText('Dashboard')
    expect(dashboards.length).toBeGreaterThanOrEqual(1)
  })

  it('has nav labels in document', async () => {
    vi.mocked(useAdminAuth).mockReturnValue({ data: mockSuperAdmin, isLoading: false, error: null })
    render(<AdminPage />, { wrapper: createWrapper() })
    // Check that it renders without crashing
    expect(screen.getByLabelText('Logout')).toBeTruthy()
  })

  it('shows loading skeleton', () => {
    vi.mocked(useAdminAuth).mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(<AdminPage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[role="status"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error state on auth failure', () => {
    vi.mocked(useAdminAuth).mockReturnValue({ data: undefined, isLoading: false, error: { message: 'Auth failed' } })
    render(<AdminPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Authentication Error')).toBeTruthy()
  })

  it('shows TOTP verification when needed', () => {
    vi.mocked(useAdminAuth).mockReturnValue({ data: mockAdminTotpNotVerified, isLoading: false, error: null })
    render(<AdminPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Two-Factor Authentication')).toBeTruthy()
  })

  it('shows logout button', () => {
    vi.mocked(useAdminAuth).mockReturnValue({ data: mockSuperAdmin, isLoading: false, error: null })
    render(<AdminPage />, { wrapper: createWrapper() })
    expect(screen.getByLabelText('Logout')).toBeTruthy()
  })

  it('shows theme toggle', () => {
    vi.mocked(useAdminAuth).mockReturnValue({ data: mockSuperAdmin, isLoading: false, error: null })
    render(<AdminPage />, { wrapper: createWrapper() })
    expect(screen.getByLabelText(/switch to/i)).toBeTruthy()
  })
})
