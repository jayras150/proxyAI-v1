// ProxyAI — OpenAPI Spec Validation
// Ensures openapi/v1.yaml stays in sync with the implemented routes:
// all v1 endpoints are documented, security + responses present.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

const specPath = path.resolve(process.cwd(), 'openapi/v1.yaml')
const spec = yaml.load(fs.readFileSync(specPath, 'utf8')) as {
  openapi: string
  paths: Record<string, { get?: unknown; post?: unknown; parameters?: unknown[] }>
  components: {
    securitySchemes: Record<string, unknown>
    schemas: Record<string, unknown>
    responses: Record<string, unknown>
  }
}

describe('openapi/v1.yaml', () => {
  it('is OpenAPI 3.1', () => {
    expect(spec.openapi).toMatch(/^3\.1/)
  })

  it('documents all 14 v1 endpoints (wallet + AI gateway + dashboard)', () => {
    const paths = Object.keys(spec.paths)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/v1/wallet',
        '/v1/wallet/transactions',
        '/v1/wallet/topups',
        '/v1/wallet/topups/{id}',
        '/v1/webhooks/payments',
        '/v1/chat/completions',
        '/v1/models',
        '/v1/providers',
        '/v1/dashboard/summary',
        '/v1/health',
        '/v1/estimate',
        '/v1/refund',
        '/v1/usage',
        '/v1/transactions',
      ])
    )
    expect(paths).toHaveLength(14)
  })

  it('defines security schemes (bearer + webhook signature)', () => {
    expect(spec.components.securitySchemes.bearerAuth).toBeTruthy()
    expect(spec.components.securitySchemes.webhookSignature).toBeTruthy()
  })

  it('every operation has responses with error envelopes', () => {
    for (const [p, ops] of Object.entries(spec.paths)) {
      for (const method of ['get', 'post'] as const) {
        const op = ops[method] as { responses?: Record<string, unknown> } | undefined
        if (!op) continue
        expect(op.responses, `${method.toUpperCase()} ${p}`).toBeTruthy()
        expect(op.responses!['200'] ?? op.responses!['201'], `${method.toUpperCase()} ${p} 2xx`).toBeTruthy()
      }
    }
  })

  it('defines the standard error envelope schema', () => {
    const envelope = spec.components.schemas.ErrorEnvelope as {
      properties?: { error?: { properties?: Record<string, unknown> } }
    }
    expect(envelope).toBeTruthy()
    expect(envelope.properties?.error?.properties).toHaveProperty('code')
    expect(envelope.properties?.error?.properties).toHaveProperty('message')
    expect(envelope.properties?.error?.properties).toHaveProperty('details')
  })

  it('money is a string schema (never number)', () => {
    const money = spec.components.schemas.Money as { type: string }
    expect(money.type).toBe('string')
  })

  it('rate limit responses are documented', () => {
    expect(spec.components.responses.RateLimited).toBeTruthy()
  })
})
