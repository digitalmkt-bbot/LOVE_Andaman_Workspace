# M4-money-reports: accounting and report adapters

## Input contract

- **Requested outcome:** Add the M4 frontend adapter for accounting, agent statements, Travel Summary, and Daily Report using the verified operation-backend report contracts.
- **Acceptance criteria:** Operations mode reads server-computed report payloads; daily report settings use the documented server-first PUT; report failures are visible; legacy mode delegates unchanged; Trip P&L/cost plans remain legacy-only; no report result is persisted to the legacy blob.
- **Allowed scope:** `allotment_v2/js/ops/33-ops-money-reports.js`, its classic script tag in `allotment_v2/allotment_v2.html`, `test/ui/t_ops_money_reports.mjs`, and this task's report/manifest.
- **Constraints/invariants:** Work only in `D:/projects/wt-ops-money-reports` on `agent/ops-money-reports`; use `laOps`; preserve classic script order and legacy fallback; do not invent endpoints; no backend, schema, migration, or database changes; do not push.
- **Base branch:** `c91a571`
- **Starting assumptions:** `01-auth-sync.js` provides authenticated `laOpsFetch`; `00-ops-core.js` provides `laOps.get`, `laOps.call`, `laOps.queue`, and ops-mode detection; backend source in `D:/projects/operation-backend/src/routes/money-reports.ts` and `src/domain/money-reports.ts` is authoritative.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Accounting dashboard | KPIs and aggregate dashboard values were computed from local `SB_*` data | In ops mode the dashboard/KPIs are loaded from `GET /v1/reports/accounting`; the existing invoice table remains available for the M1 projection boundary |
| Agent statement | Statement modal read local invoices/deposits | `GET /v1/agents/:id/statement` supplies invoice, deposit, credit, balance, and credit-limit values |
| Travel Summary / Daily Report | Views computed from browser aggregates | In ops mode views render `GET /v1/reports/travel-summary?date=` and `GET /v1/reports/daily?date=` payloads; daily settings come from `GET /v1/reports/daily/settings` |
| Daily settings and legacy mode | Daily settings wrote the legacy `dr_cfg` blob; legacy renderers always ran | Ops mode sends `PUT /v1/reports/daily/settings` before replacing cached settings and never writes the blob; disabled ops mode calls the original functions |

### Interfaces and contracts

- **Added:** `window.laOps.moneyReports` loaders/cache clear helper and the classic `js/ops/33-ops-money-reports.js` tag.
- **Changed:** Ops-only wrappers for `renderAccounting`, `acctDashboardHtml`, `acctStatementOpen`, `renderTravelSum`, `renderDailyReport`, and `drCfgSet`.
- **Removed:** None.
- **Compatibility notes:** Only verified report endpoints are used. Trip P&L, `cost_template`, `cost_plans`, and P&L close/freeze behavior are not wrapped and remain legacy-only. API failures use `laOps.fail` and an in-view error instead of claiming success.

### Files changed

```text
modified  allotment_v2/allotment_v2.html
added     allotment_v2/js/ops/33-ops-money-reports.js
added     test/ui/t_ops_money_reports.mjs
added     docs/development/tasks/M4-money-reports.md
added     .agent-reports/M4-money-reports.json
```

### Data and persistence impact

- **Database/schema:** None; no backend or DB file was edited.
- **API or mapper:** Frontend-only use of the verified money-report routes; no mapper or payload contract changes.
- **Migration required:** No.
- **Rollback effect on data:** Removing the tag/adapter restores legacy rendering. Successful daily-settings API writes remain server data; frontend rollback does not attempt to undo them.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check D:/projects/wt-ops-money-reports/allotment_v2/js/ops/33-ops-money-reports.js` | Passed |
| `node --check D:/projects/wt-ops-money-reports/test/ui/t_ops_money_reports.mjs` | Passed |
| `cd /d D:/projects/wt-ops-money-reports && node test/ui/t_ops_money_reports.mjs` | Passed: 10 focused assertions, 0 failures |
| `cd /d D:/projects/operation-backend && node --import tsx --import ./test/setup.ts --test test/money-reports.test.ts` | Passed: 6 tests, 0 failures |
| `cd /d D:/projects/wt-ops-money-reports && npm run test:ops` | Failed in pre-existing operations regression coverage (boat catalogue, route calendar, lock editing/release, and booking pickup flow); no M4 assertion failed before the unrelated suite abort |
| `git -C D:/projects/wt-ops-money-reports diff --check` | Passed |
| Focused `bkV2`/direct-`fetch`/Trip P&L-cost-plan scan of adapter and test | Passed; no forbidden identifiers or direct operation-backend fetch |

## Decisions, risks, and rollback

- **Decisions:** Keep the existing invoice table renderer as the M1 integration boundary while replacing its aggregate dashboard block with the server report. Render statement credits as well as invoices and deposits. Cache computed reads per report/date, invalidate them on an ops write, and update Daily Report settings only after a successful response.
- **Known risks:** The broader `test:ops` suite has unrelated baseline failures in this worktree. Accounting invoice list hydration/mutations remain M1-owned; M4 does not invent an invoice endpoint or locally approximate server state.
- **Blockers:** `npm run test:ops` remains red for the pre-existing boat/calendar/lock/booking scenarios described above; the focused M4 test and backend money-report tests pass.
- **Dependencies:** P0 auth/core (`laOps`), M1 invoice projection for the accounting table, and the verified money-report routes/domain in `operation_backend`.
- **Follow-up work:** Run the focused adapter test against an authenticated deployed backend and integrate the M1 server invoice projection when that packet lands.
- **Rollback procedure:** Revert local commit `a0073b8` or remove the M4 script tag and adapter; no DB rollback is needed.

## Agent handoff

- **Task:** M4-money-reports
- **Branch:** `agent/ops-money-reports`
- **Worktree:** `D:/projects/wt-ops-money-reports`
- **Implementation commit:** `a0073b8`
- **PR:** None (no push requested)
- **Unrelated changes left untouched:** Yes; only M4 adapter/tag/test and this task's report/manifest are owned here.
