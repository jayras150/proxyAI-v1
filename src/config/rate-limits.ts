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

  /** Wallet read endpoints (GET wallet, GET transactions, GET topup) — 300/min */
  walletRead: { scope: 'wallet:read', limit: 300, windowSeconds: 60 },

  /** Topup creation (creates payment intents) — 60/min */
  walletTopup: { scope: 'wallet:topup', limit: 60, windowSeconds: 60 },

  /** Payment webhooks — higher limit (provider retries), signature-gated */
  webhookPayments: { scope: 'webhook:payments', limit: 1200, windowSeconds: 60 },
} as const
