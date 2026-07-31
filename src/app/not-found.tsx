// ProxyAI — Global 404

import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <EmptyState
          title="404 — Page not found"
          description="The page you are looking for doesn't exist or has moved."
          action={
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}
