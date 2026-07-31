// ProxyAI — Alert primitive (presentational)
// role=alert on danger/warning so screen readers announce immediately.

import { cn } from '@/lib/cn'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONE_CLASSES: Record<AlertTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  danger:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
}

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone
  title?: string
}

export function Alert({ tone = 'info', title, className, children, ...props }: AlertProps) {
  const isAssertive = tone === 'danger' || tone === 'warning'
  return (
    <div
      role={isAssertive ? 'alert' : 'status'}
      className={cn('rounded-lg border p-4 text-sm', TONE_CLASSES[tone], className)}
      {...props}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && 'mt-1')}>{children}</div>}
    </div>
  )
}
