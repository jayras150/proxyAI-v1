// ProxyAI — UsageRepository Interface
// Billing Design Review v2 — Usage Metering + Pricing Snapshot
// Milestone 1: interface only. Implementation arrives with services.

import type { UsageLog, UsageStatus, Prisma, Currency } from '@prisma/client'
import type { Cursor, Page } from '@/server/db/pagination'

export type UsageLogPage = Page<UsageLog>

export interface UsageLogCreateInput {
  userId: string
  apiKeyId?: string | null
  provider: string
  model: string
  modelId?: string | null
  pricingVersionId?: string | null
  promptTokens: number
  completionTokens: number
  cachedTokens?: number
  totalTokens: number
  providerCost: Prisma.Decimal
  userCost: Prisma.Decimal
  currency: Currency
  latencyMs?: number | null
  status?: UsageStatus
  requestId?: string | null
  // pricing snapshot (immutable audit — Billing Design Review v2 R2)
  inputPrice?: Prisma.Decimal | null
  outputPrice?: Prisma.Decimal | null
  markupPercent?: Prisma.Decimal | null
  serviceFee?: Prisma.Decimal | null
}

export interface UsageRepository {
  /** Create an immutable usage log. No update/delete paths exist (except status). */
  create(input: UsageLogCreateInput, tx?: Prisma.TransactionClient): Promise<UsageLog>

  /** Find a usage log by id. */
  findById(id: string): Promise<UsageLog | null>

  /** Find usage log by request id (dedupe + investigation). */
  findByRequestId(requestId: string): Promise<UsageLog | null>

  /**
   * Keyset pagination over a user's usage history
   * (createdAt DESC, id DESC) — dashboard/reporting.
   */
  findByUserIdPaginated(
    userId: string,
    cursor: Cursor | null,
    limit: number
  ): Promise<UsageLogPage>

  /** Transition status (PENDING → COMPLETED/FAILED). */
  updateStatus(id: string, status: UsageStatus, tx?: Prisma.TransactionClient): Promise<UsageLog>

  /** COMPLETED → REFUNDED (guarded: only once, via refund flow). */
  markRefunded(id: string, tx?: Prisma.TransactionClient): Promise<UsageLog | null>
}
