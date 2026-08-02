// ProxyAI — Admin Providers Service (Milestone 3)
// Manages AI provider configuration via AiConfiguration.

import { prisma } from '@/lib/prisma'
import { AdminError } from '@/lib/errors'

export interface ProviderConfig {
  id: string
  name: string
  display_name: string
  enabled: boolean
  priority: number
  base_url: string
  capabilities: string[]
  models: string[]
  api_key_status: 'configured' | 'missing' | 'expired'
  timeout_ms: number
  retry_count: number
  circuit_breaker: {
    enabled: boolean
    failure_threshold: number
    recovery_timeout_ms: number
  }
  failover_priority: number
}

export class AdminProvidersService {
  /**
   * List all configured providers from AiConfiguration.
   */
  async list(): Promise<ProviderConfig[]> {
    const configs = await prisma.aiConfiguration.findMany({
      where: {
        key: { startsWith: 'provider.' },
      },
    })

    const providerMap = new Map<string, ProviderConfig>()

    for (const config of configs) {
      // Parse key like "provider.deepseek.base_url"
      const parts = config.key.split('.')
      if (parts.length < 2) continue
      const name = parts[1]
      const field = parts.slice(2).join('.')

      if (!providerMap.has(name)) {
        providerMap.set(name, {
          id: config.id,
          name,
          display_name: name.charAt(0).toUpperCase() + name.slice(1),
          enabled: true,
          priority: 0,
          base_url: '',
          capabilities: [],
          models: [],
          api_key_status: 'missing',
          timeout_ms: 30000,
          retry_count: 2,
          circuit_breaker: {
            enabled: true,
            failure_threshold: 5,
            recovery_timeout_ms: 30000,
          },
          failover_priority: 0,
        })
      }

      const provider = providerMap.get(name)!

      if (field === 'display_name') {
        provider.display_name = String(config.value)
      } else if (field === 'enabled') {
        provider.enabled = Boolean(config.value)
      } else if (field === 'priority') {
        provider.priority = Number(config.value)
      } else if (field === 'base_url') {
        provider.base_url = String(config.value)
      } else if (field === 'capabilities') {
        provider.capabilities = Array.isArray(config.value) ? config.value.map(String) : [String(config.value)]
      } else if (field === 'models') {
        provider.models = Array.isArray(config.value) ? config.value.map(String) : [String(config.value)]
      } else if (field === 'api_key_prefix') {
        provider.api_key_status = config.value ? 'configured' : 'missing'
      } else if (field === 'timeout_ms') {
        provider.timeout_ms = Number(config.value)
      } else if (field === 'retry_count') {
        provider.retry_count = Number(config.value)
      } else if (field === 'circuit_breaker.enabled') {
        provider.circuit_breaker.enabled = Boolean(config.value)
      } else if (field === 'circuit_breaker.failure_threshold') {
        provider.circuit_breaker.failure_threshold = Number(config.value)
      } else if (field === 'circuit_breaker.recovery_timeout_ms') {
        provider.circuit_breaker.recovery_timeout_ms = Number(config.value)
      } else if (field === 'failover_priority') {
        provider.failover_priority = Number(config.value)
      }
    }

    return Array.from(providerMap.values()).sort((a, b) => a.priority - b.priority)
  }

  /**
   * Get a single provider configuration.
   */
  async getProvider(name: string): Promise<ProviderConfig | null> {
    const providers = await this.list()
    return providers.find((p) => p.name === name) ?? null
  }

  /**
   * Update a provider configuration field.
   */
  async updateProvider(
    name: string,
    updates: Record<string, unknown>,
    adminId: string
  ): Promise<void> {
    for (const [field, value] of Object.entries(updates)) {
      const key = `provider.${name}.${field}`
      await prisma.aiConfiguration.upsert({
        where: { key },
        update: { value: value as never },
        create: { key, value: value as never },
      })
    }
  }

  /**
   * Enable or disable a provider.
   */
  async toggleEnabled(name: string, enabled: boolean): Promise<void> {
    const key = `provider.${name}.enabled`
    await prisma.aiConfiguration.upsert({
      where: { key },
      update: { value: enabled },
      create: { key, value: enabled },
    })
  }

  /**
   * Set provider priority.
   */
  async setPriority(name: string, priority: number): Promise<void> {
    const key = `provider.${name}.priority`
    await prisma.aiConfiguration.upsert({
      where: { key },
      update: { value: priority },
      create: { key, value: priority },
    })
  }

  /**
   * Test connection to a provider. Returns success/failure.
   */
  async testConnection(name: string): Promise<{ success: boolean; latency_ms: number; error?: string }> {
    const providerConfig = await this.getProvider(name)
    if (!providerConfig) {
      throw new AdminError('NOT_FOUND', `Provider "${name}" not configured.`)
    }

    const start = Date.now()
    try {
      const response = await fetch(`${providerConfig.base_url}/v1/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer test_connection`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      const latency = Date.now() - start
      return {
        success: response.ok,
        latency_ms: latency,
        ...(response.ok ? {} : { error: `HTTP ${response.status}: ${response.statusText}` }),
      }
    } catch (error) {
      const latency = Date.now() - start
      return {
        success: false,
        latency_ms: latency,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }
}
