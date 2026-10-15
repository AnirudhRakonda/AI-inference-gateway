# AI Inference Gateway

This repository is the starting point for a production-oriented multi-LLM routing and token analytics platform.

## Current status

Chapters 1 and 2 add registration/login, cookie-based authentication, role-protected admin routes, the Prisma PostgreSQL data layer, and a live system-health dashboard. The repository includes a Next.js frontend, a Fastify API backend, a FastAPI AI service, and Docker Compose orchestration for PostgreSQL and Redis.

## Proposed architecture

### Monorepo layout

- apps/web — Next.js + React + Tailwind frontend
- apps/api — Node.js + TypeScript backend (Fastify or NestJS)
- apps/ai-service — Python + FastAPI service for classification, guardrails, and future ML/routing intelligence
- packages/types — shared TypeScript domain types and schema contracts
- packages/config — environment and configuration helpers
- packages/llm-providers — provider adapters and registry
- packages/routing — route selection and decision engine
- packages/guardrails — guardrail pipeline and validation
- packages/database — Prisma schema and database helpers
- docs — architecture and operational documentation
- tests — integration, unit, and E2E test suites

### Core principles

1. Provider abstraction first: no provider-specific code in the routing engine.
2. Type-safe contracts: use Zod or equivalent validation for structured prompt classification and routing decisions.
3. Security by design: encrypted credential storage, no raw key logging, RBAC, rate limiting, and sanitized observability.
4. Incremental delivery: each chapter adds a small, testable slice of the system.

### Proposed stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- API backend: Node.js + TypeScript + Fastify or NestJS
- AI service: Python + FastAPI
- Database: PostgreSQL + Prisma
- Cache / rate limiting: Redis
- Container orchestration: Docker Compose

### Initial chapter plan

The project is implemented one chapter at a time as requested; see [TODO.md](TODO.md) for current progress.

## Run the dashboard

Copy `.env.example` to `.env`, replace `JWT_SECRET` with a unique value of at least 32 bytes, then start the services with `docker compose up --build`. Open [http://localhost:3000](http://localhost:3000). The dashboard checks API, AI-service, and PostgreSQL health, shows live database row counts, and lets you create an account or sign in. The API container applies committed Prisma migrations before starting.

New registrations receive the `USER` role. To create or promote an administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your environment and run `npm run db:seed`; this also sets the supplied password for that account. Do not put real credentials in source control. An admin can then sign in to view the registered-user list in the dashboard. The API rechecks the current database role on each admin request.

For local development, start PostgreSQL and run `npm run db:migrate` from the repository root before starting the API. Set `DATABASE_URL`, `JWT_SECRET`, and `WEB_ORIGIN` as described in `.env.example`. `npm run db:generate` regenerates Prisma Client after schema changes.

Passwords must be at least 12 characters and no more than 72 UTF-8 bytes; they are hashed with bcrypt. Authentication uses a one-hour, HTTP-only session cookie; the cookie is marked `Secure` in production.

## Security note

The application will not store raw provider API keys in plaintext. Credential encryption, secure secret handling, access control, and audit-safe log policies are core requirements.

## Next step

Await explicit implementation instructions for the next chapter before writing application code.
