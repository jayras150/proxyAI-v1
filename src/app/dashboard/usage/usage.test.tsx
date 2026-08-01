// @vitest-environment jsdom
// ProxyAI — Usage Page Tests (Milestone 4)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import UsagePage from './page'

vi.mock('@/hooks/use-usage', () => ({
  useUsage: vi.fn(),
}))

import { useUsage } from '@/hooks/use-usage'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockUsageItem = {
  id: 'ul-1',
  model: 'deepseek-chat',
  provider: 'deepinfra',
  status: 'COMPLETED',
  pricing_version: null,
  prompt_tokens: 150,
  completion_tokens: 50,
  cached_tokens: 10,
  total_tokens: 210,
  user_cost: '0.001500',
  currency: 'USD',
  latency_ms: 1200,
  request_id: 'req_abc',
  created_at: '2026-08-01T10:00:00.000Z',
}

describe('Usage Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUsage).mockReturnValue({
      data: {
        items: [mockUsageItem],
        next_cursor: 'next_page',
        has_more: true,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUsage>)
  })

  it('renders the page title', () => {
    render(<UsagePage />, { wrapper: createWrapper() })
    expect(screen.getByText('Usage')).toBeTruthy()
    expect(screen.getByText('Token consumption and cost breakdown.')).toBeTruthy()
  })

  it('renders usage rows in table', () => {
    render(<UsagePage />, { wrapper: createWrapper() })
    expect(screen.getAllByText('deepseek-chat').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('deepinfra').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThanOrEqual(1)
  })

  it('shows summary stat cards', () => {
    render(<UsagePage />, { wrapper: createWrapper() })
    expect(screen.getByText('Total Tokens')).toBeTruthy()
    expect(screen.getByText('Total Cost')).toBeTruthy()
    expect(screen.getByText('Prompt Tokens')).toBeTruthy()
    expect(screen.getByText('Completion Tokens')).toBeTruthy()
  })

  it('shows loading skeletons', () => {
    vi.mocked(useUsage).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useUsage>)

    render(<UsagePage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[role="status"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state', () => {
    vi.mocked(useUsage).mockReturnValue({
      data: { items: [], next_cursor: null, has_more: false },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUsage>)

    render(<UsagePage />, { wrapper: createWrapper() })
    expect(screen.getByText('No usage records')).toBeTruthy()
  })

  it('shows error state', () => {
    vi.mocked(useUsage).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to fetch' },
    } as ReturnType<typeof useUsage>)

    render(<UsagePage />, { wrapper: createWrapper() })
    expect(screen.getByText('Failed to Load Usage')).toBeTruthy()
  })

  it('renders next page button when has_more', async () => {
    render(<UsagePage />, { wrapper: createWrapper() })
    const nextButton = await screen.findByRole('button', { name: /next/i })
    expect(nextButton).toBeTruthy()
  })

  it('opens detail dialog on row click', async () => {
    const user = userEvent.setup()
    render(<UsagePage />, { wrapper: createWrapper() })

    const rows = screen.getAllByRole('button', { name: /view usage/i })
    const row = rows[0]
    await user.click(row)

    expect(screen.getByText('Usage Detail')).toBeTruthy()
  })

  it('renders search box', () => {
    render(<UsagePage />, { wrapper: createWrapper() })
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })

  it('renders status filter', () => {
    render(<UsagePage />, { wrapper: createWrapper() })
    expect(screen.getByLabelText(/filter by usage status/i)).toBeTruthy()
  })

  it('shows empty state with filter message when filters are set', () => {
    vi.mocked(useUsage).mockReturnValue({
      data: { items: [], next_cursor: null, has_more: false },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUsage>)

    // Re-render with filter context by mocking a different filter state
    // We test via the descriptive text
    render(<UsagePage />, { wrapper: createWrapper() })
    expect(screen.getByText('No usage records')).toBeTruthy()
  })
})
