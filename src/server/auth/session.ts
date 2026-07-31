// ProxyAI — Session Service (shared)
// Single source of truth for session creation. The refresh token lifetime
// comes from env (REFRESH_EXPIRES_IN_DAYS) so the DB session and the
// HttpOnly cookie always stay consistent.

import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/crypto'
import { env } from '@/config/env'

export function refreshTokenLifetimeMs(): number {
  return env.refreshExpiresInDays * 24 * 60 * 60 * 1000
}

export function sessionExpiresAt(): Date {
  return new Date(Date.now() + refreshTokenLifetimeMs())
}

/**
 * Create a session for a user. Only the SHA-256 hash of the refresh token
 * is stored — never the plaintext token.
 */
export async function createSession(userId: string, refreshToken: string): Promise<void> {
  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: sessionExpiresAt(),
    },
  })
}
