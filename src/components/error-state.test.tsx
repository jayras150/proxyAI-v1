// @vitest-environment jsdom
// ProxyAI — ErrorState + dashboard error boundary tests

import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/api-client'
import { ErrorState } from '@/components/error-state'
import DashboardError from '@/app/dashboard/error'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorState', () => {
  it('renders the backend error message with request_id and retry', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    const error = new ApiError({
      status: 423,
      code: 'WALLET_LOCKED',
      message: 'Wallet is locked',
      requestId: 'req_xyz',
    })
    render(<ErrorState error={error} onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Wallet is locked')).toBeInTheDocument()
    expect(screen.getByText(/req_xyz/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows an offline-specific message when navigator is offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const error = new ApiError({ status: 0, code: 'OFFLINE', message: 'You are offline.' })
    render(<ErrorState error={error} onRetry={() => {}} />)
    expect(screen.getByText('You are offline')).toBeInTheDocument()
    expect(screen.getByText(/internet connection/i)).toBeInTheDocument()
  })

  it('shows a rate-limit message with retry-after seconds', () => {
    const error = new ApiError({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryAfterSeconds: 12,
    })
    render(<ErrorState error={error} />)
    expect(screen.getByText('Too many requests')).toBeInTheDocument()
    expect(screen.getByText(/12s/i)).toBeInTheDocument()
  })

  it('falls back to a generic message for unknown errors', () => {
    render(<ErrorState error={new Error('boom')} />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })
})

describe('DashboardError (route error boundary)', () => {
  it('renders the fallback and calls unstable_retry on click', async () => {
    const retry = vi.fn()
    const user = userEvent.setup()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<DashboardError error={new Error('segment crashed')} unstable_retry={retry} />)
    expect(screen.getByText('This section hit a problem')).toBeInTheDocument()
    expect(screen.getByText('segment crashed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
