// ProxyAI — TopupRequestRepository Interface
// Blueprint Reference: Sprint 14 §106 — Repository Pattern
// Milestone 1: interface. Milestone 3: Prisma implementation.

import type { TopupRequest, Prisma, PaymentProvider, TopupStatus, Currency } from '@prisma/client'

export interface TopupPageCursor {
  createdAt: Date
  id: string
}

export interface TopupRequestCreateInput {
  userId: string
  walletId: string
  amount: Prisma.Decimal
  currency: Currency
  provider: PaymentProvider
  expiresAt: Date
}

export interface TopupRequestRepository {
  /** Create a pending top-up request. */
  create(input: TopupRequestCreateInput, tx?: Prisma.TransactionClient): Promise<TopupRequest>

  /** Find a top-up request by id (scoped to the owning user). */
  findByIdAndUserId(id: string, userId: string): Promise<TopupRequest | null>

  /** Find a top-up request by id (unscoped — service layer enforces auth). */
  findById(id: string): Promise<TopupRequest | null>

  /** Find by provider reference — used to dedupe webhook deliveries. */
  findByProviderReference(providerReference: string): Promise<TopupRequest | null>

  /** Store the provider reference after the payment intent was created. */
  updateProviderReference(
    id: string,
    providerReference: string,
    tx?: Prisma.TransactionClient
  ): Promise<TopupRequest>

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

  /**
   * List top-ups for a user with cursor pagination (createdAt DESC, id DESC).
   */
  findByUserIdPaginated(
    userId: string,
    cursor: TopupPageCursor | null,
    limit: number
  ): Promise<{ items: TopupRequest[]; nextCursor: TopupPageCursor | null; hasMore: boolean }>

  /**
   * Mark a top-up EXPIRED (payment arrived after expiresAt).
   * Only succeeds when the request is still PENDING (guards races).
   */
  markExpired(id: string, tx?: Prisma.TransactionClient): Promise<TopupRequest | null>
}
