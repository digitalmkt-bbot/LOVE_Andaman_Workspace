# ADR-001: Next.js App Router + TypeScript for the allotment_v2 modernization

- **Status:** Proposed
- **Date:** 2026-08-19
- **Related:** LAM-79 (this record), LAM-76 (`apps/web/**` shell, concurrent work not yet verified against this repo)
- **Scope:** the *new* front end being built alongside `allotment_v2/allotment_v2.html`. Nothing in this ADR changes `allotment_v2/allotment_v2.html`, `server.js`, the Postgres schema, or any API contract — those stay exactly as they are today until a module is explicitly strangled in its own, separately-scoped task.

## Context

`allotment_v2/allotment_v2.html` is a single HTML file (~4 MB, ~46k lines) that contains the entire LOVE Andaman operations app — Booking, Boat Operation, Fleet, Rate Types, Agent List, Accounting, Demand/Market Intelligence, Pickup Setup, and more (see `SYSTEM_MAP.md` for the full module catalog and `CLAUDE.md` §7 for the sidebar grouping). All of it is one inline `<script>` mutating one shared in-memory state object, which is persisted to a single `localStorage` key (`loveandaman_v2`) and synced to Postgres through `server.js`.

`server.js` is a plain Node `http` server (no framework) that serves the static file, handles cookie-session login, and exposes a small REST surface under `/api/*` — `/api/login`, `/api/load`, `/api/save` (whole-blob read/write with optimistic-concurrency versioning), `/api/attach`, `/api/users*`, an SSE stream at `/api/events`, and a newer per-entity mapping API at `/api/v1/*` backed by `os-backend/src/mapping/os_repo.js` + `operation_schemas_model.json`. Persistence runs in one of two modes controlled by `DATA_BACKEND`: `blob` (default — one JSON blob in `app_state`) or `relational` (the blob decomposed into ~103 tables under the `operation_schemas` Postgres schema). Deployment is Railway, Nixpacks auto-detects Node and runs `npm start` (`node server.js`), and prod auto-deploys from `main` in about 1–2 minutes. There is currently no build step and no CI — commits reach `main` through a manual GitHub Desktop ritual documented in `CLAUDE.md` (push to `backend-db-implementation`, then merge into `main`, then push again), because the sandbox this app is usually edited from cannot `git push` directly.

This architecture has served the team well for rapid, single-file iteration, but `CLAUDE.md` §6 documents a long, recurring list of bug classes that are direct consequences of the shape of the code: `esc`/`escapeHTML` re-declared per function with no compiler to catch a missed declaration; date bugs from `toISOString()` UTC shifts; scroll-jump from naive `innerHTML` replacement; silent load-condition bugs (`Array.isArray` checks that, if forgotten, quietly revert live data to seed constants); a blob store that must always be read-modify-written or risk clobbering another module's data; and a back-fill migration pattern that has to be re-applied by hand every time a default list grows. None of these are exotic — they are exactly the class of error that static typing, module boundaries, and a component framework with an opinionated data-fetching story are built to prevent. That is the motivation for a modernization track at all, and LAM-79's job is to record why the specific stack (Next.js App Router + TypeScript) was chosen for it.

## Decision

Build the new front end in **Next.js (App Router) with TypeScript**, under `apps/web/**` (the directory LAM-76 is concurrently scaffolding — this ADR describes the intended boundaries around that work without asserting file-layout specifics not yet verified in this repo).

Reasoning, in order of weight:

1. **The module catalog already wants file-based routing.** `SYSTEM_MAP.md` §1–2 and `CLAUDE.md` §7 describe the app as a fixed set of sidebar modules (Booking, Boat Operation, Rate Types, Agent List, Accounting, Fleet, Demand, …) grouped under OPERATIONS / SALES / ACCOUNTING & FINANCE / Fleet Management. The App Router's directory-is-a-route convention maps those groups onto `app/(operations)/booking`, `app/(sales)/agents`, etc. almost without translation, which keeps the strangler migration (see below) mapped 1:1 onto the existing mental model instead of inventing a new one.
2. **TypeScript directly targets the bug class this modernization exists to fix.** The `esc`-not-global, load-condition, and edit-preserve bugs in `CLAUDE.md` §6 are all "the compiler would have caught this" bugs — a missing field on a rebuilt object, a function called with the wrong shape, a value used before a null check. A typed API client generated from (or hand-mirroring) the `operation_schemas_model.json` shapes turns a whole category of these into build-time errors instead of a support ticket weeks later.
3. **App Router gives the strangler pattern a same-language seam on both sides.** Route Handlers (`app/**/route.ts`) let a module's server logic move into TypeScript in the same change as its UI, instead of running two separate migrations (a frontend framework swap, and later a separate backend rewrite). This matters because `server.js` already carries meaningful, non-trivial logic (the shrink-guard in `os_repo`, optimistic-concurrency versioning, the blob/relational dual-mode) that a pure client-side SPA swap would leave untouched and undocumented in the new stack.
4. **Server rendering suits the data-heavy pages.** Manifests, accounting statements, and the demand/market dashboard are exactly the pages where shipping a 4 MB client bundle (today's actual cost — the whole app is one file) is the wrong trade; React Server Components let those pages fetch and render on the server and ship only the interactive parts to the client.
5. **Deployment story is a known-good fit for this project's host.** Railway's Nixpacks builder already auto-detects Node projects and runs a build + start step; a Next.js app under `apps/web` with its own `package.json` needs no new deployment primitive, only a service (see Deployment implications below).

## Alternatives considered

### React + Vite (SPA), talking to the existing `server.js` REST API

This was the closer call, and it would have been the **better choice** under a narrower goal: *"keep `server.js` exactly as it is, and just replace the 46k-line HTML file with componentized React talking to the same `/api/*` endpoints."* Under that framing, Vite has real advantages this ADR should not understate:

- **Closer to the current mental model.** Today's app is a single script that owns all state and renders to the DOM. A Vite SPA is the same shape — one client bundle, one entry point, no server/client component boundary to learn or misuse. For a small team already fluent in vanilla JS and used to reasoning about "what does the client have loaded right now," that is a materially shorter learning curve than the App Router's server/client component split, caching semantics, and revalidation model — all genuine, well-documented sources of subtle bugs in Next.js App Router codebases.
- **No framework-owned backend surface to reconcile with `server.js`.** A Vite SPA has no Route Handlers, no server actions, nothing that could tempt a contributor into building a second, parallel API next to the one `server.js` already exposes. That is a simpler, lower-risk story for a first migration slice.
- **Faster iteration loop, less build magic.** Vite's dev server and build are simpler to reason about than Next's, with fewer moving parts to misconfigure on Railway.

Where it loses, for this project specifically: Vite gives no opinion on routing or data fetching, so the module-boundary mapping this ADR leans on (module ↔ route segment) would have to be hand-built with a router library and would not, by itself, give a same-language home for eventually strangling pieces of `server.js`'s logic — that would still require a second, separate backend migration later. Given that the team's own `CLAUDE.md` already tracks a `backend-db-implementation` branch actively moving persistence toward a relational model, treating the frontend and backend as two migrations to do independently (Vite's implication) was judged more total work and more total risk than doing them incrementally together module-by-module (Next.js App Router's implication). If a future module turns out to be pure presentation with no server-side data-shaping need, a plain client component inside the same Next.js app gets the same simplicity Vite would have offered, without a second toolchain.

### Do nothing / keep extending the single HTML file

Rejected as the status quo this modernization track exists to move away from — not a real alternative, included here only because it is the one this ADR is implicitly weighed against. The cost of continuing is the recurring bug list in `CLAUDE.md` §6, which keeps growing with the file.

### A second framework's SSR option (e.g., Remix)

Not seriously evaluated. Next.js was already the team's stated direction going into this ADR (per the Jira scope naming it explicitly); this ADR documents and justifies that choice rather than re-litigating the whole SSR-framework landscape. The reasoning above (route-to-module mapping, TypeScript, Railway fit) would apply comparably to Remix, but re-deriving the choice from scratch was out of scope for LAM-79.

## Strangler migration strategy

The legacy app (`allotment_v2/allotment_v2.html` + `server.js`) keeps running in production, unmodified, for the entire migration. Nothing about this decision requires — or currently plans — a cutover date for the legacy file.

1. **Shared source of truth, no dual-write.** `apps/web` reads and writes through the *same* Postgres database and the *same* API surface `server.js` already exposes (`/api/v1/*` per-entity endpoints in particular, since those are already shaped for typed per-entity access — see `os_repo.js`). New Route Handlers inside `apps/web` are for *new* capability only; they must not become a second implementation of an endpoint `server.js` already owns. That decision belongs to whichever task actually strangles a given module's backend — this ADR only sets the constraint that no dual path may exist for the same data.
2. **Migrate low-coupling modules first, the Booking hub last.** `SYSTEM_MAP.md` §3's edge list shows Booking (`SB_BOOKINGS`) as the module with the most inbound/outbound edges — Program/Routes, Boat Operation, Pickup Setup, Rate Types, Agent List, Seat Locks, and Accounting all connect through it. That makes it the highest-risk, highest-blast-radius module to strangle and the natural *last* candidate. Read-heavy, more isolated modules (e.g., Demand/Market Intelligence, or a reporting view of Fleet Management) are better first candidates — read-only pages have no commit-time invariants to preserve and no risk of the "edit-preserve block" class of bug `CLAUDE.md` §6 warns about for Booking specifically.
3. **Traffic seam.** Both apps need to be reachable from one place without breaking the existing session. Two options, to be decided by the task that actually wires it up (infra/root config is outside this ADR's and LAM-79's owned scope):
   - **Path-prefix reverse proxy**, same origin — e.g. legacy stays at `/`, migrated modules live at a distinct prefix Railway/edge routes to the Next.js service. Same-origin keeps the existing `SESSION_SECRET`-signed cookie valid across both apps with no re-login.
   - **Separate subdomain**, cross-linked from the legacy sidebar until a module fully cuts over. Simpler to stand up, but needs its own session-sharing story (or an accepted one-time re-login) since cookies would not be same-origin by default.
   Recommendation for later implementation: path-prefix proxy, for session continuity — but standing this up touches Railway/root configuration this task does not own, so it is recorded as a **dependency**, not a decision made here.
4. **Auth stays put.** No new auth system. Both apps rely on the session cookie `server.js` already issues at `/api/login` (`SESSION_SECRET`-signed, `SESS_DAYS`-long). This only works cleanly under the same-origin (path-prefix) seam above.

## Initial module boundaries

One Next.js route segment per existing module, matching `SYSTEM_MAP.md`'s catalog and `CLAUDE.md` §7's sidebar grouping, each fetching only the store keys it owns instead of the legacy pattern of one shared blob mutated everywhere:

| Module (today) | Store key(s) it owns | Suggested route segment |
|---|---|---|
| Program / Routes | `ROUTES` (seed `DEFAULT_ROUTES`) | `app/(config)/routes` |
| Boat Status / Fleet | `boats[]`, `fleet_*` | `app/(fleet)/*` |
| Boat Operation | `TRIPS` | `app/(operations)/boat-operation` |
| Pickup Setup | `sb_pickup_zones`, `sb_pickup_areas` | `app/(operations)/pickup-setup` |
| Rate Types | `sb_rate_types`, `sb_addon_types` | `app/(sales)/rate-types` |
| Agent List | `sb_agents` | `app/(sales)/agents` |
| Booking | `sb_bookings`, `sb_seat_locks` | `app/(operations)/booking` (migrate last — see above) |
| Accounting | `sb_invoices`, `sb_payments`, `sb_deposits` | `app/(accounting)/*` |
| Demand / Market Intelligence | `sb_market_stats` | `app/(sales)/demand` |

This table is a starting point for whichever task actually builds each route, not a commitment this ADR enforces — module ownership may be refined once `apps/web`'s real layout (LAM-76) is visible.

## Deployment implications

- **Railway fit, no change to the legacy service.** Nixpacks already auto-detects Node; a Next.js app under `apps/web` with its own `package.json` (`build`/`start` scripts) needs no new deploy primitive Railway doesn't already support. The recommended shape is a **second Railway service** in the same project/environment, pointed at the same `DATABASE_URL`, rather than folding Next.js into the existing `server.js` process — this keeps the legacy static+API service's `npm start` (`node server.js`, no build step) untouched, and avoids this task or LAM-76 needing to touch root `package.json`/`railway.json`, which neither owns.
- **Build step is new for this repo.** Today's app has none (`allotment_v2.html` is served as-is). Next.js requires `next build` before `next start`; this is a process change worth flagging even though it doesn't touch existing config.
- **The manual GitHub-Desktop deploy ritual and a normal Next.js CI/CD flow need to be reconciled.** `CLAUDE.md`'s deploy workflow exists because the sandbox that historically edits `allotment_v2.html` cannot push directly and needs a human-driven merge ritual into `main`. That constraint has no reason to apply to `apps/web`, which can use a normal branch → PR → merge → auto-deploy flow. Whether the two paths coexist permanently (legacy stays hand-merged, `apps/web` ships normally) or the legacy ritual is retired is a decision for a separate, explicitly-scoped task — recorded here as an **open question**, not resolved by this ADR.
- **Both services would still auto-deploy from `main`,** consistent with the project's existing convention (`CLAUDE.md` §0: "Prod auto-deploys from `main` (~1–2 min)").

## Rollback constraints

- **No schema or API rollback is possible or needed for this phase**, because this ADR and its sibling tasks make no persistence, schema, or API change. `apps/web` reads and writes through APIs `server.js` already exposes; nothing new is added to roll back.
- **The legacy app is the rollback.** Because `allotment_v2/allotment_v2.html` and `server.js` keep running unmodified throughout, "rolling back" any single migrated module is: stop routing to it (remove the proxy rule / unlink the sidebar entry), not a data migration. This only holds as long as every module strangled later follows the same rule this ADR sets — share the existing DB/API, never fork a second write path for the same data.
- **Any future schema evolution driven by a strangled module must be additive and backward-compatible**, so the legacy blob/relational reader in `server.js` keeps working without a coordinated two-sided deploy — this mirrors `CLAUDE.md` §4's existing rule ("don't rename/delete existing fields, mark inactive instead") and extends it to apply across both apps once real strangling begins.
- **Session compatibility must survive a rollback.** If the path-prefix proxy is removed, a user should not be forced to re-authenticate against the legacy app — same-origin cookie sharing (see Traffic seam above) is what makes this possible; a subdomain-based seam would need its own answer here before that option is chosen.
- **Rollback of this specific change** (the ADR document and its link from `SYSTEM_MAP.md`) is trivial: revert this file and the one added line in `SYSTEM_MAP.md`. No code, schema, or deployed service is affected by LAM-79 itself.

## Consequences

- New contributors need to learn the App Router's server/client component boundary and caching model — a real cost, acknowledged in the Alternatives section, and worth an onboarding note once `apps/web` has enough surface to document.
- The team now maintains two deployable services during the entire migration window (legacy + `apps/web`), which is more moving parts than a single-file app, in exchange for stopping the growth of the bug classes in `CLAUDE.md` §6.
- Every future module migration is a two-part decision — UI route *and* whether/how its backend strangles — which this ADR frames but does not resolve per-module; each module's actual migration is its own scoped task.

## References

- `CLAUDE.md` — schema, safety rules, deploy workflow, and the recurring-bug list this modernization responds to.
- `SYSTEM_MAP.md` — module catalog, data-store ownership, and the relationship graph the route-boundary table above mirrors.
- `README.md` — current run/deploy instructions for the legacy app.
- `server.js` — current API surface (`/api/login`, `/api/load`, `/api/save`, `/api/v1/*`, `/api/events`) and the blob/relational persistence modes.
- `railway.json`, `package.json` — current build/deploy configuration (Nixpacks, `npm start`).
