# ProxyAI Blueprint v1

# Sprint 5 - User Dashboard & Admin Dashboard Specification

# 27. Dashboard Philosophy

The dashboard must prioritize simplicity. A new user should understand
the platform within five minutes.

Design principles:

-   Clean
-   Fast
-   Minimal
-   Responsive
-   Accessible
-   Wallet-first
-   Mobile-friendly

Never imitate the complexity of cloud providers.

------------------------------------------------------------------------

# 28. User Dashboard

## Navigation

    Dashboard
    ├── Home
    ├── API Keys
    ├── Models
    ├── Usage
    ├── Transactions
    └── Settings

------------------------------------------------------------------------

## Home

Purpose: Provide an overview of the user's account.

Widgets:

-   Wallet Balance
-   Top Up
-   Active API Keys
-   Requests Today
-   Today's Spending
-   Recent Transactions
-   Latest Usage

Quick Actions:

-   Create API Key
-   Buy Credits
-   View Documentation
-   Copy API Endpoint

------------------------------------------------------------------------

## API Keys

Capabilities

-   Create Key
-   Rename
-   Disable
-   Delete
-   Regenerate
-   Copy

Displayed Information

-   Name
-   Prefix
-   Created At
-   Last Used
-   Status

Rules

-   Secret shown only once.
-   Store hashed keys only.
-   Never display full key again.

------------------------------------------------------------------------

## Models

Show:

-   Model Name
-   Description
-   Context Window
-   Input Price
-   Output Price
-   Availability
-   Supported Features

Future Features

-   Vision
-   Function Calling
-   JSON Mode

------------------------------------------------------------------------

## Usage

Charts

-   Requests per Day
-   Tokens per Day
-   Cost per Day

Tables

-   Timestamp
-   Model
-   Prompt Tokens
-   Completion Tokens
-   Cost
-   Latency

Filters

-   Date Range
-   Model
-   API Key

------------------------------------------------------------------------

## Transactions

Show

-   Type
-   Amount
-   Before Balance
-   After Balance
-   Reference
-   Status
-   Timestamp

Support CSV export in future versions.

------------------------------------------------------------------------

## Settings

Sections

-   Profile
-   Password
-   API Preferences
-   Notifications
-   Delete Account

------------------------------------------------------------------------

# 29. Admin Dashboard

Navigation

    Dashboard
    ├── Users
    ├── Wallet
    ├── Transactions
    ├── Models
    ├── AI Configuration
    ├── Audit Logs
    └── Settings

------------------------------------------------------------------------

## Dashboard

Widgets

-   Revenue Today
-   Requests Today
-   Active Users
-   Active API Keys
-   Wallet Balance Total
-   Provider Status
-   Error Rate

Charts

-   Revenue
-   Token Usage
-   Model Distribution
-   API Requests

------------------------------------------------------------------------

## Users

Actions

-   Search
-   Filter
-   View
-   Suspend
-   Activate
-   Reset Password
-   Add Credit
-   Deduct Credit
-   View API Keys
-   View Usage
-   Delete

Every dangerous action requires TOTP approval.

------------------------------------------------------------------------

## Wallet Management

Capabilities

-   Credit Wallet
-   Debit Wallet
-   Manual Adjustment
-   Refund

Every operation must create:

-   Transaction
-   Audit Log

------------------------------------------------------------------------

## Model Management

Fields

-   Display Name
-   Provider
-   Internal Model ID
-   Enabled
-   Temperature Default
-   Max Tokens
-   Context Window

Actions

-   Enable
-   Disable
-   Update Configuration

------------------------------------------------------------------------

# 30. AI Configuration

Global Configuration

-   Global System Prompt
-   Prompt Sanitizer
-   Prompt Injection Protection
-   Provider Visibility
-   Safety Rules

Per Model

-   Temperature
-   Top P
-   Max Output Tokens
-   Streaming
-   JSON Mode
-   Tool Calling
-   Default Prompt

Variables

-   {{DATE}}
-   {{TIME}}
-   {{MODEL}}
-   {{USER_ID}}
-   {{LANGUAGE}}
-   {{TIMEZONE}}

------------------------------------------------------------------------

# 31. Audit Logs

Columns

-   Timestamp
-   Admin
-   Action
-   Resource
-   Before
-   After
-   IP Address
-   User Agent
-   Status

Features

-   Search
-   Filter
-   Export (future)

Audit logs are immutable.

------------------------------------------------------------------------

# 32. Responsive Design

Desktop

-   Sidebar + Content

Tablet

-   Collapsible Sidebar

Mobile

-   Bottom Navigation
-   Drawer Menu

All pages must support:

-   Skeleton Loading
-   Empty States
-   Error States
-   Loading Indicators

------------------------------------------------------------------------

# Sprint 5 Status

Completed

-   User Dashboard
-   Admin Dashboard
-   API Key Management
-   Usage Analytics
-   Transactions UI
-   AI Configuration UI
-   Audit Logs UI
-   Responsive Design

Next Sprint

-   Authentication
-   RBAC
-   TOTP
-   Approval Session
-   Security
-   OWASP
