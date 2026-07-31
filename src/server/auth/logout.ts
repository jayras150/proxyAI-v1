// ProxyAI — Logout Service
// Blueprint Reference: Sprint 6 — Session Revocation

import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/crypto'

/**
 * Logout from a specific session (the one holding the given refresh token).
 * Only this session is revoked — other sessions remain active.
 */
export async function logoutSession(refreshToken: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { refreshTokenHash: hashToken(refreshToken) },
  })
}

/**
 * Logout from all sessions for a user.
 */
export async function logoutAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  })
}
