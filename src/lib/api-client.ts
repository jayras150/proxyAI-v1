// ProxyAI — Centralized API client (client-side)
//
// Single entry point for all dashboard ↔ backend communication.
//
// Contract handled here (see openapi/v1.yaml):
//   Success: { success: true,  data, request_id }
//   Error:   { success: false, error: { code, message, details }, request_id }
//
// Auth:
//   - JWT:    HttpOnly cookies (proxyai_access) — sent automatically by the browser.
//   - API key: pass `{ apiKey }` → `Authorization: Bearer pk_live_...` header.
//
// Correlation: every request carries X-Correlation-Id (stable per browser session);
// response request_id (X-Request-Id header / body) is surfaced on ApiResponse.

export interface ApiErrorDetails {
  [key: string]: unknown
}

export interface ApiErrorShape {
  code: string
  message: string
  details: ApiErrorDetails
}

export interface ApiSuccessShape<T> {
  success: true
  data: T
  request_id: string
}

export interface ApiErrorEnvelope {
  success: false
  error: ApiErrorShape
  request_id: string
}

export type ApiEnvelope<T> = ApiSuccessShape<T> | ApiErrorEnvelope

export interface ApiResponse<T> {
  data: T
  requestId: string
  status: number
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorDetails
  readonly requestId: string | null
  /** Seconds to wait before retrying (from Retry-After on 429). */
  readonly retryAfterSeconds: number | null

  constructor(params: {
    status: number
    code: string
    message: string
    details?: ApiErrorDetails
    requestId?: string | null
    retryAfterSeconds?: number | null
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.details = params.details ?? {}
    this.requestId = params.requestId ?? null
    this.retryAfterSeconds = params.retryAfterSeconds ?? null
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }
}

export interface ApiClientOptions {
  /** Bearer API key (pk_live_...) — overrides cookie auth for this call. */
  apiKey?: string
  /** Request timeout in ms (default 15_000). */
  timeoutMs?: number
  /** Retries for transient failures (network / 5xx). Default 2. */
  retries?: number
  /** Abort signal (cancellation). */
  signal?: AbortSignal
}

export const API_TIMEOUT_MS = 15_000
export const DEFAULT_RETRIES = 2
export const CORRELATION_ID_HEADER = 'x-correlation-id'
export const REQUEST_ID_HEADER = 'x-request-id'

let correlationId: string | null = null

/** Stable per-browser-session correlation id (created lazily). */
export function getCorrelationId(): string {
  if (!correlationId) {
    correlationId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`
  }
  return correlationId
}

/** Test hook — reset the cached correlation id. */
export function __resetCorrelationId(): void {
  correlationId = null
}

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/**
 * Register a global handler invoked when any call returns 401
 * (expired/invalid session). The route guard wires this to
 * AuthContext.logout() + redirect to /login.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

type OnlineChangeHandler = (online: boolean) => void
const onlineHandlers = new Set<OnlineChangeHandler>()

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => onlineHandlers.forEach((fn) => fn(true)))
  window.addEventListener('offline', () => onlineHandlers.forEach((fn) => fn(false)))
}

/** Subscribe to browser connectivity changes; returns an unsubscribe fn. */
export function onOnlineChange(fn: OnlineChangeHandler): () => void {
  onlineHandlers.add(fn)
  return () => onlineHandlers.delete(fn)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Exponential backoff with jitter: base 300ms, factor 2, ±25% jitter. */
export function retryDelayMs(attempt: number): number {
  const base = 300 * 2 ** attempt
  const jitter = base * 0.25 * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(base + jitter))
}

export function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 0
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

async function parseEnvelope<T>(response: Response): Promise<ApiResponse<T>> {
  const status = response.status
  const headerRequestId = response.headers.get(REQUEST_ID_HEADER)
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // Non-JSON body (proxy error pages etc.)
  }

  const envelope = payload as Partial<ApiEnvelope<T>> | null
  const bodyRequestId =
    envelope && typeof envelope.request_id === 'string' ? envelope.request_id : null
  const requestId = headerRequestId ?? bodyRequestId

  if (response.ok) {
    const successEnvelope = envelope as Partial<ApiSuccessShape<T>> | null
    const data =
      successEnvelope && successEnvelope.success === true
        ? (successEnvelope.data as T)
        : (payload as T)
    return { data, requestId: requestId ?? '', status }
  }

  const retryAfterRaw = response.headers.get('retry-after')
  const retryAfterSeconds = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : null

  const error = envelope && (envelope as ApiErrorEnvelope).error
  throw new ApiError({
    status,
    code: error?.code ?? 'HTTP_ERROR',
    message: error?.message ?? `Request failed with status ${status}`,
    details: error?.details ?? {},
    requestId,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
  })
}

/**
 * Central fetch wrapper.
 *
 * - Parses the ProxyAI envelope ({success,data,request_id} / error contract).
 * - Attaches X-Correlation-Id; surfaces request_id from header or body.
 * - Optional Bearer API key (JWT via HttpOnly cookie otherwise).
 * - Retries transient failures (network error / 5xx) with backoff+jitter.
 * - Never retries 4xx; surfaces Retry-After on 429.
 * - Invokes the global unauthorized handler on 401.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiClientOptions & RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    apiKey,
    timeoutMs = API_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    signal,
    method = 'GET',
    body,
    headers,
  } = options

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    [CORRELATION_ID_HEADER]: getCorrelationId(),
    ...headers,
  }
  if (apiKey) {
    requestHeaders.Authorization = `Bearer ${apiKey}`
  }
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  let attempt = 0
  // AbortController ownership: caller's signal wins; otherwise we manage timeout.
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutId =
    controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
  const combinedSignal =
    signal && controller
      ? AbortSignal.any([signal, controller.signal])
      : signal ?? controller?.signal

  try {
    while (true) {
      try {
        const response = await fetch(path, {
          method,
          headers: requestHeaders,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: combinedSignal,
          cache: 'no-store',
        })
        return await parseEnvelope<T>(response)
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.isUnauthorized) {
            unauthorizedHandler?.()
          }
          // Transient server errors (5xx) are retryable; 4xx are not.
          if (isTransientStatus(error.status) && attempt < retries) {
            attempt += 1
            await sleep(retryDelayMs(attempt - 1))
            continue
          }
          throw error
        }

        const aborted =
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError')

        if (aborted && signal?.aborted) {
          // Caller cancelled — rethrow as cancellation, not a network error.
          throw error
        }
        if (aborted) {
          // Our own timeout.
          throw new ApiError({
            status: 0,
            code: 'TIMEOUT',
            message: 'The request timed out. Please try again.',
          })
        }

        const offline = typeof navigator !== 'undefined' && navigator.onLine === false
        if (attempt < retries && !offline) {
          attempt += 1
          await sleep(retryDelayMs(attempt - 1))
          continue
        }

        throw new ApiError({
          status: 0,
          code: offline ? 'OFFLINE' : 'NETWORK_ERROR',
          message: offline
            ? 'You are offline. Check your connection and try again.'
            : 'Network error. Please check your connection and try again.',
        })
      }
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
