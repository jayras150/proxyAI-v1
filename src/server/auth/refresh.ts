// ProxyAI — Token Refresh Service
// Blueprint Reference: Sprint 6 — Refresh Token Rotation

import { prisma } from '@/lib/prisma'
import { verifyRefreshToken, generateTokens } from '@/lib/jwt'
import { hashToken } from '@/lib/crypto'
import { AuthError } from '@/lib/errors'
import { toUserProfile, userProfileSelect } from '@/lib/user-profile'
import { sessionExpiresAt } from './session'
import type { AuthTokens, UserProfile } from '@/types/auth'

export interface RefreshResult {
  user: UserProfile
  tokens: AuthTokens
}

export async function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  // Verify the refresh token JWT
  try {
    verifyRefreshToken(refreshToken)
  } catch {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.')
  }

  // Find the session by its stored hash
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashToken(refreshToken) },
    include: {
      user: {
        select: userProfileSelect,
      },
    },
  })

  if (!session) {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token not found.')
  }

  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: session.id } })
    throw new AuthError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired. Please login again.')
  }

  if (session.user.status === 'SUSPENDED') {
    await prisma.session.delete({ where: { id: session.id } })
    throw new AuthError('ACCOUNT_SUSPENDED', 'Your account has been suspended.')
  }

  // Rotate: delete old session, create new one with fresh tokens
  const newTokens = generateTokens({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  })

  await prisma.$transaction([
    prisma.session.delete({ where: { id: session.id } }),
    prisma.session.create({
      data: {
        userId: session.user.id,
        refreshTokenHash: hashToken(newTokens.refreshToken),
        expiresAt: sessionExpiresAt(),
      },
    }),
  ])

  return {
    user: toUserProfile(session.user),
    tokens: newTokens,
  }
}
