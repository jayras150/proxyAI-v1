# Graph Report - .  (2026-07-31)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 265 nodes · 550 edges · 19 communities (15 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.75)
- Token cost: 819 input · 964 output

## Graph Freshness
- Built from commit: `064f3473`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ProxyAI Blueprint Architecture
- Authentication Token Service
- API Key Authorization
- TypeScript Configuration
- Runtime Dependencies
- App Layouts and Pages
- Development Tooling
- Reliability and Testing Strategy
- External Documentation Links
- Agent Instructions Docs
- ESLint Configuration
- Next.js Configuration
- PostCSS Configuration

## God Nodes (most connected - your core abstractions)
1. `ProxyAI Blueprint v1 (Consolidated Draft)` - 29 edges
2. `ProxyAI Blueprint Sprint 2 — Architecture & Data Layer` - 19 edges
3. `compilerOptions` - 16 edges
4. `ProxyAI Blueprint Sprint 10 — Architecture Diagrams & State Machines` - 16 edges
5. `ProxyAI Blueprint Sprint 3 — API Gateway & Provider Layer` - 15 edges
6. `Authentication Service` - 15 edges
7. `successResponse()` - 14 edges
8. `errorResponse()` - 14 edges
9. `Wallet System` - 14 edges
10. `API Gateway` - 13 edges

## Surprising Connections (you probably didn't know these)
- `ProxyAI Blueprint Sprint 12 — UI Design System & Frontend Architecture` --references--> `typescript`  [EXTRACTED]
  Blueprint/ProxyAI_Blueprint_Sprint12.md → package.json
- `ProxyAI Blueprint Sprint 2 — Architecture & Data Layer` --references--> `typescript`  [EXTRACTED]
  Blueprint/ProxyAI_Blueprint_Sprint2.md → package.json
- `ProxyAI Blueprint Sprint 16 — Consolidation, Governance & Final Readiness` --references--> `ProxyAI Blueprint v1 (Consolidated Draft)`  [INFERRED]
  Blueprint/ProxyAI_Blueprint_Sprint16.md → ProxyAI_Blueprint_v1_Consolidated_Draft.md
- `ProxyAI Blueprint v1 (Consolidated Draft)` --references--> `ProxyAI Blueprint Sprint 14 — Architecture Decisions, Quality & Scalability`  [EXTRACTED]
  ProxyAI_Blueprint_v1_Consolidated_Draft.md → Blueprint/ProxyAI_Blueprint_Sprint14.md
- `ProxyAI Blueprint v1 (Consolidated Draft)` --references--> `ProxyAI Blueprint Sprint 15 — Testing, Reliability, FinOps & Compliance`  [EXTRACTED]
  ProxyAI_Blueprint_v1_Consolidated_Draft.md → Blueprint/ProxyAI_Blueprint_Sprint15.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **ProxyAI Core Service Architecture** — concept_api_gateway, concept_authentication, concept_wallet_system, concept_billing_engine, concept_pricing_engine, concept_provider_adapter, concept_ai_configuration, concept_audit_logs [EXTRACTED 0.95]
- **Chat Completion Request Lifecycle (Validate Key → Validate Wallet → Provider → Bill)** — concept_api_gateway, concept_authentication, concept_api_keys, concept_wallet_system, concept_provider_adapter, concept_deepinfra, concept_usage_logs, concept_billing_engine [EXTRACTED 0.95]
- **ProxyAI Blueprint Sprint Series (Sprint 1–16 consolidated)** — blueprint_proxyai_blueprint_sprint1, blueprint_proxyai_blueprint_sprint2, blueprint_proxyai_blueprint_sprint3, blueprint_proxyai_blueprint_sprint4, blueprint_proxyai_blueprint_sprint5, blueprint_proxyai_blueprint_sprint6, blueprint_proxyai_blueprint_sprint7, blueprint_proxyai_blueprint_sprint8, blueprint_proxyai_blueprint_sprint9, blueprint_proxyai_blueprint_sprint10, blueprint_proxyai_blueprint_sprint11, blueprint_proxyai_blueprint_sprint12, blueprint_proxyai_blueprint_sprint13, blueprint_proxyai_blueprint_sprint14, blueprint_proxyai_blueprint_sprint15, blueprint_proxyai_blueprint_sprint16, proxyai_blueprint_v1_consolidated_draft [EXTRACTED 0.85]

## Communities (19 total, 4 thin omitted)

### Community 0 - "ProxyAI Blueprint Architecture"
Cohesion: 0.12
Nodes (57): ProxyAI Blueprint Sprint 1 — Foundation, ProxyAI Blueprint Sprint 10 — Architecture Diagrams & State Machines, ProxyAI Blueprint Sprint 11 — Enterprise Security & Operations, ProxyAI Blueprint Sprint 12 — UI Design System & Frontend Architecture, ProxyAI Blueprint Sprint 13 — Engineering Standards & Governance, ProxyAI Blueprint Sprint 16 — Consolidation, Governance & Final Readiness, ProxyAI Blueprint Sprint 2 — Architecture & Data Layer, ProxyAI Blueprint Sprint 3 — API Gateway & Provider Layer (+49 more)

### Community 1 - "Authentication Token Service"
Cohesion: 0.11
Nodes (30): POST(), POST(), env, generateSecureToken(), generateAccessToken(), generateRefreshToken(), generateTokens(), ms() (+22 more)

### Community 2 - "API Key Authorization"
Cohesion: 0.10
Nodes (24): DELETE(), AuthError, GET(), getUserIdFromRequest(), POST(), POST(), POST(), generateApiKey() (+16 more)

### Community 3 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (23): bcryptjs, jsonwebtoken, next, dependencies, bcryptjs, jsonwebtoken, next, prisma (+15 more)

### Community 5 - "App Layouts and Pages"
Cohesion: 0.16
Nodes (14): DashboardLayout(), DashboardPage(), geistMono, geistSans, metadata, LoginPage(), RegisterPage(), ApiKeyItem (+6 more)

### Community 6 - "Development Tooling"
Cohesion: 0.10
Nodes (20): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/bcryptjs (+12 more)

### Community 7 - "Reliability and Testing Strategy"
Cohesion: 0.29
Nodes (7): ProxyAI Blueprint Sprint 14 — Architecture Decisions, Quality & Scalability, ProxyAI Blueprint Sprint 15 — Testing, Reliability, FinOps & Compliance, Architecture Decision Records (ADR), Reliability, Chaos Engineering & Business Continuity, Scalability Roadmap (Multi-region / Multi-provider), Structured Logging, Testing Strategy (Unit / Integration / E2E / Chaos)

### Community 8 - "External Documentation Links"
Cohesion: 0.40
Nodes (4): Learn Next.js (external), Next.js Documentation (external), Next.js GitHub Repository (external), Geist / Vercel Font (external)

## Ambiguous Edges - Review These
- `PROJECT_STATUS.md` → `ProxyAI Blueprint v1 (Consolidated Draft)`  [AMBIGUOUS]
  PROJECT_STATUS.md · relation: references

## Knowledge Gaps
- **76 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `PROJECT_STATUS.md` and `ProxyAI Blueprint v1 (Consolidated Draft)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `devDependencies` connect `Development Tooling` to `Runtime Dependencies`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `typescript` connect `ProxyAI Blueprint Architecture` to `Development Tooling`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `typescript` connect `Development Tooling` to `ProxyAI Blueprint Architecture`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _76 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ProxyAI Blueprint Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.1163062536528346 - nodes in this community are weakly interconnected._
- **Should `Authentication Token Service` be split into smaller, more focused modules?**
  _Cohesion score 0.10505050505050505 - nodes in this community are weakly interconnected._