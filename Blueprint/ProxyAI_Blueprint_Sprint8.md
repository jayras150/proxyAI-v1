# ProxyAI Blueprint V2

# Sprint 8 - Complete Prisma Schema & Data Dictionary

# 51. Database Design Principles

Objectives

-   Normalize transactional data.
-   Prevent duplicate billing.
-   Keep immutable financial history.
-   Support future multi-provider expansion.

Rules

-   UUID primary keys.
-   `created_at` and `updated_at` on mutable tables.
-   Soft delete only where appropriate.
-   Financial and audit records are immutable.

------------------------------------------------------------------------

# 52. Prisma Schema (Core)

``` prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  passwordHash String
  role        Role
  status      UserStatus
  wallet      Wallet?
  apiKeys     ApiKey[]
  sessions    Session[]
  usageLogs   UsageLog[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Wallet {
  id          String @id @default(uuid())
  userId      String @unique
  balance     Decimal @db.Decimal(18,6)
  currency    String
  user        User @relation(fields:[userId], references:[id])
  transactions Transaction[]
}
```

Continue remaining models following the same conventions: - ApiKey -
Transaction - UsageLog - AuditLog - Session - TotpSecret - AiModel -
AiConfiguration - Setting

------------------------------------------------------------------------

# 53. Data Dictionary

## users

  Column          Type   Description
  --------------- ------ ----------------------------
  id              UUID   Primary key
  email           TEXT   Unique login email
  password_hash   TEXT   Password hash
  role            ENUM   USER / ADMIN / SUPER_ADMIN
  status          ENUM   ACTIVE / SUSPENDED

## wallets

  Column     Type      Description
  ---------- --------- -------------------
  id         UUID      Wallet identifier
  user_id    UUID      Owner
  balance    DECIMAL   Current balance
  currency   TEXT      Currency code

## api_keys

  Column         Description
  -------------- -----------------------------
  key_hash       SHA-256/Argon2 hashed key
  last_used_at   Last successful request
  status         ACTIVE / DISABLED / REVOKED

------------------------------------------------------------------------

# 54. Entity Relationships

``` text
User
 ├── Wallet (1:1)
 ├── ApiKeys (1:N)
 ├── Sessions (1:N)
 └── UsageLogs (1:N)

Wallet
 └── Transactions (1:N)

AiModel
 └── UsageLogs (1:N)
```

------------------------------------------------------------------------

# 55. Database Constraints

-   Email unique.
-   Wallet unique per user.
-   API key hash unique.
-   Transaction reference unique.
-   Audit logs append-only.

------------------------------------------------------------------------

# 56. Index Strategy

Recommended indexes

-   users(email)
-   api_keys(key_hash)
-   usage_logs(created_at)
-   usage_logs(user_id, created_at)
-   transactions(wallet_id, created_at)
-   audit_logs(created_at)

------------------------------------------------------------------------

# 57. Migration Strategy

1.  Create base tables.
2.  Create foreign keys.
3.  Create indexes.
4.  Seed default models.
5.  Seed system settings.
6.  Create admin account.
7.  Verify integrity.

Migration Rules

-   Never modify production data manually.
-   Every schema change requires a migration.
-   Test migrations before deployment.

------------------------------------------------------------------------

# Sprint 8 Status

Completed

-   Prisma schema foundation
-   Data dictionary
-   Relationship mapping
-   Constraints
-   Index strategy
-   Migration strategy

Next Sprint

-   Complete OpenAPI 3.1 Specification
-   JSON Schemas
-   Authentication API
-   Chat API
-   Wallet API
-   Admin API
