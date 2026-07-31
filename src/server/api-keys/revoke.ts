// ProxyAI — Revoke API Key Service
// Blueprint Reference: Sprint 6 — API Key revocation

import { prisma } from '@/lib/prisma'

export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  })

  if (!key) {
    throw new Error('API key not found')
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { status: 'REVOKED' },
  })
}
