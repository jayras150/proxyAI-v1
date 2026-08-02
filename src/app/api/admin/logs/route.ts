// ProxyAI — GET /api/admin/logs
// Read-only unified log stream (errors, requests, admin actions, refunds, wallet).

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { LogsService } from '@/server/admin/analytics/logs.service'
import { z } from 'zod'

const logsService = new LogsService()

const logsQuerySchema = z.object({
  type: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:audit:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const parsed = logsQuerySchema.safeParse({
      type: searchParams.get('type') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid logs query.', { status: 400 })
    }

    const result = await logsService.list(parsed.data)
    return jsonSuccess(result, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
