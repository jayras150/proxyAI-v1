// ProxyAI — Dashboard Home types
// Mirrors GET /api/v1/dashboard/summary (openapi/v1.yaml DashboardSummary).

export type WalletStatus = 'ACTIVE' | 'LOCKED' | 'SUSPENDED' | 'PAYMENT_REQUIRED'

export interface DashboardTransactionItem {
  id: string
  type: 'TOPUP' | 'AI_USAGE' | 'REFUND' | 'ADJUSTMENT' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT'
  amount: string
  balance_after: string
  currency: string
  status: string
  description: string | null
  created_at: string
}

export interface DashboardUsageItem {
  id: string
  model: string
  provider: string
  status: string
  total_tokens: number
  user_cost: string
  currency: string
  created_at: string
}

export interface DashboardSummary {
  balance: string
  currency: string
  wallet_status: WalletStatus
  requests_today: number
  tokens_today: number
  spend_today: string
  spend_month: string
  spend_previous_month: string
  active_keys: number
  available_models: number
  default_model: string | null
  latest_transactions: DashboardTransactionItem[]
  latest_usage: DashboardUsageItem[]
  provider: {
    id: string
    healthy: boolean
    latency_ms: number | null
  }
}
