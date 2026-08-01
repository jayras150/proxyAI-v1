// ProxyAI — GET /api/admin/refunds
// Admin refund list with search, filter, cursor pagination.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { z } from 'zod'

const refundListSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().optional(),
  search: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:refund:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const parsed = refundListSchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    })
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid query.', { status: 400 })
    }

    const where: Record<string, unknown> = {}
    if (parsed.data.status) where.status = parsed.data.status
    if (parsed.data.search) {
      where.OR = [
        { id: { contains: parsed.data.search, mode: 'insensitive' } },
        { reason: { contains: parsed.data.search, mode: 'insensitive' } },
      ]
    }

    const limit = parsed.data.limit
    const refunds = await prisma.refundRequest.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    })

    const hasMore = refunds.length > limit
    const items = hasMore ? refunds.slice(0, limit) : refunds
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return jsonSuccess({
      items: items.map((r) => ({
        id: r.id, user_id: r.userId, usage_log_id: r.usageLogId,
        amount: r.amount.toFixed(6), currency: r.currency,
        status: r.status, reason: r.reason,
        requested_by: r.requestedBy,
        approved_by: r.approvedBy,
        created_at: r.createdAt.toISOString(),
      })),
      next_cursor: nextCursor,
      has_more: hasMore,
    }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
