# S3-ops-contracts: Recover operation-backend Contracts and Templates adapter

## Input contract

- **Requested outcome:** Recover the uncommitted S3 Contracts/Templates frontend work in the isolated `agent/ops-contracts` worktree, review it against the exact `operation-backend` contracts, and commit only the S3 adapter, classic tag, focused test, and handoff artifacts.
- **Acceptance criteria:** Promo create/edit/void uses the confirmed contract API; templates use the confirmed template API including default selection; documents are read-only displays using confirmed shapes; syntax and focused tests pass; no artifact metadata/upload mapping is implemented.
- **Allowed scope:** `allotment_v2/js/ops/18-ops-contracts.js`, its tag in `allotment_v2/allotment_v2.html`, `test/unit/ops-contracts.test.mjs`, this report, and `.agent-reports/S3-ops-contracts.json`.
- **Constraints/invariants:** Preserve existing dirty worker files; no backend, schema, migration, or DB changes; no push; keep the HTML tag a classic ordered script before `90-ops-boot.js`; do not map behavior explicitly marked BLOCKED.
- **Base branch:** `origin/integration/operation-backend`.
- **Starting assumptions:** The dirty worktree contained the S3 tag, adapter, and focused test from the usage-limited Luna worker; the operation-backend checkout at `D:/projects/operation-backend` is the source of truth for API shapes.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Promo contracts | Legacy `SB_CONTRACTS` persistence was the only active behavior. | Ops mode reads `/v1/contracts`, maps explicit program/seat-price rows, and writes promo create, edit, and void to the documented server endpoints. PATCH removes create-only `agent_id`. |
| Contract templates | Legacy template seed/blob writers could persist browser data. | Ops mode reads template detail records, maps their legacy-compatible view, and routes create/edit/default/delete/reset writes through `/v1/contract-templates`. |
| Contract documents | The legacy document wizard persisted generated artifact metadata locally. | Ops mode opens confirmed server document records read-only through agent document list/detail endpoints. Artifact generation, persistence, removal, and reopen metadata mapping remain unavailable. |

### Interfaces and contracts

- **Added:** `window.laOpsContracts` and `window.__laOpsContractsCompat` mappings in `18-ops-contracts.js`.
- **Changed:** Legacy promo/template/document entry points are wrapped only while `window.laOps.enabled()` is true; legacy behavior remains unchanged otherwise.
- **Removed:** None.
- **Compatibility notes:** The adapter retains legacy-compatible in-memory contract/template projections for existing renderers but never invokes legacy blob persistence in ops mode.

### Files changed

| Path | Purpose | Owned by this task? |
|---|---|---|
| `allotment_v2/allotment_v2.html` | Loads the adapter as a classic script before ops boot. | Yes |
| `allotment_v2/js/ops/18-ops-contracts.js` | S3 contracts/templates/read-only document adapter. | Yes |
| `test/unit/ops-contracts.test.mjs` | Focused mapping, PATCH payload, artifact-blocking, and tag-order checks. | Yes |
| `docs/development/tasks/S3-ops-contracts.md` | Human-readable S3 handoff. | Yes |
| `.agent-reports/S3-ops-contracts.json` | Machine-readable S3 handoff. | Yes |

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** Uses existing operation-backend contract, contract-template, and document APIs only.
- **Migration required:** No.
- **Rollback effect on data:** Reverting the frontend adapter stops its API calls; it does not alter existing server records or schema.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check allotment_v2/js/ops/18-ops-contracts.js` | Passed |
| `node --test test/unit/ops-contracts.test.mjs` | Passed: 5 tests |
| `cd D:/projects/operation-backend && npm test` | Passed |
| `git diff --check` plus untracked adapter/test whitespace checks | Passed; no whitespace errors found |

## Decisions, risks, and rollback

- **Decisions:** Reviewed the recovered worker files against `src/routes/sales-editing.ts`, `src/domain/contracts.ts`, `contract-writes.ts`, and `contract-templates.ts`. Removed the recovered legacy-artifact reopen translation, added the missing template reset writer wrapper, and removed `agent_id` from promo PATCH bodies because the backend only accepts it on create.
- **Known risks:** No browser/live API E2E was run. The retained legacy UI labels still describe document generation even though ops mode intentionally exposes read-only server documents.
- **Blockers:** Exact legacy generated-artifact metadata/upload mapping is explicitly BLOCKED by S3 and intentionally not implemented.
- **Dependencies:** `window.laOps` shared client, S1's `agRenew` adapter for renewal, and the existing operation-backend sales editing routes.
- **Follow-up work:** Define and inspect a server-backed document generation/artifact metadata contract before replacing the legacy document wizard/history UX.
- **Rollback procedure:** Revert the S3 implementation and metadata commits; no database rollback is needed.

## Agent handoff

- **Task:** S3-ops-contracts
- **Branch:** `agent/ops-contracts`
- **Worktree:** `D:/projects/wt-ops-contracts`
- **Implementation commit:** `915129cad41c2ac5f5f553bc69f0041dc31cf0a3`.
- **PR:** None (not pushed).
- **Manifest:** `.agent-reports/S3-ops-contracts.json`
- **Unrelated changes left untouched:** None; the recovered dirty S3 adapter, tag, and test became the owned S3 work after review.
