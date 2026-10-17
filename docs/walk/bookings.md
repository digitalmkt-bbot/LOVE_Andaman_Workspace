# Walk report: BOOKINGS (branch walk/booking)

Test: `node test/ui/t_walk_booking.mjs` (about 45 s, 36 checks, all pass). Fixed dates 2026-11-10..13 and 2026-12-20.
Each check reads the screen state AND the server asked directly through the API.

| # | Function | Result | Evidence |
|---|---|---|---|
| 1 | confirm with missing fields -> 400 booking_incomplete | PASS | Quote saved, then Submit: POST /confirm answered 400 booking_incomplete; the alert "Cannot confirm, please complete:" lists the server's pickup line; booking reloaded as quote, form reopened. Reached only with a pickup mismatch (form says No Transfer, trip zone PK): the client's own "Cannot save" guard stops every other case first. |
| 2 | Save Draft on live booking -> /unconfirm | PASS | Real button; "downgrade to quote?" confirm; calls PATCH then POST /unconfirm; server status quote, screen quote. |
| 3 | duplicate voucher from another month | PASS | December booking not loaded in the app; typing its voucher shows the warning (GET /v1/bookings?voucher_ref=); save does one GET before any POST, dup question names the other-month booking, No = nothing saved, Yes = saved. |
| 4 | custom nationality | PASS | "+ Add" row posts /v1/nationalities; picker takes the server code, field shows the name; after page reload still in SB_CUSTOM_NATIONALITIES and the dropdown. |
| 5 | NO RATE follows the server quote | PASS | not_offered warning -> trip flagged, button "No rate - 1 trip - cannot save"; rated trip clean. With the server's rate changed after load (app still holds the old one) the screen flags the trip with the server's message. Note: when legacy also flags a trip, the reason text shown is legacy's, not the server's (by design in ops/51). |
| 6 | cancel reasons, partial cancel, cancel | PASS | Dialog options = GET /v1/cancel-categories in order (8); customer_cancel pre-selects "full"; partial cancel (pax 3 -> 2) and cancel (charge 700) via the dialogs: server status, category, charge, history lines, screen all agree. |
| 7 | B2C review | PASS | 2 changed orders pushed by a Love Kingdom login; app read GET b2c-unreviewed (refresh called once instead of waiting the 60 s poll); chip shows 2; "Reviewed" posts /{id}/b2c-seen (server count 1, b2c_seen line by tester); "Mark all" posts /b2c-seen (server count 0). |
| 8 | 409 cancelled: pickup time / pier note | PASS (pier note via dialog) / pickup time NOT-REACHABLE by typing | Pier note dialog on a cancelled booking: 409 cancelled, server's message shown ("Pier note not saved ... is cancelled: its dispatch cannot change"), nothing kept. Pickup time: a cancelled row on By-trip has no time box, and a booking cancelled elsewhere loses its box at once (change feed). The handler bookingV2SetPickupFinal called directly gets the same 409 and message, nothing kept. |
| 9 | programme_anyway / route_closed | PASS | Route outside programme: commit's own question asked once, No = nothing saved, Yes = saved with no server refusal. With a stale programme on screen the server's 409 route_not_in_programme is asked with its own text and OK saves. Day closed after load: 409 route_closed, message "Route Similan Islands by Speedboat (r5) does not run on 2026-11-12" shown, nothing saved, form reopened. |
| 10 | nationality_effective in Market Data | PASS | Blank passenger "Zhang Wei": server says RU (lead's), legacy guess would be CN; mdBkCode = RU, mdBkMix = {RU:2, US:1}. Market Data screen render checked only for no error. |

## t_ops.mjs step [4] failure: diagnosis

Not stale. The confirm dialog quoted in the failure is from step [3] (lock release), it only sat in the last-4 dialog list. Real cause: a REAL client/backend mismatch. Backend commit fe2df48 ("Freeze a booking's market at create") made `market`, `market_sub`, `market_agent_id`, `market_at` server-owned; the app's `ops/40-ops-bookings.js` still sent `marketSnapshot` on every create, so POST /v1/bookings answered 400 "market cannot be set: it is the agent's market ... set by the server", and the commit rolled the booking back.
Two commits fixed it:
- `fix(ops)`: stop sending marketSnapshot (it is still read back from the server).
- `test:` t_ops step [4] waits for the booking's opsId (the save now waits for a quote/voucher check, so it can finish after the fixed 1.2 s pause).
t_ops now passes (all steps).

## Commits (branch walk/booking)
- fix(ops): do not send marketSnapshot on booking create/patch (server freezes it and refuses it, fe2df48); fixes t_ops step [4]
- test: t_ops step [4] waits for the booking's opsId
- test: walk bookings items 1-4
- test: walk bookings items 5-8
- test: walk bookings items 9-10 + walk-report.md

## For the developer to decide
1. Backend: `POST /v1/bookings` with `intent: confirm` stores an incomplete booking as confirmed (I saw status confirmed with `incomplete: [pickup]`); only the `/confirm` command refuses with booking_incomplete. Legacy refuses to save it. The client guards the same list first, so no screen is affected today, but another client could create confirmed incomplete bookings.
2. A cancelled booking has no pickup-time box on By-trip, so legacy's "edit the time of a cancelled booking" cannot happen from that screen at all; the 409 is only a race case. Fine, just noted.
3. Item 5: the reason text in the NO RATE band is legacy's wording when legacy also flags the trip; the server's message shows only when legacy missed it.
4. Not done on purpose: waiting the real 60 s poll for item 7 (one `laOps.b2cReview.refresh()` call instead); item 10 does not check Market Data numbers on screen, only mdBkCode/mdBkMix and that the screen renders.
