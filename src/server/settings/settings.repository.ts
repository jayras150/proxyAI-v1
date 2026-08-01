// ProxyAI — Settings Repository Interface (Milestone 6)
// User-specific application settings stored in AiConfiguration or in-memory.
// V1: Uses Prisma AiConfiguration with user-specific keys.

import { prisma } from '@/lib/prisma'

export interface UserSettings {
  defaultModel: string | null
  defaultTemperature: number | null
  defaultMaxTokens: number | null
  timezone: string | null
  language: string | null
}

const DEFAULT_SETTINGS: UserSettings = {
  defaultModel: null,
  defaultTemperature: null,
  defaultMaxTokens: null,
  timezone: null,
  language: null,
}

function settingsKey(userId: string): string {
  return `user:settings:${userId}`
}

export class PrismaSettingsRepository {
  async getSettings(userId: string): Promise<UserSettings> {
    const config = await prisma.aiConfiguration.findUnique({
      where: { key: settingsKey(userId) },
    })
    if (!config) return { ...DEFAULT_SETTINGS }
    const data = config.value as Record<string, unknown>
    return {
      defaultModel: typeof data.defaultModel === 'string' ? data.defaultModel : null,
      defaultTemperature: typeof data.defaultTemperature === 'number' ? data.defaultTemperature : null,
      defaultMaxTokens: typeof data.defaultMaxTokens === 'number' ? data.defaultMaxTokens : null,
      timezone: typeof data.timezone === 'string' ? data.timezone : null,
      language: typeof data.language === 'string' ? data.language : null,
    }
  }

  async updateSettings(userId: string, partial: Partial<UserSettings>): Promise<UserSettings> {
    const key = settingsKey(userId)
    const existing = await this.getSettings(userId)
    const merged = { ...existing, ...partial }

    await prisma.aiConfiguration.upsert({
      where: { key },
      create: { key, value: merged },
      update: { value: merged },
    })

    return merged
  }
}
