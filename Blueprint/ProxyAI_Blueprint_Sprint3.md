# ProxyAI Blueprint v1

# Sprint 3 - API Gateway & Provider Layer

# 12. OpenAI Compatible API

## Objectives

ProxyAI must expose endpoints compatible with the OpenAI Chat
Completions API so existing SDKs require little or no modification.

## Base URL

    https://api.proxyai.live/v1

## Endpoints

### GET /models

Returns enabled models.

Response

``` json
{
  "object":"list",
  "data":[
    {
      "id":"deepseek-v4-flash",
      "object":"model",
      "owned_by":"proxyai"
    }
  ]
}
```

------------------------------------------------------------------------

### POST /chat/completions

Headers

Authorization: Bearer `<API_KEY>`{=html}

Body

``` json
{
  "model":"deepseek-v4-flash",
  "messages":[
    {
      "role":"user",
      "content":"Hello"
    }
  ],
  "stream":true
}
```

Supported fields

-   model
-   messages
-   temperature
-   top_p
-   max_tokens
-   stream
-   response_format (future)
-   tools (future)

Unsupported fields should return a validation error.

------------------------------------------------------------------------

# 13. Request Lifecycle

``` text
Client
   │
   ▼
API Gateway
   │
Validate API Key
   │
Validate User
   │
Validate Wallet
   │
Load Model Config
   │
Inject System Prompt
   │
Provider Adapter
   │
DeepInfra
   │
Receive Stream
   │
Usage Collector
   │
Pricing Engine
   │
Wallet Deduction
   │
Usage Log
   │
Return Finished
```

Streaming must never wait for database writes.

------------------------------------------------------------------------

# 14. Provider Adapter

## Goal

Business logic must never depend directly on DeepInfra.

Interface

``` ts
ProviderAdapter {
  listModels()
  chatCompletion()
  streamCompletion()
}
```

Future providers only implement this interface.

Benefits

-   Easy provider switching
-   Easier testing
-   No vendor lock-in

------------------------------------------------------------------------

# 15. Streaming Architecture

Protocol

Server-Sent Events (SSE)

Flow

``` text
Provider Stream
        │
        ▼
Transform Chunk
        │
        ▼
Forward Chunk
        │
        ▼
Client
```

Rules

-   Preserve chunk order.
-   Flush immediately.
-   Close gracefully.
-   Capture token usage after completion.

------------------------------------------------------------------------

# 16. Billing Pipeline

Billing occurs after the provider returns usage statistics.

Flow

``` text
Usage
   │
   ▼
Provider Cost
   │
   ▼
Internal Pricing Function
   │
   ▼
Wallet Deduction
   │
   ▼
Transaction Record
   │
   ▼
Usage Log
```

Pricing logic must remain server-side.

------------------------------------------------------------------------

# 17. Error Specification

Standard response

``` json
{
  "success":false,
  "code":"INSUFFICIENT_BALANCE",
  "message":"Wallet balance is insufficient."
}
```

Common codes

-   INVALID_API_KEY
-   MODEL_DISABLED
-   MODEL_NOT_FOUND
-   RATE_LIMITED
-   PROVIDER_TIMEOUT
-   PROVIDER_ERROR
-   INSUFFICIENT_BALANCE
-   INVALID_REQUEST
-   INTERNAL_SERVER_ERROR

Never expose stack traces.

------------------------------------------------------------------------

# 18. Retry Strategy

Retry only when safe.

Retry

-   502
-   503
-   504
-   transient network failures

Do NOT retry

-   authentication errors
-   validation errors
-   insufficient balance

Maximum retries

3

Exponential backoff

250ms

500ms

1000ms

------------------------------------------------------------------------

# Sprint 3 Status

Completed

-   OpenAI Compatible API
-   API Contracts
-   Request Lifecycle
-   Provider Adapter
-   Streaming Architecture
-   Billing Pipeline
-   Error Specification
-   Retry Strategy

Next Sprint

Wallet System

Billing Engine

Pricing Engine

Transactions

Usage Accounting
