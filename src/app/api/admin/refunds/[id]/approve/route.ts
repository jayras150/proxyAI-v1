// ProxyAI — POST /api/admin/refunds/:id/approve
// Admin approve refund request. Uses existing refund service.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { getApiServices } from '@/server/composition'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requireAdminPermission(request, 'admin:refund:approve')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params

    // Find the pending refund request
    const refundReq = await prisma.refundRequest.findUnique({ where: { id } })
    if (!refundReq) {
      return jsonError('NOT_FOUND', 'Refund request not found.', { status: 404 })
    }
    if (refundReq.status !== 'REQUESTED') {
      return jsonError('CONFLICT', `Refund request is in status ${refundReq.status}, not REQUESTED.`, { status: 409 })
    }

    // Mark as APPROVED
    await prisma.refundRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: `admin:${admin.sub}` },
    })

    // Use existing refund service to process
    const { refundService } = getApiServices()
    const result = await refundService.refund({
      usageLogId: refundReq.usageLogId,
      userId: refundReq.userId,
      idempotencyKey: `admin_approve_${id}`,
      requestedBy: `admin:${admin.sub}`,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        adminId: admin.sub,
        action: 'refund.approved',
        resource: `refund:${id}`,
        afterValue: {
          refund_id: id,
          usage_log_id: refundReq.usageLogId,
          transaction_id: result.transactionId,
          amount: result.amount,
        },
        status: 'COMPLETED',
      },
    })

    return jsonSuccess({
      refund_request_id: id,
      transaction_id: result.transactionId,
      amount: result.amount,
      currency: result.currency,
      usage_status: result.usageStatus,
      refund_status: result.refundStatus,
    })
  } catch (error) {
    return mapApiError(error)
  }
}
