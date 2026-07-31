// ProxyAI — Event Dispatcher Unit Tests

import { describe, it, expect, vi } from 'vitest'
import { LocalEventDispatcher, createDomainEvent } from '@/server/events/event-dispatcher'
import type { DomainEvent } from '@/server/events/domain-event'

function makeEvent(type: DomainEvent['type'] = 'wallet.credited'): DomainEvent {
  return createDomainEvent(type, {
    userId: 'user-1',
    walletId: 'wallet-1',
    amount: '10.000000',
    currency: 'USD',
  })
}

describe('LocalEventDispatcher', () => {
  it('delivers events to subscribers of that type', () => {
    const dispatcher = new LocalEventDispatcher()
    const handler = vi.fn()
    dispatcher.subscribe('wallet.credited', handler)

    dispatcher.emit(makeEvent('wallet.credited'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not deliver to subscribers of other types', () => {
    const dispatcher = new LocalEventDispatcher()
    const handler = vi.fn()
    dispatcher.subscribe('wallet.debited', handler)

    dispatcher.emit(makeEvent('wallet.credited'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribes when the returned function is called', () => {
    const dispatcher = new LocalEventDispatcher()
    const handler = vi.fn()
    const unsubscribe = dispatcher.subscribe('wallet.credited', handler)

    unsubscribe()
    dispatcher.emit(makeEvent('wallet.credited'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('swallows handler errors (logs, never throws to caller)', () => {
    const dispatcher = new LocalEventDispatcher()
    dispatcher.subscribe('wallet.credited', () => {
      throw new Error('listener boom')
    })

    expect(() => dispatcher.emit(makeEvent('wallet.credited'))).not.toThrow()
  })

  it('createDomainEvent generates id + timestamp', () => {
    const event = makeEvent()
    expect(event.id).toBeTruthy()
    expect(new Date(event.occurredAt).getTime()).not.toBeNaN()
    expect(event.metadata.amount).toBe('10.000000')
  })
})
