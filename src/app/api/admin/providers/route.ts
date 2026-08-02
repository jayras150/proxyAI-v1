// ProxyAI — GET /api/admin/providers
// Admin provider list.

import { NextRequest } from 'next/server'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminProvidersService } from '@/server/admin/providers/admin-providers.service'

const providersService = new AdminProvidersService()

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:providers:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const providers = await providersService.list()
    return jsonSuccess({ items: providers }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
