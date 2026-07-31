'use client'

// ProxyAI — ErrorState (design doc §5.5)
// Renders backend error envelopes with request_id + retry.
// Offline-aware (shows a connectivity-specific message).

import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

export interface ErrorStateProps {
  title?: string
  error?: unknown
  onRetry?: () => void
  className?: string
}

function describe(error: unknown): { title: string; message: string; requestId: string | null } {
  if (error instanceof ApiError) {
    if (error.isNetworkError) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      return {
        title: offline ? 'You are offline' : 'Connection problem',
        message: offline
          ? 'Check your internet connection and try again.'
          : error.message,
        requestId: error.requestId,
      }
    }
    if (error.isRateLimited) {
      return {
        title: 'Too many requests',
        message: error.retryAfterSeconds
          ? `Please wait ${error.retryAfterSeconds}s before trying again.`
          : 'Please slow down and try again in a moment.',
        requestId: error.requestId,
      }
    }
    return { title: 'Something went wrong', message: error.message, requestId: error.requestId }
  }
  if (error instanceof Error) {
    return { title: 'Something went wrong', message: error.message, requestId: null }
  }
  return { title: 'Something went wrong', message: 'An unexpected error occurred.', requestId: null }
}

export function ErrorState({ title, error, onRetry, className }: ErrorStateProps) {
  const info = describe(error)
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false

  return (
    <Alert tone={offline ? 'warning' : 'danger'} title={title ?? info.title} className={cn('my-2', className)}>
      <p>{info.message}</p>
      {info.requestId && (
        <p className="mt-1 font-mono text-xs opacity-80">request_id: {info.requestId}</p>
      )}
      {onRetry && (
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </Alert>
  )
}
