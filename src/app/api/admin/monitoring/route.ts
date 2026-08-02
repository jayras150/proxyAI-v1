// ProxyAI — GET /api/admin/monitoring
// System monitoring: component health, uptime, build info, rates.

import { NextRequest } from 'next/server'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { SystemMonitoringService } from '@/server/admin/analytics/system-monitoring.service'

const monitoringService = new SystemMonitoringService()

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:dashboard:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const monitoring = await monitoringService.getMonitoring()
    return jsonSuccess(monitoring, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
