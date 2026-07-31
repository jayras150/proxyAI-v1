// ProxyAI — DeepSeekProvider
// Billing Milestone 7 — AI Gateway / Billing Orchestrator
//
// First AIProvider implementation (DeepSeek via DeepInfra, OpenAI-compatible
// chat completions). Maps the raw provider payload into a normalized
// ProviderResponse; usage is metered with the shared UsageMeter. The
// gateway only ever sees ProviderResponse — never raw provider payloads,
// endpoints or credentials.

import { TokenUsage } from '@/server/billing/token-usage'
import { UsageMeter } from '@/server/billing/usage-meter'
import {
  MalformedProviderResponseError,
  ProviderTransportError,
  isAbortError,
  type AIProvider,
  type FinishReason,
  type ProviderCapabilities,
  type ProviderChatRequest,
  type ProviderResponse,
  type ProviderTransport,
} from '@/server/gateway/provider-types'

export const DEEPSEEK_PROVIDER_NAME = 'deepseek'
export const DEEPSEEK_PROVIDER_VERSION = '1.0.0'

const DEEPSEEK_CHAT_PATH = '/chat/completions'

export interface DeepSeekProviderConfig {
  usageMeter: UsageMeter
  transport: ProviderTransport
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MalformedProviderResponseError(`${what} must be an object.`)
  }
  return value as Record<string, unknown>
}

function asString(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    throw new MalformedProviderResponseError(`${what} must be a string.`)
  }
  return value
}

function normalizeFinishReason(value: unknown): FinishReason {
  const raw = typeof value === 'string' ? value : 'unknown'
  switch (raw) {
    case 'stop':
    case 'length':
    case 'content_filter':
    case 'tool_calls':
      return raw
    default:
      return 'unknown'
  }
}

export class DeepSeekProvider implements AIProvider {
  private readonly usageMeter: UsageMeter
  private readonly transport: ProviderTransport

  constructor(config: DeepSeekProviderConfig) {
    this.usageMeter = config.usageMeter
    this.transport = config.transport
  }

  name(): string {
    return DEEPSEEK_PROVIDER_NAME
  }

  version(): string {
    return DEEPSEEK_PROVIDER_VERSION
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      vision: false,
      reasoning: true,
      toolCalling: false,
      jsonMode: true,
      embeddings: false,
      imageGeneration: false,
      maxContextTokens: 64_000,
      maxOutputTokens: 8_192,
      supportedModels: ['deepseek-chat', 'deepseek-reasoner'],
      supportedFormats: ['text'],
    }
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    const startedAt = Date.now()
    try {
      // A models listing proves credentials + network path without costing
      // a generation (never pay for a health check).
      await this.transport.get('/models')
      return { ok: true, latencyMs: Date.now() - startedAt }
    } catch {
      return { ok: false, latencyMs: Date.now() - startedAt }
    }
  }

  async chat(
    request: ProviderChatRequest,
    options?: { signal?: AbortSignal }
  ): Promise<ProviderResponse> {
    let raw: unknown
    try {
      raw = await this.transport.post(
        DEEPSEEK_CHAT_PATH,
        {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          top_p: request.topP,
          max_tokens: request.maxTokens,
          stream: false,
        },
        { signal: options?.signal, headers: request.metadata ? { 'x-request-metadata': JSON.stringify(request.metadata) } : undefined }
      )
    } catch (error) {
      if (isAbortError(error)) throw error
      if (error instanceof MalformedProviderResponseError) throw error
      if (error instanceof ProviderTransportError) throw error
      throw new ProviderTransportError(
        `Provider call failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    return this.mapResponse(request, raw)
  }

  /**
   * Rough prompt-token estimate: 4 tokens per message overhead + ~4 chars
   * per token. Only used by the pre-flight estimate gate, never for billing.
   */
  estimateContext(request: ProviderChatRequest): TokenUsage {
    const promptTokens = request.messages.reduce((total, message) => {
      return total + 4 + Math.ceil((message.content?.length ?? 0) / 4)
    }, 0)
    return TokenUsage.create({ promptTokens, completionTokens: 0 })
  }

  // ─── Response mapping ─────────────────────────────────────────────────

  private mapResponse(request: ProviderChatRequest, raw: unknown): ProviderResponse {
    const root = asRecord(raw, 'Provider response')
    const id = asString(root.id, 'response.id')
    const model = asString(root.model, 'response.model')
    const choices = root.choices
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new MalformedProviderResponseError('Provider response has no choices.')
    }
    const choice = asRecord(choices[0], 'response.choices[0]')
    const message = asRecord(choice.message, 'response.choices[0].message')
    const content = typeof message.content === 'string' ? message.content : ''
    const finishReason = normalizeFinishReason(choice.finish_reason)
    if (root.usage === undefined || root.usage === null) {
      throw new MalformedProviderResponseError('Provider response is missing usage.')
    }

    // Meter the raw usage — the single place that understands usage formats.
    const usage = this.usageMeter.parse(DEEPSEEK_PROVIDER_NAME, root.usage)

    return {
      provider: this.name(),
      model,
      providerRequestId: id,
      content,
      finishReason,
      usage,
      rawUsage: root.usage,
      metadata: { model: request.model },
      raw,
    }
  }
}
