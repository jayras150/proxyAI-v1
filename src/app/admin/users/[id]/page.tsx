'use client'
import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { useAdminUserDetail, useUpdateUserStatus } from '@/hooks/use-admin-users'
import { useAdminCreditWallet, useAdminDebitWallet } from '@/hooks/use-admin-wallet'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/alert'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { formatMoney, formatNumber, formatRelativeTime } from '@/lib/format'

export default function AdminUserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const { data: user, isLoading, error } = useAdminUserDetail(userId)
  const updateStatus = useUpdateUserStatus()
  const creditWallet = useAdminCreditWallet()
  const debitWallet = useAdminDebitWallet()

  const [statusAction, setStatusAction] = useState<{ open: boolean; newStatus: string }>({ open: false, newStatus: '' })
  const [walletAction, setWalletAction] = useState<{ open: boolean; type: 'credit' | 'debit'; amount: string; reason: string } | null>(null)

  const handleStatusChange = useCallback(async () => {
    try { await updateStatus.mutateAsync({ userId, status: statusAction.newStatus }); setStatusAction({ open: false, newStatus: '' }) } catch {}
  }, [userId, statusAction.newStatus, updateStatus])

  const handleWallet = useCallback(async () => {
    if (!walletAction) return
    try {
      const fn = walletAction.type === 'credit' ? creditWallet.mutateAsync : debitWallet.mutateAsync
      await fn({ wallet_id: user?.wallet?.id ?? '', amount: walletAction.amount, reason: walletAction.reason, idempotency_key: `admin_${walletAction.type}_${userId}_${Date.now()}` })
      setWalletAction(null)
    } catch {}
  }, [walletAction, userId, user, creditWallet, debitWallet])

  if (isLoading) return <AdminShell><SkeletonCard lines={5} /></AdminShell>
  if (error) return <AdminShell><ErrorState title="Failed to Load User" error={error} /></AdminShell>
  if (!user) return null

  return (
    <AdminShell>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-semibold">{user.email}</h1><p className="text-sm text-zinc-500">Joined {formatRelativeTime(user.created_at)}</p></div>

        {/* Info */}
        <Card><CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs text-zinc-500">Name</p><p className="font-medium">{user.name ?? '—'}</p></div>
            <div><p className="text-xs text-zinc-500">Role</p><Badge>{user.role}</Badge></div>
            <div><p className="text-xs text-zinc-500">Status</p><Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>{user.status}</Badge></div>
            <div><p className="text-xs text-zinc-500">API Keys</p><p className="tabular-nums">{user.stats.api_keys_count}</p></div>
            <div><p className="text-xs text-zinc-500">Sessions</p><p className="tabular-nums">{user.stats.sessions_count}</p></div>
            <div><p className="text-xs text-zinc-500">Usage</p><p className="tabular-nums">{user.stats.usage_count}</p></div>
          </CardContent>
        </Card>

        {/* Wallet */}
        <Card><CardHeader><CardTitle>Wallet</CardTitle></CardHeader>
          <CardContent>
            {user.wallet ? (
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><p className="text-xs text-zinc-500">Balance</p><p className="text-xl font-bold tabular-nums">{formatMoney(user.wallet.balance, user.wallet.currency)}</p></div>
                  <div><p className="text-xs text-zinc-500">Currency</p><p>{user.wallet.currency}</p></div>
                  <div><p className="text-xs text-zinc-500">Status</p><Badge tone={user.wallet.status === 'ACTIVE' ? 'success' : user.wallet.status === 'PAYMENT_REQUIRED' ? 'warning' : 'danger'}>{user.wallet.status}</Badge></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setWalletAction({ open: true, type: 'credit', amount: '', reason: '' })}>Credit</Button>
                  <Button size="sm" variant="outline" onClick={() => setWalletAction({ open: true, type: 'debit', amount: '', reason: '' })}>Debit</Button>
                </div>
              </div>
            ) : <p className="text-sm text-zinc-500">No wallet.</p>}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card><CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            {user.status === 'ACTIVE' ? (
              <Button size="sm" variant="danger" onClick={() => setStatusAction({ open: true, newStatus: 'SUSPENDED' })}>Suspend</Button>
            ) : (
              <Button size="sm" onClick={() => setStatusAction({ open: true, newStatus: 'ACTIVE' })}>Unsuspend</Button>
            )}
          </CardContent>
        </Card>

        {/* Recent Usage */}
        {user.recent_usage.length > 0 && (<Card><CardHeader><CardTitle>Recent Usage</CardTitle></CardHeader>
          <CardContent><div className="divide-y divide-zinc-200 dark:divide-zinc-800">{user.recent_usage.map((u: Record<string, unknown>) => (
            <div key={String(u.id)} className="flex justify-between py-2 text-sm"><span>{String(u.model)}</span><span className="tabular-nums text-zinc-500">{formatNumber(Number(u.total_tokens))} tokens · {formatMoney(String(u.user_cost))}</span></div>
          ))}</div></CardContent></Card>)}

        {/* Recent Transactions */}
        {user.recent_transactions.length > 0 && (<Card><CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
          <CardContent><div className="divide-y divide-zinc-200 dark:divide-zinc-800">{user.recent_transactions.map((t: Record<string, unknown>) => (
            <div key={String(t.id)} className="flex justify-between py-2 text-sm"><span><Badge>{String(t.type)}</Badge> {String(t.description ?? "")}</span><span className="tabular-nums">{formatMoney(String(t.amount), String(t.currency))}</span></div>
          ))}</div></CardContent></Card>)}

        {/* Sessions */}
        {user.sessions.length > 0 && (<Card><CardHeader><CardTitle>Sessions</CardTitle></CardHeader>
          <CardContent><div className="divide-y divide-zinc-200 dark:divide-zinc-800">{user.sessions.map((s: Record<string, unknown>) => (
            <div key={String(s.id)} className="flex justify-between py-2 text-sm"><span>{String(s.user_agent ?? 'Unknown')}</span><span className="text-xs text-zinc-500">{String(s.ip_address ?? '—')}</span></div>
          ))}</div></CardContent></Card>)}
      </div>

      {/* Status Dialog */}
      <Dialog open={statusAction.open} onClose={() => setStatusAction({ open: false, newStatus: '' })}
        title={statusAction.newStatus === 'SUSPENDED' ? 'Suspend User' : 'Unsuspend User'}
        description={`Are you sure you want to ${statusAction.newStatus === 'SUSPENDED' ? 'suspend' : 'unsuspend'} ${user.email}?`}>
        {updateStatus.isError && <Alert tone="danger">{(updateStatus.error as Error).message}</Alert>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setStatusAction({ open: false, newStatus: '' })}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleStatusChange} isLoading={updateStatus.isPending}>Confirm</Button>
        </div>
      </Dialog>

      {/* Wallet Dialog */}
      <Dialog open={!!walletAction} onClose={() => setWalletAction(null)}
        title={walletAction?.type === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium">Amount</label>
            <Input type="text" placeholder="10.00" value={walletAction?.amount ?? ''} onChange={(e) => setWalletAction((p) => p ? { ...p, amount: e.target.value } : null)} /></div>
          <div><label className="block text-sm font-medium">Reason</label>
            <Input type="text" placeholder="Reason" value={walletAction?.reason ?? ''} onChange={(e) => setWalletAction((p) => p ? { ...p, reason: e.target.value } : null)} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setWalletAction(null)}>Cancel</Button>
            <Button size="sm" onClick={handleWallet} isLoading={creditWallet.isPending || debitWallet.isPending}>Confirm</Button>
          </div>
        </div>
      </Dialog>
    </AdminShell>
  )
}

