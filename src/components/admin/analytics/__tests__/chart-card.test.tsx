// @vitest-environment jsdom
// ProxyAI — Chart Card component tests

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartCard } from '../chart-card'

describe('ChartCard', () => {
  it('renders the title and children', () => {
    render(
      <ChartCard title="Revenue" summary="Revenue by day">
        <div>chart-body</div>
      </ChartCard>
    )
    expect(screen.getByText('Revenue')).toBeTruthy()
    expect(screen.getByText('chart-body')).toBeTruthy()
  })

  it('includes an accessible text summary (sr-only)', () => {
    render(
      <ChartCard title="Revenue" summary="Revenue by day: 2026-08-01: 1.00">
        <div>chart</div>
      </ChartCard>
    )
    expect(screen.getByText('Revenue by day: 2026-08-01: 1.00')).toBeTruthy()
  })

  it('shows a skeleton while loading', () => {
    render(
      <ChartCard title="Revenue" summary="s" isLoading>
        <div>chart</div>
      </ChartCard>
    )
    expect(document.querySelectorAll('[role="status"]').length).toBeGreaterThan(0)
    expect(screen.queryByText('chart')).toBeNull()
  })

  it('shows an error state when an error is present', () => {
    render(
      <ChartCard title="Revenue" summary="s" error={new Error('boom')}>
        <div>chart</div>
      </ChartCard>
    )
    expect(screen.getByText('Failed to Load Chart')).toBeTruthy()
  })

  it('shows an empty state when empty', () => {
    render(
      <ChartCard title="Revenue" summary="s" isEmpty>
        <div>chart</div>
      </ChartCard>
    )
    expect(screen.getByText('No data')).toBeTruthy()
  })
})
