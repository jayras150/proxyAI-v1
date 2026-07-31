// ProxyAI Cryptographic Utilities
// Blueprint Reference: Sprint 6 — API Key Security

import crypto from 'crypto'

const KEY_PREFIX = 'pk_live_'
const KEY_BYTES = 32  // 256-bit key
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

function sha256Hex(value: string): string {
  return crypto
    .createHash(KEY_HASH_ALGO)
    .update(value)
    .digest('hex')
}
