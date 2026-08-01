// ProxyAI — Usage Validation Schemas (Milestone 4)
// Extended query validation for usage history with filters.

import { z } from 'zod'

export const usageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  date_from: z.string().min(1).optional(),
  date_to: z.string().min(1).optional(),
})

export type UsageQuery = z.infer<typeof usageQuerySchema>
