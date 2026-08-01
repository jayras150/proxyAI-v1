'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminUsers } from '@/hooks/use-admin-users'
import { PageHeader } from '@/components/ui/page-header'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchBox } from '@/components/ui/search-box'
import { SkeletonCard } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/error-state'
import { formatRelativeTime } from '@/lib/format'

const ROLE_OPTIONS = [{ value: '', label: 'All Roles' }, { value: 'USER', label: 'User' }, { value: 'ADMIN', label: 'Admin' }, { value: 'SUPER_ADMIN', label: 'Super Admin' }]
const STATUS_OPTIONS = [{ value: '', label: 'All Status' }, { value: 'ACTIVE', label: 'Active' }, { value: 'SUSPENDED', label: 'Suspended' }]

export default function AdminUsersPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursors, setCursors] = useState<string[]>([])

  const { data, isLoading, error } = useAdminUsers({ cursor, search: search || undefined, role: roleFilter || undefined, status: statusFilter || undefined })
  const items = data?.items ?? []

  const handlePrev = useCallback(() => {
    const prev = cursors[cursors.length - 2] ?? null
    setCursors((c) => c.slice(0, -1))
    setCursor(prev)
  }, [cursors])

  const handleNext = useCallback(() => {
    if (data?.next_cursor) {
      setCursors((c) => [...c, cursor])
      setCursor(data.next_cursor)
    }
  }, [data?.next_cursor, cursor])

  const handleFilter = useCallback(() => {
    setCursor(null)
    setCursors([])
  }, [])

  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader title="Users" description="Manage platform users." />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><SearchBox value={search} onChange={(v) => { setSearch(v); handleFilter() }} placeholder="Search users..." /></div>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); handleFilter() }} aria-label="Filter by role" className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"> {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)} </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); handleFilter() }} aria-label="Filter by status" className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"> {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)} </select>
        </div>

        {isLoading && <div className="space-y-3"><SkeletonCard lines={1} /><SkeletonCard lines={1} /></div>}
        {error && !isLoading && <ErrorState title="Failed to Load Users" error={error} />}
        {!isLoading && !error && items.length === 0 && <EmptyState title="No users found" />}

        {items.length > 0 && (
          <>
            <div className="hidden md:block">
              <Table><THead><TR><TH>Email</TH><TH>Name</TH><TH>Role</TH><TH>Status</TH><TH>API Keys</TH><TH>Joined</TH></TR></THead>
                <TBody>{items.map((u) => (
                  <TR key={u.id} className="cursor-pointer" onClick={() => router.push(`/admin/users/${u.id}`)} tabIndex={0} role="button" onKeyDown={(e) => e.key === 'Enter' && router.push(`/admin/users/${u.id}`)}>
                    <TD className="font-medium">{u.email}</TD>
                    <TD className="text-zinc-500">{u.name ?? '—'}</TD>
                    <TD><Badge>{u.role}</Badge></TD>
                    <TD><Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status}</Badge></TD>
                    <TD className="tabular-nums">{u.api_keys_count}</TD>
                    <TD className="tabular-nums text-zinc-500">{formatRelativeTime(u.created_at)}</TD>
                  </TR>))}</TBody></Table>
            </div>
            <div className="divide-y divide-zinc-200 md:hidden dark:divide-zinc-800">
              {items.map((u) => (
                <div key={u.id} className="flex cursor-pointer items-center justify-between px-5 py-3" onClick={() => router.push(`/admin/users/${u.id}`)}>
                  <div><p className="text-sm font-medium">{u.email}</p><p className="text-xs text-zinc-500">{u.name ?? '—'}</p></div>
                  <div className="text-right"><Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status}</Badge></div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{items.length} user{items.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                {cursors.length > 0 && <Button variant="outline" size="sm" onClick={handlePrev}>Previous</Button>}
                {data?.has_more && <Button variant="outline" size="sm" onClick={handleNext}>Next</Button>}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
