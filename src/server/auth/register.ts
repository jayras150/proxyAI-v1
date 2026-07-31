// ProxyAI — Registration Service
// Blueprint Reference: Sprint 6 & 9 — Auth Architecture & API

import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { generateTokens } from '@/lib/jwt'
import { AuthError } from '@/lib/errors'
import { toUserProfile, userProfileSelect } from '@/lib/user-profile'
import { createSession } from './session'
import type { RegisterInput } from '@/lib/validation'
import type { AuthTokens, UserProfile } from '@/types/auth'

export interface RegisterResult {
  user: UserProfile
  tokens: AuthTokens
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const { email, password, name } = input

  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new AuthError('EMAIL_EXISTS', 'An account with this email already exists.')
  }

  // Hash password and create user + wallet in transaction
  const passwordHash = await hashPassword(password)

  const user = await prisma.$transaction(async (tx) => {
    return tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        wallet: {
          create: {
            balance: 0,
            currency: 'USD',
          },
        },
      },
      select: userProfileSelect,
    })
  })

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
