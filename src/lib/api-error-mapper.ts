// ProxyAI — API Error Mapping
// Blueprint Reference: Design Review Wallet §8 — API Error Mapping
// Maps every domain error to the standard error envelope with an
// appropriate HTTP status. Routes never build error responses manually.
//
// NOTE: matching is name-based (Error.name), not instanceof — this is
// robust against duplicate module instances (e.g. vitest module isolation).

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { jsonError } from '@/lib/api-response'
import { WalletErrorCode } from '@/server/wallet/wallet.errors'
import { TopupErrorCode } from '@/server/topup/topup.service'
import { PaymentErrorCode } from '@/server/payments/payment.errors'
import { IdempotencyErrorCode } from '@/server/idempotency/idempotency.service'
import { GatewayErrorCode } from '@/server/gateway/ai-gateway'
import { EstimateErrorCode } from '@/server/billing/estimate.service'
import { RefundErrorCode } from '@/server/billing/refund.service'
import { ModelErrorCode } from '@/server/models/model.service'

interface DomainErrorLike extends Error {
  code?: string
}

const WALLET_STATUS: Record<string, number> = {
  [WalletErrorCode.WALLET_NOT_FOUND]: 404,
  [WalletErrorCode.WALLET_SUSPENDED]: 403,
  [WalletErrorCode.WALLET_LOCKED]: 423,
  [WalletErrorCode.INSUFFICIENT_BALANCE]: 409,
  [WalletErrorCode.CURRENCY_MISMATCH]: 400,
  [WalletErrorCode.INVALID_AMOUNT]: 400,
}

const TOPUP_STATUS: Record<string, number> = {
  [TopupErrorCode.TOPUP_NOT_FOUND]: 404,
  [TopupErrorCode.INVALID_STATE_TRANSITION]: 409,
  [TopupErrorCode.PAYMENT_AMOUNT_MISMATCH]: 409,
  [TopupErrorCode.PAYMENT_CURRENCY_MISMATCH]: 400,
  [TopupErrorCode.PROVIDER_REFERENCE_MISSING]: 409,
}

const PAYMENT_STATUS: Record<string, number> = {
  [PaymentErrorCode.INVALID_SIGNATURE]: 401,
  [PaymentErrorCode.UNSUPPORTED_PROVIDER]: 500,
  [PaymentErrorCode.PROVIDER_ERROR]: 502,
  [PaymentErrorCode.INVALID_PAYLOAD]: 400,
  [PaymentErrorCode.UNSUPPORTED_STATUS]: 400,
}

// Billing Milestone 8 — AI Gateway / Billing Orchestrator
const GATEWAY_STATUS: Record<string, number> = {
  [GatewayErrorCode.VALIDATION_FAILED]: 400,
  // Estimate rejected → 402 (Payment Required); the wallet gate reasons
  // (LOCKED/SUSPENDED) are surfaced in the error details.
  [GatewayErrorCode.ESTIMATE_REJECTED]: 402,
  [GatewayErrorCode.ESTIMATE_FAILED]: 500,
  [GatewayErrorCode.PROVIDER_TIMEOUT]: 504,
  [GatewayErrorCode.PROVIDER_ERROR]: 502,
  [GatewayErrorCode.MALFORMED_PROVIDER_RESPONSE]: 502,
  [GatewayErrorCode.USAGE_PARSE_FAILED]: 502,
  [GatewayErrorCode.CHARGE_FAILED]: 500,
  [GatewayErrorCode.INTERNAL]: 500,
}

const ESTIMATE_STATUS: Record<string, number> = {
  [EstimateErrorCode.PRICING_NOT_FOUND]: 404,
  [EstimateErrorCode.WALLET_NOT_FOUND]: 404,
  [EstimateErrorCode.CURRENCY_MISMATCH]: 400,
  [EstimateErrorCode.ESTIMATE_FAILED]: 500,
}

const REFUND_STATUS: Record<string, number> = {
  [RefundErrorCode.USAGE_NOT_FOUND]: 404,
  [RefundErrorCode.USAGE_NOT_ELIGIBLE]: 409,
  [RefundErrorCode.ALREADY_REFUNDED]: 409,
  [RefundErrorCode.USER_MISMATCH]: 403,
  [RefundErrorCode.WALLET_NOT_FOUND]: 404,
  [RefundErrorCode.CURRENCY_MISMATCH]: 400,
  [RefundErrorCode.REFUND_FAILED]: 500,
}

const MODEL_STATUS: Record<string, number> = {
  [ModelErrorCode.MODEL_NOT_FOUND]: 404,
  [ModelErrorCode.MODEL_DISABLED]: 404,
  [ModelErrorCode.PRICING_NOT_FOUND]: 404,
}

/**
 * Map any domain error to the standard error envelope.
 * Fallback: 500 INTERNAL_SERVER_ERROR (never leaks stack traces).
 */
export function mapApiError(error: unknown, requestId?: string): NextResponse {
  if (!(error instanceof Error)) {
    return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', {
      status: 500,
      requestId,
    })
  }

  const domainError = error as DomainErrorLike

  switch (domainError.name) {
    case 'WalletError':
      return jsonError(domainError.code ?? 'WALLET_ERROR', domainError.message, {
        status: WALLET_STATUS[domainError.code ?? ''] ?? 400,
        requestId,
      })

    case 'TopupError':
      return jsonError(domainError.code ?? 'TOPUP_ERROR', domainError.message, {
        status: TOPUP_STATUS[domainError.code ?? ''] ?? 400,
        requestId,
      })

    case 'PaymentError':
      return jsonError(domainError.code ?? 'PAYMENT_ERROR', domainError.message, {
        status: PAYMENT_STATUS[domainError.code ?? ''] ?? 400,
        requestId,
      })

    case 'IdempotencyError':
      return jsonError(domainError.code ?? IdempotencyErrorCode.IN_PROGRESS, domainError.message, {
        status: 409,
        requestId,
      })

    case 'GatewayError':
      return jsonError(domainError.code ?? 'GATEWAY_ERROR', domainError.message, {
        status: GATEWAY_STATUS[domainError.code ?? ''] ?? 500,
        details: (error as { details?: Record<string, unknown> }).details,
        requestId,
      })

    case 'EstimateError':
      return jsonError(domainError.code ?? 'ESTIMATE_ERROR', domainError.message, {
        status: ESTIMATE_STATUS[domainError.code ?? ''] ?? 500,
        requestId,
      })

    case 'RefundError':
      return jsonError(domainError.code ?? 'REFUND_ERROR', domainError.message, {
        status: REFUND_STATUS[domainError.code ?? ''] ?? 500,
        requestId,
      })

    case 'ModelError':
      return jsonError(domainError.code ?? 'MODEL_ERROR', domainError.message, {
        status: MODEL_STATUS[domainError.code ?? ''] ?? 500,
        requestId,
      })

    case 'AuthError':
      return jsonError(domainError.code ?? 'UNAUTHORIZED', domainError.message, {
        status: domainError.code === 'FORBIDDEN' ? 403 : 401,
        requestId,
      })

    case 'JsonWebTokenError':
    case 'TokenExpiredError':
      return jsonError('INVALID_TOKEN', 'Access token is invalid or expired.', {
        status: 401,
        requestId,
      })
  }

  logger.error('api.unhandled_error', {
    request_id: requestId,
    error_name: domainError.name,
    error: domainError.message,
  })

  return jsonError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', {
    status: 500,
    requestId,
  })
}
