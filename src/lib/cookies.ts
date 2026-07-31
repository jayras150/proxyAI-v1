// ProxyAI — HttpOnly Cookie Helpers
// Blueprint Reference: Sprint 6 — HttpOnly Secure Cookie

import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/config/env'
import { ms } from '@/lib/jwt'

export const ACCESS_COOKIE = 'proxyai_access'
export const REFRESH_COOKIE = 'proxyai_refresh'
const COOKIE_PATH = '/'

interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge: number
}

function cookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: maxAgeSeconds,
  }
}

export function accessCookieMaxAgeSeconds(): number {
  return Math.floor(ms(env.jwtExpiresIn) / 1000)
}

export function refreshCookieMaxAgeSeconds(): number {
  return env.refreshExpiresInDays * 24 * 60 * 60
}

/**
 * Set access + refresh tokens as HttpOnly cookies on the response.
 */
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): NextResponse {
  response.cookies.set(
    ACCESS_COOKIE,
    accessToken,
    cookieOptions(accessCookieMaxAgeSeconds())
  )
  response.cookies.set(
    REFRESH_COOKIE,
    refreshToken,
    cookieOptions(refreshCookieMaxAgeSeconds())
  )
  return response
}

/**
 * Clear auth cookies (logout).
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_COOKIE, '', cookieOptions(0))
  response.cookies.set(REFRESH_COOKIE, '', cookieOptions(0))
  return response
}

/**
 * Read the access token from the HttpOnly cookie, falling back to the
 * Authorization: Bearer header (for API clients).
 */
export function getAccessToken(request: NextRequest): string | null {
  const fromCookie = request.cookies.get(ACCESS_COOKIE)?.value
  if (fromCookie) return fromCookie

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length)
  }

  return null
}

/**
 * Read the refresh token from the HttpOnly cookie.
 */
export function getRefreshToken(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_COOKIE)?.value ?? null
}
