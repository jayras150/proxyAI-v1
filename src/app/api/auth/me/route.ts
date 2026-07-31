// ProxyAI — GET /api/auth/me
// Returns the authenticated user profile (reads HttpOnly access cookie).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/jwt'
import { successResponse, errorResponse } from '@/types/api'
import { getAccessToken } from '@/lib/cookies'
import type { UserProfile } from '@/types/auth'

export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request)
    if (!accessToken) {
      return NextResponse.json(
        errorResponse('UNAUTHORIZED', 'Missing or invalid authorization header.'),
        { status: 401 }
      )
    }

    let payload
    try {
      payload = verifyAccessToken(accessToken)
    } catch {
      return NextResponse.json(
        errorResponse('INVALID_TOKEN', 'Access token is invalid or expired.'),
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    if (!user || user.status === 'SUSPENDED') {
      return NextResponse.json(
        errorResponse('UNAUTHORIZED', 'Account not found or suspended.'),
        { status: 401 }
      )
    }

    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    }

    return NextResponse.json(successResponse(profile))
  } catch (error) {
    console.error('Get me error:', error)
    return NextResponse.json(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
      { status: 500 }
    )
  }
}
