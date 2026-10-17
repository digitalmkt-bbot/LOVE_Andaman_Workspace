# r2-other: wiring the "other rules" fields (branch wire/r2-other)

## 1. Functions done

| Legacy name | File | Status | Server field / endpoint |
|---|---|---|---|
| sheet booking lines (`sheetBody`, `poIsPax`, `poIssueOpen` save) | `allotment_v2/js/ops/48-ops-pier-office.js` | WIRED (fix) | `PUT .../sheets/{boat}`: a booking line no longer sends `adults` (server stores `heads`; a sent value is 400). An extra line keeps `adults`. `poIsPax` wrapper unchanged (still serves the screen from `rows[].heads`). Test: `t_walk_pier.mjs` saves the sheet twice |
| create path with `intent: confirm` (`bookingV2CommitBooking` wrapper) | `ops/40-ops-bookings.js` | SKIPPED-NOT-NEEDED | One `p.catch` handles a create and a save-then-`/confirm`: both give `code: booking_incomplete` and the same alert listing the server's messages (the create has no booking to reload, so it only reopens the form). No edit. The walk test's setup that made a blank-nationality booking with `intent: confirm` now asks for `intent: quote` (`t_walk_booking.mjs`) |
| `mdOurPaxByMarket` | `08-app.js:3439` | SKIPPED-NOT-NEEDED | `GET /v1/market-stats/our-pax`. Nothing in the frontend calls the function (no screen shows it) and it is synchronous, so there is nothing to wrap |
| `pmMarket` | `08-app.js:4540` | SKIPPED-NOT-NEEDED | Already wired: `ops/40-ops-bookings.js` maps `market`, `market_sub`, `market_agent_id`, `market_at` to `bk.marketSnapshot`, which `pmMarket` reads first (legacy order). The analysis `markets` roll-up is a server read no screen here uses yet |
| `pcParkRate` | `ops/46-ops-pier-cash.js` | WIRED | `rate` of the boat rows of `GET /v1/pier-cash/{pier}/months/{ym}/park`, found by the boat's `route_id`, turned into legacy's object with legacy's Thai texts. A route no loaded park sheet lists, and non-ops mode, use legacy's cost-plan code. `pcPax`, `pcParkAmt`, `pcPkDue`, `pc2StatPK` untouched and working |
| `park_fee.rates` / `park_fee.ok` of the pier boats read | - | SKIPPED-OTHER | Not used: the park sheet `rate` covers every screen that calls `pcParkRate` (pier cash park views). The pier-office dock-in path (`08-app.js:63094`) keeps legacy's rate until a park sheet is loaded |
| `bkNatTHb` | `ops/48-ops-pier-office.js` | WIRED | `boats[].bookings[].thai` of `GET /v1/pier-office/{pier}/days/{date}/boats`, found like `poPaxLeft` is. A trip whose boat-day has not been read (a P&L over old dates) keeps legacy's count. The boat's `nationality_real` equals the sum of the `thai` only when nobody is lost: `pcPax` keeps its server figure, `bkNatTHb` stays on the booked basis, as legacy |
| `owed` (breakdown fallback) | `ops/66-ops-row-flags.js` | SKIPPED-NOT-NEEDED | `laBkMoney` already returns the server's `owed` flag |
| `b2c_channel` null | `ops/66-ops-row-flags.js` | SKIPPED-NOT-NEEDED | The server always sends a label (`ไม่ได้ระบุช่องทาง` or `คีย์เอง` when the stored channel is null); `laB2CChannel` shows it |

Checks: `node --check` on every changed file; `t_ops.mjs` all passed; `t_walk_pier.mjs` ALL PASSED; `t_walk_booking.mjs` all passed.

## 2. Fields and rows created

None. No new browser property or config key.

## 3. Decisions needed

1. `POST /v1/bookings` with no `intent` still confirms without the required-field check (backend note, item 3 there). The form always sends an intent, so the screen is covered; other clients are not.
2. `mdOurPaxByMarket` has no screen. If a market page should show the period view, that screen needs designing first.
3. Dock-in pier-office fee (`08-app.js:63094`) uses `pcParkRate` before any park sheet is loaded. If it must be the server's on first open, the boats read's `park_fee.rates` can feed it (needs a boat-to-route lookup).
