# w6-c · wave 6, group c: the server fields wave 5 group C built, wired into the screens (2026-10-18)

Branch `wire/w6-c` (from `main`). Source list: `docs/walk/w5-c.md` section 4 (MISSING-SERVER-FIELD 1 to 14). Backend: operation-backend `main`,
`todo/w5-c-model.md` and README ("Market Data", "Who can be invoiced", "Fleet maintenance: availability", "A boat's seats for one day",
"Van stops", "The Van Check-in numbers", "The Pier Check-in sheet", "Pier office: petty cash").
Test: `node test/ui/t_walk_w6_c.mjs` (real Chrome, real in-process backend; 5 sections, `ONLY=1,3` runs some). New ops files (prefix 93, registered before
`90-ops-boot.js`): `ops/93-ops-w6c-market.js`, `93-ops-w6c-money.js`, `93-ops-w6c-boats.js`, `93-ops-w6c-vans.js`, `93-ops-w6c-pier.js`.

Rule kept everywhere: the wrapper reads the server; until the answer is here (and offline, and when the call fails) legacy's own rule answers; nothing the
server computes is ever sent; a refusal is shown as the server wrote it.

## 1. Items

Verdicts: WIRED · SKIPPED-NOT-NEEDED · SKIPPED-DESIGN · STILL-MISSING.

| # | Ask (w5-c section 4) | Verdict | Where in the frontend | Notes |
|---|---|---|---|---|
| 1 | `in_by_code`, `lang_buckets` | WIRED | `mdLangBuckets` (Ops & Guides tab, the latest day: `GET /v1/market-stats?from=D&to=D` `lang_buckets`), `mdArrivalsByCode` (`arrivals_by_code`) | `93-ops-w6c-market.js`. The tab hands legacy a by-code table it built with the browser's `MD_NAT_TH2CODE`; the wrapper ignores it. The three other uses of `MD_NAT_TH2CODE` (Net-flow tab: the flag next to a nationality name, `08-app.js` 3537/3546/3559) only look a code up for a flag: SKIPPED-NOT-NEEDED |
| 2 | `arrivals_by_weekday` | WIRED | `mdArrivalsByWeekday` | whole file (no `from`/`to`), as legacy |
| 3 | `monthly_merged` | WIRED | `_mdOvMonthly(days)` | the Overview hero chart: `{m, pres}` rebuilt from `[{ym, pax, source}]` |
| 4 | `report_market` | WIRED | `pmMarket(b)` | `40-ops-bookings.js` keeps it as `bk.srvFlags.reportMarket` (a list row or a single read carries it); a booking without it (just created) falls back to legacy's rule |
| 5 | prepay candidates without `agent_id` | WIRED | `pfmPrepayCands(q)`, `pfmPrepayStart(id)` | `93-ops-w6c-money.js`. The search box text goes to the server as `q` (one read per text, redrawn when it lands). The list is padded to the server's `count`, so the "+N ใบ" line is the server's number. A booking on the list that the browser does not hold is read (`GET /v1/bookings/{id}`) before the Record-payment dialog opens |
| 6 | `dry_run` on payment-corrections | WIRED | `_pfmEditTotals()` | the edit dialog's "ยอดใบ · รับแล้ว · ค้าง / รับเกิน" line is the dry run of the user's edited rows (`toCorrectionsBody` + `dry_run: true`; 120 ms after the last keystroke). Overpaid shows as "รับเกิน" from `overpaid`. The real submit is unchanged (the server's `409 overpayment` message) |
| 7 | `booked { pax, bookings }` per boat and day | WIRED | `baAssignedPax`, `baAssignedBookings` | `93-ops-w6c-boats.js`: from the day's fleet panel (`laOps.boatOperation`, the read Boat Operation already makes; a day not read yet is asked for and the active screen is drawn again) |
| 8 | stop `seats`, group `stop_seats_return` | WIRED | `vsSeats(stop)`, `vsSeatsOfVan(.., isRet=true)` | `35-ops-van-jobs.js` keeps `seats` on the stop (`srvSeats`), `34-ops-vans.js` keeps `stop_seats_return` on the group; `93-ops-w6c-vans.js` answers. A stop not saved yet keeps legacy's rule |
| 9 | day object `{capacity, normal, ceiling}` for a day with no override | WIRED | `boatCapInfo` (so `boatCapFor`) | `93-ops-w6c-boats.js`: `GET /v1/boats/{id}/capacity-overrides?from&to&all=true`, one read per boat and 62-day window the first time a day of it is asked for; a write makes it old. An overridden day is still answered from the override (`82-ops-w5c-boats.js`) |
| 10 | pier zones `booked`, `arr_rows / clr_rows / brd_rows`; programmes for the Van Check-in page | WIRED | `ckRoutePills` (pier: `82-ops-w5c-pier.js` `applyTo`; van: `window.laOpsVanProg`, hook in `ckRoutePills` kind `van`, `93-ops-w6c-vans.js`) | pier: the struck-through booked figures of the zone boxes and the "n/m booking" hover texts are the server's. Van page: pax, booked and the PK / KL / OWN boxes (done, total, booked) from `GET /v1/van-checkin` `programmes[]` (its own read, one extra GET after a write, as the pier page does) |
| 11 | `diff_paid` | WIRED (day, month, KPI, print) | `pcPkDiffPaid(pier, ds, legacy)` in `pc2PKDay` (day line), `pc2PK` ("ต่าง" card), `pcSheetPK` print (`pcDiffCellPaid`) | `93-ops-w6c-pier.js`. A route group's own line inside a day is **STILL-MISSING**: the server sends the day's and the sheet's figure, not a group's, so that line keeps legacy's subtraction |
| 12 | `car_cost` on an overview line | STILL-MISSING | | optional ask, not built by the backend (`todo/w5-c-model.md` "Not built"); the screen keeps deriving it from the line's own figures |
| 13 | server creates the nightly deployments of an overnight charter | SKIPPED-DESIGN | | optional, not built; Q39 keeps the browser creating them (`bkOvnHealSpans` stays) |
| 14 | `drop.self_return` on the trip row | STILL-MISSING | | not built by the backend; `selfRet` stays the booking's own field |

Counts: WIRED 11 (items 1 to 11), SKIPPED-NOT-NEEDED 0 whole items (one sub-item under 1), SKIPPED-DESIGN 1 (13), STILL-MISSING 2 (12, 14) and one sub-item under 11.

## 2. Fields sent

None. Every figure is read; the only new request body is the dry run, which carries `payments` (id + the user's amount / method / date, from the rows the
user edited) and `dry_run: true`, nothing computed.

## 3. Decisions and assumptions (reverse any)

1. **Market Data reads the whole file once more.** `GET /v1/market-stats` is read a second time by `laOps.srv.read('w6c-market')` (the page's own load,
   `64-ops-market-data.js`, only fills `SB_MARKET_STATS`); a write (an import, a delete) makes it old and it is read again. The guide languages of the
   Ops & Guides tab need the latest day alone, so they are a separate read `?from=D&to=D` per day.
2. **The weekday, by-code and month figures are the whole file's**, as legacy's were (no `from` / `to` sent).
3. **Plain-day seats are asked for in 62-day windows per boat**, on first need, not for every boat at boot. The embed token (CS) does not ask (it may not read capacity-overrides).
4. **A fleet panel is read for any day `baAssignedPax` is asked about.** Runs of days are joined into one request per 62 days (`laOps.boatOperation.ensure`). Until it lands, legacy's walk over the browser's bookings answers.
5. **The prepay picker keeps legacy's 40-row cut on the screen**; the server's page (100) is only the list it draws from, and `count` is the number the "+N" line uses.
6. **The dialog's overpayment confirm is not added.** Legacy asked "Save anyway?" when the corrected payments exceed the invoice; the ops screen already sends `overpay_anyway: false` and shows the server's `409 overpayment` message (wave 5). The dry run only makes the totals line right.
7. **Van pills**: `OWN` is the server's definition (self-arrive, no hotel / pickup point), not the browser's `own` test.

## 4. To review

- `ckRoutePills` now makes a Van Check-in read per date besides `74-ops-van-checkin.js`'s own (same endpoint, no narrowing). If the extra request matters, share the two later.
- A stale answer stays on screen until the new one lands (the `laOps.srv` rule); for about one request after a write the Market Data tab can show the old weekday figure.

## 5. Tests

`node test/ui/t_walk_w6_c.mjs`: 1 Market Data and `pmMarket`, 2 Daily PFM picker and the dry run, 3 boats (`baAssignedPax`, `boatCapInfo`), 4 vans (stop
seats, return seats, Van Check-in pills, pier pills), 5 park-sheet difference. Each case changes the browser's own copy (a market row, an agent's pay type,
an invoice total, a boat record, a stop's pax or leg, a booking's heads, a cell's amount) so legacy's answer would differ, and expects the server's figure on
the screen. Results of the whole suite: see the final reply of the run.
