// @vitest-environment jsdom
// ProxyAI — Settings Page Tests (Milestone 6)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SettingsPage from './page'

vi.mock('@/hooks/use-settings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
}))

vi.mock('@/hooks/use-models', () => ({
  useModels: vi.fn(),
}))

vi.mock('@/lib/theme', () => ({
  useTheme: vi.fn(),
}))

import { useSettings, useUpdateSettings } from '@/hooks/use-settings'
import { useModels } from '@/hooks/use-models'
import { useTheme } from '@/lib/theme'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockModel = {
  id: 'deepseek-chat',
  display_name: 'DeepSeek Chat',
  object: 'model',
  created: 1700000000,
  owned_by: 'deepinfra',
  context_window: 65536,
}

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSettings).mockReturnValue({
      data: {
        defaultModel: 'deepseek-chat',
        defaultTemperature: 0.7,
        defaultMaxTokens: 4096,
        timezone: 'Asia/Singapore',
        language: null,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useSettings>)
    vi.mocked(useModels).mockReturnValue({
      data: { object: 'list', data: [mockModel] },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useModels>)
    vi.mocked(useUpdateSettings).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateSettings>)
    vi.mocked(useTheme).mockReturnValue({
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: vi.fn(),
      toggleTheme: vi.fn(),
    })
  })

  it('renders the page title', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('renders theme section', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Theme')).toBeTruthy()
    expect(screen.getByText('Light')).toBeTruthy()
    expect(screen.getByText('Dark')).toBeTruthy()
    expect(screen.getByText('System')).toBeTruthy()
  })

  it('renders model defaults section', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Model Defaults')).toBeTruthy()
    expect(screen.getByText('Default Model')).toBeTruthy()
    expect(screen.getByText('Default Temperature (0–2)')).toBeTruthy()
    expect(screen.getByText('Default Max Tokens')).toBeTruthy()
  })

  it('renders danger zone section', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Danger Zone')).toBeTruthy()
    expect(screen.getAllByText('Delete Account').length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading state', () => {
    vi.mocked(useSettings).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useSettings>)

    render(<SettingsPage />, { wrapper: createWrapper() })
    const skeletons = document.querySelectorAll('[role="status"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows default model selected', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    const select = screen.getByLabelText('Default Model') as HTMLSelectElement
    expect(select.value).toBe('deepseek-chat')
  })

  it('renders theme toggle buttons with pressed state', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    const systemBtn = screen.getByText('System')
    expect(systemBtn.closest('button')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('has save button', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy()
  })

  it('shows language placeholder text', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Language selection coming soon.')).toBeTruthy()
  })

  it('has disabled delete account button', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    const deleteBtn = screen.getByRole('button', { name: /delete account/i })
    expect(deleteBtn).toBeTruthy()
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders regional section with timezone', () => {
    render(<SettingsPage />, { wrapper: createWrapper() })
    expect(screen.getByText('Regional')).toBeTruthy()
    const tzSelect = screen.getByLabelText('Timezone') as HTMLSelectElement
    expect(tzSelect.value).toBe('Asia/Singapore')
  })
})
