// ProxyAI — TokenUsage Value Object
// Billing Design Review v2 — Usage Metering
// Pure domain object: no database dependency. Token counts are integers.

export interface TokenUsageParams {
  promptTokens: number
  completionTokens: number
  cachedTokens?: number
}

export class TokenUsageError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'TokenUsageError'
  }
}

export const TokenUsageErrorCode = {
  NEGATIVE_TOKEN_COUNT: 'NEGATIVE_TOKEN_COUNT',
} as const

/**
 * Immutable token usage measurement (input / output / cached).
 * All values are non-negative integers.
 */
export class TokenUsage {
  readonly promptTokens: number
  readonly completionTokens: number
  readonly cachedTokens: number

  private constructor(params: TokenUsageParams) {
    this.promptTokens = params.promptTokens
    this.completionTokens = params.completionTokens
    this.cachedTokens = params.cachedTokens ?? 0
  }

  static create(params: TokenUsageParams): TokenUsage {
    const values = [params.promptTokens, params.completionTokens, params.cachedTokens ?? 0]
    for (const v of values) {
      if (!Number.isInteger(v) || v < 0) {
        throw new TokenUsageError(
          TokenUsageErrorCode.NEGATIVE_TOKEN_COUNT,
          'Token counts must be non-negative integers.'
        )
      }
    }
    return new TokenUsage(params)
  }

  get totalTokens(): number {
    return this.promptTokens + this.completionTokens + this.cachedTokens
  }

  /** Merge two usage measurements (e.g. streamed chunks accumulation). */
  add(other: TokenUsage): TokenUsage {
    return TokenUsage.create({
      promptTokens: this.promptTokens + other.promptTokens,
      completionTokens: this.completionTokens + other.completionTokens,
      cachedTokens: this.cachedTokens + other.cachedTokens,
    })
  }
}
