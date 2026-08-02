// ProxyAI — GET /api/admin/providers/analytics
// Provider analytics: latency, success rate, tokens, cost, health timeline.
//
// NOTE: static route takes precedence over /api/admin/providers/[name]
// (Next.js resolves static segments before dynamic ones).

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { ProviderAnalyticsService } from '@/server/admin/analytics/provider-analytics.service'
import { parseAnalyticsQuery } from '@/server/admin/analytics/filters'

const analyticsService = new ProviderAnalyticsService()

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:analytics:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const query = parseAnalyticsQuery(new URL(request.url).searchParams)
    if (!query) {
      return jsonError('VALIDATION_ERROR', 'Invalid analytics query.', { status: 400 })
    }

    const result = await analyticsService.getAnalytics(query)
    return jsonSuccess(result, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
