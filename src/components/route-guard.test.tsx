// @vitest-environment jsdom
// ProxyAI — RouteGuard component tests
// States: loading (skeleton) · unauthenticated (redirect) · authenticated (children).

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouteGuard } from '@/components/route-guard'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/dashboard/wallet',
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mocks.useAuth(),
}))

beforeEach(() => {
  mocks.replace.mockReset()
  mocks.useAuth.mockReset()
})

describe('RouteGuard', () => {
  it('shows a session-checking loader while auth state is loading', () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    render(
      <RouteGuard>
        <p>Protected content</p>
      </RouteGuard>
    )
    expect(screen.getByRole('status', { name: 'Checking session' })).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('redirects to /login?next=... when unauthenticated', () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    render(
      <RouteGuard>
        <p>Protected content</p>
      </RouteGuard>
    )
    expect(mocks.replace).toHaveBeenCalledWith('/login?next=%2Fdashboard%2Fwallet')
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    render(
      <RouteGuard>
        <p>Protected content</p>
      </RouteGuard>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
