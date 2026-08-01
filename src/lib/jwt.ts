// ProxyAI JWT Utilities
// Blueprint Reference: Sprint 6 — JWT Access Token & Refresh Token

import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import type { JwtPayload, AuthTokens } from '@/types/auth'

function generateAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  const expiresInSeconds = Math.floor(ms(env.jwtExpiresIn) / 1000)
  return jwt.sign(
    { ...payload, type: 'access' },
    env.jwtSecret,
    { expiresIn: expiresInSeconds }
  )
}

function generateRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
  const expiresInSeconds = env.refreshExpiresInDays * 24 * 60 * 60
  return jwt.sign(
    { ...payload, type: 'refresh' },
    env.refreshTokenSecret,
    { expiresIn: expiresInSeconds }
  )
}

export function generateTokens(user: { id: string; email: string; role: string }): AuthTokens {
  const payload = { sub: user.id, email: user.email, role: user.role }

  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  // Calculate access token expiry
  const expiresInMs = ms(env.jwtExpiresIn)
  const expiresAt = Date.now() + expiresInMs

  return { accessToken, refreshToken, expiresAt }
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.refreshTokenSecret) as JwtPayload
}

/**
 * Sign an arbitrary access token. Generic helper called by admin/auth.
 */
export function signAccessToken(payload: Record<string, unknown> & {
  sub: string
  email: string
  role: string
}): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    env.jwtSecret,
    { expiresIn: '4h' }
  )
}

/**
 * Sign an arbitrary refresh token.
 */
export function signRefreshToken(payload: Record<string, unknown> & {
  sub: string
  email: string
  role: string
}): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    env.refreshTokenSecret,
    { expiresIn: '24h' }
  )
}

/**
 * Parse a human-readable time string to milliseconds.
 * Supports: "15m", "1h", "30d", etc.
 */
export function ms(time: string): number {
  const match = time.match(/^(\d+)(m|h|d)$/)
  if (!match) return 15 * 60 * 1000 // default 15m

  const value = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 'm': return value * 60 * 1000
    case 'h': return value * 3600 * 1000
    case 'd': return value * 86400 * 1000
    default: return 15 * 60 * 1000
  }
}
