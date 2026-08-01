// ProxyAI — Money & number formatting (client)
// Design doc §6.3: money is ALWAYS a decimal string from the API; display
// formatting happens here with Intl.NumberFormat (never server-side).
//   formatMoney("50.000000", "USD") → "$50.00"
//   formatMoney("50000.000000", "IDR") → "Rp50.000"
//   formatMoney("50.000000", "SGD") → "S$50.00"

import type { DashboardTransactionItem } from '@/types/dashboard'

type DashboardTransactionType = DashboardTransactionItem['type']

const DEFAULT_LOCALE = undefined // browser locale

/** Parse a decimal-string money value; NaN-safe (returns the raw string). */
function toNumber(value: string): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : Number.NaN
}

/**
 * Format a decimal-string money value as currency.
 * Falls back to the raw string when the value is not parseable.
 */
export function formatMoney(value: string, currency = 'USD'): string {
  const num = toNumber(value)
  if (Number.isNaN(num)) return value
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
  }).format(num)
}

/**
 * Format money with an explicit sign for transaction rows.
 * Sign convention (design doc §6.3): TOPUP/REFUND "+", AI_USAGE/ADMIN_DEBIT "−",
 * ADJUSTMENT by value sign. Zero renders unsigned.
 */
export function formatSignedAmount(
  type: DashboardTransactionType,
  amount: string,
  currency: string
): string {
  const num = toNumber(amount)
  if (Number.isNaN(num)) return amount
  const abs = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
  }).format(Math.abs(num))
  if (num === 0) return abs
  const positive = type === 'TOPUP' || type === 'REFUND' || type === 'ADMIN_CREDIT'
  const negative = type === 'AI_USAGE' || type === 'ADMIN_DEBIT'
  const sign = positive ? '+' : negative ? '−' : num > 0 ? '+' : '−'
  return `${sign}${abs}`
}

/** Format a token count with locale separators (e.g. 12,345). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE).format(value)
}

/** Compact relative time: "just now", "5m ago", "3h ago", "2d ago". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diffMs = now.getTime() - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDateTime(iso)
}

/** Absolute date-time, e.g. "Aug 1, 2026, 1:00 PM" (browser locale). */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/** Long date for the welcome header, e.g. "Saturday, August 1, 2026". */
export function formatLongDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** Time-of-day greeting (client-local). */
export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}
