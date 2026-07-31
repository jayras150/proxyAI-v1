// ProxyAI — Wallet API Validation Schemas
// Blueprint Reference: Design Review Wallet §4 — OpenAPI First
// All request bodies/query params are validated with Zod (no manual parsing).

import { z } from 'zod'

/** Money as a decimal STRING (never a JS number) — Design Review §3. */
const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, 'Amount must be a decimal string like "50.00"')

export const createTopupSchema = z.object({
  amount: moneyString,
})

export const topupQuerySchema = z.object({
  id: z.string().min(1, 'Top-up id is required'),
})

export const transactionsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export type CreateTopupInput = z.infer<typeof createTopupSchema>
export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>
