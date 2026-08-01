'use client'
import { useState, useCallback } from 'react'
import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminRefunds, useApproveRefund, useRejectRefund } from '@/hooks/use-admin-refunds'
import type { AdminRefundItem } from '@/hooks/use-admin-refunds'
import { PageHeader } from '@/components/ui/page-header'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { formatMoney, formatRelativeTime } from '@/lib/format'

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  REQUESTED: 'warning', APPROVED: 'info', REJECTED: 'danger', COMPLETED: 'success', FAILED: 'danger', CANCELLED: 'neutral',
}

export default function AdminRefundsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursors, setCursors] = useState<string[]>([])
  const [detail, setDetail] = useState<AdminRefundItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading, error } = useAdminRefunds({ cursor, status: statusFilter || undefined })
  const approveMutation = useApproveRefund()
  const rejectMutation = useRejectRefund()
  const items = data?.items ?? []

  const handlePrev = useCallback(() => { const prev = cursors[cursors.length - 2] ?? null; setCursors((c) => c.slice(0, -1)); setCursor(prev) }, [cursors])
  const handleNext = useCallback(() => { if (data?.next_cursor) { setCursors((c) => [...c, cursor]); setCursor(data.next_cursor) } }, [data?.next_cursor, cursor])

  const handleApprove = useCallback(async (id: string) => { try { await approveMutation.mutateAsync(id); setDetail(null) } catch {} }, [approveMutation])
  const handleReject = useCallback(async (id: string) => { try { await rejectMutation.mutateAsync({ id, reason: rejectReason }); setDetail(null); setRejectReason('') } catch {} }, [rejectMutation, rejectReason])

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader title="Refunds" description="Review and process refund requests." />
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCursor(null); setCursors([]) }} aria-label="Filter by status"
            className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">All Status</option>
            <option value="REQUESTED">Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {isLoading && <SkeletonCard lines={3} />}
        {error && !isLoading && <ErrorState title="Failed to Load Refunds" error={error} />}
        {!isLoading && !error && items.length === 0 && <EmptyState title="No refund requests" />}

        {items.length > 0 && (
          <>
            <Table><THead><TR><TH>ID</TH><TH>User</TH><TH>Amount</TH><TH>Status</TH><TH>Reason</TH><TH>Created</TH><TH></TH></TR></THead>
              <TBody>{items.map((r) => (
                <TR key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                  <TD className="font-mono text-xs">{r.id.slice(0, 8)}…</TD>
                  <TD className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TD>
                  <TD className="tabular-nums font-medium">{formatMoney(r.amount, r.currency)}</TD>
                  <TD><Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge></TD>
                  <TD className="max-w-[200px] truncate text-zinc-500">{r.reason ?? '—'}</TD>
                  <TD className="tabular-nums text-zinc-500">{formatRelativeTime(r.created_at)}</TD>
                  <TD><Button variant="ghost" size="sm">View</Button></TD>
                </TR>))}</TBody></Table>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{items.length} refund{items.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                {cursors.length > 0 && <Button variant="outline" size="sm" onClick={handlePrev}>Previous</Button>}
                {data?.has_more && <Button variant="outline" size="sm" onClick={handleNext}>Next</Button>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title="Refund Detail">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-zinc-500">Amount</p><p className="tabular-nums font-medium">{formatMoney(detail.amount, detail.currency)}</p></div>
              <div><p className="text-xs text-zinc-500">Status</p><Badge tone={STATUS_TONE[detail.status] ?? 'neutral'}>{detail.status}</Badge></div>
              <div><p className="text-xs text-zinc-500">Usage Log</p><p className="font-mono text-xs">{detail.usage_log_id}</p></div>
              <div><p className="text-xs text-zinc-500">Requested By</p><p className="text-xs">{detail.requested_by ?? '—'}</p></div>
            </div>
            {detail.reason && <div><p className="text-xs text-zinc-500">Reason</p><p className="text-sm">{detail.reason}</p></div>}
            {detail.status === 'REQUESTED' && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => handleApprove(detail.id)} isLoading={approveMutation.isPending}>Approve</Button>
                <div className="flex gap-2 items-center">
                  <Input placeholder="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-48" />
                  <Button variant="outline" size="sm" onClick={() => handleReject(detail.id)} isLoading={rejectMutation.isPending}>Reject</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </AdminShell>
  )
}
