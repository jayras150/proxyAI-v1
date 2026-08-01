// ProxyAI — ApiKeyRepository Interface
// Billing Milestone 8 — REST API Layer (API key authentication)

import type { ApiKey } from '@prisma/client'

export interface ApiKeyRepository {
  /** Find an API key by its SHA-256 hash (presented key → owner). */
  findByHash(hash: string): Promise<ApiKey | null>

  /** Bump lastUsedAt (audit for key rotation). */
  touchLastUsed(id: string): Promise<void>

  /** Count ACTIVE keys owned by a user (dashboard summary). */
  countActiveByUserId(userId: string): Promise<number>
}
