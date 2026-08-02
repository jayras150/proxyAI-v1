// ProxyAI — GET /api/admin/models, POST /api/admin/models
// Admin AI model list and create.

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

const modelListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  provider: z.string().optional(),
  enabled: z.coerce.boolean().optional(),
})

const createModelSchema = z.object({
  displayName: z.string().min(1).max(200),
  provider: z.string().min(1).max(100),
  modelId: z.string().min(1).max(200),
  contextWindow: z.number().int().positive(),
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

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:billing:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const parsed = modelListQuerySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      provider: searchParams.get('provider') ?? undefined,
      enabled: searchParams.get('enabled') ?? undefined,
    })
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid query.', { status: 400 })
    }

    const result = await modelsService.list(parsed.data)
    return jsonSuccess(result, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:billing:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const body = await request.json()
    const parsed = createModelSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', parsed.error.issues[0].message, { status: 400 })
    }

    const model = await modelsService.create(parsed.data, admin.sub)

    await writeAuditLog({
      adminId: admin.sub,
      action: 'model.created',
      resource: `model:${model.id}`,
      afterValue: parsed.data as unknown as Record<string, unknown>,
    })

    return jsonSuccess({ id: model.id }, { status: 201 })
  } catch (error) {
    return mapApiError(error)
  }
}
