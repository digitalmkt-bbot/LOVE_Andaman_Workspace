# Day-misc: small day-operations fixes (Q49, Q34a/b/d/e)

Branch `wire/day-misc`. Decisions followed: `todo/decisions-answers.md` in operation-backend (Q49, Q34 a, b, d, e).
Found by the day-ops walk, `docs/walk/dayops.md`.

## 1. Functions done

| Legacy name | File | Status | Server field / endpoint |
|---|---|---|---|
| `bop2IsPast`, `bop2GuardPast` (Boat Operation past-day guard) | `allotment_v2/js/ops/20-ops-deployments.js` (wraps the ones in `04-data-core.js`) | Done. In ops mode an admin (`laIsAdmin()`, from `LA_ME.role`, which comes from `/v1/me`) passes the guard, so every Boat Operation action works on a past day. Everyone else is still blocked, with the server's text. Legacy mode is untouched (blocks everyone). | `POST` / `DELETE /operations/deployments`: a date before today (Asia/Bangkok) is `409 past_date` unless the caller is an admin |
| Van Check-in repaint on other people's changes (`renderVanCheckin`) | `ops/70-ops-changes.js` (`repaintCheckin`), `ops/35-ops-van-jobs.js` (`O.vanJobs.dropDay`) | Done | `GET /v1/changes?since=` (kinds `booking`, `van`, `van_day`, `van_stop`, `van_group`, `deployment`) |
| `bookingV2VanAutoAssign` toast | `ops/34-ops-vans.js` | Done | `POST /operations/van-days/{date}/auto-assign` answers `{assigned:[{group_id, number, van_id, pax, second_round, over_capacity}], groups}` |
| `tsTripAmount` on the booking, by-trip and pier-stats screens | `ops/57-ops-travelsum-rows.js` | Done | `GET /v1/after-trip?date=` (`rows[].trip_amount`) |
| Stale test `ops-vans.test.mjs` | `test/unit/ops-vans.test.mjs` | Done | - |

### What the server allows on a past day (Q49)

From README (Operations, Guards) and `src/domain/deployment-guards.ts`:

- A deployment write for a date before today in Asia/Bangkok is `409 past_date` for everyone except an **admin**
  ("... is in the past: a deployment can't change. Past days are closed and reported; ask an admin to correct it").
- It applies to `POST` (assign, move, change seats) and `DELETE`. The other guards still apply to an admin on a past day
  (`charter_boat`, `boat_held`, `seats_sold` with `remove_anyway`, `boat_not_ready`, `route_closed`).
- The per-day seats route (`assertNotPast`, `catalogue.ts:736`, "decision 10") has its own `past_date` refusal with no admin exception
  (see Decisions needed).

The frontend guard is only a first stop: the non-admin sees the server's wording at once and no request is sent. If a non-admin got past the
screen, the server would still answer `409 past_date` (the test checks this).

### Q34a details

- The redraw runs after the caches are dropped (`O.wrote`), forgets the van day's 5 s load throttle, and goes through `_laRerender`
  (it keeps the scroll position and puts the cursor back in the field).
- While someone is typing in a field (`O.busy()`), it waits and tries again every 1.5 s, up to 8 times, so a note is never cut off.
- A change whose `route_days` do not include the open day is ignored.

### Q34b: how the toast is built

The server has no `unassigned` list. The toast now shows: groups assigned (`assigned.length`), how many went over the van's seats
(`over_capacity`), how many went on a van that already runs another group (`second_round`), and groups left without a van, counted from the
answer's own `groups` (no `van_id`, zone not `NoTransfer` / `NT` / `__CHARTER__`, with riders). Status is `DONE`, `CHECK` (over capacity) or
`PARTIAL` (a group without a van). The server skips self-arrive and charter groups on purpose, so those are not counted as unassigned.

### Q34d details

The first time one of the three screens asks for a day's amount it reads `GET /v1/after-trip?date=` once, keeps it for that day, and draws the screen again
when the answer arrives (not when Travel Summary is the open screen). Until then, and if the read fails, the browser formula answers. Any write
(this tab's, or another person's through the change feed) drops it, so the next draw reads again.

### Q34e

`out-of-scope actions in ops mode` now says what is true: split and unsplit are the 2 `NOT YET` toasts; return van, clear order and pickup-order save are
wired and are refused locally (3 `REFUSED` toasts, no request) when the group is not on the server; clear route with nothing assigned is silent.
A new test covers the auto-assign toast (DONE, CHECK, PARTIAL).

## 2. Fields and rows created

No server field, no row. Browser-side only:

- `window.tsTripAmount.__ownRead` (marker: the wrapper reads the day itself) and the in-memory `dayAmt` map in `57-ops-travelsum-rows.js` (never saved).
- `O.vanJobs.dropDay(date)` in `35-ops-van-jobs.js` (makes the next render of that day read the server again).
- Wrapper markers `__ops` on `bop2IsPast` and `bop2GuardPast`.
- No config key.

Also changed: the `t_walk_locks` and `t_walk_dayops` seed bookings now send `guides: { english: true }` and `leadNationality`, because the
backend now refuses to confirm a booking without them (`booking_incomplete`). Without it both walks stopped at the seed.

## 3. Decisions needed

1. **Backend: send an `unassigned` list from auto-assign?** Not needed now (the toast counts from `groups`), but a list with the reason
   (self-arrive, charter, no riders) would let the toast say why. Backend change, not made.
2. **Per-day seats on a past day.** `catalogue.ts:736` refuses a past day for everyone, admin included. Q49 says an admin may edit past days, so an admin's
   "change seats" on a past day in Boat Operation will be refused by the server with `past_date`. Should the seats route also let an admin through?
3. **Non-admin alert text.** It is the server's English text; legacy's was Thai ("แก้เรือที่ deploy ไม่ได้ ..."). Keep the server's (as decided), or add a
   Thai line?
4. **Walks vs backend.** `t_walk_dayops` still has one red check (moved-away row on item 4), not from this work. The unit tests for agents / contracts
   (`ops-*agents*`, `resync-contract`) fail in this checkout; they are outside the files touched here.
