'use client'

// ProxyAI — Client providers (Query + Auth + Theme)
// Consumed by the root layout; order matters: Auth/Theme before Query is
// irrelevant (they are independent), but all must wrap the app.

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/lib/query-client'
import { ThemeProvider } from '@/lib/theme'
import { AuthProvider } from '@/lib/auth-context'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
