// ProxyAI — RefundRepository Interface
// Billing Design Review v2 — Revision 6 (Refund State Machine)
// Milestone 1: interface only. Implementation arrives with services.

import type { RefundRequest, RefundStatus, Prisma, Currency } from '@prisma/client'
import type { Cursor, Page } from '@/server/db/pagination'

export type RefundRequestPage = Page<RefundRequest>

export interface RefundRequestCreateInput {
  userId: string
  usageLogId: string
  amount: Prisma.Decimal
  currency: Currency
  reason?: string | null
  requestedBy: string // 'user:<id>' | 'admin:<id>' | 'system'
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface RefundRepository {
  /** Create a refund request (REQUESTED). */
  create(input: RefundRequestCreateInput, tx?: Prisma.TransactionClient): Promise<RefundRequest>

  /** Find by id. */
  findById(id: string): Promise<RefundRequest | null>

  /** Find by usage log (unique — one refund request per usage). */
  findByUsageLogId(usageLogId: string): Promise<RefundRequest | null>

  /** Keyset pagination over a user's refund requests. */
  findByUserIdPaginated(
    userId: string,
    cursor: Cursor | null,
    limit: number
  ): Promise<RefundRequestPage>

  /** Transition status with optimistic locking (version guard). */
  updateStatus(
    id: string,
    status: RefundStatus,
    expectedVersion: number,
    tx?: Prisma.TransactionClient
  ): Promise<RefundRequest | null>

  /** APPROVED → COMPLETED, linking the REFUND transaction (guarded, once). */
  markCompleted(
    id: string,
    transactionId: string,
    expectedVersion: number,
    tx?: Prisma.TransactionClient,
    approvedBy?: string
  ): Promise<RefundRequest | null>
}
