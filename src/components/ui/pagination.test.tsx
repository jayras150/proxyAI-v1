// @vitest-environment jsdom
// ProxyAI — Pagination primitive tests

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoadMoreButton, Pagination } from '@/components/ui/pagination'

describe('Pagination', () => {
  it('disables both buttons when at the start with no more pages', () => {
    render(
      <Pagination hasPrevious={false} hasMore={false} onPrevious={() => {}} onNext={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('calls onNext / onPrevious when enabled', async () => {
    const onNext = vi.fn()
    const onPrevious = vi.fn()
    const user = userEvent.setup()
    render(
      <Pagination hasPrevious hasMore onPrevious={onPrevious} onNext={onNext} />
    )
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrevious).toHaveBeenCalledTimes(1)
  })

  it('renders an accessible pagination landmark', () => {
    render(
      <Pagination
        hasPrevious={false}
        hasMore
        onPrevious={() => {}}
        onNext={() => {}}
        label="Transaction pages"
      />
    )
    expect(screen.getByRole('navigation', { name: 'Transaction pages' })).toBeInTheDocument()
  })
})

describe('LoadMoreButton', () => {
  it('renders nothing when there are no more pages', () => {
    const { container } = render(<LoadMoreButton hasMore={false} onLoadMore={() => {}} isLoading={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a load-more button when more pages exist', async () => {
    const onLoadMore = vi.fn()
    const user = userEvent.setup()
    render(<LoadMoreButton hasMore onLoadMore={onLoadMore} isLoading={false} />)
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })
})
