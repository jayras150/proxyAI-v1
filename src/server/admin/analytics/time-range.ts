// ProxyAI — Analytics Time Range (Milestone 4)
// Single source of truth for analytics date windows.
// All analytics endpoints resolve their window through this helper.

export type AnalyticsRange = 'today' | 'yesterday' | '7d' | '30d' | 'custom'

export interface TimeRange {
  /** Inclusive start (UTC). */
  from: Date
  /** Exclusive end (UTC). */
  to: Date
  label: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Resolve a range selector into concrete UTC boundaries.
 * `from`/`to` are only used when range === 'custom' (ISO date or datetime strings).
 */
export function resolveTimeRange(
  range: AnalyticsRange,
  from?: string | null,
  to?: string | null
): TimeRange {
  const now = new Date()

  switch (range) {
    case 'today': {
      const start = startOfUtcDay(now)
      return { from: start, to: now, label: 'Today' }
    }
    case 'yesterday': {
      const start = new Date(startOfUtcDay(now).getTime() - DAY_MS)
      return { from: start, to: startOfUtcDay(now), label: 'Yesterday' }
    }
    case '7d': {
      return { from: new Date(now.getTime() - 7 * DAY_MS), to: now, label: 'Last 7 days' }
    }
    case '30d': {
      return { from: new Date(now.getTime() - 30 * DAY_MS), to: now, label: 'Last 30 days' }
    }
    case 'custom': {
      if (!from) {
        return { from: new Date(now.getTime() - 7 * DAY_MS), to: now, label: 'Custom' }
      }
      const fromDate = new Date(from)
      const toDate = to ? new Date(to) : now
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return { from: new Date(now.getTime() - 7 * DAY_MS), to: now, label: 'Custom' }
      }
      if (toDate.getTime() <= fromDate.getTime()) {
        return { from: fromDate, to: now, label: 'Custom' }
      }
      return { from: fromDate, to: toDate, label: 'Custom' }
    }
  }
}

/**
 * Build a UTC date string (YYYY-MM-DD) for a given date.
 * Used for grouping usage logs into daily buckets.
 */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Enumerate daily buckets between from (inclusive) and to (exclusive).
 * Returns ISO day keys in chronological order.
 */
export function dayBuckets(from: Date, to: Date): string[] {
  const buckets: string[] = []
  const cursor = startOfUtcDay(from)
  // Compare against the raw `to` so a range ending mid-day still includes
  // its final calendar day (consistent with createdAt < to semantics).
  while (cursor.getTime() < to.getTime()) {
    buckets.push(cursor.toISOString().slice(0, 10))
    cursor.setTime(cursor.getTime() + DAY_MS)
  }
  return buckets
}

/**
 * Round-trip a numeric percentage to a fixed number of decimals as a string.
 */
export function percentString(numerator: number, denominator: number, decimals = 2): string {
  if (denominator <= 0) return '0.00'
  return ((numerator / denominator) * 100).toFixed(decimals)
}
