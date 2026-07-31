// ProxyAI — Standard API Response Helpers
// Blueprint Reference: Sprint 9 §58-59 — API Standards & Response Contract
// Design Review Wallet §3 — Standard Response Contract (approved):
//   Success: { success: true, data, request_id }
//   Error:   { success: false, error: { code, message, details }, request_id }
// Every response carries a request_id + X-Request-Id header.

import { NextResponse } from 'next/server'
import { generateRequestId } from '@/lib/request-id'

export const REQUEST_ID_HEADER = 'X-Request-Id'

interface ResponseOptions {
  status?: number
  headers?: Record<string, string>
  requestId?: string
}

export interface ErrorDetails {
  [key: string]: unknown
}

function buildHeaders(requestId: string, extra?: Record<string, string>): Record<string, string> {
  return {
    [REQUEST_ID_HEADER]: requestId,
    ...extra,
  }
}

/**
 * Success response: { success: true, data, request_id }
 */
export function jsonSuccess<T>(
  data: T,
  options: ResponseOptions = {}
): NextResponse {
  const requestId = options.requestId ?? generateRequestId()

  return NextResponse.json(
    {
      success: true,
      data,
      request_id: requestId,
    },
    {
      status: options.status ?? 200,
      headers: buildHeaders(requestId, options.headers),
    }
  )
}

/**
 * Error response: { success: false, error: { code, message, details }, request_id }
 * Never includes stack traces.
 */
export function jsonError(
  code: string,
  message: string,
  options: ResponseOptions & { details?: ErrorDetails } = {}
): NextResponse {
  const requestId = options.requestId ?? generateRequestId()

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details: options.details ?? {},
      },
      request_id: requestId,
    },
    {
      status: options.status ?? 400,
      headers: buildHeaders(requestId, options.headers),
    }
  )
}
