# Replacement Readiness — 2026-10-13

## Verdict

**BLOCK — do not replace `lk-inbox` yet.**

This is a current-code review of the `main` integration frontend against `operation-backend`. It supersedes earlier claims that User Admin, Sales Board, B2C Health, quote, commissions, pier money, van bills, Trip P&L/costing, capacity overrides, and most Pier Office screens were unwired: operations adapters now exist for those areas. Adapter presence and Node tests are not browser acceptance testing.

## Deploy state (2026-10-13)

- **operation-backend** `main` `8c0ab08` is deployed. It carries the pier-cash row PATCH, the pier ledger/outstanding/write-off/repair routes, invoice payment-slip add/remove, and the two controlled-error fixes. Verified live: `GET /v1/pier-office/tublamu/moves` returns 401 (route exists), not 404.
- **This frontend** `main` `38c0525` is pushed (`origin/main` equals local `HEAD`). It wires Reconfirm, petty cash, Transfer Fleet writes, the pier ledger and payment slips, and disables the report-email chart upload. The new calls depend on the backend routes above. At the last check the production page still served the previous build (`08-app.js?v=a05dae53`), so the `38c0525` deploy had not finished; re-check `08-app.js` is not `a05dae53` before testing.
- **Acceptance:** run against local Docker, see below. Not yet run against the real production database or by staff.

## Acceptance run (2026-10-13, local Docker)

Backend `8c0ab08` built in Docker (Postgres 18), restored from the saved Oct 10 dumps, then the cutover import run in the README order into an **empty** `operations` database: `seed:routes`, `seed:boats`, `import:pipeline --commit --sales --rate-types --all`, `import:fleet`, `import:fleet-stock --all`. All exited 0. The frontend was served from this repo's `main` against that API and driven in Chrome.

Import result: 5,414 of 5,436 bookings, 837 agents, 22 boats, 1,188 pier moves, 154 cash rows, 477 invoices, 53 vans. `verify:import`: 6 of 23 checks differ.
- 22 bookings missing, all `b2c_*` (not imported by default).
- Per-day seat and charter passenger diffs (2 + 1) and monthly THB diffs (2); probably those 22 bookings, not confirmed.
- 5 active-lock diffs on 11-13 Oct (probably lock expiry); 104 legacy columns hold data that no import code reads (`paymentstatus`, `cashontour`, `lockdrawsel`, ...). Decide whether any of those matter before cutover.
- Note: the saved `operations` dump (4,373 bookings, 0 agents) cannot migrate to current `main`: migration 240 adds `bookings_agent_fk` and fails. Cutover must start from an empty database, as above.

| Area | Result |
| --- | --- |
| Unknown `agent_id` on booking create | **Pass on Postgres**: 400, nothing written |
| Delete licence class in use | **Pass**: 409 `licence_class_in_use`, lists the 12 licences |
| Petty cash: edit row, certificate | **Pass**: persisted `1600.00`; certificate shows the server rows, Thai total, company name |
| Reconfirm: send, undo, status picker | **Pass**; server state and history line match |
| Transfer Fleet: load, edit, day-cell writes | **Pass** |
| Transfer Fleet: van form save | **Bug found and fixed** (`0cdae76`): the legacy form state has no colour, so every save sent `color:null` and wiped the van's colour. Now sent only when the user picks one. |
| Pier ledger and boat close dialog | **Pass**: 1,188 moves; Hermetis close lists 1 + 2 + 15 = 18, equal to the server's carry. Needs a recorder chosen in the top bar first (legacy guard, expected). |
| Payment slip after payment: attach, view, delete | **Pass**: server 0 to 1 to 0, file removed |
| Ship write-off / repair success path | API refusals pass (400 no note, 409 over stock); a successful write-off was **not** exercised |

Not covered: contract artifact upload, the other attachment paths, concurrent writes and login expiry, a van delete, the petty-cash print layout (the print window was captured, not rendered), and any run against the real production database.

## Release blockers

All four blockers from the first review now have code behind them (merged 2026-10-13, backend `8c0ab08`). **None has been browser-tested.** Treat them as "wired, awaiting acceptance", not "done".

| Area | What changed | Still open |
| --- | --- | --- |
| Transfer Fleet | `ops/35-ops-vehicles.js` writes vans, day cells and status/zone ranges to `/operations/vans*` and `/operations/van-days`. The backend already had every route. | `costPerDay` and the van log panel are still browser-local. Two fast clicks on a day cell send the same value. |
| Reconfirm | `ops/39-ops-reconfirm.js` wires `rcSetStatus`, `rcSendAgent`, `rcUnsendAgent`, `rcToggleBooking`. | Browser test. |
| Pier Office audit/close | Backend: `GET /v1/pier-office/{pier}/moves`, `.../boats/{id}/outstanding`, `ship-writeoff`, `ship-repair`. `48-ops-pier-office.js` hydrates the ledger and reads outstanding before the close dialog. | Write-off/repair semantics were derived from legacy `poBal`; ops should confirm. A pier is capped at its newest 5000 moves. `GET /v1/pier-office/boats/{id}/team` is not built. |
| Invoice/PFM payment slips | Backend: `POST/DELETE /v1/invoices/:id/payments/:pid/slips`. `38-ops-attachments.js` attaches after payment, cleans up the upload on refusal, and fixes slip view/delete. | The target is a heuristic: the latest live non-credit payment on the first non-void invoice. Multi-booking invoices, pier payments, upgrades and Cash on Tour are not handled. |

### Daily-report email images: disabled, out of scope

`drmEnsureImgs` (`08-app.js`) no longer uploads the trend/donut charts to the removed `/api/mailimg`. The report email uses its bar-chart fallback and shows no error. Embedded chart images would need a public image URL, which operation-backend does not provide; that is deliberately not part of this cutover. The `/api/mailimg` item is removed from the acceptance list.

## Newly wired: petty cash / เงินสดย่อย

The pending local frontend change adds `allotment_v2/js/ops/46-ops-pier-cash.js` and its script tag. It routes these operations to `/v1/pier-cash`:

- daily ledger reads and month carry-forward values;
- manual incoming/outgoing rows and deletion;
- pulling longtail, park, and dock totals into the ledger;
- longtail and park sheet cells, including park fill;
- company-name settings.

The adapter is server-first and restores data from server reads after a refused sheet write. `test/unit/ops-pier-cash.test.mjs` covers hydration, write paths, legacy fallback, park fill, and the row-editor behavior.

### Petty-cash row edit and certificate

`PATCH /v1/pier-cash/rows/:id` now exists and the row editor uses it (source rows pulled from a sheet remain non-editable). The certificate view reads from `GET /v1/pier-cash/:pier/days/:date/certificate` by temporarily swapping legacy helpers for the server response during one synchronous print call; this relies on `pcPrintWin` being synchronous and needs a browser check, including the company-name dialog retry.

## Other verification still required

These are not confirmed code blockers, but must pass in a browser against PostgreSQL/Railway before approval:

1. Contract artifact upload/metadata in operations mode (`js/ops/18-ops-contracts.js`).
2. Every attachment UI path.
3. All newly added operations adapters, especially Pier Office, return-van-per-split-part, attachments, and petty cash.
4. Concurrent-write/refusal behavior and authentication expiry on production-like data.

## Backend defects (fixed, one unverified)

- Deleting an in-use pier licence class now returns 409 `licence_class_in_use` with the dependent licences (tested on the in-memory store).
- An unknown booking `agent_id` now maps the Postgres `bookings_agent_fk` violation to a 400. **Its test is skipped without `DATABASE_URL`; run it against real Postgres.**

## Resolved since the earlier review

- Attachments normally route through `/v1/attachments` in operations mode.
- Split-part return-van assignment sends the complete `van_parts` payload to `PATCH /operations/trip-ops/:trip_id`.
- Boat job sheets / ใบงานเรือ, most Pier Office lists/configuration, stock commands, roster, licences, settings, sign-out sheets, boat close, day close/reopen, User Admin, Sales Board, B2C Health, commissions, pier money, capacity overrides, van bills, Trip P&L/costing, and quote have operations adapters.

## Cutover rule

Do not schedule the one-day cutover until every release blocker is resolved, the backend defects return controlled errors, and the browser acceptance list passes. On the cutover day, stop legacy writes before the final legacy import, run the importer once, then let staff enter data only in the replacement.
