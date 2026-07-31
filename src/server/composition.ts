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

export interface ApiServices {
  walletService: WalletService
  transactionService: TransactionService
  topupService: TopupService
  idempotencyService: IdempotencyService
  paymentService: PaymentService
  webhookService: WebhookService
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

  return {
    walletService,
    transactionService,
    topupService,
    idempotencyService,
    paymentService,
    webhookService,
  }
}

/** Lazily-created singleton. */
export function getApiServices(): ApiServices {
  if (!instance) {
    instance = createApiServices()
  }
  return instance
}
