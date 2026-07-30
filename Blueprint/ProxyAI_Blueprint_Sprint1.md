# ProxyAI Blueprint v1

## Sprint 1 - Foundation

# 00. Project Overview

## Purpose

ProxyAI is a commercial AI Gateway that provides OpenAI-compatible APIs
backed by DeepInfra. The platform focuses on simplicity, security,
wallet-based billing, and production readiness.

### Objectives

-   Sell AI API access.
-   Provide OpenAI-compatible endpoints.
-   Wallet-based billing.
-   Secure administration.
-   High performance.

------------------------------------------------------------------------

# 01. Product Vision

## Vision Statement

Build the simplest commercial AI Gateway that developers can integrate
within minutes while remaining secure, maintainable, and scalable.

## Target Users

-   Individual developers
-   Startups
-   Agencies
-   SaaS builders

## Success Metrics

-   API latency \< 500ms overhead
-   99.9% uptime
-   Zero critical security issues
-   Transparent wallet billing

------------------------------------------------------------------------

# 02. Product Requirements Document (PRD)

## Functional Requirements

### Authentication

-   Email/password login
-   JWT authentication
-   Refresh token
-   TOTP for admin

### Wallet

-   Top-up balance
-   Automatic deduction
-   Transaction history
-   Balance validation before inference

### API

-   POST /v1/chat/completions
-   GET /v1/models
-   Streaming support
-   OpenAI-compatible JSON

### Dashboard

User Dashboard: - Wallet - API Keys - Usage - Transactions

Admin Dashboard: - Users - Wallet - Pricing - AI Configuration - Audit
Logs

------------------------------------------------------------------------

## Non-Functional Requirements

-   HTTPS only
-   TypeScript only
-   Prisma ORM
-   Supabase PostgreSQL
-   Next.js 15
-   Tailwind CSS v4
-   Lighthouse \>95

------------------------------------------------------------------------

# 03. Software Requirements Specification (SRS)

## System Context

Client → API Gateway → Authentication → Wallet Validation → AI Provider
Adapter → DeepInfra → Usage Collector → Billing Engine → Logs

## Constraints

-   Initial provider: DeepInfra
-   Initial models:
    -   DeepSeek V4 Flash
    -   DeepSeek V4 Pro

Future providers must be supported using an adapter pattern.

------------------------------------------------------------------------

# 04. Business Rules

1.  Every request requires a valid API key.
2.  Wallet balance must be sufficient before forwarding requests.
3.  Pricing calculations occur only on the backend.
4.  Internal prompts are never exposed.
5.  Audit logs are immutable.
6.  Dangerous admin actions require TOTP confirmation.
7.  Streaming responses must not wait for database logging.
8.  Pricing logic must remain confidential.
9.  Admin and public applications are separated by domain.
10. Every billing event generates a transaction record.

------------------------------------------------------------------------

# Sprint Status

Completed: - Project Overview - Product Vision - PRD - SRS - Business
Rules

Next Sprint: - System Architecture - Tech Stack - Folder Structure -
Database Design - ERD - Prisma Schema
