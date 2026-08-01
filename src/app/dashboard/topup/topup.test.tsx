// @vitest-environment jsdom
// ProxyAI — Topup Page Tests (Milestone 3)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TopupPage from './page'
import type { WalletResponse } from '@/types/wallet'

// Mock hooks
vi.mock('@/hooks/use-wallet', () => ({
  useWallet: vi.fn(),
}))

vi.mock('@/hooks/use-topups', () => ({
  useTopups: vi.fn(),
  useCreateTopup: vi.fn(),
  useTopupPoll: vi.fn(() => ({ data: undefined })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { useWallet } from '@/hooks/use-wallet'
import { useTopups, useCreateTopup } from '@/hooks/use-topups'

const mockWallet: WalletResponse = {
  id: 'wallet-1',
  balance: '100.000000',
  currency: 'USD',
  status: 'ACTIVE',
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('Topup Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useWallet).mockReturnValue({
      data: mockWallet,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useWallet>)
    vi.mocked(useTopups).mockReturnValue({
      data: { items: [], next_cursor: null, has_more: false },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTopups>)
    vi.mocked(useCreateTopup).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateTopup>)
  })

  it('renders the page title', () => {
    render(<TopupPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Topup')).toBeTruthy()
  })

  it('renders amount presets', () => {
    render(<TopupPage />, { wrapper: createWrapper() })
    const presetButtons = screen.getAllByRole('button', { name: /top up/i })
    expect(presetButtons.length).toBeGreaterThan(0)
  })

  it('renders custom amount input', () => {
    render(<TopupPage />, { wrapper: createWrapper() })
    expect(screen.getByLabelText(/enter custom top-up amount/i)).toBeTruthy()
  })

  it('shows empty state when no topups', () => {
    render(<TopupPage />, { wrapper: createWrapper() })
    expect(screen.getByText('No topups')).toBeTruthy()
  })

  it('shows error state on failed wallet load', () => {
    vi.mocked(useWallet).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404, message: 'Not found' },
    } as unknown as ReturnType<typeof useWallet>)

    render(<TopupPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Not Found')).toBeTruthy()
  })
})
