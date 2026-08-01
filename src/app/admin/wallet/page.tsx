'use client'
import { AdminShell } from '@/components/admin/admin-shell'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'

export default function AdminWalletPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <PageHeader title="Wallet" description="Manage user wallets." />
        <Card><CardContent className="py-8 text-center text-sm text-zinc-500">
          <p>Use the <strong>Users</strong> section to view and manage individual wallets. Select a user and navigate to their wallet details for credit/debit operations.</p>
        </CardContent></Card>
      </div>
    </AdminShell>
  )
}
