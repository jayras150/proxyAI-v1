'use client'
import { useState, useCallback } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminAudit, type AuditItem } from '@/hooks/use-admin-audit'
import { PageHeader } from '@/components/ui/page-header'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchBox } from '@/components/ui/search-box'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { formatRelativeTime } from '@/lib/format'

export default function AdminAuditPage() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursors, setCursors] = useState<string[]>([])
  const [detail, setDetail] = useState<AuditItem | null>(null)

  const { data, isLoading, error } = useAdminAudit({
    cursor, search: search || undefined, action: actionFilter || undefined,
    date_from: dateFrom || undefined, date_to: dateTo || undefined,
  })
  const items = data?.items ?? []

  const handlePrev = useCallback(() => { const prev = cursors.length >= 2 ? cursors[cursors.length - 2]! : null; setCursors(cursors.slice(0, -1)); setCursor(prev) }, [cursors])
  const handleNext = useCallback(() => { if (data?.next_cursor) { setCursors([...cursors, data.next_cursor]); setCursor(data.next_cursor) } }, [data, cursors])
  const handleFilter = useCallback(() => { setCursor(null); setCursors([]) }, [])

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader title="Audit Log" description="Read-only audit trail of all admin actions." />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="flex-1"><SearchBox value={search} onChange={(v) => { setSearch(v); handleFilter() }} placeholder="Search actions, resources..." /></div>
          <input value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); handleFilter() }} placeholder="Action filter (e.g. user.*)" className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" aria-label="Filter by action" />
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); handleFilter() }} aria-label="From date" />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); handleFilter() }} aria-label="To date" />
        </div>

        {isLoading && <div className="space-y-3"><SkeletonCard lines={1} /><SkeletonCard lines={1} /></div>}
        {error && !isLoading && <ErrorState title="Failed to Load Audit Log" error={error} />}
        {!isLoading && !error && items.length === 0 && <EmptyState title="No audit entries found" />}

        {items.length > 0 && (
          <>
            <Table><THead><TR><TH>Action</TH><TH>Admin</TH><TH>Resource</TH><TH>Status</TH><TH>Date</TH></TR></THead>
              <TBody>{items.map((a) => (
                <TR key={a.id} className="cursor-pointer" onClick={() => setDetail(a)} tabIndex={0} role="button" onKeyDown={(e) => e.key === 'Enter' && setDetail(a)}>
                  <TD><code className="text-xs font-mono">{a.action}</code></TD>
                  <TD className="font-mono text-xs">{a.admin_id.slice(0, 8)}…</TD>
                  <TD className="text-xs text-zinc-500">{a.resource}</TD>
                  <TD><Badge tone={a.status === 'COMPLETED' ? 'success' : 'danger'}>{a.status}</Badge></TD>
                  <TD className="tabular-nums text-zinc-500">{formatRelativeTime(a.created_at)}</TD>
                </TR>))}</TBody></Table>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{items.length} entr{items.length !== 1 ? 'ies' : 'y'}</p>
              <div className="flex gap-2">
                {cursors.length > 0 && <Button variant="outline" size="sm" onClick={handlePrev}>Previous</Button>}
                {data?.has_more && <Button variant="outline" size="sm" onClick={handleNext}>Next</Button>}
              </div>
            </div>
          </>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!detail} onClose={() => setDetail(null)} title="Audit Entry">
          {detail && <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-zinc-500">Action</p><code className="text-sm">{detail.action}</code></div>
              <div><p className="text-xs text-zinc-500">Status</p><Badge>{detail.status}</Badge></div>
              <div><p className="text-xs text-zinc-500">Admin</p><p className="font-mono text-xs">{detail.admin_id}</p></div>
              <div><p className="text-xs text-zinc-500">Resource</p><p className="text-xs">{detail.resource}</p></div>
              <div><p className="text-xs text-zinc-500">IP Address</p><p>{detail.ip_address ?? '—'}</p></div>
              <div><p className="text-xs text-zinc-500">Created</p><p>{new Date(detail.created_at).toLocaleString()}</p></div>
            </div>
            {detail.before_value && <div><p className="text-xs text-zinc-500">Before</p><pre className="mt-1 rounded bg-zinc-50 p-2 text-xs font-mono dark:bg-zinc-800">{JSON.stringify(detail.before_value, null, 2)}</pre></div>}
            {detail.after_value && <div><p className="text-xs text-zinc-500">After</p><pre className="mt-1 rounded bg-zinc-50 p-2 text-xs font-mono dark:bg-zinc-800">{JSON.stringify(detail.after_value, null, 2)}</pre></div>}
          </div>}
        </Dialog>
      </div>
    </AdminShell>
  )
}
