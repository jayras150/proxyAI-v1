'use client'

// ProxyAI — Admin Layout (Milestone 1)
// Wraps all admin pages with QueryClientProvider and ThemeProvider.
// Auth happens inside AdminShell (layout-agnostic, can be composed per route).

import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/query-client'

const queryClient = makeQueryClient()

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
