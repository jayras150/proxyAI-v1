// ProxyAI — WalletRepository Interface
// Blueprint Reference: Sprint 14 §106 — Repository Pattern
// Milestone 1: interface. Milestone 2: Prisma implementation.
// Route → Service → Repository → Prisma (service never touches Prisma directly)

import type { Wallet, WalletStatus, Currency, Prisma } from '@prisma/client'

export interface WalletRepository {
  /** Find a wallet by its id. */
  findById(id: string): Promise<Wallet | null>

  /** Find the wallet owned by a user. */
  findByUserId(userId: string): Promise<Wallet | null>

  /** Find wallet by user id with a status filter (e.g. only ACTIVE). */
  findByUserIdAndStatus(userId: string, status: WalletStatus): Promise<Wallet | null>

  /**
   * Create a wallet inside an existing transaction client so wallet creation
   * stays atomic with user creation (registration flow).
   */
  create(
    userId: string,
    currency: Currency,
    tx?: Prisma.TransactionClient
  ): Promise<Wallet>

  /** Atomic credit: balance = balance + amount, version = version + 1. */
  credit(id: string, amount: Prisma.Decimal, tx?: Prisma.TransactionClient): Promise<Wallet>

  /**
   * Atomic conditional debit: only succeeds when balance >= amount.
   * Returns the updated wallet, or null when the balance is insufficient.
   */
  debitIfSufficient(id: string, amount: Prisma.Decimal, tx?: Prisma.TransactionClient): Promise<Wallet | null>

  /**
   * Atomic conditional debit with a negative-balance floor (ADR-0001):
   * succeeds when balance >= amount - floor (i.e. balance - amount >= -floor).
   * Returns the updated wallet, or null when even the floor is exceeded.
   */
  debitWithFloor(
    id: string,
    amount: Prisma.Decimal,
    floor: Prisma.Decimal,
    tx?: Prisma.TransactionClient
  ): Promise<Wallet | null>

  /** Update wallet status (ACTIVE / LOCKED / SUSPENDED). */
  updateStatus(id: string, status: WalletStatus, tx?: Prisma.TransactionClient): Promise<Wallet>
}
