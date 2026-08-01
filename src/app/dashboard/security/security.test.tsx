// @vitest-environment jsdom
// ProxyAI — Security Page Tests (Milestone 6)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SecurityPage from './page'

vi.mock('@/hooks/use-profile', () => ({
  useChangePassword: vi.fn(),
}))

vi.mock('@/hooks/use-sessions', () => ({
  useSessions: vi.fn(),
  useRevokeSession: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ logoutAll: vi.fn() }),
}))

import { useChangePassword } from '@/hooks/use-profile'
import { useSessions, useRevokeSession } from '@/hooks/use-sessions'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockSessionCurrent = {
  id: 'session-1',
  is_current: true,
  user_agent: 'Mozilla/5.0 Chrome/120',
  ip_address: '192.168.1.xxx',
  created_at: '2026-08-01T10:00:00.000Z',
  expires_at: '2026-09-01T10:00:00.000Z',
}

const mockSessionOther = {
  id: 'session-2',
  is_current: false,
  user_agent: 'Mozilla/5.0 Firefox/120',
  ip_address: '10.0.0.xxx',
  created_at: '2026-07-30T10:00:00.000Z',
  expires_at: '2026-08-30T10:00:00.000Z',
}

describe('Security Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useChangePassword).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useChangePassword>)
    vi.mocked(useSessions).mockReturnValue({
      data: [mockSessionCurrent, mockSessionOther],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSessions>)
    vi.mocked(useRevokeSession).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useRevokeSession>)
  })

  it('renders the page title', () => {
    render(<SecurityPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Security')).toBeTruthy()
  })

  it('renders password change form', () => {
    render(<SecurityPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Change Password')).toBeTruthy()
    expect(screen.getByLabelText('Current Password')).toBeTruthy()
    expect(screen.getByLabelText('New Password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm New Password')).toBeTruthy()
  })

  it('renders active sessions list', () => {
    render(<SecurityPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Active Sessions')).toBeTruthy()
    expect(screen.getByText('Chrome')).toBeTruthy()
  })

  it('shows current session badge', () => {
    render(<SecurityPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Current')).toBeTruthy()
  })

  it('shows revoke button for non-current sessions', () => {
    render(<SecurityPage />, { wrapper: createWrapper() })
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i })
    expect(revokeButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading state', () => {
    vi.mocked(useSessions).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useSessions>)

    render(<SecurityPage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[role="status"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty sessions state', () => {
    vi.mocked(useSessions).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSessions>)

    render(<SecurityPage />, { wrapper: createWrapper() })
    expect(screen.getByText('No sessions')).toBeTruthy()
  })

  it('shows password validation errors', async () => {
    const user = userEvent.setup()
    render(<SecurityPage />, { wrapper: createWrapper() })

    const newPassword = screen.getByLabelText('New Password')
    await user.type(newPassword, 'weak')

    expect(screen.getByText('At least 8 characters')).toBeTruthy()
    expect(screen.getByText('At least one uppercase letter')).toBeTruthy()
    expect(screen.getByText('At least one number')).toBeTruthy()
    expect(screen.getByText('At least one special character')).toBeTruthy()
  })

  it('shows password strength indicator', async () => {
    const user = userEvent.setup()
    render(<SecurityPage />, { wrapper: createWrapper() })

    const newPassword = screen.getByLabelText('New Password')
    await user.type(newPassword, 'Str0ng!Pass#1')

    expect(screen.getByText('Very Strong')).toBeTruthy()
  })

  it('shows mismatch error when confirm does not match', async () => {
    const user = userEvent.setup()
    render(<SecurityPage />, { wrapper: createWrapper() })

    const newPassword = screen.getByLabelText('New Password')
    const confirmPassword = screen.getByLabelText('Confirm New Password')
    await user.type(newPassword, 'Str0ng!Pass#1')
    await user.type(confirmPassword, 'Different')

    expect(screen.getByText('Passwords do not match.')).toBeTruthy()
  })

  it('renders logout all button', () => {
    render(<SecurityPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Logout All')).toBeTruthy()
  })
})
