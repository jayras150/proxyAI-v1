// ProxyAI — PATCH /api/admin/models/:id/archive
// Archive (soft-disable) an AI model.

import { NextRequest } from 'next/server'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminModelsService } from '@/server/admin/models/admin-models.service'
import { writeAuditLog } from '@/server/admin/audit'

const modelsService = new AdminModelsService()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:billing:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params
    await modelsService.archive(id)

    await writeAuditLog({
      adminId: admin.sub,
      action: 'model.archived',
      resource: `model:${id}`,
    })

    return jsonSuccess({ id, archived: true }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
