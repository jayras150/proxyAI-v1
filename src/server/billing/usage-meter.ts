// ProxyAI — UsageMeter
// Billing Design Review v2 — Usage Metering
// Billing Milestone 4 — Usage Meter
//
// Pure domain component: stateless, deterministic, no side effects.
// NO database / Prisma / repository / HTTP / provider SDK dependency.
//
// Responsibility: convert a raw AI provider usage response into a
// TokenUsage domain object. UsageMeter is THE ONLY place that understands
// provider usage formats.
//
// UsageMeter never: prices, persists (UsageLog/Transaction), touches the
// wallet, or emits events — that is ChargeService's job (later milestone).
//
// Provider formats are handled by pluggable UsageAdapter implementations
// (DeepSeek + OpenAI Compatible ship built-in). New providers are added by
// registering an adapter — the core never changes.

import { TokenUsage } from './token-usage'

// ─── Errors ─────────────────────────────────────────────────────────────

export const UsageMeterErrorCode = {
  USAGE_PARSE_ERROR: 'USAGE_PARSE_ERROR',
  MALFORMED_USAGE: 'MALFORMED_USAGE',
  INVALID_USAGE: 'INVALID_USAGE',
  UNSUPPORTED_PROVIDER: 'UNSUPPORTED_PROVIDER',
  INVALID_REGISTRATION: 'INVALID_REGISTRATION',
} as const

export class UsageMeterError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'UsageMeterError'
  }
}

/** Raw payload could not be parsed at all (e.g. invalid JSON string). */
export class UsageParseError extends UsageMeterError {
  constructor(message: string) {
    super(UsageMeterErrorCode.USAGE_PARSE_ERROR, message)
    this.name = 'UsageParseError'
  }
}

/** Payload is structurally invalid: not an object, missing fields, wrong types. */
export class MalformedUsage extends UsageMeterError {
  constructor(message: string) {
    super(UsageMeterErrorCode.MALFORMED_USAGE, message)
    this.name = 'MalformedUsage'
  }
}

/**
 * Payload is structurally valid but semantically invalid: negative or
 * non-safe-integer counts, cached > prompt, reasoning > completion,
 * total_tokens mismatch, or integer overflow.
 */
export class InvalidUsage extends UsageMeterError {
  constructor(message: string) {
    super(UsageMeterErrorCode.INVALID_USAGE, message)
    this.name = 'InvalidUsage'
  }
}

/** No adapter is registered for the requested provider. */
export class UnsupportedProvider extends UsageMeterError {
  constructor(provider: string) {
    super(UsageMeterErrorCode.UNSUPPORTED_PROVIDER, `Unsupported provider: ${provider}`)
    this.name = 'UnsupportedProvider'
  }
}

// ─── Adapter contract ───────────────────────────────────────────────────

/**
 * Provider-normalized usage fields, BEFORE semantic validation.
 * Adapters only map provider-specific field names — validation and
 * normalization happen once, in the UsageMeter core.
 */
export interface ProviderUsageExtract {
  /** Prompt tokens as reported by the provider (may include cached tokens). */
  promptTokens: number
  completionTokens: number
  /** Cached prompt tokens — a decomposition of promptTokens when present. */
  cachedTokens?: number
  /** Provider-reported grand total (validated when present). */
  totalTokens?: number
  /** Reasoning/thinking tokens (optional, informational, subset of completion). */
  reasoningTokens?: number
}

/**
 * A provider usage format adapter. Implementations are the only code that
 * knows a provider's raw usage shape; they must be pure and throw
 * UsageParseError / MalformedUsage for provider-specific structural issues.
 */
export interface UsageAdapter {
  /** Provider identifier(s) this adapter understands (e.g. 'deepseek'). */
  readonly providerIds: readonly string[]

  /** Map a raw provider usage payload to the normalized extract. */
  extract(raw: unknown): ProviderUsageExtract
}

// ─── Field extraction helpers (shared by built-in adapters) ─────────────

function toUsageRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new MalformedUsage('Usage payload must be a JSON object.')
  }
  return raw as Record<string, unknown>
}

function nestedRecord(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new MalformedUsage(`Field "${field}" must be an object when present.`)
  }
  return value as Record<string, unknown>
}

function optionalInt(record: Record<string, unknown> | undefined, field: string): number | undefined {
  const value = record?.[field]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number') {
    throw new MalformedUsage(`Field "${field}" must be a number when present.`)
  }
  return value
}

function requiredInt(record: Record<string, unknown> | undefined, field: string): number {
  const parsed = optionalInt(record, field)
  if (parsed === undefined) {
    throw new MalformedUsage(`Missing required field "${field}".`)
  }
  return parsed
}

// ─── Built-in adapters ──────────────────────────────────────────────────

export const DEEPSEEK_PROVIDER_IDS = ['deepseek'] as const

/**
 * DeepSeek usage format (OpenAI-compatible plus legacy cache fields).
 * Reads: prompt_tokens, completion_tokens, total_tokens,
 * prompt_tokens_details.cached_tokens (preferred) or
 * prompt_cache_hit_tokens (legacy), completion_tokens_details.reasoning_tokens.
 */
export class DeepSeekUsageAdapter implements UsageAdapter {
  readonly providerIds: readonly string[] = DEEPSEEK_PROVIDER_IDS

  extract(raw: unknown): ProviderUsageExtract {
    const usage = toUsageRecord(raw)
    const promptTokens = requiredInt(usage, 'prompt_tokens')
    const completionTokens = requiredInt(usage, 'completion_tokens')

    const promptDetails = nestedRecord(usage.prompt_tokens_details, 'prompt_tokens_details')
    const cachedTokens =
      optionalInt(promptDetails, 'cached_tokens') ??
      optionalInt(usage, 'prompt_cache_hit_tokens')

    const completionDetails = nestedRecord(usage.completion_tokens_details, 'completion_tokens_details')
    const reasoningTokens = optionalInt(completionDetails, 'reasoning_tokens')

    return {
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens: optionalInt(usage, 'total_tokens'),
      reasoningTokens,
    }
  }
}

export const OPENAI_PROVIDER_IDS = [
  'openai',
  'openai-compatible',
  'openai_compatible',
  'openai compatible',
] as const

/**
 * OpenAI / OpenAI-compatible usage format.
 * Reads: prompt_tokens, completion_tokens, total_tokens,
 * prompt_tokens_details.cached_tokens, completion_tokens_details.reasoning_tokens.
 */
export class OpenAICompatibleUsageAdapter implements UsageAdapter {
  readonly providerIds: readonly string[] = OPENAI_PROVIDER_IDS

  extract(raw: unknown): ProviderUsageExtract {
    const usage = toUsageRecord(raw)
    const promptTokens = requiredInt(usage, 'prompt_tokens')
    const completionTokens = requiredInt(usage, 'completion_tokens')

    const promptDetails = nestedRecord(usage.prompt_tokens_details, 'prompt_tokens_details')
    const cachedTokens = optionalInt(promptDetails, 'cached_tokens')

    const completionDetails = nestedRecord(usage.completion_tokens_details, 'completion_tokens_details')
    const reasoningTokens = optionalInt(completionDetails, 'reasoning_tokens')

    return {
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens: optionalInt(usage, 'total_tokens'),
      reasoningTokens,
    }
  }
}

// ─── Core ───────────────────────────────────────────────────────────────

export interface ParsedUsage {
  /** Validated, normalized domain usage. */
  usage: TokenUsage
  /** Reasoning tokens (informational; subset of completionTokens). */
  reasoningTokens?: number
}

function normalizeProviderId(provider: string): string {
  return provider.trim().toLowerCase()
}

/** Strings are accepted as JSON payloads; invalid JSON → UsageParseError. */
function parsePayload(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new UsageParseError('Raw usage payload is not valid JSON.')
  }
}

function assertValidCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidUsage(`${label} must be a non-negative safe integer, got ${value}.`)
  }
}

function requiredCountField(extract: ProviderUsageExtract, key: 'promptTokens' | 'completionTokens'): number {
  const value = extract[key]
  if (typeof value !== 'number') {
    throw new MalformedUsage(`Expected ${key} to be a number.`)
  }
  return value
}

function optionalCountField(
  extract: ProviderUsageExtract,
  key: 'cachedTokens' | 'totalTokens' | 'reasoningTokens'
): number | undefined {
  const value = extract[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number') {
    throw new MalformedUsage(`Expected ${key} to be a number.`)
  }
  return value
}

/**
 * Stateless, deterministic usage meter. Construct with adapters (or use
 * createUsageMeter() for the built-in DeepSeek + OpenAI set), then call
 * parse(provider, raw) to obtain a TokenUsage.
 */
export class UsageMeter {
  private readonly adapters = new Map<string, UsageAdapter>()

  constructor(adapters: readonly UsageAdapter[] = []) {
    for (const adapter of adapters) {
      this.register(adapter)
    }
  }

  /** Register a provider adapter. Throws on invalid or duplicate registration. */
  register(adapter: UsageAdapter): this {
    if (
      adapter === null ||
      typeof adapter !== 'object' ||
      !Array.isArray(adapter.providerIds) ||
      adapter.providerIds.length === 0
    ) {
      throw new UsageMeterError(
        UsageMeterErrorCode.INVALID_REGISTRATION,
        'Adapter must declare at least one provider id.'
      )
    }
    if (typeof adapter.extract !== 'function') {
      throw new UsageMeterError(
        UsageMeterErrorCode.INVALID_REGISTRATION,
        'Adapter must implement extract().'
      )
    }
    for (const id of adapter.providerIds) {
      if (typeof id !== 'string' || id.trim() === '') {
        throw new UsageMeterError(
          UsageMeterErrorCode.INVALID_REGISTRATION,
          'Provider ids must be non-empty strings.'
        )
      }
      const key = normalizeProviderId(id)
      if (this.adapters.has(key)) {
        throw new UsageMeterError(
          UsageMeterErrorCode.INVALID_REGISTRATION,
          `Provider "${id}" is already registered.`
        )
      }
      this.adapters.set(key, adapter)
    }
    return this
  }

  /** Parse a raw provider usage payload into a TokenUsage. Pure, deterministic. */
  parse(provider: string, raw: unknown): TokenUsage {
    return this.parseDetailed(provider, raw).usage
  }

  /** Like parse(), but also exposes optional reasoning tokens. */
  parseDetailed(provider: string, raw: unknown): ParsedUsage {
    if (typeof provider !== 'string') {
      throw new UnsupportedProvider(String(provider))
    }
    const adapter = this.adapters.get(normalizeProviderId(provider))
    if (!adapter) {
      throw new UnsupportedProvider(provider)
    }
    const extract = adapter.extract(parsePayload(raw))
    const usage = this.normalize(extract)
    return {
      usage,
      ...(extract.reasoningTokens !== undefined ? { reasoningTokens: extract.reasoningTokens } : {}),
    }
  }

  /**
   * Validate + normalize a provider-agnostic extract into a TokenUsage.
   * Shared by every provider — the single source of validation truth.
   */
  normalize(extract: ProviderUsageExtract): TokenUsage {
    const promptTokens = requiredCountField(extract, 'promptTokens')
    const completionTokens = requiredCountField(extract, 'completionTokens')
    const cachedTokens = optionalCountField(extract, 'cachedTokens') ?? 0
    const totalTokens = optionalCountField(extract, 'totalTokens')
    const reasoningTokens = optionalCountField(extract, 'reasoningTokens')

    // 1. Non-negative safe integers (rejects negative, NaN, Infinity,
    //    fractional and overflow values).
    assertValidCount(promptTokens, 'promptTokens')
    assertValidCount(completionTokens, 'completionTokens')
    assertValidCount(cachedTokens, 'cachedTokens')

    // 2. Cached tokens are a decomposition of prompt tokens
    //    (provider-reported prompt already includes them).
    if (cachedTokens > promptTokens) {
      throw new InvalidUsage(
        `cachedTokens (${cachedTokens}) cannot exceed promptTokens (${promptTokens}).`
      )
    }

    // 3. Reasoning tokens are a subset of completion tokens.
    if (reasoningTokens !== undefined) {
      assertValidCount(reasoningTokens, 'reasoningTokens')
      if (reasoningTokens > completionTokens) {
        throw new InvalidUsage(
          `reasoningTokens (${reasoningTokens}) cannot exceed completionTokens (${completionTokens}).`
        )
      }
    }

    // 4. Overflow protection on the combined total (each field is safe, but
    //    their sum may overflow the safe integer range).
    const expectedTotal = promptTokens + completionTokens
    if (!Number.isSafeInteger(expectedTotal)) {
      throw new InvalidUsage('Token totals overflow the safe integer range.')
    }

    // 5. Provider-reported total must be consistent with the components.
    if (totalTokens !== undefined) {
      assertValidCount(totalTokens, 'totalTokens')
      if (totalTokens !== expectedTotal) {
        throw new InvalidUsage(
          `total_tokens (${totalTokens}) does not match prompt + completion (${expectedTotal}).`
        )
      }
    }

    // 6. Decompose cached tokens out of prompt so the domain total
    //    (prompt + completion + cached) equals the provider total
    //    (prompt + completion, cached included in prompt).
    return TokenUsage.create({
      promptTokens: promptTokens - cachedTokens,
      completionTokens,
      cachedTokens,
    })
  }
}

/** Default meter with the built-in DeepSeek + OpenAI Compatible adapters. */
export function createUsageMeter(): UsageMeter {
  return new UsageMeter([new DeepSeekUsageAdapter(), new OpenAICompatibleUsageAdapter()])
}

export const SUPPORTED_PROVIDERS: readonly string[] = [
  ...DEEPSEEK_PROVIDER_IDS,
  ...OPENAI_PROVIDER_IDS,
]
