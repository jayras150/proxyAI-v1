'use client'

// ProxyAI — Auto Refresh (Milestone 4)
// Toggle + interval that pauses when the tab is hidden.
// Parent calls `refetch` on each tick.

import { useEffect, useState } from 'react'

export interface AutoRefreshProps {
  /** Default interval in ms (30s). */
  intervalMs?: number
  refetch: () => void
  disabled?: boolean
}

export function AutoRefresh({ intervalMs = 30_000, refetch, disabled = false }: AutoRefreshProps) {
  const [enabled, setEnabled] = useState(false)
  const [lastTick, setLastTick] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || disabled) return

    const tick = () => {
      // Pause while the tab is hidden (visibility API).
      if (document.visibilityState === 'hidden') return
      refetch()
      setLastTick(new Date().toLocaleTimeString())
    }

    const intervalId = setInterval(tick, intervalMs)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Resume immediately on return to the tab.
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, disabled, intervalMs, refetch])

  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
          aria-label="Auto refresh every 30 seconds"
        />
        Auto refresh
      </label>
      {enabled && lastTick && (
        <span className="text-xs text-zinc-500" aria-live="polite">
          Updated {lastTick}
        </span>
      )}
    </div>
  )
}
