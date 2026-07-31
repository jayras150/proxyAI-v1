// ProxyAI — List API Keys Service

import { prisma } from '@/lib/prisma'

export interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  status: string
  lastUsedAt: string | null
  createdAt: string
}

export async function listApiKeys(userId: string): Promise<ApiKeyItem[]> {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      status: true,
      lastUsedAt: true,
      createdAt: true,
    },
  })

  return keys.map((key) => ({
    ...key,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
  }))
}
