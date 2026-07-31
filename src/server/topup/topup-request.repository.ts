// ProxyAI — TopupRequestRepository Interface
// Blueprint Reference: Sprint 14 §106 — Repository Pattern
// Milestone 1: interface only.

import type { TopupRequest, Prisma, PaymentProvider, TopupStatus } from '@prisma/client'

export interface TopupRequestCreateInput {
  userId: string
  walletId: string
  amount: Prisma.Decimal
  currency: string
  provider: PaymentProvider
  expiresAt: Date
}

export interface TopupRequestRepository {
  /** Create a pending top-up request. */
  create(input: TopupRequestCreateInput, tx?: Prisma.TransactionClient): Promise<TopupRequest>

  /** Find a top-up request by id (scoped to the owning user). */
  findByIdAndUserId(id: string, userId: string): Promise<TopupRequest | null>

  /** Find by provider reference — used to dedupe webhook deliveries. */
  findByProviderReference(providerReference: string): Promise<TopupRequest | null>

  /** Atomically transition status; used to prevent double-processing. */
  updateStatus(
    id: string,
    status: TopupStatus,
    tx?: Prisma.TransactionClient
  ): Promise<TopupRequest>

  /**
   * Complete a paid top-up: mark PAID and link the resulting transaction.
   * Only succeeds when the request is still PENDING (guards races).
   */
  markPaid(
    id: string,
    transactionId: string,
    tx?: Prisma.TransactionClient
  ): Promise<TopupRequest | null>
}
