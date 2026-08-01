// @vitest-environment jsdom
// ProxyAI — Wallet Page Tests (Milestone 3)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WalletPage from './page'
import type { WalletResponse } from '@/types/wallet'

// Mock useWallet
vi.mock('@/hooks/use-wallet', () => ({
  useWallet: vi.fn(),
}))

// Mock useTransactions
vi.mock('@/hooks/use-transactions', () => ({
  useTransactions: vi.fn(),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { useWallet } from '@/hooks/use-wallet'
import { useTransactions } from '@/hooks/use-transactions'

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

describe('Wallet Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useWallet).mockReturnValue({
      data: mockWallet,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useWallet>)
    vi.mocked(useTransactions).mockReturnValue({
      data: { items: [], next_cursor: null, has_more: false },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTransactions>)
  })

  it('renders the page title', () => {
    render(<WalletPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Wallet')).toBeTruthy()
  })

  it('renders the balance', () => {
    render(<WalletPage />, { wrapper: createWrapper() })
    expect(screen.getByText(/\$100\.00/)).toBeTruthy()
  })

  it('renders Top Up button', () => {
    render(<WalletPage />, { wrapper: createWrapper() })
    expect(screen.getByRole('button', { name: /top up/i })).toBeTruthy()
  })

  it('shows loading skeleton', () => {
    vi.mocked(useWallet).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useWallet>)

    render(<WalletPage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[aria-hidden="true"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error state on 404', () => {
    vi.mocked(useWallet).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404, message: 'Not found' },
    } as unknown as ReturnType<typeof useWallet>)

    render(<WalletPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Wallet Not Found')).toBeTruthy()
  })

  it('shows PAYMENT_REQUIRED banner', () => {
    vi.mocked(useWallet).mockReturnValue({
      data: { ...mockWallet, balance: '-5.000000', status: 'PAYMENT_REQUIRED' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useWallet>)

    render(<WalletPage />, { wrapper: createWrapper() })
    expect(screen.getByText(/balance is negative/i)).toBeTruthy()
  })

  it('shows SUSPENDED banner', () => {
    vi.mocked(useWallet).mockReturnValue({
      data: { ...mockWallet, status: 'SUSPENDED' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useWallet>)

    render(<WalletPage />, { wrapper: createWrapper() })
    // Both Badge label and Alert title contain 'Suspended'
    const suspended = screen.getAllByText(/suspended/i)
    expect(suspended.length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state when no transactions', () => {
    vi.mocked(useTransactions).mockReturnValue({
      data: { items: [], next_cursor: null, has_more: false },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTransactions>)

    render(<WalletPage />, { wrapper: createWrapper() })
    expect(screen.getByText('No transactions')).toBeTruthy()
  })
})
