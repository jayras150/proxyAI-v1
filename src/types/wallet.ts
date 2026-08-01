// ProxyAI — Wallet, Topup & Transaction types (Milestone 3)
// Mirrors GET /api/v1/wallet and related endpoints (openapi/v1.yaml).

import type { WalletStatus } from './dashboard'

export type { WalletStatus }

export type TopupStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
export type TransactionType =
  | 'TOPUP'
  | 'AI_USAGE'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED'

export interface WalletResponse {
  id: string
  balance: string
  currency: string
  status: WalletStatus
}

export interface TopupItem {
  id: string
  status: TopupStatus
  amount: string
  currency: string
  provider: string
  provider_reference: string | null
  transaction_id: string | null
  expires_at: string
  created_at: string
}

export interface TopupPage {
  items: TopupItem[]
  next_cursor: string | null
  has_more: boolean
}

export interface TransactionItem {
  id: string
  type: TransactionType
  amount: string
  balance_before: string
  balance_after: string
  currency: string
  status: TransactionStatus
  reference: string
  description: string | null
  // Audit fields for detail dialog
  request_id?: string | null
  provider_reference?: string | null
  created_by?: string | null
  ip_address?: string | null
  user_agent?: string | null
  created_at: string
}

export interface TransactionPage {
  items: TransactionItem[]
  next_cursor: string | null
  has_more: boolean
}

export interface TransactionDetail extends TransactionItem {
  request_id: string | null
  provider_reference: string | null
  created_by: string | null
  ip_address: string | null
  user_agent: string | null
}
