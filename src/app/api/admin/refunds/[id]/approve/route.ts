// ProxyAI — POST /api/admin/refunds/:id/approve
// Admin approve refund request — processes the existing request ATOMICALLY
// via RefundService.adminApprove (one transaction: credit wallet + mark usage
// REFUNDED + complete the request). Idempotent per request id.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSuccess } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { getApiServices } from '@/server/composition'
import { generateRequestId } from '@/lib/request-id'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'

const ENDPOINT = 'POST /api/admin/refunds/:id/approve'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  try {
    const admin = requireAdminPermission(request, 'admin:refund:approve')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const { id } = await params

    // Single atomic transaction — nothing is persisted unless the whole
    // refund (credit + usage REFUNDED + request COMPLETED) succeeds.
    const { refundService } = getApiServices()
    const result = await refundService.adminApprove({
      refundRequestId: id,
      adminId: admin.sub,
      requestId: generateRequestId(),
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    // Audit log (post-commit; failure here does not roll back the refund).
    await prisma.auditLog.create({
      data: {
        adminId: admin.sub,
        action: 'refund.approved',
        resource: `refund:${id}`,
        afterValue: {
          refund_id: id,
          usage_log_id: result.usageLogId,
          transaction_id: result.transactionId,
          amount: result.amount,
          replayed: result.replayed,
        },
        status: 'COMPLETED',
      },
    })

    const response = jsonSuccess({
      refund_request_id: id,
      transaction_id: result.transactionId,
      amount: result.amount,
      currency: result.currency,
      usage_status: result.usageStatus,
      refund_status: result.refundStatus,
      wallet_balance_after: result.walletBalanceAfter,
      replayed: result.replayed,
    })
    logApiRequest({
      endpoint: ENDPOINT,
      correlationId,
      userId: admin.sub,
      transactionId: result.transactionId,
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
