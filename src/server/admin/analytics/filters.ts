// ProxyAI — Analytics Query Filters (Milestone 4)
// Shared Zod schema + parser for all analytics endpoints.
// Avoids duplicating filter validation across routes.

import { z } from 'zod'

export const analyticsQuerySchema = z.object({
  range: z.enum(['today', 'yesterday', '7d', '30d', 'custom']).optional().default('today'),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  user: z.string().optional().nullable(),
})

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>

/**
 * Parse analytics query params from a URLSearchParams instance.
 * Returns null when validation fails.
 */
export function parseAnalyticsQuery(searchParams: URLSearchParams): AnalyticsQuery | null {
  const parsed = analyticsQuerySchema.safeParse({
    range: searchParams.get('range') ?? undefined,
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    provider: searchParams.get('provider'),
    model: searchParams.get('model'),
    user: searchParams.get('user'),
  })
  return parsed.success ? parsed.data : null
}
