// ProxyAI — TransactionService
// Blueprint Reference: Sprint 9 §64 — Wallet APIs (transaction history)
// Milestone 2: read-side service (cursor pagination). Writes go through
// WalletService (credit/debit) so every balance change stays atomic.

import type { TransactionRepository, TransactionCursor } from './transaction.repository'
import type { Transaction, TransactionType, TransactionStatus } from '@prisma/client'

export interface TransactionHistoryPage {
  items: Transaction[]
  nextCursor: string | null // opaque cursor for the API layer
  hasMore: boolean
}

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  /**
   * Cursor-paginated history of a wallet, ordered (createdAt DESC, id DESC).
   * Returns an opaque next_cursor; null when there are no more pages.
   */
  async getWalletHistory(
    walletId: string,
    cursor: string | null,
    limit: number = DEFAULT_LIMIT,
    filters?: {
      type?: TransactionType
      status?: TransactionStatus
      dateFrom?: Date
      dateTo?: Date
      search?: string
    }
  ): Promise<TransactionHistoryPage> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT)
    const decoded = cursor ? this.decodeCursor(cursor) : null

    const page = await this.transactionRepository.findByWalletIdPaginated(
      walletId,
      decoded,
      safeLimit,
      filters
    )

    return {
      items: page.items,
      nextCursor: page.hasMore && page.nextCursor ? this.encodeCursor(page.nextCursor) : null,
      hasMore: page.hasMore,
    }
  }

  /** Encode a keyset cursor into an opaque, URL-safe string. */
  encodeCursor(cursor: TransactionCursor): string {
    const raw = JSON.stringify({
      c: cursor.createdAt.toISOString(),
      i: cursor.id,
    })
    return Buffer.from(raw, 'utf8').toString('base64url')
  }

  /** Decode an opaque cursor. Returns null when malformed. */
  decodeCursor(encoded: string): TransactionCursor | null {
    try {
      const raw = Buffer.from(encoded, 'base64url').toString('utf8')
      const parsed = JSON.parse(raw) as { c?: string; i?: string }
      if (!parsed.c || !parsed.i) return null
      const createdAt = new Date(parsed.c)
      if (Number.isNaN(createdAt.getTime())) return null
      return { createdAt, id: parsed.i }
    } catch {
      return null
    }
  }
}
