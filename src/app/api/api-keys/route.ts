// ProxyAI — API Key Routes
// Blueprint Reference: Sprint 9 — API Key APIs
// GET  /api/api-keys    — List API keys
// POST /api/api-keys    — Create API key

import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/jwt'
import { AuthError } from '@/lib/errors'
import { getAccessToken } from '@/lib/cookies'
import { listApiKeys } from '@/server/api-keys/list'
import { createApiKey } from '@/server/api-keys/create'
import { createApiKeySchema } from '@/lib/validation'
import { successResponse, errorResponse } from '@/types/api'

function getUserIdFromRequest(request: NextRequest): string {
  const token = getAccessToken(request)
  if (!token) {
    throw new AuthError('UNAUTHORIZED', 'Missing or invalid authorization header.')
  }

  const payload = verifyAccessToken(token)
  return payload.sub
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const keys = await listApiKeys(userId)

    return NextResponse.json(successResponse(keys))
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        errorResponse(error.code, error.message),
        { status: 401 }
      )
    }
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return NextResponse.json(
        errorResponse('INVALID_TOKEN', 'Access token is invalid or expired.'),
        { status: 401 }
      )
    }
    console.error('List API keys error:', error)
    return NextResponse.json(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()

    const parsed = createApiKeySchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', firstError.message),
        { status: 400 }
      )
    }

    const key = await createApiKey(userId, parsed.data.name)

    return NextResponse.json(successResponse(key), { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        errorResponse(error.code, error.message),
        { status: 401 }
      )
    }
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return NextResponse.json(
        errorResponse('INVALID_TOKEN', 'Access token is invalid or expired.'),
        { status: 401 }
      )
    }
    console.error('Create API key error:', error)
    return NextResponse.json(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
      { status: 500 }
    )
  }
}
