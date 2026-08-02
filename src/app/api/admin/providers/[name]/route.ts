// ProxyAI — GET, PATCH /api/admin/providers/:name
// Admin provider detail and update.

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminProvidersService } from '@/server/admin/providers/admin-providers.service'
import { writeAuditLog } from '@/server/admin/audit'

const providersService = new AdminProvidersService()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:providers:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { name } = await params
    const provider = await providersService.getProvider(name)

    if (!provider) {
      return jsonError('NOT_FOUND', 'Provider not found.', { status: 404 })
    }

    return jsonSuccess(provider, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:providers:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { name } = await params
    const body = await request.json()

    await providersService.updateProvider(name, body, admin.sub)

    await writeAuditLog({
      adminId: admin.sub,
      action: 'provider.updated',
      resource: `provider:${name}`,
      afterValue: body as Record<string, unknown>,
    })

    return jsonSuccess({ name })
  } catch (error) {
    return mapApiError(error)
  }
}
