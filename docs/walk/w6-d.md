# w6-d · the server fields the w5-d and w5-e walks were missing (2026-10-18)

Branch `wire/w6-d` (from `main`). Source lists: `docs/walk/w5-d.md` and `docs/walk/w5-e.md`, section MISSING-SERVER-FIELD (15 + 15 numbered items).
Server: operation-backend `README.md` ("Fields the new frontend asked for"), `todo/w5-d-model.md`, `todo/w5-e-model.md`.
Idiom (same as the earlier waves): a legacy function is wrapped from `js/ops/*.js`; the wrapper answers from the server's held answer and returns `undefined` (legacy's arithmetic answers) before the first answer, while a write has made the answer stale, offline and outside ops mode. Only the user's choices are sent (method, amount, fee %, the typed hotel name, the boat, the scope), never a computed field. The server's refusals and messages are shown as they are. No file under `js/` that is legacy's own was copied: only adapters changed.

New files (script tags in `allotment_v2.html`, before `90-ops-boot.js`):
`ops/94-ops-pier-w6.js` (fee preview, group stats, return leg, service lines, licensed guide, slip pack of a booking), `94-ops-fleet-w6.js` (Transfer Fleet), `94-ops-money-w6.js` (candidate agents, payment chip), `94-ops-agents-w6.js` (summary, promo coverage, bulk fill, list chips), `94-ops-booking-w6.js` (upgrade targets, charter figures, private-van zone, lock badge, No-Transfer area, hotels, fee add-ons, add-on links).
Small edits in existing adapters (each marked `w6-d`): `10` (route `zone`, agent `gaps`, list `gap_counts`), `16` (`rate_not_started` alert, `gaps`), `35-van-jobs` / `35-vehicles` (`cost_per_day`), `40` (`pfm_status`, `fee`, `addon_of`, `addon_lines`), `44-costing` (what-ifs, `ctEffLine`, Trip P&L aggregates, `pxAgents`), `57` (the packs), `58` (trend by market), `61` (never send `licensed`), `73-cancel-report` (land page), and `booking/bookingV2RenderTab2.js` (boat chips read the by-trip answer's boats).
Test: `test/ui/t_walk_w6_d.mjs` (sections 0 to 8, 100+ checks). Every section has a "tampered answer" case: the test's proxy changes what the server says to a figure the browser's arithmetic could never give, and the screen must show the server's figure; the legacy answer is read through the wrapper's `__orig` where it matters, to show the two differ.

## Verdicts

Rows of the tables below: 33 WIRED, 1 SKIPPED-NOT-NEEDED, 5 STILL-MISSING (all five in w5-e: items 10, 12 twice, 13, 14), 0 SKIPPED-DESIGN of the 30 numbered items (the SKIPPED-DESIGN rows of w5-e stay as w5 left them).

### w5-d (15 items)

| # | Function | Verdict | Endpoint / field | Where |
|---|---|---|---|---|
| 1 | `pckLineFee` | WIRED | `POST /v1/bookings/{id}/pier-payments/preview`: one question per distinct set of typed lines (method, amount, `fee_pct` or `fee`); the line shows the server's fee and the dialog is drawn again when it differs from legacy's | `94-pier` |
| 2 | `pckTripStats` | WIRED | `GET /v1/pier-checkin` `groups`: the boat band, van group or zone whose rows are exactly a server group (a filtered part of one keeps legacy's count) | `94-pier` |
| 2 | `pckAgg`, `pckSheetAgg` | SKIPPED-NOT-NEEDED | already the sum of the rows' server figures (w5-d); the test checks that every group of the answer equals the sum of its rows (n, arrived, cleared, boarded, heads), so reading `groups` would add nothing | - |
| 3 | `ckRetVan`, `pckJobDrop`, `tsSendBack` | WIRED | `rows[].return {kind, van_id, drop_off}`, read from whichever answer is held for the booking and day: the travel summary row, the pier sheet row, the van check-in row. No answer held: legacy's `bookingV2RetInfo` | `94-pier` |
| 4 | `pckJobService` | WIRED | `rows[].service.lines` (longtail, add-on, sold extra, upgrade), the colours and the legacy marks (`⬆`, `*`, `+ … ×n`) kept | `94-pier` |
| 5 | `goIsGuide` | WIRED | `GET /v1/config/guides` `value[].licensed`, outside a sheet. The register's save strips `licensed` (computed; a stale one would be a 400 after a role edit) | `94-pier`, `61` |
| 6 | `tsRefPackList`, `tsSlipPackList` | WIRED | `reference_pack` / `slip_pack` of the travel summary for the selection on screen: the bar's "เอกสาร n" and "สลิป n" buttons and what they print come from them (the pier-money read per booking is gone). The print window's own packs stay the stub that returns `[]` (the bar prints the packs, as before) | `57` |
| 6 | `tsInvSlips` | WIRED | `slip_pack[]` of the day: paid through the bill, bill number, the slips with legacy's captions | `94-pier` |
| 7 | `drTrendBooked` | WIRED | `GET /v1/bookings/daily-counts?markets=1`: the booked-heads chart is stacked by market again (one series only when an older server sends no `markets`) | `58` |
| 8 | `bookingV2UpgTargets` (the walk's `bkV2UpgTargets`) | WIRED | `GET /v1/bookings/{id}/upgrade-targets?trip_id=&date=`: names, pier and free seats; the dialog is drawn again when the answer lands. `POST /upgrade` still decides | `94-booking` |
| 9 | `_vehDayJobN` | WIRED | `van-days` `days[].jobs` | `94-fleet` |
| 9 | `_vehRouteZone` | WIRED | `routes[].zone` | `94-fleet`, `10` |
| 9 | `_vehRouteDemand`, `_vehGroupsForDay` | WIRED | `van-board` `routes[].demand`, `groups_with_van`, `groups_without_van` (read once per day, again after a write) | `94-fleet` |
| 9 | `vanCostSet` | WIRED | `PATCH /operations/vans/{id} {cost_per_day}` (client fact: the typed number, or null); the van carries the server's value | `94-fleet`, `35` |
| 10 | `ctProfitAt`, `ctCalc`, `ctChdAt`, `ctStepCount`, `ctBreakEven` | WIRED | `POST /v1/costing/calc-batch`: a plan changed on the screen (a tier price tried) or a head count the stored plan's curve does not hold. The questions of one draw go in one request; the first plan is the base, the others travel as the plan fields that differ. A stored plan's own head counts stay the sheet's curve (no request) | `44` |
| 11 | `ctEffLine` | WIRED | `sheet.line_parts[].parts[].effective` and `line_off` of the stored plan's answer | `44` |
| 12 | `pxDayAgg` | WIRED | `trip-pl` `bands`, `best`, `agents` (the month page is read for the pier on screen, so a pier filter is the server's too) | `44` |
| 13 | `pxAgents` | WIRED | `trips[].agents` (heads, children, amount, rate-card total, zones, rates) | `44` |
| 14 | `acctNewInvoiceRender` | WIRED | `GET /v1/invoices/candidate-agents?kind=booking` fills the Agent drop-down (the booking list under it was already the server's). `kind=prepay` has no dialog in this adapter set | `94-money` |
| 15 | `bookingV2PayChip` | WIRED | `pfm_status` / `past_cutoff` (single booking read, else the `GET /v1/pfm` row held) for a proforma booking; `internal_free` for the staff "FOC / Inspection · FREE" label. `prepaid_part` and a booking with no status keep legacy's chip | `94-money`, `40` |

### w5-e (15 items)

| # | Function | Verdict | Endpoint / field | Where |
|---|---|---|---|---|
| 1 | `agSumRows`, `agSumBlock` | WIRED | `GET /v1/agents/{id}/booking-summary?by=travel|booked`: legacy's table (same markup) adds up the server's month x programme rows | `94-agents` |
| 2 | `agTabPrices` | WIRED | `GET /v1/agents/{id}/promo-coverage` replaces the "โปรโมชั่นที่ทับเรทมาตรฐาน" block (same markup). The two route-mismatch boxes under the rate table stay legacy's (a comparison of two client lists) | `94-agents` |
| 3 | `agProgBulkPlan`, `agProgBulkApply` | WIRED | `GET /v1/agents/programs-fill-plan`, `POST /v1/agents/programs-fill {scope}` (one command, the server re-reads the plan) | `94-agents` |
| 4 | `bookingV2SetTripCharterBoat` | WIRED | `POST /v1/quote` `warnings[]` `charter_displaces_seats`: the confirmation keeps legacy's trigger and words; its sold / left / oversold figures are the server's, and a quote without the warning says "still ok" | `94-booking` |
| 5 | `bookingV2ToggleAddOn` | WIRED | `POST /v1/quote` `trips[].zone`: the toggle no longer writes `NoTransfer` into the trip; the zone priced (also from an answer already held) is laid in the form | `94-booking` |
| 6 | `agAlerts` "Rate not started" | WIRED | `alerts[]` code `rate_not_started` (message, `in n days`) | `16` |
| 7 | `agGapCounts` | WIRED | `gap_counts` of the list read; the rows' `gaps` once an agent was written. `agTblRows` filters the four chips by `gaps` | `94-agents`, `10`, `16` |
| 8 | `bookingV2DayLockedExact` (the lock badge) | WIRED | `GET /v1/bookings/calendar` `days[].locked_exact` | `94-booking` |
| 9 | `bookingV2SetPickupZone` | WIRED | `GET /v1/pickup-areas/no-transfer?route_id=`: the area is the route's pier's. The `no_transfer` / `pier` flags of the area rows are not needed | `94-booking` |
| 10 | `bookingV2NatWarn` | STILL-MISSING | `nat_mix` is on a SAVED booking's read; the only caller is the open form, whose nationalities can differ from the saved ones, so the saved answer would be stale while typing. Needs the draft in a server read (`POST /v1/quote` `warnings[]` code `nat_mix`, per trip) | - |
| 11 | `bookingV2IsB2CFeeAddOn` | WIRED | `add_ons[].fee` (kept by `40`, never sent: the save builder picks its fields); a draft line without it keeps the name test | `94-booking`, `40` |
| 12 | `bkB2CAddonTo`, `bkB2CAddonsOf` | WIRED | `addon_of`, `addon_lines[]` of a booking read singly (a line this browser does not hold sends the whole list back to legacy) | `94-booking`, `40` |
| 12 | `bkB2CAddonOnly`, `_bkB2CAddonIndex` | STILL-MISSING | the link is on a single read only; list rows carry neither it nor an "add-on only" flag, and these two run over every loaded booking. Needs `addon_only` / `addon_of` on list rows (or on `GET /v1/bookings?service_date=`) | - |
| 12 | `_bkOrderLines`, `bkOtherTrips` | STILL-MISSING | they group the `b2c_<ref>_N` lines of one Love Kingdom order; `addon_of` is a different link (add-on to an agent booking) and nothing serves the order lines. Needs `order_lines[]` (id, trips) on the booking read | - |
| 13 | `bookingV2HotelNameList` (zone / area tiers), `bookingV2HotelNear`, `bookingV2CanonicalHotel` | WIRED | `GET /v1/hotel-names?zone=` / `area_id=` / `near=`: typed names go to the server as typed, in the dropdown and at the save | `94-booking` |
| 13 | `bookingV2HotelSim` | STILL-MISSING | the union-find of the Pickup setup "similar names" scores every PAIR of names; the endpoint scores names against one `near` name only. Needs a group read (`GET /v1/hotel-names/groups`) | - |
| 14 | `bookingV2RenderTab2` boats card and route chips | WIRED | `by-trip` `routes[].boats` (pax, capacity, over, `over_by`) | `booking/bookingV2RenderTab2.js` |
| 14 | `_btOtherSection`, `bookingV2AddOnFlags`, `bkB2CAddonLt`, `bookingV2LongtailExtraPax`, `bookingV2LongtailCharterExtraBoats` | STILL-MISSING | the delivered `boats[]` has pax / capacity / over only; these are per-booking longtail flags and extra boats. Needs `lt_join_pax`, `lt_charter_boats` on the booking row of the by-trip answer (the route totals are already `routes[].prep`) | - |
| 15 | `bookingV2RenderCancelReport` (City Tour page) | WIRED | `GET /v1/reports/cancellations?land=true|false`; the marine page now asks `land=false` | `73-cancel-report` |

Kept skipped (backend marked not needed): the mixed-van chip (`bookingV2VanGroupConflicts`), `pckMealStep`, `goRows`, `tsCotCell`, `vehDayCellClick`, `ctBlankPlan`, `ctRentBlank`, `ctRentSpan`, `ctSeasonOf` and the SKIPPED-DESIGN rows of w5-e (`rtmSnap`, `ctOpenRenewal`, `ctPromoDiscPrev`, `cttResetKey`, `bkV2CalcQuote` ...): unchanged.

## What the screens do now

- **Pier payment dialog**: the card fee under each line is the server's (asked after a short pause, nothing is written). Until it lands legacy's figure shows; if it differs the dialog is drawn once more.
- **Boat band / van group headings on the Pier sheet**: heads travelling, languages, special meals and longtail counts of a whole boat, van or zone are the server's group. A filtered band (a search, one booking) keeps legacy's count.
- **Return van / drop-off** on the pier card, the guide's job sheet and the Travel Summary: the server's kind (self, a named van, the same van, still to arrange).
- **Service column**: the server's lines (a longtail charter with its upgrade marks, an add-on, a sold extra, an upgrade).
- **Travel Summary bar**: "เอกสาร n" and "สลิป n" count the server's packs for the chips on screen; no booking is read for its slips any more.
- **Daily Report trend by booking date**: stacked by market (the legend names the markets).
- **Upgrade dialog**: the list is the server's; a route with too few seats stays greyed.
- **Transfer Fleet**: "N jobs" in a cell, the route zone, "ลค n (รับ m)" and "n กรุ๊ป (m ยังไม่มีรถ)" on the summary cards, a van's cost per day (saved as typed).
- **Costing**: a tier price or any plan tried on screen is priced by the server (calc-batch); the override editor's placeholders are the plan's effective values.
- **Trip P&L**: the bands, the best boat and the per-agent sums of the day, and the agent split of a boat-day, are the server's.
- **New invoice dialog**: the Agent drop-down lists the agents with something to invoice.
- **By-trip payment chip**: On hold / Extended / Paid / "เลย cutoff" / Awaiting / Pro Forma from the server, and the staff FREE label from `internal_free`.
- **Agents**: the Recent Bookings table, the promotions block of the Pricing Matrix, the bulk programme fill, the list chips (vat, docs, programmes, rate) and the "Rate not started" alert.
- **Booking form**: the charter confirmation's figures, the zone of a private van, the lock badge, the No-Transfer area, the hotel dropdown tiers, the "similar hotel" question and the snap to the existing spelling.
- **Reports**: the City Tour cancellation page, the By-trip boat chips (`77/72 +5`).

## Decisions (design mindset; any can be reversed)

1. **A held answer first, legacy until it lands** (as in w5): no "loading" state was added to a screen that had none. Cost: one extra read per screen in some cases (fee preview per typed set, candidate agents per dialog open, van board per day, the three agent reads per agent).
2. **What-ifs only for plans the curve does not hold.** A stored plan's head counts are already the sheet's `curve`; asking calc-batch for them would be a second read of the same figure. Plans changed on the screen are questions for calc-batch, batched per draw (250 ms), at most 150 scenarios per request.
3. **Totals of a subset stay the sum of the rows** (`pckAgg`, `pckSheetAgg`); only a whole group takes `pckTripStats` from `groups`. The test shows the two agree.
4. **Month page reads each day for the pier on screen** (`loadDay(d, pier)`), so the bands, best boat and agent sums are the server's for a pier filter too. Cost: switching the pier re-reads the month's days.
5. **A private van's zone is laid in from the quote**, including an answer already held (toggling an add-on back to an earlier state asks nothing).
6. **The charter confirmation keeps legacy's trigger** (seats sold on the route and day, counted by the browser) and its words; only its figures are the server's. A server answer with no displacement forces "still ok" (oversold 0, pool after at least the seats sold) so the dialog never contradicts itself.
7. **`licensed` is never sent**: the config store strips it from the guide list before the save (a stale flag after a role edit would be a 400).
8. **Booking summary rows**: the server's months become the trip rows legacy's `agSumBlock` adds up, so the markup and the cancelled column are unchanged. The "booked" view is a second read (`by=booked`).

## Assumptions and things to review

- `pckJobDrop`, `ckRetVan`, `tsSendBack` need one of the three answers (pier sheet, van check-in, travel summary) to be held for the day. A job sheet printed for a day nobody opened keeps legacy's reading.
- `tsSendBack` with a named van or "same van" but no drop-off text goes back to legacy: the server's `drop_off` is null both for "same drop-off as the pickup" and for "a separate drop-off with no name", which legacy tells apart.
- The Recent Bookings tab still loads the agent's bookings (up to 20,000) for the paged list under the table; the table itself no longer needs them. A paged list read is the next step (`GET /v1/bookings?agent_id=&limit=15` with a stable order).
- `bookingV2HotelNear` cannot ask before the user types: the dropdown's first redraw returns legacy's answer and asks; the save uses the answer when it has landed (typing a name takes longer than the answer).
- The staff FREE label uses `srvFlags.internalFree` (internal and owed <= 0); a company booking with no staff purpose never takes that branch, as before.
- `kind=prepay` of `candidate-agents` is not used (no prepay dialog in these adapters).
- `t_walk_w6_d.mjs` section 0 reloads the page with the boot answers changed; the others run on the page as left by the section before (each can also run alone: `WALK_ONLY=4`).

## Tests run (one file at a time)

@@TESTS@@
