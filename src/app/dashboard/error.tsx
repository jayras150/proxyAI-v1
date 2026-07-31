'use client'

// ProxyAI — Dashboard error boundary (design doc §8)
// Next.js 16: retry via `unstable_retry` (see local docs — error-handling).

import { useEffect } from 'react'
import { ErrorState } from '@/components/error-state'

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    // Structured logging only — no sensitive data in the message.
    console.error('dashboard.error', { digest: error.digest, message: error.message })
  }, [error])

  return (
    <div className="space-y-4" role="alert">
      <ErrorState
        title="This section hit a problem"
        error={error}
        onRetry={() => unstable_retry()}
      />
      {error.digest && (
        <p className="font-mono text-xs text-zinc-400">digest: {error.digest}</p>
      )}
    </div>
  )
}
