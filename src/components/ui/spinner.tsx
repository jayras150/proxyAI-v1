// ProxyAI — LoadingSpinner (presentational)
// Always paired with an sr-only label for screen readers.

import { cn } from '@/lib/cn'

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
}

export function LoadingSpinner({ label = 'Loading', className, ...props }: LoadingSpinnerProps) {
  return (
    <div role="status" aria-live="polite" className={cn('inline-flex items-center gap-2', className)} {...props}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
