// ProxyAI — Export service unit tests (CSV/JSON serialization)

import { describe, it, expect } from 'vitest'
import {
  csvField,
  buildCsv,
  buildJson,
  exportFilename,
  exportContentType,
  type ExportColumn,
} from '../export.service'

describe('csvField', () => {
  it('renders plain values as strings', () => {
    expect(csvField('abc')).toBe('abc')
    expect(csvField(42)).toBe('42')
    expect(csvField(true)).toBe('true')
  })

  it('renders null/undefined as empty string', () => {
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })

  it('quotes fields containing commas, quotes or newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('buildCsv', () => {
  const columns: ExportColumn[] = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
  ]

  it('emits header + rows with CRLF', () => {
    const csv = buildCsv(
      [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta, Inc' },
      ],
      columns
    )
    expect(csv).toBe('ID,Name\r\n1,Alpha\r\n2,"Beta, Inc"\r\n')
  })

  it('handles empty rows (header only)', () => {
    expect(buildCsv([], columns)).toBe('ID,Name\r\n')
  })
})

describe('buildJson', () => {
  it('pretty-prints JSON', () => {
    expect(buildJson({ a: 1 })).toBe('{\n  "a": 1\n}')
  })
})

describe('exportFilename', () => {
  it('includes kind, date and extension', () => {
    const name = exportFilename('business', 'csv')
    expect(name).toMatch(/^proxyai-business-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})

describe('exportContentType', () => {
  it('returns csv and json content types', () => {
    expect(exportContentType('csv')).toBe('text/csv; charset=utf-8')
    expect(exportContentType('json')).toBe('application/json; charset=utf-8')
  })
})
