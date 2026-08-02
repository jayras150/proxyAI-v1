// ProxyAI — Admin System Configuration Service (Milestone 3)
// Manages system-wide configuration via AiConfiguration table.

import { prisma } from '@/lib/prisma'
import { AdminError } from '@/lib/errors'
import type { Prisma } from '@prisma/client'

export interface SystemConfig {
  default_provider: string | null
  default_model: string | null
  maintenance_mode: boolean
  registration_open: boolean
  allow_new_api_keys: boolean
  wallet_negative_balance_policy: string
  maximum_negative_balance: string
  rate_limits: Record<string, number>
  streaming_enabled: boolean
  refund_enabled: boolean
  feature_flags: Record<string, boolean>
}

const SYSTEM_KEYS = {
  DEFAULT_PROVIDER: 'system.default_provider',
  DEFAULT_MODEL: 'system.default_model',
  MAINTENANCE_MODE: 'system.maintenance_mode',
  REGISTRATION_OPEN: 'system.registration_open',
  ALLOW_NEW_API_KEYS: 'system.allow_new_api_keys',
  WALLET_NEGATIVE_BALANCE_POLICY: 'system.wallet_negative_balance_policy',
  MAXIMUM_NEGATIVE_BALANCE: 'system.maximum_negative_balance',
  RATE_LIMITS_AI_CHAT: 'system.rate_limits.ai_chat',
  RATE_LIMITS_AI_ESTIMATE: 'system.rate_limits.ai_estimate',
  RATE_LIMITS_AI_REFUND: 'system.rate_limits.ai_refund',
  RATE_LIMITS_WALLET_TOPUP: 'system.rate_limits.wallet_topup',
  STREAMING_ENABLED: 'system.streaming_enabled',
  REFUND_ENABLED: 'system.refund_enabled',
} as const

const FEATURE_FLAG_PREFIX = 'feature.'

export class AdminSystemService {
  /**
   * Get all system configuration.
   */
  async getConfig(): Promise<SystemConfig> {
    const allConfigs = await prisma.aiConfiguration.findMany({
      where: {
        OR: [
          { key: { startsWith: 'system.' } },
          { key: { startsWith: 'feature.' } },
        ],
      },
    })

    const configMap = new Map(allConfigs.map((c) => [c.key, c.value]))

    return {
      default_provider: (configMap.get(SYSTEM_KEYS.DEFAULT_PROVIDER) as string | null) ?? null,
      default_model: (configMap.get(SYSTEM_KEYS.DEFAULT_MODEL) as string | null) ?? null,
      maintenance_mode: Boolean(configMap.get(SYSTEM_KEYS.MAINTENANCE_MODE)) ?? false,
      registration_open: Boolean(configMap.get(SYSTEM_KEYS.REGISTRATION_OPEN)) ?? true,
      allow_new_api_keys: Boolean(configMap.get(SYSTEM_KEYS.ALLOW_NEW_API_KEYS)) ?? true,
      wallet_negative_balance_policy: (configMap.get(SYSTEM_KEYS.WALLET_NEGATIVE_BALANCE_POLICY) as string) ?? 'controlled',
      maximum_negative_balance: (configMap.get(SYSTEM_KEYS.MAXIMUM_NEGATIVE_BALANCE) as string) ?? '0.10',
      rate_limits: {
        ai_chat: Number(configMap.get(SYSTEM_KEYS.RATE_LIMITS_AI_CHAT)) ?? 60,
        ai_estimate: Number(configMap.get(SYSTEM_KEYS.RATE_LIMITS_AI_ESTIMATE)) ?? 120,
        ai_refund: Number(configMap.get(SYSTEM_KEYS.RATE_LIMITS_AI_REFUND)) ?? 30,
        wallet_topup: Number(configMap.get(SYSTEM_KEYS.RATE_LIMITS_WALLET_TOPUP)) ?? 60,
      },
      streaming_enabled: Boolean(configMap.get(SYSTEM_KEYS.STREAMING_ENABLED)) ?? true,
      refund_enabled: Boolean(configMap.get(SYSTEM_KEYS.REFUND_ENABLED)) ?? true,
      feature_flags: this._extractFeatureFlags(allConfigs),
    }
  }

  /**
   * Save system configuration (partial update).
   */
  async saveConfig(updates: Partial<SystemConfig>, adminId: string): Promise<void> {
    const operations: { key: string; value: unknown }[] = []

    if (updates.default_provider !== undefined) {
      operations.push({ key: SYSTEM_KEYS.DEFAULT_PROVIDER, value: updates.default_provider })
    }
    if (updates.default_model !== undefined) {
      operations.push({ key: SYSTEM_KEYS.DEFAULT_MODEL, value: updates.default_model })
    }
    if (updates.maintenance_mode !== undefined) {
      operations.push({ key: SYSTEM_KEYS.MAINTENANCE_MODE, value: updates.maintenance_mode })
    }
    if (updates.registration_open !== undefined) {
      operations.push({ key: SYSTEM_KEYS.REGISTRATION_OPEN, value: updates.registration_open })
    }
    if (updates.allow_new_api_keys !== undefined) {
      operations.push({ key: SYSTEM_KEYS.ALLOW_NEW_API_KEYS, value: updates.allow_new_api_keys })
    }
    if (updates.wallet_negative_balance_policy !== undefined) {
      operations.push({ key: SYSTEM_KEYS.WALLET_NEGATIVE_BALANCE_POLICY, value: updates.wallet_negative_balance_policy })
    }
    if (updates.maximum_negative_balance !== undefined) {
      operations.push({ key: SYSTEM_KEYS.MAXIMUM_NEGATIVE_BALANCE, value: updates.maximum_negative_balance })
    }
    if (updates.streaming_enabled !== undefined) {
      operations.push({ key: SYSTEM_KEYS.STREAMING_ENABLED, value: updates.streaming_enabled })
    }
    if (updates.refund_enabled !== undefined) {
      operations.push({ key: SYSTEM_KEYS.REFUND_ENABLED, value: updates.refund_enabled })
    }

    // Rate limits
    if (updates.rate_limits) {
      if (updates.rate_limits.ai_chat !== undefined) {
        operations.push({ key: SYSTEM_KEYS.RATE_LIMITS_AI_CHAT, value: updates.rate_limits.ai_chat })
      }
      if (updates.rate_limits.ai_estimate !== undefined) {
        operations.push({ key: SYSTEM_KEYS.RATE_LIMITS_AI_ESTIMATE, value: updates.rate_limits.ai_estimate })
      }
      if (updates.rate_limits.ai_refund !== undefined) {
        operations.push({ key: SYSTEM_KEYS.RATE_LIMITS_AI_REFUND, value: updates.rate_limits.ai_refund })
      }
      if (updates.rate_limits.wallet_topup !== undefined) {
        operations.push({ key: SYSTEM_KEYS.RATE_LIMITS_WALLET_TOPUP, value: updates.rate_limits.wallet_topup })
      }
    }

    // Upsert all in parallel
    await Promise.all(
      operations.map((op) =>
        prisma.aiConfiguration.upsert({
          where: { key: op.key },
          update: { value: op.value as Prisma.InputJsonValue },
          create: { key: op.key, value: op.value as Prisma.InputJsonValue },
        })
      )
    )
  }

  /**
   * Reset system configuration to defaults.
   */
  async resetConfig(adminId: string): Promise<void> {
    await prisma.aiConfiguration.deleteMany({
      where: { key: { startsWith: 'system.' } },
    })

    // Re-insert defaults
    await this.saveConfig({
      default_provider: null,
      default_model: null,
      maintenance_mode: false,
      registration_open: true,
      allow_new_api_keys: true,
      wallet_negative_balance_policy: 'controlled',
      maximum_negative_balance: '0.10',
      streaming_enabled: true,
      refund_enabled: true,
    }, adminId)
  }

  /**
   * Get all feature flags.
   */
  async getFeatureFlags(): Promise<Record<string, { enabled: boolean; description: string }>> {
    const flags = await prisma.aiConfiguration.findMany({
      where: { key: { startsWith: FEATURE_FLAG_PREFIX } },
    })

    const result: Record<string, { enabled: boolean; description: string }> = {}
    for (const f of flags) {
      const name = f.key.slice(FEATURE_FLAG_PREFIX.length)
      const val = f.value as { enabled?: boolean; description?: string } | boolean
      result[name] = {
        enabled: typeof val === 'boolean' ? val : Boolean(val?.enabled ?? false),
        description: typeof val === 'object' && !Array.isArray(val) ? (val.description ?? '') : '',
      }
    }

    // Always return known flags even if not in DB
    const knownFlags = this._getKnownFlags()
    for (const [name, meta] of Object.entries(knownFlags)) {
      if (!result[name]) {
        result[name] = { enabled: meta.defaultEnabled, description: meta.description }
      }
    }

    return result
  }

  /**
   * Toggle a feature flag.
   */
  async toggleFeatureFlag(name: string, enabled: boolean, adminId: string): Promise<void> {
    const key = `${FEATURE_FLAG_PREFIX}${name}`

    const existing = await prisma.aiConfiguration.findUnique({ where: { key } })
    const currentValue = existing?.value as { enabled?: boolean; description?: string } | boolean | undefined

    let newValue: Prisma.JsonValue
    if (currentValue !== undefined && currentValue !== null && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
      newValue = { ...currentValue, enabled }
    } else {
      newValue = { enabled, description: '' }
    }

    await prisma.aiConfiguration.upsert({
      where: { key },
      update: { value: newValue },
      create: { key, value: newValue },
    })
  }

  private _extractFeatureFlags(
    configs: { key: string; value: Prisma.JsonValue }[]
  ): Record<string, boolean> {
    const flags: Record<string, boolean> = {}
    for (const c of configs) {
      if (c.key.startsWith(FEATURE_FLAG_PREFIX)) {
        const name = c.key.slice(FEATURE_FLAG_PREFIX.length)
        const val = c.value as { enabled?: boolean } | boolean
        flags[name] = typeof val === 'boolean' ? val : Boolean(val?.enabled ?? false)
      }
    }
    return flags
  }

  private _getKnownFlags(): Record<string, { defaultEnabled: boolean; description: string }> {
    return {
      'streaming': { defaultEnabled: true, description: 'Enable streaming responses for chat completions' },
      'reasoning': { defaultEnabled: true, description: 'Enable reasoning mode for supported models' },
      'vision': { defaultEnabled: false, description: 'Enable vision/image input for supported models' },
      'json_mode': { defaultEnabled: true, description: 'Enable JSON mode for structured output' },
      'tool_calling': { defaultEnabled: false, description: 'Enable tool calling / function calling' },
      'embeddings': { defaultEnabled: false, description: 'Enable embeddings endpoint' },
      'image_generation': { defaultEnabled: false, description: 'Enable image generation endpoint' },
      'refunds': { defaultEnabled: true, description: 'Enable user refund requests' },
      'wallet_topup': { defaultEnabled: true, description: 'Enable wallet top-up' },
      'registration': { defaultEnabled: true, description: 'Enable new user registration' },
    }
  }
}
