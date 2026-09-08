# LAM-17: Fix the accounting/operations permission gate on booking persistence

## Input contract

- **Requested outcome:** An accounting-only user's invoice actions (create invoice, record payment, void invoice) must durably persist the linked booking's `invoiceId`/`paymentStatus`/`history` fields, not just the invoice/payment records themselves.
- **Acceptance criteria:** An accounting-only user creates an invoice, reloads, and the booking still shows invoiced. Also: no persist helper may call another persist helper with a stricter area.
- **Allowed scope:** `allotment_v2/allotment_v2.html` (smallest region around `acctPersistBookings`/the accounting persist helpers), plus a new static-analysis tool and this task's own report/manifest artifacts.
- **Constraints/invariants:** Confine the HTML edit to the smallest region around the permission gate (LAM-18/19/20 edit the same file concurrently in separate worktrees). Never touch package.json, test/**, .github/**, CLAUDE.md, README.md. No Postgres/network access available in this sandbox.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:** `laCanEditArea(area)` is the established per-section permission check; `'accounting'` and `'operations'` are distinct, non-overlapping `editAreas` an admin can grant independently (see `LA_AREAS` at allotment_v2.html:407). The existing `ckCanEdit()`/`ckPersist()` pair (`operations || pier`) is the codebase's own precedent for a persist helper whose data is legitimately written from more than one area.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| `acctPersistBookings()` gate | Gated on `laCanEditArea('operations')` only | Gated on `laCanEditArea('operations') OR laCanEditArea('accounting')` via new `acctCanEditBookings()` helper |
| Accounting-only user issuing an invoice (`acctCreateInvoice`) | `sbInvoicesPersist()` (gated `accounting`) succeeds and writes `sb_invoices`; the immediately-following `acctPersistBookings()` (gated `operations`) silently no-ops, so `bk.invoiceId`/`bk.paymentStatus`/`bk.history` entries set on the in-RAM `SB_BOOKINGS` rows are never written to the `loveandaman_v2` blob | Both persist calls succeed for an accounting-only user; the booking's `invoiceId='<inv id>'`, `paymentStatus='invoiced'`, and history entry are written to the blob and survive reload |
| Same shape for `acctRecordPayment()` (paymentStatus paid/partial + history) and `acctVoidInvoice()` (invoiceId cleared, paymentStatus reset) | Same silent-drop bug | Same fix applies (all three route through `acctPersistBookings()`) |
| Static regression guard | None existed | New `tools/check-persist-gates.mjs` scans the extracted main `<script>` for (a) a persist-helper directly calling another persist-helper whose gate is not implied by the caller's own gate (`nested-stricter-callee`), and (b) any function calling two-or-more persist helpers whose gated areas share no common area (`sibling-disjoint-gates`) — the exact shape of this bug |

### Interfaces and contracts

- **Added:** `acctCanEditBookings()` (new small helper function in `allotment_v2.html`, mirrors the existing `ckCanEdit()` OR-of-areas pattern). `tools/check-persist-gates.mjs` (new standalone Node script, no new npm dependency, no `package.json` change).
- **Changed:** `acctPersistBookings()` now calls `acctCanEditBookings()` instead of a single inline `laCanEditArea('operations')` check. Its behavior for `operations`-area and `admin` users is unchanged; it now additionally proceeds for `accounting`-area users. No other callers, field names, or data shapes changed.
- **Removed:** None.
- **Compatibility notes:** Purely an additive relaxation of a write gate (adds `accounting` as a second sufficient area) — no existing caller loses access, no schema change, no field renamed. `SB_BOOKINGS`/`sb_invoices`/`sb_payments` shapes are unchanged.

### Files changed

```text
modified	allotment_v2/allotment_v2.html
added	tools/check-persist-gates.mjs
added	docs/development/tasks/LAM-17.md
added	.agent-reports/LAM-17.json
```

### Data and persistence impact

- **Database/schema:** None. No column/table shape change. `sb_bookings` and `sb_invoices` continue to hold the same fields (`invoiceId`, `paymentStatus`, `history`).
- **API or mapper:** None — this is a client-side (localStorage blob) write-gate fix only; `server.js` and the Postgres mapper are untouched.
- **Migration required:** No.
- **Rollback effect on data:** Reverting the HTML edit restores the pre-fix behavior (accounting-only users' booking-side writes silently drop again on refresh); no destructive data change was made, so rollback is safe and does not need a migration or backfill.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check` on the extracted main `<script>` block (lines containing `sbInvoicesPersist`…last `</script>`, i.e. the app script that defines `acctPersistBookings`) | Passed — `SYNTAX OK` |
| Functional gate simulation: re-implemented `laCanEditArea`/`acctCanEditBookings` verbatim from the edited source and exercised 4 scenarios (`editAreas:['accounting']`, `['operations']`, `['sales']`, `role:'admin'`) | Passed — accounting-only=`true`, operations-only=`true`, sales-only=`false`, admin=`true` (all matched expectation) |
| `node tools/check-persist-gates.mjs` (new static check) run against the fixed file | Ran; exit code 1 with **3** pre-existing findings, **none involving `acctPersistBookings`/`sbInvoicesPersist`** (confirmed by grepping the tool's output for those two names — no match). The 3 findings (`agClearExecute` mixing `sales`/`operations` gates across `sbAgentsPersist`/`sbSeatLocksPersist`/`ctArtifactsPersist`; `tmSaveModal` mixing `config`/`sales` gates across `sbMarketsPersist`/`sbSalesPersist`) are pre-existing, unrelated to this task's owned files, and out of scope for LAM-17 — left untouched per the task's file-ownership constraint. Full output captured in the run log below. |
| Full end-to-end acceptance test ("accounting-only user creates an invoice, reloads, and the booking still shows invoiced") against a running app + Postgres | **Not run** — no Postgres and no network-reachable prod/dev service is available in this sandbox; `start_server.command`/a live login cannot be exercised here. The functional gate simulation above exercises the exact logic change in isolation as the closest available substitute. |

`check-persist-gates.mjs` run log (abridged, matches current repo state):

```
check-persist-gates: 3 finding(s):

[sibling-disjoint-gates] agClearExecute (line ~26664): sbAgentsPersist vs sbSeatLocksPersist
[sibling-disjoint-gates] agClearExecute (line ~26664): sbSeatLocksPersist vs ctArtifactsPersist
[sibling-disjoint-gates] tmSaveModal (line ~39584): sbMarketsPersist vs sbSalesPersist
```

## Decisions, risks, and rollback

- **Decisions:** Followed the codebase's own established precedent (`ckCanEdit()`/`ckPersist()`, `operations || pier`) rather than inventing a new gating idiom — added `acctCanEditBookings()` as a same-shaped OR-of-areas helper and pointed `acctPersistBookings()` at it. Kept the diff to the single function plus a short explanatory comment block; did not touch any of the ~20 call sites of `acctPersistBookings()` since the fix is entirely inside the gate itself.
- **Known risks:** The new static-check tool's area-set extraction is a regex/brace-matching heuristic, not a real JS parser — it can theoretically mis-resolve an unusual gate shape (e.g. a gate expressed as a ternary or a negated-AND instead of the two idioms seen in this file: single `laCanEditArea('X')` or an OR-chain). It was validated against this file's actual 35 `*Persist*` helpers and correctly reproduced the known-good `ckCanEdit`/`poCanEdit` OR patterns and the specific bug pair this task fixes, but it is a heuristic, not a guarantee. The tool surfaced 2 pre-existing, unrelated findings (`agClearExecute`, `tmSaveModal`) that are real (manually verified by reading their source) but out of this task's scope.
- **Blockers:** None for the owned scope. The full E2E acceptance flow (login as an accounting-only user against the real app + Postgres) could not be run in this sandbox — see Verification evidence.
- **Dependencies:** None on other in-flight LAM-18/19/20 work; the edited region (`acctPersistBookings`, line ~42877) was not reported as touched by any sibling task at the time of this change.
- **Follow-up work:** Consider triaging the 2 pre-existing `check-persist-gates.mjs` findings (`agClearExecute`'s agent-bulk-delete mixing `sales`/`operations`/`operations` gates; `tmSaveModal` mixing `config`/`sales` gates) as separate tickets — not fixed here, out of LAM-17's owned scope.
- **Rollback procedure:** `git revert` the commit on this branch (or drop the branch pre-merge). The change is additive-only to a permission gate; reverting restores the strict `operations`-only gate with no data loss (any bookings that picked up `invoiceId`/`paymentStatus` while the fix was live remain valid — the revert only affects future writes' visibility to accounting-only users, not existing data).

## Agent handoff

- **Task:** LAM-17
- **Branch:** `agent/LAM-17-acct-ops-permission-gate`
- **Worktree:** `D:/projects/wt-sprint1/LAM-17-acct-ops-permission-gate`
- **HEAD at scaffold:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** [#8](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/8) — open, base `refactor/booking-v2-migration` ← head `agent/LAM-17-acct-ops-permission-gate`
- **Unrelated changes left untouched:** The 2 pre-existing disjoint-gate findings surfaced by the new tool (`agClearExecute`, `tmSaveModal`) — real but out of scope for this task.
