# User Dashboard — Architecture & UX Design

Status: ✅ **APPROVED FOR IMPLEMENTATION** (2026-07-31)

Scope: **Regular User only.** Admin Dashboard is out of scope (separate phase, TOTP-gated).

This document is the locked design for the ProxyAI User Dashboard. It defines architecture,
navigation, page/component hierarchy, data flow, API mapping, UX, responsive behavior, and the
implementation roadmap. **No implementation starts until this design is approved.**

---

## 0. Design Principles (from Blueprint Sprint 5 §27)

A new user must understand the platform within five minutes.

1. **Clean & Minimal** — never imitate cloud-provider complexity.
2. **Fast** — skeleton-first, stale-while-revalidate, no waterfall fetches.
3. **Wallet-first** — balance and payment state are always visible and never ambiguous.
4. **Mobile-friendly** — bottom nav + drawer on mobile, sidebar on desktop.
5. **Accessible** — WCAG 2.1 AA, keyboard navigable, focus-visible, reduced-motion support.
6. **Honest states** — every widget has loading, error, and empty states (Blueprint §32).
7. **Money is a string** — all money is decimal-string from the API, formatted for display only; never `Number`.

---

## 1. Information Architecture

### 1.1 Sitemap (User Area)

```
/login  /register            → public (auth)
/dashboard                   → app shell (auth-guarded, sidebar/bottom-nav)

/dashboard                   → Home / Overview
├── Balance hero
├── Today's usage + Monthly spending
├── Recent transactions (5)
├── Recent AI usage (5)
├── Active API keys
├── Quick actions
└── System status

/dashboard/wallet            → Wallet
├── Current balance + status banner
├── Quick topup (inline amount entry)
├── Pending payment card (if any)
└── Topup history

/dashboard/topup             → Topup
├── Amount selector (presets + custom)
├── Payment method / intent (checkout)
├── Pending payment + status polling
└── Topup history (shared with Wallet page, full list here)

/dashboard/usage             → Usage
├── Charts: requests/day, tokens/day, cost/day
├── Filters: date range, model
└── Usage history table (cursor pagination, cost per row)

/dashboard/transactions      → Transactions
├── Filter by type (TOPUP / AI_USAGE / REFUND / ADJUSTMENT / ADMIN_*)
├── Search (client-side within loaded pages)
└── Transaction list (cursor pagination)

/dashboard/api-keys          → API Keys
├── Create key (shown once, copy)
├── Key list: name, prefix, status, last used, created
├── Rotate key (create + revoke in one flow)
└── Revoke / delete (confirm dialog)

/dashboard/models            → Models & Pricing
├── Model cards: name, context window, input/output price, features
└── Provider info (capabilities)

/dashboard/profile           → Profile
├── Avatar, name, email
├── Language, timezone
└── (future: notification prefs live in Settings)

/dashboard/security          → Security
├── Password change
├── Google login (future placeholder)
├── Active sessions (list + revoke) — future placeholder w/ logout-all
└── 2FA (future placeholder)

/dashboard/settings          → Settings
├── Theme (light/dark/system)
├── Notifications (future placeholder)
├── Default model
└── Default temperature
```

### 1.2 Content Model

| Domain object | Source of truth | Display rules |
|---|---|---|
| Wallet | `GET /v1/wallet` | Money string → `Intl.NumberFormat`; status badge (ACTIVE/LOCKED/SUSPENDED/PAYMENT_REQUIRED) |
| Transaction | `GET /v1/transactions` | Type badge + sign-aware amount (±), before/after balance, reference, timestamp |
| UsageLog | `GET /v1/usage` | Model, tokens (prompt/completion/cached), cost, status, timestamp |
| TopupRequest | `POST /v1/wallet/topups`, `GET /v1/wallet/topups/:id` | Status lifecycle PENDING→PAID/FAILED/EXPIRED; countdown on pending |
| ApiKey | `GET/POST /api/api-keys`, `DELETE /api/api-keys/:id` | Prefix only; full key shown once at creation |
| AiModel | `GET /v1/models` | Name, context window, features; prices (backend add, §6 gaps) |
| UserProfile | `GET /api/auth/me` | Name, email, avatar; language/timezone (backend add, §6 gaps) |
| Health | `GET /v1/health` | Public; dot + "All systems operational" or degraded |

### 1.3 User Roles & Permissions (User-only)

- Identity from HttpOnly cookie (JWT) or Bearer — same identity as API.
- All reads scoped server-side to `userId` (already enforced by backend).
- No admin surfaces anywhere in the user dashboard.

---

## 2. Navigation Structure

### 2.1 Global Navigation

| Breakpoint | Pattern |
|---|---|
| ≥1024px (desktop) | Persistent left sidebar (240px), collapsible to icon rail (64px) |
| 768–1023px (tablet) | Icon rail + hamburger → drawer overlay |
| <768px (mobile) | Top app bar + bottom tab bar (5 primary items) + "More" → drawer |

**Primary items (mobile bottom bar):** Dashboard · Wallet · Usage · Transactions · More
**Full nav (sidebar / More drawer):**

```
Dashboard      /dashboard
Wallet         /dashboard/wallet
Topup          /dashboard/topup
Usage          /dashboard/usage
Transactions   /dashboard/transactions
API Keys       /dashboard/api-keys
Models         /dashboard/models
─── (group: Account)
Profile        /dashboard/profile
Security       /dashboard/security
Settings       /dashboard/settings
```

- Active item: highlighted via `usePathname` exact-match (nested under `/dashboard` root).
- Wallet status `PAYMENT_REQUIRED`: red dot on Wallet/Topup nav item + persistent banner (see UX Review).
- Topbar (all breakpoints): brand, system status dot (from `/v1/health`), theme toggle, avatar → user menu (Profile, Security, Settings, Logout).

### 2.2 Secondary / Contextual Navigation

- Dashboard quick actions: "Top up" → `/dashboard/topup`, "Create API key" → opens `/dashboard/api-keys` with create dialog auto-open, "View usage" → `/dashboard/usage`.
- Empty states embed the same CTAs (single path per action).
- No breadcrumbs needed (flat hierarchy, 1 level deep).

---

## 3. Page Hierarchy

```
Route (page.tsx)
└── Page shell (server component: metadata, layout slots)
    └── Page header (title, subtitle, actions)
    └── Widget sections (cards/grid)
        └── Composite widgets (data-fetching, own loading/error/empty)
            └── Presentational components (stateless)
```

### 3.1 Per-page widget map

| Page | Widgets (top→bottom) | Data deps |
|---|---|---|
| Home | BalanceCard, WalletStatusBanner, StatsRow (Today's Requests, Today's Spend, Monthly Spend), QuickActions, RecentTransactions(5), RecentUsage(5), ActiveKeys, SystemStatus | wallet, usage, transactions, api-keys, health (+summary, §6) |
| Wallet | BalanceCard, StatusBanner, QuickTopup (inline amount + preset), PendingPayment, TopupHistory | wallet, topups, transactions |
| Topup | AmountSelector, PaymentIntentCard (checkout/countdown), PaymentStatusPoll, TopupHistory(full) | topups (create + poll), transactions |
| Usage | FilterBar (date range, model), Charts (requests, tokens, cost), UsageTable (cursor) | usage, models |
| Transactions | FilterBar (type), SearchInput, TransactionTable (cursor) | transactions |
| API Keys | KeyList, CreateKeyDialog (secret reveal once), RotateKeyFlow, RevokeConfirm | api-keys |
| Models | ModelCard grid, ProviderInfo | models, providers |
| Profile | ProfileForm (name/avatar/language/timezone), EmailReadOnly | me |
| Security | ChangePasswordForm, GoogleLoginCard (future), SessionsCard (logout-all now; per-session revoke future), TwoFaCard (future) | me, auth |
| Settings | ThemeControl, NotificationPrefs (future), DefaultModelSelect, DefaultTemperatureSlider | models (client prefs) |

---

## 4. Component Hierarchy

### 4.1 Design System (foundation)

| Token group | Spec |
|---|---|
| Typography | Font: Geist (default Next) with `font-feature-settings: "tnum"` for all money/numbers. Scale: 12/14/16/20/24/30. Headings semibold, body regular, labels 14 medium. |
| Spacing | Tailwind default 4px scale. Card padding 20, section gap 24, page gutter 16/24/32 (mobile→desktop). Max content width 1200px. |
| Color | Neutrals: zinc (existing). Primary: blue-600/500. Semantic: success emerald-600, danger red-600, warning amber-500, info sky-600. Dark mode: same hues, adjusted surfaces (zinc-950/900/800). Tokenized as CSS vars (`--color-*`) so Tailwind v4 `dark:` works. |
| Radius | sm 6 / md 8 / lg 12 / full (badges, avatars). |
| Shadow | Card: `shadow-sm`; elevated (modals/drawers): `shadow-lg`. |
| Dark mode | Class strategy (existing code already uses `dark:`). `ThemeToggle` sets `document.documentElement.classList` + persists in localStorage; `system` option follows `prefers-color-scheme`. No flash: inline script in root layout. |
| Accessibility | AA contrast on all text, `focus-visible` rings (2px offset), aria-labels on icon buttons, `aria-live="polite"` for toasts/banners, `role="status"` for async updates, 44px min touch target, `prefers-reduced-motion` disables transitions. |

### 4.2 Primitives (dumb components)

`Button` (variant: primary/secondary/ghost/danger; size sm/md/lg; loading state) · `Input` / `Select` / `Switch` / `Checkbox` / `RadioGroup` / `SegmentedControl` · `AmountInput` (decimal, currency prefix, preset chips) · `SearchInput` (debounced) · `Badge` (tone) · `StatusDot` · `Card`/`CardHeader`/`CardBody` · `Modal`/`Dialog` (focus trap, Esc, backdrop) · `Sheet` (mobile drawer/bottom sheet) · `ConfirmDialog` (danger text confirm) · `Toast`/`ToastProvider` · `Skeleton` · `EmptyState` (icon+title+body+CTA) · `ErrorState` (message + request_id + retry) · `Tabs` · `Tooltip` · `CopyButton` · `CountdownTimer` · `Pagination` (cursor: Prev/Next + "has_more").

### 4.3 Composites (data-aware widgets)

`BalanceCard` (wallet + status + "Top up" CTA) · `WalletStatusBanner` (PAYMENT_REQUIRED/LOCKED/SUSPENDED with reason + CTA) · `StatsRow` (3 stat cards) · `UsageChart` (bar: requests/day, tokens/day; line: cost/day) · `TransactionTable` / `TransactionRow` (mobile card variant) · `UsageTable` / `UsageRow` · `TopupHistory` · `PendingPaymentCard` (countdown + poll status + refresh) · `KeyList` / `CreateKeyDialog` / `RotateKeyFlow` · `ModelCard` / `ModelGrid` · `QuickActions` · `SystemStatus` · `ProfileForm` · `ChangePasswordForm` · `SessionsCard` · `DefaultPrefsCard` (model + temperature) · `ThemeControl`.

### 4.4 App shell

`AppShell` (server layout: auth guard → shell) → `Sidebar` (desktop) · `TopBar` (brand, health dot, theme, avatar menu) · `BottomNav` (mobile) · `MoreDrawer` · `AuthGuard` (redirect to /login when session invalid; bootstrap via `/api/auth/me`) · `QueryProvider` (TanStack Query client) · `ToastProvider`.

### 4.5 Existing code migration

- `src/app/dashboard/layout.tsx` (header-only shell) → replaced by `AppShell`; keep `useAuth` for session state.
- `src/components/api-keys-section.tsx` → refactored into `KeyList` + `CreateKeyDialog` (same endpoints, new primitives). No backend change.

---

## 5. Data Flow

### 5.1 State management strategy

| Concern | Tool |
|---|---|
| Server state (wallet, usage, transactions, keys, models, health) | **TanStack Query v5** — cache keys, stale-while-revalidate, background refetch, retry w/ backoff, invalidation on mutation |
| Client/UI state (theme, drawer, modals, filters, topup form) | Local component state + `useTheme` hook; **no global store needed** (no cross-page shared mutable UI state). Add Jotai only if it emerges. |
| Auth session | Existing `AuthContext` (bootstrap `/api/auth/me`), HttpOnly cookies (no JS tokens). |
| Money | Parse decimal string → format via `formatMoney(amount, currency)` util. **Never** `Number()` for arithmetic. |
| URL state | Filters (date range, model, type) as search params (`/dashboard/usage?from=&to=&model=`) — shareable + back-button safe. |

### 5.2 Fetching model

- **Shell**: Server Components render layout + static content (no data fetch or minimal `/me`).
- **Dynamic data**: Client widgets fetch via `apiClient` (thin fetch wrapper around `/api/*` + `/api/v1/*`) — same-origin, HttpOnly cookie attached automatically; parses `{success,data,request_id}` / `{success,error:{code,message,details},request_id}`; throws normalized `ApiError` with `code + request_id`.
- **Query keys** (namespaced): `['wallet']`, `['transactions', cursor]`, `['usage', cursor, filters]`, `['topup', id]`, `['topups', status]`, `['api-keys']`, `['models']`, `['providers']`, `['health']`, `['me']`.
- **Staleness**: wallet 15s; transactions/usage 30s; keys 30s; models/providers 5min; health 60s (public endpoint, don't hammer). Topup PENDING: poll `GET /v1/wallet/topups/:id` every 3s up to `expires_at`, then stop (terminal states stop polling).
- **Pagination**: cursor from response (`next_cursor`/`has_more`), opaque, "Load more" button (infinite scroll only on mobile usage list — prefer explicit button for a11y + rate-limit sanity; aiRead limit is 300/min so both are safe).

### 5.3 Mutation flows (optimistic where safe)

| Action | Flow | Optimistic |
|---|---|---|
| Create API key | POST → server returns full key → dialog shows once + copy → invalidate `['api-keys']` | No (needs server secret) — pending state on button |
| Revoke key | ConfirmDialog → DELETE → invalidate | Yes: remove row, rollback on error |
| Rotate key | Dialog: create new (show once) → revoke old → invalidate | No (two-step, sequential) |
| Create topup | POST with `X-Idempotency-Key` (UUID kept until terminal state; reused on retry) → PendingPaymentCard + toast | Yes: insert PENDING card immediately, replace on response |
| Refund (from Transactions page, own usage) | ConfirmDialog (shows amount) → POST `/v1/refund` with idempotency key → toast + invalidate wallet/usage/transactions | No — status change is server-authoritative; show per-row "refunding" state |
| Update profile | PATCH → invalidate `['me']` | Yes: local form state is source until server ack |
| Change password | POST → success toast → force re-login (clear session) | No |
| Theme/model/temperature | localStorage immediately; no server round-trip (V1) | Yes (client-only) |

### 5.4 Cross-widget consistency

- All mutations invalidate the exact affected keys so Home, Wallet, Transactions stay consistent.
- After topup PAID: invalidate `['wallet']`, `['transactions']`, `['topups']`, `['usage']` (balance moved).
- After refund: invalidate wallet + usage + transactions.
- Widget-level Suspense/skeletons prevent layout shift; no global loading screen except first auth bootstrap.

### 5.5 Error handling policy

- Network failure: retry (TanStack default 3× backoff) → `ErrorState` with Retry + request_id.
- 401: `AuthGuard` catches → redirect `/login?next=/dashboard...`.
- 429: show "Too many requests" + `Retry-After` countdown, disable retry until then.
- 402 (PAYMENT_REQUIRED from API): map to wallet-status banner, never a raw error.
- Business errors (`INSUFFICIENT_BALANCE`, `WALLET_LOCKED`, idempotency conflict): toast with actionable message; keep form state intact (idempotency key preserved).

---

## 6. API Mapping

All authenticated calls use HttpOnly cookie (browser) — no manual Authorization header.
Envelope: `{success, data, request_id}` / `{success, error:{code,message,details}, request_id}`.
Money always decimal string.

| Page / widget | Endpoint | Method | Notes |
|---|---|---|---|
| Home — balance | `/api/v1/wallet` | GET | `balance`, `currency`, `status` |
| Home — today/monthly stats | `/api/v1/dashboard/summary` | GET | **GAP — new endpoint (§6.1)** |
| Home — recent transactions | `/api/v1/transactions?limit=5` | GET | cursor page, take first 5 |
| Home — recent usage | `/api/v1/usage?limit=5` | GET | |
| Home — active keys | `/api/api-keys` | GET | legacy, count `ACTIVE` |
| Home — system status | `/api/v1/health` | GET | public, 60s stale |
| Wallet — balance | `/api/v1/wallet` | GET | |
| Wallet — topup history | `/api/v1/wallet/topups?status=` | GET | **GAP — new endpoint (§6.1)**; fallback: transactions type=TOPUP |
| Wallet — pending payment | `/api/v1/wallet/topups/:id` | GET | poll 3s while PENDING |
| Topup — create | `/api/v1/wallet/topups` | POST | header `X-Idempotency-Key` required; body `{amount}` |
| Topup — status poll | `/api/v1/wallet/topups/:id` | GET | terminal: PAID/FAILED/EXPIRED |
| Topup — history | (see Wallet) | | |
| Usage — charts + table | `/api/v1/usage?cursor=&limit=` | GET | filters client-side V1 (§6.2) |
| Transactions — list | `/api/v1/transactions?cursor=&limit=` | GET | filters client-side V1 (§6.2) |
| Transactions — refund | `/api/v1/refund` | POST | body `{usage_log_id, idempotency_key, reason?}`; own usage only |
| API Keys — list/create/revoke | `/api/api-keys` (+`/:id`) | GET/POST/DELETE | legacy, stable; rotate = create+revoke |
| Models — list | `/api/v1/models` | GET | **GAP: add price fields (§6.1)** |
| Providers | `/api/v1/providers` | GET | capabilities display |
| Profile — read | `/api/auth/me` | GET | |
| Profile — update | `/api/v1/me` | PATCH | **GAP — new endpoint (§6.1)** |
| Security — password | `/api/auth/change-password` | POST | **GAP — new endpoint (§6.1)** |
| Security — sessions | `/api/auth/sessions` (+`/:id`) | GET/DELETE | **GAP — new endpoints (§6.1)**; V1 fallback: logout-all |
| Security — logout / logout-all | `/api/auth/logout`, `/api/auth/logout-all` | POST | existing |
| Settings — defaults | — | — | client-side localStorage (no backend; §6.3) |
| API playground (future) | `/api/v1/chat/completions`, `/api/v1/estimate` | POST | not in V1 dashboard scope |

### 6.1 Backend gaps to close during dashboard implementation (small, additive — each needs approval)

1. **`GET /api/v1/dashboard/summary`** (JWT) → `{balance, currency, wallet_status, requests_today, spend_today, spend_month, active_keys, latest_transactions[5], latest_usage[5], provider_healthy}` — one round-trip for Home. Backend: aggregate queries on UsageLog/Transaction/ApiKey/Wallet (all indexed paths). Rate limit: `aiRead 300/min`.
2. **`GET /api/v1/wallet/topups`** (JWT, `?status=` + cursor) → topup history list (currently only create + get-by-id exist). Backend: keyset pagination on TopupRequest `[userId, createdAt, id]` (index exists on walletId; add `[userId, createdAt, id]`).
3. **`PATCH /api/v1/me`** (JWT) → update `name`, `avatar_url`, `language`, `timezone` (columns: extend User schema; migration additive).
4. **`POST /api/auth/change-password`** (JWT + current password) → bcrypt verify + rehash + revoke other sessions (keep current).
5. **`GET /api/auth/sessions`** + **`DELETE /api/auth/sessions/:id`** (JWT) → list active sessions (device, IP, last active) + revoke one. Backend: Session query by userId.
6. **Price fields in `GET /api/v1/models`** → add `input_price`, `output_price`, `currency`, `features[]` (from PricingVersion active) so the Models page shows pricing without a new endpoint.

### 6.2 Deliberate V1 simplifications (documented, not gaps)

- Usage/Transactions **search + filter**: client-side over loaded pages (server adds `?model=`, `?type=`, `?from=`, `?to=` in V2 when analytics volume requires). Blueprint lists filters; client-side satisfies V1 for a single user's volume.
- **CSV export**: future (Blueprint §28, "future versions").
- **Per-key usage stats**: not exposed by backend; V1 shows `lastUsedAt` only. V2: `GET /v1/api-keys/stats`.
- **Notifications**: no backend model; V1 UI is a disabled/future placeholder.
- **Google login / 2FA**: future placeholders with "coming soon" state (never fake-enabled).

### 6.3 Money & formatting contract

- `formatMoney("50.000000", "USD")` → `$50.00`; IDR → `Rp50.000`; SGD → `S$50.00`. `Intl.NumberFormat(locale, {currency})`, `tnum` font.
- Sign convention: TOPUP/REFUND `+`, AI_USAGE/ADMIN_DEBIT `−`, ADJUSTMENT by sign. Red for debit, green for credit.
- Negative balance: shown in red + wallet status badge `PAYMENT_REQUIRED` + banner.

---

## 7. UX Review

### 7.1 Heuristic walkthrough (Nielsen)

- **Visibility of system status**: wallet status badge always visible in BalanceCard; topup polling shows live countdown + spinner; mutations show button-level loading; toasts confirm every write.
- **Match with real world**: money formatted per currency; statuses use domain terms (PENDING/PAID/EXPIRED mapped to friendly labels); no cloud-provider jargon.
- **User control**: destructive actions (revoke key, refund, logout-all) always behind ConfirmDialog stating consequences; Esc/backdrop closes modals; "Load more" is explicit (no surprise infinite scroll).
- **Consistency**: one button style set, one badge system, one empty-state pattern across all pages; same CTA language ("Top up" everywhere).
- **Error prevention**: AmountInput blocks invalid decimals client-side; idempotency key auto-generated (user never sees it); rotate-key flow prevents accidental full deletion (revoke happens only after new key is shown).
- **Recognition over recall**: 10 nav items max, grouped; active section highlighted; recent items surfaced on Home.
- **Flexibility**: keyboard shortcuts for power users (e.g., `g d` dashboard, `g t` topup) — optional V2; copy buttons on every key/endpoint.
- **Aesthetic & minimal**: single primary CTA per card; charts default to last 30 days, no chart junk.
- **Help & docs**: empty states carry inline guidance (first API key → code snippet; no usage → "make your first call"); documentation link in footer (Blueprint quick action "View Documentation").

### 7.2 Critical UX flows

1. **Wallet PAYMENT_REQUIRED (402 path)** — red banner on Home + Wallet + nav dot: "Your wallet needs a top-up (balance −$0.04). AI requests are paused." CTA → `/dashboard/topup` with amount prefilled to clear the negative balance + buffer. This is the single most important state in the app.
2. **Topup completion** — create → PendingPaymentCard (amount, countdown to `expires_at`, "I've completed payment" → manual poll trigger) → PAID: success toast + balance animates + history updates; FAILED/EXPIRED: explanatory state + "Try again" pre-fills same amount.
3. **API key creation** — modal, name input, Generate → secret shown once in monospace with Copy + "You won't see this again"; dismiss clears it from the DOM.
4. **Rotate key** — explainer ("New key will be created; old key revoked immediately. Update your apps first."), step 1 create+show, step 2 revoke old.
5. **Refund request** — from a usage row (only when status COMPLETED), confirm shows exact refund amount; success → toast + usage row becomes REFUNDED + balance updates.
6. **Session expiry** — silent 401 on background refetch → AuthGuard intercepts → redirect to `/login?next=` preserving destination; no data loss (query cache survives page nav, not full reload).

### 7.3 Accessibility checklist (acceptance gate)

- All interactive elements keyboard-reachable; visible `focus-visible` ring.
- Modals: focus trap + `aria-modal` + Esc close + return focus.
- Toasts/banners: `aria-live="polite"`; error banners `role="alert"`.
- Charts: `<table>` fallback or `aria-label` summary + data table link (never chart-only).
- Color: not the only status signal (badge text + icon accompany color).
- Touch targets ≥44×44px; contrast ≥4.5:1 (text) / 3:1 (UI).
- `prefers-reduced-motion`: disable countdown pulse, balance animation, chart transitions.

---

## 8. Responsive Review

| Breakpoint | Shell | Content behavior |
|---|---|---|
| **Mobile <640** | Top bar (brand, health, avatar) + bottom nav (Dashboard, Wallet, Usage, Transactions, More) + More→drawer (full nav + logout) | Single column. Tables → stacked cards (label:value rows). BalanceCard is hero (big type). Charts: single column, 100% width, horizontal scroll disabled (downsampled bars). Modals → full-screen sheets. Filters collapsible above lists. |
| **Tablet 640–1023** | Icon rail (64px) + hamburger drawer; bottom nav hidden | 2-col grids for stats; tables in compact density; charts 2-up where sensible. |
| **Desktop ≥1024** | Sidebar 240px (labels), collapsible to 64px rail | Home: 4-col stats row, 2-col charts, 2-col lists (transactions | usage). Tables full width with sticky header. Content max 1200px, centered. |

Table→card pattern: `<TransactionTable>` renders `<table>` ≥768px, card list <768px (same data, one component, CSS/JSX switch by breakpoint — no duplicate queries).

Touch/pointer: hover states are never required for actions (mobile parity); `onClick` everywhere `onHover` would be.

Performance guardrails (mobile-first): route-level code splitting (Next.js default), chart lib lazy-loaded on `/dashboard/usage` only, skeleton-first rendering, no images above the fold except avatar, prefetch nav targets on hover/visibility (`<Link prefetch>`).

---

## 9. Implementation Roadmap

Sequential milestones; each ends with: `npm test` (new RTL tests), `tsc --noEmit`, `lint 0:0`, `build`, manual responsive check (3 breakpoints), commit + push. **No milestone starts before the previous is approved.**

### M1 — Foundation: design system + app shell
- Tokens (typography/spacing/color/radius/dark mode + inline no-flash script), primitives library (4.2), `AppShell` (sidebar/topbar/bottomnav/drawer), `AuthGuard` + route groups, `QueryProvider` + `apiClient` + `ApiError`, toast provider, skeleton/empty/error primitives.
- All 10 routes scaffolded as shells (placeholder content, correct nav).
- Refactor `ApiKeySection` → new primitives (no behavior change).
- Backend deps: none.
- Gate: nav correct on 3 breakpoints; 401→login redirect works; dark mode persists.

### M2 — Home (Overview)
- Backend: `GET /v1/dashboard/summary` (§6.1 #1) + tests.
- Widgets: BalanceCard + status banner, StatsRow, QuickActions, RecentTransactions, RecentUsage, ActiveKeys, SystemStatus.
- PAYMENT_REQUIRED banner logic (global, via wallet query).
- Gate: Home renders from one summary call + independent widget fallbacks; banner→topup flow works.

### M3 — Wallet + Topup + Transactions
- Backend: `GET /v1/wallet/topups` list (§6.1 #2) + tests.
- Wallet page (balance, quick topup, history), Topup page (amount selector, intent card, 3s polling, terminal states, retry w/ same idempotency key), Transactions page (type filter, search, cursor pagination, refund flow with confirm + idempotency).
- Gate: full topup lifecycle (create→paid→balance update; create→expired→retry) tested in browser; refund updates all widgets.

### M4 — Usage + Models
- Backend: price fields in `/v1/models` (§6.1 #6) + tests.
- Usage page (filter bar, 3 charts via lazy-loaded Recharts, usage table w/ cursor), Models page (model cards + provider capabilities), usage row → refund entry point (links to Transactions).
- Gate: charts match table sums; model prices render as money strings.

### M5 — Profile + Security + Settings + API Keys polish
- Backend: `PATCH /v1/me`, `POST /auth/change-password`, `GET/DELETE /auth/sessions` (§6.1 #3-5) + tests.
- Profile form, Security page (password, sessions list/revoke, logout-all, future placeholders), Settings (theme, defaults, notifications placeholder), API Keys rotate flow + empty-state code snippet.
- Gate: profile update persists; password change forces re-login; session revoke works.

### M6 — Hardening & review (production readiness)
- Full a11y pass (7.3 checklist), 429/offline/empty-state audit, e2e of the 6 critical flows (7.2), perf pass (bundle, chart lazy-load, prefetch), docs update (README dashboard section), tech-debt notes.
- Verdict gate: **User Dashboard APPROVED FOR PRODUCTION** (mirrors wallet/billing closure review).

### Cross-cutting rules (per project convention)
- STEP 1 read AGENTS.md / PROJECT_STATUS / TODO → STEP 2 read Blueprint → implement ONLY current milestone → update docs → never start next task before approval.
- Read `node_modules/next/dist/docs/` before Next.js-specific code ("This is NOT the Next.js you know").
- Tests: Vitest + React Testing Library + MSW (mock `/api/*` responses from OpenAPI fixtures); money assertions use string equality.
- Commits: `feat(dashboard-m1): ...` style, force-with-lease amend per convention, push to origin/main.

---

## 10. Out of Scope (explicit)

- Admin Dashboard (all of it — separate phase with TOTP).
- Streaming/SSE playground UI, embeddings/vision UI.
- CSV export, per-key analytics, notifications delivery, Google login, 2FA (future placeholders only).
- Any change to existing backend contracts (all additions are additive and gated by approval).

---

## Status

**User Dashboard Design — ✅ APPROVED FOR IMPLEMENTATION** (2026-07-31)
