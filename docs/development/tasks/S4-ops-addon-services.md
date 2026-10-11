# S4-ops-addon-services: migrate Add-on Services to operation-backend

## Input contract

- **Requested outcome:** Wire the durable Add-on Services catalogue to the existing operation-backend API in operations mode, without mapping custom booking add-on types.
- **Acceptance criteria:** Server list/create/replace-variants/delete flows use the documented `/v1/addon-services` routes; local projection changes only after successful responses; failed writes are visible and do not mutate local state; legacy mode remains unchanged; classic script ordering is preserved.
- **Allowed scope:** `allotment_v2/js/ops/19-ops-addon-services.js`, its classic script tag, focused add-on service test, and this report/manifest.
- **Constraints/invariants:** Frontend only; no backend/schema/DB/migration/mapping changes; use `laOps`; preserve server-first behavior, legacy fallback, and the exclusion of `SB_ADDON_TYPES` custom booking add-on types.
- **Base branch:** `c91a571`
- **Starting assumptions:** `01-auth-sync.js` supplies the authenticated ops client; `00-ops-core.js` supplies serialized writes and error reporting; the legacy Add-on Services renderer and handlers are defined before the ops tags.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Add-on Services reads | `SB_ADDON_SVCS` was a RAM-only local projection seeded by the legacy screen. | Operations mode loads `GET /v1/addon-services?active=all` and replaces the projection from the server response. |
| Add-on Services writes | Legacy modal/add/delete handlers mutated RAM directly and had no durable API path. | Create, service edit, variant add/edit (full variant-list replacement), and service/variant delete use server-first API calls; projection/UI updates follow successful responses only. |
| Compatibility | Legacy mode used the original handlers. | Every wrapper delegates to the original handler when ops mode is inactive; custom booking-priced add-on types are not read, written, or mapped by this adapter. |

### Interfaces and contracts

- **Added:** `allotment_v2/js/ops/19-ops-addon-services.js`; `window.laOps.addonServices`; `window.__laOpsAddonServiceCompat` for focused mapping tests.
- **Changed:** Operations-mode `renderAddonSvc`, `aosAddService`, `aosEditService`, `aosDeleteService`, `aosAddVariant`, `aosEditVariant`, `aosDeleteVariant`, and `aosSaveModal` wrappers.
- **Removed:** None.
- **Compatibility notes:** Server `{type,description}` maps only to the legacy renderer's `{icon,desc}` fields. Server variant `selling/net` values are retained in the projection and sent back on complete variant-list replacement. No `localStorage`, `SB_ADDON_TYPES`, or booking-rate add-on mutation is introduced. The new tag is after the existing ops adapters and before `90-ops-boot.js`; all scripts remain classic.

### Files changed

| Path | Purpose | Owned by this task? |
|---|---|---|
| `allotment_v2/js/ops/19-ops-addon-services.js` | Operations-only Add-on Services adapter and legacy-shape mapper. | Yes |
| `allotment_v2/allotment_v2.html` | Load the adapter in classic script order. | Yes |
| `test/unit/ops-addon-services.test.mjs` | Mapping, server-first, failed-write, exclusion, and legacy-fallback tests. | Yes |
| `docs/development/tasks/S4-ops-addon-services.md` | Durable S4 report. | Yes |
| `.agent-reports/S4-ops-addon-services.json` | Coordinator handoff manifest. | Yes |

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** Added only the frontend mapping to the verified routes in `D:/projects/operation-backend/src/routes/sales-editing.ts` and shape rules in `D:/projects/operation-backend/src/domain/addon-services.ts`.
- **Migration required:** No.
- **Rollback effect on data:** Reverting the frontend commit removes the adapter and restores the previous RAM-only UI; server-side catalogue records already written through the API remain server data and are not deleted by rollback.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check D:/projects/wt-ops-addons/allotment_v2/js/ops/19-ops-addon-services.js` | Passed |
| `node --check D:/projects/wt-ops-addons/test/unit/ops-addon-services.test.mjs` | Passed |
| `cd /d D:/projects/wt-ops-addons && node --test test/unit/ops-addon-services.test.mjs` | Passed: 4 tests; list projection, create, complete variant replacement, delete, failed-write rollback, booking add-on exclusion, and legacy fallback. |
| `cd /d D:/projects/operation-backend && npm test` | Passed: 573 passed, 0 failed, 8 skipped (581 total). Includes `test/sales-editing.test.ts` add-on catalogue contract coverage. |
| `git -C D:/projects/wt-ops-addons diff --check` | Passed |
| Classic tag order (`17-ops-rate-types.js` → `19-ops-addon-services.js` → `90-ops-boot.js`) | Verified |

## Decisions, coordination, and rollback

- **Decisions:** Use `active=all` so the configuration screen can display inactive catalogue records. PATCH variant operations send the complete replacement list because the backend treats `variants` as one fact. Delete removes a local projection only after the server returns 204. The adapter never calls or changes `SB_ADDON_TYPES`; custom booking add-on types remain legacy-only.
- **Known risks:** A variant replacement can race another editor because the verified API exposes no frontend concurrency token for this resource; the next server response remains authoritative. Legacy agent-level `addonServices` cleanup was not copied because the packet explicitly separates this durable catalogue from booking-priced add-ons and no server mapping for that association was verified.
- **Blockers:** None for S4.
- **Dependencies:** `01-auth-sync.js`, `00-ops-core.js`, legacy Add-on Services functions in `08-app.js`, and operation-backend sales routes/domain contracts.
- **Follow-up work:** If custom booking add-on types are to migrate later, perform a separate contract audit and packet; do not extend this adapter by inference.
- **Rollback procedure:** Revert the S4 commit, or remove the `19-ops-addon-services.js` tag and adapter/test/report files. Do not issue compensating destructive API calls as part of frontend rollback.

## Agent handoff

- **Task:** S4-ops-addon-services
- **Branch:** `agent/ops-addons`
- **Commit:** pending final local commit
- **Worktree:** `D:/projects/wt-ops-addons`
- **Jira:** None
- **PR:** None
- **Manifest:** `.agent-reports/S4-ops-addon-services.json`
- **Unrelated changes left untouched:** Existing branch history and all files outside the five owned paths remain untouched; no backend, schema, migration, mapping, DB, `HANDOFF_PARITY_TESTING.md`, or `parity-testing-flowchart.html` file was changed.
