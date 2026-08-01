// ProxyAI — Rotate API Key Service (Milestone 5)
// Revokes the old key and creates a new one atomically.

import { prisma } from '@/lib/prisma'
import { generateApiKey, hashApiKey } from '@/lib/crypto'
import type { CreatedApiKey } from './create'

export async function rotateApiKey(keyId: string, userId: string): Promise<CreatedApiKey> {
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  })

  if (!key) {
    throw new Error('API key not found')
  }

  if (key.status !== 'ACTIVE') {
    throw new Error('Only active API keys can be rotated.')
  }

  // Generate new key first
  const { fullKey, prefix } = generateApiKey()
  const keyHash = hashApiKey(fullKey)

  // Rotate atomically: revoke old, create new
  const newKey = await prisma.$transaction(async (tx) => {
    // Revoke old key
    await tx.apiKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED' },
    })

    // Create new key
    return tx.apiKey.create({
      data: {
        userId,
        name: key.name,
        keyPrefix: prefix,
        keyHash,
      },
    })
  })

  return {
    id: newKey.id,
    name: newKey.name,
    keyPrefix: newKey.keyPrefix,
    fullKey,
    status: newKey.status,
    createdAt: newKey.createdAt.toISOString(),
  }
}
