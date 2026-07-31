// ProxyAI — Service Composition Root
// Wire domain services together. Routes depend ONLY on this module —
// they never construct repositories or services themselves.

import { PrismaWalletRepository } from '@/server/wallet/prisma-wallet.repository'
import { PrismaTransactionRepository } from '@/server/transactions/prisma-transaction.repository'
import { PrismaTopupRequestRepository } from '@/server/topup/prisma-topup-request.repository'
import { PrismaIdempotencyKeyRepository } from '@/server/idempotency/prisma-idempotency-key.repository'
import { PrismaWebhookEventRepository } from '@/server/webhooks/prisma-webhook-event.repository'
import { PrismaTransactionManager } from '@/server/db/transaction-manager'
import { LocalEventDispatcher } from '@/server/events/event-dispatcher'
import { WalletService } from '@/server/wallet/wallet.service'
import { TransactionService } from '@/server/transactions/transaction.service'
import { TopupService } from '@/server/topup/topup.service'
import { IdempotencyService } from '@/server/idempotency/idempotency.service'
import { PaymentService } from '@/server/payments/payment.service'
import { WebhookService } from '@/server/webhooks/webhook.service'
import { getPaymentProvider } from '@/server/payments'
import { PrismaPricingRepository } from '@/server/pricing/prisma-pricing.repository'
import { PrismaUsageRepository } from '@/server/usage/prisma-usage.repository'
import { PrismaRefundRepository } from '@/server/refund/prisma-refund.repository'
import { PrismaModelRepository } from '@/server/models/prisma-model.repository'
import { PrismaApiKeyRepository } from '@/server/api-keys/prisma-api-key.repository'
import { PricingEngine } from '@/server/billing/pricing-engine'
import { createUsageMeter } from '@/server/billing/usage-meter'
import { EstimateService } from '@/server/billing/estimate.service'
import { ChargeService } from '@/server/billing/charge.service'
import { RefundService } from '@/server/billing/refund.service'
import { AIGateway } from '@/server/gateway/ai-gateway'
import { DeepSeekProvider } from '@/server/providers/deepseek-provider'
import { FetchProviderTransport } from '@/server/providers/fetch-transport'
import { ModelService } from '@/server/models/model.service'
import { env } from '@/config/env'
import type { AIProvider, ProviderChatRequest } from '@/server/gateway/provider-types'
import type { TokenUsage } from '@/server/billing/token-usage'

export interface ApiServices {
  walletService: WalletService
  transactionService: TransactionService
  topupService: TopupService
  idempotencyService: IdempotencyService
  paymentService: PaymentService
  webhookService: WebhookService
  // Billing Milestone 8 — AI Gateway stack
  estimateService: EstimateService
  chargeService: ChargeService
  refundService: RefundService
  aiGateway: AIGateway
  modelService: ModelService
  apiKeyRepository: PrismaApiKeyRepository
  usageRepository: PrismaUsageRepository
  providerInfo: { id: string; version: string; capabilities: ReturnType<AIProvider['capabilities']> }
  /** Provider liveness via the AIProvider interface (health route). */
  providerHealth: () => Promise<{ ok: boolean; latencyMs: number | null }>
  /** Provider-owned token estimate (estimate route) — never pricing logic. */
  estimateUsage: (request: ProviderChatRequest) => TokenUsage
}

let instance: ApiServices | null = null

export function createApiServices(): ApiServices {
  const transactionManager = new PrismaTransactionManager()
  const eventDispatcher = new LocalEventDispatcher()

  const walletRepository = new PrismaWalletRepository()
  const transactionRepository = new PrismaTransactionRepository()
  const topupRepository = new PrismaTopupRequestRepository()
  const idempotencyRepository = new PrismaIdempotencyKeyRepository()
  const webhookEventRepository = new PrismaWebhookEventRepository()

  const walletService = new WalletService(
    walletRepository,
    transactionRepository,
    transactionManager,
    eventDispatcher
  )

  const transactionService = new TransactionService(transactionRepository)

  const paymentService = new PaymentService(getPaymentProvider())

  const topupService = new TopupService(
    topupRepository,
    walletService,
    paymentService,
    transactionManager
  )

  const idempotencyService = new IdempotencyService(idempotencyRepository)

  const webhookService = new WebhookService(
    paymentService,
    walletService,
    topupService,
    webhookEventRepository,
    transactionManager,
    eventDispatcher
  )

  // ─── Billing Milestone 8 — AI Gateway stack ───────────────────────────
  const pricingRepository = new PrismaPricingRepository()
  const usageRepository = new PrismaUsageRepository()
  const refundRepository = new PrismaRefundRepository()
  const modelRepository = new PrismaModelRepository()
  const apiKeyRepository = new PrismaApiKeyRepository()

  const pricingEngine = new PricingEngine()
  const usageMeter = createUsageMeter()

  const estimateService = new EstimateService(pricingRepository, walletService, pricingEngine)
  const chargeService = new ChargeService(
    pricingRepository,
    usageRepository,
    walletService,
    idempotencyService,
    transactionManager,
    pricingEngine,
    eventDispatcher,
    usageMeter
  )
  const refundService = new RefundService(
    refundRepository,
    usageRepository,
    walletService,
    idempotencyService,
    transactionManager,
    eventDispatcher
  )

  const provider = new DeepSeekProvider({
    usageMeter,
    transport: new FetchProviderTransport({
      baseUrl: env.deepinfraBaseUrl,
      apiKey: env.deepinfraApiKey,
    }),
  })

  const aiGateway = new AIGateway(estimateService, provider, usageMeter, chargeService)
  const modelService = new ModelService(modelRepository, pricingRepository)

  return {
    walletService,
    transactionService,
    topupService,
    idempotencyService,
    paymentService,
    webhookService,
    estimateService,
    chargeService,
    refundService,
    aiGateway,
    modelService,
    apiKeyRepository,
    usageRepository,
    providerInfo: {
      id: provider.name(),
      version: provider.version(),
      capabilities: provider.capabilities(),
    },
    providerHealth: async () => provider.health(),
    estimateUsage: (request) => provider.estimateContext(request),
  }
}

/** Lazily-created singleton. */
export function getApiServices(): ApiServices {
  if (!instance) {
    instance = createApiServices()
  }
  return instance
}
