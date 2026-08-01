'use client'

// ProxyAI — Topup Form (Milestone 3)
// Amount presets, custom amount, create payment button.

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const AMOUNT_PRESETS = ['10.00', '25.00', '50.00', '100.00']

export interface TopupFormProps {
  currency: string
  onCreateTopup: (amount: string) => Promise<void>
  isCreating: boolean
  error: string | null
  createdTopup: { id: string; payment: { checkout_url: string | null; token: string | null } } | null
}

export function TopupForm({ currency, onCreateTopup, isCreating, error, createdTopup }: TopupFormProps) {
  const [customAmount, setCustomAmount] = useState('')

  const handlePreset = async (amount: string) => {
    setCustomAmount('')
    await onCreateTopup(amount)
  }

  const handleCustom = async () => {
    if (!customAmount) return
    // Validate: positive decimal with up to 2 decimal places
    if (!/^\d+(\.\d{1,6})?$/.test(customAmount) || Number(customAmount) <= 0) return
    await onCreateTopup(customAmount)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Up Wallet</CardTitle>
        <CardDescription>Add credits to your wallet in {currency}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount Presets */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AMOUNT_PRESETS.map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="lg"
              onClick={() => handlePreset(amount)}
              disabled={isCreating}
              aria-label={`Top up ${amount} ${currency}`}
            >
              {new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              }).format(Number(amount))}
            </Button>
          ))}
        </div>

        {/* Custom Amount */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="custom-amount" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Custom Amount
            </label>
            <Input
              id="custom-amount"
              type="text"
              inputMode="decimal"
              placeholder={`0.00 ${currency}`}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              disabled={isCreating}
              aria-label="Enter custom top-up amount"
            />
          </div>
          <Button
            onClick={handleCustom}
            disabled={isCreating || !customAmount}
            isLoading={isCreating}
            aria-label="Create payment"
          >
            Create Payment
          </Button>
        </div>

        {error && (
          <Alert tone="danger" title="Topup Failed">
            {error}
          </Alert>
        )}

        {/* Show checkout link when topup created */}
        {createdTopup?.payment.checkout_url && (
          <Alert tone="info" title="Payment Initiated">
            <p className="mb-2">Your payment request has been created.</p>
            <a
              href={createdTopup.payment.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Complete Payment
            </a>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
