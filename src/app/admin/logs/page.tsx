'use client'

// ProxyAI — Logs Page (Milestone 4)
// Read-only unified log stream.

import { AdminShell } from '@/components/admin/admin-shell'
import { LogsViewer } from '@/components/admin/analytics/logs-viewer'

export default function AdminLogsPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Logs</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Recent errors, requests, admin actions, refunds and wallet activity. Read only.</p>
        </div>
        <LogsViewer />
      </div>
    </AdminShell>
  )
}
