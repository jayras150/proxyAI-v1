// @vitest-environment jsdom
// ProxyAI — API Keys Page Tests (Milestone 5)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ApiKeysPage from './page'

vi.mock('@/hooks/use-api-keys', () => ({
  useApiKeys: vi.fn(),
  useCreateApiKey: vi.fn(),
  useRevokeApiKey: vi.fn(),
  useRotateApiKey: vi.fn(),
}))

import { useApiKeys, useCreateApiKey, useRevokeApiKey, useRotateApiKey } from '@/hooks/use-api-keys'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockKey = {
  id: 'key-1',
  name: 'My Test Key',
  keyPrefix: 'pk_live_abc123',
  status: 'ACTIVE',
  lastUsedAt: '2026-08-01T10:00:00.000Z',
  createdAt: '2026-07-15T08:00:00.000Z',
}

const mockRevokedKey = {
  ...mockKey,
  id: 'key-2',
  name: 'Old Key',
  status: 'REVOKED',
  lastUsedAt: null,
}

describe('API Keys Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useApiKeys).mockReturnValue({
      data: [mockKey, mockRevokedKey],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useApiKeys>)

    vi.mocked(useCreateApiKey).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCreateApiKey>)

    vi.mocked(useRevokeApiKey).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRevokeApiKey>)

    vi.mocked(useRotateApiKey).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRotateApiKey>)
  })

  it('renders the page title', () => {
    render(<ApiKeysPage />, { wrapper: createWrapper() })
    expect(screen.getByText('API Keys')).toBeTruthy()
    expect(screen.getByText('Create, rotate and revoke your API keys.')).toBeTruthy()
  })

  it('renders API key rows in table', () => {
    render(<ApiKeysPage />, { wrapper: createWrapper() })
    expect(screen.getAllByText('My Test Key').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Old Key').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('pk_live_abc123…').length).toBeGreaterThanOrEqual(1)
  })

  it('shows active/revoked status badges', () => {
    render(<ApiKeysPage />, { wrapper: createWrapper() })
    const activeBadges = screen.getAllByText('ACTIVE')
    expect(activeBadges.length).toBeGreaterThanOrEqual(1)
    const revokedBadges = screen.getAllByText('REVOKED')
    expect(revokedBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading skeletons', () => {
    vi.mocked(useApiKeys).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useApiKeys>)

    render(<ApiKeysPage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[role="status"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state', () => {
    vi.mocked(useApiKeys).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useApiKeys>)

    render(<ApiKeysPage />, { wrapper: createWrapper() })
    expect(screen.getByText('No API keys')).toBeTruthy()
  })

  it('shows error state', () => {
    vi.mocked(useApiKeys).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to fetch' },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useApiKeys>)

    render(<ApiKeysPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Failed to Load API Keys')).toBeTruthy()
  })

  it('opens create dialog when clicking Create Key', async () => {
    const user = userEvent.setup()
    render(<ApiKeysPage />, { wrapper: createWrapper() })

    await user.click(screen.getByRole('button', { name: /create key/i }))
    expect(screen.getByText('Create API Key')).toBeTruthy()
  })

  it('shows create dialog with generate button', async () => {
    const user = userEvent.setup()
    render(<ApiKeysPage />, { wrapper: createWrapper() })

    await user.click(screen.getByRole('button', { name: /create key/i }))
    expect(screen.getByRole('button', { name: /generate/i })).toBeTruthy()
  })

  it('renders search box', () => {
    render(<ApiKeysPage />, { wrapper: createWrapper() })
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })

  it('renders status filter', () => {
    render(<ApiKeysPage />, { wrapper: createWrapper() })
    expect(screen.getByLabelText(/filter by key status/i)).toBeTruthy()
  })

  it('shows rotate button for active keys', () => {
    render(<ApiKeysPage />, { wrapper: createWrapper() })
    const rotateButtons = screen.getAllByRole('button', { name: /rotate/i })
    expect(rotateButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('shows revoke button for active keys', () => {
    render(<ApiKeysPage />, { wrapper: createWrapper() })
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i })
    expect(revokeButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('opens rotate confirmation dialog', async () => {
    const user = userEvent.setup()
    render(<ApiKeysPage />, { wrapper: createWrapper() })

    const rotateButtons = screen.getAllByRole('button', { name: /rotate/i })
    // The first rotate button is for the ACTIVE key
    await user.click(rotateButtons[0])
    expect(screen.getByText('Rotate API Key')).toBeTruthy()
  })

  it('opens revoke confirmation dialog', async () => {
    const user = userEvent.setup()
    render(<ApiKeysPage />, { wrapper: createWrapper() })

    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i })
    await user.click(revokeButtons[0])
    expect(screen.getByText('Revoke API Key')).toBeTruthy()
  })
})
