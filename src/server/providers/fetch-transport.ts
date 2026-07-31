// ProxyAI — FetchProviderTransport
// Billing Milestone 7 — AI Gateway / Billing Orchestrator
//
// Default HTTP transport for providers (global fetch, no SDK). Owns the
// provider's base URL, API key and authorization header — the gateway never
// sees these. Timeouts are enforced by the caller via AbortSignal; an abort
// surfaces as a DOMException with name 'AbortError' (never wrapped).

import { ProviderTransportError } from '@/server/gateway/provider-types'
import type { ProviderTransport } from '@/server/gateway/provider-types'

export interface FetchProviderTransportConfig {
  baseUrl: string
  apiKey: string
  defaultHeaders?: Record<string, string>
}

export class FetchProviderTransport implements ProviderTransport {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly defaultHeaders: Record<string, string>

  constructor(config: FetchProviderTransportConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.apiKey = config.apiKey
    this.defaultHeaders = config.defaultHeaders ?? {}
  }

  async post(
    path: string,
    body: unknown,
    options?: { headers?: Record<string, string>; signal?: AbortSignal }
  ): Promise<unknown> {
    return this.request('POST', path, JSON.stringify(body), options)
  }

  async get(
    path: string,
    options?: { headers?: Record<string, string>; signal?: AbortSignal }
  ): Promise<unknown> {
    return this.request('GET', path, undefined, options)
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body: string | undefined,
    options?: { headers?: Record<string, string>; signal?: AbortSignal }
  ): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
          ...this.defaultHeaders,
          ...options?.headers,
        },
        body,
        signal: options?.signal,
      })
    } catch (error) {
      // Aborts (timeout) propagate untouched so the gateway can distinguish
      // PROVIDER_TIMEOUT from PROVIDER_ERROR.
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
      throw new ProviderTransportError(
        `Provider request failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    if (!response.ok) {
      const snippet = await response.text().catch(() => '')
      throw new ProviderTransportError(
        `Provider responded ${response.status}${snippet ? `: ${snippet.slice(0, 200)}` : ''}`
      )
    }

    return response.json()
  }
}
