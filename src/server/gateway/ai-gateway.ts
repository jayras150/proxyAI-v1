// ProxyAI — AIGateway (Billing Orchestrator)
// Billing Milestone 7 — AI Gateway / Billing Orchestrator
//
// Application service that orchestrates the FULL lifecycle of one AI
// request. It is NOT a pricing engine, estimate service, usage meter,
// charge service, provider adapter or REST API — it only orchestrates:
//
//   Gateway → EstimateService → AIProvider → ProviderResponse →
//   UsageMeter → ChargeService → BillingSummary → GatewayResponse
//
// No shortcuts: the estimate gate runs BEFORE the provider is called; a
// rejected/failed estimate means the provider is never invoked; nothing is
// charged unless the provider returned metered usage and the settlement
// succeeded in one DB transaction.
//
// Error policy (documented):
//   1. Estimate failed      → provider NOT called, nothing charged.
//   2. Provider timeout     → nothing charged.
//   3. Provider error       → nothing charged.
//   4. Malformed response   → nothing charged.
//   5. UsageMeter failed    → nothing charged.
//   6. Charge failed        → the provider ALREADY served the request; the
//      response is lost and billing is unsettled. The gateway returns a
//      CHARGE_FAILED error carrying the provider request id + underlying
//      billing code so ops can settle manually; retrying the gateway with
//      the same requestId re-runs the provider (never deduped) but the
//      charge is idempotent and will settle exactly once.
//
// Retry policy: the gateway NEVER retries AI generation. Automatic retries
// are only allowed for idempotent operations (the charge is idempotent via
// its idempotency key — the gateway itself does not retry).
//
// The gateway contains ZERO pricing / wallet / token / persistence logic.

import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { Money, type CurrencyCode } from '@/lib/money'
import { EstimateError } from '@/server/billing/estimate.service'
import { ChargeError } from '@/server/billing/charge.service'
import { UsageMeterError } from '@/server/billing/usage-meter'
import { BillingSummary } from './billing-summary'
import { RequestContext } from './request-context'
import {
  isAbortError,
  MalformedProviderResponseError,
  ProviderTransportError,
  type AIProvider,
  type ChatMessage,
  type ProviderResponse,
} from './provider-types'
import type { EstimateService } from '@/server/billing/estimate.service'
import type { ChargeService, ChargeResult } from '@/server/billing/charge.service'
import type { UsageMeter } from '@/server/billing/usage-meter'
import type { TokenUsage } from '@/server/billing/token-usage'
import { IdempotencyError } from '@/server/idempotency/idempotency.service'

// ─── Errors ─────────────────────────────────────────────────────────────

export class GatewayError extends Error {
  code: string
  /** Actionable details (never raw provider payloads). */
  details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.code = code
    this.name = 'GatewayError'
    this.details = details
  }
}

export const GatewayErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  ESTIMATE_REJECTED: 'ESTIMATE_REJECTED',
  ESTIMATE_FAILED: 'ESTIMATE_FAILED',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  MALFORMED_PROVIDER_RESPONSE: 'MALFORMED_PROVIDER_RESPONSE',
  USAGE_PARSE_FAILED: 'USAGE_PARSE_FAILED',
  CHARGE_FAILED: 'CHARGE_FAILED',
  INTERNAL: 'INTERNAL',
} as const

export type GatewayErrorCodeValue = (typeof GatewayErrorCode)[keyof typeof GatewayErrorCode]

// ─── Request / response contracts ───────────────────────────────────────

export interface GatewayRequest {
  requestId: string
  correlationId: string
  userId: string
  /** Provider model name, e.g. 'deepseek-chat'. */
  model: string
  /** Billing identifiers — resolved by the API layer from the model registry. */
  modelId: string
  pricingVersionId: string
  messages: ChatMessage[]
  temperature?: number
  topP?: number
  maxTokens?: number
  /** Must be false in V1 (streaming out of scope). */
  stream?: boolean
  /** Client idempotency key; defaults to gateway_<requestId> for the charge. */
  idempotencyKey?: string
  clientIp?: string
  userAgent?: string
}

export interface GatewayResponse {
  response: {
    content: string
    finishReason: string
    model: string
    providerRequestId: string
  }
  provider: string
  usage: TokenUsage
  billing: BillingSummary
  latency: {
    totalMs: number
    providerMs: number
    billingMs: number
  }
  requestId: string
  correlationId: string
}

export interface GatewayProcessOptions {
  /** Per-call provider timeout override (defaults to env AI_PROVIDER_TIMEOUT_MS). */
  providerTimeoutMs?: number
}

const VALID_ROLES = new Set(['system', 'user', 'assistant'])

// ─── Gateway ────────────────────────────────────────────────────────────

export class AIGateway {
  constructor(
    private readonly estimateService: EstimateService,
    private readonly provider: AIProvider,
    private readonly usageMeter: UsageMeter,
    private readonly chargeService: ChargeService,
    private readonly providerTimeoutMs: number = env.aiProviderTimeoutMs
  ) {}

  /** Orchestrate one AI request end-to-end. Never retries the provider. */
  async process(request: GatewayRequest, options?: GatewayProcessOptions): Promise<GatewayResponse> {
    const ctx = RequestContext.create({
      requestId: request.requestId,
      correlationId: request.correlationId,
      userId: request.userId,
      clientIp: request.clientIp,
      userAgent: request.userAgent,
    })
    const log = ctx.toLogContext()
    const startedAt = Date.now()
    logger.info('gateway.started', log)

    try {
      this.validateRequest(request)
      logger.info('gateway.request_validated', log)

      // 1. Pre-flight estimate — provider must NOT be called if this fails.
      const estimatedUsage = this.provider.estimateContext(request)
      logger.info('estimate.started', { ...log, estimated_prompt_tokens: estimatedUsage.promptTokens })
      const estimate = await this.estimateService.estimate({
        userId: request.userId,
        modelId: request.modelId,
        usage: estimatedUsage,
      })
      logger.info('estimate.finished', {
        ...log,
        can_proceed: estimate.canProceed,
        reason: estimate.reason ?? null,
        estimated_cost: estimate.estimatedCost.toString(),
      })
      if (!estimate.canProceed) {
        throw new GatewayError(
          GatewayErrorCode.ESTIMATE_REJECTED,
          `Estimate rejected: ${estimate.reason ?? 'unknown'}.`,
          { reason: estimate.reason }
        )
      }

      // 2. Provider call (single attempt, timeout-guarded).
      const providerStartedAt = Date.now()
      logger.info('provider.started', { ...log, model: request.model })
      const providerResponse = await this.callProvider(request, ctx, options)
      const providerMs = Date.now() - providerStartedAt
      logger.info('provider.finished', {
        ...log,
        provider_request_id: providerResponse.providerRequestId,
        finish_reason: providerResponse.finishReason,
        provider_latency_ms: providerMs,
      })

      // 3. Normalize usage with the UsageMeter (authoritative for billing).
      const parsed = this.usageMeter.parseDetailed(providerResponse.provider, providerResponse.rawUsage)
      logger.info('usage.parsed', {
        ...log,
        prompt_tokens: parsed.usage.promptTokens,
        completion_tokens: parsed.usage.completionTokens,
        cached_tokens: parsed.usage.cachedTokens,
        total_tokens: parsed.usage.totalTokens,
      })
      const usage = parsed.usage

      // 4. Settle via ChargeService (one DB transaction, idempotent).
      const billingStartedAt = Date.now()
      logger.info('charge.started', { ...log, total_tokens: usage.totalTokens })
      const chargeResult = await this.chargeService.charge({
        requestId: request.requestId,
        userId: request.userId,
        modelId: request.modelId,
        model: request.model,
        provider: providerResponse.provider,
        pricingVersionId: request.pricingVersionId,
        usage,
        idempotencyKey: request.idempotencyKey ?? `gateway_${request.requestId}`,
        latencyMs: providerMs,
      })
      const billingMs = Date.now() - billingStartedAt
      logger.info('charge.finished', {
        ...log,
        transaction_id: chargeResult.transactionId,
        usage_log_id: chargeResult.chargeId,
        total_cost: chargeResult.breakdown.totalCost,
        replayed: chargeResult.replayed,
      })

      const billing = this.buildBillingSummary(chargeResult)

      const response: GatewayResponse = {
        response: {
          content: providerResponse.content,
          finishReason: providerResponse.finishReason,
          model: providerResponse.model,
          providerRequestId: providerResponse.providerRequestId,
        },
        provider: providerResponse.provider,
        usage,
        billing,
        latency: { totalMs: Date.now() - startedAt, providerMs, billingMs },
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      }

      logger.info('gateway.finished', {
        ...log,
        total_latency_ms: response.latency.totalMs,
        transaction_id: chargeResult.transactionId,
        usage_log_id: chargeResult.chargeId,
      })
      return response
    } catch (error) {
      const mapped = this.mapError(error, ctx)
      logger.error('gateway.failed', {
        ...log,
        error_code: mapped.code,
        error: mapped.message,
        ...(mapped.details ? { error_details: mapped.details } : {}),
        total_latency_ms: Date.now() - startedAt,
      })
      throw mapped
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private validateRequest(request: GatewayRequest): void {
    if (request.stream === true) {
      throw new GatewayError(
        GatewayErrorCode.VALIDATION_FAILED,
        'Streaming is not supported yet.',
        { field: 'stream' }
      )
    }
    if (!request.messages || request.messages.length === 0) {
      throw new GatewayError(
        GatewayErrorCode.VALIDATION_FAILED,
        'messages must be a non-empty array.',
        { field: 'messages' }
      )
    }
    for (const message of request.messages) {
      if (!VALID_ROLES.has(message.role)) {
        throw new GatewayError(
          GatewayErrorCode.VALIDATION_FAILED,
          `Invalid message role: ${message.role}.`,
          { field: 'messages' }
        )
      }
      if (typeof message.content !== 'string') {
        throw new GatewayError(
          GatewayErrorCode.VALIDATION_FAILED,
          'message.content must be a string.',
          { field: 'messages' }
        )
      }
    }
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      throw new GatewayError(
        GatewayErrorCode.VALIDATION_FAILED,
        'temperature must be between 0 and 2.',
        { field: 'temperature' }
      )
    }
    if (request.maxTokens !== undefined && (!Number.isInteger(request.maxTokens) || request.maxTokens <= 0)) {
      throw new GatewayError(
        GatewayErrorCode.VALIDATION_FAILED,
        'max_tokens must be a positive integer.',
        { field: 'max_tokens' }
      )
    }
  }

  private async callProvider(
    request: GatewayRequest,
    ctx: RequestContext,
    options?: GatewayProcessOptions
  ): Promise<ProviderResponse> {
    const timeoutMs = options?.providerTimeoutMs ?? this.providerTimeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await this.provider.chat(
        {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          topP: request.topP,
          maxTokens: request.maxTokens,
          stream: false,
          metadata: {
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
            userId: ctx.userId,
          },
        },
        { signal: controller.signal }
      )
    } finally {
      clearTimeout(timer)
    }
  }

  private buildBillingSummary(chargeResult: ChargeResult): BillingSummary {
    const currency = chargeResult.breakdown.currency as CurrencyCode
    return BillingSummary.create({
      transactionId: chargeResult.transactionId,
      usageLogId: chargeResult.chargeId,
      pricingVersionId: chargeResult.pricingVersionId,
      totalCost: Money.fromString(chargeResult.breakdown.totalCost, currency),
      currency,
      walletBalanceBefore: Money.fromString(chargeResult.walletBalanceBefore, currency),
      walletBalanceAfter: Money.fromString(chargeResult.walletBalanceAfter, currency),
      walletStatusAfter: chargeResult.walletStatus,
    })
  }

  private mapError(error: unknown, ctx: RequestContext): GatewayError {
    if (error instanceof GatewayError) return error

    if (error instanceof EstimateError) {
      return new GatewayError(GatewayErrorCode.ESTIMATE_FAILED, error.message, {
        estimate_code: error.code,
      })
    }
    if (isAbortError(error)) {
      return new GatewayError(
        GatewayErrorCode.PROVIDER_TIMEOUT,
        'AI provider timed out. Nothing was charged.',
        { request_id: ctx.requestId }
      )
    }
    if (error instanceof ProviderTransportError) {
      return new GatewayError(GatewayErrorCode.PROVIDER_ERROR, error.message, {
        request_id: ctx.requestId,
      })
    }
    if (error instanceof MalformedProviderResponseError) {
      return new GatewayError(GatewayErrorCode.MALFORMED_PROVIDER_RESPONSE, error.message, {
        request_id: ctx.requestId,
      })
    }
    if (error instanceof UsageMeterError) {
      return new GatewayError(GatewayErrorCode.USAGE_PARSE_FAILED, error.message, {
        usage_code: error.code,
        request_id: ctx.requestId,
      })
    }
    if (error instanceof ChargeError) {
      // Provider already served the request; billing failed. Actionable.
      return new GatewayError(GatewayErrorCode.CHARGE_FAILED, error.message, {
        charge_code: error.code,
        request_id: ctx.requestId,
        remediation:
          'The provider already served this request. Retry with the same requestId to settle idempotently, or reconcile manually via the usage log.',
      })
    }
    if (error instanceof IdempotencyError) {
      return new GatewayError(GatewayErrorCode.CHARGE_FAILED, error.message, {
        charge_code: error.code,
        request_id: ctx.requestId,
      })
    }
    return new GatewayError(
      GatewayErrorCode.INTERNAL,
      error instanceof Error ? error.message : String(error),
      { request_id: ctx.requestId }
    )
  }
}
