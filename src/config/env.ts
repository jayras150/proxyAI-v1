// ProxyAI Environment Configuration
// Blueprint Reference: Sprint 7 — Environment Variables

function envRequired(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function envOptional(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export const env = {
  // Database
  databaseUrl: envRequired('DATABASE_URL'),
  directUrl: envRequired('DIRECT_URL'),

  // Auth
  jwtSecret: envRequired('JWT_SECRET'),
  refreshTokenSecret: envRequired('REFRESH_TOKEN_SECRET'),
  jwtExpiresIn: envOptional('JWT_EXPIRES_IN', '15m'),
  refreshExpiresInDays: Number(envOptional('REFRESH_EXPIRES_IN_DAYS', '30')),

  // DeepInfra
  deepinfraApiKey: envOptional('DEEPINFRA_API_KEY', ''),

  // Payments
  paymentProvider: envOptional('PAYMENT_PROVIDER', 'mock'),
  mockPaymentWebhookSecret: envOptional('MOCK_PAYMENT_WEBHOOK_SECRET', 'mock-secret-dev'),
  webhookSignatureHeader: envOptional('WEBHOOK_SIGNATURE_HEADER', 'x-mock-signature'),
  topupExpiryMinutes: Number(envOptional('TOPUP_EXPIRY_MINUTES', '30')),

  // Billing (ADR-0001: business policy, not DB constraint)
  walletMaxNegativeBalance: envOptional('WALLET_MAX_NEGATIVE_BALANCE', '0.10'),

  // App
  appUrl: envOptional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  apiUrl: envOptional('NEXT_PUBLIC_API_URL', 'http://localhost:3000/api'),
} as const
