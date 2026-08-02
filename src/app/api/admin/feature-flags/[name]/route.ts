// ProxyAI — PATCH /api/admin/feature-flags/:name
// Toggle a feature flag.

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminSystemService } from '@/server/admin/system/admin-system.service'
import { writeAuditLog } from '@/server/admin/audit'
import { z } from 'zod'

const systemService = new AdminSystemService()

const toggleSchema = z.object({
  enabled: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:settings:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { name } = await params
    const body = await request.json()
    const parsed = toggleSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid request.', { status: 400 })
    }

    await systemService.toggleFeatureFlag(name, parsed.data.enabled, admin.sub)

    await writeAuditLog({
      adminId: admin.sub,
      action: parsed.data.enabled ? 'feature_flag.enabled' : 'feature_flag.disabled',
      resource: `feature_flag:${name}`,
    })

    return jsonSuccess({ name, enabled: parsed.data.enabled })
  } catch (error) {
    return mapApiError(error)
  }
}
