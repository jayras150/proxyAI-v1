// ProxyAI — Domain Events
// Blueprint Reference: Design Review Wallet §7 — Internal Domain Events
// Events are emitted ONLY after the database transaction commits.
// Upgrade path: outbox pattern / RabbitMQ / Kafka / NATS — swap dispatcher.

export type DomainEventType =
  | 'wallet.credited'
  | 'wallet.debited'
  | 'topup.completed'
  | 'topup.failed'
  | 'refund.completed'

export interface DomainEventMetadata {
  requestId?: string
  correlationId?: string
  userId: string
  walletId: string
  transactionId?: string
  topupId?: string
  provider?: string
  providerReference?: string
  amount?: string // decimal string, never number
  currency?: string
}

export interface DomainEvent {
  id: string
  type: DomainEventType
  occurredAt: string // ISO-8601
  metadata: DomainEventMetadata
}
