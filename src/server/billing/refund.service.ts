// ProxyAI — RefundService
// Billing Design Review v2 — Revision 6 (Refund State Machine)
// Billing Milestone 6 — Refund Service
//
// The ONLY service that returns wallet balance for previously charged AI
// usage. Refunds the full charged amount (UsageLog.userCost) — a refund can
// never exceed what was billed. Flow:
//
//   1. Validate the UsageLog: COMPLETED, never refunded, owned by the user
//   2. ONE database transaction:
//        - idempotency reserve (inside tx → rolls back on failure)
//        - create RefundRequest (REQUESTED, version 1)
//        - WalletService.creditInTransaction (creates Transaction(REFUND),
//          reactivates PAYMENT_REQUIRED wallets automatically)
//        - UsageLog.status → REFUNDED (guarded: only from COMPLETED)
//        - RefundRequest → COMPLETED (optimistic-lock guarded, once)
//        - idempotency result saved (inside tx)
//   3. AFTER commit: emit billing.refunded + wallet.credited
//
// NEVER: calculates new costs, calls providers, estimates, handles HTTP.

import { Money, type CurrencyCode } from '@/lib/money'
import { prismaToMoney } from '@/lib/prisma'
import { createDomainEvent } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { TransactionManager, TxClient } from '@/server/db/transaction-manager'
import type { WalletService } from '@/server/wallet/wallet.service'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'
import { IdempotencyError } from '@/server/idempotency/idempotency.service'
import type { IdempotencyService, ReserveResult } from '@/server/idempotency/idempotency.service'
import type { UsageRepository } from '@/server/usage/usage.repository'
import type { RefundRepository } from '@/server/refund/refund.repository'
import type { UsageLog } from '@prisma/client'

export class RefundError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'RefundError'
  }
}

export const RefundErrorCode = {
  USAGE_NOT_FOUND: 'USAGE_NOT_FOUND',
  USAGE_NOT_ELIGIBLE: 'USAGE_NOT_ELIGIBLE',
  ALREADY_REFUNDED: 'ALREADY_REFUNDED',
  USER_MISMATCH: 'USER_MISMATCH',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  REFUND_FAILED: 'REFUND_FAILED',
} as const

export type RefundErrorCodeValue = (typeof RefundErrorCode)[keyof typeof RefundErrorCode]

/** Idempotency scope for refunds (schema comment: 'wallet:refund'). */
export const REFUND_IDEMPOTENCY_SCOPE = 'wallet:refund'

export interface RefundInput {
  /** The usage log whose charge is being refunded. */
  usageLogId: string
  userId: string
  reason?: string
  idempotencyKey: string
  requestId?: string
  /** Audit: 'user:<id>' | 'admin:<id>' | 'system' (defaults to system). */
  requestedBy?: string
  ipAddress?: string
  userAgent?: string
}

/** JSON-serializable refund result (stored for idempotent replay). */
export interface RefundResult {
  refundRequestId: string
  usageLogId: string
  transactionId: string
  walletId: string
  userId: string
  amount: string
  currency: string
  usageStatus: string
  refundStatus: string
  walletBalanceAfter: string
  replayed: boolean
}

type TxOutcome =
  | { replayed: true; stored: RefundResult }
  | { replayed: false; result: RefundResult }

export class RefundService {
  constructor(
    private readonly refundRepository: RefundRepository,
    private readonly usageRepository: UsageRepository,
    private readonly walletService: WalletService,
    private readonly idempotencyService: IdempotencyService,
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  /**
   * Refund a charged usage log in full. Idempotent: a retry with the same
   * key returns the stored result without crediting again.
   */
  async refund(input: RefundInput): Promise<RefundResult> {
    try {
      return await this.doRefund(input)
    } catch (error) {
      if (error instanceof RefundError || error instanceof IdempotencyError) {
        throw error
      }
      if (error instanceof WalletError) {
        throw this.mapWalletError(error)
      }
      throw new RefundError(RefundErrorCode.REFUND_FAILED, 'Refund failed unexpectedly.')
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private async doRefund(input: RefundInput): Promise<RefundResult> {
    // ONE transaction: refund is all-or-nothing. The idempotency reserve runs
    // FIRST so a retry replays the stored result even though the usage log is
    // already REFUNDED; eligibility is validated after the replay gate.
    const outcome = await this.transactionManager.withTransaction<TxOutcome>(async (tx) => {
      const reserved = await this.reserveInsideTransaction(tx, input)
      if (reserved.state === 'replay') {
        if (!reserved.response) {
          throw new RefundError(
            RefundErrorCode.REFUND_FAILED,
            'Replayed refund has no stored result.'
          )
        }
        return { replayed: true, stored: reserved.response as unknown as RefundResult }
      }

      // 1. Validate the usage log (inside the tx, after the replay gate).
      const usage = await this.usageRepository.findById(input.usageLogId)
      if (!usage) {
        throw new RefundError(
          RefundErrorCode.USAGE_NOT_FOUND,
          `Usage log ${input.usageLogId} not found.`
        )
      }
      this.assertEligible(usage, input.userId)

      // Re-check inside the tx: another refund may have slipped in between
      // (race-safe via the unique usageLogId constraint).
      const already = await this.refundRepository.findByUsageLogId(input.usageLogId)
      if (already) {
        throw new RefundError(
          RefundErrorCode.ALREADY_REFUNDED,
          `Usage log ${input.usageLogId} already has a refund request.`
        )
      }

      // 3. Create the RefundRequest (REQUESTED, version 1).
      const refund = await this.refundRepository.create(
        {
          userId: input.userId,
          usageLogId: input.usageLogId,
          amount: usage.userCost, // already Prisma.Decimal at the data layer
          currency: usage.currency,
          reason: input.reason ?? null,
          requestedBy: input.requestedBy ?? 'system',
          requestId: input.requestId ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
        tx
      )

      // 4. Credit the wallet — creates Transaction(REFUND) inside this same
      //    tx and reactivates a PAYMENT_REQUIRED wallet automatically.
      const credit = await this.walletService.creditInTransaction(
        tx,
        input.userId,
        Money.fromString(usage.userCost.toString(), usage.currency as CurrencyCode),
        {
          reference: `refund_${input.requestId ?? input.usageLogId}`,
          type: 'REFUND',
          requestId: input.requestId,
          providerReference: input.usageLogId,
          description: `Refund for usage ${input.usageLogId}${input.reason ? `: ${input.reason}` : ''}`,
          createdBy: input.requestedBy ?? 'system',
        }
      )

      // 5. UsageLog COMPLETED → REFUNDED (guarded: null when not COMPLETED).
      const refundedLog = await this.usageRepository.markRefunded(input.usageLogId, tx)
      if (!refundedLog) {
        throw new RefundError(
          RefundErrorCode.USAGE_NOT_ELIGIBLE,
          `Usage log ${input.usageLogId} is not COMPLETED (cannot be refunded).`
        )
      }

      // 6. RefundRequest REQUESTED → COMPLETED (optimistic-lock guarded, once).
      const completed = await this.refundRepository.markCompleted(
        refund.id,
        credit.transaction.id,
        1,
        tx,
        input.requestedBy ?? 'system'
      )
      if (!completed) {
        throw new RefundError(
          RefundErrorCode.REFUND_FAILED,
          'Refund request could not be completed (version conflict).'
        )
      }

      const result: RefundResult = {
        refundRequestId: completed.id,
        usageLogId: input.usageLogId,
        transactionId: credit.transaction.id,
        walletId: credit.wallet.id,
        userId: input.userId,
        amount: credit.transaction.amount.toFixed(6),
        currency: credit.transaction.currency,
        usageStatus: refundedLog.status,
        refundStatus: completed.status,
        walletBalanceAfter: prismaToMoney(
          credit.wallet.balance,
          credit.wallet.currency as CurrencyCode
        ).toString(),
        replayed: false,
      }

      // 7. Idempotency result stored inside the same transaction.
      await this.idempotencyService.completeInTransaction(tx, reserved.id, result)

      return { replayed: false, result }
    })

    if (outcome.replayed) {
      return { ...outcome.stored, replayed: true }
    }

    // 8. Events ONLY after the commit succeeded.
    this.emitRefunded(input, outcome.result)
    this.emitWalletCredited(input, outcome.result)
    return outcome.result
  }

  private assertEligible(usage: UsageLog, userId: string): void {
    if (usage.userId !== userId) {
      throw new RefundError(
        RefundErrorCode.USER_MISMATCH,
        'Usage log does not belong to this user.'
      )
    }
    if (usage.status === 'REFUNDED') {
      throw new RefundError(
        RefundErrorCode.ALREADY_REFUNDED,
        `Usage log ${usage.id} has already been refunded.`
      )
    }
    if (usage.status !== 'COMPLETED') {
      throw new RefundError(
        RefundErrorCode.USAGE_NOT_ELIGIBLE,
        `Usage log ${usage.id} is not COMPLETED (status: ${usage.status}).`
      )
    }
  }

  /** Reserve the idempotency key inside the caller's transaction. */
  private async reserveInsideTransaction(tx: TxClient, input: RefundInput): Promise<ReserveResult> {
    const reserveInput = {
      key: input.idempotencyKey,
      scope: REFUND_IDEMPOTENCY_SCOPE,
      userId: input.userId,
      request: {
        usageLogId: input.usageLogId,
        userId: input.userId,
        reason: input.reason ?? null,
        requestId: input.requestId ?? null,
      },
    }

    try {
      return await this.idempotencyService.reserveInTransaction(tx, reserveInput)
    } catch (error) {
      // Concurrent duplicate reservation: unique (key, scope, userId)
      // constraint (Prisma P2002) means another request got there first.
      if ((error as { code?: string }).code === 'P2002') {
        return this.idempotencyService.reserveInTransaction(tx, reserveInput)
      }
      throw error
    }
  }

  private mapWalletError(error: WalletError): RefundError {
    switch (error.code) {
      case WalletErrorCode.WALLET_NOT_FOUND:
        return new RefundError(RefundErrorCode.WALLET_NOT_FOUND, error.message)
      case WalletErrorCode.CURRENCY_MISMATCH:
        return new RefundError(RefundErrorCode.CURRENCY_MISMATCH, error.message)
      default:
        return new RefundError(RefundErrorCode.REFUND_FAILED, error.message)
    }
  }

  private emitRefunded(input: RefundInput, result: RefundResult): void {
    this.eventDispatcher.emit(
      createDomainEvent('billing.refunded', {
        requestId: input.requestId,
        userId: input.userId,
        walletId: result.walletId,
        transactionId: result.transactionId,
        usageLogId: result.usageLogId,
        refundRequestId: result.refundRequestId,
        amount: result.amount,
        currency: result.currency,
      })
    )
  }

  private emitWalletCredited(input: RefundInput, result: RefundResult): void {
    this.eventDispatcher.emit(
      createDomainEvent('wallet.credited', {
        requestId: input.requestId,
        userId: input.userId,
        walletId: result.walletId,
        transactionId: result.transactionId,
        providerReference: result.usageLogId,
        amount: result.amount,
        currency: result.currency,
      })
    )
  }
}
