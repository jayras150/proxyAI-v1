# ProxyAI Project Tasks

Last Updated: 2026-07-31

Latest commit: `0a783a8` — refactor(auth): consolidate auth helpers and single session lifetime source

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

## 📋 In Progress

### Wallet System — Milestone 2: Repository Implementation & Services

Status: 🔴 Not Started — menunggu persetujuan setelah M1

Tasks:
- [ ] Repository implementations (Prisma) untuk 5 domain
- [ ] IdempotencyService (reusable)
- [ ] WalletService (get, credit, debit, validate-balance)
- [ ] TransactionService (history cursor)
- [ ] TopupService + PaymentService + MockProvider
- [ ] API Routes /api/v1/wallet/*
- [ ] Webhook /api/v1/webhooks/payments
- [ ] UI: balance card, topup form, transaction history

### Billing Engine

Status: 🔴 Not Started

Tasks:
- [ ] Pricing engine server service
- [ ] Usage accounting
- [ ] Wallet deduction after AI request
- [ ] Idempotency support
- [ ] Refund strategy

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
