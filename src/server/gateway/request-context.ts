// ProxyAI — RequestContext
// Billing Milestone 7 — AI Gateway / Billing Orchestrator
//
// Domain object that carries the identity of one request through the whole
// pipeline (gateway → estimate → provider → meter → charge). Services log,
// trace and correlate via this object instead of passing primitive
// (requestId, correlationId, userId) parameters around individually.

export class RequestContextError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'RequestContextError'
  }
}

export const RequestContextErrorCode = {
  INVALID_CONTEXT: 'INVALID_CONTEXT',
} as const

export interface RequestContextParams {
  requestId: string
  correlationId: string
  userId: string
  startedAt?: Date
  clientIp?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

/**
 * Immutable request identity. Every service in the pipeline receives the
 * fields it needs (requestId, userId, ...) mapped from this object; logging
 * uses toLogContext() so every log line carries the correlation id.
 */
export class RequestContext {
  readonly requestId: string
  readonly correlationId: string
  readonly userId: string
  readonly startedAt: Date
  readonly clientIp?: string
  readonly userAgent?: string
  readonly metadata: Readonly<Record<string, unknown>>

  private constructor(params: RequestContextParams) {
    this.requestId = params.requestId
    this.correlationId = params.correlationId
    this.userId = params.userId
    this.startedAt = params.startedAt ?? new Date()
    this.clientIp = params.clientIp
    this.userAgent = params.userAgent
    this.metadata = params.metadata ?? {}
  }

  static create(params: RequestContextParams): RequestContext {
    for (const [key, value] of Object.entries({
      requestId: params.requestId,
      correlationId: params.correlationId,
      userId: params.userId,
    })) {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new RequestContextError(
          RequestContextErrorCode.INVALID_CONTEXT,
          `${key} must be a non-empty string.`
        )
      }
    }
    return new RequestContext(params)
  }

  /** Milliseconds since the request started (observability). */
  elapsedMs(): number {
    return Date.now() - this.startedAt.getTime()
  }

  /** Structured-log fields — every line carries the correlation id. */
  toLogContext(): Record<string, unknown> {
    return {
      request_id: this.requestId,
      correlation_id: this.correlationId,
      user_id: this.userId,
      ...(this.clientIp ? { client_ip: this.clientIp } : {}),
      ...(this.userAgent ? { user_agent: this.userAgent } : {}),
    }
  }
}
