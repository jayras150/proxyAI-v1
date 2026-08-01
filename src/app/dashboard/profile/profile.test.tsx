// @vitest-environment jsdom
// ProxyAI — Profile Page Tests (Milestone 6)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProfilePage from './page'

vi.mock('@/hooks/use-profile', () => ({
  useProfile: vi.fn(),
  useUpdateProfile: vi.fn(),
}))

import { useProfile, useUpdateProfile } from '@/hooks/use-profile'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockProfile = {
  id: 'user-1',
  email: 'user@test.com',
  name: 'Test User',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-07-15T08:00:00.000Z',
}

describe('Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useProfile).mockReturnValue({
      data: mockProfile,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProfile>)
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateProfile>)
  })

  it('renders the page title', () => {
    render(<ProfilePage />, { wrapper: createWrapper() })
    expect(screen.getByText('Profile')).toBeTruthy()
  })

  it('renders profile information', () => {
    render(<ProfilePage />, { wrapper: createWrapper() })
    expect(screen.getAllByText('Test User').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('user@test.com').length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading skeleton', () => {
    vi.mocked(useProfile).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProfile>)

    render(<ProfilePage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[role="status"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error state', () => {
    vi.mocked(useProfile).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to fetch' },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProfile>)

    render(<ProfilePage />, { wrapper: createWrapper() })
    expect(screen.getByText('Failed to Load Profile')).toBeTruthy()
  })

  it('renders display name input', () => {
    render(<ProfilePage />, { wrapper: createWrapper() })
    const input = screen.getByLabelText('Display Name')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('Test User')
  })

  it('shows dirty state when name changes', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />, { wrapper: createWrapper() })

    const input = screen.getByLabelText('Display Name')
    await user.clear(input)
    await user.type(input, 'New Name')

    expect(screen.getByText('You have unsaved changes.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy()
  })

  it('shows cancel button when dirty', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />, { wrapper: createWrapper() })

    const input = screen.getByLabelText('Display Name')
    await user.clear(input)
    await user.type(input, 'New Name')

    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy()
  })
})
