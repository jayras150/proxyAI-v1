'use client'

// ProxyAI — ButtonLink (link styled as a Button)
// Next Link cannot nest inside <button> (invalid HTML), so internal
// navigation links that should look like buttons use this primitive.
// Shares the exact Button visual contract (variants/sizes/focus ring).

import Link from 'next/link'
import { cn } from '@/lib/cn'
import type { ButtonVariant, ButtonSize } from '@/components/ui/button'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600 disabled:hover:bg-blue-600',
  secondary:
    'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-zinc-900 disabled:hover:bg-zinc-900 dark:disabled:hover:bg-zinc-100',
  ghost:
    'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 focus-visible:ring-zinc-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:hover:bg-red-600',
  outline:
    'border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-zinc-400',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export interface ButtonLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  /** Rendered as aria-disabled + no navigation (for future/blocked actions). */
  disabled?: boolean
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={disabled ? '#' : href}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        disabled && 'pointer-events-none opacity-60',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {children}
    </Link>
  )
}
