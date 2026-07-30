# ProxyAI Blueprint V2

# Sprint 10 - Architecture Diagrams & State Machines

# 70. System Component Diagram

``` mermaid
graph TD
A[Client SDK/Web] --> B[API Gateway]
B --> C[Authentication]
B --> D[Wallet Service]
B --> E[Pricing Engine]
B --> F[AI Configuration]
B --> G[Provider Adapter]
G --> H[DeepInfra]
H --> I[DeepSeek Models]
D --> J[(PostgreSQL)]
E --> J
C --> J
F --> J
```

## Component Responsibilities

  Component          Responsibility
  ------------------ ----------------------------------------
  API Gateway        Request routing, validation, streaming
  Authentication     JWT, API Key, Sessions
  Wallet Service     Balance validation & deduction
  Pricing Engine     Cost calculation
  Provider Adapter   Abstract AI providers
  AI Configuration   Prompt injection & model settings

------------------------------------------------------------------------

# 71. Chat Completion Sequence

``` mermaid
sequenceDiagram
participant C as Client
participant G as API Gateway
participant W as Wallet
participant P as Provider
participant DB as Database

C->>G: POST /chat/completions
G->>W: Validate Balance
W-->>G: OK
G->>P: Forward Request
P-->>G: Stream Chunks
G-->>C: Stream SSE
P-->>G: Usage
G->>DB: Save Usage
G->>W: Deduct Balance
W->>DB: Create Transaction
```

------------------------------------------------------------------------

# 72. Login Sequence

``` mermaid
sequenceDiagram
participant U as User
participant A as Auth
participant DB as Database

U->>A: Email + Password
A->>DB: Verify User
DB-->>A: Success
A-->>U: Access + Refresh Token
```

Admin Login

``` mermaid
sequenceDiagram
participant Admin
participant Auth
participant TOTP

Admin->>Auth: Email + Password
Auth->>TOTP: Verify Code
TOTP-->>Auth: Valid
Auth-->>Admin: Session Created
```

------------------------------------------------------------------------

# 73. Wallet State Machine

``` mermaid
stateDiagram-v2
[*] --> Active
Active --> Locked
Locked --> Active
Active --> Suspended
Suspended --> Active
```

Rules

-   Active wallets may create requests.
-   Locked wallets reject spending.
-   Suspended wallets reject all operations.

------------------------------------------------------------------------

# 74. API Key State Machine

``` mermaid
stateDiagram-v2
[*] --> Active
Active --> Disabled
Disabled --> Active
Active --> Revoked
Disabled --> Revoked
Revoked --> [*]
```

Revoked keys cannot be restored.

------------------------------------------------------------------------

# 75. Transaction Lifecycle

``` mermaid
flowchart LR
A[Request] --> B[Billing]
B --> C[Transaction]
C --> D[Audit Log]
D --> E[Completed]
```

Transactions are append-only.

------------------------------------------------------------------------

# 76. Deployment Diagram

``` mermaid
graph LR
User --> Cloudflare
Cloudflare --> Vercel
Vercel --> API
API --> Supabase
API --> DeepInfra
```

Future

-   CDN
-   Redis cache
-   Queue workers
-   Multi-region

------------------------------------------------------------------------

# 77. Error Flow

``` mermaid
flowchart TD
Request --> Validate
Validate -->|Fail| Error
Validate --> Provider
Provider -->|Timeout| Retry
Retry --> Provider
Provider --> Success
Success --> Billing
Billing --> Response
```

------------------------------------------------------------------------

# 78. Observability

Metrics

-   Requests/sec
-   Latency
-   Error rate
-   Provider latency
-   Billing latency
-   Wallet failures

Tracing

-   request_id
-   user_id
-   api_key_id
-   transaction_id

Logging

-   Structured JSON
-   Correlation IDs

------------------------------------------------------------------------

# Sprint 10 Status

Completed

-   Component Diagram
-   Login Sequence
-   Chat Sequence
-   Wallet State Machine
-   API Key State Machine
-   Transaction Flow
-   Deployment Diagram
-   Error Flow
-   Observability

Next Sprint

-   Threat Model (STRIDE)
-   Complete RBAC Matrix
-   Security Runbooks
-   Incident Response
-   SLO/SLI
