// ProxyAI — Analytics Export Service (Milestone 4)
// Serializes analytics rows to CSV or JSON for download.

export type ExportFormat = 'csv' | 'json'

export interface ExportColumn {
  key: string
  header: string
}

/**
 * Escape a single CSV field per RFC 4180.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Build a CSV document from rows + column definitions.
 */
export function buildCsv(rows: Array<Record<string, unknown>>, columns: ExportColumn[]): string {
  const header = columns.map((c) => csvField(c.header)).join(',')
  const body = rows.map((row) =>
    columns.map((c) => csvField(row[c.key])).join(',')
  )
  return [header, ...body].join('\r\n') + '\r\n'
}

/**
 * Build a JSON document (pretty-printed).
 */
export function buildJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Build a download filename for an export.
 */
export function exportFilename(kind: string, format: ExportFormat): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `proxyai-${kind}-${stamp}.${format}`
}

/**
 * Content-Type for a given export format.
 */
export function exportContentType(format: ExportFormat): string {
  return format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8'
}
