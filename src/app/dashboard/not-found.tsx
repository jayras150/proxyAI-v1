// ProxyAI — Dashboard 404 (segment not-found)

import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardNotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you are looking for does not exist in your dashboard."
      action={
        <Link href="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      }
    />
  )
}
