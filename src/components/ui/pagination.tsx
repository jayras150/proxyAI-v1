'use client'

// ProxyAI — Pagination primitive (cursor-based, design doc §5.2)
// Backend pages are keyset cursors: { items, next_cursor, has_more }.
// This primitive drives Prev/Next with a loading state; page numbers are
// intentionally absent (opaque cursors).

import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Glyphs } from '@/components/icons'

export interface PaginationProps {
  hasPrevious: boolean
  hasMore: boolean
  onPrevious: () => void
  onNext: () => void
  isLoading?: boolean
  label?: string
  className?: string
}

export function Pagination({
  hasPrevious,
  hasMore,
  onPrevious,
  onNext,
  isLoading = false,
  label,
  className,
}: PaginationProps) {
  return (
    <nav
      aria-label={label ?? 'Pagination'}
      className={cn('flex items-center justify-between gap-2', className)}
    >
      {label ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPrevious || isLoading}
          aria-label="Previous page"
        >
          <Glyphs.ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasMore || isLoading}
          isLoading={isLoading}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <Glyphs.ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  )
}

/** "Load more" variant for infinite lists (mobile-friendly). */
export function LoadMoreButton({
  hasMore,
  onLoadMore,
  isLoading,
}: {
  hasMore: boolean
  onLoadMore: () => void
  isLoading: boolean
}) {
  if (!hasMore) return null
  return (
    <div className="flex justify-center pt-2">
      <Button variant="outline" size="sm" onClick={onLoadMore} isLoading={isLoading}>
        Load more
      </Button>
    </div>
  )
}
