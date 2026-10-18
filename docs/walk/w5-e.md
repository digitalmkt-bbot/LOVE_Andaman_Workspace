# w5-e · rate expiry, agent rules, booking-form price lines, approval impact, money state (2026-10-18)

Branch `wire/w5-e`. Source lists: operation-backend `docs/verify/wire2/wire-09.md` and `wire-10.md` (rows of "NOT-WIRED and WIRED-PARTLY").
Server: operation-backend `README.md` ("Agents", "Rate types" (Scope, `priced_routes`), "Rate expiry", "Quote", "Bookings" (approval-impact, history), "Money" (`invoice`, `payment_state`), "Pickup time", "PFM").
Idiom: legacy functions are wrapped from `js/ops/*.js`; legacy answers until the server's first answer lands and when offline; the screen is drawn again when the answer differs. No legacy file under `js/` is edited.
New files: `ops/84-ops-rate-expiry.js`, `ops/84-ops-agent-rules.js`, `ops/84-ops-booking-calc.js` (script tags after `73-ops-analysis-why.js`).
Small edits in existing adapters (each marked `w5-e`/`w5e`): `ops/16` (export `laOpsAgentFetch`, template id, Thai duplicate confirm), `ops/17` (`pricedRoutes`), `ops/31` (`pfmServerRow`), `ops/40` (do not send computed fields, `settle`, keep the money state), `ops/51` (`laOpsQuote.answered()`, `onAnswer`), `ops/71` (private-van zone left to the server).
Test: `test/ui/t_walk_w5_e.mjs` (run `ONLY=4,5` for the booking half: section 5 needs the booking made in 4).

## Function table

Verdicts: WIRED, SKIPPED-NOT-NEEDED, SKIPPED-DESIGN, MISSING-SERVER-FIELD.

### wire-09 (agents, rates, contracts)

| Function | Verdict | Endpoint / field | Commit |
|---|---|---|---|
| `rtExpScan` | WIRED | `GET /v1/rate-types/expiring?within=` (rows: rate, days, agents, blocked, next) | rate-expiry |
| `rtExpRowFor` | WIRED | same rows | rate-expiry |
| `rtExpForAgent` | WIRED | `GET /v1/agents/{id}/rate-expiry` (the list scan answers "no" without a read) | rate-expiry |
| `rtExpNextOf` | SKIPPED-NOT-NEEDED | a lookup of the main contract's rate in the contracts the server sent; the "next rate" rule now arrives in the rows above | - |
| `rtExpBulkPlan` | WIRED | `GET /v1/rate-types/{id}/expiry-plan`, read fresh each time the dialog opens | rate-expiry |
| `rtExpBulkApply` | WIRED | `POST /v1/rate-types/{id}/expiry-plan/apply` `{}` (one command, no per-agent PUT) | rate-expiry |
| `rtmSuggest` | WIRED | `GET /v1/agents/{id}/rate-seasons/suggestion` | rate-expiry |
| `rtmSnap` | SKIPPED-DESIGN | an editor aid on unsaved draft rows; the server judges the whole table on `PUT …/rate-seasons`. Decision 1 below | - |
| `agHdIssues` | WIRED | `exp` from the expiring scan; `norate/orph/drift` from `alerts[]` (earlier wave) | rate-expiry |
| `agHdScan` | WIRED | built on `agHdIssues`; credit and limit sums are sums of client facts | rate-expiry |
| `agAlerts` | WIRED | rate expiry from `rtExpForAgent`; credit and contract expiry from `credit` and `contract_*` (earlier waves). "Rate not started" stays local: MISSING-SERVER-FIELD 6 | rate-expiry |
| `agGapCounts` | WIRED | "no programmes" and "no rate" from `incomplete` on the list rows. VAT and documents: MISSING-SERVER-FIELD 7 | agent-rules |
| `agFindDup` | WIRED | `POST /v1/agents` `409 possible_duplicate`; the screen asks legacy's own Thai question with the other agent's name and code (taken from the 409 message). The live hint under the name stays local | agent-rules |
| `rtScopeList` | WIRED | `GET /v1/rate-types` scope + `keep_id` (a bound rate missing from the list is read with `GET /v1/rate-types/{id}`) | agent-rules |
| `rtForSales` | WIRED | uses `rtScopeList`; the own / shared / other grouping is display | agent-rules |
| `agEditBuildRateTypePicker` | WIRED | uses `rtScopeList` and `rtForSales` (the server-scoped list as it is) | agent-rules |
| `agRtRoutes` | WIRED | rate type `priced_routes` | agent-rules |
| `agEditPPAddMissing` | WIRED | `priced_routes`; booking window = the agent's contract window (as the server does on `PUT …/rate-type`) | agent-rules |
| `agProgPlan`, `agProgFill`, `agProgSyncOnRate` | WIRED | all three read `agRtRoutes`; the save is `PUT …/rate-type` (`409 unpriced_programs` / `drop_unpriced`) and `PUT …/programs` | agent-rules |
| `agProgBulkPlan`, `agProgBulkApply` | MISSING-SERVER-FIELD | no bulk read or command (now planned from `agRtRoutes`, applied by one `PUT …/programs` per agent): MISSING-SERVER-FIELD 3 | - |
| `agClearExecute` | WIRED | one `DELETE /v1/agents/{id}` per ticked agent; `409 in_use` message shown, nothing local is removed that the server kept | agent-rules |
| `_ctSyncMainRate` | WIRED | the server moves the main contracts on `PUT …/rate-type`, `renew`, `resync-contract`; the browser no longer edits them and reads the contracts again after an agent write | agent-rules |
| `ctTmplForAgent` | WIRED | `GET /v1/agents/{id}` `contract_template_effective_id` (agent rows without the detail still use legacy's rule) | agent-rules |
| `_ctDocAgentRT` | SKIPPED-NOT-NEEDED | picks the rate the person chose to print (override or the agent's); the server stores the `rate_type_ref` it is told | - |
| `ctOpenRenewal` | SKIPPED-DESIGN | form defaults (+1 year, next `v<year>-1`); the server judges them (`400` unless end is after start). Decision 2 | - |
| `ctPromoDiscPrev` | SKIPPED-DESIGN | a preview under the promo form; `POST /v1/contracts` checks the real figures. Decision 3 | - |
| `cttResetKey` | SKIPPED-DESIGN | the built-in wording is a constant of the document design, a client fact (`PATCH text`) | - |
| `agSumRows`, `agSumBlock` | MISSING-SERVER-FIELD | no agent month x route aggregate: MISSING-SERVER-FIELD 1 | - |
| `agTabPrices` | MISSING-SERVER-FIELD | no per-route promo coverage table: MISSING-SERVER-FIELD 2 | - |
| `bkV2UpgradeSave` | WIRED | `PATCH upgrades` no longer sends `settle: "pending"` (the server starts a sale at `pending`); the history line is the server's (see `bkV2AddHistory`) | booking-calc |
| `bkV2AddHistory` | WIRED | the line shows at once; after the booking write `GET /v1/bookings/{id}/history` replaces the whole list | booking-calc |
| `bkV2Aggregate` | SKIPPED-DESIGN | legacy's sums run only until the month answer lands and offline (`ops/73-ops-bk-calendar.js`). The lock badge (`DayLockedExact`): MISSING-SERVER-FIELD 8 | - |
| `bkV2RenderAddOnsSection` | SKIPPED-NOT-NEEDED | the offered list is the keys of the rate's own add-on table (`GET /v1/rate-types/{id}`); the prices now come from the quote (`bkV2AddOnInfo`) | - |

### wire-10 (booking form, by-trip, reports)

| Function | Verdict | Endpoint / field | Commit |
|---|---|---|---|
| `bkV2TripSubtotal`, `_bkV2TripSubtotalRun` | WIRED | `POST /v1/quote` `trips[i].subtotal` (cached per draft by ops/51) | booking-calc |
| `bkV2AddOnInfo` | WIRED | `POST /v1/quote` `add_ons[i].amount / qty` | booking-calc |
| `bkV2CalcQuote`, `_bkV2CalcQuoteRun` | SKIPPED-DESIGN | already the server's number (ops/51); legacy's arithmetic stays only until the first answer, offline, B2C, refusals. No "pricing…" state added (screen would differ from legacy). Decision 4 | - |
| `bkV2GetRT`, `GetRTForTrip`, `AddOnRT`, `laManualRT`, `laSeasonAt`, `laMainRtIdFor`, `laPromo*` | SKIPPED-DESIGN | the browser's fallback chain; not read for a figure once the quote has answered. Still used by the agent screens and offline. Decision 4 | - |
| `bkV2RtKeepInit`, `RtKeptFor`, `RtKeepPair` | WIRED | the drift flag comes from the quote asked with `rate: "kept"` (saved total against the answer). The two rate names in the note are still looked up in the rate types held | booking-calc |
| `bkV2LtRoutesApply`, `bkV2PruneLtAddOns`, `bkV2LtAddOnKind` | SKIPPED-DESIGN | hints; the server clamps in the price; only client facts are sent | - |
| `bkV2CommitBooking` | WIRED | the request carries no `total`, `purpose` or price breakdown (Love Kingdom's `b2c_` bookings keep the price as sent). The browser's guess of `pending_approval` stays until the answer; the existing toast "Saved as …" says when the server decided otherwise | booking-calc |
| `bkV2SubmitBooking`, `bkV2SaveDraft`, `bkV2RenderSubmitButton` | SKIPPED-NOT-NEEDED | pre-asks kept; the server's refusals (`foc_reason`, `no_charter_price`, `booking_incomplete`) are already asked or shown through `SAVE_RULES` (ops/40) | - |
| `bkV2ApprovalImpact` | WIRED | `GET /v1/bookings/{id}/approval-impact`, read when the Approve dialog opens | booking-calc |
| `bkV2ApplyAgentRules`, `bkV2SetBookingField`, `bkV2ResetAgentScopedData` | WIRED | `purpose` is not sent; `price_mode` stays a proposal the server judges (`400` when it contradicts the agent kind) | booking-calc |
| `bkV2SetTripCharterBoat`, `bkV2SetTripCharterManualForce` | MISSING-SERVER-FIELD | the displacement figures arrive only as the `409 charter_displaces_seats` of the save (already asked there): MISSING-SERVER-FIELD 4 | - |
| `bkV2ToggleAddOn` | WIRED | the private-van trip is sent with no `zone`; the server makes it `NoTransfer` (Q44). The form still shows NoTransfer: MISSING-SERVER-FIELD 5 | booking-calc |
| `bkV2CreateOvnReturnLeg` | SKIPPED-DESIGN | `ovn_charge` is a validated client input of the quote and the leg is trip data the form composes; no command exists. Decision 5 | - |
| `bkV2SetTripField`, `bkV2SetPickupArea`, `bkV2ResetTripPickupTime` | WIRED | `GET /v1/pickup-time?route_id&area_id&date`, through `bookingV2GetPickupTime` (also used by the pickup section, the commit and the heal) | booking-calc |
| `bkV2FindDuplicateBookings` | SKIPPED-DESIGN | needs a pre-save server check; w4-f3 SKIPPED-DESIGN stands | - |
| `bkV2SetPickupZone` | MISSING-SERVER-FIELD | no `noTransferArea` rule on the server: MISSING-SERVER-FIELD 9 | - |
| `bkV2NatWarn` | MISSING-SERVER-FIELD | `nat_mix` only for `a_b2c`: MISSING-SERVER-FIELD 10 | - |
| `bkV2IsB2CFeeAddOn` | MISSING-SERVER-FIELD | no flag on add-on lines: MISSING-SERVER-FIELD 11 | - |
| `bkB2CAddonOnly`, `_bkB2CAddonIndex`, `bkB2CAddonTo`, `bkB2CAddonsOf`, `_bkOrderLines`, `bkOtherTrips` | MISSING-SERVER-FIELD | no per-booking link: MISSING-SERVER-FIELD 12 | - |
| `bkV2HotelSim`, `bkV2HotelNear`, `bkV2CanonicalHotel`, `bkV2HotelNameList` | MISSING-SERVER-FIELD | `hotel-names` has no zone/area filter or near-match: MISSING-SERVER-FIELD 13 | - |
| `bkV2RenderTab2` and parts, `_btOtherSection`, `bkV2AddOnFlags`, `bkB2CAddonLt`, `bkV2LongtailExtraPax`, `bkV2LongtailCharterExtraBoats` | MISSING-SERVER-FIELD | per-boat pax / over: MISSING-SERVER-FIELD 14 (w4-f3 fields 2 and 3) | - |
| `bkV2RenderCancelReport` (City Tour page) | MISSING-SERVER-FIELD | no land kind on the report: MISSING-SERVER-FIELD 15 | - |
| `pfmPrintReport` | WIRED | `GET /v1/pfm` rows (`total`, `received`, `balance`, `invoice`) of the period on screen; falls back to legacy when a booking has no row | booking-calc |
| `bkV2PayOf` | WIRED | the booking read's `invoice` (`total`, `paid`, `balance`) and `payment_state` | booking-calc |

## Counts

Counted by the report rows (61: 37 in wire-09, 24 in wire-10): WIRED 34 · SKIPPED-NOT-NEEDED 4 · SKIPPED-DESIGN 10 · MISSING-SERVER-FIELD 13 (15 numbered fields below).

## MISSING-SERVER-FIELD list (for a backend agent)

1. `GET /v1/agents/{id}/booking-summary?from=&to=` -> `{ months: [{ month, routes: [{ route_id, live: { bookings, pax, baht }, cancelled: { bookings, pax, baht } }] }], totals }` for `agSumBlock` / `agSumRows` (agent Recent Bookings tab). Today the tab loads every booking of the agent (up to 20,000) and adds them up.
2. `GET /v1/agents/{id}/promo-coverage` -> per route: `{ route_id, contract_id, discounted_price_by_zone, mismatch }` for `agTabPrices`.
3. `GET /v1/agents/programs-fill-plan?scope=empty|partial` -> `{ agents: [{ agent_id, add: [route_id] }] }` and a command `POST /v1/agents/programs-fill` `{ scope, agent_ids? }` for `agProgBulkPlan` / `agProgBulkApply`.
4. `warnings[]` of `POST /v1/quote` (or `GET /v1/boats/{id}/charter-displacement?date&route_id`): `{ code: "charter_displaces_seats", trip, seats_sold, available_after, oversold_by }`, so the boat pick can show the figures before the save.
5. `POST /v1/quote` `trips[].zone` (the zone the server priced: `NoTransfer` for a private van) to drop `bkV2ToggleAddOn`'s local zone write.
6. `alerts[]` on the agent: `rate_not_started` `{ code, tone, message, valid_from }` for agAlerts "Rate not started".
7. `incomplete[]` on the agent: `vat_mode` and `documents` (legal name, tax id, address, signatory) for the "vat" and "docs" chips of `agGapCounts`.
8. `GET /v1/bookings/calendar` `days[].locked_exact` (the lock badge of `bookingV2DayLockedExact`).
9. a rule for `noTransferArea` (pickup areas allowed for a No-Transfer seat), either a `no_transfer` flag on `GET /v1/pickup-areas` rows or a `pickup_area_not_allowed` 400.
10. `GET /v1/b2c/issues` `nat_mix` for staff bookings (extend beyond `a_b2c`), or a `warnings[]` code `nat_mix` on the booking save.
11. `add_ons[].fee` (boolean) on a booking's add-on lines (b2c-ad-* are fee lines).
12. `addon_of` (id) and `addon_lines[]` on the booking read (the link `linkAddonLines` already works out for `GET /v1/b2c/issues`).
13. `GET /v1/hotel-names?q=&zone=&area_id=` with `score` and a `near` match (and the near-match warning of `bkV2HotelNear`).
14. `GET /operations/by-trip` per-boat `pax` and `over` (w4-f3 fields 2 and 3).
15. `GET /v1/reports/cancellations?land=true` (City Tour page).

Optional (decided SKIPPED-DESIGN, listed for completeness): `GET /v1/agents/{id}/renew-defaults` (version, start, end) and `POST /v1/contracts/preview` (discounted price per route).

## Decisions taken (design mindset)

1. **`rtmSnap` stays in the browser.** It only fills the end date of unsaved draft rows from the next row's start; the server judges the whole table on save and refuses overlaps. A round trip per keystroke would make the editor slower with no rule moved.
2. **`ctOpenRenewal` defaults stay in the browser** (+1 year, next version); the server validates what is sent. A defaults endpoint is listed as optional.
3. **`ctPromoDiscPrev` stays a hint**; the real price is the server's when the promo is used in a quote.
4. **`bkV2CalcQuote` and the rate chain keep answering until the first answer, offline, and for B2C / charter without boat.** I did not add a "pricing…" state because that would change the screen from legacy; the developer's rule allows legacy arithmetic until the first answer. After the answer the screen reads only the server's figures (the new test shows the server's number winning over a differing browser rate).
5. **`bkV2CreateOvnReturnLeg` stays in the browser** (the leg is trip data; `ovn_charge` is a validated input).
6. **Group season table: read fresh, apply once.** The dialog reads the plan when it opens (no stale cache), "apply" is the one command, and the agents it changed are read again.
7. **Duplicate agent text**: the server's 409 message carries the other agent's name and code, so the legacy Thai confirm is rebuilt from it. A structured `duplicate: { id, name, code }` on the 409 would remove the parsing (not listed as missing: the text works).
8. **History**: the local line is kept for instant feedback and the server's list replaces it after the write; I did not drop the local call because some callers (document check, nationality auto-fill) may write lines the server does not log.
9. **PFM print**: the print function is legacy's markup; during the call only `acctBookingTotal`, `acctBookingInvoice` and `acctInvoiceBalance` answer from the server rows (restored right after, the call is synchronous). A booking without a server row sends the whole print back to legacy.
10. **Private-van zone**: not sent (the server computes `NoTransfer`); a zone that contradicts it would be `400 private_van_transfer`.

## Assumptions and things to review

- The server's expiry panel lists active agents only; legacy also counted inactive ones.
- `rtExpForAgent` asks one agent at a time (a cached read dropped by any write) unless the list scan is fresh and does not name the agent.
- The Thai duplicate-agent confirm parses the 409 message; a change of that message text falls back to an empty name in the question (the question still appears).
- A local-only pickup area (not on the server) gets one `404 Pickup area … not found` per area and then legacy's table answers.
- `bkV2PayOf`: `paid`/`balance` are the booking's invoice as the server sent them; the over-payment figure is `paid - total`.
- Test coverage: sections 1 to 5 of `t_walk_w5_e.mjs`; rows decided MISSING-SERVER-FIELD or SKIPPED-* have no test.
