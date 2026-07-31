// ProxyAI — Rate Limit Policies
// Blueprint Reference: Sprint 9 §67 — Rate Limits
//   Anonymous:      60 req/min
//   Authenticated:  configurable per API key (higher limit)
//   Admin:          higher limits

export const RATE_LIMITS = {
  /** Public auth endpoints — 60 req/min per IP */
  authPublic: { scope: 'auth:public', limit: 60, windowSeconds: 60 },

  /** Authenticated endpoints — 300 req/min per identity */
  authAuthenticated: { scope: 'auth:authenticated', limit: 300, windowSeconds: 60 },

  /** API key management — 300 req/min per identity */
  apiKeys: { scope: 'api-keys', limit: 300, windowSeconds: 60 },
} as const
