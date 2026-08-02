// ProxyAI — GET /api/admin/feature-flags
// List all feature flags.

import { NextRequest } from 'next/server'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminSystemService } from '@/server/admin/system/admin-system.service'

const systemService = new AdminSystemService()

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:settings:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const flags = await systemService.getFeatureFlags()
    return jsonSuccess({ flags }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
