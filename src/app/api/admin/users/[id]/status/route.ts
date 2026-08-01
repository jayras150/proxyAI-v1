// ProxyAI — PATCH /api/admin/users/:id/status
// Suspend/unsuspend/lock user.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { z } from 'zod'
const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().max(500).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:users:suspend')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params
    const body = await request.json()
    const parsed = statusSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', parsed.error.issues[0].message, { status: 400 })
    }

    // Cannot suspend yourself
    if (id === admin.sub && parsed.data.status === 'SUSPENDED') {
      return jsonError('VALIDATION_ERROR', 'Cannot suspend your own account.', { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (!user) {
      return jsonError('NOT_FOUND', 'User not found.', { status: 404 })
    }

    // Cannot suspend SUPER_ADMIN
    if (user.role === 'SUPER_ADMIN' && parsed.data.status === 'SUSPENDED') {
      return jsonError('VALIDATION_ERROR', 'Cannot suspend a SUPER_ADMIN.', { status: 400 })
    }

    await prisma.user.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        adminId: admin.sub,
        action: parsed.data.status === 'SUSPENDED' ? 'user.suspended' : 'user.unsuspended',
        resource: `user:${id}`,
        afterValue: { status: parsed.data.status, reason: parsed.data.reason },
        status: 'COMPLETED',
      },
    })

    return jsonSuccess({ message: `User ${parsed.data.status === 'SUSPENDED' ? 'suspended' : 'activated'}.` })
  } catch (error) {
    return mapApiError(error)
  }
}


