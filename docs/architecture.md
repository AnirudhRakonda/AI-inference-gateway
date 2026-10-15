# Architecture Overview

## Purpose

This repository is planned as an API-first, multi-LLM inference gateway. Users
integrate from their own applications by sending prompts or structured JSON
state to a gateway endpoint. TypeSafe Jev classifies the request and selects an
eligible provider/model route; that provider's LLM generates the response. The
web application is a user and administrator portal, not primarily a chat
client.

## Monorepo structure

- apps/web: Next.js user and administrator portal, API-key management, integration documentation, and request playground
- apps/api: TypeScript backend and REST entrypoint
- apps/ai-service: FastAPI integration with TypeSafe Jev for structured classification and routing decisions
- packages/*: shared domain logic and contracts added in later chapters
- docs/: operational and architecture documents

## Major design choices

1. Monorepo-first structure for shared tooling and eventual cross-service builds.
2. Provider abstraction as a first-class design requirement.
3. TypeSafe Jev returns structured decisions; the application constrains candidate routes and validates Jev's selection before acting.
4. Secret-safe credential handling: encrypted provider credentials from
   Chapter 4 onward and non-recoverable user gateway-key verifiers from
   Chapter 5 onward.
5. Local development with Docker Compose and Redis/PostgreSQL for early integration and later production-hardening work.

## Database model (Chapter 2)

The API uses Prisma with PostgreSQL. The initial schema models users and roles, providers and their models, conversations and messages, and token/cost usage records. Provider/model references are retained by usage records; deleting a user cascades their conversations and usage. Provider credentials are intentionally out of scope until Chapter 4.

The API readiness endpoint verifies PostgreSQL connectivity. `/system/status` returns database entity counts for the web health dashboard; it does not expose record contents. The dashboard separately checks the API and AI service and reports unavailable services rather than presenting static sample metrics.

## Target inference and Jev decision flow

TypeSafe Jev is a decision model in the target architecture, not the model that
generates the response shown to the user. The FastAPI AI service integrates
with Jev using typed questions and structured inputs. The gateway uses Jev for
at least two distinct decisions:

1. Classify the validated request into a configured task/category and retain
   the typed result, category probabilities, and confidence.
2. After application code applies user preferences and hard routing
   constraints, present only eligible provider/model candidates to a Jev
   Choice question. Jev selects a route and returns its typed choice,
   probabilities, and confidence.

The application remains authoritative for authorization, prompt/output
guardrails, rate limits, provider/model capability checks, availability,
credential access, and validating that Jev selected one of the offered
candidates. Confidence policy and fallback re-selection are handled by
application code; Jev does not bypass those controls. If a provider call fails,
the gateway may remove that candidate and request a new Jev choice from the
remaining eligible candidates, according to configured fallback policy.

The selected provider's LLM generates the response. Jev returns structured
decisions, not user-facing generated text. See the [target user roles and use
cases](user-roles-and-use-cases.md) for the end-to-end flow, and TypeSafe's
[System One overview](https://docs.typesafe.ai/concepts/system-one) and
[Choice primitive](https://docs.typesafe.ai/primitives/choice) for the Jev
decision model and typed route selection.

## Target API-first product flow

The primary inference experience is a versioned gateway API rather than an
interactive chat page. The proposed public endpoint is `POST /v1/inference`;
the exact contract will be finalized in the API implementation chapter. It
will accept either a plain-text prompt or structured JSON state, along with
optional supported inference parameters and a request/context identifier.
Jev evaluates the input state against gateway-defined typed questions; its
classification can inform routing, while its Choice decision selects from
provider/model candidates that application code has already approved.

Users authenticate programmatic requests with gateway API keys created in
their account portal. The gateway validates the key, applies that user's
preferences, policies, and limits, and calls the chosen provider using
administrator-managed credentials. Provider credentials are never sent to the
user. The gateway returns the provider's generated response, with route and
usage metadata appropriate to the public contract; it does not redirect the
user to a provider. Streaming and non-streaming response modes are planned.

The portal supports gateway-key creation, revocation and rotation, one-time
secret display, request examples, and a playground for testing prompt or JSON
payloads. Admins continue to manage shared provider/model configuration,
credentials, Jev questions/categories, routing rules, guardrails, and limits.
The existing conversation/message schema may support optional request context
or multi-turn integrations, but a chat UI and manual conversation management
are not the primary user workflow.

Request analytics should not require indefinite retention of raw prompts or
provider responses. Content retention, redaction, and any persistence required
for optional multi-turn context remain explicit privacy-policy decisions.

Gateway API keys are distinct from LLM provider credentials: keys identify and
authorize a gateway customer, while provider credentials are managed by
administrators and used only server-side. The implementation must store only
non-recoverable API-key verifiers (with a displayed prefix/identifier for
management), never log raw keys, and scope each key to its owning user.

## Authentication and access control (Chapter 1)

Registration creates standard users only; the administrator role is assigned through the explicit Prisma seed command. Passwords are bcrypt-hashed, and login issues a one-hour JWT in an HTTP-only cookie. The cookie uses `SameSite=Lax`, is scoped to `/`, and is marked `Secure` in production. Cross-origin credentialed requests are restricted to the configured `WEB_ORIGIN`.

`/auth/me` is a protected route. `/admin/users` requires an authenticated administrator and checks the current database role on each request rather than relying on a potentially stale JWT role claim. The endpoint returns only safe user fields and is capped at the 100 most recent accounts.

See [User Roles, Access, and Use Cases](user-roles-and-use-cases.md) for the
target end-state access matrix and diagrams aligned with the project roadmap.
