// ProxyAI — API Request Helpers
// Blueprint Reference: Sprint 14 §108 — Structured Logging
// Shared helpers for request correlation + structured request logging.

import type { NextRequest } from 'next/server'
import { logger, type LogContext } from '@/lib/logger'

const CORRELATION_ID_HEADER = 'x-correlation-id'

/** Read the client-supplied correlation id, or generate one. */
export function getCorrelationId(request: NextRequest): string {
  return request.headers.get(CORRELATION_ID_HEADER) ?? crypto.randomUUID()
}

export interface RequestLogInput {
  endpoint: string
  requestId?: string
  correlationId?: string
  userId?: string
  walletId?: string
  topupId?: string
  transactionId?: string
  provider?: string
  statusCode: number
  durationMs: number
}

/**
 * Structured request log line (Blueprint §108 required fields).
 * Call in a finally block of every route handler.
 */
export function logApiRequest(input: RequestLogInput): void {
  const ctx: LogContext = {
    request_id: input.requestId,
    correlation_id: input.correlationId,
    user_id: input.userId,
    wallet_id: input.walletId,
    topup_id: input.topupId,
    transaction_id: input.transactionId,
    provider: input.provider,
    status_code: input.statusCode,
    duration_ms: input.durationMs,
    endpoint: input.endpoint,
  }
  logger.info('api.request', ctx)
}
