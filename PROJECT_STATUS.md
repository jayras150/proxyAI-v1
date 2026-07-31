# ProxyAI Project Status

Last Updated: 2026-07-31

Commit: `271cf1d` — feat(billing): add pure usage meter with provider adapters

## Overall Progress

Project Status: 🚧 In Development

Completion: 54%

Current Phase:
- Billing Engine — Milestone 4 (Usage Meter) ✅ COMPLETED

---

# Current Objectives

1. ✅ Build Authentication (blueprint compliant + architecture cleanup)
2. ✅ Build Wallet System — APPROVED FOR PRODUCTION BACKEND (closed 2026-07-31)
3. 🔄 Build Billing Engine (M1 ✅, M2 ✅, M3 ✅, M4 ✅ — M5 ChargeService berikutnya, belum dimulai)
4. 🔄 OpenAI Compatible API
5. 🔄 User Dashboard
6. 🔄 Admin Dashboard

---

# Completed

## Documentation

- [x] PRD
- [x] Architecture Blueprint
- [x] API Blueprint
- [x] Security Blueprint
- [x] Deployment Blueprint

## Infrastructure

- [x] GitHub Repository
- [x] Vercel Connected
- [x] Supabase Created
- [x] DeepInfra Account

## Authentication Module — Phase 1 (2026-07-31)

- [x] Next.js 15 project initialized (TypeScript, App Router, Tailwind CSS v4)
- [x] Prisma schema — User, Session, ApiKey, Wallet, Transaction, UsageLog, AuditLog, AiModel, AiConfiguration
- [x] Prisma Client generated (v6)
- [x] Password hashing with bcrypt (12 salt rounds)
- [x] JWT access + refresh tokens with rotation
- [x] Crypto utilities (API key generation, SHA-256 token hashing)
- [x] Zod validation schemas (register, login, refresh, createApiKey)
- [x] Auth server layer — register, login, refresh, logout
- [x] API Key server layer — create, list, revoke
- [x] API routes:
  - POST /api/auth/register
  - POST /api/auth/login
  - POST /api/auth/refresh
  - POST /api/auth/logout
  - POST /api/auth/logout-all
  - GET /api/auth/me
  - GET /api/api-keys
  - POST /api/api-keys
  - DELETE /api/api-keys/:id
- [x] Client-side AuthContext (login, register, logout, logoutAll, session restore)
- [x] Login page (/login)
- [x] Register page (/register)
- [x] Dashboard shell with auth guard
- [x] API Key management UI (create, list, revoke)
- [x] Verify TypeScript compilation
- [x] Verify lint passes (0 errors, 0 warnings)
- [x] Verify production build passes

## Security Hardening (2026-07-31 — self review fixes)

- [x] Tokens moved from localStorage to HttpOnly Secure cookies
  - Cookie names: proxyai_access, proxyai_refresh
  - SameSite=Lax, Secure in production, HttpOnly always
  - Tokens never returned in response body
- [x] Refresh tokens no longer stored plaintext — SHA-256 hash only
  - Schema: Session.refreshToken → Session.refreshTokenHash
  - Verification looks up by hash
- [x] Logout revokes ONLY the current session (by refresh cookie hash)
  - Added POST /api/auth/logout-all for revoking all sessions
- [x] Removed all `as any` (JWT expiresIn now numeric seconds)
- [x] All lint errors fixed (react-hooks set-state-in-effect, immutability, no-explicit-any, unused vars)
- [x] TypeScript errors fixed
- [x] npm run lint: ✅ 0 errors, 0 warnings
- [x] npm run build: ✅ success

## Final Verification (2026-07-31 — passed)

- [x] Source code verified directly (not just plan): cookies.ts, logout.ts, me route, logout-all route, hashToken usage confirmed in register/login/refresh
- [x] HttpOnly cookie config confirmed (httpOnly, secure in prod, sameSite=lax)
- [x] Refresh token SHA-256 hashed at rest (schema + all services)
- [x] Logout revokes only active session; logout-all separate endpoint
- [x] GET /api/auth/me and POST /api/auth/logout-all verified in source and build output
- [x] npx prisma generate: ✅ success
- [x] npm run lint: ✅ 0 errors, 0 warnings
- [x] npm run build: ✅ success (14 routes)
- [x] No TODO, FIXME, console.log, unnecessary any, hardcoded secrets, or localStorage for auth
- [x] Committed: `f22a17a` feat(auth): implement secure authentication module
- [x] Pushed to origin/main


## Blueprint Compliance Implementation (2026-07-31)

### request_id (§59)

- [x] src/lib/request-id.ts — generateRequestId() (req_<uuid>)
- [x] src/lib/api-response.ts — jsonSuccess/jsonError: request_id di body + header X-Request-Id
- [x] Semua 9 route refactored ke helper baru (types/api.ts helper lama dihapus)

### Rate Limiting (§67) — abstraction layer

- [x] src/lib/rate-limit/types.ts — interface RateLimiter { limit(key, limit, windowSeconds) }
- [x] src/lib/rate-limit/memory-rate-limiter.ts — MemoryRateLimiter (development)
- [x] src/lib/rate-limit/redis-rate-limiter.ts — RedisRateLimiter (production, Upstash Redis, INCR+EXPIRE)
- [x] src/lib/rate-limit/index.ts — factory by env (RATE_LIMITER_DRIVER, default redis di production bila UPSTASH ada)
- [x] src/lib/rate-limit/helpers.ts — getClientIp, buildRateLimitKey, rateLimitHeaders, enforceRateLimit (route-agnostic)
- [x] src/config/rate-limits.ts — policies: authPublic 60/min, authAuthenticated & apiKeys 300/min
- [x] Header X-RateLimit-Limit / X-RateLimit-Remaining / Retry-After; error code RATE_LIMITED (429)
- [x] Verified: 65 requests → 60 processed, 5× 429 dengan headers benar

### Security Headers (§38)

- [x] next.config.ts headers(): CSP, X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, HSTS (production only)
- [x] Verified via live curl: semua header hadir di response

### Verification

- [x] npx prisma generate ✅
- [x] npm run lint: ✅ 0 errors, 0 warnings
- [x] npm run build: ✅ success (14 routes)
- [x] Smoke test rate limiter + api-response ✅

## Architecture Review Cleanup — R1-R4 (2026-07-31)

- [x] R1 — Dead code removed: src/middleware/auth.ts dihapus; satu pola auth helper: src/lib/auth-request.ts (getAuthenticatedUser) dipakai semua protected route
- [x] R2 — Mapping User→UserProfile di-extract: src/lib/user-profile.ts (toUserProfile + userProfileSelect), dipakai register/login/refresh/me
- [x] R3 — Create session di-extract: src/server/auth/session.ts (createSession, sessionExpiresAt, refreshTokenLifetimeMs), dipakai register/login/refresh
- [x] R4 — Satu sumber refresh token lifetime: constants.ts dihapus; semua membaca env.refreshExpiresInDays (cookie & session konsisten)
- [x] Tidak ada perubahan perilaku API (verified live: 401 + request_id + rate-limit headers sama; 65 req → 60 diproses + 5× 429)
- [x] npm run lint: ✅ 0 errors / npm run build: ✅ success

### Technical Debt (R5-R9, deferred)

- [ ] R5 — Pindah ms() ke lib/time.ts (jwt.ts & cookies.ts pakai bersama)
- [ ] R6 — RedisRateLimiter retryAfterSeconds akurat via redis.ttl()
- [ ] R7 — Hapus unused type exports di validation.ts
- [ ] R8 — Extract isJwtError() helper
- [ ] R9 — Pindah prisma CLI ke devDependencies

## Wallet System — Milestone 1: Database Foundation (2026-07-31)

### Prisma Schema (Wallet Domain)

- [x] Enums: Currency, WalletStatus, TransactionType, TransactionStatus, TopupStatus, PaymentProvider, IdempotencyStatus, WebhookEventStatus
- [x] Wallet: + status (WalletStatus), + version (optimistic locking), currency → enum, @@index([userId, status])
- [x] Transaction: status → enum, + audit metadata (requestId, userId denormalized, providerReference, createdBy, ipAddress, userAgent), @@index([walletId, createdAt, id]) cursor pagination
- [x] TopupRequest: status lifecycle (PENDING/PAID/FAILED/EXPIRED), provider enum, providerReference @unique, transactionId @unique (1:1), expiresAt required
- [x] IdempotencyKey: @@unique([key, scope, userId]), requestHash, response Json, expiresAt
- [x] WebhookEvent: @@unique([provider, providerEventId]), payloadHash, status lifecycle

### Migration

- [x] prisma/migrations/20260731150000_wallet_foundation/migration.sql (generated via prisma migrate diff)
- [x] CHECK constraints documented as SQL (Prisma tidak support native): wallets_balance_non_negative, transactions_amount_positive, topup_requests_amount_positive
- [x] migration_lock.toml (postgresql)
- ⚠️ Migration belum di-apply ke database live — butuh Supabase DATABASE_URL (env placeholder localhost saat ini)

### Repository Layer (interface only)

- [x] src/server/wallet/wallet.repository.ts
- [x] src/server/transactions/transaction.repository.ts
- [x] src/server/topup/topup-request.repository.ts
- [x] src/server/idempotency/idempotency-key.repository.ts
- [x] src/server/webhooks/webhook-event.repository.ts
- [x] Arsitektur Route → Service → Repository → Prisma (service belum dibuat — Milestone 2)

### Verification

- [x] prisma validate / format: ✅
- [x] prisma generate: ✅
- [x] tsc --noEmit: ✅
- [x] npm run lint: ✅ 0 errors, 0 warnings
- [x] npm run build: ✅ success

### Self Review (audit)

- [x] Tidak ada duplicate model
- [x] Tidak ada missing index (semua query path ter-index)
- [x] Tidak ada circular relation
- [x] Tidak ada nullable yang seharusnya required (expiresAt → required di self review)
- [x] Tidak ada relation ambigu (Transaction ↔ TopupRequest 1:1 via transactionId unique)
- [x] Tidak ada enum yang tidak terpakai (semua 8 enum ter-referensi)
- [x] userId di Transaction/TopupRequest sengaja denormalized (audit immutable, tanpa FK) — sesuai Design Review §10

> ✅ Milestone 1 COMPLETED — lihat ringkasan closure di bawah.

## Wallet System — Milestone 2: Wallet Core (2026-07-31)

### Implemented

- [x] Money Value Object (src/lib/money.ts) — Decimal only, currency-aware, add/subtract/compare, strict positive, string serialization 6dp
- [x] Structured logger (src/lib/logger.ts) — JSON, no console.log in business code
- [x] Domain events (src/server/events/) — DomainEvent types (wallet.credited/debited, topup.completed, refund.completed), LocalEventDispatcher, createDomainEvent; emitted ONLY after DB commit; errors in listeners logged not thrown
- [x] TransactionManager (src/server/db/transaction-manager.ts) — Unit of Work abstraction (Prisma impl), service never touches Prisma
- [x] PrismaWalletRepository — atomic credit (increment), atomic conditional debitIfSufficient (decrement where balance >= amount), status update, version increment
- [x] PrismaTransactionRepository — immutable create, keyset pagination (createdAt DESC, id DESC, limit+1 hasMore)
- [x] WalletService — getWallet, atomic credit, atomic debit, validateBalance; business rules: DB tx, no negative balance, every change → Transaction, currency match, events after commit
- [x] TransactionService — cursor history (opaque cursor encode/decode, limit clamp 1-100, hasMore/nextCursor)
- [x] WalletError codes: WALLET_NOT_FOUND, WALLET_SUSPENDED, WALLET_LOCKED, INSUFFICIENT_BALANCE, CURRENCY_MISMATCH, INVALID_AMOUNT

### Business Rules enforced

- [x] Semua operasi finansial dalam DB transaction (withTransaction)
- [x] Saldo tidak pernah negatif (conditional atomic decrement + CHECK constraint lapis-2)
- [x] Credit & debit atomic (increment / updateMany where balance >= amount)
- [x] Setiap perubahan saldo → Transaction immutable (balanceBefore/balanceAfter/audit metadata)
- [x] Money Decimal, tidak pernah number
- [x] Currency transaction == currency wallet (CURRENCY_MISMATCH guard)
- [x] Domain events hanya setelah commit sukses (emit setelah withTransaction resolve)

### Verification

- [x] Unit test: 34 passed (money 10, event-dispatcher 5, wallet.service 13 incl. concurrency, transaction.service 6)
- [x] Concurrency review: two parallel debits on shared balance → exactly 1 succeeds, balance never negative (tested)
- [x] prisma generate ✅ / tsc ✅ / lint ✅ 0/0 / build ✅

### Self Review

- [x] Service tidak menyentuh Prisma (hanya repository + TransactionManager)
- [x] Tidak ada console.log / as any / TODO / FIXME
- [x] Fix ditemukan via test: decimal.js isPositive(0)=true → strict greaterThan(0); nextCursor null saat hasMore=false

> ✅ Milestone 2 COMPLETED.

## Wallet System — Milestone 3: Topup & Payment Services (2026-07-31)

### Implemented

- [x] PaymentProvider abstraction (src/server/payments/provider.ts) — createPayment() + verifyWebhook() only; wallet/topup tidak tahu implementasi
- [x] MockProvider (mock-provider.ts) — payment intent, checkout URL/token, expiresAt, unique providerReference, webhook simulation, HMAC-SHA256 signature gen+verify (timing-safe)
- [x] PaymentService (payment.service.ts) — orchestrasi provider selection, payment intent, webhook verification, mapping ke domain; tanpa business logic wallet
- [x] TopupService (topup.service.ts) — createTopup/getTopup/markPaid/markFailed/markExpired; wallet tidak berubah saat create
- [x] IdempotencyService (idempotency.service.ts) — reserve/complete/replay; hash request divalidasi; expired cleanup; 24h TTL; scope-aware
- [x] WebhookService (webhook.service.ts) — signature verify, replay protection (unique provider+eventId), payload hash, dedupe, amount/currency check, satu transaksi: credit wallet + mark PAID + mark processed, emit event setelah commit
- [x] Repository impls: PrismaTopupRequestRepository, PrismaIdempotencyKeyRepository, PrismaWebhookEventRepository
- [x] WalletService refactor: creditInTransaction/debitInTransaction (untuk komposisi dalam satu transaksi, hindari nested tx)
- [x] crypto helpers: sha256Hex public, canonicalJsonHash, hmacSha256Hex, timingSafeEqualHex
- [x] Env: PAYMENT_PROVIDER, MOCK_PAYMENT_WEBHOOK_SECRET, TOPUP_EXPIRY_MINUTES

### Topup Flow

```
POST topup (M4) → validate (amount>0, wallet ACTIVE, currency) →
  create TopupRequest(PENDING, expiry 30m) → PaymentService.createPayment →
  store providerReference → return payment intent (checkout URL/token)
```

### Payment Flow (webhook)

```
Webhook → PaymentService.verifyWebhook (HMAC signature) →
  WebhookEvent dedupe (provider+eventId unique) →
  find TopupRequest by providerReference → validate amount & currency →
  DB tx: WalletService.creditInTransaction + TopupService.markPaid + markProcessed →
  emit topup.completed AFTER commit
```

### Webhook Flow (replay protection)

```
Delivery #1 → RECEIVED → processed → PROCESSED (+credit sekali)
Delivery #2 (sama) → duplicate → ack tanpa credit
Concurrent #2 → unique constraint (P2002) → detect → duplicate/ignored
Forged (bad HMAC) → INVALID_SIGNATURE → reject
```

### State Transition (eksplisit)

```
PENDING → PAID | FAILED | EXPIRED   (satu arah)
PAID/FAILED/EXPIRED → [none]        (tidak ada transisi keluar)
```

### Domain Events (setelah commit)

- topup.completed: requestId, correlationId, walletId, userId, transactionId, topupId, provider, providerReference, amount, currency
- topup.failed: sama (tanpa transactionId)
- wallet.credited (dari WalletService) tetap setelah commit

### Verification

- [x] Unit test 64 passed (money 10, dispatcher 5, wallet 13, transaction 6, mock-provider 7, topup 9, idempotency 5, webhook 9)
- [x] Integration: full payment flow, replay, forged signature, amount/currency mismatch, FAILED status, unknown reference
- [x] Concurrency: 2 parallel deliveries → tepat 1 credit (snapshot rollback tx manager)
- [x] prisma generate ✅ / tsc ✅ / lint ✅ 0/0 / build ✅

> ✅ Milestone 3 COMPLETED.

## Wallet System — Milestone 4: API Layer (2026-07-31)

### OpenAPI 3.1

- [x] openapi/v1.yaml — 5 endpoints, schemas (Money string, ErrorEnvelope, WalletResponse, TransactionPage, TopupResponse, PaymentIntent, WebhookAck), securitySchemes (bearerAuth JWT + webhookSignature HMAC), responses incl. RateLimited headers, examples
- [x] OpenAPI validation test (7 assertions: 3.1, endpoints, security, envelopes, money-as-string)

### Wallet API

- [x] GET /api/v1/wallet — balance/currency/status (JWT)
- [x] GET /api/v1/wallet/transactions — cursor pagination (JWT, Zod query)
- [x] POST /api/v1/wallet/topups — create topup + payment intent (JWT + X-Idempotency-Key, Zod body)
- [x] GET /api/v1/wallet/topups/:id — status polling (JWT, owner-scoped)
- [x] POST /api/v1/webhooks/payments — signature-auth (HMAC header, bukan JWT)

### API Layer Properties

- [x] Response contract: success/data/request_id + error/code/message/details (jsonError nested form, global)
- [x] Zod validation semua request (createTopupSchema, transactionsQuerySchema, topupQuerySchema) — tidak ada parsing manual
- [x] Authorization: user hanya lihat wallet/transaksi/topup sendiri (userId dari token)
- [x] Error mapping terpusat (src/lib/api-error-mapper.ts): WalletLocked→423, InsufficientBalance→409, CurrencyMismatch→400, Idempotency→409, InvalidSignature→401, dll
- [x] Rate limiting per-endpoint: walletRead 300/min, walletTopup 60/min, webhookPayments 1200/min
- [x] Structured logging semua request: request_id, correlation_id, user_id, wallet_id, topup_id, transaction_id, provider, status_code, duration_ms
- [x] Composition root (src/server/composition.ts) — route tidak membangun service
- [x] API hanya adapter: tidak ada business logic/Prisma di route (grep-verified)

### Verification

- [x] API tests: wallet route (auth 401, balance string, 404, cursor, validation), topup route (idempotency, validation, auth), webhook route (end-to-end credit, forged 401)
- [x] OpenAPI validation: 7/7
- [x] npm test: 85 passed
- [x] prisma generate ✅ / tsc ✅ / lint ✅ 0/0 / build ✅ (5 v1 routes)

> ✅ Milestone 4 COMPLETED.

## Wallet System — Production Readiness Fixes (2026-07-31)

### FIX P1 — Expired Payment Protection (CRITICAL)

- [x] WebhookService: guard `now > topup.expiresAt` SEBELUM credit — tidak pernah kredit, tidak membuat Transaction
- [x] Status → EXPIRED (konsisten dengan state machine), WebhookEvent → processed, ack ke provider (tidak redeliver)
- [x] TopupRequestRepository.markExpired (conditional PENDING-only, race-safe) + TopupService.markExpiredInTransaction
- [x] Event topup.failed di-emit (setelah commit)
- [x] Tests: sebelum expiresAt → credit ✅; sesudah expiresAt → no credit + EXPIRED ✅; replay sesudah expired → no credit ✅; FAILED webhook untuk expired topup → EXPIRED preserved ✅

### FIX P2 — Authenticated Rate Limit Identity

- [x] Endpoint authenticated (wallet, transactions, topups GET/POST, api-keys) sekarang keyed by **userId** (JWT subject)
- [x] Priority: userId → (future) API key ID → fallback IP
- [x] Abstraction `enforceRateLimit(request, { identity })` tetap reusable — tidak terikat JWT; route yang memutuskan identity
- [x] api-keys routes di-refactor ke mapApiError (konsisten dengan v1)
- [x] Tests: bucket per-user independen ✅; scope terpisah ✅; IP fallback ✅

### No Breaking Change

- [x] OpenAPI tetap valid (tidak ada perubahan contract)
- [x] Response/request contract tidak berubah

### Verification

- [x] npm test: 93 passed (bertambah 8: 4 expired payment + 4 rate limit identity)
- [x] prisma generate ✅ / tsc ✅ / lint ✅ 0/0 / build ✅

### Status

- [x] Wallet: **APPROVED FOR PRODUCTION BACKEND**

## Wallet Module — OFFICIAL CLOSURE (2026-07-31)

**Status: ✅ APPROVED FOR PRODUCTION BACKEND**

**Completion Date:** 2026-07-31

### Milestone Summary

| Milestone | Deliverables | Status | Tests |
|---|---|---|---|
| M1 — Database Foundation | Prisma schema (Wallet, Transaction, TopupRequest, IdempotencyKey, WebhookEvent, 8 enums), migration + CHECK SQL, repository interfaces | ✅ | — |
| M2 — Wallet Core | Money VO, WalletService (atomic credit/debit/validate), TransactionService (cursor), domain events, repository impls | ✅ | 34 |
| M3 — Topup & Payment Services | PaymentProvider abstraction, MockProvider, PaymentService, TopupService, IdempotencyService, WebhookService | ✅ | 64 |
| M4 — API Layer | openapi/v1.yaml, 5 endpoint /api/v1, Zod validation, error mapping, rate limit, structured logging | ✅ | 85 |
| Production Readiness Review | 10-task audit: E2E, state machine, failure scenarios, security, performance, observability, architecture, tests, tech debt, docs | ✅ | — |
| Production Fixes | P1 expired payment protection, P2 per-user rate limit identity | ✅ | 93 |

### Production Readiness Review Summary (2026-07-31)

- Score: **86/100** (Arch 90, Security 86, Maintainability 88, Scalability 82, Performance 92, Testability 84)
- Strengths: layering bersih (Route→Service→Repository→Prisma), atomic financial ops, webhook replay protection, cursor pagination, provider abstraction
- Verdict: **APPROVED FOR FRONTEND IMPLEMENTATION** → setelah fix P1/P2 → **APPROVED FOR PRODUCTION BACKEND**

### Production Bugs Fixed

- [x] **P1 (Critical):** webhook bisa mengkredit wallet setelah TopupRequest melewati expiresAt — kini: no credit, status EXPIRED, WebhookEvent processed, ack provider (4 test)
- [x] **P2:** rate limit authenticated keyed by IP (shared bucket di belakang NAT) — kini keyed by userId (priority: userId → API key → IP fallback) (4 test)

### Open Items (bukan blocker)

- Migration belum di-apply ke DB live (butuh Supabase credentials — prisma migrate deploy saat deploy)
- R5-R10 tech debt tercatat di TODO_PROJECT.md (non-blocking)
- M5 UI (dashboard/topup/transactions) = task terpisah, belum dijadwalkan

---

## Billing Engine — DESIGN LOCKED (2026-07-31)

**Status: 📘 APPROVED FOR IMPLEMENTATION**

Design terkunci — tidak akan diubah sebelum implementasi dimulai.

### Artefak Desain

- [x] Billing Design Review v1 (arsitektur, DB, domain, API, sequence, state machine, failure, security, scalability, plan)
- [x] Billing Design Review v2 (10 revisi: service separation, pricing snapshot, streaming lifecycle, reserve decision, pricing versioning, refund state machine, domain events, sequence diagrams, wallet debit strategy, final architecture review)
- [x] ADR-0001 Controlled Negative Balance (docs/adr/0001-controlled-negative-balance.md, commit f598810)
- [x] Final Design Polish (business policy vs integrity rule; ownership PAYMENT_REQUIRED system-generated)

### Keputusan Arsitektur Kunci (locked)

- Service: PricingEngine / EstimateService / ChargeService / RefundService / UsageMeter — tanpa god service
- Debit: **post-paid (opsi A)** — debit setelah provider selesai
- Reserve: **tidak ada di V1** (opsi A) — B/C di V2
- Pricing: tabel **PricingVersion** (AiModel 1—N) + snapshot wajib di UsageLog
- Negative balance: business policy `WALLET_MAX_NEGATIVE_BALANCE` (env, default 0.10 USD) — ditegakkan WalletService (conditional atomic), bukan CHECK constraint
- Status `PAYMENT_REQUIRED`: system-generated (hanya WalletService debit/credit), bukan administratif
- Streaming: billing tidak pernah blokir stream; billing tidak bergantung koneksi client

### Perubahan Wallet yang dibutuhkan saat implementasi (tercatat, belum dikerjakan)

- [ ] DROP CHECK constraint `wallets_balance_non_negative` (migration) → enforcement di WalletService
- [ ] `enum WalletStatus` + `PAYMENT_REQUIRED`
- [ ] `WalletService.debitWithFloor` + reaktivasi otomatis di credit

---

## Billing Engine — Milestone 1: Database Foundation & Domain Model (2026-07-31)

- [x] Schema: PricingVersion, RefundRequest, UsageLog (UsageStatus enum + pricing snapshot + currency + cachedTokens), AiModel (price → PricingVersion), WalletStatus.PAYMENT_REQUIRED
- [x] Enums: UsageStatus, RefundStatus, PricingVersionStatus
- [x] Value objects: TokenUsage, PricingSnapshot, CostBreakdown (pure)
- [x] Repository interfaces: PricingRepository, UsageRepository, RefundRepository
- [x] Migration 20260731190000_billing_foundation + DROP CHECK wallets_balance_non_negative (ADR-0001)
- [x] Verification: 104 tests, lint ✅, build ✅, prisma validate/generate ✅

> ✅ Milestone 1 COMPLETED — lihat TODO_PROJECT untuk detail.

## Billing Engine — Milestone 3: Estimate Service (2026-07-31)

### EstimateService (read-only)

- [x] src/server/billing/estimate.service.ts — estimate(): load PricingVersion aktif → build PricingSnapshot → PricingEngine.calculate() → read wallet balance → floor policy
- [x] TIDAK pernah: debit, transaction, usage log, provider call, event — read-only (verified)
- [x] Menggunakan PricingEngine (bukan pricing engine sendiri)

### Business Rule (ADR-0001)

- [x] estimatedBalance = balance - estimatedCost
- [x] canProceed = estimatedBalance >= -WALLET_MAX_NEGATIVE_BALANCE (env, default 0.10)
- [x] Wallet status gate: PAYMENT_REQUIRED / LOCKED / SUSPENDED → tolak (reason eksplisit)
- [x] Custom floor override per-call (maxNegativeBalance)

### Error Domain

- [x] PRICING_NOT_FOUND (throw) / WALLET_NOT_FOUND (throw) / CURRENCY_MISMATCH (throw) / INSUFFICIENT_BALANCE (canProceed=false + reason) / ESTIMATE_FAILED (fallback)

### Schema

- [x] PricingVersion + currency column (migration M1 di-update — belum di-apply live)
- [x] env WALLET_MAX_NEGATIVE_BALANCE

### Test Coverage (14 test baru)

- [x] pricing ditemukan / tidak ditemukan / ACTIVE window selection / snapshot benar
- [x] wallet ditemukan / tidak ditemukan / saldo cukup / negatif dalam floor / melewati floor / custom floor
- [x] PAYMENT_REQUIRED / LOCKED / SUSPENDED / CURRENCY_MISMATCH
- [x] deterministic / service fee override

### Verification

- [x] npm test: 133 passed / tsc ✅ / lint ✅ 0/0 / build ✅
- [x] Tidak ada operasi Money manual (semua via Money VO)
- [x] Tidak ada write DB / transaction / event

## Billing Engine — Milestone 2: Pricing Engine (2026-07-31)

### PricingEngine (pure domain service)

- [x] src/server/billing/pricing-engine.ts — calculate(): deterministic, stateless, zero dependency (Prisma/DB/HTTP/provider/repository)
- [x] Input: PricingSnapshot, TokenUsage, optional serviceFee override, optional minimumCharge override
- [x] Output: CostBreakdown { providerCost, markupCost, serviceFee, subtotal, totalCost, currency }
- [x] Semua operasi uang melalui Money VO (multiply/divide/floorTo/max ditambahkan)

### Formula (terdokumentasi)

```
inputCost  = inputPrice  × promptTokens     / 1_000_000
outputCost = outputPrice × completionTokens / 1_000_000
cachedCost = inputPrice  × cachedTokens     / 1_000_000   (V1: input rate)
providerCost = input + output + cached
markupCost   = providerCost × markupPercent / 100
subtotal     = providerCost + markupCost
total        = subtotal + serviceFee  → floor 6dp → max(minCharge)
```

### Money Review

- [x] Money refactor: Prisma.Decimal → decimal.js murni (domain zero Prisma — verified grep: hanya komentar)
- [x] Money.multiply / divide / floorTo (ROUND_DOWN) / max ditambahkan
- [x] CurrencyCode union domain (bukan Prisma enum) — structurally identical
- [x] Boundary conversion di src/lib/prisma.ts (moneyToPrisma, prismaToDecimal, prismaToMoney) — repository/DB layer saja
- [x] Wallet/Topup/Webhook services di-update ke boundary conversion (perilaku tidak berubah — semua test Wallet tetap lulus)

### Rounding Policy (satu kebijakan, seluruh billing)

- [x] Floor (ROUND_DOWN) ke 6 desimal, diterapkan SEKALI pada total akhir — tidak pernah overcharge
- [x] Komponen antara full precision (tanpa early rounding)
- [x] Minimum charge default $0.000001 (business policy, override per-call)

### Test Coverage (15 test baru)

- [x] input only / output only / mixed / cached / zero token (min charge)
- [x] minimum charge raise / service fee override / markup 0
- [x] rounding floor (never overcharge) / intermediate full precision
- [x] high precision / large request 100M tokens / deterministic
- [x] currency mismatch (service fee, minimum charge)

### Verification

- [x] npm test: 119 passed (15 pricing + 11 M1 domain + 93 existing)
- [x] tsc ✅ / lint ✅ 0/0 / build ✅
- [x] Domain billing zero dependency Prisma (grep-verified)

---

### Database Schema

- [x] `enum WalletStatus` + `PAYMENT_REQUIRED` (system-generated, ADR-0001)
- [x] `enum UsageStatus` { PENDING, COMPLETED, FAILED, REFUNDED }
- [x] `enum RefundStatus` { REQUESTED, APPROVED, REJECTED, COMPLETED, FAILED, CANCELLED }
- [x] `enum PricingVersionStatus` { ACTIVE, ARCHIVED }
- [x] `PricingVersion` (modelId, version, inputPrice, outputPrice, markupPercent, serviceFee, effectiveFrom/To, status) — unique [modelId, version], index [modelId, status]
- [x] `UsageLog` diperbarui: status → enum, +cachedTokens, +currency, +pricingVersionId, +pricing snapshot (inputPrice, outputPrice, markupPercent, serviceFee), index [requestId] & [pricingVersionId]
- [x] `RefundRequest` (userId, usageLogId unique, amount, currency, status, requestedBy/approvedBy/rejectedBy, transactionId unique, audit fields) — FK usageLog Restrict
- [x] `AiModel` — price fields dipindah ke PricingVersion (tidak ada kode yang memakai field lama — verified)
- [x] `Transaction` — relasi refundRequest 1:1 (transactionId unique)

### Migration

- [x] `prisma/migrations/20260731190000_billing_foundation/migration.sql` — increment diff dari schema Wallet (bukan from-empty)
- [x] DROP CONSTRAINT `wallets_balance_non_negative` (ADR-0001: business policy, bukan DB integrity — env WALLET_MAX_NEGATIVE_BALANCE)
- [x] Migration aman untuk upgrade: tidak merusak data existing, enum additive, kolom baru nullable/defaulted
- ⚠️ Belum di-apply ke DB live (butuh Supabase credentials — prisma migrate deploy saat deploy)

### Value Objects (pure, tanpa dependency database)

- [x] `src/server/billing/token-usage.ts` — TokenUsage (prompt/completion/cached, add merge, validasi non-negatif integer)
- [x] `src/server/billing/pricing-snapshot.ts` — PricingSnapshot (pricingVersionId, input/output price, markup, serviceFee, currency guard, toPersistence)
- [x] `src/server/billing/cost-breakdown.ts` — CostBreakdown (providerCost + userCost, currency guard)
- [x] Money (existing, reuse)

### Repository Interfaces (interface only)

- [x] `src/server/pricing/pricing.repository.ts` — findActiveByModelId, findById, findByModelId, create, archive
- [x] `src/server/usage/usage.repository.ts` — create, findById, findByRequestId, findByUserIdPaginated, updateStatus, markRefunded
- [x] `src/server/refund/refund.repository.ts` — create, findById, findByUsageLogId, findByUserIdPaginated, updateStatus (optimistic version), markCompleted
- [x] `src/server/transactions/transaction.repository.ts` — review: type pagination digeneralisasi (Cursor/Page di src/server/db/pagination.ts)
- [x] Arsitektur Route → Service → Repository → Prisma dipertahankan

### Validation Review

- [x] Unique: [modelId, version] pricing, [usageLogId] refund, [transactionId] refund, reference transaction
- [x] FK: pricing→aiModel (Cascade), usage→pricingVersion (SetNull), refund→usageLog (Restrict), refund→transaction (SetNull)
- [x] Optimistic locking: RefundRequest.updateStatus dengan expectedVersion
- [x] Decimal precision: price (10,6), money (18,6), providerCost (18,10), markup (5,2), serviceFee (18,6)
- [x] Audit field: createdAt/updatedAt lengkap; immutable UsageLog & Transaction (tanpa update path kecuali status)
- [x] Soft delete: tidak dipakai (financial records immutable)

### Verification

- [x] prisma validate / format: ✅
- [x] prisma generate: ✅
- [x] tsc --noEmit: ✅
- [x] npm run lint: ✅ 0 errors, 0 warnings
- [x] npm run build: ✅
- [x] npm test: ✅ 104 passed (11 baru: token-usage 4, pricing-snapshot 4, cost-breakdown 3)
- [x] Tidak ada konflik dengan Wallet (semua test Wallet tetap lulus)

## Billing Engine — Milestone 4: Usage Meter (2026-07-31)

### UsageMeter (pure domain component)

- [x] src/server/billing/usage-meter.ts — satunya tempat yang memahami format usage provider; mengubah raw provider usage → TokenUsage
- [x] Stateless, deterministic, zero dependency (hanya import TokenUsage; grep-verified: tidak ada Prisma/DB/repository/HTTP/provider SDK)
- [x] TIDAK pernah: hitung harga, akses DB, buat UsageLog/Transaction, sentuh Wallet, emit event (domain ChargeService — M5)

### Provider Mapping Review

- [x] Abstraksi UsageAdapter (providerIds + extract) + register() — provider baru ditambah tanpa mengubah core UsageMeter (tested: custom adapter Anthropic-style)
- [x] DeepSeekUsageAdapter — prompt/completion/total_tokens + prompt_tokens_details.cached_tokens (prefer) + legacy prompt_cache_hit_tokens (fallback) + completion_tokens_details.reasoning_tokens
- [x] OpenAICompatibleUsageAdapter — openai/openai-compatible aliases, prompt_tokens_details.cached_tokens, reasoning_tokens
- [x] Provider metadata di payload (model, provider, dll) diabaikan dengan aman
- [x] Input menerima object atau JSON string; provider id case/space-insensitive

### Validation Review

- [x] Token tidak boleh negatif (InvalidUsage)
- [x] Total konsisten: total_tokens provider harus == prompt + completion (cached di-decompose dari prompt, jadi domain total == provider total)
- [x] Overflow protection: semua count harus safe integer (Number.isSafeInteger) + sum check
- [x] Null handling: field wajib null → MalformedUsage; field opsional null → dianggap absent (0)
- [x] cachedTokens ≤ promptTokens; reasoningTokens ≤ completionTokens (wajib, subset semantics)
- [x] NaN / Infinity / fractional → InvalidUsage

### Error Review

- [x] UsageMeterError (base, code machine-readable)
- [x] UsageParseError (USAGE_PARSE_ERROR — invalid JSON string)
- [x] MalformedUsage (MALFORMED_USAGE — bukan object, field wajib hilang, tipe salah)
- [x] InvalidUsage (INVALID_USAGE — negatif, overflow, mismatch, cached > prompt, reasoning > completion)
- [x] UnsupportedProvider (UNSUPPORTED_PROVIDER — provider tidak terdaftar)
- [x] UsageMeterErrorCode: USAGE_PARSE_ERROR, MALFORMED_USAGE, INVALID_USAGE, UNSUPPORTED_PROVIDER, INVALID_REGISTRATION

### Test Coverage (39 test baru)

- [x] DeepSeek usage (full payload + legacy fallback + parseDetailed reasoning) ✓
- [x] OpenAI usage (+ alias + JSON string) ✓
- [x] cached token (decompose + total konsisten) ✓
- [x] tanpa cached token (default 0) ✓
- [x] malformed usage (null, array, missing/wrong-typed/null required fields) ✓
- [x] unsupported provider (+ undefined + custom-only meter) ✓
- [x] negative token (prompt/completion/cached + fractional + NaN/Infinity) ✓
- [x] total mismatch (dengan & tanpa cached) ✓
- [x] deterministic (input sama → output sama, tidak mutasi input, antar instance) ✓
- [x] overflow (single field + combined sum) ✓ / null handling ✓ / reasoning bounds ✓ / custom adapter ✓ / error codes ✓

### Verification

- [x] npm test: 172 passed (39 baru)
- [x] tsc --noEmit ✅ / lint ✅ 0 errors 0 warnings / build ✅
- [x] Tidak ada dependency database / repository / provider SDK (grep-verified, satu import: ./token-usage)
- [x] Menghasilkan TokenUsage (instance check + nilai)

> ✅ Milestone 4 COMPLETED.

---

# In Progress

## Authentication

Status:
✅ Complete (blueprint compliant; admin TOTP scoped to Admin Dashboard phase)

Wallet

Status:
✅ APPROVED FOR PRODUCTION BACKEND (officially closed 2026-07-31)

Billing

Status:
🟢 Milestone 4 COMPLETED (Usage Meter) — M5 ChargeService berikutnya, belum dimulai

Dashboard

Status:
🔴 Not Started

---

# Next Task

**Billing Engine — Milestone 5 (ChargeService)** — menunggu instruksi (jangan mulai sebelum approval).

---

# Decisions

AI Provider

- DeepInfra

Supported Models

- DeepSeek V4 Flash
- DeepSeek V4 Pro

Architecture

- OpenAI Compatible API
- Wallet First Billing
- Next.js 15 App Router
- Prisma 6 + Supabase PostgreSQL
- bcrypt for password hashing
- JWT with refresh token rotation
- HttpOnly Secure cookies for tokens
- Refresh tokens hashed (SHA-256) at rest
- API keys: pk_live_ prefix, SHA-256 hashed storage
- Money selalu Decimal (string di API), tidak pernah number
- Top-up: create request → payment gateway → webhook verify → credit (tidak pernah direct credit)
- Idempotency: tabel terpisah reusable (IdempotencyKey)
- Payment provider: abstraction (MockProvider V1, Xendit/Stripe future)
- API versioning: /api/v1/ sejak awal
- Error contract: { success, error: { code, message, details }, request_id }

---

# Known Issues

None (fixed in hardening pass)

---

# Notes For AI Agent

Before coding:

1. Read AGENTS.md
2. Read docs/Blueprint
3. Follow existing architecture.
4. Never modify architecture without approval.
