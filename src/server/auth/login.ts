// ProxyAI — Login Service
// Blueprint Reference: Sprint 6 & 9 — Auth Architecture & API

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { generateTokens } from '@/lib/jwt'
import { AuthError } from '@/lib/errors'
import { toUserProfile, userProfileSelect } from '@/lib/user-profile'
import { createSession } from './session'
import type { AuthTokens, UserProfile } from '@/types/auth'

export interface LoginResult {
  user: UserProfile
  tokens: AuthTokens
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  // Find user (profile fields + password hash for verification)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      ...userProfileSelect,
      passwordHash: true,
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
  await createSession(user.id, tokens.refreshToken)

  return {
    user: toUserProfile(user),
    tokens,
  }
}
