# C2-LUNA-PICKUP: Pickup areas and time profiles

## Input contract

- **Requested outcome:** Implement packet C2 from `OPERATION_BACKEND_FRONTEND_MIGRATION.md` in the `allotment_v2` frontend.
- **Acceptance criteria:** Hydrate pickup areas/profiles from operation-backend in operations mode; use documented area/profile/cell/resolve routes; make area/profile/cell mutations server-first; preserve legacy behavior; add focused UI coverage.
- **Allowed scope:** `allotment_v2/js/ops/21-ops-pickup.js`, its classic script tag in `allotment_v2/allotment_v2.html`, `test/ui/t_pickup_ops.mjs`, and this task's report/manifest.
- **Constraints/invariants:** No DB/backend/schema changes; use `window.laOps`/`laOpsFetch` only; preserve classic script order and legacy mode; do not persist API-derived pickup state to localStorage; do not modify shared legacy renderers or boot files.
- **Base branch:** `origin/lk-inbox`
- **Starting assumptions:** Existing `laOps` core/auth wrapper is available; backend pickup contracts are implemented in `src/domain/pickup-areas.ts` and `src/routes/operations.ts`.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Pickup Setup load | Operations mode displayed seeded/local pickup state. | Opening Pickup Setup first loads active areas and full profile/cell details from `/v1`; the server projection replaces local arrays. |
| Area/profile writes | Legacy handlers mutated browser state and called local blob persistence. | Operations mode sends POST/PATCH/DELETE first, then refreshes the server projection; failures remain visible and do not claim success. |
| Time matrix | Free-form cell text was persisted locally. | Canonical windows are mapped to backend fields, including pier deadlines; empty cells DELETE the server cell; invalid free-form values are refused visibly. |
| Resolve | No operations adapter for authoritative pickup resolution. | `laOps.pickup.resolve()` calls `/v1/pickup-time` and propagates 404 rather than falling back locally. |

### Interfaces and contracts

- **Added:** `laOps.pickup.load()`, `laOps.pickup.refresh()`, `laOps.pickup.resolve(routeId, areaId, date)`, `laOps.pickup.isReady()`; classic script `js/ops/21-ops-pickup.js`.
- **Changed:** Operations-mode wrappers for `renderPickupSetup`, `psuSaveArea`, `psuDeleteArea`, `_psuInheritTimesForArea`, `psuSetTimeCell`, `psuPersist`, plus profile save/delete and fallback profile resolution.
- **Removed:** None.
- **Compatibility notes:** Legacy mode delegates every wrapped function to its original implementation. The adapter maps snake_case API records to the existing camelCase/free-form UI shape and leaves script tags classic and ordered.

### Files changed

| Path | Purpose | Owned by this task? |
|---|---|---|
| `allotment_v2/js/ops/21-ops-pickup.js` | Operations-mode pickup adapter, mapping, loaders, server-first writers, and resolve client. | Yes |
| `allotment_v2/allotment_v2.html` | Adds the adapter after deployments and before later ops adapters. | Yes |
| `test/ui/t_pickup_ops.mjs` | Real browser + in-process backend coverage for load, CRUD, clone, cell mapping, inheritance, resolve, and no-local-persistence. | Yes |
| `docs/development/tasks/C2-LUNA-PICKUP.md` | Durable task report. | Yes |
| `.agent-reports/C2-LUNA-PICKUP.json` | Coordinator manifest. | Yes |

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** Frontend-only adapter for existing pickup contracts; no backend route or mapper edits.
- **Migration required:** No.
- **Rollback effect on data:** Reverting the commit removes the frontend adapter/tag/test; existing server pickup records remain unchanged.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check D:/projects/wt-ops-pickup/allotment_v2/js/ops/21-ops-pickup.js` | Passed |
| `node D:/projects/wt-ops-pickup/test/ui/t_pickup_ops.mjs` | Passed: 12 focused browser/API assertions, including server-first writes, clone/inherit, normal/pier cells, resolve 404, and no localStorage mutation. |
| `node --import tsx --import ./test/setup.ts --test test/pickup-areas.test.ts` from `D:/projects/operation-backend` | Passed: 3 backend pickup contract tests. Read-only inspection/test only; no backend files changed. |
| `git diff --check` | Passed |

## Decisions, coordination, and rollback

- **Decisions:** Keep pickup state authoritative from API only in operations mode; fetch profile details after the profile list because list responses do not contain cells; refresh after area/profile writes so server-side inheritance is reflected; normalize only the backend-supported window forms.
- **Known risks:** The legacy UI accepts arbitrary text in a time cell, while the backend validates structured pickup windows; unsupported text now produces a visible save error rather than being silently stored. Profile detail hydration makes one request per profile.
- **Blockers:** None.
- **Dependencies:** Existing `01-auth-sync.js`/`00-ops-core.js` operations client and the documented pickup routes in `D:/projects/operation-backend`.
- **Follow-up work:** Coordinator may add this focused test to a preferred package script or include pickup loading in shared boot sequencing if desired; this task intentionally avoided shared `90-ops-boot.js`.
- **Rollback procedure:** Revert the focused commit; legacy mode is unchanged and server data is retained.

## Agent handoff

- **Task:** C2-LUNA-PICKUP
- **Branch:** `agent/ops-pickup`
- **Commit:** recorded after the focused commit below
- **Worktree:** `D:/projects/wt-ops-pickup`
- **Jira:** None supplied.
- **PR:** None; no push requested.
- **Manifest:** `.agent-reports/C2-LUNA-PICKUP.json`
- **Unrelated changes left untouched:** None were present in this worktree; only the five owned paths above were staged.
