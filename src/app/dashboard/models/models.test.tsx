// @vitest-environment jsdom
// ProxyAI — Models Page Tests (Milestone 4)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ModelsPage from './page'

vi.mock('@/hooks/use-models', () => ({
  useModels: vi.fn(),
}))

import { useModels } from '@/hooks/use-models'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockModel = {
  id: 'deepseek-chat',
  object: 'model',
  created: 1700000000,
  owned_by: 'deepinfra',
  display_name: 'DeepSeek Chat',
  context_window: 65536,
  enabled: true,
  capabilities: {
    streaming: true,
    reasoning: true,
    vision: false,
    json_mode: true,
  },
  provider: 'deepinfra',
  default_model: null,
  pricing: {
    input_price: '0.150000',
    output_price: '0.600000',
    markup_percent: '10.00',
    service_fee: '0.000000',
    currency: 'USD',
  },
  status: 'active',
}

describe('Models Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useModels).mockReturnValue({
      data: {
        object: 'list',
        data: [mockModel],
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useModels>)
  })

  it('renders the page title', () => {
    render(<ModelsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Models')).toBeTruthy()
    expect(screen.getByText('Available models, capabilities and pricing.')).toBeTruthy()
  })

  it('renders model cards', () => {
    render(<ModelsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('DeepSeek Chat')).toBeTruthy()
    expect(screen.getByText('deepseek-chat')).toBeTruthy()
  })

  it('renders model capabilities', () => {
    render(<ModelsPage />, { wrapper: createWrapper() })
    expect(screen.getByText(/Streaming/)).toBeTruthy()
    expect(screen.getByText(/Reasoning/)).toBeTruthy()
    expect(screen.getByText(/JSON/)).toBeTruthy()
  })

  it('shows provider and context window', () => {
    render(<ModelsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('deepinfra')).toBeTruthy()
    expect(screen.getByText('65,536 tokens')).toBeTruthy()
  })

  it('shows active status badge', () => {
    render(<ModelsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('shows loading skeletons', () => {
    vi.mocked(useModels).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useModels>)

    render(<ModelsPage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[role="status"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state', () => {
    vi.mocked(useModels).mockReturnValue({
      data: { object: 'list', data: [] },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useModels>)

    render(<ModelsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('No models available')).toBeTruthy()
  })

  it('shows error state', () => {
    vi.mocked(useModels).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to fetch' },
    } as ReturnType<typeof useModels>)

    render(<ModelsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Failed to Load Models')).toBeTruthy()
  })

  it('opens detail dialog on card click', async () => {
    const user = userEvent.setup()
    render(<ModelsPage />, { wrapper: createWrapper() })

    const card = screen.getByRole('button', { name: /view model details/i })
    await user.click(card)

    expect(screen.getAllByText('DeepSeek Chat').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('deepseek-chat').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Capabilities')).toBeTruthy()
    expect(screen.getByText(/Pricing/)).toBeTruthy()
  })
})
