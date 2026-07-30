# ProxyAI Blueprint v1

# Sprint 4 - Wallet, Billing & Pricing Engine

# 19. Wallet System

## Objectives

The wallet is the single source of truth for all customer balances.

Rules:

-   Every user owns exactly one wallet.
-   Balance can never become negative.
-   Every balance change creates a transaction.
-   All balance updates occur inside a database transaction.

Wallet States:

-   Active
-   Suspended
-   Locked

------------------------------------------------------------------------

# Wallet Lifecycle

``` text
User
  │
Top Up
  │
Wallet Balance Updated
  │
Transaction Created
  │
Balance Available
```

AI Request

``` text
Request
  │
Validate Wallet
  │
Estimate Minimum Balance
  │
Forward To Provider
  │
Receive Usage
  │
Calculate Final Cost
  │
Deduct Balance
  │
Create Transaction
```

------------------------------------------------------------------------

# 20. Billing Engine

Responsibilities

-   Receive provider usage
-   Convert token usage to internal cost
-   Apply pricing policy
-   Deduct wallet
-   Create transaction
-   Save usage log

Sequence

``` text
Provider Usage
      │
      ▼
Billing Engine
      │
      ├── Pricing
      ├── Wallet
      ├── Transaction
      └── Usage Log
```

Billing must be idempotent.

------------------------------------------------------------------------

# 21. Pricing Engine

Internal Formula

    Provider Cost
    × Markup
    + Service Fee
    = User Cost

Provider cost must NEVER be exposed.

Pricing Modes

-   Percentage
-   Fixed
-   Hybrid

Future Support

-   Promotional pricing
-   Volume discounts
-   Enterprise pricing

------------------------------------------------------------------------

# 22. Transaction System

Transaction Types

-   TOPUP
-   AI_USAGE
-   REFUND
-   ADJUSTMENT
-   ADMIN_CREDIT
-   ADMIN_DEBIT

Fields

-   id
-   wallet_id
-   amount
-   balance_before
-   balance_after
-   currency
-   reference
-   created_at

Transactions are immutable.

------------------------------------------------------------------------

# 23. Usage Accounting

Each request stores

-   user_id
-   api_key_id
-   provider
-   model
-   prompt_tokens
-   completion_tokens
-   total_tokens
-   provider_cost
-   user_cost
-   latency_ms
-   status

Used for:

-   Dashboard
-   Billing
-   Analytics
-   Auditing

------------------------------------------------------------------------

# 24. Idempotency

Every request receives:

    X-Idempotency-Key

Duplicate requests must not create duplicate billing.

Rules

-   Same key
-   Same body
-   Same response

Retention

24 hours

------------------------------------------------------------------------

# 25. Race Condition Prevention

Wallet deduction uses

-   Database transaction
-   Row-level locking
-   Atomic update

Pseudo Flow

``` text
BEGIN

SELECT wallet FOR UPDATE

Check Balance

Deduct

Insert Transaction

Insert Usage

COMMIT
```

Rollback on failure.

------------------------------------------------------------------------

# 26. Refund Strategy

Refund allowed only when

-   Provider failed after billing
-   Internal processing error
-   Manual admin action

Refund creates a new transaction.

Never modify previous transactions.

------------------------------------------------------------------------

# Sprint 4 Status

Completed

-   Wallet Architecture
-   Billing Engine
-   Pricing Engine
-   Transaction System
-   Usage Accounting
-   Idempotency
-   Race Condition Strategy
-   Refund Strategy

Next Sprint

-   User Dashboard
-   Admin Dashboard
-   AI Configuration
-   UI Specification
-   Navigation
-   Permissions
