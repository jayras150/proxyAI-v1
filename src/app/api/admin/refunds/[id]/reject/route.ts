// ProxyAI — POST /api/admin/refunds/:id/reject
// Admin reject refund request.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { z } from 'zod'

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
})

const ENDPOINT = 'POST /api/admin/refunds/:id/reject'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  try {
    const admin = requireAdminPermission(request, 'admin:refund:reject')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = rejectSchema.safeParse(body)

    const refund = await prisma.refundRequest.findUnique({ where: { id } })
    if (!refund) {
      const response = jsonError('NOT_FOUND', 'Refund request not found.', { status: 404 })
      logApiRequest({
        endpoint: ENDPOINT,
        correlationId,
        userId: admin.sub,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      })
      return response
    }
    if (refund.status !== 'REQUESTED') {
      const response = jsonError('CONFLICT', 'Refund request is not in REQUESTED status.', { status: 409 })
      logApiRequest({
        endpoint: ENDPOINT,
        correlationId,
        userId: admin.sub,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      })
      return response
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

    const response = jsonSuccess({ message: 'Refund request rejected.' })
    logApiRequest({
      endpoint: ENDPOINT,
      correlationId,
      userId: admin.sub,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint: ENDPOINT,
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
