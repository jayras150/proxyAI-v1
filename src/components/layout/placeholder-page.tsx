// ProxyAI — PlaceholderPage (Milestone 1 scaffold)
// Used by all 10 dashboard routes until their milestone lands (M2–M5).

import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'

export interface PlaceholderPageProps {
  title: string
  description?: string
  milestone: string
  emptyTitle: string
  emptyDescription?: string
}

export function PlaceholderPage({
  title,
  description,
  milestone,
  emptyTitle,
  emptyDescription,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={<Badge tone="info">{milestone}</Badge>}
      />
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </div>
  )
}
