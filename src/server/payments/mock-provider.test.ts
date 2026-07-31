// ProxyAI — MockProvider Unit Tests

import { describe, it, expect } from 'vitest'
import { MockProvider } from '@/server/payments/mock-provider'
import { PaymentError } from '@/server/payments/payment.errors'

describe('MockProvider', () => {
  const provider = new MockProvider()
  const baseInput = {
    topupRequestId: 'topup-1',
    userId: 'user-1',
    walletId: 'wallet-1',
    amount: '50.000000',
    currency: 'USD',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  }

  it('creates a payment intent with unique reference + checkout url + expiry', async () => {
    const intent = await provider.createPayment(baseInput)
    expect(intent.providerReference).toMatch(/^mock_/)
    expect(intent.checkoutUrl).toContain(intent.providerReference)
    expect(intent.token).toBeTruthy()
    expect(intent.expiresAt).toBe(baseInput.expiresAt)
  })

  it('generates unique references across calls', async () => {
    const a = await provider.createPayment(baseInput)
    const b = await provider.createPayment(baseInput)
    expect(a.providerReference).not.toBe(b.providerReference)
  })

  it('verifies a valid signature', async () => {
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference: 'mock_ref',
      amount: '50.000000',
      currency: 'USD',
      status: 'PAID',
    })

    const verified = await provider.verifyWebhook(rawBody, signature, headers)
    expect(verified.providerReference).toBe('mock_ref')
    expect(verified.status).toBe('PAID')
    expect(verified.amount).toBe('50.000000')
  })

  it('rejects an invalid signature (tampered body)', async () => {
    const { rawBody, signature, headers } = provider.simulateWebhook({
      providerReference: 'mock_ref',
      amount: '50.000000',
      currency: 'USD',
      status: 'PAID',
    })

    const tampered = rawBody.replace('50.000000', '5000.000000')
    await expect(provider.verifyWebhook(tampered, signature, headers)).rejects.toThrow(
      PaymentError
    )
  })

  it('rejects a missing signature', async () => {
    const { rawBody, headers } = provider.simulateWebhook({
      providerReference: 'mock_ref',
      amount: '50.000000',
      currency: 'USD',
      status: 'PAID',
    })

    await expect(provider.verifyWebhook(rawBody, '', headers)).rejects.toThrow(PaymentError)
  })

  it('rejects invalid JSON payload', async () => {
    const signature = provider.sign('not-json')
    await expect(provider.verifyWebhook('not-json', signature, {})).rejects.toThrow(PaymentError)
  })

  it('rejects unsupported status', async () => {
    const { rawBody, headers } = provider.simulateWebhook({
      providerReference: 'mock_ref',
      amount: '50.000000',
      currency: 'USD',
      status: 'PAID',
    })
    const weird = rawBody.replace('"PAID"', '"PENDING"')
    const weirdSig = provider.sign(weird)

    await expect(provider.verifyWebhook(weird, weirdSig, headers)).rejects.toThrow(PaymentError)
  })
})
