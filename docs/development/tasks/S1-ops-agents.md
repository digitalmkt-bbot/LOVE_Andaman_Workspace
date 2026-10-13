# S1-ops-agents: migrate Agent List to operation-backend

## Input contract

- **Requested outcome:** Replace `sb_agents` browser persistence with the operation-backend Agents API in operations mode.
- **Acceptance criteria:** Agent list/detail reads use server data; create/edit/table/delete/lifecycle writes use documented `/v1/agents` routes; local projection changes only after successful responses; legacy mode remains unchanged; focused UI and backend checks pass.
- **Allowed scope:** `allotment_v2/js/ops/16-ops-agents.js`, its classic script tag, focused `test/ui/t_ops_agents.mjs`, and this report/manifest.
- **Constraints/invariants:** No backend, database, migration, mapping, schema, or shared legacy-renderer edits; use `laOps`; preserve classic script ordering and legacy mode.
- **Base branch:** `231ce9e`
- **Starting assumptions:** `00-ops-core.js` supplies the authenticated operation client and serialized writes; `10-ops-catalogue.js` supplies the authoritative Agent summary/detail read mapping and is loaded after the S1 adapter.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Agent reads | Operations mode had a summary projection plus a read-only catalogue guard; detail could retain local-only values. | S1 fetches authoritative detail/activity on selection and maps server snake/nested fields into the legacy Agent projection. |
| Agent writes | Operations mode blocked create/edit/delete, while legacy paths wrote localStorage. | Create, section edit, programs, rate type, table cells, bulk/fill/delete, delete, and lifecycle helpers write through documented API routes; successful responses replace the projection. |
| Error/legacy behavior | Legacy writes were available outside operations mode. | Legacy functions remain the fallback when operations mode is inactive; failed operation writes show an error and do not update the local projection or localStorage. |

### Interfaces and contracts

- **Added:** `window.laOpsAgentLifecycle`, `window.agActivate`, `window.agDeactivate`, and `window.agRenew` helpers; classic `js/ops/16-ops-agents.js` adapter.
- **Changed:** Agent UI entry points are wrapped only when `laOps.enabled()` is true. API mappings use nested `company`, `signatory`, `booking_channel`, `programs`, and `rate_type_id` contracts; legacy `bank` is mapped to server `bt`.
- **Removed:** None.
- **Compatibility notes:** The adapter is loaded after `00-ops-core.js` and before `10-ops-catalogue.js`, so catalogue summary loading remains intact while its former operations read-only wrappers do not override S1 edit wrappers. No script is deferred, async, or modularized.

### Files changed

```text
modified allotment_v2/allotment_v2.html
added    allotment_v2/js/ops/16-ops-agents.js
added    test/ui/t_ops_agents.mjs
added    docs/development/tasks/S1-ops-agents.md
added    .agent-reports/S1-ops-agents.json
```

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** Frontend-only Agent API adapter and legacy-shape mapper; backend contracts were read from `D:/projects/operation-backend/src/routes/sales-editing.ts`, `src/domain/agent-writes.ts`, and `src/domain/agents.ts`.
- **Migration required:** No.
- **Rollback effect on data:** Reverting the frontend commit restores the prior UI behavior; already completed API writes remain valid server data and are not rolled back by a frontend revert.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check allotment_v2/js/ops/16-ops-agents.js` | Passed |
| `node --check test/ui/t_ops_agents.mjs` | Passed |
| `node test/ui/t_ops_agents.mjs` | Passed: create pending-state, nested payload mapping, post-success projection, edit, and failed-write rollback checks |
| `cd D:/projects/operation-backend && npm test` | Passed: 573 passed, 0 failed, 8 skipped |
| `npm run test:agprog` | Passed: failures 0 |
| `npm run test:ops` | Failed in existing broader ops smoke: boat/calendar/lock assertions and booking fixture flow failed before reaching an S1 assertion; no S1 adapter error was reported |
| `npm run test:aginfo` / `npm run test:aghd` | Blocked by the static harness login modal intercepting clicks in this environment |
| `git diff --check` | Passed |

## Decisions, risks, and rollback

- **Decisions:** Server responses are the only source used to update `SB_AGENTS`; localStorage persistence is suppressed only while operations mode is enabled. Import is explicitly refused in operations mode rather than silently performing a local-only import because no bulk import API contract is verified. Rate-type changes retry with `drop_unpriced: true` only after the server returns `unpriced_programs` and the user confirms.
- **Known risks:** Bulk edits can partially succeed if a later server request fails; the local projection is updated per successful response, and the failed request is surfaced. The existing broad ops smoke fixture has unrelated failures.
- **Blockers:** None for S1 implementation. `test:aginfo` and `test:aghd` need a harness login bypass in this environment; `test:ops` has pre-existing fixture/assertion failures.
- **Dependencies:** `01-auth-sync.js` token/`laOpsFetch`, `00-ops-core.js`, catalogue Agent list data, and the documented operation-backend sales routes.
- **Follow-up work:** Add a dedicated UI entry point for activate/deactivate/renew if product wants those lifecycle commands surfaced; currently stable global helpers are exposed for callers.
- **Rollback procedure:** Revert commit `9e64d594cb05cbc556484f064c2564fb10fc6436` (or remove the S1 script tag and adapter/test/report paths); do not issue destructive API calls as part of rollback.

## Agent handoff

- **Task:** S1-ops-agents
- **Branch:** `agent/ops-agents`
- **Worktree:** `D:/projects/wt-ops-agents`
- **HEAD at scaffold:** `231ce9e4f249d9e4ebc5ca29ce61631811a3c7c0`
- **PR:** None
- **Unrelated changes left untouched:** No coordinator/shared legacy files, backend files, schema files, migrations, `HANDOFF_PARITY_TESTING.md`, or `parity-testing-flowchart.html` were changed.
