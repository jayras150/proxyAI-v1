// ProxyAI — EstimateService
// Billing Design Review v2 — Revision 1/9, ADR-0001 (Controlled Negative Balance)
//
// Read-only service: estimates the cost of a request BEFORE it reaches the
// AI provider and decides whether the request may proceed under the
// negative-balance business policy.
//
// Responsibilities:
//  - load the active PricingVersion for the model
//  - build a PricingSnapshot and call PricingEngine.calculate()
//  - read the user's wallet balance
//  - apply WALLET_MAX_NEGATIVE_BALANCE floor policy
//
// NEVER: debits, creates transactions/usage logs, calls providers, emits
// events, or writes anything. Pure read + calculation.
//
// Uses PricingEngine — it is NOT a pricing engine itself.

import { Money, MoneyError, type CurrencyCode } from '@/lib/money'
import { env } from '@/config/env'
import { prismaToMoney } from '@/lib/prisma'
import { PricingEngine } from './pricing-engine'
import { PricingSnapshot, PricingSnapshotError } from './pricing-snapshot'
import { TokenUsage } from './token-usage'
import type { PricingRepository } from '@/server/pricing/pricing.repository'
import type { WalletService } from '@/server/wallet/wallet.service'
import type { Wallet } from '@prisma/client'

export class EstimateError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'EstimateError'
  }
}

export const EstimateErrorCode = {
  PRICING_NOT_FOUND: 'PRICING_NOT_FOUND',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  ESTIMATE_FAILED: 'ESTIMATE_FAILED',
} as const

export type EstimateErrorCodeValue = (typeof EstimateErrorCode)[keyof typeof EstimateErrorCode]

/** Reason why a request cannot proceed (when canProceed is false). */
export type EstimateRejectReason =
  | typeof EstimateErrorCode.INSUFFICIENT_BALANCE
  | 'WALLET_LOCKED'
  | 'WALLET_SUSPENDED'
  | 'PAYMENT_REQUIRED'

export interface EstimateInput {
  userId: string
  modelId: string
  usage: TokenUsage
  /** Optional service fee override (defaults to pricing version fee). */
  serviceFee?: Money
  /** Optional floor override (defaults to env WALLET_MAX_NEGATIVE_BALANCE). */
  maxNegativeBalance?: Money
}

export interface EstimateResult {
  estimatedCost: Money
  /** projected wallet balance after settlement: balance - estimatedCost */
  estimatedBalance: Money
  canProceed: boolean
  reason: EstimateRejectReason | null
  pricingSnapshot: PricingSnapshot
  pricingVersionId: string
}

export class EstimateService {
  constructor(
    private readonly pricingRepository: PricingRepository,
    private readonly walletService: WalletService,
    private readonly pricingEngine: PricingEngine
  ) {}

  /**
   * Estimate the cost of a request and decide whether it may proceed.
   * Read-only — never mutates any state.
   */
  async estimate(input: EstimateInput): Promise<EstimateResult> {
    try {
      const pricing = await this.pricingRepository.findActiveByModelId(input.modelId, new Date())

      if (!pricing) {
        throw new EstimateError(
          EstimateErrorCode.PRICING_NOT_FOUND,
          `No active pricing found for model ${input.modelId}.`
        )
      }

      const snapshot = PricingSnapshot.create({
        pricingVersionId: pricing.id,
        inputPrice: Money.fromString(pricing.inputPrice.toString(), pricing.currency as CurrencyCode),
        outputPrice: Money.fromString(pricing.outputPrice.toString(), pricing.currency as CurrencyCode),
        markupPercent: pricing.markupPercent.toNumber(),
        serviceFee: Money.fromString(pricing.serviceFee.toString(), pricing.currency as CurrencyCode),
      })

      const breakdown = this.pricingEngine.calculate({
        snapshot,
        usage: input.usage,
        serviceFee: input.serviceFee,
      })

      const wallet = await this.walletService.getWallet(input.userId)
      if (!wallet) {
        throw new EstimateError(EstimateErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
      }

      const estimatedCost = breakdown.totalCost
      const rejectReason = this.checkWalletStatus(wallet)
      if (rejectReason) {
        return this.buildResult(snapshot, estimatedCost, wallet, rejectReason)
      }

      // Wallet status is fine — evaluate the negative-balance floor.
      const balance = prismaToMoney(wallet.balance, wallet.currency as CurrencyCode)
      const estimatedBalance = balance.subtract(estimatedCost)

      const maxNegative = input.maxNegativeBalance ?? this.defaultFloor(balance.currency)
      if (maxNegative.currency !== balance.currency) {
        throw new EstimateError(
          EstimateErrorCode.CURRENCY_MISMATCH,
          `Floor currency ${maxNegative.currency} does not match wallet ${balance.currency}.`
        )
      }

      const canProceed = !estimatedBalance.lessThan(maxNegative.negate())

      return {
        estimatedCost,
        estimatedBalance,
        canProceed,
        reason: canProceed ? null : EstimateErrorCode.INSUFFICIENT_BALANCE,
        pricingSnapshot: snapshot,
        pricingVersionId: pricing.id,
      }
    } catch (error) {
      if (error instanceof EstimateError) throw error
      if (error instanceof PricingSnapshotError || error instanceof MoneyError) {
        if (error.code === 'CURRENCY_MISMATCH') {
          throw new EstimateError(
            EstimateErrorCode.CURRENCY_MISMATCH,
            `Pricing currency does not match the wallet currency: ${error.message}`
          )
        }
      }
      throw new EstimateError(EstimateErrorCode.ESTIMATE_FAILED, 'Estimation failed unexpectedly.')
    }
  }

  private checkWalletStatus(wallet: Wallet): EstimateRejectReason | null {
    switch (wallet.status) {
      case 'PAYMENT_REQUIRED':
        return 'PAYMENT_REQUIRED'
      case 'LOCKED':
        return 'WALLET_LOCKED'
      case 'SUSPENDED':
        return 'WALLET_SUSPENDED'
      default:
        return null
    }
  }

  private buildResult(
    snapshot: PricingSnapshot,
    estimatedCost: Money,
    wallet: Wallet,
    reason: EstimateRejectReason
  ): EstimateResult {
    const balance = prismaToMoney(wallet.balance, wallet.currency as CurrencyCode)
    return {
      estimatedCost,
      estimatedBalance: balance.subtract(estimatedCost),
      canProceed: false,
      reason,
      pricingSnapshot: snapshot,
      pricingVersionId: snapshot.pricingVersionId,
    }
  }

  private defaultFloor(currency: CurrencyCode): Money {
    return Money.fromString(env.walletMaxNegativeBalance, currency)
  }
}
