// ProxyAI Cryptographic Utilities
// Blueprint Reference: Sprint 6 — API Key Security
// M3: HMAC signatures (webhook), canonical request hashing (idempotency)

import crypto from 'crypto'

const KEY_PREFIX = 'pk_live_'
const KEY_BYTES = 32 // 256-bit key
const KEY_HASH_ALGO = 'sha256'

/**
 * Generate a cryptographically secure API key.
 * Returns both the full key (shown once) and its prefix.
 */
export function generateApiKey(): { fullKey: string; prefix: string } {
  const randomBytes = crypto.randomBytes(KEY_BYTES)
  const rawKey = randomBytes.toString('base64url')
  const prefix = KEY_PREFIX + rawKey.substring(0, 8)
  const fullKey = KEY_PREFIX + rawKey

  return { fullKey, prefix }
}

/**
 * Hash an API key for storage.
 */
export function hashApiKey(key: string): string {
  return sha256Hex(key)
}

/**
 * Hash a refresh token for storage.
 * Blueprint Reference: Sprint 8 — secrets hashed at rest (SHA-256).
 */
export function hashToken(token: string): string {
  return sha256Hex(token)
}

/** SHA-256 hex digest of any string. */
export function sha256Hex(value: string): string {
  return crypto.createHash(KEY_HASH_ALGO).update(value).digest('hex')
}

/** SHA-256 hex digest of a canonical JSON representation (sorted keys). */
export function canonicalJsonHash(value: unknown): string {
  const canonical = JSON.stringify(value, (key, val) =>
    val !== undefined && typeof val === 'object' && val !== null && !Array.isArray(val)
      ? Object.keys(val)
          .sort()
          .reduce((acc: Record<string, unknown>, k: string) => {
            acc[k] = val[k]
            return acc
          }, {})
      : val
  )
  return sha256Hex(canonical ?? '')
}

/** HMAC-SHA256 hex signature (webhook authenticity). */
export function hmacSha256Hex(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

/** Constant-time hex comparison (timing-safe signature check). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
