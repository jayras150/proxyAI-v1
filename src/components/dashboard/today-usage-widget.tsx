// ProxyAI — Today's Usage Widget (Milestone 2)
// Requests / tokens / cost since the start of today (UTC, COMPLETED only).

import { StatCard } from '@/components/ui/stat-card'
import { formatMoney, formatNumber } from '@/lib/format'

export interface TodayUsageWidgetProps {
  requests: number
  tokens: number
  cost: string
  currency: string
}

export function TodayUsageWidget({ requests, tokens, cost, currency }: TodayUsageWidgetProps) {
  return (
    <section aria-label="Today's usage" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Today's Requests" value={formatNumber(requests)} hint="Since midnight (UTC)" />
      <StatCard label="Today's Tokens" value={formatNumber(tokens)} hint="Total tokens processed" />
      <StatCard label="Today's Cost" value={formatMoney(cost, currency)} hint="Charged usage only" />
    </section>
  )
}
