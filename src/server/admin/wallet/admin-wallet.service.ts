// ProxyAI — Admin Wallet Service (Milestone 2)
// Admin wallet credit/debit operations with audit trail.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } })
      if (!wallet) throw new Error('Wallet not found')

      const balanceBefore = wallet.balance
      const balanceAfter = balanceBefore.plus(amountDecimal)

      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: balanceAfter, version: { increment: 1 } },
      })

      const txRecord = await tx.transaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          amount: amountDecimal,
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          type: 'ADMIN_CREDIT',
          reference: `admin_credit_${idempotencyKey}`,
          status: 'COMPLETED',
          description: reason,
          createdBy: `admin:${adminId}`,
        },
      })

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
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } })
      if (!wallet) throw new Error('Wallet not found')

      if (wallet.balance.lessThan(amountDecimal)) {
        throw new Error('Insufficient balance')
      }

      const balanceBefore = wallet.balance
      const balanceAfter = balanceBefore.minus(amountDecimal)

      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: balanceAfter, version: { increment: 1 } },
      })

      const txRecord = await tx.transaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          amount: amountDecimal.negated(),
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          type: 'ADMIN_DEBIT',
          reference: `admin_debit_${idempotencyKey}`,
          status: 'COMPLETED',
          description: reason,
          createdBy: `admin:${adminId}`,
        },
      })

      return { transaction_id: txRecord.id, balance_after: balanceAfter.toFixed(6) }
    })
  }
}
