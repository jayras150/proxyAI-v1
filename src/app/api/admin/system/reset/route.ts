// ProxyAI — POST /api/admin/system/reset
// Reset system configuration to defaults.

import { NextRequest } from 'next/server'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminSystemService } from '@/server/admin/system/admin-system.service'
import { writeAuditLog } from '@/server/admin/audit'

const systemService = new AdminSystemService()

export async function POST(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:settings:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    await systemService.resetConfig(admin.sub)

    await writeAuditLog({
      adminId: admin.sub,
      action: 'system.config_reset',
      resource: 'system:config',
    })

    return jsonSuccess({ reset: true }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
