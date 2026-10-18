# Wave 3, booking form and By-trip (Q43, Q44, Q45, Q47, Q51)

Branch `wire/w3-booking`. Backend guide: operation-backend `todo/w2-booking-form-model.md`.
Test: `node test/ui/t_walk_booking2.mjs` (all pass), with `t_ops.mjs` and `t_walk_booking.mjs` still green.
In this branch the legacy functions are named `bookingV2*` (the backend note calls them `bkV2*`).

## 1. Functions done

| Legacy function | File | Status | Endpoint / field |
|---|---|---|---|
| `bookingV2DrawSources` (lock banner, "locks not used" checks, draw picker) | `js/ops/71-ops-booking-form.js` (wraps) | WIRED | `POST /v1/quote/lock-draws`: `trips[].lock_draws.sources`. Synchronous like the quote: cached per draft (agent, trips, booking id), a miss returns legacy's list and asks once, then redraws |
| `bookingV2AutoDrawLocks` ("ใช้ lock ก่อน") | `71-ops-booking-form.js` (wraps) | WIRED | `lock_draws.proposed` fills `lockDrawSel` and `lockUse`; falls back to legacy if the server does not answer |
| "free but none drawn" warning (banner and save-time confirm) | `bookingV2RenderTripsSection.js`, `bookingV2CommitBooking.js` (unchanged) | SKIPPED-NOT-NEEDED | Both are drawn from `bookingV2DrawSources`, which is now the server's list, with the same condition and the same Thai text as the server's `warning` (the test compares the banner with `warning.message`). Staff choices still go in `lock_draws` on save |
| `bookingV2ToggleAddOn` (private van branch) | `bookingV2ToggleAddOn.js` (unchanged) | SKIPPED-NOT-NEEDED | Legacy already moves the route's trips to `NoTransfer` when the van is ticked |
| the zone sent for a private-van seat (create, `PATCH`, quote) | `40-ops-bookings.js` `toServer`, `51-ops-quote.js` `buildRequest`, helper `laOps.vanZone` in `71` | WIRED | Sends `zone: NoTransfer` for a seat trip on a route with a `transfer-<route>-…` add-on, so an old `PK` zone is never sent back (`400 private_van_transfer`). Charters, return legs and `b2c_` bookings are left alone. The server's 400 message is shown by the save toast |
| `bookingV2GenerateBookingCode` (via `bookingV2NewBooking`) | `71-ops-booking-form.js` (wraps `bookingV2NewBooking`), `40-ops-bookings.js` `toServer` | WIRED | `POST /v1/bookings/reserve-code`; the create sends `code` only for a code the server answered. Offline or before the answer, legacy's local code stays and is not sent as a code. `409 code_used`, `403 code_reserved_by_other`, `400 code_not_reserved`: the save toast shows the server's message and a new code is reserved for the open form |
| `bookingV2RenderTab2` counts (day header, programme head counts) | `bookingV2RenderTab2.js` (5 small edits) + `js/ops/72-ops-by-trip.js` | WIRED | `GET /operations/by-trip?date=[&land=true]`: `day.bookings`, `day.pax`, `routes[].pax.total` |
| `bookingV2RenderTab2` prep chips (`_btPrep`) | same | WIRED | `routes[].prep` (languages, veg, vegan, halal, allergy, longtail join, longtail charter) |
| `bookingV2RenderTab2` "ยังจัดไม่ครบ" Boat and Van, mode pills | same | WIRED | `warnings.boat`, `warnings.van` (bookings, pax, `by_route`) |
| `bookingV2RenderTab2` "Pending approval" notice | same | WIRED | `day.pending_approval.bookings` (the server keeps those bookings out of every other figure) |
| `bookingV2Aggregate` | `bookingV2Aggregate.js` | SKIPPED-OTHER | It feeds the booking calendar chips, not the By-trip page, and the backend has no endpoint for those chips |
| By-trip bundle / longtailManual flags, return-van, re-confirm and mixed-van chips, boats-running card, seat figures | `bookingV2RenderTab2.js` | SKIPPED-DESIGN | The server does not serve them (model note section 1); they stay on legacy. Return-van and re-confirm chips are still counted in the browser |
| `bookingV2PartialRecalc` | `71-ops-booking-form.js` (wraps) | WIRED | `POST /v1/bookings/{id}/partial-cancel/preview`: `charged.amount` (proposal, top of range), `charged.max`, `waived.amount` |
| `bookingV2PartialModal` | `71-ops-booking-form.js` (wraps) | WIRED | Refund (waived) box is read-only; the fee box takes the proposal, may be lowered, and shows the preview's `400 charged_amount_out_of_range` message under the box |
| `bookingV2PartialConfirm` | `bookingV2PartialConfirm.js` (unchanged) | SKIPPED-NOT-NEEDED | It already sends `charged.amount` and only `waived.count` (the earlier handoff). Confirm with a fee above the range is the server's 400 and shows its message |

Edits in legacy files (renders that cannot be wrapped), all in `js/booking/bookingV2RenderTab2.js`, each marked `§opsByTrip`:
1. `_srv` read right after `const date` (null means legacy counts).
2. `_dAD`, `_dCHD`, `_dINF`, `_dFOC` and the booking count in `.bt-daytot`.
3. Programme head counts (`_famAgg[].pax`) summed from the server's routes, before `_famList`.
4. `_btPrep` returns the server's prep.
5. After the unassigned loop, `_unBoatN/Pax/R` and `_unVanN/Pax/R` are set from `warnings`.
6. `_btPendN` from `day.pending_approval.bookings`.

Also edited (ops adapters, not legacy): `40-ops-bookings.js` (two lines: `code`, zone), `51-ops-quote.js` (zone), `allotment_v2.html` (two script tags).

## 2. Fields and rows created

None on the server. Browser side only:
- `laOps.reservedCode(code)`, a closure map of codes the server answered (not stored).
- `laOps.vanZone`, `laOps.lockDraws._cache`, `laOpsByTripFor`, `laOpsByTrip._cache`, `laOps.partialPreview`: in-memory caches and helpers.
- `#bkp-srv-note`, a text line added to the partial-cancel dialog for the server's message.
- No new property on a booking or a trip (a draft's `code` is replaced by the reserved code; `lockDrawSel` and `lockUse` already existed).

## 3. Decisions needed

1. **Warning text is not read from the server's `warning` object.** The banner and the save-time confirm are legacy's, fed by the server's sources. Same words and condition today; if the server's text changes, the screen will not follow. Say if you want the banner to print `warning.message` and the confirm `warning.save_line`.
2. **Partial-cancel hint line** in the dialog said both boxes were editable; I rewrote that sentence (refund no longer editable). Confirm the wording.
3. **By-trip programme head counts now exclude `pending_approval`** (legacy's programme card counted them; the model note's rule keeps them out). The Notice still lists them apart.
4. **The return-van and re-confirm chips still count in the browser**, so with a partly loaded booking list they can disagree with the server's Boat and Van figures. They need a server count (the van board and the re-confirm list) before they can move.
5. **A refused code (`code_used` etc.) reserves a new code at once**, so the code on the open form changes after the failed save. The alternative is to leave the code and let staff press Save again.
6. `t_assetver.mjs` already fails on many files (hand `?v=` out of date before this branch); I did not touch the `?v=` numbers (the deploy build rewrites them).
