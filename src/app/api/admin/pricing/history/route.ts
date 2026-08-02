// ProxyAI — GET /api/admin/pricing/history
// Get pricing version history for a model.

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminPricingService } from '@/server/admin/pricing/admin-pricing.service'

const pricingService = new AdminPricingService()

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:pricing:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('model_id')
    if (!modelId) {
      return jsonError('VALIDATION_ERROR', 'model_id is required.', { status: 400 })
    }

    const history = await pricingService.getHistory(modelId)
    return jsonSuccess({ items: history }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
