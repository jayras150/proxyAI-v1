'use client'

// ProxyAI — Admin Dashboard Home (Milestone 1)
// Placeholder page — actual metrics come in future milestones.

import { AdminShell } from '@/components/admin/admin-shell'

export default function AdminPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Welcome to the ProxyAI admin panel.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Users" value="—" hint="Coming in M2" />
          <StatCard label="Revenue" value="—" hint="Coming in M2" />
          <StatCard label="API Calls" value="—" hint="Coming in M2" />
        </div>

        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Admin dashboard metrics will be implemented in Milestone 2.</p>
        </div>
      </div>
    </AdminShell>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  )
}
