// ProxyAI — Event Dispatcher
// Blueprint Reference: Design Review Wallet §7 — Internal Domain Events
// Local in-process dispatcher. Errors in handlers are logged, never thrown
// to the caller (a failing listener must not break the main flow).

import crypto from 'crypto'
import { logger } from '@/lib/logger'
import type { DomainEvent, DomainEventType } from './domain-event'

export interface EventDispatcher {
  emit(event: DomainEvent): void
  subscribe(type: DomainEventType, handler: (event: DomainEvent) => void): () => void
}

type Listener = (event: DomainEvent) => void

export class LocalEventDispatcher implements EventDispatcher {
  private listeners = new Map<DomainEventType, Set<Listener>>()

  emit(event: DomainEvent): void {
    const handlers = this.listeners.get(event.type)
    if (!handlers || handlers.size === 0) return

    for (const handler of handlers) {
      try {
        handler(event)
      } catch (error) {
        logger.error('domain_event_handler_failed', {
          event_type: event.type,
          event_id: event.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  subscribe(type: DomainEventType, handler: Listener): () => void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(handler)

    return () => {
      set.delete(handler)
    }
  }
}

/** Create a domain event with generated id + timestamp. */
export function createDomainEvent(
  type: DomainEvent['type'],
  metadata: DomainEvent['metadata']
): DomainEvent {
  return {
    id: crypto.randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    metadata,
  }
}
