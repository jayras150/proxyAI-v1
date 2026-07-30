# ProxyAI Blueprint v1

# Sprint 6 - Authentication, RBAC & Security

# 33. Authentication Architecture

## Objectives

Provide secure authentication for users and administrators while
minimizing attack surface.

Authentication Types

-   User Login
-   Admin Login
-   API Key Authentication

Supported Methods

-   Email + Password
-   JWT Access Token
-   Refresh Token
-   HttpOnly Secure Cookie
-   TOTP (Admin)

------------------------------------------------------------------------

# User Authentication Flow

``` text
Email
   │
Password
   │
Validate Credentials
   │
Generate Access Token
   │
Generate Refresh Token
   │
Store Session
   │
Dashboard
```

Access Token

-   Short lifetime (15--30 minutes)

Refresh Token

-   Long lifetime (30 days)
-   Rotated after every refresh
-   Revoked on logout

------------------------------------------------------------------------

# Admin Authentication Flow

``` text
Email
   │
Password
   │
Password Verified
   │
TOTP Verification
   │
Create Session
   │
Admin Dashboard
```

Admin login is not allowed without successful TOTP verification.

------------------------------------------------------------------------

# 34. RBAC (Role-Based Access Control)

Roles

-   USER
-   ADMIN
-   SUPER_ADMIN

Permission Matrix

  Action                      User   Admin   Super Admin
  -------------------------- ------ ------- -------------
  View Own Usage               ✓       ✓          ✓
  Create API Key               ✓       ✓          ✓
  View Users                   ✗       ✓          ✓
  Credit Wallet                ✗       ✓          ✓
  Change AI Config             ✗       ✓          ✓
  Delete User                  ✗       ✗          ✓
  Change Security Settings     ✗       ✗          ✓

Principles

-   Least Privilege
-   Explicit Deny
-   Server-side authorization only

------------------------------------------------------------------------

# 35. API Key Security

Rules

-   API keys generated using cryptographically secure random values.
-   Store only a hash.
-   Display the full key once.
-   Support regeneration and revocation.

Recommended Prefix

    pk_live_
    pk_test_

Future Support

-   IP Restrictions
-   Expiration
-   Usage Limits

------------------------------------------------------------------------

# 36. TOTP

RFC

6238

Compatible Apps

-   Google Authenticator
-   Microsoft Authenticator
-   Authy
-   1Password

Setup Flow

``` text
Generate Secret
      │
Create QR Code
      │
User Scans QR
      │
Verify First Code
      │
TOTP Enabled
```

Recovery

-   Generate 10 one-time recovery codes.
-   Store hashed recovery codes.

------------------------------------------------------------------------

# 37. Approval Session

Dangerous actions require a recent TOTP verification.

Protected Actions

-   Credit Wallet
-   Debit Wallet
-   Delete User
-   Suspend User
-   Change Pricing
-   Change AI Configuration
-   Change SMTP
-   Change Environment

Flow

``` text
Admin Requests Action
        │
TOTP Challenge
        │
Approval Session Created
        │
Valid For 5 Minutes
        │
Protected Actions Allowed
        │
Session Expires
```

------------------------------------------------------------------------

# 38. Security Controls

Transport

-   HTTPS
-   TLS 1.3

Application

-   CSP
-   HSTS
-   X-Frame-Options
-   X-Content-Type-Options
-   Referrer-Policy

Validation

-   Zod
-   Parameterized Queries
-   Strict Input Validation

Secrets

-   Environment Variables
-   Never expose provider credentials
-   Encrypt sensitive configuration at rest

------------------------------------------------------------------------

# 39. OWASP Checklist

Protect Against

-   SQL Injection
-   XSS
-   CSRF
-   SSRF
-   Broken Authentication
-   Broken Access Control
-   Security Misconfiguration
-   Sensitive Data Exposure
-   Rate Limit Abuse

Security Requirements

-   Security headers enabled
-   Centralized error handling
-   No stack traces in production
-   Immutable audit logs
-   Password hashing with Argon2id or bcrypt (cost configured
    appropriately)

------------------------------------------------------------------------

# 40. Logging & Monitoring

Security Events

-   Login Success
-   Login Failure
-   API Key Created
-   API Key Revoked
-   Wallet Updated
-   Pricing Changed
-   AI Configuration Updated
-   Permission Denied

Monitoring

-   Error Rate
-   API Latency
-   Provider Availability
-   Wallet Failures
-   Billing Failures

Alerts

-   Excessive login failures
-   Provider outages
-   Unexpected billing errors

------------------------------------------------------------------------

# Sprint 6 Status

Completed

-   Authentication Architecture
-   Admin Authentication
-   RBAC
-   API Key Security
-   TOTP
-   Approval Session
-   Security Controls
-   OWASP Checklist
-   Logging & Monitoring

Next Sprint

-   Deployment Architecture
-   CI/CD
-   Backup & Restore
-   Disaster Recovery
-   Testing Strategy
-   AI Agent Development Rules
