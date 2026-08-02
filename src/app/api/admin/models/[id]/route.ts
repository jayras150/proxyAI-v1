// ProxyAI — GET, PATCH /api/admin/models/:id
// Admin model detail and update.

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

const updateModelSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  provider: z.string().min(1).max(100).optional(),
  modelId: z.string().min(1).max(200).optional(),
  contextWindow: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
  capabilities: z.object({
    streaming: z.boolean().optional(),
    reasoning: z.boolean().optional(),
    vision: z.boolean().optional(),
    jsonMode: z.boolean().optional(),
    toolCalling: z.boolean().optional(),
    embeddings: z.boolean().optional(),
    imageGeneration: z.boolean().optional(),
  }).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:billing:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params
    const model = await modelsService.getById(id)

    if (!model) {
      return jsonError('NOT_FOUND', 'Model not found.', { status: 404 })
    }

    return jsonSuccess(model, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}

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
    const parsed = updateModelSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', parsed.error.issues[0].message, { status: 400 })
    }

    await modelsService.update(id, parsed.data, admin.sub)

    await writeAuditLog({
      adminId: admin.sub,
      action: 'model.updated',
      resource: `model:${id}`,
      afterValue: parsed.data as unknown as Record<string, unknown>,
    })

    return jsonSuccess({ id })
  } catch (error) {
    return mapApiError(error)
  }
}
