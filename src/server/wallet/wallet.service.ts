// ProxyAI — WalletService
// Blueprint Reference: Sprint 4 §19-25, Design Review Wallet §5-§8
// Business rules:
//  - All financial operations run inside a DB transaction.
//  - Balance never negative; credit & debit are atomic.
//  - Every balance change produces an immutable Transaction.
//  - Money is Decimal (never number); transaction currency == wallet currency.
//  - Domain events fire only AFTER the DB transaction commits.

import { Money } from '@/lib/money'
import { createDomainEvent } from '@/server/events/event-dispatcher'
import type { EventDispatcher } from '@/server/events/event-dispatcher'
import type { TransactionManager } from '@/server/db/transaction-manager'
import type { WalletRepository } from './wallet.repository'
import type { TransactionRepository } from '@/server/transactions/transaction.repository'
import { WalletError, WalletErrorCode } from './wallet.errors'
import type { Wallet, Transaction, TransactionType } from '@prisma/client'

export interface WalletOperationOptions {
  /** Unique immutable reference for the resulting transaction. */
  reference: string
  type: TransactionType
  description?: string
  requestId?: string
  providerReference?: string
  createdBy?: string // 'user:<id>' | 'admin:<id>' | 'system'
  ipAddress?: string
  userAgent?: string
}

export interface WalletBalance {
  wallet: Wallet
  balance: Money
}

export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly transactionManager: TransactionManager,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  /** Read the wallet of a user (no write). */
  async getWallet(userId: string): Promise<Wallet | null> {
    return this.walletRepository.findByUserId(userId)
  }

  /**
   * Atomic credit. Runs inside a DB transaction:
   *  - lock wallet row, increment balance
   *  - insert immutable Transaction
   * Emits wallet.credited AFTER commit.
   */
  async credit(userId: string, money: Money, options: WalletOperationOptions): Promise<Transaction> {
    this.assertPositive(money)

    const result = await this.transactionManager.withTransaction(async (tx) => {
      const wallet = await this.walletRepository.findByUserId(userId)
      if (!wallet) {
        throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
      }
      if (wallet.status === 'SUSPENDED') {
        throw new WalletError(WalletErrorCode.WALLET_SUSPENDED, 'Wallet is suspended.')
      }
      this.assertCurrency(wallet, money)

      // Atomic increment (row-level, inside tx).
      const updated = await this.walletRepository.credit(wallet.id, money.value, tx)

      const transaction = await this.transactionRepository.create(
        {
          walletId: updated.id,
          userId,
          amount: money.value,
          balanceBefore: updated.balance.minus(money.value),
          balanceAfter: updated.balance,
          currency: wallet.currency,
          type: options.type,
          reference: options.reference,
          description: options.description,
          requestId: options.requestId,
          providerReference: options.providerReference,
          createdBy: options.createdBy,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
        tx
      )

      return { wallet: updated, transaction }
    })

    // Emit only after commit succeeded.
    this.eventDispatcher.emit(
      createDomainEvent('wallet.credited', {
        userId,
        walletId: result.wallet.id,
        transactionId: result.transaction.id,
        requestId: options.requestId,
        providerReference: options.providerReference,
        amount: money.toString(),
        currency: money.currency,
      })
    )

    return result.transaction
  }

  /**
   * Atomic conditional debit. Runs inside a DB transaction:
   *  - decrement balance only when balance >= amount (guards overdraw)
   *  - insert immutable Transaction
   * Emits wallet.debited AFTER commit. Throws INSUFFICIENT_BALANCE on overdraw.
   */
  async debit(userId: string, money: Money, options: WalletOperationOptions): Promise<Transaction> {
    this.assertPositive(money)

    const result = await this.transactionManager.withTransaction(async (tx) => {
      const wallet = await this.walletRepository.findByUserId(userId)
      if (!wallet) {
        throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
      }
      if (wallet.status === 'SUSPENDED') {
        throw new WalletError(WalletErrorCode.WALLET_SUSPENDED, 'Wallet is suspended.')
      }
      if (wallet.status === 'LOCKED') {
        throw new WalletError(WalletErrorCode.WALLET_LOCKED, 'Wallet is locked.')
      }
      this.assertCurrency(wallet, money)

      // Atomic conditional decrement: null when balance < amount.
      const updated = await this.walletRepository.debitIfSufficient(wallet.id, money.value, tx)
      if (!updated) {
        throw new WalletError(
          WalletErrorCode.INSUFFICIENT_BALANCE,
          'Wallet balance is insufficient.'
        )
      }

      const transaction = await this.transactionRepository.create(
        {
          walletId: updated.id,
          userId,
          amount: money.value,
          balanceBefore: updated.balance.plus(money.value),
          balanceAfter: updated.balance,
          currency: wallet.currency,
          type: options.type,
          reference: options.reference,
          description: options.description,
          requestId: options.requestId,
          providerReference: options.providerReference,
          createdBy: options.createdBy,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
        tx
      )

      return { wallet: updated, transaction }
    })

    // Emit only after commit succeeded.
    this.eventDispatcher.emit(
      createDomainEvent('wallet.debited', {
        userId,
        walletId: result.wallet.id,
        transactionId: result.transaction.id,
        requestId: options.requestId,
        providerReference: options.providerReference,
        amount: money.toString(),
        currency: money.currency,
      })
    )

    return result.transaction
  }

  /**
   * Balance validation without mutation. Used by the billing gateway before
   * forwarding an AI request (Sprint 3 §13 request lifecycle).
   */
  async validateBalance(userId: string, money: Money): Promise<void> {
    const wallet = await this.walletRepository.findByUserId(userId)
    if (!wallet) {
      throw new WalletError(WalletErrorCode.WALLET_NOT_FOUND, 'Wallet not found.')
    }
    if (wallet.status === 'SUSPENDED') {
      throw new WalletError(WalletErrorCode.WALLET_SUSPENDED, 'Wallet is suspended.')
    }
    if (wallet.status === 'LOCKED') {
      throw new WalletError(WalletErrorCode.WALLET_LOCKED, 'Wallet is locked.')
    }
    this.assertCurrency(wallet, money)

    if (wallet.balance.lessThan(money.value)) {
      throw new WalletError(
        WalletErrorCode.INSUFFICIENT_BALANCE,
        'Wallet balance is insufficient.'
      )
    }
  }

  private assertPositive(money: Money): void {
    if (!money.isPositive()) {
      throw new WalletError(WalletErrorCode.INVALID_AMOUNT, 'Amount must be positive.')
    }
  }

  private assertCurrency(wallet: Wallet, money: Money): void {
    if (wallet.currency !== money.currency) {
      throw new WalletError(
        WalletErrorCode.CURRENCY_MISMATCH,
        `Currency mismatch: wallet ${wallet.currency} vs ${money.currency}.`
      )
    }
  }
}
