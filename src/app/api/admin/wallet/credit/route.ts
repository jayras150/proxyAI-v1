// ProxyAI — POST /api/admin/wallet/credit
// Admin credit wallet. Atomic, idempotent, audited.

import { NextRequest } from 'next/server'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { AdminWalletService } from '@/server/admin/wallet/admin-wallet.service'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { z } from 'zod'

const creditSchema = z.object({
  wallet_id: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Amount must be a decimal string'),
  reason: z.string().min(1).max(500),
  idempotency_key: z.string().min(1),
})

const walletService = new AdminWalletService()

const ENDPOINT = 'POST /api/admin/wallet/credit'

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  try {
    const admin = requireAdminPermission(request, 'admin:wallet:credit')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const body = await request.json()
    const parsed = creditSchema.safeParse(body)
    if (!parsed.success) {
      const response = jsonError('VALIDATION_ERROR', parsed.error.issues[0].message, { status: 400 })
      logApiRequest({
        endpoint: ENDPOINT,
        correlationId,
        userId: admin.sub,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      })
      return response
    }

    const result = await walletService.creditWallet(
      parsed.data.wallet_id,
      parsed.data.amount,
      parsed.data.reason,
      admin.sub,
      parsed.data.idempotency_key
    )

    // Audit
    const { prisma } = await import('@/lib/prisma')
    await prisma.auditLog.create({
      data: {
        adminId: admin.sub,
        action: 'wallet.credited',
        resource: `wallet:${parsed.data.wallet_id}`,
        afterValue: { amount: parsed.data.amount, reason: parsed.data.reason },
        status: 'COMPLETED',
      },
    })

    const response = jsonSuccess(result, { status: 201 })
    logApiRequest({
      endpoint: ENDPOINT,
      correlationId,
      userId: admin.sub,
      walletId: parsed.data.wallet_id,
      transactionId: result.transaction_id,
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
