// ProxyAI — GET /api/admin/users
// Admin user list with search, filter, cursor pagination.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const userListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:users:read')

    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const parsed = userListQuerySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      role: searchParams.get('role') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    })
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid query.', { status: 400 })
    }

    const where: Prisma.UserWhereInput = {}
    if (parsed.data.search) {
      where.OR = [
        { email: { contains: parsed.data.search, mode: 'insensitive' } },
        { name: { contains: parsed.data.search, mode: 'insensitive' } },
        { id: { contains: parsed.data.search, mode: 'insensitive' } },
      ]
    }
    if (parsed.data.role) where.role = parsed.data.role as Prisma.EnumRoleFilter['equals']
    if (parsed.data.status) where.status = parsed.data.status as Prisma.EnumUserStatusFilter['equals']

    const limit = parsed.data.limit
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
      select: {
        id: true, email: true, name: true, role: true, status: true, createdAt: true,
        _count: { select: { apiKeys: true, sessions: true } },
      },
    })

    const hasMore = users.length > limit
    const items = hasMore ? users.slice(0, limit) : users
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return jsonSuccess({
      items: items.map((u) => ({
        id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
        api_keys_count: u._count.apiKeys,
        sessions_count: u._count.sessions,
        created_at: u.createdAt.toISOString(),
      })),
      next_cursor: nextCursor,
      has_more: hasMore,
    }, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
