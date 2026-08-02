// ProxyAI — Admin Wallet Service (Milestone 2, hardened M5)
// Admin wallet credit/debit operations with audit trail.
//
// M5 hardening:
//  - Atomic balance mutations: the previous read-modify-write (findUnique →
//    update) allowed a lost-update race — two concurrent admin debits could
//    both pass the insufficient-balance check and overdraw the wallet.
//    Credit now uses an atomic increment; debit uses a conditional decrement
//    (balance >= amount) so the check and the write are one statement.
//  - The row lock held by the UPDATE serializes concurrent writers, so the
//    read-back inside the same transaction yields an accurate balanceAfter.
//  - Duplicate idempotency keys surface as a clean 409 (CONFLICT) via the
//    unique `reference` constraint, instead of an opaque 500.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { AdminError } from '@/lib/errors'

export class AdminWalletService {
  async creditWallet(
    walletId: string,
    amount: string,
    reason: string,
    adminId: string,
    idempotencyKey: string
  ): Promise<{ transaction_id: string; balance_after: string }> {
    const amountDecimal = new Prisma.Decimal(amount)

    return prisma.$transaction(async (tx) => {
      // Atomic increment — one statement, no lost update.
      const updated = await tx.wallet.updateMany({
        where: { id: walletId },
        data: { balance: { increment: amountDecimal }, version: { increment: 1 } },
      })
      if (updated.count === 0) {
        throw new AdminError('NOT_FOUND', 'Wallet not found.')
      }

      // Row lock from the UPDATE is held until commit → read-back is accurate.
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } })
      if (!wallet) {
        throw new AdminError('NOT_FOUND', 'Wallet not found.')
      }

      const balanceAfter = wallet.balance
      const balanceBefore = balanceAfter.minus(amountDecimal)

      const txRecord = await this.createTransaction(
        tx,
        {
          walletId,
          userId: wallet.userId,
          amount: amountDecimal,
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          type: 'ADMIN_CREDIT',
          reference: `admin_credit_${idempotencyKey}`,
          description: reason,
          createdBy: `admin:${adminId}`,
        },
        idempotencyKey
      )

      return { transaction_id: txRecord.id, balance_after: balanceAfter.toFixed(6) }
    })
  }

  async debitWallet(
    walletId: string,
    amount: string,
    reason: string,
    adminId: string,
    idempotencyKey: string
  ): Promise<{ transaction_id: string; balance_after: string }> {
    const amountDecimal = new Prisma.Decimal(amount)

    return prisma.$transaction(async (tx) => {
      // Atomic conditional decrement — check and write in one statement,
      // so concurrent debits can never drive the balance below the amount.
      const updated = await tx.wallet.updateMany({
        where: { id: walletId, balance: { gte: amountDecimal } },
        data: { balance: { decrement: amountDecimal }, version: { increment: 1 } },
      })
      if (updated.count === 0) {
        const exists = await tx.wallet.findUnique({ where: { id: walletId } })
        if (!exists) {
          throw new AdminError('NOT_FOUND', 'Wallet not found.')
        }
        throw new AdminError('CONFLICT', 'Insufficient balance.')
      }

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } })
      if (!wallet) {
        throw new AdminError('NOT_FOUND', 'Wallet not found.')
      }

      const balanceAfter = wallet.balance
      const balanceBefore = balanceAfter.plus(amountDecimal)

      const txRecord = await this.createTransaction(
        tx,
        {
          walletId,
          userId: wallet.userId,
          amount: amountDecimal.negated(),
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          type: 'ADMIN_DEBIT',
          reference: `admin_debit_${idempotencyKey}`,
          description: reason,
          createdBy: `admin:${adminId}`,
        },
        idempotencyKey
      )

      return { transaction_id: txRecord.id, balance_after: balanceAfter.toFixed(6) }
    })
  }

  private async createTransaction(
    tx: Prisma.TransactionClient,
    data: {
      walletId: string
      userId: string
      amount: Prisma.Decimal
      balanceBefore: Prisma.Decimal
      balanceAfter: Prisma.Decimal
      currency: string
      type: 'ADMIN_CREDIT' | 'ADMIN_DEBIT'
      reference: string
      description: string
      createdBy: string
    },
    idempotencyKey: string
  ) {
    try {
      return await tx.transaction.create({
        data: {
          walletId: data.walletId,
          userId: data.userId,
          amount: data.amount,
          balanceBefore: data.balanceBefore,
          balanceAfter: data.balanceAfter,
          currency: data.currency as never,
          type: data.type,
          reference: data.reference,
          status: 'COMPLETED',
          description: data.description,
          createdBy: data.createdBy,
        },
      })
    } catch (error) {
      // Duplicate idempotency key → unique reference constraint.
      if ((error as { code?: string }).code === 'P2002') {
        throw new AdminError(
          'CONFLICT',
          `Idempotency key "${idempotencyKey}" has already been used.`
        )
      }
      throw error
    }
  }
}
