// ProxyAI — WebhookEventRepository Interface
// Blueprint Reference: Design Review Wallet §12 — Webhook Replay Protection
// Milestone 1: interface. Milestone 3: Prisma implementation.

import type { WebhookEvent, Prisma, PaymentProvider } from '@prisma/client'

export interface WebhookEventCreateInput {
  provider: PaymentProvider
  providerEventId: string
  payloadHash: string // sha256 of raw body
  payload?: Prisma.InputJsonValue
}

export interface WebhookEventRepository {
  /**
   * Record an incoming webhook. Unique (provider, providerEventId) makes
   * redelivered webhooks fail here — the caller acks without reprocessing.
   */
  create(input: WebhookEventCreateInput, tx?: Prisma.TransactionClient): Promise<WebhookEvent>

  /** Find a previously received event by provider + event id. */
  findByProviderEventId(provider: PaymentProvider, providerEventId: string): Promise<WebhookEvent | null>

  /** Mark processed after successful handling. */
  markProcessed(id: string, tx?: Prisma.TransactionClient): Promise<WebhookEvent>

  /** Mark failed with the error message retained for investigation. */
  markFailed(id: string, error: string, tx?: Prisma.TransactionClient): Promise<WebhookEvent>
}
