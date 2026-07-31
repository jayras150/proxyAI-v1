# ProxyAI Project Tasks

Last Updated: 2026-07-31

Latest commit: `09aaec0` — fix(wallet): protect against expired payments and key rate limits by user

---

## ✅ Completed Tasks

### Authentication Module — Phase 1 (2026-07-31)

- [x] Initialize Next.js 15 project (TypeScript, App Router, Tailwind CSS v4)
- [x] Install dependencies (Prisma, bcryptjs, jsonwebtoken, zod)
- [x] Create Prisma schema (all core models)
- [x] Set up Prisma Client
- [x] Create config/env module
- [x] Create type definitions (auth, api)
- [x] Create Prisma singleton
- [x] Create password hashing utilities (bcrypt, 12 rounds)
- [x] Create JWT utilities (generate, verify, refresh — no `any`)
- [x] Create crypto utilities (API key generation, SHA-256 hashing)
- [x] Create Zod validation schemas
- [x] Create auth server services (register, login, refresh, logout)
- [x] Create API key server services (create, list, revoke)
- [x] Create auth middleware
- [x] Create HttpOnly cookie helpers
- [x] Create client-side AuthContext provider (cookie-based)
- [x] Create API routes:
  - POST /api/auth/register
  - POST /api/auth/login
  - POST /api/auth/refresh
  - POST /api/auth/logout
  - POST /api/auth/logout-all
  - GET /api/auth/me
  - GET /api/api-keys
  - POST /api/api-keys
  - DELETE /api/api-keys/:id
- [x] Create Login page (/login)
- [x] Create Register page (/register)
- [x] Create Dashboard shell with auth guard
- [x] Create API Key management component
- [x] Verify TypeScript compilation
- [x] Verify lint passes (0 errors, 0 warnings)
- [x] Verify production build passes

### Authentication Security Hardening (2026-07-31 — self review fixes)

- [x] P1: Tokens moved from localStorage to HttpOnly Secure cookies
- [x] P1: Refresh tokens hashed (SHA-256) at rest, never plaintext
- [x] P2: Logout revokes only current session; logout-all endpoint added
- [x] P2: Removed all `as any`
- [x] P2: Fixed all lint/TypeScript errors
- [x] P2: npm run lint + npm run build pass with no errors

### Blueprint Compliance — request_id, Rate Limiting, Security Headers (2026-07-31)

- [x] request_id di seluruh response (§59): src/lib/request-id.ts + src/lib/api-response.ts (jsonSuccess/jsonError + header X-Request-Id)
- [x] Semua 9 route refactored ke helper baru; types/api.ts dihapus
- [x] Rate limiter abstraction (§67): interface RateLimiter + MemoryRateLimiter (dev) + RedisRateLimiter (prod, Upstash)
- [x] Factory berbasis env (RATE_LIMITER_DRIVER) — business logic tidak terikat implementasi
- [x] Policy: authPublic 60 req/min, authenticated 300 req/min; headers X-RateLimit-* + Retry-After; kode RATE_LIMITED
- [x] Security headers (§38): CSP, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS (prod only)
- [x] Diverifikasi live: 429 muncul setelah 60 request; semua header hadir
- [x] npm run lint: ✅ 0 errors / npm run build: ✅ / prisma generate: ✅

### Final Verification (2026-07-31 — passed)

- [x] Source code verified directly (HttpOnly cookies, hashToken, logout-scope, /me, /logout-all)
- [x] npx prisma generate: ✅
- [x] npm run lint: ✅ 0 errors, 0 warnings
- [x] npm run build: ✅ success
- [x] No TODO / FIXME / console.log / unnecessary any / hardcoded secrets / localStorage
- [x] Committed: `f22a17a` feat(auth): implement secure authentication module
- [x] Pushed to origin/main


---

## ✅ Completed Tasks

### Wallet System — Milestone 1: Database Foundation (2026-07-31)

- [x] Review Blueprint Wallet (Sprint 4 §19-26, Sprint 8 §52-57, Sprint 9, Sprint 10 §73-75)
- [x] Prisma schema: 8 enum (Currency, WalletStatus, TransactionType, TransactionStatus, TopupStatus, PaymentProvider, IdempotencyStatus, WebhookEventStatus)
- [x] Models: Wallet (+status, +version, currency enum, index [userId,status])
- [x] Models: Transaction (+enum status, audit metadata, cursor index [walletId,createdAt,id])
- [x] Models: TopupRequest (lifecycle status, provider, unique providerReference/transactionId, expiresAt required)
- [x] Models: IdempotencyKey (unique [key,scope,userId], requestHash, response)
- [x] Models: WebhookEvent (unique [provider,providerEventId], payloadHash)
- [x] Constraints: FK lengkap, unique, composite index, CHECK SQL documented (balance>=0, amount>0)
- [x] Migration: prisma/migrations/20260731150000_wallet_foundation + migration_lock.toml
- [x] Repository interfaces: WalletRepository, TransactionRepository, TopupRequestRepository, IdempotencyKeyRepository, WebhookEventRepository
- [x] Verification: prisma validate/generate ✅, tsc ✅, lint ✅ 0/0, build ✅
- [x] Self review: no duplicate model / missing index / circular relation / ambiguous relation / unused enum; expiresAt → required
- ⚠️ Migration belum di-apply ke DB live (butuh Supabase credentials) — dijadwalkan saat deploy

### Wallet System — Milestone 2: Wallet Core (2026-07-31)

- [x] Money Value Object (Decimal-only, currency-aware, 6dp string serialization)
- [x] Structured logger abstraction
- [x] Domain events: types + LocalEventDispatcher (emit after commit only)
- [x] TransactionManager (Unit of Work)
- [x] PrismaWalletRepository: atomic credit / conditional debit / status / version
- [x] PrismaTransactionRepository: immutable create + keyset pagination
- [x] WalletService: getWallet, atomic credit, atomic debit, validateBalance
- [x] TransactionService: cursor history + opaque cursor encode/decode
- [x] WalletError codes (6 business codes)
- [x] Unit tests: 34 passed (incl. concurrency: parallel debits tidak overdraw)
- [x] prisma generate ✅ / tsc ✅ / lint ✅ / build ✅

### Wallet System — Milestone 3: Topup & Payment Services (2026-07-31)

- [x] PaymentProvider abstraction (createPayment/verifyWebhook)
- [x] MockProvider: payment intent, checkout URL/token, expiresAt, unique ref, webhook simulation, HMAC signature
- [x] PaymentService: orchestrasi provider + mapping, tanpa business logic wallet
- [x] TopupService: createTopup/getTopup/markPaid/markFailed/markExpired; wallet tidak berubah saat create
- [x] IdempotencyService: reserve/complete/replay, hash validation, expired cleanup, scope-aware
- [x] WebhookService: signature verify, replay protection, payload hash, dedupe, amount/currency check, single tx, events setelah commit
- [x] Prisma repos: TopupRequest, IdempotencyKey, WebhookEvent
- [x] WalletService creditInTransaction/debitInTransaction (komposisi satu tx)
- [x] Unit + integration tests: 64 passed (replay, forged, mismatch, FAILED, concurrency double-credit)
- [x] prisma generate ✅ / tsc ✅ / lint ✅ / build ✅

### Wallet System — Milestone 4: API Layer (2026-07-31)

- [x] openapi/v1.yaml (OpenAPI 3.1, 5 endpoints, security, schemas, examples)
- [x] GET /api/v1/wallet
- [x] GET /api/v1/wallet/transactions (cursor pagination)
- [x] POST /api/v1/wallet/topups (idempotency key)
- [x] GET /api/v1/wallet/topups/:id
- [x] POST /api/v1/webhooks/payments (signature auth)
- [x] Zod validation semua request; response contract nested error global
- [x] Error mapping terpusat (423/409/400/401 dll)
- [x] Rate limit per-endpoint + structured request logging
- [x] API tests + OpenAPI validation: 85 tests passed
- [x] prisma generate ✅ / tsc ✅ / lint ✅ / build ✅

### Wallet System — Production Readiness Fixes (2026-07-31)

- [x] P1: expired payment protection — webhook tidak pernah kredit setelah expiresAt (EXPIRED + processed + ack)
- [x] P1 tests: sebelum/sesudah expiresAt, replay expired, FAILED-on-expired (4 test)
- [x] P2: authenticated rate limit keyed by userId (priority: userId → API key → IP fallback)
- [x] P2 tests: identity bucket separation (4 test)
- [x] OpenAPI & contract tidak berubah (no breaking change)
- [x] npm test: 93 passed / lint ✅ / build ✅ / prisma generate ✅
- [x] Wallet status: **APPROVED FOR PRODUCTION BACKEND**

### Technical Debt (R5-R9 + R10)

- [ ] R5 — ms() → lib/time.ts
- [ ] R6 — RedisRateLimiter retryAfterSeconds via ttl
- [ ] R7 — unused type exports validation.ts
- [ ] R8 — isJwtError() helper
- [ ] R9 — prisma CLI → devDependencies
- [ ] R10 — Auth retrofit ke repository pattern + /api/v1/

### Authentication Module — Fully Blueprint Compliant

Status: ✅ COMPLETE

---

## ✅ Wallet Module — OFFICIALLY CLOSED (2026-07-31)

Status: ✅ **APPROVED FOR PRODUCTION BACKEND**

- [x] ✓ Database Foundation (M1)
- [x] ✓ Wallet Core (M2)
- [x] ✓ Payment Services (M3)
- [x] ✓ API Layer (M4)
- [x] ✓ Production Readiness Review (4.5)
- [x] ✓ Production Fixes (P1 expired payment, P2 rate limit identity)

Seluruh milestone Wallet selesai, diverifikasi (93 tests), dan disetujui. Wallet bukan lagi current task.

> Tech debt R5-R10 dan status Authentication Module: lihat bagian Completed Tasks di atas.

---

## 📋 Next Priority: Billing Engine

### Design — LOCKED ✅

Status: 📘 **APPROVED FOR IMPLEMENTATION** (locked 2026-07-31)

- [x] Billing Design Review v1 (arsitektur, DB, domain, API, sequence, state machine, failure, security, scalability)
- [x] Billing Design Review v2 (10 revisi — service separation, pricing snapshot, streaming lifecycle, reserve, pricing versioning, refund state machine, domain events, sequence diagrams, wallet debit strategy, final architecture review)
- [x] ADR-0001 Controlled Negative Balance (docs/adr/0001-controlled-negative-balance.md)
- [x] Final Design Polish (business policy vs integrity rule; PAYMENT_REQUIRED system-generated)

Keputusan kunci: post-paid debit (A), tanpa reserve V1, PricingVersion table, negative balance via env policy (bukan CHECK), PAYMENT_REQUIRED system-only.

### Implementasi — Milestone 1: Database Foundation & Domain Model

Status: ✅ **COMPLETED** (2026-07-31) — 104 tests, lint, build, prisma validate/generate passed

- [x] Schema: PricingVersion, RefundRequest, UsageLog (status enum + snapshot + currency + cachedTokens), AiModel (price → PricingVersion), Transaction (refundRequest 1:1), WalletStatus.PAYMENT_REQUIRED
- [x] Enums: UsageStatus, RefundStatus, PricingVersionStatus, WalletStatus+PAYMENT_REQUIRED
- [x] Value objects (pure): TokenUsage, PricingSnapshot, CostBreakdown (+ Money reuse)
- [x] Repository interfaces: PricingRepository, UsageRepository, RefundRepository (+ TransactionRepository review, pagination generic)
- [x] Migration 20260731190000_billing_foundation (increment diff) + DROP CHECK wallets_balance_non_negative (ADR-0001)
- [x] Unit tests: 11 baru (billing domain) — total 104

### Implementasi — Milestone 2: Pricing Engine

Status: ✅ **COMPLETED** (2026-07-31) — 119 tests, lint, build passed

- [x] PricingEngine (pure, deterministic, stateless) — calculate(): PricingSnapshot + TokenUsage → CostBreakdown {providerCost, markupCost, serviceFee, subtotal, totalCost}
- [x] Formula terdokumentasi (input/output/cached per 1M, markup, fee, min charge)
- [x] Rounding policy tunggal: floor 6dp sekali di total akhir
- [x] Money refactor ke decimal.js murni + CurrencyCode domain (zero Prisma di domain billing)
- [x] Boundary conversion di lib/prisma.ts (moneyToPrisma / prismaToDecimal / prismaToMoney)
- [x] Unit tests: 15 pricing + 11 M1 domain = total 119

### Implementasi — Milestone 3: Estimate Service

Status: ✅ **COMPLETED** (2026-07-31) — 133 tests, lint, build passed

- [x] EstimateService (read-only): pricing aktif → snapshot → PricingEngine.calculate() → wallet balance → floor policy
- [x] Business rule ADR-0001: estimatedBalance = balance - cost; canProceed >= -WALLET_MAX_NEGATIVE_BALANCE
- [x] Wallet status gate (PAYMENT_REQUIRED/LOCKED/SUSPENDED) + custom floor override
- [x] Error domain: PRICING_NOT_FOUND, WALLET_NOT_FOUND, CURRENCY_MISMATCH, INSUFFICIENT_BALANCE, ESTIMATE_FAILED
- [x] PricingVersion.currency column + env WALLET_MAX_NEGATIVE_BALANCE
- [x] Unit + integration tests: 14 baru (total 133)

### Implementasi — Milestone 4: Usage Meter (COMPLETED 2026-07-31)

Status: 🟢 COMPLETED

- [x] UsageMeter pure domain component (src/server/billing/usage-meter.ts) — stateless, deterministic, zero DB/Prisma/repository/SDK dependency
- [x] Provider adapter abstraction: UsageAdapter interface + register() — provider baru tanpa mengubah core
- [x] Built-in adapters: DeepSeek (incl. legacy prompt_cache_hit_tokens) + OpenAI Compatible (alias openai/openai-compatible)
- [x] Input: raw provider usage (object atau JSON string); output: TokenUsage (prompt/completion/cached/total)
- [x] Normalisasi: cached di-decompose dari prompt → domain total == provider total_tokens
- [x] Validation: non-negatif, safe integer (overflow protection), total konsisten, null handling, cached ≤ prompt, reasoning ≤ completion
- [x] Errors: UsageMeterError (base) + UsageParseError / MalformedUsage / InvalidUsage / UnsupportedProvider
- [x] Unit tests: 39 baru (total 172) — DeepSeek, OpenAI, cached, tanpa cached, malformed, unsupported, negative, mismatch, deterministic, overflow, null, reasoning, custom adapter
- [x] Verification: tsc ✅ / lint 0:0 ✅ / build ✅ / purity grep ✅

### Implementasi — Milestone 5: Charge Service (COMPLETED 2026-07-31)

Status: 🟢 COMPLETED

- [x] ChargeService (src/server/billing/charge.service.ts) — settlement final post-paid, satu DB transaction (reserve idempotency + debitWithFloor + Transaction AI_USAGE + UsageLog + idempotency result), events hanya setelah commit
- [x] ADR-0001: WalletRepository.debitWithFloor + WalletService.debitWithFloor(InTransaction) + PAYMENT_REQUIRED + reaktivasi otomatis di credit
- [x] Repos baru: PrismaPricingRepository, PrismaUsageRepository; IdempotencyService tx-aware (reserveInTransaction/completeInTransaction)
- [x] Errors: ChargeError (PRICING_NOT_FOUND, WALLET_NOT_FOUND, FLOOR_EXCEEDED, CURRENCY_MISMATCH, CHARGE_FAILED) + map WalletError
- [x] Unit + integration tests: 24 baru (total 196) — normal, replay, duplicate, floor aman/terlampaui, PAYMENT_REQUIRED, rollback, optimistic locking, event setelah commit, deterministic, race, chargeRaw+UsageMeter
- [x] Verification: tsc ✅ / lint 0:0 ✅ / build ✅ / no HTTP / no partial update

### Implementasi — Milestone 6: Refund Service (COMPLETED 2026-07-31)

Status: 🟢 COMPLETED

- [x] RefundService (src/server/billing/refund.service.ts) — refund penuh userCost, satu DB transaction (replay gate → validasi → create RefundRequest + credit + Transaction REFUND + UsageLog REFUNDED + markCompleted), events setelah commit
- [x] PrismaRefundRepository (optimistic lock via RefundRequest.version — kolom ditambahkan ke schema + migration)
- [x] Business rules: satu refund per usage (@@unique usageLogId + guards), refund ≤ yang ditagih (== userCost), PAYMENT_REQUIRED reactivation via credit
- [x] Errors: RefundError (USAGE_NOT_FOUND, USAGE_NOT_ELIGIBLE, ALREADY_REFUNDED, USER_MISMATCH, WALLET_NOT_FOUND, CURRENCY_MISMATCH, REFUND_FAILED)
- [x] Unit + integration tests: 19 baru (total 215) — normal, duplicate, replay, rollback, optimistic locking, wallet credit, REFUNDED, events, race, IN_PROGRESS, deterministic
- [x] Verification: tsc ✅ / lint 0:0 ✅ / build ✅ / prisma validate ✅ / no HTTP / no partial update

### Implementasi — Milestone 7: AI Gateway / Billing Orchestrator (COMPLETED 2026-07-31)

Status: 🟢 COMPLETED

- [x] AIGateway (src/server/gateway/ai-gateway.ts) — orchestrator only: estimate gate → provider → meter → charge → billing summary; zero pricing/wallet/token/persistence logic
- [x] RequestContext (request-context.ts) + AIProvider interface + ProviderCapabilities + ProviderResponse + BillingSummary + GatewayResponse (gateway/*)
- [x] DeepSeekProvider + FetchProviderTransport (src/server/providers/) — HTTP/key/URL hanya di provider layer
- [x] Error policy terdokumentasi (6 scenario, tested) + retry policy (tidak pernah retry generation; charge idempotent)
- [x] Observability: structured log dengan correlation_id di 9 titik + latency (provider/billing/total)
- [x] ChargeResult +walletBalanceBefore (additive); env AI_PROVIDER_TIMEOUT_MS + DEEPINFRA_BASE_URL
- [x] Unit + integration tests: 22 baru (total 237) — full pipeline dengan real services + fake transport/repos
- [x] Verification: tsc ✅ / lint 0:0 ✅ / build ✅ / purity grep ✅

### Implementasi — Milestone 8: REST API Layer (COMPLETED 2026-07-31)

Status: 🟢 COMPLETED

- [x] 8 endpoint v1 (chat/completions, models, providers, health, estimate, refund, usage, transactions) — HTTP adapter only, zero business logic
- [x] lib/api-auth.ts (JWT + API key unified), lib/ai-validation.ts (Zod), mapApiError diperluas (402/502/504/403), rate limits aiChat/aiEstimate/aiRefund/aiRead/aiHealth
- [x] OpenAPI 13 endpoint + schemas + responses (valid, 7/7 test)
- [x] Composition root: full billing stack + ModelService + providerInfo/providerHealth/estimateUsage
- [x] Integration + API tests: 24 baru (total 261) — chat, estimate, refund, usage, transactions, validation, auth, rate limit, OpenAPI
- [x] Verification: tsc ✅ / lint 0:0 ✅ / build ✅ / OpenAPI valid ✅ / grep route purity ✅

### Implementasi — Milestone 9: Reconciliation & Production Readiness (belum dimulai)

Status: 🔴 Not Started — menunggu instruksi (jangan mulai sebelum approval)

Tasks (saat implementasi nanti):
- [ ] Reconciliation (charge vs provider vs usage log) + Production Readiness Review + closure
- [ ] Streaming/SSE (out of scope M8) + multi-provider routing + embeddings bila diminta

---

## 📋 Upcoming Modules

### OpenAI Compatible API

Status: 🔴 Not Started

Tasks:
- [ ] Provider adapter interface
- [ ] DeepInfra provider implementation
- [ ] GET /v1/models endpoint
- [ ] POST /v1/chat/completions (non-streaming)
- [ ] POST /v1/chat/completions (streaming/SSE)
- [ ] Request lifecycle (validate key → validate wallet → provider → bill)
- [ ] Error handling & retry strategy

### User Dashboard

Status: 🔴 Not Started

Tasks:
- [ ] Home page with widgets
- [ ] Usage charts
- [ ] Transaction history
- [ ] Settings page

### Admin Dashboard

Status: 🔴 Not Started

Tasks:
- [ ] Admin login with TOTP
- [ ] User management
- [ ] Wallet management
- [ ] AI configuration
- [ ] Audit logs

### Security & Operations

Status: 🔴 Not Started

Tasks:
- [ ] RBAC enforcement
- [ ] Rate limiting
- [ ] Security headers (CSP, HSTS)
- [ ] TOTP for admin
- [ ] Approval sessions for dangerous actions
