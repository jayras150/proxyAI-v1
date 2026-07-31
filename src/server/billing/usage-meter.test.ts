// ProxyAI — UsageMeter Unit Tests
// Billing Milestone 4 — Usage Meter
//
// Pure component tests: no database, no repository, no provider SDK.

import { describe, it, expect } from 'vitest'
import {
  UsageMeter,
  createUsageMeter,
  UsageMeterError,
  UsageParseError,
  MalformedUsage,
  InvalidUsage,
  UnsupportedProvider,
  DeepSeekUsageAdapter,
  OpenAICompatibleUsageAdapter,
  type UsageAdapter,
  type ProviderUsageExtract,
} from './usage-meter'
import { TokenUsage } from './token-usage'

const deepSeekRaw = {
  prompt_tokens: 66,
  completion_tokens: 100,
  total_tokens: 166,
  // legacy DeepSeek cache fields + OpenAI-style details + provider metadata
  prompt_cache_hit_tokens: 15,
  prompt_cache_miss_tokens: 51,
  prompt_tokens_details: { cached_tokens: 15 },
  completion_tokens_details: { reasoning_tokens: 20 },
  model: 'deepseek-chat',
  provider: 'deepseek',
}

const openAiRaw = {
  prompt_tokens: 9,
  completion_tokens: 12,
  total_tokens: 21,
  prompt_tokens_details: { cached_tokens: 0 },
  completion_tokens_details: { reasoning_tokens: 0 },
}

describe('UsageMeter — DeepSeek usage', () => {
  const meter = createUsageMeter()

  it('parses a full DeepSeek payload (cache hit + reasoning + metadata)', () => {
    const usage = meter.parse('deepseek', deepSeekRaw)
    expect(usage).toBeInstanceOf(TokenUsage)
    // cached tokens decomposed out of prompt: 66 - 15 = 51
    expect(usage.promptTokens).toBe(51)
    expect(usage.completionTokens).toBe(100)
    expect(usage.cachedTokens).toBe(15)
    expect(usage.totalTokens).toBe(166) // matches provider total_tokens
  })

  it('falls back to legacy prompt_cache_hit_tokens when details are absent', () => {
    const legacy = {
      prompt_tokens: deepSeekRaw.prompt_tokens,
      completion_tokens: deepSeekRaw.completion_tokens,
      total_tokens: deepSeekRaw.total_tokens,
      prompt_cache_hit_tokens: deepSeekRaw.prompt_cache_hit_tokens,
      prompt_cache_miss_tokens: deepSeekRaw.prompt_cache_miss_tokens,
      completion_tokens_details: deepSeekRaw.completion_tokens_details,
      model: deepSeekRaw.model,
      provider: deepSeekRaw.provider,
    }
    const usage = meter.parse('deepseek', legacy)
    expect(usage.promptTokens).toBe(51)
    expect(usage.cachedTokens).toBe(15)
    expect(usage.totalTokens).toBe(166)
  })

  it('reports reasoning tokens via parseDetailed', () => {
    const parsed = meter.parseDetailed('deepseek', deepSeekRaw)
    expect(parsed.reasoningTokens).toBe(20)
    expect(parsed.usage.completionTokens).toBe(100)
  })
})

describe('UsageMeter — OpenAI usage', () => {
  const meter = createUsageMeter()

  it('parses a standard OpenAI payload', () => {
    const usage = meter.parse('openai', openAiRaw)
    expect(usage.promptTokens).toBe(9)
    expect(usage.completionTokens).toBe(12)
    expect(usage.cachedTokens).toBe(0)
    expect(usage.totalTokens).toBe(21)
  })

  it('accepts provider id aliases (openai-compatible)', () => {
    const usage = meter.parse('OpenAI-Compatible', openAiRaw)
    expect(usage.totalTokens).toBe(21)
  })

  it('accepts a JSON string payload', () => {
    const usage = meter.parse('openai', JSON.stringify(openAiRaw))
    expect(usage.totalTokens).toBe(21)
  })
})

describe('UsageMeter — cached tokens', () => {
  const meter = createUsageMeter()

  it('keeps cached tokens as a separate bucket and keeps total consistent', () => {
    const usage = meter.parse('openai', {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 30 },
    })
    expect(usage.promptTokens).toBe(70)
    expect(usage.cachedTokens).toBe(30)
    expect(usage.completionTokens).toBe(50)
    expect(usage.totalTokens).toBe(150)
  })

  it('treats a null cached_tokens as absent (zero)', () => {
    const usage = meter.parse('openai', {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
      prompt_tokens_details: { cached_tokens: null },
    })
    expect(usage.cachedTokens).toBe(0)
    expect(usage.totalTokens).toBe(30)
  })

  it('rejects cached tokens exceeding prompt tokens', () => {
    expect(() =>
      meter.parse('openai', {
        prompt_tokens: 10,
        completion_tokens: 5,
        prompt_tokens_details: { cached_tokens: 20 },
      })
    ).toThrow(InvalidUsage)
  })
})

describe('UsageMeter — without cached tokens', () => {
  const meter = createUsageMeter()

  it('defaults cachedTokens to zero and total to prompt + completion', () => {
    const usage = meter.parse('openai', {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    })
    expect(usage.cachedTokens).toBe(0)
    expect(usage.totalTokens).toBe(30)
  })

  it('tolerates a missing total_tokens (computes its own)', () => {
    const usage = meter.parse('deepseek', { prompt_tokens: 4, completion_tokens: 6 })
    expect(usage.totalTokens).toBe(10)
    expect(usage.cachedTokens).toBe(0)
  })
})

describe('UsageMeter — malformed usage', () => {
  const meter = createUsageMeter()

  it('rejects null payloads', () => {
    expect(() => meter.parse('deepseek', null)).toThrow(MalformedUsage)
  })

  it('rejects non-object payloads', () => {
    expect(() => meter.parse('deepseek', [1, 2, 3])).toThrow(MalformedUsage)
    // strings are treated as JSON payloads
    expect(() => meter.parse('deepseek', 'just a string')).toThrow(UsageParseError)
    expect(() => meter.parse('deepseek', 42)).toThrow(MalformedUsage)
  })

  it('rejects missing required fields', () => {
    expect(() => meter.parse('deepseek', { completion_tokens: 5 })).toThrow(MalformedUsage)
    expect(() => meter.parse('deepseek', { prompt_tokens: 5 })).toThrow(MalformedUsage)
  })

  it('rejects null required fields', () => {
    expect(() =>
      meter.parse('deepseek', { prompt_tokens: null, completion_tokens: 5 })
    ).toThrow(MalformedUsage)
  })

  it('rejects wrongly-typed fields', () => {
    expect(() =>
      meter.parse('deepseek', { prompt_tokens: '10', completion_tokens: 5 })
    ).toThrow(MalformedUsage)
    expect(() =>
      meter.parse('openai', {
        prompt_tokens: 10,
        completion_tokens: 5,
        prompt_tokens_details: { cached_tokens: '3' },
      })
    ).toThrow(MalformedUsage)
    expect(() =>
      meter.parse('openai', {
        prompt_tokens: 10,
        completion_tokens: 5,
        prompt_tokens_details: [1, 2],
      })
    ).toThrow(MalformedUsage)
  })
})

describe('UsageMeter — unsupported provider', () => {
  it('throws UnsupportedProvider for unknown providers', () => {
    const meter = createUsageMeter()
    expect(() => meter.parse('anthropic', { prompt_tokens: 1, completion_tokens: 1 })).toThrow(
      UnsupportedProvider
    )
  })

  it('throws UnsupportedProvider for undefined provider', () => {
    const meter = createUsageMeter()
    expect(() => meter.parse(undefined as unknown as string, {})).toThrow(UnsupportedProvider)
  })

  it('a meter with only a custom adapter does not know built-ins', () => {
    const meter = new UsageMeter()
    expect(() => meter.parse('deepseek', deepSeekRaw)).toThrow(UnsupportedProvider)
  })
})

describe('UsageMeter — negative / invalid tokens', () => {
  const meter = createUsageMeter()

  it('rejects negative prompt tokens', () => {
    expect(() =>
      meter.parse('deepseek', { prompt_tokens: -1, completion_tokens: 5 })
    ).toThrow(InvalidUsage)
  })

  it('rejects negative completion tokens', () => {
    expect(() =>
      meter.parse('deepseek', { prompt_tokens: 1, completion_tokens: -5 })
    ).toThrow(InvalidUsage)
  })

  it('rejects negative cached tokens', () => {
    expect(() =>
      meter.parse('openai', {
        prompt_tokens: 10,
        completion_tokens: 5,
        prompt_tokens_details: { cached_tokens: -2 },
      })
    ).toThrow(InvalidUsage)
  })

  it('rejects fractional token counts', () => {
    expect(() =>
      meter.parse('deepseek', { prompt_tokens: 1.5, completion_tokens: 5 })
    ).toThrow(InvalidUsage)
  })

  it('rejects NaN and Infinity', () => {
    expect(() =>
      meter.parse('deepseek', { prompt_tokens: NaN, completion_tokens: 5 })
    ).toThrow(InvalidUsage)
    expect(() =>
      meter.parse('deepseek', { prompt_tokens: Infinity, completion_tokens: 5 })
    ).toThrow(InvalidUsage)
  })

  it('rejects tokens beyond the safe integer range (overflow)', () => {
    expect(() =>
      meter.parse('deepseek', {
        prompt_tokens: Number.MAX_SAFE_INTEGER + 1,
        completion_tokens: 5,
      })
    ).toThrow(InvalidUsage)
  })

  it('rejects a combined total that overflows the safe integer range', () => {
    expect(() =>
      meter.parse('deepseek', {
        prompt_tokens: 9_000_000_000_000_000,
        completion_tokens: 9_000_000_000_000_000,
      })
    ).toThrow(InvalidUsage)
  })

  it('rejects reasoning tokens exceeding completion tokens', () => {
    expect(() =>
      meter.parse('openai', {
        prompt_tokens: 10,
        completion_tokens: 12,
        completion_tokens_details: { reasoning_tokens: 13 },
      })
    ).toThrow(InvalidUsage)
  })
})

describe('UsageMeter — total mismatch', () => {
  const meter = createUsageMeter()

  it('rejects total_tokens != prompt + completion', () => {
    expect(() =>
      meter.parse('deepseek', { prompt_tokens: 10, completion_tokens: 20, total_tokens: 25 })
    ).toThrow(InvalidUsage)
  })

  it('rejects mismatch when cached tokens are present', () => {
    expect(() =>
      meter.parse('openai', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 100, // should be 150 (cached included in prompt)
        prompt_tokens_details: { cached_tokens: 30 },
      })
    ).toThrow(InvalidUsage)
  })

  it('treats a null total_tokens as absent (no mismatch)', () => {
    const usage = meter.parse('deepseek', {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: null,
    })
    expect(usage.totalTokens).toBe(30)
  })
})

describe('UsageMeter — deterministic', () => {
  it('returns identical results for identical inputs', () => {
    const meter = createUsageMeter()
    const a = meter.parse('deepseek', deepSeekRaw)
    const b = meter.parse('deepseek', deepSeekRaw)
    expect(a).toEqual(b)
    expect(a.totalTokens).toBe(b.totalTokens)
  })

  it('does not mutate the input payload', () => {
    const meter = createUsageMeter()
    const frozen = Object.freeze(JSON.parse(JSON.stringify(deepSeekRaw)))
    expect(() => meter.parse('deepseek', frozen)).not.toThrow()
  })

  it('produces identical results across separate meter instances', () => {
    const usageA = createUsageMeter().parse('openai', openAiRaw)
    const usageB = createUsageMeter().parse('openai', openAiRaw)
    expect(usageA).toEqual(usageB)
  })
})

describe('UsageMeter — parse errors', () => {
  const meter = createUsageMeter()

  it('throws UsageParseError for invalid JSON strings', () => {
    expect(() => meter.parse('openai', '{not valid json')).toThrow(UsageParseError)
  })

  it('UsageParseError carries a machine-readable code', () => {
    try {
      meter.parse('openai', '{not valid json')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(UsageMeterError)
      expect((err as UsageMeterError).code).toBe('USAGE_PARSE_ERROR')
    }
  })

  it('every error type exposes its code', () => {
    const cases: Array<() => unknown> = [
      () => meter.parse('deepseek', null), // MalformedUsage
      () => meter.parse('deepseek', { prompt_tokens: -1, completion_tokens: 1 }), // InvalidUsage
      () => meter.parse('bogus', {}), // UnsupportedProvider
      () => meter.parse('openai', '{bad'), // UsageParseError
    ]
    const codes = cases.map((fn) => {
      try {
        fn()
      } catch (err) {
        return (err as UsageMeterError).code
      }
      return 'no-error'
    })
    expect(codes).toEqual([
      'MALFORMED_USAGE',
      'INVALID_USAGE',
      'UNSUPPORTED_PROVIDER',
      'USAGE_PARSE_ERROR',
    ])
  })
})

describe('UsageMeter — provider abstraction', () => {
  it('adds a new provider via adapter without touching the core', () => {
    // Simulated Anthropic-style payload mapped by an external adapter.
    class AnthropicAdapter implements UsageAdapter {
      readonly providerIds = ['anthropic'] as const

      extract(raw: unknown): ProviderUsageExtract {
        const usage = raw as Record<string, unknown>
        const cacheRead = (usage.cache_read_input_tokens as number) ?? 0
        const cacheWrite = (usage.cache_creation_input_tokens as number) ?? 0
        return {
          promptTokens: usage.input_tokens as number,
          completionTokens: usage.output_tokens as number,
          cachedTokens: cacheRead + cacheWrite,
        }
      }
    }

    const meter = new UsageMeter([new DeepSeekUsageAdapter()])
      .register(new AnthropicAdapter())
      .register(new OpenAICompatibleUsageAdapter())

    const usage = meter.parse('anthropic', {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 20,
      cache_creation_input_tokens: 0,
    })
    expect(usage.promptTokens).toBe(80)
    expect(usage.cachedTokens).toBe(20)
    expect(usage.completionTokens).toBe(50)
    expect(usage.totalTokens).toBe(150)
  })

  it('register is chainable and rejects invalid/duplicate adapters', () => {
    const meter = createUsageMeter()
    expect(() => meter.register({ providerIds: [] } as unknown as UsageAdapter)).toThrow(
      UsageMeterError
    )
    expect(() =>
      meter.register({ providerIds: ['deepseek'] } as unknown as UsageAdapter)
    ).toThrow(UsageMeterError)
    expect(() => meter.register({ providerIds: ['x'], extract: 1 } as unknown as UsageAdapter)).toThrow(
      UsageMeterError
    )
  })

  it('built-in adapters export their provider ids', () => {
    expect(new DeepSeekUsageAdapter().providerIds).toEqual(['deepseek'])
    expect(new OpenAICompatibleUsageAdapter().providerIds.length).toBeGreaterThan(0)
  })
})
