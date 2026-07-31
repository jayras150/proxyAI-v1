// ProxyAI — ChargeService
// Billing Design Review v2 — ADR-0001 (Controlled Negative Balance)
// Billing Milestone 5 — Charge Service
//
// The ONLY service that settles AI billing. Runs AFTER the provider returns
// usage (post-paid). Flow:
//
//   1. Load PricingVersion by id → build PricingSnapshot
//   2. PricingEngine.calculate() → final cost
//   3. ONE database transaction:
//        - idempotency reserve (inside tx → rolls back on failure)
//        - WalletService.debitWithFloor (ADR-0001 floor policy)
//        - Transaction(AI_USAGE) is created by the wallet service
//        - UsageLog (with immutable pricing snapshot)
//        - wallet → PAYMENT_REQUIRED when balance < 0
//        - idempotency result saved (inside tx)
//   4. AFTER commit: emit billing.charged + wallet.debited
//
// NEVER: calls AI providers, estimates, handles HTTP, is an API controller.

import { Prisma } from '@prisma/client'
import { env } from '@/config/env'
import { Money, MoneyError, type CurrencyCode } from '@/lib/money'
import { moneyToPrisma, prismaToMoney } from '@/lib/prisma'
import { PricingEngine } from './pricing-engine'
import { PricingSnapshot, PricingSnapshotError } from './pricing-snapshot'
import { TokenUsage } from './token-usage'
import { UsageMeter } from './usage-meter'
import { createDomainEvent } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { TransactionManager, TxClient } from '@/server/db/transaction-manager'
import type { WalletService } from '@/server/wallet/wallet.service'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'
import { IdempotencyError } from '@/server/idempotency/idempotency.service'
import type { IdempotencyService, ReserveResult } from '@/server/idempotency/idempotency.service'
import type { PricingRepository } from '@/server/pricing/pricing.repository'
import type { UsageRepository } from '@/server/usage/usage.repository'

export class ChargeError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ChargeError'
  }
}

export const ChargeErrorCode = {
  PRICING_NOT_FOUND: 'PRICING_NOT_FOUND',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  FLOOR_EXCEEDED: 'FLOOR_EXCEEDED',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  CHARGE_FAILED: 'CHARGE_FAILED',
} as const

export type ChargeErrorCodeValue = (typeof ChargeErrorCode)[keyof typeof ChargeErrorCode]

/** Idempotency scope for AI usage settlement (schema comment: 'billing:usage'). */
export const CHARGE_IDEMPOTENCY_SCOPE = 'billing:usage'

export interface ChargeInput {
  requestId: string
  userId: string
  modelId: string
  /** Human-readable model name (UsageLog.model). */
  model: string
  /** Provider identifier (UsageLog.provider), e.g. 'deepseek'. */
  provider: string
  /** The pricing version to settle against (already selected at request time). */
  pricingVersionId: string
  /** Final metered usage (produced by UsageMeter). */
  usage: TokenUsage
  idempotencyKey: string
  apiKeyId?: string | null
  latencyMs?: number | null
  /** Floor override (defaults to env WALLET_MAX_NEGATIVE_BALANCE). */
  maxNegativeBalance?: Money
  createdBy?: string
}

/** Like ChargeInput, but takes raw provider usage (metered internally). */
export type ChargeRawInput = Omit<ChargeInput, 'usage'> & {
  rawUsage: unknown
}

/** JSON-serializable settlement result (stored for idempotent replay). */
export interface ChargeResult {
  chargeId: string
  transactionId: string
  walletId: string
  userId: string
  requestId: string
  pricingVersionId: string
  usage: {
    promptTokens: number
    completionTokens: number
    cachedTokens: number
    totalTokens: number
  }
  breakdown: {
    providerCost: string
    markupCost: string
    serviceFee: string
    subtotal: string
    totalCost: string
    currency: string
  }
  walletBalanceAfter: string
  walletStatus: string
  replayed: boolean
}

type TxOutcome =
  | { replayed: true; stored: ChargeResult }
  | { replayed: false; result: ChargeResult }

export class ChargeService {
  constructor(
    private readonly pricingRepository: PricingRepository,
    private readonly usageRepository: UsageRepository,
    private readonly walletService: WalletService,
    private readonly idempotencyService: IdempotencyService,
    private readonly transactionManager: TransactionManager,
    private readonly pricingEngine: PricingEngine,
    private readonly eventDispatcher: EventDispatcher,
    private readonly usageMeter?: UsageMeter
  ) {}

  /**
   * Settle a completed AI request. Idempotent: a retry with the same key
   * returns the stored result without touching the wallet again.
   */
  async charge(input: ChargeInput): Promise<ChargeResult> {
    try {
      return await this.doCharge(input)
    } catch (error) {
      if (error instanceof ChargeError || error instanceof IdempotencyError) {
        throw error
      }
      if (error instanceof WalletError) {
        throw this.mapWalletError(error)
      }
      if (
        (error instanceof PricingSnapshotError || error instanceof MoneyError) &&
        error.code === 'CURRENCY_MISMATCH'
      ) {
        throw new ChargeError(ChargeErrorCode.CURRENCY_MISMATCH, error.message)
      }
      throw new ChargeError(ChargeErrorCode.CHARGE_FAILED, 'Charge failed unexpectedly.')
    }
  }

  /** Meter raw provider usage (UsageMeter) then charge. */
  async chargeRaw(input: ChargeRawInput): Promise<ChargeResult> {
    if (!this.usageMeter) {
      throw new ChargeError(
        ChargeErrorCode.CHARGE_FAILED,
        'UsageMeter is not configured on ChargeService.'
      )
    }
    const parsed = this.usageMeter.parseDetailed(input.provider, input.rawUsage)
    return this.charge({
      requestId: input.requestId,
      userId: input.userId,
      modelId: input.modelId,
      model: input.model,
      provider: input.provider,
      pricingVersionId: input.pricingVersionId,
      usage: parsed.usage,
      idempotencyKey: input.idempotencyKey,
      apiKeyId: input.apiKeyId,
      latencyMs: input.latencyMs,
      maxNegativeBalance: input.maxNegativeBalance,
      createdBy: input.createdBy,
    })
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private async doCharge(input: ChargeInput): Promise<ChargeResult> {
    // 1. Load the pricing version used at request time.
    const pricing = await this.pricingRepository.findById(input.pricingVersionId)
    if (!pricing) {
      throw new ChargeError(
        ChargeErrorCode.PRICING_NOT_FOUND,
        `Pricing version ${input.pricingVersionId} not found.`
      )
    }

    // 2-3. Build snapshot + calculate the final cost (pure, deterministic).
    const snapshot = PricingSnapshot.create({
      pricingVersionId: pricing.id,
      inputPrice: Money.fromString(pricing.inputPrice.toString(), pricing.currency as CurrencyCode),
      outputPrice: Money.fromString(pricing.outputPrice.toString(), pricing.currency as CurrencyCode),
      markupPercent: pricing.markupPercent.toNumber(),
      serviceFee: Money.fromString(pricing.serviceFee.toString(), pricing.currency as CurrencyCode),
    })
    const breakdown = this.pricingEngine.calculate({ snapshot, usage: input.usage })

    // 4. ONE transaction: settlement is all-or-nothing.
    const outcome = await this.transactionManager.withTransaction<TxOutcome>(async (tx) => {
      const reserved = await this.reserveInsideTransaction(tx, input)
      if (reserved.state === 'replay') {
        if (!reserved.response) {
          throw new ChargeError(
            ChargeErrorCode.CHARGE_FAILED,
            'Replayed charge has no stored result.'
          )
        }
        return { replayed: true, stored: reserved.response as unknown as ChargeResult }
      }

      const floor = this.floorFor(input, snapshot.currency)

      // 5. Debit the wallet with the negative-balance floor (creates the
      //    immutable AI_USAGE transaction inside this same tx).
      const debit = await this.walletService.debitWithFloorInTransaction(
        tx,
        input.userId,
        breakdown.totalCost,
        floor,
        {
          reference: `charge_${input.requestId}`,
          type: 'AI_USAGE',
          requestId: input.requestId,
          providerReference: input.requestId,
          description: `AI usage charge: ${input.model}`,
          createdBy: input.createdBy ?? 'system',
        }
      )

      // 6. ADR-0001: balance < 0 after settlement → PAYMENT_REQUIRED.
      const balance = prismaToMoney(debit.wallet.balance, debit.wallet.currency as CurrencyCode)
      let walletStatus = debit.wallet.status
      if (balance.isNegative()) {
        if (debit.wallet.status !== 'PAYMENT_REQUIRED') {
          await this.walletService.updateStatusInTransaction(tx, debit.wallet.id, 'PAYMENT_REQUIRED')
        }
        walletStatus = 'PAYMENT_REQUIRED'
      } else if (debit.wallet.status === 'PAYMENT_REQUIRED') {
        await this.walletService.updateStatusInTransaction(tx, debit.wallet.id, 'ACTIVE')
        walletStatus = 'ACTIVE'
      }

      // 7. Immutable usage log with the pricing snapshot (audit trail).
      const usageLog = await this.usageRepository.create(
        {
          userId: input.userId,
          apiKeyId: input.apiKeyId ?? null,
          provider: input.provider,
          model: input.model,
          modelId: input.modelId,
          pricingVersionId: pricing.id,
          promptTokens: input.usage.promptTokens,
          completionTokens: input.usage.completionTokens,
          cachedTokens: input.usage.cachedTokens,
          totalTokens: input.usage.totalTokens,
          providerCost: moneyToPrisma(breakdown.providerCost),
          userCost: moneyToPrisma(breakdown.totalCost),
          currency: snapshot.currency,
          latencyMs: input.latencyMs ?? null,
          status: 'COMPLETED',
          requestId: input.requestId,
          inputPrice: moneyToPrisma(snapshot.inputPrice),
          outputPrice: moneyToPrisma(snapshot.outputPrice),
          markupPercent: new Prisma.Decimal(snapshot.markupPercent),
          serviceFee: moneyToPrisma(snapshot.serviceFee),
        },
        tx
      )

      const result: ChargeResult = {
        chargeId: usageLog.id,
        transactionId: debit.transaction.id,
        walletId: debit.wallet.id,
        userId: input.userId,
        requestId: input.requestId,
        pricingVersionId: pricing.id,
        usage: {
          promptTokens: input.usage.promptTokens,
          completionTokens: input.usage.completionTokens,
          cachedTokens: input.usage.cachedTokens,
          totalTokens: input.usage.totalTokens,
        },
        breakdown: {
          providerCost: breakdown.providerCost.toString(),
          markupCost: breakdown.markupCost.toString(),
          serviceFee: breakdown.serviceFee.toString(),
          subtotal: breakdown.subtotal.toString(),
          totalCost: breakdown.totalCost.toString(),
          currency: breakdown.currency,
        },
        walletBalanceAfter: debit.wallet.balance.toFixed(6),
        walletStatus,
        replayed: false,
      }

      // 8. Idempotency result stored inside the same transaction.
      await this.idempotencyService.completeInTransaction(tx, reserved.id, result)

      return { replayed: false, result }
    })

    if (outcome.replayed) {
      return { ...outcome.stored, replayed: true }
    }

    // 9. Events ONLY after the commit succeeded.
    this.emitCharged(input, outcome.result)
    this.emitWalletDebited(input, outcome.result)
    return outcome.result
  }

  /** Reserve the idempotency key inside the caller's transaction. */
  private async reserveInsideTransaction(tx: TxClient, input: ChargeInput): Promise<ReserveResult> {
    const reserveInput = {
      key: input.idempotencyKey,
      scope: CHARGE_IDEMPOTENCY_SCOPE,
      userId: input.userId,
      request: this.requestPayload(input),
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

  private requestPayload(input: ChargeInput): unknown {
    return {
      userId: input.userId,
      modelId: input.modelId,
      pricingVersionId: input.pricingVersionId,
      requestId: input.requestId,
      usage: {
        promptTokens: input.usage.promptTokens,
        completionTokens: input.usage.completionTokens,
        cachedTokens: input.usage.cachedTokens,
      },
    }
  }

  private floorFor(input: ChargeInput, currency: CurrencyCode): Money {
    const floor =
      input.maxNegativeBalance ?? Money.fromString(env.walletMaxNegativeBalance, currency)
    if (floor.currency !== currency) {
      throw new ChargeError(
        ChargeErrorCode.CURRENCY_MISMATCH,
        `Floor currency ${floor.currency} does not match ${currency}.`
      )
    }
    return floor
  }

  private mapWalletError(error: WalletError): ChargeError {
    switch (error.code) {
      case WalletErrorCode.WALLET_NOT_FOUND:
        return new ChargeError(ChargeErrorCode.WALLET_NOT_FOUND, error.message)
      case WalletErrorCode.INSUFFICIENT_BALANCE:
        return new ChargeError(
          ChargeErrorCode.FLOOR_EXCEEDED,
          'Charge exceeds the wallet negative-balance floor.'
        )
      case WalletErrorCode.CURRENCY_MISMATCH:
        return new ChargeError(ChargeErrorCode.CURRENCY_MISMATCH, error.message)
      default:
        return new ChargeError(ChargeErrorCode.CHARGE_FAILED, error.message)
    }
  }

  private emitCharged(input: ChargeInput, result: ChargeResult): void {
    this.eventDispatcher.emit(
      createDomainEvent('billing.charged', {
        requestId: input.requestId,
        userId: input.userId,
        walletId: result.walletId,
        transactionId: result.transactionId,
        usageLogId: result.chargeId,
        modelId: input.modelId,
        pricingVersionId: result.pricingVersionId,
        provider: input.provider,
        amount: result.breakdown.totalCost,
        currency: result.breakdown.currency,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        cachedTokens: result.usage.cachedTokens,
        totalTokens: result.usage.totalTokens,
        walletStatusAfter: result.walletStatus,
      })
    )
  }

  private emitWalletDebited(input: ChargeInput, result: ChargeResult): void {
    this.eventDispatcher.emit(
      createDomainEvent('wallet.debited', {
        requestId: input.requestId,
        userId: input.userId,
        walletId: result.walletId,
        transactionId: result.transactionId,
        provider: input.provider,
        providerReference: input.requestId,
        amount: result.breakdown.totalCost,
        currency: result.breakdown.currency,
      })
    )
  }
}
