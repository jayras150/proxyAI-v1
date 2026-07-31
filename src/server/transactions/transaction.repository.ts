// ProxyAI — TransactionRepository Interface
// Blueprint Reference: Sprint 14 §106 — Repository Pattern
// Money values are Decimal at the data layer and must be serialized as
// strings at the API layer (never JS numbers).

import type { Transaction, TransactionType, TransactionStatus, Currency, Prisma } from '@prisma/client'
import type { Cursor, Page } from '@/server/db/pagination'

/** Cursor for keyset pagination over transactions. */
export type TransactionCursor = Cursor

export type TransactionPage = Page<Transaction>

export interface TransactionCreateInput {
  walletId: string
  userId: string // denormalized for audit (immutable)
  amount: Prisma.Decimal
  balanceBefore: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  currency: Currency
  type: TransactionType
  reference: string
  status?: TransactionStatus
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
