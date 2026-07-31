'use client'

// ProxyAI — Tabs primitive
// WAI-ARIA tabs pattern: arrow-key navigation, roving tabindex,
// aria-selected / aria-controls wiring.

import { useId, useRef } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem {
  value: string
  label: string
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  const baseId = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value)
  )

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next = activeIndex
    if (event.key === 'ArrowRight') next = (activeIndex + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (activeIndex - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return

    event.preventDefault()
    onChange(items[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Tabs"
      onKeyDown={onKeyDown}
      className={cn('inline-flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800', className)}
    >
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            role="tab"
            id={`${baseId}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              selected
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  id,
  labelledBy,
  children,
  className,
}: {
  id: string
  labelledBy: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={labelledBy}
      tabIndex={0}
      className={cn('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg', className)}
    >
      {children}
    </div>
  )
}
