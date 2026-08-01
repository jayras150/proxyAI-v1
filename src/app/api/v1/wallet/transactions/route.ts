// ProxyAI — GET /api/v1/wallet/transactions
// Cursor pagination with search, type, status, and date range filters.

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { transactionsQuerySchema } from '@/lib/wallet-validation'
import type { TransactionType, TransactionStatus } from '@prisma/client'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)

  try {
    const payload = getAuthenticatedUser(request)

    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.walletRead,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

    const { searchParams } = new URL(request.url)

    const parsed = transactionsQuerySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      date_from: searchParams.get('date_from') ?? undefined,
      date_to: searchParams.get('date_to') ?? undefined,
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
    const wallet = await walletService.getWallet(payload.sub)
    if (!wallet) {
      throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
    }

    const filters: {
      type?: TransactionType
      status?: TransactionStatus
      dateFrom?: Date
      dateTo?: Date
      search?: string
    } = {}

    if (parsed.data.type) filters.type = parsed.data.type as TransactionType
    if (parsed.data.status) filters.status = parsed.data.status as TransactionStatus
    if (parsed.data.date_from) filters.dateFrom = new Date(parsed.data.date_from)
    if (parsed.data.date_to) filters.dateTo = new Date(parsed.data.date_to)
    if (parsed.data.search) filters.search = parsed.data.search

    const page = await transactionService.getWalletHistory(
      wallet.id,
      parsed.data.cursor ?? null,
      parsed.data.limit ?? 20,
      filters
    )

    logApiRequest({
      endpoint: 'GET /api/v1/wallet/transactions',
      correlationId,
      userId: payload.sub,
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
          request_id: tx.requestId,
          provider_reference: tx.providerReference,
          created_by: tx.createdBy,
          ip_address: tx.ipAddress,
          user_agent: tx.userAgent,
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
      endpoint: 'GET /api/v1/wallet/transactions',
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
