# Architecture Overview

## Purpose

This repository implements a chapter-based monorepo for a multi-LLM routing and token analytics platform. The architecture intentionally separates concerns so that provider integrations, routing decisions, AI classification, and UI concerns do not become tightly coupled.

## Monorepo structure

- apps/web: Next.js user interface
- apps/api: TypeScript backend and REST entrypoint
- apps/ai-service: FastAPI classification and guardrail service
- packages/*: shared domain logic and contracts added in later chapters
- docs/: operational and architecture documents

## Major design choices

1. Monorepo-first structure for shared tooling and eventual cross-service builds.
2. Provider abstraction as a first-class design requirement.
3. Type-safe validation through structured schemas for routing and classification decisions.
4. Secret-safe credential handling and encrypted-at-rest API keys from Chapter 4 onward.
5. Local development with Docker Compose and Redis/PostgreSQL for early integration and later production-hardening work.

## Database model (Chapter 2)

The API uses Prisma with PostgreSQL. The initial schema models users and roles, providers and their models, conversations and messages, and token/cost usage records. Provider/model references are retained by usage records; deleting a user cascades their conversations and usage. Provider credentials are intentionally out of scope until Chapter 4.

The API readiness endpoint verifies PostgreSQL connectivity. `/system/status` returns database entity counts for the web health dashboard; it does not expose record contents. The dashboard separately checks the API and AI service and reports unavailable services rather than presenting static sample metrics.

## Authentication and access control (Chapter 1)

Registration creates standard users only; the administrator role is assigned through the explicit Prisma seed command. Passwords are bcrypt-hashed, and login issues a one-hour JWT in an HTTP-only cookie. The cookie uses `SameSite=Lax`, is scoped to `/`, and is marked `Secure` in production. Cross-origin credentialed requests are restricted to the configured `WEB_ORIGIN`.

`/auth/me` is a protected route. `/admin/users` requires an authenticated administrator and checks the current database role on each request rather than relying on a potentially stale JWT role claim. The endpoint returns only safe user fields and is capped at the 100 most recent accounts.
