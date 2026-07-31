'use client'

// ProxyAI — DropdownMenu primitive
// Accessible menu: button trigger, Esc/outside-click close, arrow-key nav,
// aria-expanded + aria-haspopup, focus returns to trigger on close.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Glyphs } from '@/components/icons'

export interface DropdownItem {
  label: string
  onSelect: () => void
  destructive?: boolean
  icon?: React.ReactNode
}

export interface DropdownMenuProps {
  trigger: React.ReactNode
  triggerLabel: string
  items: DropdownItem[]
  align?: 'start' | 'end'
  className?: string
}

export function DropdownMenu({ trigger, triggerLabel, items, align = 'end', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
      setHighlighted(0)
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => (index + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => (index - 1 + items.length) % items.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHighlighted(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHighlighted(items.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      items[highlighted]?.onSelect()
      close()
    }
  }

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {trigger}
        <Glyphs.ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-50 mt-1 min-w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => {
                item.onSelect()
                close()
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none',
                highlighted === index && 'bg-zinc-100 dark:bg-zinc-800',
                item.destructive ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
