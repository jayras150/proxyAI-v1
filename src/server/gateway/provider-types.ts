// ProxyAI — AI Provider Contract
// Billing Milestone 7 — AI Gateway / Billing Orchestrator
//
// The gateway only knows this interface — never the HTTP endpoint,
// authorization header, API key or provider URL. Providers are added by
// implementing AIProvider; the gateway never changes.
//
// Every provider MUST produce a normalized ProviderResponse (never raw
// provider payloads). `usage` is a TokenUsage; `rawUsage` is the raw usage
// payload the gateway re-meters (authoritative for billing); `raw` is the
// full raw response for debugging/audit only.

import type { TokenUsage } from '@/server/billing/token-usage'

// ─── Capabilities ───────────────────────────────────────────────────────

export interface ProviderCapabilities {
  streaming: boolean
  vision: boolean
  reasoning: boolean
  toolCalling: boolean
  jsonMode: boolean
  embeddings: boolean
  imageGeneration: boolean
  /** Optional limits / model surface. */
  maxContextTokens?: number
  maxOutputTokens?: number
  supportedModels?: readonly string[]
  supportedFormats?: readonly string[]
}

// ─── Messages / requests ────────────────────────────────────────────────

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ProviderChatRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  topP?: number
  maxTokens?: number
  /** Always false in V1 (streaming is out of scope for this milestone). */
  stream?: boolean
  /** Cross-cutting identity for provider-side tracing/audit. */
  metadata?: Record<string, unknown>
}

export type FinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'unknown'

// ─── Response ───────────────────────────────────────────────────────────

export interface ProviderResponse {
  provider: string
  model: string
  providerRequestId: string
  content: string
  finishReason: FinishReason
  /** Normalized usage (provider-side, via UsageMeter). */
  usage: TokenUsage
  /** Raw provider usage payload — the gateway re-meters this (authoritative). */
  rawUsage: unknown
  metadata: Record<string, unknown>
  /** Full raw provider response. Debugging/audit only — never parsed. */
  raw: unknown
}

// ─── Provider errors ────────────────────────────────────────────────────

export class ProviderTransportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderTransportError'
  }
}

export class MalformedProviderResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MalformedProviderResponseError'
  }
}

// ─── Transport (HTTP boundary, provider-owned) ──────────────────────────

export interface ProviderTransport {
  post(
    path: string,
    body: unknown,
    options?: { headers?: Record<string, string>; signal?: AbortSignal }
  ): Promise<unknown>

  get(
    path: string,
    options?: { headers?: Record<string, string>; signal?: AbortSignal }
  ): Promise<unknown>
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

// ─── Provider interface ─────────────────────────────────────────────────

export interface AIProvider {
  /** Stable provider identifier, e.g. 'deepseek'. */
  name(): string

  /** Provider adapter version, e.g. '1.0.0'. */
  version(): string

  capabilities(): ProviderCapabilities

  /** Lightweight liveness check (transport-level). */
  health(): Promise<{ ok: boolean; latencyMs: number }>

  /** Run a chat completion. Never retried by the gateway. */
  chat(request: ProviderChatRequest, options?: { signal?: AbortSignal }): Promise<ProviderResponse>

  /**
   * Rough prompt-token estimate for a request (used by the pre-flight
   * EstimateService gate). Providers own their token heuristics.
   */
  estimateContext(request: ProviderChatRequest): TokenUsage
}
