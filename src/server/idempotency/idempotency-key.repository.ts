// ProxyAI — IdempotencyKeyRepository Interface
// Blueprint Reference: Sprint 4 §24, Sprint 9 §68 — Idempotency
// Milestone 1: interface only. Reusable across wallet/billing/refund/etc.

import type { IdempotencyKey, Prisma } from '@prisma/client'

export interface IdempotencyKeyCreateInput {
  key: string
  scope: string // 'wallet:topup' | 'billing:usage' | 'wallet:refund' | ...
  userId: string
  requestHash: string // sha256 of canonical request body
  expiresAt: Date
}

export interface IdempotencyKeyRepository {
  /** Find an existing key within its scope (must not be expired). */
  findActive(
    key: string,
    scope: string,
    userId: string,
    now: Date,
    tx?: Prisma.TransactionClient
  ): Promise<IdempotencyKey | null>

  /** Reserve the key (unique constraint guards concurrent duplicates). */
  create(input: IdempotencyKeyCreateInput, tx?: Prisma.TransactionClient): Promise<IdempotencyKey>

  /** Mark COMPLETED and store the response to replay on identical retries. */
  complete(
    id: string,
    response: Prisma.InputJsonValue,
    tx?: Prisma.TransactionClient
  ): Promise<IdempotencyKey>

  /** Opportunistic cleanup of expired keys (no worker in V1). */
  deleteExpired(now: Date): Promise<number>
}
