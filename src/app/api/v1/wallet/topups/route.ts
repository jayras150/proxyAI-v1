// ProxyAI — POST /api/v1/wallet/topups
// Blueprint Reference: Sprint 9 §64, Design Review Wallet — Topup Flow
// Idempotency: X-Idempotency-Key header (reusable IdempotencyService).

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { getApiServices } from '@/server/composition'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { getCorrelationId, logApiRequest } from '@/lib/api-request'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { createTopupSchema } from '@/lib/wallet-validation'
import { Money } from '@/lib/money'
import { IdempotencyError, IdempotencyErrorCode } from '@/server/idempotency/idempotency.service'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'

const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key'
const IDEMPOTENCY_SCOPE = 'wallet:topup'

// ProxyAI — GET /api/v1/wallet/topups
// List top-up requests for the authenticated user (cursor pagination).
// Backend Gap (Design Review approved): additive endpoint, no existing contract changed.

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
    const cursor = searchParams.get('cursor') ?? undefined
    const limitRaw = searchParams.get('limit') ?? undefined
    const limit = limitRaw ? Number(limitRaw) : undefined

    const { topupService } = getApiServices()
    const page = await topupService.listTopups(
      payload.sub,
      cursor ?? null,
      limit
    )

    logApiRequest({
      endpoint: 'GET /api/v1/wallet/topups',
      correlationId,
      userId: payload.sub,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        items: page.items.map((t) => ({
          id: t.id,
          status: t.status,
          amount: t.amount.toFixed(6),
          currency: t.currency,
          provider: t.provider,
          provider_reference: t.providerReference,
          transaction_id: t.transactionId,
          expires_at: t.expiresAt.toISOString(),
          created_at: t.createdAt.toISOString(),
        })),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
      { headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint: 'GET /api/v1/wallet/topups',
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = getCorrelationId(request)

  try {
    const payload = getAuthenticatedUser(request)

    // Rate limit keyed by userId (JWT subject), fallback IP.
    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.walletTopup,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

    const idempotencyKey = request.headers.get(IDEMPOTENCY_KEY_HEADER)

    if (!idempotencyKey) {
      return jsonError('VALIDATION_ERROR', 'X-Idempotency-Key header is required.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const body = await request.json().catch(() => null)
    const parsed = createTopupSchema.safeParse(body)
    if (!parsed.success) {
      const details = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])
      )
      return jsonError('VALIDATION_ERROR', 'Invalid request body.', {
        status: 400,
        details,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const { topupService, idempotencyService, walletService } = getApiServices()

    // Reserve idempotency key BEFORE creating anything.
    const reservation = await idempotencyService.reserve({
      key: idempotencyKey,
      scope: IDEMPOTENCY_SCOPE,
      userId: payload.sub,
      request: parsed.data,
    })

    if (reservation.state === 'replay') {
      // Same request retried → replay stored response (already snake_case).
      const replayed = reservation.response as unknown as {
        topup: { id: string; status: string }
        payment: { provider_reference: string; checkout_url: string | null; token: string | null; expires_at: string }
      }
      if (replayed?.topup?.id) {
        return jsonSuccess(replayed, {
          status: 200,
          headers: rateLimitHeaders(rate.result),
        })
      }
      throw new IdempotencyError(
        IdempotencyErrorCode.NOT_FOUND,
        'Stored idempotency response is not a valid topup result.'
      )
    }

    // Wallet lookup to resolve currency (amount is validated against it).
    const wallet = await walletService.getWallet(payload.sub)
    if (!wallet) {
      throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
    }

    const result = await topupService.createTopup({
      userId: payload.sub,
      amount: Money.fromString(parsed.data.amount, wallet.currency),
      requestId: correlationId,
      correlationId,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    // Complete idempotency record with the created topup response.
    await idempotencyService.complete(reservation.id, {
      topup: { id: result.topup.id, status: result.topup.status },
      payment: result.payment,
    })

    logApiRequest({
      endpoint: 'POST /api/v1/wallet/topups',
      correlationId,
      userId: payload.sub,
      walletId: wallet.id,
      topupId: result.topup.id,
      provider: result.payment.providerReference,
      statusCode: 201,
      durationMs: Date.now() - startedAt,
    })

    return jsonSuccess(
      {
        topup: {
          id: result.topup.id,
          status: result.topup.status,
          amount: result.topup.amount.toFixed(6),
          currency: result.topup.currency,
          expires_at: result.topup.expiresAt.toISOString(),
        },
        payment: {
          provider_reference: result.payment.providerReference,
          checkout_url: result.payment.checkoutUrl,
          token: result.payment.token,
          expires_at: result.payment.expiresAt.toISOString(),
        },
      },
      { status: 201, headers: rateLimitHeaders(rate.result) }
    )
  } catch (error) {
    const response = mapApiError(error)
    logApiRequest({
      endpoint: 'POST /api/v1/wallet/topups',
      correlationId,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }
}
