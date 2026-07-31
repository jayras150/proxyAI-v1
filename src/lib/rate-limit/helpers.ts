// ProxyAI — Rate Limit Helpers (route-agnostic)
// Blueprint Reference: Sprint 9 §67 — Rate Limits
//
// Shared helpers to build rate-limit keys from a request, format the standard
// X-RateLimit-* headers, and enforce a limit. No route-specific logic lives
// here — any ProxyAI API route can reuse these.

import { NextResponse, type NextRequest } from 'next/server'
import { getRateLimiter } from './index'
import type { RateLimitResult } from './types'

export const RATE_LIMIT_LIMIT_HEADER = 'X-RateLimit-Limit'
export const RATE_LIMIT_REMAINING_HEADER = 'X-RateLimit-Remaining'
export const RETRY_AFTER_HEADER = 'Retry-After'

export interface RateLimitOptions {
  /** rate-limit bucket scope, e.g. 'auth:login' or 'api-keys:create' */
  scope: string
  /** max requests allowed in the window */
  limit: number
  /** window length in seconds */
  windowSeconds: number
  /** optional identity override (defaults to client IP) */
  identity?: string
}

/**
 * Extract the client IP, honoring the X-Forwarded-For chain (Vercel/proxy).
 * Falls back to the request IP or 'unknown'.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Build a namespaced rate-limit key.
 * @param scope    e.g. 'auth:login', 'api-keys:create'
 * @param identity e.g. 'ip:1.2.3.4' or 'user:<id>'
 */
export function buildRateLimitKey(scope: string, identity: string): string {
  return `proxyai:ratelimit:${scope}:${identity}`
}

/**
 * Convert a RateLimitResult into the standard headers map
 * (X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After).
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    [RATE_LIMIT_LIMIT_HEADER]: String(result.limit),
    [RATE_LIMIT_REMAINING_HEADER]: String(result.remaining),
    [RETRY_AFTER_HEADER]: String(result.retryAfterSeconds),
  }
}

/**
 * Enforce a rate limit for a request.
 *
 * Returns a 429 NextResponse (with standard headers) when the limit is
 * exceeded, otherwise null — the caller then continues normal processing
 * and should attach `rateLimitHeaders(result)` to its own response.
 */
export async function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<{ limited: true; response: NextResponse } | { limited: false; result: RateLimitResult }> {
  const limiter = getRateLimiter()
  const identity = options.identity ?? getClientIp(request)
  const key = buildRateLimitKey(options.scope, identity)

  const result = await limiter.limit(key, options.limit, options.windowSeconds)

  if (result.limited) {
    const response = NextResponse.json(
      {
        success: false,
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: rateLimitHeaders(result),
      }
    )
    return { limited: true, response }
  }

  return { limited: false, result }
}
