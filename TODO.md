# Project TODO

## Current Chapter

Chapter 2 — Database & Prisma Models

## Status

✅ Complete

---

# Chapter 0

- [x] Define architecture
- [x] Initialize monorepo
- [x] Setup Next.js
- [x] Setup Node.js API
- [x] Setup FastAPI
- [x] Setup PostgreSQL
- [x] Setup Redis
- [x] Setup Docker
- [x] Setup linting
- [x] Setup testing
- [x] Create environment configuration
- [x] Create README
- [x] Create TODO.md

---

# Chapter 1

- [x] User model
- [x] Registration
- [x] Login
- [x] Authentication
- [x] RBAC
- [x] Admin role
- [x] Protected routes

---

# Chapter 2

- [x] Prisma setup
- [x] Database schema
- [x] Migrations
- [x] User
- [x] Provider
- [x] Model
- [x] Conversation
- [x] Message
- [x] Usage entities

---

# Chapter 3

- [ ] Define LLMProvider abstraction
- [ ] Provider registry
- [ ] Mock provider
- [ ] First real provider
- [ ] Streaming abstraction
- [ ] Error handling
- [ ] Provider capability metadata

---

# Chapter 4

- [ ] Credential model
- [ ] Encryption at rest
- [ ] Credential CRUD
- [ ] Credential validation
- [ ] Provider connection test
- [ ] Secret-safe logging

---

# Chapter 5

- [ ] Conversation creation
- [ ] Message persistence
- [ ] Context management
- [ ] Provider-independent message format
- [ ] Streaming responses
- [ ] Conversation history

---

# Chapter 6

- [ ] Classification service
- [ ] Python FastAPI integration
- [ ] Initial categories
- [ ] Confidence score
- [ ] Type-safe classification result
- [ ] Custom categories

---

# Chapter 7

- [ ] Routing rules
- [ ] User preferences
- [ ] Primary provider
- [ ] Fallback providers
- [ ] Provider capability checking
- [ ] Rate-limit checking
- [ ] Routing decision engine

---

# Chapter 8

- [ ] Input validation
- [ ] Prompt safety checks
- [ ] Secret detection
- [ ] Prompt injection checks
- [ ] Output validation
- [ ] Guardrail event persistence

---

# Chapter 9

- [ ] Redis integration
- [ ] User limits
- [ ] Provider limits
- [ ] Endpoint limits
- [ ] Configurable limits
- [ ] Rate-limit analytics

---

# Chapter 10

- [ ] Token tracking
- [ ] Provider usage adapters
- [ ] Cost calculation
- [ ] Usage aggregation
- [ ] User analytics APIs
- [ ] Admin analytics APIs

---

# Chapter 11

- [ ] Usage dashboard
- [ ] Cost dashboard
- [ ] Routing configuration
- [ ] Provider credentials
- [ ] Prompt flags
- [ ] Conversation management

---

# Chapter 12

- [ ] User analytics
- [ ] Platform token usage
- [ ] Provider usage
- [ ] Model usage
- [ ] Cost analytics
- [ ] Guardrail analytics
- [ ] System health

---

# Chapter 13

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Security tests
- [ ] Load testing
- [ ] Error handling
- [ ] Logging
- [ ] Monitoring

---

# Chapter 14

- [ ] Production Docker configuration
- [ ] Environment management
- [ ] Migration strategy
- [ ] Secrets management
- [ ] CI/CD
- [ ] Monitoring
- [ ] Backups
- [ ] Production security review

---

# Completed

## 2026-09-30

### Chapter 0

- Inspected the repository and confirmed it is effectively empty.
- Confirmed there is no existing JEV dependency or reference in the repository.
- Documented the proposed monorepo architecture and implementation plan.
- Created project TODO and architecture overview documentation.
- Scaffolded the monorepo workspace and toolchain for frontend, API, and AI service.
- Added Docker Compose configuration for PostgreSQL, Redis, the API, AI service, and frontend.
- Added TypeScript, Next.js, Fastify, FastAPI, and environment configuration files.
- Verified the generated Chapter 0 foundation is in place and ready for the next chapter.

## 2026-10-14

### Chapters 1 and 2

- Added registration and login with bcrypt password hashes and an HTTP-only JWT session cookie.
- Added authenticated session and administrator-only user-list routes; administrator authorization uses the current database role.
- Added the Prisma PostgreSQL schema and initial migration for users, providers, models, conversations, messages, and usage records.
- Added database-aware API readiness and a system-status endpoint with live entity counts.
- Added an interactive dashboard for API, AI-service, database, account, role, and admin-route status.
- Configured Docker Compose to wait for PostgreSQL and apply migrations before starting the API.
- Added an explicit environment-driven admin seed command; registrations cannot assign themselves the admin role.
