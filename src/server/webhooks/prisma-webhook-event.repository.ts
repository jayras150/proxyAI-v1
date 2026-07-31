// ProxyAI — Prisma WebhookEventRepository
// Milestone 3 — Repository implementation (WebhookEvent)

import { prisma } from '@/lib/prisma'
import type { Prisma, PaymentProvider } from '@prisma/client'
import type { WebhookEventRepository, WebhookEventCreateInput } from './webhook-event.repository'

export class PrismaWebhookEventRepository implements WebhookEventRepository {
  async create(input: WebhookEventCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.webhookEvent.create({ data: input })
  }

  async findByProviderEventId(provider: PaymentProvider, providerEventId: string) {
    return prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId,
        },
      },
    })
  }

  async markProcessed(id: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.webhookEvent.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    })
  }

  async markFailed(id: string, error: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma
    return client.webhookEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        error,
        processedAt: new Date(),
      },
    })
  }
}
