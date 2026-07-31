// ProxyAI — IdempotencyService
// Blueprint Reference: Sprint 4 §24, Sprint 9 §68 — Idempotency
// Reusable across wallet/topup/billing/refund. Lifecycle:
//   reserve() → run handler → complete() | replay() on retry.

import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { canonicalJsonHash } from '@/lib/crypto'
import type { IdempotencyKeyRepository } from './idempotency-key.repository'
import type { Prisma } from '@prisma/client'

export class IdempotencyError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'IdempotencyError'
  }
}

export const IdempotencyErrorCode = {
  KEY_REUSED_WITH_DIFFERENT_REQUEST: 'KEY_REUSED_WITH_DIFFERENT_REQUEST',
  IN_PROGRESS: 'IN_PROGRESS',
  NOT_FOUND: 'NOT_FOUND',
} as const

export type IdempotencyErrorCodeValue = (typeof IdempotencyErrorCode)[keyof typeof IdempotencyErrorCode]

export interface ReserveInput {
  key: string
  scope: string
  userId: string
  request: unknown // canonicalized + hashed for replay validation
  ttlMs?: number
}

export type ReserveResult =
  | { state: 'reserved'; id: string }
  | { state: 'replay'; response: Prisma.JsonValue }

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h (Blueprint §24)

export class IdempotencyService {
  constructor(private readonly repository: IdempotencyKeyRepository) {}

  private requestHash(request: unknown): string {
    return canonicalJsonHash(request)
  }

  /**
   * Reserve an idempotency key for a scope+user+request.
   * - New key → 'reserved' (caller runs the handler, then complete()).
   * - Existing completed key with identical request → 'replay' with stored response.
   * - Existing key with different request → IdempotencyError.
   * - Existing key still PENDING → IdempotencyError(IN_PROGRESS) (concurrent duplicate).
   */
  async reserve(input: ReserveInput): Promise<ReserveResult> {
    const now = new Date()
    const requestHash = this.requestHash(input.request)
    const existing = await this.repository.findActive(input.key, input.scope, input.userId, now)

    if (!existing) {
      const record = await this.repository.create({
        key: input.key,
        scope: input.scope,
        userId: input.userId,
        requestHash,
        expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS)),
      })
      logger.info('idempotency.reserved', {
        key: input.key,
        scope: input.scope,
        user_id: input.userId,
      })
      return { state: 'reserved', id: record.id }
    }

    if (existing.requestHash !== requestHash) {
      throw new IdempotencyError(
        IdempotencyErrorCode.KEY_REUSED_WITH_DIFFERENT_REQUEST,
        'Idempotency key was already used with a different request.'
      )
    }

    if (existing.status === 'PENDING') {
      throw new IdempotencyError(
        IdempotencyErrorCode.IN_PROGRESS,
        'A request with this idempotency key is already being processed.'
      )
    }

    logger.info('idempotency.replay', {
      key: input.key,
      scope: input.scope,
      user_id: input.userId,
    })
    return { state: 'replay', response: existing.response ?? null }
  }

  /** Mark a reserved key COMPLETED and store the response for replay. */
  async complete(id: string, response: unknown): Promise<void> {
    await this.repository.complete(id, response as Prisma.InputJsonValue)
    logger.info('idempotency.completed', { idempotency_id: id })
  }

  /** Opportunistic cleanup of expired keys (no worker in V1). */
  async cleanupExpired(): Promise<number> {
    const count = await this.repository.deleteExpired(new Date())
    if (count > 0) {
      logger.info('idempotency.cleanup', { removed: count })
    }
    return count
  }
}

/** Generate a client-safe idempotency key when none is provided. */
export function generateIdempotencyKey(): string {
  return `key_${crypto.randomUUID()}`
}
