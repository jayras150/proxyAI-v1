// ProxyAI — TransactionRepository Interface
// Blueprint Reference: Sprint 14 §106 — Repository Pattern
// Milestone 1: interface only. Money values are Decimal at the data layer
// and must be serialized as strings at the API layer (never JS numbers).

import type { Transaction, Prisma } from '@prisma/client'

/** Cursor for keyset pagination over transactions. */
export interface TransactionCursor {
  createdAt: Date
  id: string
}

export interface TransactionPage {
  items: Transaction[]
  nextCursor: TransactionCursor | null
  hasMore: boolean
}

export interface TransactionCreateInput {
  walletId: string
  userId: string // denormalized for audit (immutable)
  amount: Prisma.Decimal
  balanceBefore: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  currency: string
  type: Transaction['type']
  reference: string
  status?: Transaction['status']
  description?: string | null
  // audit metadata
  requestId?: string | null
  providerReference?: string | null
  createdBy?: string | null // 'user:<id>' | 'admin:<id>' | 'system'
  ipAddress?: string | null
  userAgent?: string | null
}

export interface TransactionRepository {
  /** Create an immutable transaction record. No update/delete paths exist. */
  create(input: TransactionCreateInput, tx?: Prisma.TransactionClient): Promise<Transaction>

  /** Find a transaction by its unique reference. */
  findByReference(reference: string): Promise<Transaction | null>

  /**
   * Keyset pagination: transactions of a wallet ordered by
   * (createdAt DESC, id DESC) — stable even as new rows are added.
   */
  findByWalletIdPaginated(
    walletId: string,
    cursor: TransactionCursor | null,
    limit: number
  ): Promise<TransactionPage>
}
