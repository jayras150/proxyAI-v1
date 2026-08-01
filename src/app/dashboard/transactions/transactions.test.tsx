// @vitest-environment jsdom
// ProxyAI — Transactions Page Tests (Milestone 3)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TransactionsPage from './page'

// Mock hooks
vi.mock('@/hooks/use-transactions', () => ({
  useTransactions: vi.fn(),
}))

import { useTransactions } from '@/hooks/use-transactions'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockTx = {
  id: 'tx-1',
  type: 'TOPUP' as const,
  amount: '50.000000',
  balance_before: '100.000000',
  balance_after: '150.000000',
  currency: 'USD',
  status: 'COMPLETED',
  reference: 'charge_tx-1',
  description: 'Wallet top-up',
  request_id: 'req_abc',
  provider_reference: 'prov_ref_1',
  created_by: 'user:u1',
  created_at: '2026-08-01T10:00:00.000Z',
}

describe('Transactions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTransactions).mockReturnValue({
      data: {
        items: [mockTx],
        next_cursor: 'next_page',
        has_more: true,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTransactions>)
  })

  it('renders the page title', () => {
    render(<TransactionsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Transactions')).toBeTruthy()
  })

  it('renders transaction rows', () => {
    render(<TransactionsPage />, { wrapper: createWrapper() })
    const topupTexts = screen.getAllByText('Topup')
    expect(topupTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading skeletons', () => {
    vi.mocked(useTransactions).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useTransactions>)

    render(<TransactionsPage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[role="status"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state', () => {
    vi.mocked(useTransactions).mockReturnValue({
      data: { items: [], next_cursor: null, has_more: false },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTransactions>)

    render(<TransactionsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('No transactions')).toBeTruthy()
  })

  it('shows error state', () => {
    vi.mocked(useTransactions).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to fetch' },
    } as ReturnType<typeof useTransactions>)

    render(<TransactionsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Failed to Load Transactions')).toBeTruthy()
  })

  it('renders next page button when has_more', () => {
    render(<TransactionsPage />, { wrapper: createWrapper() })
    expect(screen.getByRole('button', { name: /next/i })).toBeTruthy()
  })

  it('opens detail dialog on row click', async () => {
    const user = userEvent.setup()
    render(<TransactionsPage />, { wrapper: createWrapper() })

    const rows = screen.getAllByRole('button', { name: /view transaction/i })
    const row = rows[0]
    await user.click(row)

    expect(screen.getByText('Transaction Detail')).toBeTruthy()
    expect(screen.getByText(/req_abc/)).toBeTruthy()
  })

  it('renders search box', () => {
    render(<TransactionsPage />, { wrapper: createWrapper() })
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })

  it('renders type filter', () => {
    render(<TransactionsPage />, { wrapper: createWrapper() })
    expect(screen.getByLabelText(/filter by transaction type/i)).toBeTruthy()
  })
})
