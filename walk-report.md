# Walk report: pier office, pier cash, pier job, van bills

Branch `walk/pier`. Test: `node test/ui/t_walk_pier.mjs` (about 90 s, all sections pass; `WALK_ONLY=3,5` runs some).
Real Chrome, real seeded in-process backend, every check reads the screen state and then asks the server directly.
I cannot judge paper layout of any print window, only its content.

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | recorded_staff_id on pier writes | PASS (after fix 1) | Pick made in the real `#po-who` select. Server holds the staff id on: stock receive move, sheet draft (PUT), sheet commit and its moves (the pick at commit time wins), boat close moves, fine payment (`fine.recorded_staff_id`), day close (`closed.recorded_staff_id`). Before fix 1 the sheet save was refused 400 "booking ... not found". |
| 2 | Petty cash sheets | PASS (after fix 2) | `pcBoats`/`pcDates` equal the server sheet's boats (route order) and days. `pcPkPullState` before and after a real pull click equals `park_pull` (waiting 600 to 0, 1 pulled). `pcIsRefund` true for a "รับเงินคืน" line, false for a customer line, as the server's `refund`. `pc2StatPK`/`pc2StatLT` equal the server's heads / join_heads, and the missing count falls to 0 after keying the amount. Pulled line reached legacy as `src:'park'` before fix 2. |
| 3 | Park tickets | PASS | Matrix row Zeus = Thai 3 / foreign 3 / FOC 0 / total 6, Verona 0/5/0/5, equal to `booked.nationality` of the server. Park set made on the server shows in `pkSets()` (name, boat, counts, 3 people); the real "Bought" button locks it on the server (`bought_by: tester`). |
| 4 | Duty, unassigned, route codes, job kind, pay table | PASS (after fix 3) | `poDutySave` from the Office screen (jobs not loaded) put both staff on the server's job. `poUnassigned` = server 5. `paJobKind` = server `kind` for b6, b7, b1. `paRouteCode` = roster `route_codes`. `paRoutesByCode` returned `[]` before fix 3. `PA_PAY_DEF` equals the server's defaulted table. |
| 5 | Pier job board | PASS | `pjPax`, `pjPrep` equal `booked.prep` (and `pjPax` still answers when every browser booking is blanked, so it reads the server). `pjBoatSt` = fleet state, `srvOpenJobs` 1 for the boat with an open repair job; `pjWcAuto` gives the MT code for it and `''` for the other. `pjPierOf`, `pjAllBoats` = the fleet list. `pjDocFind` = certificates matrix cell (expires 2027-03-09), missing type is null. Swatch click saved `PATCH /v1/routes/r5 {color}`; server and screen show the colour. |
| 6 | Licence days left | PASS | `plDaysTo` = server `days_left` for two licences (24 and 2 days); the licences tab (now inside the attendance screen) prints "เหลือ N วัน". Same clock on both sides, so this cannot show the wrapper beats the browser count. |
| 7 | Van bills print | PASS (after fix 4) | Popup HTML captured. Summary window holds the server `doc_no` (VBS-2569-10-2), "1 เจ้า · 1 เที่ยว · 3 คน", total bill 1,700, owner row. Supplier billing note holds `doc_no` VB-2569-10-2-PN, "รวม 1 รายการ", 1,700, and no sale/profit columns. Internal copy holds ราคาขาย, กำไร, sale 600, cost 1,500. The internal-copy button did not exist on the screen before fix 4. Paper layout not judged. |
| 8 | Pier check-in money | PASS | Pier payments taken through the API (card 1000 fee 30 + transfer 500 no slip; cash 400). With no pay box ever opened (`b.pierPayments` empty) `pckPaidSum` 1500, `pckFeeSum` 30, `pckNoSlip` 2, cash booking 400/0/0, all equal to the server row. `pckCotUnset` true for the unpaid cash-on-tour booking, false for the paid one and an ordinary one. |

## Commits

Fixes (all in `allotment_v2/js/ops/`, each proved by the tests below):
1. `8675c58e` fix(ops): sign-out sheet sends server booking ids. `bookings()` in 48 read `window.SB_BOOKINGS`; `SB_BOOKINGS` is a top-level `let`, so it is not on `window` and every sheet save/print was refused by the server.
2. `01902e9d` fix(ops): petty cash rows keep the pulled line's source (`park`/`longtail`/`dock` to `pk`/`lt`/`dock`) and boat, as the wiring doc 3.4 says.
3. `6effd529` fix(ops): `paRoutesByCode` read `window.ROUTES` (also a `let`), so it answered `[]`.
4. `dd657bae` fix(ops): van bill owner screen gets the "ฉบับภายใน" button (`vbPrint(1)`) that legacy has.

Tests: `8567d26f`, `cbe0bb7d`, `90f9797f`, `8069453e`, `a75e2971`, `2afa8466`, `e3f61610`, `9bab80ba` (sections 1 to 8 of `test/ui/t_walk_pier.mjs`), plus this report.

## For the developer

- Same bug class, not fixed (outside my area): `ops/59-ops-travelsum-view.js:620` reads `window.SB_BOOKINGS` and `ops/59-ops-daily-report.js:74` reads `window.ROUTES`; both are `let`s, so these lines see an empty list. Worth a repo-wide grep for `window.<LET_NAME>` in `ops/*.js` (a `let` or `const` at the top of a classic script is never a window property).
- Driven by calling the legacy handler instead of typing into the input (the handler is what the input calls): `pcSetLT`, `poFineOpen`, `renderPierAtt` with `_paTab='lic'`. Everything else went through real clicks and fills.
- `recorded_staff_id` is sent only when a name is picked; legacy's client alert when none is picked (`poWhoGuard`) is kept, and the server does not require it (backend decision 2026-10-17).
- The wrappers for `plDaysTo`, `PA_PAY_DEF` and `paRouteCode` return the same numbers as legacy's own code on this data (same clock, same tables), so those three PASS means "equal to the server", not "proved to come from the server".
- `node test/ui/t_ops.mjs` still fails at step [4] (the known booking-form dialog) and its later steps; unchanged by my commits.
