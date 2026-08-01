// ProxyAI — Monthly Spending Widget (Milestone 2)
// Current month cost + trend vs the previous month.

import { StatCard } from '@/components/ui/stat-card'
import { formatMoney } from '@/lib/format'

export interface MonthlySpendingWidgetProps {
  cost: string
  previousCost: string
  currency: string
}

/** Percentage change vs previous month; null when there is no baseline. */
export function monthTrendPct(cost: number, previousCost: number): number | null {
  if (previousCost <= 0) return null
  return Math.round(((cost - previousCost) / previousCost) * 100)
}

export function MonthlySpendingWidget({ cost, previousCost, currency }: MonthlySpendingWidgetProps) {
  const costNum = Number(cost)
  const previousNum = Number(previousCost)
  const trend = monthTrendPct(costNum, previousNum)

  let hint: string
  if (previousNum <= 0 && costNum > 0) {
    hint = 'First spending this month'
  } else if (previousNum <= 0) {
    hint = 'No spending yet this month'
  } else if (trend === 0) {
    hint = 'Same as last month'
  } else if (trend !== null && trend > 0) {
    hint = `${trend}% more than last month`
  } else if (trend !== null) {
    hint = `${Math.abs(trend)}% less than last month`
  } else {
    hint = 'Compared to last month'
  }

  return (
    <StatCard
      label="Monthly Spending"
      value={formatMoney(cost, currency)}
      hint={hint}
      tone={trend !== null && trend > 0 ? 'warning' : undefined}
    />
  )
}
