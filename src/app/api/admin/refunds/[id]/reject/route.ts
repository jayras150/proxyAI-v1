// ProxyAI — POST /api/admin/refunds/:id/reject
// Admin reject refund request.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { z } from 'zod'

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:refund:reject')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = rejectSchema.safeParse(body)

    const refund = await prisma.refundRequest.findUnique({ where: { id } })
    if (!refund) {
      return jsonError('NOT_FOUND', 'Refund request not found.', { status: 404 })
    }
    if (refund.status !== 'REQUESTED') {
      return jsonError('CONFLICT', 'Refund request is not in REQUESTED status.', { status: 409 })
    }

    await prisma.refundRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: `admin:${admin.sub}`,
        rejectionReason: parsed.success ? parsed.data.reason ?? null : null,
      },
    })

    await prisma.auditLog.create({
      data: {
        adminId: admin.sub,
        action: 'refund.rejected',
        resource: `refund:${id}`,
        afterValue: { reason: parsed.success ? parsed.data.reason : null },
        status: 'COMPLETED',
      },
    })

    return jsonSuccess({ message: 'Refund request rejected.' })
  } catch (error) {
    return mapApiError(error)
  }
}
