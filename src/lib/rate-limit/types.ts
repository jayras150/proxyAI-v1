// ProxyAI — Rate Limiter Abstraction
// Blueprint Reference: Sprint 9 §67 — Rate Limits
//
// Business logic depends only on this interface. The concrete implementation
// (memory for development, Redis for production) is selected by environment.

export interface RateLimitResult {
  /** true when the request exceeds the limit and must be rejected */
  limited: boolean
  /** configured max requests in the window */
  limit: number
  /** remaining requests allowed in the current window */
  remaining: number
  /** seconds until the window resets (for Retry-After) */
  retryAfterSeconds: number
}

export interface RateLimiter {
  /**
   * Consume one request for the given key.
   * @param key   unique bucket identifier, e.g. `auth:login:ip:1.2.3.4`
   * @param limit max requests allowed in the window
   * @param windowSeconds window length in seconds
   */
  limit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>
}
