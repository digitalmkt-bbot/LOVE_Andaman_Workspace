# LAM-19: Partial cancel must return seat-lock draws

## Input contract

- **Requested outcome:** `bkV2PartialCancel` (`allotment_v2/allotment_v2.html`, ~line 77728) must return the seat-lock draws corresponding to the removed pax when a booking's pax count is reduced via partial cancel, and must flag the booking's invoice as needing manual adjustment (without auto-editing any money on that invoice).
- **Acceptance criteria:**
  - When a partial cancel removes pax from a trip that drew seats from one or more seat locks (`trips[].lockDraws`), the returned quantity is credited back to those locks via the existing `bkV2ReturnLock`/`bkV2DrawLock` accounting (`l.used` decremented, a `'return'` entry appended to `l.log`) so the seats become available again through `getAllotment`.
  - The amount returned per trip is capped at what that trip actually drew from locks (`trips[].lockDraws` is the source of truth per CLAUDE.md/docs section 7.6, not the `used` counter) — pax removed beyond the locked total was general pool and is already freed automatically because `getSeatsConsumed` reads the live (already-decremented) `trips[].pax`.
  - `trips[tripIdx].lockDraws` is updated to reflect the reduced/removed entries (partial entries shrink, fully-consumed entries are dropped) so `bkV2LockClaims` / lock-usage displays stay accurate.
  - The booking's active (non-void) invoice, if any, is flagged as needing adjustment (`needsAdjustment=true` + an appended `adjustmentFlags[]` entry with reason/removed/refund/at/by) — invoice totals/line items are **not** modified.
  - No change to any other function's behavior; full cancel (`bkV2CancelBooking`) and edit-return (`bkV2ReturnBookingDraws`) paths are untouched.
  - `node --check` passes on the extracted main `<script>` after the edit.
- **Allowed scope:**
  - `allotment_v2/allotment_v2.html` (function `bkV2PartialCancel` only, plus its owning report/manifest docs)
  - `docs/development/tasks/LAM-19.md`
  - `.agent-reports/LAM-19.json`
- **Constraints/invariants:**
  - Do NOT auto-adjust invoice amounts — only flag the invoice as needing adjustment.
  - `allotment_v2/allotment_v2.html` is huge (~4MB/~46k lines) — grep to locate, read a small window, make a targeted edit, verify with `node --check` on the extracted script; never read the whole file.
  - Never touch `package.json`, `test/**`, `.github/**`, `CLAUDE.md`, `README.md`.
  - Stage only owned paths explicitly; never `git add -A` / `git add .`.
  - LAM-17/18/20 edit the same HTML file concurrently in separate worktrees — merge conflicts against them are accepted, not something to resolve here.
  - `esc`/`escapeHTML` is not global; build `YYYY-MM-DD` with `bkV2LocalYMD`, never `toISOString().slice(0,10)` — not applicable to this edit (no HTML rendering or date construction added) but kept in mind.
  - Postgres via `server.js` is the durable store; localStorage is the in-browser working copy — always read-modify-write the blob (preserved: the existing read-modify-write persist call at the end of the function is unchanged in shape).
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:**
  - The seat-lock return primitives `bkV2ReturnLock(lockId, qty, bookingId, tripDate, why)` and `bkV2DrawLock` already implement correct, idempotent lock-accounting (`used`/`usedBy`/`log`/`status`) — this task reuses them rather than reimplementing lock bookkeeping, matching how `bkV2CancelBooking` (full cancel, `:76353-76358`) and the edit-path (`:76956-76957`) already call `bkV2ReturnBookingDraws`.
  - Because seat locks are drawn per-trip in aggregate (`trips[].lockDraws: [{lockId,qty}]`) with no per-pax-key attribution, the correct return quantity for a partial cancel is `min(pax removed for that trip, that trip's total currently-drawn lock qty)` — any remainder of the removed pax was drawn from the general (non-locked) pool and needs no explicit return because `getSeatsConsumed` already reads the reduced `trips[].pax` live.
  - `acctBookingInvoice(bookingId)` (existing helper, already used by `bkV2CancelBooking`) is the correct way to find the active invoice to flag; `sbInvoicesPersist()` (existing helper) is the correct read-modify-write persistence call for `SB_INVOICES`.
  - No Postgres/live server or browser was reachable in this sandbox, so verification is: static syntax check (`node --check`) plus a standalone logic-level unit test of the return-quantity algorithm extracted into a throwaway script — not a live end-to-end run against the running app.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| `bkV2PartialCancel` — seat-lock accounting | Partial cancel decremented `trips[tripIdx].pax` and reduced `bk.priceBreakdown.total`/`bk.total`, but never touched `trips[tripIdx].lockDraws` or called `bkV2ReturnLock`. Any seats the removed pax had drawn from a seat lock stayed permanently marked as `used` on that lock (`l.used` never decremented), so they never became available again via `getAllotment` even though the booking no longer needed them — a slow, silent seat leak on every partial cancel against a locked booking. | Partial cancel now returns up to `opts.totalRem` seats from `trips[tripIdx].lockDraws` back to their originating lock(s) via the existing `bkV2ReturnLock(lockId, qty, bookingId, tripDate, 'partial cancel')` helper (same primitive full-cancel and edit-return already use), decrementing `lockDraws` entries (dropping ones fully consumed), clamping `trips[tripIdx].seatSource.locked` down to match, and logging a Thai history line (`คืนที่นั่งเข้า seat lock N ที่ (partial cancel)`) when any seats were actually returned. Pax removed beyond what was locked needs no extra handling — it was general pool, already freed because `getSeatsConsumed` reads the already-decremented live pax. |
| `bkV2PartialCancel` — invoice | Partial cancel never touched the booking's invoice at all; an invoice raised before the reduction kept stale pax/amount with no signal to accounting staff that a reconciliation was needed. | If the booking has an active (non-void) invoice (via `acctBookingInvoice`), it is stamped `needsAdjustment=true` and gets a new `adjustmentFlags[]` entry `{reason:'partial_cancel', bookingId, tripIdx, removed, count, refund, at, by}`, then persisted via `sbInvoicesPersist()`. No invoice amount, line item, or status is changed — this is a flag only, per the task's explicit "do NOT auto-edit money" constraint. |

### Interfaces and contracts

- **Added:**
  - `SB_INVOICES[*].needsAdjustment` (boolean, optional field, only set true by this new flagging path)
  - `SB_INVOICES[*].adjustmentFlags[]` (optional array of `{reason, bookingId, tripIdx, removed, count, refund, at, by}`, appended by this new flagging path)
- **Changed:** None
- **Removed:** None
- **Compatibility notes:** Both new fields are additive and optional (undefined when never flagged), matching CLAUDE.md section 4's "add new fields as optional with defaults." No existing field, event shape, or function signature changed.

### Files changed

| Path | Purpose | Owned by this task? |
|---|---|---|
| `allotment_v2/allotment_v2.html` | `bkV2PartialCancel` (~line 77728): after the existing pax-decrement/refund/`partialCancels`-log block, add (1) lock-draw return logic that credits back up to `opts.totalRem` seats from `trips[tripIdx].lockDraws` via `bkV2ReturnLock`, updates `lockDraws`/`seatSource.locked`, and logs a history entry when >0 seats were returned; (2) invoice-flagging logic that marks the booking's active invoice (via `acctBookingInvoice`) `needsAdjustment=true` with an appended `adjustmentFlags[]` entry, persisted via `sbInvoicesPersist()`, without modifying any invoice amount. | Yes |

### Data and persistence impact

- **Database/schema:** None — no relational schema change. Additive optional JSON fields only, carried in the existing `sb_bookings`/`sb_invoices` blob sub-keys.
- **API or mapper:** None touched.
- **Migration required:** No.
- **Rollback effect on data:** None — see Rollback procedure below.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check` on the extracted main `<script>` block (largest of the HTML's inline `<script>` tags, 3,479,574 chars) written to a scratch file | Passed. Printed `main script length 3479574 of 8 scripts` then `SYNTAX OK`. |
| `git diff --stat` / `git diff -- allotment_v2/allotment_v2.html` (manual review of the exact diff) | Passed. Diff is a single localized insertion of 38 lines inside `bkV2PartialCancel` between the existing `partialCancels`-log/history line and the existing persist block; no other lines in the file changed. |
| Standalone logic-level unit test of the `lockDraws` return-quantity algorithm (extracted into a throwaway Node script, run with `node test_partial_cancel.mjs`) — NOT a run of the real app, since no browser/localStorage/live Postgres is reachable from this sandbox | Passed. 4 assertion cases all passed (`ALL ASSERTIONS PASSED`): (1) partial removal from a single lock returns exactly the removed qty and leaves the remainder in `lockDraws`; (2) removal spanning two `lockDraws` entries drains the first fully (entry dropped) then partially drains the second; (3) removed pax count exceeding the total locked draws caps the return at the locked total and empties `lockDraws` / floors `seatSource.locked` at 0; (4) a trip with no `lockDraws` at all returns 0 and does not throw. |
| Live app / browser / Postgres end-to-end verification of `bkV2PartialCancel` against a running instance | Blocked. No network-reachable Railway/Postgres instance and no browser session were available in this sandbox. Not attempted; reported honestly as blocked rather than faked. |

## Decisions, risks, and rollback

- **Decisions:**
  - Return quantity per trip = `min(pax removed for that trip, that trip's currently-drawn lockDraws total)`, distributed across the trip's `lockDraws` entries in array order (drain first entry before moving to the next) — order among multiple locks on the same trip has no behavioral significance since `bkV2ReturnLock` is a pure per-lock credit; any simple deterministic order is correct and this keeps the code simple.
  - Reused the existing `bkV2ReturnLock(lockId, qty, bookingId, tripDate, why)` primitive rather than writing new lock-mutation code, to stay consistent with how full-cancel (`bkV2CancelBooking`) and edit-return (`bkV2ReturnBookingDraws`) already treat `trips[].lockDraws` as the source of truth per `docs/workflows/01-booking-lifecycle.md` section 7.6 / CLAUDE.md.
  - Invoice flagging is purely additive/non-destructive (new optional `needsAdjustment` + `adjustmentFlags[]` fields) rather than changing `bk.paymentStatus` or any invoice amount, per the explicit task constraint "do NOT auto-edit money."
  - Did not add any new UI (badge/indicator) to surface `needsAdjustment` on the Accounting invoice list/detail pages — out of scope per the Jira text, which only asks to flag the invoice; adding a UI surface would have required touching additional rendering code not called out in the ticket and risked broader collateral change in a file three other concurrent tasks are also editing.
- **Known risks:**
  - `SB_INVOICES.needsAdjustment`/`adjustmentFlags` are currently write-only from this change — no UI in the app reads or displays them yet, so accounting staff won't see the flag unless a follow-up adds a badge/filter to the invoice list or detail view.
  - `allotment_v2/allotment_v2.html` is being edited concurrently by LAM-17/18/20 in separate worktrees; merging all four branches into `refactor/booking-v2-migration` will very likely produce textual merge conflicts in this large single file (accepted per task instructions, not something this task resolves).
  - The return-quantity algorithm was verified with a standalone extracted-logic unit test, not a live run inside the actual app against real `SB_SEAT_LOCKS`/`SB_BOOKINGS`/`SB_INVOICES` globals and their real `getAllotment`/`getSeatsConsumed` call sites — a live/E2E pass (per CLAUDE.md section 4's preference for local-server E2E with `zz_test_*` scratch records) is recommended before this ships to prod.
- **Blockers:** None.
- **Dependencies:** None.
- **Follow-up work:**
  - Add a visible flag/badge for `SB_INVOICES[*].needsAdjustment` on the Accounting invoice list and/or detail view so staff can find invoices that need manual reconciliation after a partial cancel.
  - Run a live-app E2E check (local server against the dev DB, using `zz_test_*` scratch booking + lock records) to confirm `bkV2PartialCancel`'s new return-lock-draws and invoice-flag paths behave correctly end to end, since no browser/Postgres was reachable in this sandbox.
  - Consider whether `trips[tripIdx].seatSource.general` should also be recalculated on partial cancel (currently only `.locked` is adjusted here; `.general` already reflects fewer pax indirectly through `bkV2PaxAllTot`-based reads elsewhere, but was not touched by this change to keep the diff minimal and scoped to the `lockDraws`/invoice fix).
- **Rollback procedure:** Revert the single localized 38-line insertion in `allotment_v2/allotment_v2.html` inside `bkV2PartialCancel` (between the existing `partialCancels`/history line and the existing `sb_bookings` persist call) — e.g. `git revert <this-commit-sha>` on this branch, or restore `allotment_v2/BACKUP/allotment_v2_20260819_LAM-19-partial-cancel-lock-draws.html` (pre-edit backup, not committed) over `allotment_v2/allotment_v2.html`. No schema/migration was introduced (only additive optional fields `lockDraws` already had, plus new optional `SB_INVOICES` fields), so no data migration is needed on rollback — bookings/invoices simply stop receiving the new lock-return/flag behavior going forward; any locks already returned or invoices already flagged by the new code before rollback remain in their returned/flagged state (which is the correct historical record, not a bug).

## Agent handoff

- **Task:** LAM-19
- **Branch:** `agent/LAM-19-partial-cancel-lock-draws`
- **Commit:** TBD — recorded after commit, see manifest `.agent-reports/LAM-19.json`
- **Worktree:** `D:/projects/wt-sprint1/LAM-19-partial-cancel-lock-draws`
- **Jira:** LAM-19 (S1-05 Partial cancel must return seat-lock draws)
- **PR:** None yet — created after commit/push in publish mode; see manifest for the recorded number/URL.
- **Manifest:** `.agent-reports/LAM-19.json`
- **Unrelated changes left untouched:** None — the working tree had no pre-existing modifications at task start (`git status --short --branch` was clean), and only `allotment_v2/allotment_v2.html` plus this task's own two report artifacts were changed.
