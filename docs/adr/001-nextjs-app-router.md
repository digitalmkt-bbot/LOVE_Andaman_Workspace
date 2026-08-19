# ADR 001: Adopt Next.js App Router with strict TypeScript for the modernization shell

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision scope:** Additive modernization shell only; the existing `allotment_v2/allotment_v2.html` remains the production application until individual capabilities are deliberately migrated.
- **Related architecture map:** [`SYSTEM_MAP.md`](../../SYSTEM_MAP.md)
- **Jira:** LAM-79

## Context

LOVE Andaman is currently delivered as a large single-file browser application. Its booking, fleet, operations, pricing, and persistence behavior is established and must remain compatible while the application is modernized. The first web shell needs file-based navigation, server-aware deployment support, strict TypeScript boundaries, health checking, environment configuration, linting, and unit-test support without replacing production modules or changing persistence semantics.

The architecture must allow small, reversible vertical migrations. A framework choice must therefore support an additive shell beside the legacy application, not require a big-bang rewrite.

## Decision

Use **Next.js with the App Router and strict TypeScript** for the new web shell.

The shell will be introduced as a separate, additive application (initially under `apps/web`) and will use App Router route segments for navigation and route handlers only where a new, explicitly owned server boundary is needed. TypeScript strict mode is required for all new shell and extracted-module code. Browser-only legacy integrations must remain behind typed adapters and client-component boundaries; server components must not import legacy DOM code or browser storage directly.

The initial shell is not authorization to replace the legacy production module. It may provide navigation, health/status, and explicitly approved new or read-only screens while legacy routes and their persistence behavior continue unchanged.

### Initial module boundaries

| Boundary | Responsibility | Must not do initially |
|---|---|---|
| `app/` route segments and layouts | Navigation, page composition, loading/error UI, route-level feature gating | Reimplement booking, fleet, pricing, or persistence rules |
| `components/` | Presentational and reusable UI, with client components only when browser interaction requires them | Read or write legacy localStorage/blob state directly |
| `features/<domain>/` | A vertical domain slice: view model, use cases, validation, and tests for one approved capability | Reach into another domain's state or bypass its adapter |
| `lib/legacy/` adapters | Typed, narrow compatibility access to legacy APIs/state; normalization at the edge | Spread legacy global objects or DOM dependencies through React code |
| `lib/server/` | New server-only configuration, health dependencies, and future API clients | Import client code, expose secrets, or silently replace existing persistence |

Initial domain slices are Booking, Rate Types/Agents, Boat Operations, Transfer/Pickup, Fleet, and Accounting. They retain their existing data contracts until a slice has characterization coverage and an explicit migration decision.

### Strangler migration strategy

1. Establish the Next.js shell, strict TypeScript, linting, unit-test tooling, environment validation, and a no-persistence health endpoint.
2. Keep the legacy application as the production source for all operational workflows. Add only links, read-only views, or independently safe shell capabilities behind an explicit route or feature flag.
3. Before extracting a workflow, add and preserve characterization tests for its legacy behavior, including persistence and cancellation/locking invariants where relevant.
4. Extract one vertical slice at a time behind a typed legacy adapter. Compare its observable output and data contract with the legacy workflow before enabling writes.
5. Enable writes only after the new slice preserves the legacy read-modify-write contract, operational guardrails, and rollback procedure. Retire a legacy path only through a separate approved ADR or migration plan.

This is a strangler approach: routing and adapters isolate new code around the existing system, then capabilities move incrementally rather than being copied wholesale.

## Alternatives considered

### React plus Vite

React with Vite is a viable lightweight client-side application stack. It offers fast local development and a smaller framework surface, but it would require the project to choose and assemble routing, server/API boundaries, environment handling, health exposure, and deployment conventions separately. A Vite-only SPA also makes server-side health checks, route handlers, and future authenticated/server-integrated boundaries additional design work.

Next.js App Router supplies those conventions while still supporting client components for interactive operations screens. The additional framework/runtime complexity is accepted because the migration needs repeatable route, server, configuration, and deployment boundaries more than it needs the smallest possible client bundle.

### Continue extending the single-file application

This retains short-term delivery speed but does not create module boundaries, strict typing, isolated tests, or a reversible migration lane. It is retained as the compatibility baseline, not selected as the target architecture.

### Big-bang rewrite

Rejected. It would make behavioral parity, data compatibility, operational validation, and rollback difficult to prove at once.

## Deployment implications

- The new shell requires a Node-compatible Next.js build and runtime on Railway (or an equivalent platform); it is not a static-file replacement for the existing app.
- Deployment must keep the legacy application reachable until migration approval. Initial rollout should use a distinct route, service, or feature flag rather than replace the existing production entry point.
- Environment variables are validated at startup. Only values intentionally safe for the browser use the `NEXT_PUBLIC_` prefix; database credentials, session secrets, and backend tokens remain server-only.
- The health route must be lightweight and must not mutate or initialize legacy operational state. Dependency checks, if added, must distinguish readiness from liveness.
- CI must run the new shell's typecheck, lint, and unit tests independently of the legacy application so a shell failure does not mask legacy characterization results.

## Compatibility constraints

- No production module is replaced by this decision or by the initial shell.
- Existing persistence remains authoritative: the legacy local working copy and backend synchronization contracts are unchanged. New code must not clobber shared blob data or introduce a competing source of truth.
- Existing booking behaviors—including edit-preserved fields, cancelled-status exclusions, seat locks, boat assignment, and rate-type pricing—must remain unchanged until a slice is explicitly migrated with characterization evidence.
- New shell code may consume legacy data only through documented typed adapters. It must not depend on undeclared globals, DOM structure, or browser-only APIs from server components.
- Browser compatibility and operational access remain governed by the legacy application until the corresponding interface is migrated and validated.

## Rollback constraints and procedure

The initial shell adds no schema or persistence migration, so rollback is primarily routing and deployment configuration: disable the shell's feature flag or route and continue serving the legacy application. Do not delete or alter legacy assets as part of shell rollout.

Once an extracted slice can write data, routing rollback alone is insufficient unless its writes are demonstrably backward-compatible. Such a slice must have an explicit data rollback plan, auditability, and characterization coverage before enablement. No destructive data migration may be coupled to the initial shell.

## Consequences

- New application code has a consistent routing, typing, configuration, testing, and deployment model.
- The team accepts Next.js operational complexity and a server runtime in exchange for a structured incremental migration path.
- Migration progress is measured per vertical slice and evidence-backed, rather than by the amount of React code created.
- Future deviations from these boundaries or a change of framework require a new ADR.
