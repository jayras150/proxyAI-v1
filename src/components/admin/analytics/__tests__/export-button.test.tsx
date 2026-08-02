// @vitest-environment jsdom
// ProxyAI — ExportButton + KpiCard component tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportButton } from '../export-button'
import { KpiCard } from '../kpi-card'

vi.mock('@/hooks/use-admin-logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-admin-logs')>()
  return {
    ...actual,
    downloadExport: vi.fn().mockResolvedValue('proxyai-business-2026-08-02.csv'),
  }
})

import { downloadExport } from '@/hooks/use-admin-logs'

describe('ExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders CSV and JSON buttons', () => {
    render(<ExportButton type="business" filters={{ range: 'today' }} />)
    expect(screen.getByRole('button', { name: 'CSV' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'JSON' })).toBeTruthy()
  })

  it('downloads CSV with the current filters', async () => {
    render(<ExportButton type="usage" filters={{ range: '7d', provider: 'deepseek' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() => {
      expect(downloadExport).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'usage', format: 'csv', range: '7d', provider: 'deepseek' })
      )
    })
  })

  it('surfaces export errors', async () => {
    vi.mocked(downloadExport).mockRejectedValueOnce(new Error('Export failed (403)'))
    render(<ExportButton type="business" filters={{ range: 'today' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})

describe('KpiCard', () => {
  it('renders label, value and hint', () => {
    render(<KpiCard label="Revenue" value="$10.00" hint="+20% growth" />)
    expect(screen.getByText('Revenue')).toBeTruthy()
    expect(screen.getByText('$10.00')).toBeTruthy()
    expect(screen.getByText('+20% growth')).toBeTruthy()
  })

  it('applies tone classes', () => {
    const { container } = render(<KpiCard label="Errors" value="5" tone="danger" />)
    expect(container.querySelector('.text-red-600')).toBeTruthy()
  })
})
