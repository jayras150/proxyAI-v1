// ProxyAI — Transaction Manager (Unit of Work)
// Blueprint Reference: Design Review Wallet §6 — Repository Layer
// Route → Service → Repository → Prisma.
// Services orchestrate DB transactions through this abstraction so they
// never touch Prisma directly.

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export type TxClient = Prisma.TransactionClient

export interface TransactionManager {
  /** Run fn inside a single database transaction (commit on success, rollback on throw). */
  withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T>
}

export class PrismaTransactionManager implements TransactionManager {
  withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn)
  }
}
