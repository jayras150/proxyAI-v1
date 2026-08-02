// @vitest-environment jsdom
// ProxyAI — AutoRefresh component tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AutoRefresh } from '../auto-refresh'

describe('AutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom defaults to 'visible'
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not tick until enabled', () => {
    const refetch = vi.fn()
    render(<AutoRefresh refetch={refetch} intervalMs={1000} />)
    vi.advanceTimersByTime(5000)
    expect(refetch).not.toHaveBeenCalled()
  })

  it('ticks on the interval when enabled', () => {
    const refetch = vi.fn()
    render(<AutoRefresh refetch={refetch} intervalMs={1000} />)
    fireEvent.click(screen.getByLabelText('Auto refresh every 30 seconds'))
    vi.advanceTimersByTime(3000)
    expect(refetch).toHaveBeenCalledTimes(3)
  })

  it('pauses ticking while the tab is hidden', () => {
    const refetch = vi.fn()
    render(<AutoRefresh refetch={refetch} intervalMs={1000} />)
    fireEvent.click(screen.getByLabelText('Auto refresh every 30 seconds'))
    vi.advanceTimersByTime(2000)
    expect(refetch).toHaveBeenCalledTimes(2)

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(5000)
    expect(refetch).toHaveBeenCalledTimes(2) // unchanged while hidden
  })

  it('shows the last tick time in a live region when enabled', () => {
    const refetch = vi.fn()
    render(<AutoRefresh refetch={refetch} intervalMs={1000} />)
    fireEvent.click(screen.getByLabelText('Auto refresh every 30 seconds'))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText(/Updated/)).toBeTruthy()
  })
})
