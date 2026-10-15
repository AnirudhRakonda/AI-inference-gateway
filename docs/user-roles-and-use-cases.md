# Target User Roles, Access, and Use Cases

This is the intended end-state view of the application after the planned
chapters are implemented. It is a product-level target, not a statement that
these capabilities are available today. The actors and capabilities below are
based on the project roadmap in [TODO.md](../TODO.md).

## Actors and target access

| Actor | Target functionality and access |
| --- | --- |
| Visitor (not signed in) | Register or sign in; view the public service-health page. No prompt submission, account data, or analytics access. |
| Registered user (`USER`) | Submit prompts and receive streamed model responses; create and manage their own conversations and history; set routing preferences (such as primary and fallback providers); view their own token, cost, model/provider, and request usage analytics. Guardrails and user rate limits apply to their requests. Users can only access their own conversations and usage. |
| Administrator (`ADMIN`) | All registered-user capabilities, plus configure providers, models, encrypted provider credentials, and connection tests; configure routing rules, custom classification categories, prompt/safety flags, and rate limits; view platform-wide user, token, cost, provider/model, guardrail, rate-limit, and system-health analytics; inspect user accounts. Administrative changes and sensitive credentials are restricted to this role. |
| LLM provider (external system) | Receive gateway requests through provider adapters using server-managed credentials; return streamed or complete model responses and provider usage metadata. A provider is an integration, not an interactive application user. |
| TypeSafe Jev (decision model, accessed through the internal AI service) | Return typed request-category decisions and select a provider/model from the eligible candidates supplied by the gateway. Jev also returns probabilities and confidence for supported question types. It does not generate the user's response or override application policy. |

### Target authorization principles

- Sign-in is required for prompt submission, conversation history, user
  preferences, and personal analytics.
- Users may access and change their own conversations and preferences, and view
  their own usage and costs. They cannot access another user's data or platform
  configuration.
- Administrator-only operations cover shared provider/model/credential
  configuration, global routing and guardrail settings, configurable limits,
  user/account oversight, and platform-wide analytics.
- Provider credentials are stored encrypted, used by the server-side adapter,
  and never exposed to users or returned in plaintext. Secrets must not appear
  in logs.
- All inference requests pass through validation, safety checks, configured
  limits, and routing. A rejected or rate-limited request does not proceed to a
  provider.
- Jev can choose only from candidates already deemed eligible by application
  rules. The application validates its typed choice and applies the configured
  confidence and fallback policy.

## End-to-end target request flow

```mermaid
flowchart TD
    User["Signed-in user"]
    Prompt["Submit prompt / continue conversation"]
    API["Gateway API"]
    Auth{"Authenticated and authorized?"}
    RejectAuth["Reject request"]
    Validate["Validate input and conversation context"]
    Safety["Prompt safety, secret detection, injection checks"]
    Safe{"Request passes guardrails?"}
    RejectSafety["Reject or flag request; persist guardrail event"]
    Limit["Check user and endpoint limits"]
    Allowed{"Within user/endpoint limits?"}
    RejectLimit["Return rate-limit response"]
    JevClassify["AI service asks Jev to classify task/category"]
    Classification["Typed category, probabilities, confidence"]
    Candidates["Application builds eligible candidates from preferences, rules, capabilities, and current limits"]
    JevChoice["AI service asks Jev Choice to select among eligible candidates"]
    ValidateChoice{"Is Jev's typed choice eligible and acceptable by confidence policy?"}
    RejectChoice["Apply configured no-route / low-confidence behavior"]
    ProviderLimit["Recheck selected provider limit and availability"]
    ProviderAllowed{"Within provider limit?"}
    Available{"Selected provider/model available?"}
    Fallback["Remove failed/unavailable candidate; ask Jev to choose among remaining eligible fallbacks"]
    Provider["Provider adapter uses encrypted credential"]
    Result{"Provider response succeeds?"}
    Error["Return clear error; record operational outcome"]
    OutputSafety["Validate output against configured safety policies"]
    OutputSafe{"Output passes checks?"}
    RejectOutput["Block or flag unsafe output; persist guardrail event"]
    Stream["Stream response to user"]
    Persist["Persist conversation and messages"]
    Track["Track tokens and calculate cost"]
    Analytics["Update usage and analytics"]

    User --> Prompt --> API --> Auth
    Auth -->|no| RejectAuth
    Auth -->|yes| Validate --> Safety --> Safe
    Safe -->|no| RejectSafety
    Safe -->|yes| Limit --> Allowed
    Allowed -->|no| RejectLimit
    Allowed -->|yes| JevClassify --> Classification --> Candidates --> JevChoice --> ValidateChoice
    ValidateChoice -->|no| RejectChoice
    ValidateChoice -->|yes| ProviderLimit
    ProviderLimit --> ProviderAllowed
    ProviderAllowed -->|no; try fallback| Fallback
    ProviderAllowed -->|yes| Available
    Available -->|no; try fallback| Fallback
    Fallback -->|candidates remain| JevChoice
    Fallback -->|none available| Error
    Available -->|yes| Provider
    Provider --> Result
    Result -->|failure; try fallback| Fallback
    Result -->|failure; no fallback| Error
    Result -->|success| OutputSafety --> OutputSafe
    OutputSafe -->|no| RejectOutput
    OutputSafe -->|yes| Stream --> Persist --> Track --> Analytics
    Stream --> User
```

## Target use-case diagram

```mermaid
flowchart LR
    Visitor["Visitor"]
    User["Registered user"]
    Admin["Administrator"]
    Provider["LLM provider"]
    Jev["TypeSafe Jev via internal AI service"]

    subgraph Account["Account and access"]
        Register["Register"]
        SignIn["Sign in / sign out"]
    end

    subgraph Inference["Inference and conversations"]
        Prompt["Submit prompt"]
        Classify["Classify request"]
        ChooseRoute["Choose provider/model from application-approved candidates"]
        Stream["Receive streamed response"]
        Conversation["Create and manage own conversations"]
        History["View own conversation history"]
        Preferences["Set personal routing preferences"]
    end

    subgraph Personal["Personal reporting"]
        PersonalUsage["View own token and request usage"]
        PersonalCost["View own cost and provider/model breakdown"]
    end

    subgraph AdminCases["Administrator use cases"]
        Users["Inspect user accounts"]
        Providers["Configure providers and models"]
        Credentials["Manage encrypted credentials and test connections"]
        Routing["Configure global routing and fallback rules used to build eligible choices"]
        Categories["Manage classification categories"]
        Guardrails["Configure prompt and safety policies"]
        Limits["Configure rate limits"]
        PlatformAnalytics["View platform-wide usage, cost, guardrail, and limit analytics"]
        Health["Monitor system health"]
    end

    Visitor --> Register
    Visitor --> SignIn
    User --> SignIn
    User --> Prompt
    Prompt --> Classify --> ChooseRoute --> Stream
    User --> Conversation
    User --> History
    User --> Preferences
    User --> PersonalUsage
    User --> PersonalCost

    Admin --> SignIn
    Admin --> Prompt
    Admin --> Conversation
    Admin --> History
    Admin --> Preferences
    Admin --> PersonalUsage
    Admin --> PersonalCost
    Admin --> Users
    Admin --> Providers
    Admin --> Credentials
    Admin --> Routing
    Admin --> Categories
    Admin --> Guardrails
    Admin --> Limits
    Admin --> PlatformAnalytics
    Admin --> Health

    Classify --> Jev
    ChooseRoute --> Jev
    ChooseRoute --> Provider
    Provider --> Stream
```

## Roadmap mapping

- Provider adapters, streaming, and error handling: Chapter 3.
- Encrypted provider credentials and connection testing: Chapter 4.
- Conversations, messages, context, and history: Chapter 5.
- Jev integration, typed prompt classification, category probabilities and
  confidence, and custom categories: Chapter 6.
- Personal preferences and deterministic eligibility filtering, followed by
  Jev Choice selection, validated typed routing results, confidence policy,
  provider/model capability checks, and fallback re-selection: Chapter 7.
- Input/output validation, prompt safety, secret detection, and guardrail events:
  Chapter 8.
- Configurable user, provider, and endpoint rate limits: Chapter 9.
- Token and cost accounting plus personal and administrator analytics: Chapter
  10.
- Usage/cost dashboards, routing and credential configuration, prompt flags,
  and conversation management: Chapter 11.
- Platform-wide usage, provider/model, cost, guardrail, and health analytics:
  Chapter 12.
