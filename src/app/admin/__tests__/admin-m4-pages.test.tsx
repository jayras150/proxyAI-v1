// @vitest-environment jsdom
// ProxyAI — Admin Dashboard M4 pages tests (monitoring, analytics, logs)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/query-client'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/analytics',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-admin-auth', () => ({
  useAdminAuth: vi.fn(),
}))

vi.mock('@/lib/theme', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}))

vi.mock('@/hooks/use-admin-monitoring', () => ({
  useAdminMonitoring: vi.fn(),
  useAdminSystemHealth: vi.fn(),
}))

vi.mock('@/hooks/use-admin-analytics', () => ({
  useAdminAnalytics: vi.fn(),
  useAdminUsageAnalytics: vi.fn(),
  useAdminFinancial: vi.fn(),
  useAdminProviderAnalytics: vi.fn(),
}))

vi.mock('@/hooks/use-admin-logs', () => ({
  useAdminLogs: vi.fn(),
  downloadExport: vi.fn(),
}))

vi.mock('@/hooks/use-admin-providers', () => ({
  useAdminProviders: vi.fn(),
}))

import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useAdminMonitoring } from '@/hooks/use-admin-monitoring'
import { useAdminAnalytics, useAdminUsageAnalytics, useAdminFinancial, useAdminProviderAnalytics } from '@/hooks/use-admin-analytics'
import { useAdminLogs } from '@/hooks/use-admin-logs'
import { useAdminProviders } from '@/hooks/use-admin-providers'

import AdminMonitoringPage from '@/app/admin/monitoring/page'
import AdminAnalyticsPage from '@/app/admin/analytics/page'
import AdminUsageAnalyticsPage from '@/app/admin/analytics/usage/page'
import AdminFinancialAnalyticsPage from '@/app/admin/analytics/financial/page'
import AdminProviderAnalyticsPage from '@/app/admin/analytics/providers/page'
import AdminLogsPage from '@/app/admin/logs/page'

function createWrapper() {
  const queryClient = makeQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockAdmin = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  totp_enabled: false,
  totp_verified: false,
  permissions: ['admin:access', 'admin:analytics:read', 'admin:audit:read', 'admin:dashboard:read'],
}

const loadingState = { data: undefined, isLoading: true, error: null }
const idleState = { data: undefined, isLoading: false, error: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAdminAuth).mockReturnValue({ data: mockAdmin, isLoading: false, error: null } as never)
  vi.mocked(useAdminProviders).mockReturnValue({ data: { items: [{ name: 'deepseek' }] }, isLoading: false, error: null } as never)
})

describe('Admin Monitoring Page', () => {
  it('renders KPIs and component statuses', () => {
    vi.mocked(useAdminMonitoring).mockReturnValue({
      data: {
        status: 'ok',
        uptime_seconds: 3661,
        environment: 'development',
        version: '0.1.0',
        build_info: { node: 'v24', platform: 'win32', arch: 'x64' },
        components: [
          { name: 'database', status: 'ok', latency_ms: 5, detail: 'PostgreSQL reachable' },
          { name: 'redis', status: 'not_configured', latency_ms: null, detail: 'Memory rate limiter' },
        ],
        requests_per_sec: 1.5,
        avg_response_time_ms: 450,
        success_rate: '98.00',
        error_rate: '2.00',
        checked_at: '2026-08-02T10:00:00.000Z',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as never)

    render(<AdminMonitoringPage />, { wrapper: createWrapper() })
    expect(screen.getByText('System Monitoring')).toBeTruthy()
    expect(screen.getByText('1h 1m')).toBeTruthy() // 3661s uptime
    expect(screen.getByText('database')).toBeTruthy()
    expect(screen.getByText('PostgreSQL reachable')).toBeTruthy()
  })

  it('shows skeleton while loading', () => {
    vi.mocked(useAdminMonitoring).mockReturnValue({ ...loadingState, refetch: vi.fn(), isFetching: false } as never)
    render(<AdminMonitoringPage />, { wrapper: createWrapper() })
    expect(document.querySelectorAll('[role="status"]').length).toBeGreaterThan(0)
  })
})

describe('Admin Analytics Page', () => {
  it('renders revenue KPIs and top users', () => {
    vi.mocked(useAdminAnalytics).mockReturnValue({
      data: {
        range: { from: '2026-08-02T00:00:00.000Z', to: '2026-08-02T10:00:00.000Z', label: 'Today' },
        revenue: { today: '5.000000', yesterday: '4.000000', month: '100.000000', growth_percent: '25.00' },
        users: { active: 2, new: 1, returning: 1 },
        api_requests: { total: 10, success: 9, error: 1, success_rate: '90.00' },
        wallet: { topups_count: 2, topups_amount: '20.000000', refunds_count: 1, refunds_amount: '0.500000' },
        arpu: '2.500000',
        top_users: [{ user_id: 'u1', email: 'alice@test.com', requests: 6, spend: '4.000000' }],
        timeline: [{ date: '2026-08-02', requests: 10, revenue: '5.000000' }],
      },
      isLoading: false,
      error: null,
    } as never)

    render(<AdminAnalyticsPage />, { wrapper: createWrapper() })
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeTruthy()
    expect(screen.getByText('Revenue Today')).toBeTruthy()
    expect(screen.getByText('alice@test.com')).toBeTruthy()
  })

  it('shows error state on failure', () => {
    vi.mocked(useAdminAnalytics).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') } as never)
    render(<AdminAnalyticsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Failed to Load Analytics')).toBeTruthy()
  })
})

describe('Admin Usage Analytics Page', () => {
  it('renders token totals', () => {
    vi.mocked(useAdminUsageAnalytics).mockReturnValue({
      data: {
        range: { from: '', to: '', label: 'Today' },
        totals: {
          requests: 10, prompt_tokens: 5000, completion_tokens: 3000, cached_tokens: 1000, total_tokens: 9000,
          provider_cost: '0.100000', user_cost: '0.250000', avg_latency_ms: 850, avg_cost: '0.025000',
        },
        by_model: [{ model: 'deepseek-chat', requests: 10, tokens: 9000, cost: '0.250000', avg_latency_ms: 850 }],
        by_provider: [{ provider: 'deepseek', requests: 10, tokens: 9000, cost: '0.250000', success_rate: '90.00' }],
        timeline: [{ date: '2026-08-02', requests: 10, tokens: 9000, cost: '0.250000' }],
      },
      isLoading: false,
      error: null,
    } as never)

    render(<AdminUsageAnalyticsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Usage Analytics')).toBeTruthy()
    expect(screen.getByText('Total Tokens')).toBeTruthy()
    expect(screen.getByText('deepseek-chat')).toBeTruthy()
  })
})

describe('Admin Financial Analytics Page', () => {
  it('renders wallet float and profit estimate', () => {
    vi.mocked(useAdminFinancial).mockReturnValue({
      data: {
        range: { from: '', to: '', label: 'Today' },
        wallet_float: '1000.000000',
        negative_balance_users: 2,
        outstanding_balance: '3.500000',
        charges: { count: 40, amount: '25.000000' },
        refunds: { count: 3, amount: '1.500000' },
        topups: { count: 5, amount: '50.000000' },
        provider_cost: '8.000000',
        markup_revenue: '17.000000',
        net_revenue: '15.500000',
        profit_estimate: '15.500000',
      },
      isLoading: false,
      error: null,
    } as never)

    render(<AdminFinancialAnalyticsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Financial Analytics')).toBeTruthy()
    expect(screen.getByText('Wallet Float')).toBeTruthy()
    expect(screen.getByText('Profit Estimate')).toBeTruthy()
  })
})

describe('Admin Provider Analytics Page', () => {
  it('renders provider cards with success rate', () => {
    vi.mocked(useAdminProviderAnalytics).mockReturnValue({
      data: {
        range: { from: '', to: '', label: 'Last 7 days' },
        providers: [
          {
            name: 'deepseek', display_name: 'Deepseek', enabled: true,
            requests: 100, success_count: 97, failure_count: 3, success_rate: '97.00',
            timeout_count: null, retry_count: null, avg_latency_ms: 420, tokens: 90000, estimated_cost: '2.000000',
            circuit_breaker: { enabled: true, failure_threshold: 5, recovery_timeout_ms: 30000, status: 'closed' },
            current_status: 'operational',
            health_timeline: [{ date: '2026-08-01', requests: 40, success_rate: '97.50' }],
          },
        ],
      },
      isLoading: false,
      error: null,
    } as never)

    render(<AdminProviderAnalyticsPage />, { wrapper: createWrapper() })
    expect(screen.getByRole('heading', { name: 'Provider Analytics' })).toBeTruthy()
    expect(screen.getAllByText('Deepseek').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('97.00%').length).toBeGreaterThanOrEqual(1)
  })
})

describe('Admin Logs Page', () => {
  it('renders the logs viewer with entries', () => {
    vi.mocked(useAdminLogs).mockReturnValue({
      data: {
        items: [
          { id: 'error:u1', type: 'error', title: 'deepseek-chat · deepseek', detail: '150 tokens', user_id: 'user-1', admin_id: null, created_at: '2026-08-02T10:00:00.000Z' },
          { id: 'admin:a1', type: 'admin_action', title: 'model.created', detail: 'model:m1', user_id: null, admin_id: 'admin-1', created_at: '2026-08-02T11:00:00.000Z' },
        ],
        next_cursor: null,
        has_more: false,
      },
      isLoading: false,
      error: null,
    } as never)

    render(<AdminLogsPage />, { wrapper: createWrapper() })
    expect(screen.getByRole('heading', { name: 'Logs' })).toBeTruthy()
    expect(screen.getByText('model.created')).toBeTruthy()
    expect(screen.getByText('deepseek-chat · deepseek')).toBeTruthy()
  })
})
