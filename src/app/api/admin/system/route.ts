// ProxyAI — GET /api/admin/system, PUT /api/admin/system
// Read and update system configuration.

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminSystemService } from '@/server/admin/system/admin-system.service'
import { writeAuditLog } from '@/server/admin/audit'

const systemService = new AdminSystemService()

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:settings:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const config = await systemService.getConfig()
    return jsonSuccess(config, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:settings:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const body = await request.json()
    if (!body || typeof body !== 'object') {
      return jsonError('VALIDATION_ERROR', 'Request body must be an object.', { status: 400 })
    }

    await systemService.saveConfig(body, admin.sub)

    await writeAuditLog({
      adminId: admin.sub,
      action: 'system.config_updated',
      resource: 'system:config',
      afterValue: body as Record<string, unknown>,
    })

    return jsonSuccess({ updated: true })
  } catch (error) {
    return mapApiError(error)
  }
}
