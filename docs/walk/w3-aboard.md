# w3-aboard · check-in figures from the server (2026-10-18)

Branch `wire/w3-aboard`. Server side: operation-backend `todo/w2-checkin-money-model.md` (the table "legacy function -> aboard field"; decisions Q35, Q24, Q53 of `todo/decisions-answers.md`).
Idiom: the ops adapters wrap the legacy global function; legacy answers in non-ops mode and for a trip without `aboard`. The wrappers are all in `allotment_v2/js/ops/71-ops-aboard.js`.

Checks: `node --check` on every changed file; `node test/ui/t_walk_aboard.mjs` (new, about 30 checks: Q35 data cases plus staleness, Q24, Q53) green; `node test/ui/t_ops.mjs` green; `node test/ui/t_walk_pier.mjs` green;
`node test/ui/t_walk_dayops.mjs` one red check, the known moved-away rows one (another agent fixes it). `node test/ui/t_assetver.mjs` is red before and after this work (109 stale `?v=` hashes; not touched here).

How the block reaches the screen (so it is never stale):
- `40-ops-bookings.js` `tripFrom` copies `trip.aboard` and sets `trip.aboardDate` (the service day it was read for). Every booking read goes through `fromServer`/`mergeInto`, so GET, POST and PATCH answers all carry it.
- `records()` (used after save, cancel, partial cancel, reschedule, approve ...) copies `aboard` from the answer's trips onto the browser's trips by `opsTripId`, so the commands that do not re-read the whole booking do not leave the figures of before.
- `36-ops-day-actions.js` `mergeTripOperations` takes `aboard` from the check-in PUT/DELETE answer (`res.trip`), next to the check-in record it was computed from. The check-in screens redraw from it.
- A trip edited in the browser and not saved keeps its last-read `aboard` until the save's answer arrives (as asked). A caller that asks about other heads than the trip's own (a part of a split row) gets the legacy rule on the server's losses.
- A trip whose date changed since the read (`aboardDate` differs) or that has no `aboard` runs the legacy rule.

## 1. Functions done

Status: WIRED / SKIPPED-DESIGN / SKIPPED-NOT-NEEDED / SKIPPED-OTHER. Commits: `b4428724` read mapping, `7a9adc2d` the 11 wrappers, `4b5c524b` PFM cards, `54bf20f0` void refusal, `a42ec8f4` test.

### Q35 · the aboard block

| Legacy function | File | Status | Server field |
|---|---|---|---|
| `ckLostByType` | `08-app.js`, `ops/71` | WIRED | `aboard.lost` (`self_pier` -> `selfPier`) |
| `ckPaxLeft` | `08-app.js`, `ops/71` | WIRED | `aboard.left[k]`, when the caller's `booked` is the trip's own heads for that category; other heads: legacy rule on `aboard.lost` |
| `ckSummary` | `08-app.js`, `ops/71` | WIRED | `aboard.summary` (`van` / `pier` stay the local records, they are the records the screens open) |
| `pckVoidInfo` | `08-app.js`, `ops/71` | WIRED | `aboard.void` (or null); only when `t.pax` totals the trip's booked heads |
| `pckVoidOf` | `08-app.js` | SKIPPED-NOT-NEEDED | calls `pckVoidInfo`, which is wrapped |
| `pckVoidLabel` | `08-app.js` | SKIPPED-NOT-NEEDED | a label from `vd.kind`, which now comes from `aboard.void.kind` |
| `pckSelfPierNote` | `08-app.js`, `ops/71` | WIRED | `aboard.self_pier_note` |
| `pckOnBoard` | `08-app.js`, `ops/71` | WIRED | `aboard.on_board`, when `booked` is the trip's (or not given) |
| `pckExpected` | `08-app.js`, `ops/71` | WIRED | `aboard.expected`, same condition |
| `ckHasArrange` | `08-app.js`, `ops/71` | WIRED | `aboard.has_arrange` (see Decisions 2) |
| `ckSelfOf` | `08-app.js`, `ops/71` | WIRED | `aboard.self_add` (heads and `pax`); `at` / `by` / `note` stay from the local record, the block does not carry them |
| `ckSelfK`, `ckSelfUnalloc` | `08-app.js` | SKIPPED-NOT-NEEDED | both call `ckSelfOf`, which is wrapped (the block's `unalloc` equals `pax` less the heads) |
| `ckReinstateOf` | `08-app.js`, `ops/71` | WIRED | `aboard.reinstated` (the `at` / `by` of the tag stay from the local record) |
| `ckVanNsPax` | `08-app.js`, `ops/71` | WIRED | `aboard.van_ns_pax` |
| `goCounts` / `goSheet` counts | `08-app.js` | SKIPPED-NOT-NEEDED | they sum `ckPaxLeft(b, date, k, heads)` for each row (FOC with adults): the wrapped function answers `aboard.left` |
| `pckTripStats` | `08-app.js` | SKIPPED-NOT-NEEDED | `real` / `lost` come from `ckPaxLeft` (wrapped, checked by the test); the language, meal and longtail parts are not in the block |
| `ckEventTally` | `08-app.js` | SKIPPED-DESIGN | takes a bare check-in record (the van, pier or split-slot record of a row), not a booking and day, so it cannot find the trip; the block's `tally` is for the main record only. It stays a plain sum over the events the server sent |
| `ckPaxBreak` | `08-app.js` | SKIPPED-DESIGN | takes a bare `pax` map (also a part's, or unsaved heads), not a booking and day; `aboard.booked` is the trip's own |
| `ckReasonLabel`, `ckExpectAtPier` | `08-app.js` | SKIPPED-NOT-NEEDED | label constants; the server's labels inside `void`, `self_pier_note` and `summary.reason_text` are the same list |
| `ckAddonList`, `bkLtUpgrade`, `bkLtState` | `08-app.js` | SKIPPED-NOT-NEEDED | the model's table has no `aboard` field for them (add-ons are not check-in figures) |

### Q24 · Daily PFM cards

| Legacy function | File | Status | Server field |
|---|---|---|---|
| `renderDailyPFM` ('Total PFM value', 'Paid', Collected, progress bar and %) | `08-app.js` (3 lines before `collPct`), `ops/31` | WIRED | `totals.total` and `totals.received` of `GET /v1/pfm` for the period on screen (`pfmServerTotals`); rows' `received` is mapped too (`mapRow`). The sums per date card, the status list, 'Unpaid' and the row figures are unchanged |

### Q53 · Accounting void

| Legacy function | File | Status | Server field |
|---|---|---|---|
| `acctVoidConfirm` (and `acctVoidInvoice`, the PFM edit void) | `ops/30` `voidInvoiceServer` | WIRED | `409 invoice_has_payments`: the server's message ("Invoice INV-... still has payments. Delete them and save first.") is shown with `alert`, as legacy's PFM void refuses; no red toast, nothing changes |

## 2. Fields and rows created

No server fields, rows or tables. Browser-side properties, all derived from an answer and never sent (`toServer` builds a trip field by field; the test checks the PATCH body):
- `trip.aboard`: the server's block as received.
- `trip.aboardDate`: the service day `aboard` was read for (used to ignore it once a trip has moved).
- `window.pfmServerTotals(date, mode)`: a function returning `{ total, received }` for the loaded period or null.
- `laOps.aboard.blockOf(booking, date)`: the block for a trip, or null (legacy rule runs).

## 3. Decisions needed

1. **Legacy cannot split the lost heads by category on server data.** Legacy's `ckLostByType` reads `event.paxBreak`; the check-in adapter (`36-ops-day-actions.js`) maps an event's `ad/chd/inf/foc` and no `paxBreak`, so on the same records the legacy rule reports the lost head as `unalloc` (it comes off adults) where the server says "1 adult". The totals agree (the test checks lost total, left and summary), so with the block wired the category is right. Nothing to decide unless the legacy functions are used with `aboard` missing: then a child no-show comes off adults.
2. **`ckHasArrange` and a van / boat assigned in the browser.** The block is last-read: a van group or boat assigned after the read shows in `has_arrange` only after the next booking read or check-in answer (the van and boat adapters do not carry `aboard`). It only matters for a cancelled booking's struck row (`ckStrandOn`), which Q33's `GET /operations/van-strands` now serves. Option: also treat the local arrangement as true (`aboard.has_arrange || legacy`). Not done: the server's answer is the one that counts.
3. **A pier tick or step while the check-in PUT is in flight** shows the old figures until the answer arrives (in ops mode the local record changes only when the server answers, as before); no change from today.
4. **`ckEventTally` and `ckPaxBreak` stay legacy** (SKIPPED-DESIGN above). To move them the call sites (`ckEventTally(ck)` x4, `ckPaxBreak(t.pax)` x ~30) would have to pass the booking and day. Say if the developer wants that.
5. **Accounting void refusal is an `alert`**, the same channel as legacy's PFM edit void; if a toast is preferred it is one line in `ops/30` `voidInvoiceServer`.
