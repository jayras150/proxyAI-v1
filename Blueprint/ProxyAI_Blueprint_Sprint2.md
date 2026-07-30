# ProxyAI Blueprint v1

# Sprint 2 - Architecture & Data Layer

## 06. System Architecture

### High-Level Architecture

``` text
Client
    │
    ▼
Cloudflare
    │
    ▼
Next.js (API Gateway)
    │
    ├── Authentication Service
    ├── Wallet Service
    ├── Pricing Engine
    ├── AI Configuration
    ├── Provider Adapter
    └── Audit Logger
            │
            ▼
      DeepInfra Provider
            │
            ▼
      DeepSeek Models
```

### Design Principles

-   Stateless API servers
-   Single database (Supabase PostgreSQL)
-   Provider abstraction through adapter pattern
-   Wallet-first billing
-   Streaming-first architecture
-   All business logic on the server

------------------------------------------------------------------------

# 07. Tech Stack

## Frontend

-   Next.js 15
-   React 19
-   TypeScript
-   Tailwind CSS v4
-   shadcn/ui
-   TanStack Query
-   React Hook Form
-   Zod

## Backend

-   Next.js Route Handlers
-   Prisma ORM
-   Supabase PostgreSQL

## Infrastructure

-   Vercel
-   Cloudflare DNS
-   DeepInfra

------------------------------------------------------------------------

# 08. Folder Structure

``` text
src/
├── app/
├── components/
├── actions/
├── server/
│   ├── auth/
│   ├── wallet/
│   ├── billing/
│   ├── providers/
│   ├── ai/
│   └── audit/
├── lib/
├── middleware/
├── prisma/
├── types/
├── utils/
├── config/
└── hooks/
```

Rules

-   UI never contains business logic.
-   Database access only through server layer.
-   Providers are isolated behind adapters.

------------------------------------------------------------------------

# 09. Database Design

## Core Tables

### users

-   id
-   email
-   password_hash
-   role
-   status
-   created_at

### wallets

-   id
-   user_id
-   balance

### api_keys

-   id
-   user_id
-   name
-   key_hash
-   last_used_at
-   status

### transactions

-   id
-   wallet_id
-   amount
-   type
-   reference

### usage_logs

-   id
-   user_id
-   model
-   prompt_tokens
-   completion_tokens
-   total_tokens
-   cost

### audit_logs

-   id
-   admin_id
-   action
-   before_value
-   after_value
-   ip_address
-   created_at

### ai_models

Stores enabled models and pricing metadata.

### ai_configurations

Stores prompts and runtime configuration.

------------------------------------------------------------------------

# 10. Entity Relationship

users │ ├── wallets (1:1) ├── api_keys (1:N) ├── usage_logs (1:N) └──
sessions (1:N)

wallets └── transactions (1:N)

ai_models └── usage_logs (1:N)

------------------------------------------------------------------------

# 11. Prisma Planning

Relationships

-   User owns one wallet.
-   User owns many API keys.
-   User creates many usage logs.
-   Wallet has many transactions.
-   AI model is referenced by usage logs.

Indexes

-   email
-   api_key_hash
-   transaction_reference
-   usage_created_at
-   audit_created_at

Constraints

-   Email unique
-   API key unique
-   Wallet unique per user
-   Immutable audit log records

------------------------------------------------------------------------

## Sprint 2 Status

Completed

-   System Architecture
-   Tech Stack
-   Folder Structure
-   Database Design
-   ER Planning
-   Prisma Planning

Next Sprint

-   OpenAI Compatible API
-   Provider Adapter
-   Streaming
-   Request Lifecycle
-   Billing Flow
