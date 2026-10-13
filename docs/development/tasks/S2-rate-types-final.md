# S2-rate-types-final: Rate types and booking-price compatibility

## Input contract

- **Requested outcome:** Migrate Rate Type reads and writes to operation-backend while retaining the legacy camelCase projection consumed by booking quote functions.
- **Acceptance criteria:** Load authenticated `/v1/rate-types` data authoritatively; map route validity, net/sell/min-sell tiers, bundles, charter, longtail, and transfer prices; server-first create/edit/delete; preserve legacy mode and visibly surface failures; add focused mapping evidence.
- **Allowed scope:** `allotment_v2/js/ops/17-ops-rate-types.js`, its classic script tag in `allotment_v2/allotment_v2.html`, `test/unit/ops-rate-types.test.mjs`, and this task's report/manifest.
- **Constraints/invariants:** No backend, DB, schema, migration, or mapping changes; use `laOps`; keep classic script ordering; no localStorage durability in ops mode; `net` is the booking-charge tier; custom add-on types remain outside S2; do not touch shared legacy renderers.
- **Base branch:** `origin/integration/operation-backend`
- **Starting assumptions:** `01-auth-sync.js` provides `laOpsFetch`, `00-ops-core.js` provides the authenticated serialized API client, and backend route/domain contracts in `src/routes/operations.ts` and `src/domain/rate-types.ts` are authoritative.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Rate Type load in ops mode | Seed/blob `SB_RATE_TYPES` could be shown | List and detail are fetched from `/v1/rate-types`; the server response replaces the local projection, and a failed load leaves writers off and reports an error |
| Booking price consumers | Consumed the legacy camelCase shape | API rows are translated to `seatRates`, `priceTiers`, `routeValidity`, bundles, charter, longtail, and transfer fields; only `net` populates chargeable `seatRates` |
| Rate Type writes | `rtPersist()` wrote the legacy blob | Create, header patch, per-route replacement/deletion, and delete call the API first; the in-memory projection changes only after success |
| Legacy deployment | Could use the existing functions | The adapter is inert unless ops mode is active; legacy `rt*` behavior remains unchanged |

### Interfaces and contracts

- **Added:** `window.laOps.rateTypes` loader/refresh state and `window.__laOpsRateTypeCompat` mapping helpers for focused tests/diagnostics; classic `js/ops/17-ops-rate-types.js` tag.
- **Changed:** Ops wrappers for `rtOpenNew`, `rtOpenEdit`, `rtSaveDraft`, `rtPersist`, `rtAddonTypesOpen`, and `rtDeleteRT`; API calls use `/v1/rate-types`, `/v1/rate-types/:id`, `/v1/rate-types/:id/routes/:route_id`.
- **Removed:** None.
- **Compatibility notes:** API `net` maps to legacy `seatRates`; `sell` and `min_sell` remain in legacy `priceTiers` and are never used as booking net. Unsupported custom add-on pricing is refused visibly rather than silently dropped.

### Files changed

```text
modified  allotment_v2/allotment_v2.html
added     allotment_v2/js/ops/17-ops-rate-types.js
added     test/unit/ops-rate-types.test.mjs
added     docs/development/tasks/S2-rate-types-final.md
added     .agent-reports/S2-rate-types-final.json
```

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** Frontend-only adapter and legacy/API shape conversion; backend source was inspected but not edited.
- **Migration required:** No.
- **Rollback effect on data:** Reverting the commit restores legacy function behavior and removes the ops adapter/tag; already successful API writes remain server data and are not undone by frontend rollback.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check D:/projects/wt-ops-rate-types/allotment_v2/js/ops/17-ops-rate-types.js` | Passed |
| `node --check D:/projects/wt-ops-rate-types/allotment_v2/js/08-app.js` | Passed; shared file was not modified |
| `cd D:/projects/wt-ops-rate-types && node --test test/unit/ops-rate-types.test.mjs` | Passed (2 tests) |
| `cd D:/projects/operation-backend && npm test` | Passed (573 passed, 8 skipped, 0 failed) |
| `cd D:/projects/wt-ops-rate-types && npm run test:ops` | Blocked: frontend worktree has no `playwright` package installed |
| `git -C D:/projects/wt-ops-rate-types diff --check` | Passed |
| conflict-marker and `bkV2` scan over touched adapter/tag | Passed; no matches |

## Decisions, risks, and rollback

- **Decisions:** Load list summaries followed by detail requests so booking-compatible projections contain all prices. Use a final detail refetch after multi-call edits. Refuse custom add-on pricing in S2 because S4 owns that catalogue and the backend contract has no equivalent field.
- **Known risks:** Existing edits use several API calls because the contract replaces one route block at a time; if a later call is refused, the adapter leaves local state unchanged and refetches the server record. The static UI test suite was not runnable without Playwright.
- **Blockers:** `npm run test:ops` requires the missing frontend `playwright` dependency; no code blocker.
- **Dependencies:** P0 auth/core; S1 agent bindings for server-side agent ownership; operation-backend rate-type routes/domain.
- **Follow-up work:** Add S2 to the coordinator's boot serialization if desired, and add an authenticated browser integration test against a test backend once the frontend Playwright dependency is installed.
- **Rollback procedure:** Revert this commit or remove the new tag and adapter; do not issue database rollback commands.

## Agent handoff

- **Task:** S2-rate-types-final
- **Branch:** `agent/ops-rate-types`
- **Worktree:** `D:/projects/wt-ops-rate-types`
- **HEAD at scaffold:** `231ce9e`
- **Merge base:** `d9018df7bb57febdd0c061a12486ff493479049f`
- **PR:** None (no push requested)
- **Unrelated changes left untouched:** Yes; only the S2 files and this task's unique report/manifest are changed.
