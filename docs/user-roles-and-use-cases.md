# Target User Roles, API Flow, and Use Cases

This document describes the intended end state after the planned chapters are
implemented. The product is an API-first inference gateway: users integrate it
into their own applications using gateway API keys. The web portal supports
account management, API-key management, integration guidance, and
administration; it is not primarily a chat application.

## Actors and target access

| Actor | Target functionality and access |
| --- | --- |
| Visitor (not signed in) | Register or sign in; view public service-health information and product/API documentation. No inference calls, private request analytics, API keys, or configuration access. |
| Registered user / API consumer (`USER`) | Create, list, revoke, and rotate their own gateway API keys; copy integration examples and test requests in a portal playground; call the public inference API using plain-text prompts or structured JSON state; receive generated responses, optionally streamed; view their own request, token, cost, provider/model, and routing analytics. Requests are subject to their preferences, guardrails, and limits. They cannot view another user's data or administer shared providers/configuration. |
| Administrator (`ADMIN`) | All registered-user capabilities, plus inspect user accounts and platform-wide usage; configure shared providers/models and encrypted provider credentials; test provider connections; configure routing rules, Jev questions/categories, guardrails, and rate limits; view platform-wide requests, token/cost, provider/model, route/fallback, guardrail, limit, and system-health analytics. |
| API client (user's application) | Send authenticated inference requests to the gateway and consume the gateway response. It uses a user-owned gateway API key and never needs direct access to provider credentials. |
| TypeSafe Jev (decision model via internal AI service) | Evaluate prompt or JSON state against typed questions; return classifications and probabilities/confidence where supported; choose among provider/model candidates already approved by application rules. Jev returns structured decisions, not the generated user response. |
| LLM provider (external system) | Receive a server-to-server request through a provider adapter using administrator-managed credentials; return the generated response and provider usage metadata. It is not directly exposed to the API client. |

## Target authorization and key principles

- A user signs into the portal with their account. Programmatic inference
  requests authenticate separately with a gateway API key.
- Gateway keys belong to one user and can be listed by safe metadata, revoked,
  and rotated by that user. The raw key is displayed only once at creation;
  only a non-recoverable verifier is stored. Keys are never logged.
- Gateway API keys are not LLM provider credentials. Provider credentials are
  managed by administrators, stored encrypted, used only server-side, and
  never returned to users.
- Each request is authorized and attributed to the key's owning user. Users
  can access only their own keys, request analytics, and any optional
  conversation/context records.
- Request content retention is a product/privacy policy to define. Usage
  analytics should work from request metadata without requiring indefinite
  storage of raw prompts or provider responses.
- Admin-only operations cover shared provider/model/credential settings,
  Jev decision configuration, global routing and guardrail rules, configurable
  limits, user oversight, and platform-wide analytics.
- Jev may select only from candidates the application has determined to be
  eligible. The application validates Jev's typed choice and applies
  confidence, safety, availability, and fallback policies.
- The gateway calls the selected provider and returns its response; it does
  not redirect API clients to providers or disclose provider credentials.

## Target API request flow

The proposed public endpoint is `POST /v1/inference`. The final path and
request/response contract will be defined during implementation. The input is
either a text prompt or structured JSON state, for example:

```http
POST /v1/inference
Authorization: Bearer <gateway-api-key>
Content-Type: application/json
```

```json
{
  "input": "Summarize the key risks in this report."
}
```

```json
{
  "input": {
    "task": "extract_fields",
    "document": {
      "invoice_number": "INV-104",
      "amount": 248.5,
      "currency": "USD"
    }
  }
}
```

The payload is submitted to the gateway, not directly to Jev or an LLM provider.
The gateway/AI service supplies the state and configured typed questions to
Jev, then routes the request and returns the selected provider's response.

```mermaid
flowchart TD
    Developer["Registered developer / USER"]
    Portal["Sign in to developer portal"]
    CreateKey["Create gateway API key"]
    Client["Developer's application"]
    Payload["POST /v1/inference: prompt text or JSON state"]
    API["Gateway API"]
    Auth{"API key valid, active, and within scope?"}
    RejectAuth["Return authentication/authorization error"]
    Validate["Validate request contract and input"]
    Safety["Apply prompt safety, secret detection, and injection checks"]
    Safe{"Request passes guardrails?"}
    RejectSafety["Reject or flag; persist guardrail event"]
    Limit["Check user, endpoint, and provider limits"]
    Allowed{"Within applicable limits?"}
    RejectLimit["Return rate-limit response"]
    JevClassify["AI service asks Jev typed classification questions"]
    Classification["Typed task/category, probabilities, confidence"]
    Candidates["Application filters candidates by rules, preferences, capabilities, and limits"]
    JevChoice["Jev Choice selects among eligible provider/model candidates"]
    ValidateChoice{"Choice is eligible and meets confidence policy?"}
    RejectChoice["Apply configured no-route / low-confidence behavior"]
    Provider["Gateway calls selected LLM provider with server-side credential"]
    Result{"Provider call succeeds?"}
    Fallback["Remove unavailable candidate and ask Jev to choose from remaining candidates"]
    Error["Return clear gateway error; record operational outcome"]
    OutputSafety["Validate provider output against configured policies"]
    OutputSafe{"Output passes checks?"}
    RejectOutput["Block or flag output; persist guardrail event"]
    Response["Return generated response, route/usage metadata; stream if requested"]
    Persist["Persist request metadata and usage; retain content only per privacy policy"]
    Analytics["Update per-user and platform analytics"]

    Developer --> Portal --> CreateKey
    CreateKey --> Client
    Client --> Payload --> API --> Auth
    Auth -->|no| RejectAuth
    Auth -->|yes| Validate --> Safety --> Safe
    Safe -->|no| RejectSafety
    Safe -->|yes| Limit --> Allowed
    Allowed -->|no| RejectLimit
    Allowed -->|yes| JevClassify --> Classification --> Candidates --> JevChoice --> ValidateChoice
    ValidateChoice -->|no| RejectChoice
    ValidateChoice -->|yes| Provider
    Provider --> Result
    Result -->|failure; fallback remains| Fallback
    Fallback -->|candidate remains| JevChoice
    Fallback -->|none remain| Error
    Result -->|failure; no fallback| Error
    Result -->|success| OutputSafety --> OutputSafe
    OutputSafe -->|no| RejectOutput
    OutputSafe -->|yes| Response --> Client
    Response --> Persist --> Analytics
```

## Target use-case diagram

```mermaid
flowchart LR
    Visitor["Visitor"]
    User["Registered user / API consumer"]
    Client["User's application"]
    Admin["Administrator"]
    Jev["TypeSafe Jev"]
    Provider["LLM provider"]

    subgraph Portal["Developer portal"]
        Register["Register / sign in"]
        KeyMgmt["Create, view metadata, revoke, and rotate own API keys"]
        Docs["Read API docs and copy integration examples"]
        Playground["Test prompt or JSON-state requests"]
        PersonalAnalytics["View own request, token, cost, and route analytics"]
    end

    subgraph Gateway["Inference API"]
        Submit["Submit prompt or JSON state"]
        Authenticate["Authenticate with gateway API key"]
        Classify["Classify request with Jev"]
        SelectRoute["Select from application-approved provider/model candidates with Jev"]
        InvokeProvider["Invoke selected provider via adapter"]
        GetResponse["Receive generated response / optional stream"]
    end

    subgraph AdminPortal["Administrator portal"]
        UserMgmt["Inspect user accounts"]
        ProviderMgmt["Configure providers/models and test connections"]
        CredentialMgmt["Manage encrypted provider credentials"]
        RoutingMgmt["Configure routing rules and fallback policy"]
        JevMgmt["Configure Jev typed questions and categories"]
        GuardrailMgmt["Configure prompt/output safety policies"]
        LimitMgmt["Configure user, endpoint, and provider limits"]
        PlatformAnalytics["View platform-wide usage, cost, route, guardrail, and health analytics"]
    end

    Visitor --> Register
    Visitor --> Docs
    User --> Register
    User --> KeyMgmt
    User --> Docs
    User --> Playground
    User --> PersonalAnalytics
    User --> Client
    Client --> Submit --> Authenticate
    Authenticate --> Classify --> SelectRoute --> InvokeProvider
    Classify --> Jev
    SelectRoute --> Jev
    InvokeProvider --> Provider
    Provider --> GetResponse --> Client

    Admin --> Register
    Admin --> KeyMgmt
    Admin --> Docs
    Admin --> Playground
    Admin --> PersonalAnalytics
    Admin --> UserMgmt
    Admin --> ProviderMgmt
    Admin --> CredentialMgmt
    Admin --> RoutingMgmt
    Admin --> JevMgmt
    Admin --> GuardrailMgmt
    Admin --> LimitMgmt
    Admin --> PlatformAnalytics
```

## Roadmap mapping

- Provider adapters, streaming, and error handling: Chapter 3.
- Encrypted provider credentials and connection testing: Chapter 4.
- Public inference endpoint, prompt/JSON request and response contracts,
  gateway API-key lifecycle, request persistence, integration examples, and
  optional context identifiers: Chapter 5.
- Jev integration, typed classification questions, category probabilities and
  confidence, and configurable categories: Chapter 6.
- User preferences and deterministic candidate eligibility, followed by Jev
  Choice route selection, validation, confidence policy, capability checks,
  provider limits, and fallback re-selection: Chapter 7.
- Input/output validation, prompt safety, secret detection, and guardrail
  events: Chapter 8.
- Configurable user, API-key, provider, and endpoint rate limits: Chapter 9.
- Token/cost accounting and personal/admin analytics APIs: Chapter 10.
- API-key portal, request playground, integration docs, user request dashboard,
  and admin configuration/analytics dashboards: Chapter 11.
- Platform-wide request, API-key, usage, provider/model, cost, route/fallback,
  guardrail, limit, and health analytics: Chapter 12.
