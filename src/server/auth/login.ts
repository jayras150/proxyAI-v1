// ProxyAI — Login Service
// Blueprint Reference: Sprint 6 & 9 — Auth Architecture & API

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { generateTokens } from '@/lib/jwt'
import { hashToken } from '@/lib/crypto'
import { AuthError } from '@/lib/errors'
import type { AuthTokens, UserProfile } from '@/types/auth'
import { REFRESH_TOKEN_LIFETIME_MS } from './constants'

export interface LoginResult {
  user: UserProfile
  tokens: AuthTokens
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  })

  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.')
  }

  if (user.status === 'SUSPENDED') {
    throw new AuthError('ACCOUNT_SUSPENDED', 'Your account has been suspended.')
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.')
  }

  // Generate tokens
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
  })

  // Store only the SHA-256 hash of the refresh token
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS)

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(tokens.refreshToken),
      expiresAt,
    },
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    },
    tokens,
  }
}
