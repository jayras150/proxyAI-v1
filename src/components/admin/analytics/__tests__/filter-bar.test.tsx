// @vitest-environment jsdom
// ProxyAI — FilterBar component tests

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '../filter-bar'

const EMPTY_FILTERS = { range: 'today' as const }

describe('FilterBar', () => {
  it('renders range options and defaults to today', () => {
    render(<FilterBar value={EMPTY_FILTERS} onChange={vi.fn()} />)
    const select = screen.getByLabelText('Period') as HTMLSelectElement
    expect(select.value).toBe('today')
    expect(screen.getByText('Last 7 days')).toBeTruthy()
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('emits a range change', () => {
    const onChange = vi.fn()
    render(<FilterBar value={EMPTY_FILTERS} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '30d' } })
    expect(onChange).toHaveBeenCalledWith({ range: '30d', from: null, to: null })
  })

  it('reveals custom date inputs when custom is selected', () => {
    const onChange = vi.fn()
    render(<FilterBar value={{ range: 'custom', from: '2026-08-01', to: '2026-08-05' }} onChange={onChange} />)
    expect(screen.getByLabelText('From')).toBeTruthy()
    expect(screen.getByLabelText('To')).toBeTruthy()
    expect(screen.getByText('Apply')).toBeTruthy()
  })

  it('emits provider and model filters', () => {
    const onChange = vi.fn()
    render(
      <FilterBar value={EMPTY_FILTERS} onChange={onChange} providers={['deepseek', 'openai']} models={['deepseek-chat']} />
    )
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'deepseek' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ provider: 'deepseek' }))
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'deepseek-chat' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ model: 'deepseek-chat' }))
  })

  it('emits user id filter', () => {
    const onChange = vi.fn()
    render(<FilterBar value={EMPTY_FILTERS} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'user-1' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-1' }))
  })
})
