// ProxyAI — PATCH /api/admin/models/:id/toggle
// Toggle model enabled/disabled.

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminModelsService } from '@/server/admin/models/admin-models.service'
import { writeAuditLog } from '@/server/admin/audit'
import { z } from 'zod'

const modelsService = new AdminModelsService()

const toggleSchema = z.object({
  enabled: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:billing:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params
    const body = await request.json()
    const parsed = toggleSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid request.', { status: 400 })
    }

    await modelsService.toggleEnabled(id, parsed.data.enabled)

    await writeAuditLog({
      adminId: admin.sub,
      action: parsed.data.enabled ? 'model.enabled' : 'model.disabled',
      resource: `model:${id}`,
    })

    return jsonSuccess({ id, enabled: parsed.data.enabled }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
