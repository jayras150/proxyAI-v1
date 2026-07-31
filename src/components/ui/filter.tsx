'use client'

// ProxyAI — Filter primitives
// FilterBar (container with optional reset) + FilterSelect (labelled select).
// Filter state lives in URL search params at page level (design doc §5.1).

import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterSelectProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  className?: string
}

export function FilterSelect({ label, value, options, onChange, className }: FilterSelectProps) {
  return (
    <label className={cn('flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400', className)}>
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export interface FilterBarProps {
  children: React.ReactNode
  onReset?: () => void
  isDirty?: boolean
  className?: string
}

export function FilterBar({ children, onReset, isDirty = false, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}
    >
      {children}
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} disabled={!isDirty}>
          Reset
        </Button>
      )}
    </div>
  )
}
