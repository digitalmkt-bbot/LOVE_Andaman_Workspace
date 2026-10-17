# Decisions wiring (branch wire/decisions-1017, 2026-10-17)

Frontend changes for the developer's answers in operation-backend `todo/rule-decisions.md` (ANSWERS). No backend change.

## 1. Functions done

| Legacy function | File | Status | Reads now |
|---|---|---|---|
| `laIsB2C` | `js/04-data-core.js`, wrapped in `js/ops/66-ops-row-flags.js` | WIRED | booking `is_b2c_legacy` |
| `laIsInternalBk` | same | WIRED | `is_internal` |
| `laIsCompanyBk` | same | WIRED | `is_company` |
| `laIsInternalFree` | same | WIRED | `internal_free` |
| `laBkMoney` | same | WIRED | `owed` |
| `laB2CChannel` | same | WIRED | `b2c_channel` |
| `laInternalRows`, `_ddRows`, `_ddSum`, `_ddAgg`, `_dashLiveFeedHtml` (and the sales reports that call `laBkMoney` / `laIsInternalFree`) | `08-app.js`, `04-data-core.js` | WIRED (no edit) | They call the six functions above, so they read the server flags through the wrappers. Booking rows without flags (unsaved draft, a copy refreshed by a PATCH/POST answer) run the legacy browser rule. |
| booking mapper `fromServer` / `mergeInto` | `js/ops/40-ops-bookings.js` | WIRED | Keeps the six flags from `GET /v1/bookings`, `/{id}`, `/recent` as `bk.srvFlags`; `mergeInto` drops the old flags first, so a POST/PATCH answer (no flags) never leaves stale ones |
| `renderDash` operating-boats list (`opBoatsAll`) | `js/04-data-core.js` (smallest edit, ops mode only) | WIRED (Q11) | `GET /v1/dashboard` `boats[].booked_pax`; charter boats keep their own count; a boat the server does not list, or no answer yet, keeps legacy's spread. Free seats not below 0, fill % capped at 100 |
| `b2dLines` (`B2D_FAM`) | `js/ops/67-ops-b2d-families.js` | WIRED (Q13) | each route's `familyId` (`GET /v1/routes`, from `/v1/route-families`) through a table to the five groups |
| `redrawDailyAndProjects` | `js/ops/26-ops-fleet-daily.js` | FIXED (Q25) | tested `#fl-dr-wrap` (no such id); now `#fl-dr-body`, the element `flRenderDR` draws into |
| `bop2CopyWeekToNext` (alert) | `js/ops/20-ops-deployments.js` | FIXED (Q27) | alert waits for the sync and says `Copied <browser count - days the server left out>`, plus `Not saved N (closed day).` |
| `agImportRender` | `js/ops/16-ops-agents.js` | FIXED (Q28) | a row with a server refusal (`serverError`) has its badge cell emptied |
| `rtAddonTypeDelete` (confirm text) | `js/ops/29-ops-addon-types.js` | FIXED (Q29) | ops mode text: "Delete this add-on type? It cannot be deleted while a rate type uses it." (server `409 in_use`) |
| Daily PFM header cards (`renderDailyPFM` totals) | `js/08-app.js` | SKIPPED (Q24) | Legacy gives the same 0. See section 3 |
| Pier ticker `tickerCells` (`renderDash`) | `js/04-data-core.js` | SKIPPED (Q26) | Legacy never draws it. See section 3 |
| Van-bill PDFs (Q32) | `test/ui/make_print_pdfs.mjs` | DONE | writes `docs/walk/pdf/vb-summary.pdf`, `vb-note-supplier.pdf`, `vb-note-internal.pdf` from the server's figures (seed as `t_walk_pier` section 7) |

## 2. Fields and rows created

No server field or row. New in the browser:

| Name | Where | What |
|---|---|---|
| `bk.srvFlags` = `{isB2C, isInternal, isCompany, internalFree, owed, b2cChannel}` | `js/ops/40-ops-bookings.js` (`fromServer`) | the server's row flags, read-only, never sent back (`toServer` does not copy it) |
| wrapper marker `__opsFlags` | `js/ops/66-ops-row-flags.js` | on the six wrapped functions |
| `B2D_GROUP_OF_FAMILY` (table, also `window.laOpsB2dGroupOfFamily`) | `js/ops/67-ops-b2d-families.js` | server family id -> dashboard group. similan -> Similan, surin -> Surin, phiphi and whaleshark -> Phi Phi, krabi -> Krabi, selava, nyaung, transfer, citytour, activity -> Other. A new family = one line; a family not in the table falls to Other. Assumptions to review: whaleshark -> Phi Phi (legacy `r12`), selava and nyaung -> Other |
| `lastResult` | `js/ops/20-ops-deployments.js` | result of the last deployments sync (`deployed`, `skipped`), used for the Copy week alert |
| New scripts | `allotment_v2.html` | `js/ops/66-ops-row-flags.js`, `js/ops/67-ops-b2d-families.js` (after `60-ops-dashboard.js`). `?v=` is not bumped by hand: the build rewrites it (`tools/build-assets.mjs`) |

## 3. Decisions needed

**Q24 Daily PFM cards: stopped, legacy shows 0 too.** In `origin/lk-inbox` `08-app.js` (`renderDailyPFM`, from line 8885) a prepay row (`!pfmIsProforma`) adds only what was received: `_got = max(0, total - balance)`; `totAmt += _got; paidAmt += _got`. The code is the same in this build. For a row with total 1,000 and invoice balance 1,568 (the invoice is higher than the booking total) `total - balance` is -568, so `_got` is 0. Legacy's own comment says this on purpose ("the invoice is higher than the booking, a little was received, paid goes negative"). So our 0 is legacy's answer for these figures. Choose: keep legacy (0), or change the rule (for example count the amount received on the invoice, which needs the invoice's paid amount, not `total - balance`).

**Q26 Pier ticker: stopped, legacy does not render it either.** In `origin/lk-inbox` `04-data-core.js` `tickerCells` is built (line 3792) and never used; no `ticker` appears in `allotment_v2.html`, `08-app.js` or the CSS. Git history of lk-inbox shows no earlier version that drew it (`git log -S"tickerCells.map"` finds nothing). There is no legacy markup to copy. If the ticker should exist, it is a new design (where, how it looks); tell me and I will build it from the existing server-backed pier sums (`pierBookedToday` / `pierBookedY`, already fed by `GET /v1/dashboard` routes).

Smaller points:
- Q10: a booking edited in the browser and not yet saved keeps the flags of its last read until the save's answer arrives (then the legacy rule runs until the next read). Reports are not affected by a draft being typed, because the dashboards read saved bookings.
- Q28: the header counter "ไม่มีอะไรเปลี่ยน N" still counts a refused row (it has no writes). Not asked; left.
- Q27: the alert is now shown after the sync (a quarter second or more later) instead of before it.
- Tests that fail on the base commit too, not caused by this work: `t_dashchboat` ("no template") and `t_ops_money_reports` (waitForFunction timeout).
