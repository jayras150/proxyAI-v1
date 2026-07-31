// ProxyAI — Create API Key Service
// Blueprint Reference: Sprint 6 & 9 — API Key Security & APIs

import { prisma } from '@/lib/prisma'
import { generateApiKey, hashApiKey } from '@/lib/crypto'

export interface CreatedApiKey {
  id: string
  name: string
  keyPrefix: string
  fullKey: string   // shown only once
  status: string
  createdAt: string
}

export async function createApiKey(userId: string, name: string): Promise<CreatedApiKey> {
  const { fullKey, prefix } = generateApiKey()
  const keyHash = hashApiKey(fullKey)

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyPrefix: prefix,
      keyHash,
    },
  })

  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    fullKey, // exposed only this one time
    status: apiKey.status,
    createdAt: apiKey.createdAt.toISOString(),
  }
}
