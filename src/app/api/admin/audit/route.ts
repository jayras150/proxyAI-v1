// ProxyAI — GET /api/admin/audit
// Admin audit log viewer with filters and cursor pagination.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const auditQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  admin_id: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  search: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:audit:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const parsed = auditQuerySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      admin_id: searchParams.get('admin_id') ?? undefined,
      action: searchParams.get('action') ?? undefined,
      resource: searchParams.get('resource') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      date_from: searchParams.get('date_from') ?? undefined,
      date_to: searchParams.get('date_to') ?? undefined,
    })
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid query.', { status: 400 })
    }

    const where: Prisma.AuditLogWhereInput = {}
    if (parsed.data.admin_id) where.adminId = { contains: parsed.data.admin_id }
    if (parsed.data.action) where.action = { contains: parsed.data.action, mode: 'insensitive' }
    if (parsed.data.resource) where.resource = { contains: parsed.data.resource, mode: 'insensitive' }
    if (parsed.data.search) {
      where.OR = [
        { action: { contains: parsed.data.search, mode: 'insensitive' } },
        { resource: { contains: parsed.data.search, mode: 'insensitive' } },
        { adminId: { contains: parsed.data.search, mode: 'insensitive' } },
      ]
    }
    if (parsed.data.date_from || parsed.data.date_to) {
      where.createdAt = {}
      if (parsed.data.date_from) where.createdAt.gte = new Date(parsed.data.date_from)
      if (parsed.data.date_to) where.createdAt.lte = new Date(parsed.data.date_to)
    }

    const limit = parsed.data.limit
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
    })

    const hasMore = logs.length > limit
    const items = hasMore ? logs.slice(0, limit) : logs
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return jsonSuccess({
      items: items.map((l) => ({
        id: l.id,
        admin_id: l.adminId,
        action: l.action,
        resource: l.resource,
        before_value: l.beforeValue,
        after_value: l.afterValue,
        status: l.status,
        ip_address: l.ipAddress,
        created_at: l.createdAt.toISOString(),
      })),
      next_cursor: nextCursor,
      has_more: hasMore,
    }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
