// ProxyAI — API client unit tests (node environment)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  __resetCorrelationId,
  apiFetch,
  getCorrelationId,
  isTransientStatus,
  retryDelayMs,
  setUnauthorizedHandler,
} from '@/lib/api-client'

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  __resetCorrelationId()
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
  setUnauthorizedHandler(null)
})

describe('apiFetch — envelope parsing', () => {
  it('parses a success envelope into { data, requestId, status }', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { balance: '10.000000' }, request_id: 'req_abc' })
    )
    const result = await apiFetch<{ balance: string }>('/api/v1/wallet')
    expect(result).toEqual({ data: { balance: '10.000000' }, requestId: 'req_abc', status: 200 })
  })

  it('prefers the X-Request-Id header over the body request_id', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: {}, request_id: 'req_body' }, 200, {
        'x-request-id': 'req_header',
      })
    )
    const result = await apiFetch('/api/v1/wallet')
    expect(result.requestId).toBe('req_header')
  })

  it('throws ApiError with code/message/details/requestId on error envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: 'WALLET_LOCKED', message: 'Wallet is locked', details: { id: 'w1' } },
          request_id: 'req_err',
        },
        423
      )
    )
    const error = await apiFetch('/api/v1/wallet').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 423,
      code: 'WALLET_LOCKED',
      message: 'Wallet is locked',
      details: { id: 'w1' },
      requestId: 'req_err',
    })
  })
})

describe('apiFetch — request shaping', () => {
  it('sends a stable X-Correlation-Id on every request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {}, request_id: 'r1' }))
    await apiFetch('/api/v1/wallet')
    await apiFetch('/api/v1/transactions')
    const first = fetchMock.mock.calls[0][1].headers['x-correlation-id']
    const second = fetchMock.mock.calls[1][1].headers['x-correlation-id']
    expect(first).toBeDefined()
    expect(first).toBe(second)
    expect(getCorrelationId()).toBe(first)
  })

  it('attaches Authorization: Bearer when an API key is passed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {}, request_id: 'r1' }))
    await apiFetch('/api/v1/chat/completions', { apiKey: 'pk_live_abc', method: 'POST', body: {} })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer pk_live_abc')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{}')
  })

  it('JSON-encodes the body and sends it with POST', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {}, request_id: 'r1' }))
    await apiFetch('/api/v1/refund', { method: 'POST', body: { usage_log_id: 'u1' } })
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ usage_log_id: 'u1' })
  })
})

describe('apiFetch — error handling', () => {
  it('does NOT retry 4xx errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bad', details: {} }, request_id: 'r' },
        400
      )
    )
    await expect(apiFetch('/api/v1/wallet', { retries: 2 })).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries transient 5xx errors then succeeds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: { code: 'UPSTREAM', message: 'x', details: {} }, request_id: 'r' }, 502)
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ok: true }, request_id: 'r2' }))

    const result = await apiFetch<{ ok: boolean }>('/api/v1/chat/completions', { retries: 1 })
    expect(result.data).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('throws a network ApiError (status 0) after exhausting retries', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const error = await apiFetch('/api/v1/wallet', { retries: 1 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
    expect((error as ApiError).code).toBe('NETWORK_ERROR')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('surfaces Retry-After on 429', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'RATE_LIMITED', message: 'slow down', details: {} }, request_id: 'r' },
        429,
        { 'retry-after': '7' }
      )
    )
    const error = await apiFetch('/api/v1/wallet').catch((e: unknown) => e)
    expect((error as ApiError).isRateLimited).toBe(true)
    expect((error as ApiError).retryAfterSeconds).toBe(7)
  })

  it('invokes the global unauthorized handler on 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'no', details: {} }, request_id: 'r' }, 401)
    )
    await expect(apiFetch('/api/v1/wallet')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('surfaces TIMEOUT when the request exceeds the timeout', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
    )
    const error = await apiFetch('/api/v1/wallet', { timeoutMs: 10, retries: 0 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('TIMEOUT')
  })
})

describe('retry policy helpers', () => {
  it('classifies transient statuses', () => {
    expect(isTransientStatus(500)).toBe(true)
    expect(isTransientStatus(503)).toBe(true)
    expect(isTransientStatus(0)).toBe(true)
    expect(isTransientStatus(429)).toBe(false)
    expect(isTransientStatus(400)).toBe(false)
  })

  it('grows the backoff exponentially with jitter bounds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(retryDelayMs(0)).toBe(300)
    expect(retryDelayMs(1)).toBe(600)
    expect(retryDelayMs(2)).toBe(1200)
    vi.restoreAllMocks()
  })
})
