// ProxyAI — POST /api/admin/pricing/:id/activate
// Activate a pricing version.

import { NextRequest } from 'next/server'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminPricingService } from '@/server/admin/pricing/admin-pricing.service'
import { writeAuditLog } from '@/server/admin/audit'

const pricingService = new AdminPricingService()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:pricing:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params
    const result = await pricingService.activate(id, admin.sub)

    await writeAuditLog({
      adminId: admin.sub,
      action: 'pricing.activated',
      resource: `pricing:${id}`,
      afterValue: result as unknown as Record<string, unknown>,
    })

    return jsonSuccess(result, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
