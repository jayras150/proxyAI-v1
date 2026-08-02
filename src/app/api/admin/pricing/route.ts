// ProxyAI — GET /api/admin/pricing, POST /api/admin/pricing
// Admin pricing version list and create.

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminPricingService } from '@/server/admin/pricing/admin-pricing.service'
import { writeAuditLog } from '@/server/admin/audit'
import { z } from 'zod'

const pricingService = new AdminPricingService()

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  model_id: z.string().optional(),
  status: z.string().optional(),
})

const createPricingSchema = z.object({
  model_id: z.string().min(1),
  input_price: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Must be a decimal string (max 6dp)'),
  output_price: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Must be a decimal string (max 6dp)'),
  markup_percent: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string (max 2dp)').optional(),
  service_fee: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Must be a decimal string (max 6dp)').optional(),
  currency: z.string().optional(),
  effective_from: z.string().min(1),
  effective_to: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:pricing:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const parsed = listQuerySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      model_id: searchParams.get('model_id') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    })
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid query.', { status: 400 })
    }

    const result = await pricingService.list({
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      modelId: parsed.data.model_id,
      status: parsed.data.status,
    })
    return jsonSuccess(result, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:pricing:write')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const body = await request.json()
    const parsed = createPricingSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', parsed.error.issues[0].message, { status: 400 })
    }

    const version = await pricingService.create({
      modelId: parsed.data.model_id,
      inputPrice: parsed.data.input_price,
      outputPrice: parsed.data.output_price,
      markupPercent: parsed.data.markup_percent,
      serviceFee: parsed.data.service_fee,
      currency: parsed.data.currency,
      effectiveFrom: parsed.data.effective_from,
      effectiveTo: parsed.data.effective_to ?? null,
    }, admin.sub)

    await writeAuditLog({
      adminId: admin.sub,
      action: 'pricing.created',
      resource: `pricing:${version.id}`,
      afterValue: parsed.data as unknown as Record<string, unknown>,
    })

    return jsonSuccess({
      id: version.id,
      version: version.version,
      status: version.status,
      model_id: version.modelId,
    }, { status: 201 })
  } catch (error) {
    return mapApiError(error)
  }
}
