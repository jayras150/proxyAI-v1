// ProxyAI — GET /api/v1/transactions
// Billing Milestone 8 — REST API Layer
// Cursor-paginated wallet transaction history (reuses the wallet API
// TransactionService — no billing logic here).

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { usageQuerySchema } from '@/lib/ai-validation'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)
  const endpoint = 'GET /api/v1/transactions'

  try {
    const identity = await authenticateRequest(request, getApiServices().apiKeyRepository)

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRead,
      identity: identity.apiKeyId ?? identity.userId,
    })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)
    const parsed = usageQuerySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      const details = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])
      )
      return jsonError('VALIDATION_ERROR', 'Invalid query parameters.', {
        status: 400,
        details,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const { walletService, transactionService } = getApiServices()
    const wallet = await walletService.getWallet(identity.userId)
    if (!wallet) {
      throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
    }

    const page = await transactionService.getWalletHistory(
      wallet.id,
      parsed.data.cursor ?? null,
      parsed.data.limit ?? 20
    )

    logApiRequest({
      endpoint,
      correlationId,
      userId: identity.userId,
      walletId: wallet.id,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        items: page.items.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount.toFixed(6),
          balance_before: tx.balanceBefore.toFixed(6),
          balance_after: tx.balanceAfter.toFixed(6),
          currency: tx.currency,
          status: tx.status,
          reference: tx.reference,
          description: tx.description,
          created_at: tx.createdAt.toISOString(),
        })),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
      { headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint,
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
