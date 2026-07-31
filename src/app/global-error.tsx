'use client'

// ProxyAI — Global error boundary (root layout replacement)
// Must include <html> and <body> (Next.js convention).

import { useEffect } from 'react'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('global.error', { digest: error.digest, message: error.message })
  }, [error])

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <div
          role="alert"
          className="w-full max-w-md space-y-4 rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900 dark:bg-zinc-900"
        >
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Something went wrong
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            An unexpected error occurred. Try again — if it keeps happening, contact support.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Try again
          </button>
          {error.digest && (
            <p className="font-mono text-xs text-zinc-400">digest: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  )
}
