// ProxyAI — AI API Validation Schemas
// Billing Milestone 8 — REST API Layer
// Zod schemas for the v1 AI endpoints. The API layer validates; the
// gateway re-validates — defense in depth, no business logic here.

import { z } from 'zod'

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

export const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.literal(false).optional().default(false),
  idempotency_key: z.string().min(1).optional(),
})

export const estimateSchema = z.object({
  model: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1),
  max_tokens: z.number().int().positive().optional(),
})

export const refundSchema = z.object({
  usage_log_id: z.string().min(1),
  reason: z.string().max(500).optional(),
  idempotency_key: z.string().min(1),
  /** Admin-only: refund another user's usage log. */
  user_id: z.string().min(1).optional(),
})

export const usageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export type ChatCompletionInput = z.infer<typeof chatCompletionSchema>
export type EstimateInput = z.infer<typeof estimateSchema>
export type RefundInput = z.infer<typeof refundSchema>
export type UsageQueryInput = z.infer<typeof usageQuerySchema>
