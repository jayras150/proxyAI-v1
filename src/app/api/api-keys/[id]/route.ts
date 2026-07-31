// ProxyAI — DELETE /api/api-keys/:id
// Blueprint Reference: Sprint 9 — API Key APIs

import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/jwt'
import { getAccessToken } from '@/lib/cookies'
import { revokeApiKey } from '@/server/api-keys/revoke'
import { successResponse, errorResponse } from '@/types/api'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getAccessToken(request)
    if (!token) {
      return NextResponse.json(
        errorResponse('UNAUTHORIZED', 'Missing or invalid authorization header.'),
        { status: 401 }
      )
    }

    const payload = verifyAccessToken(token)
    const { id } = await params

    await revokeApiKey(id, payload.sub)

    return NextResponse.json(successResponse({ message: 'API key revoked.' }))
  } catch (error) {
    if (error instanceof Error && error.message === 'API key not found') {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'API key not found.'),
        { status: 404 }
      )
    }
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return NextResponse.json(
        errorResponse('INVALID_TOKEN', 'Access token is invalid or expired.'),
        { status: 401 }
      )
    }
    console.error('Revoke API key error:', error)
    return NextResponse.json(
      errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
      { status: 500 }
    )
  }
}
