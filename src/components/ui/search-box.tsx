'use client'

// ProxyAI — SearchBox primitive
// Debounced search input with clear button and labelled description text.

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Input } from '@/components/ui/input'
import { Glyphs } from '@/components/icons'

export interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  debounceMs?: number
  className?: string
}

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  debounceMs = 300,
  className,
}: SearchBoxProps) {
  const [draft, setDraft] = useState(value)
  const [prevValue, setPrevValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from parent when the value changes externally (e.g. URL params or a
  // filter reset). React-recommended "adjust state from props" pattern.
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleChange(next: string) {
    setDraft(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(next), debounceMs)
  }

  return (
    <div className={cn('relative', className)}>
      <Glyphs.Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
      <Input
        type="search"
        role="searchbox"
        aria-label={label}
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {draft && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => handleChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-zinc-200"
        >
          <Glyphs.Close className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
