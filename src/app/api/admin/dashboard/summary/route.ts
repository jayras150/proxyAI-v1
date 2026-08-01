// ProxyAI — GET /api/admin/dashboard/summary
// Admin overview dashboard data.

import { NextRequest } from 'next/server'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminDashboardService } from '@/server/admin/dashboard/summary.service'

const dashboardService = new AdminDashboardService()

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:dashboard:read')

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRead,
      identity: admin.sub,
    })
    if (rate.limited) return rate.response

    const summary = await dashboardService.getSummary()

    return jsonSuccess(summary, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
