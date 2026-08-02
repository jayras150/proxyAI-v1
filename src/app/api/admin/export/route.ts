// ProxyAI — GET /api/admin/export
// Download analytics as CSV or JSON. Returns a raw file (no envelope).

import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-response'
import { mapApiError } from '@/lib/api-error-mapper'
import { enforceRateLimit, rateLimitHeaders } from '@/lib/rate-limit/helpers'
import { RATE_LIMITS } from '@/config/rate-limits'
import { requireAdminPermission } from '@/lib/admin/guard'
import { BusinessAnalyticsService } from '@/server/admin/analytics/business-analytics.service'
import { UsageAnalyticsService } from '@/server/admin/analytics/usage-analytics.service'
import { FinancialAnalyticsService } from '@/server/admin/analytics/financial-analytics.service'
import { ProviderAnalyticsService } from '@/server/admin/analytics/provider-analytics.service'
import { LogsService } from '@/server/admin/analytics/logs.service'
import { parseAnalyticsQuery } from '@/server/admin/analytics/filters'
import {
  buildCsv,
  buildJson,
  exportFilename,
  exportContentType,
  type ExportColumn,
} from '@/server/admin/analytics/export.service'
import { z } from 'zod'
import type { AnalyticsQuery } from '@/server/admin/analytics/filters'

const exportQuerySchema = z.object({
  type: z.enum(['business', 'usage', 'financial', 'provider', 'logs']),
  format: z.enum(['csv', 'json']).optional().default('csv'),
})

interface ExportData {
  rows: Array<Record<string, unknown>>
  columns: ExportColumn[]
  json: unknown
}

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdminPermission(request, 'admin:analytics:read')
    const rate = await enforceRateLimit(request, { ...RATE_LIMITS.aiRead, identity: admin.sub })
    if (rate.limited) return rate.response

    const searchParams = new URL(request.url).searchParams
    const parsed = exportQuerySchema.safeParse({
      type: searchParams.get('type') ?? undefined,
      format: searchParams.get('format') ?? undefined,
    })
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'type and format are required.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const analyticsQuery = parseAnalyticsQuery(searchParams)
    if (!analyticsQuery) {
      return jsonError('VALIDATION_ERROR', 'Invalid analytics query.', {
        status: 400,
        headers: rateLimitHeaders(rate.result),
      })
    }

    const data = await loadExportData(parsed.data.type, analyticsQuery)
    const body = parsed.data.format === 'csv' ? buildCsv(data.rows, data.columns) : buildJson(data.json)

    const headers = new Headers()
    headers.set('Content-Type', exportContentType(parsed.data.format))
    headers.set('Content-Disposition', `attachment; filename="${exportFilename(parsed.data.type, parsed.data.format)}"`)
    Object.entries(rateLimitHeaders(rate.result)).forEach(([key, value]) => headers.set(key, value))

    return new NextResponse(body, { status: 200, headers })
  } catch (error) {
    return mapApiError(error)
  }
}

/**
 * Load the requested export type and shape it for CSV + JSON output.
 */
async function loadExportData(type: string, query: AnalyticsQuery): Promise<ExportData> {
  switch (type) {
    case 'business': {
      const data = await new BusinessAnalyticsService().getAnalytics(query)
      const columns: ExportColumn[] = [
        { key: 'user_id', header: 'User ID' },
        { key: 'email', header: 'Email' },
        { key: 'requests', header: 'Requests' },
        { key: 'spend', header: 'Spend (USD)' },
      ]
      return {
        rows: data.top_users.map((u) => ({ ...u })),
        columns,
        json: data,
      }
    }
    case 'usage': {
      const data = await new UsageAnalyticsService().getAnalytics(query)
      const columns: ExportColumn[] = [
        { key: 'model', header: 'Model' },
        { key: 'requests', header: 'Requests' },
        { key: 'tokens', header: 'Tokens' },
        { key: 'cost', header: 'Cost (USD)' },
        { key: 'avg_latency_ms', header: 'Avg Latency (ms)' },
      ]
      return {
        rows: data.by_model.map((m) => ({ ...m })),
        columns,
        json: data,
      }
    }
    case 'financial': {
      const data = await new FinancialAnalyticsService().getAnalytics(query)
      const columns: ExportColumn[] = [
        { key: 'metric', header: 'Metric' },
        { key: 'value', header: 'Value' },
      ]
      const rows = Object.entries(data)
        .filter(([k]) => k !== 'range')
        .map(([metric, value]) => ({
          metric,
          value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
        }))
      return { rows, columns, json: data }
    }
    case 'provider': {
      const data = await new ProviderAnalyticsService().getAnalytics(query)
      const columns: ExportColumn[] = [
        { key: 'name', header: 'Provider' },
        { key: 'enabled', header: 'Enabled' },
        { key: 'requests', header: 'Requests' },
        { key: 'success_rate', header: 'Success Rate' },
        { key: 'avg_latency_ms', header: 'Avg Latency (ms)' },
        { key: 'tokens', header: 'Tokens' },
        { key: 'estimated_cost', header: 'Est. Cost (USD)' },
        { key: 'current_status', header: 'Status' },
      ]
      return {
        rows: data.providers.map((p) => ({ ...p })),
        columns,
        json: data,
      }
    }
    case 'logs': {
      const data = await new LogsService().list({ limit: 100 })
      const columns: ExportColumn[] = [
        { key: 'type', header: 'Type' },
        { key: 'title', header: 'Title' },
        { key: 'detail', header: 'Detail' },
        { key: 'user_id', header: 'User ID' },
        { key: 'admin_id', header: 'Admin ID' },
        { key: 'created_at', header: 'Created At' },
      ]
      return {
        rows: data.items.map((l) => ({ ...l })),
        columns,
        json: data,
      }
    }
    default:
      return { rows: [], columns: [], json: null }
  }
}
