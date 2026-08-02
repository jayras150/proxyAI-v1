// ProxyAI — GET /api/admin/analytics
// Business analytics: revenue, users, requests, wallet activity, top users.

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { BusinessAnalyticsService } from '@/server/admin/analytics/business-analytics.service'
import { parseAnalyticsQuery } from '@/server/admin/analytics/filters'

const analyticsService = new BusinessAnalyticsService()

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
