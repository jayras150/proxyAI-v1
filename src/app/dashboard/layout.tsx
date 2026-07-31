// ProxyAI — Dashboard layout (app shell, Milestone 1)

import { AppShell } from '@/components/layout/app-shell'

export const metadata = {
  title: 'Dashboard — ProxyAI',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
