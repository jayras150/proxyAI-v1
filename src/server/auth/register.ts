// ProxyAI — Registration Service
// Blueprint Reference: Sprint 6 & 9 — Auth Architecture & API

import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { generateTokens } from '@/lib/jwt'
import { hashToken } from '@/lib/crypto'
import { AuthError } from '@/lib/errors'
import type { RegisterInput } from '@/lib/validation'
import type { AuthTokens, UserProfile } from '@/types/auth'
import { REFRESH_TOKEN_LIFETIME_MS } from './constants'

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
    const newUser = await tx.user.create({
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
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    return newUser
  })

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
