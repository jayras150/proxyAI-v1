// ProxyAI — DashboardSummaryService
// User Dashboard Milestone 2 — Home
//
// Single read-model aggregate for GET /api/v1/dashboard/summary.
// One service call → one response: wallet, today/month usage, recent
// transactions & usage, active keys, model registry, provider status.
// The route NEVER fans out to per-widget endpoints (no N+1).
//
// Period boundaries are computed in UTC (createdAt is stored as UTC).
// Only COMPLETED usage logs count toward spend — PENDING is in-flight,
// FAILED was never charged, REFUNDED was reversed (matches settled debits).

import { prisma } from '@/lib/prisma'
import type { Transaction, UsageLog } from '@prisma/client'
import type { WalletService } from '@/server/wallet/wallet.service'
import type { TransactionService } from '@/server/transactions/transaction.service'
import type { UsageRepository } from '@/server/usage/usage.repository'
import type { ApiKeyRepository } from '@/server/api-keys/api-key.repository'
import type { ModelService } from '@/server/models/model.service'
import { WalletError, WalletErrorCode } from '@/server/wallet/wallet.errors'

export interface ProviderStatus {
  id: string
  healthy: boolean
  latency_ms: number | null
}

export interface DashboardSummaryData {
  balance: string
  currency: string
  wallet_status: string
  requests_today: number
  tokens_today: number
  spend_today: string
  spend_month: string
  spend_previous_month: string
  active_keys: number
  available_models: number
  default_model: string | null
  latest_transactions: Transaction[]
  latest_usage: UsageLog[]
  provider: ProviderStatus
}

/** AI configuration key holding the default model id (optional). */
const DEFAULT_MODEL_CONFIG_KEY = 'default_model'

export class DashboardSummaryService {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly usageRepository: UsageRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly modelService: ModelService,
    private readonly providerStatus: () => Promise<ProviderStatus>
  ) {}

  /** Build the full dashboard summary for a user (single call, parallel reads). */
  async getSummary(userId: string, now: Date = new Date()): Promise<DashboardSummaryData> {
    const wallet = await this.walletService.getWallet(userId)
    if (!wallet) {
      throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
    }

    // UTC day/month boundaries (deterministic; testable via `now`).
    const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const tomorrowStart = todayStart + 86_400_000
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    const nextMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    const prevMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)

    const [today, month, previousMonth, recentUsage, recentTxPage, activeKeys, models, provider] =
      await Promise.all([
        this.usageRepository.aggregatePeriod(userId, new Date(todayStart), new Date(tomorrowStart)),
        this.usageRepository.aggregatePeriod(userId, new Date(monthStart), new Date(nextMonthStart)),
        this.usageRepository.aggregatePeriod(userId, new Date(prevMonthStart), new Date(monthStart)),
        this.usageRepository.findByUserIdPaginated(userId, null, 5),
        this.transactionService.getWalletHistory(wallet.id, null, 5),
        this.apiKeyRepository.countActiveByUserId(userId),
        this.modelService.list(),
        this.providerStatus(),
      ])

    return {
      balance: wallet.balance.toFixed(6),
      currency: wallet.currency,
      wallet_status: wallet.status,
      requests_today: today.requests,
      tokens_today: today.tokens,
      spend_today: today.cost.toFixed(6),
      spend_month: month.cost.toFixed(6),
      spend_previous_month: previousMonth.cost.toFixed(6),
      active_keys: activeKeys,
      available_models: models.length,
      default_model: await this.readDefaultModel(),
      latest_transactions: recentTxPage.items,
      latest_usage: recentUsage.items,
      provider,
    }
  }

  /** Optional default model from AiConfiguration (never fails the summary). */
  private async readDefaultModel(): Promise<string | null> {
    try {
      const config = await prisma.aiConfiguration.findUnique({
        where: { key: DEFAULT_MODEL_CONFIG_KEY },
      })
      if (!config) return null
      const value = config.value
      if (typeof value === 'string' && value) return value
      if (
        value &&
        typeof value === 'object' &&
        'model' in value &&
        typeof (value as { model?: unknown }).model === 'string'
      ) {
        return (value as { model: string }).model
      }
      return null
    } catch {
      // Config read is best-effort — a broken config row must not take the
      // whole dashboard down.
      return null
    }
  }
}
