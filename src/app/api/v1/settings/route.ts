// ProxyAI — GET /api/v1/settings, PUT /api/v1/settings
// Milestone 6: User settings (default model, temperature, max tokens, timezone).

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-request'
import { jsonSuccess, jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { PrismaSettingsRepository } from '@/server/settings/settings.repository'
import { z } from 'zod'

const settingsRepository = new PrismaSettingsRepository()

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthenticatedUser(request)
    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRead,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

    const settings = await settingsRepository.getSettings(payload.sub)
    return jsonSuccess(settings, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}

const updateSettingsSchema = z.object({
  default_model: z.string().nullable().optional(),
  default_temperature: z.number().min(0).max(2).nullable().optional(),
  default_max_tokens: z.number().int().positive().nullable().optional(),
  timezone: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const payload = getAuthenticatedUser(request)
    const rate = await enforceRateLimit(request, {
      ...RATE_LIMITS.aiRead,
      identity: payload.sub,
    })
    if (rate.limited) return rate.response

    const body = await request.json()
    const parsed = updateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return jsonError('VALIDATION_ERROR', firstError.message, {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const mapped: Record<string, unknown> = {}
    if (parsed.data.default_model !== undefined) mapped.defaultModel = parsed.data.default_model
    if (parsed.data.default_temperature !== undefined) mapped.defaultTemperature = parsed.data.default_temperature
    if (parsed.data.default_max_tokens !== undefined) mapped.defaultMaxTokens = parsed.data.default_max_tokens
    if (parsed.data.timezone !== undefined) mapped.timezone = parsed.data.timezone
    if (parsed.data.language !== undefined) mapped.language = parsed.data.language

    const settings = await settingsRepository.updateSettings(payload.sub, mapped)
    return jsonSuccess(settings, { headers: rateLimitHeaders(rate.result) })
  } catch (error) {
    return mapApiError(error)
  }
}
