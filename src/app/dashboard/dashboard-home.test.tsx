// @vitest-environment jsdom
// ProxyAI — Dashboard Home page tests (Milestone 2)
//
// The page renders ENTIRELY from one query (useDashboardSummary). These
// tests mock the hook + auth + next/link, then exercise: happy path,
// loading skeleton, offline / 500 error + retry, PAYMENT_REQUIRED banner
// with disabled AI actions, empty states, quick action navigation and the
// responsive grid classes.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/api-client'
import type { DashboardSummary } from '@/types/dashboard'
import DashboardHomePage from '@/app/dashboard/page'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useDashboardSummary: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mocks.useAuth(),
}))

vi.mock('@/hooks/use-dashboard-summary', () => ({
  useDashboardSummary: () => mocks.useDashboardSummary(),
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

const SUMMARY: DashboardSummary = {
  balance: '12.345000',
  currency: 'USD',
  wallet_status: 'ACTIVE',
  requests_today: 3,
  tokens_today: 4200,
  spend_today: '0.001488',
  spend_month: '0.005000',
  spend_previous_month: '0.002000',
  active_keys: 2,
  available_models: 3,
  default_model: 'deepseek-chat',
  latest_transactions: [
    {
      id: 'txn-1',
      type: 'TOPUP',
      amount: '10.000000',
      balance_after: '12.345000',
      currency: 'USD',
      status: 'COMPLETED',
      description: 'Top up via card',
      created_at: '2026-08-01T01:00:00.000Z',
    },
  ],
  latest_usage: [
    {
      id: 'usage-1',
      model: 'deepseek-chat',
      provider: 'deepseek',
      status: 'COMPLETED',
      total_tokens: 1500,
      user_cost: '0.000496',
      currency: 'USD',
      created_at: '2026-08-01T02:00:00.000Z',
    },
  ],
  provider: { id: 'deepseek', healthy: true, latency_ms: 133 },
}

function summaryQuery(overrides: Partial<ReturnType<typeof mocks.useDashboardSummary>> = {}) {
  return {
    isLoading: false,
    isError: false,
    error: null,
    data: SUMMARY,
    refetch: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  mocks.useAuth.mockReturnValue({
    user: { id: 'u1', email: 'ada@proxyai.live', name: 'Ada', role: 'USER', status: 'ACTIVE', createdAt: '' },
    isLoading: false,
    isAuthenticated: true,
  })
  mocks.useDashboardSummary.mockReturnValue(summaryQuery())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DashboardHomePage', () => {
  it('renders the welcome header with the user name', () => {
    render(<DashboardHomePage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Ada/)
  })

  it('renders every widget from a single summary', () => {
    render(<DashboardHomePage />)
    expect(screen.getByText('Current balance')).toBeInTheDocument()
    expect(screen.getByLabelText("Today's usage")).toBeInTheDocument()
    expect(screen.getByText('Monthly Spending')).toBeInTheDocument()
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
    expect(screen.getByText('Recent AI Usage')).toBeInTheDocument()
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('Models')).toBeInTheDocument()
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('System Status')).toBeInTheDocument()
  })

  it('shows a loading skeleton while the query is pending', () => {
    mocks.useDashboardSummary.mockReturnValue(summaryQuery({ isLoading: true, data: undefined }))
    render(<DashboardHomePage />)
    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
  })

  it('shows an offline error with retry', async () => {
    const user = userEvent.setup()
    const refetch = vi.fn()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    mocks.useDashboardSummary.mockReturnValue(
      summaryQuery({
        isError: true,
        data: undefined,
        error: new ApiError({ status: 0, code: 'OFFLINE', message: 'You are offline.' }),
        refetch,
      })
    )

    render(<DashboardHomePage />)
    expect(screen.getByText('Check your internet connection and try again.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows a 500 error and retries', async () => {
    const user = userEvent.setup()
    const refetch = vi.fn()
    mocks.useDashboardSummary.mockReturnValue(
      summaryQuery({
        isError: true,
        data: undefined,
        error: new ApiError({ status: 500, code: 'INTERNAL', message: 'Server exploded' }),
        refetch,
      })
    )

    render(<DashboardHomePage />)
    expect(screen.getByText('Server exploded')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows a 429 rate-limit error', () => {
    mocks.useDashboardSummary.mockReturnValue(
      summaryQuery({
        isError: true,
        data: undefined,
        error: new ApiError({
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          retryAfterSeconds: 8,
        }),
      })
    )
    render(<DashboardHomePage />)
    expect(screen.getByText('Please wait 8s before trying again.')).toBeInTheDocument()
  })

  it('shows a 402 payment-required error state', () => {
    mocks.useDashboardSummary.mockReturnValue(
      summaryQuery({
        isError: true,
        data: undefined,
        error: new ApiError({ status: 402, code: 'PAYMENT_REQUIRED', message: 'Top up to continue.' }),
      })
    )
    render(<DashboardHomePage />)
    expect(screen.getByText('Top up to continue.')).toBeInTheDocument()
  })

  describe('PAYMENT_REQUIRED wallet status', () => {
    beforeEach(() => {
      mocks.useDashboardSummary.mockReturnValue(
        summaryQuery({ data: { ...SUMMARY, balance: '-0.040000', wallet_status: 'PAYMENT_REQUIRED' } })
      )
    })

    it('renders the red banner with Topup Now', () => {
      render(<DashboardHomePage />)
      // Two alerts exist when PAYMENT_REQUIRED: the page-level banner and
      // the one inside the Balance widget. The banner is the one with the
      // "Payment required" heading.
      const banner = screen.getAllByRole('alert').find((a) =>
        a.textContent?.includes('Payment required')
      )
      expect(banner).toBeTruthy()
      expect(within(banner!).getByRole('link', { name: 'Topup Now' })).toBeInTheDocument()
    })

    it('disables AI quick actions but keeps Topup active', () => {
      render(<DashboardHomePage />)
      const actions = screen.getByRole('group', { name: 'Quick actions' })

      const topup = within(actions).getByRole('link', { name: 'Topup' })
      expect(topup).toBeEnabled()
      expect(topup).toHaveAttribute('href', '/dashboard/topup')

      const createKey = within(actions).getByRole('link', { name: /Create API Key/ })
      expect(createKey).toHaveAttribute('aria-disabled', 'true')

      const playground = within(actions).getByRole('link', { name: /Playground/ })
      expect(playground).toHaveAttribute('aria-disabled', 'true')

      // Status text tells the user why actions are disabled.
      expect(screen.getByRole('status')).toHaveTextContent(/top up/i)
    })
  })

  describe('empty states', () => {
    it('shows empty states when there is no activity, usage or keys', () => {
      mocks.useDashboardSummary.mockReturnValue(
        summaryQuery({
          data: {
            ...SUMMARY,
            requests_today: 0,
            tokens_today: 0,
            spend_today: '0.000000',
            spend_month: '0.000000',
            spend_previous_month: '0.000000',
            active_keys: 0,
            latest_transactions: [],
            latest_usage: [],
          },
        })
      )

      render(<DashboardHomePage />)
      expect(screen.getByText('No transactions yet')).toBeInTheDocument()
      expect(screen.getByText('No AI usage yet')).toBeInTheDocument()
      expect(screen.getByText('No API keys yet')).toBeInTheDocument()
      expect(screen.getByText('No spending yet this month')).toBeInTheDocument()
    })
  })

  describe('navigation', () => {
    it('links View All to the transactions page', () => {
      render(<DashboardHomePage />)
      // Two "View All" links render (transactions + usage); find the one
      // pointing at the transactions page.
      const links = screen.getAllByRole('link', { name: 'View All' })
      const txLink = links.find((l) => l.getAttribute('href') === '/dashboard/transactions')
      expect(txLink).toBeTruthy()
    })

    it('links quick actions to their destinations', () => {
      render(<DashboardHomePage />)
      const actions = screen.getByRole('group', { name: 'Quick actions' })
      expect(within(actions).getByRole('link', { name: 'Topup' })).toHaveAttribute(
        'href',
        '/dashboard/topup'
      )
      expect(within(actions).getByRole('link', { name: /Create API Key/ })).toHaveAttribute(
        'href',
        '/dashboard/api-keys'
      )
      expect(within(actions).getByRole('link', { name: /Documentation/ })).toHaveAttribute(
        'href',
        'https://docs.proxyai.live'
      )
    })
  })

  describe('responsive layout', () => {
    it('uses responsive grid classes on the stat rows and lists', () => {
      const { container } = render(<DashboardHomePage />)

      // Stats row: 1 col mobile → 2 col md → 4 col xl.
      const grids = container.querySelectorAll('.grid')
      expect(grids.length).toBeGreaterThan(0)

      const statGrid = Array.from(grids).find((g) => g.className.includes('xl:grid-cols-4'))
      expect(statGrid).toBeTruthy()
      expect(statGrid!.className).toContain('grid-cols-1')
      expect(statGrid!.className).toContain('md:grid-cols-2')

      const listGrid = Array.from(grids).find((g) => g.className.includes('lg:grid-cols-2'))
      expect(listGrid).toBeTruthy()

      // The Today's Usage section itself is responsive (1→3 columns).
      expect(screen.getByLabelText("Today's usage").className).toContain('sm:grid-cols-3')
    })
  })
})
