// ProxyAI — POST /api/admin/providers/:name/test
// Test connection to a provider.

import { NextRequest } from 'next/server'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminProvidersService } from '@/server/admin/providers/admin-providers.service'

const providersService = new AdminProvidersService()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:providers:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { name } = await params
    const result = await providersService.testConnection(name)

    return jsonSuccess(result, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
