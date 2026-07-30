# ProxyAI Blueprint V2

# Sprint 9 - OpenAPI 3.1 Specification (Core APIs)

## 58. API Standards

Base URL

    https://api.proxyai.live/v1

Content-Type

    application/json

Authentication

    Authorization: Bearer <API_KEY>

Versioning

-   URL based (`/v1`)
-   Breaking changes require `/v2`
-   Additive fields are backward compatible

------------------------------------------------------------------------

## 59. Standard Response Contract

### Success

``` json
{
  "success": true,
  "data": {},
  "request_id": "req_xxx"
}
```

### Error

``` json
{
  "success": false,
  "code": "INVALID_API_KEY",
  "message": "The supplied API key is invalid.",
  "request_id": "req_xxx"
}
```

------------------------------------------------------------------------

## 60. Authentication APIs

### POST /auth/register

Purpose

-   Create user account

Validation

-   Email unique
-   Password policy enforced

Responses

-   201 Created
-   400 Validation Error
-   409 Email Exists

------------------------------------------------------------------------

### POST /auth/login

Returns

-   Access Token
-   Refresh Token
-   User Profile

------------------------------------------------------------------------

### POST /auth/refresh

Rotates refresh token.

------------------------------------------------------------------------

### POST /auth/logout

Revokes active session.

------------------------------------------------------------------------

## 61. API Key APIs

### GET /api-keys

List API keys.

### POST /api-keys

Create API key.

### DELETE /api-keys/{id}

Revoke API key.

Rules

-   Secret returned only once.
-   Keys stored as hashes.

------------------------------------------------------------------------

## 62. Chat Completion API

### POST /chat/completions

Supported Parameters

-   model
-   messages
-   temperature
-   top_p
-   max_tokens
-   stream

Streaming

Server-Sent Events (SSE)

Headers

    Content-Type: text/event-stream
    Cache-Control: no-cache
    Connection: keep-alive

------------------------------------------------------------------------

## 63. Models API

### GET /models

Returns enabled public models.

Fields

-   id
-   name
-   context_window
-   input_price
-   output_price
-   capabilities

------------------------------------------------------------------------

## 64. Wallet APIs

### GET /wallet

Current balance.

### GET /transactions

Paginated transaction history.

Future

-   Top-up callback
-   Refund endpoint

------------------------------------------------------------------------

## 65. Admin APIs

Protected by JWT + RBAC + TOTP.

Examples

-   GET /admin/users
-   POST /admin/wallet/credit
-   POST /admin/wallet/debit
-   PUT /admin/models/{id}
-   PUT /admin/ai-configuration

------------------------------------------------------------------------

## 66. HTTP Status Codes

-   200 OK
-   201 Created
-   204 No Content
-   400 Bad Request
-   401 Unauthorized
-   403 Forbidden
-   404 Not Found
-   409 Conflict
-   422 Validation Error
-   429 Too Many Requests
-   500 Internal Server Error
-   502 Bad Gateway
-   503 Service Unavailable

------------------------------------------------------------------------

## 67. Rate Limits

Anonymous

-   60 req/min

Authenticated

-   Configurable per API key

Admin

-   Higher limits

Headers

-   X-RateLimit-Limit
-   X-RateLimit-Remaining
-   Retry-After

------------------------------------------------------------------------

## 68. Idempotency

Supported on billing-related endpoints.

Header

    X-Idempotency-Key

Retention

24 hours

------------------------------------------------------------------------

## 69. OpenAPI Requirements

The final implementation must include:

-   OpenAPI 3.1 YAML
-   JSON Schema components
-   Reusable request bodies
-   Reusable responses
-   Security schemes
-   Example payloads
-   Error catalog

------------------------------------------------------------------------

## Sprint 9 Status

Completed

-   API Standards
-   Response Contract
-   Authentication APIs
-   API Key APIs
-   Chat API
-   Models API
-   Wallet APIs
-   Admin APIs
-   HTTP Status Catalog
-   Rate Limits
-   Idempotency
-   OpenAPI Requirements

Next Sprint

-   Mermaid Diagrams
-   Sequence Diagrams
-   Component Diagrams
-   Deployment Diagrams
-   State Machines
