# O4 · O5 · O1 · C3 — blocked, with the evidence gathered

Status: **all four blocked; no adapter written.** Each packet's mapping is either incomplete or depends on a projection design that has not been verified in the browser. The evidence below is what the next worker needs. Reconfirm (in its own report) and S5 markets/salespeople (in its own report) were implemented.

Backend source is read-only. Paths are under `D:/projects/operation-backend/src/`.

## O4 — vans and van jobs

### Server surface (verified in `routes/operations.ts` and `domain/van-groups.ts`)
| Route | Body (from parser) |
|---|---|
| `PATCH /operations/trip-ops/:trip_id` | `van_parts` (list of `{idx, ad, chd, inf, foc, group_id, sequence, return_van_id, pick_time?, source?}`; `[]` or `null` unsplits), `return_same_van`, `raise_capacity`, dispatch fields |
| `GET /operations/van-groups?service_date&route_id` | returns `{service_date, route_id, groups}` |
| `POST /operations/van-groups` (201) | `{service_date\|date, route_id, zone, members:[{trip_id, idx}], van_id?, allow_second_round?}` |
| `POST /operations/van-groups/:id/members` | `{members}` |
| `PATCH /operations/van-groups/:id` | `{van_id?, return_van_id?, pickup_time?, allow_second_round?}` |
| `PUT /operations/van-groups/:id/order` | `{members}` or `{clear:true}` |
| `DELETE /operations/van-groups/:id` | 204 |
| `POST /operations/van-groups/clear` | `{service_date, route_id}` |
| `PUT /operations/van-groups/order` | `{service_date, route_id, zone, group_ids}` or `{…, clear:true}` |
| `GET /operations/van-jobs`, `GET /:date/:key`, `PUT|DELETE /:date/:key/sent`, `GET|PUT /operations/pickup-names-th` | read / sent-tick / Thai names (not read in detail) |

### Why it is blocked
1. **Projection gap.** `40-ops-bookings.js` maps `van_parts` into `ops.vanParts` (`operationsFrom`), but nothing maps them onto the fields the legacy UI reads: `bk.ops.vanSplits[]`, `vanGroup`, `vanId`, `vanReturnId`, `vanSeq`, `pickupTimeFinal`. Grep for `vanSplits|vanGroup|vanId` in `40-ops-bookings.js` returns nothing.
2. **Identity gap.** Legacy group = a number per (date, route, zone) (`bkV2VanGroupSelected`, `_bkV2GrpApply`). Server group = `id` (`vgrp_…`) with a `number`. A map from legacy number to server id has to be built from `GET /operations/van-groups` on every day load.
3. **Part index gap.** Legacy `vanSplits[0]` is the main part; the server `idx` is per trip part. Equivalence is assumed, not verified.
4. **Per-booking writes.** Legacy `bookingV2VanGroupSetVan/SetTime/SetReturn/Disband/Selected/ClearRoute/Save` mutate per-booking fields through `_bkV2GrpApply`; each needs translating into the group commands above, plus the seat-capacity alerts (which must come from the server 409 bodies).
5. The vans registry, day matrix and Vans page (`SB_VEHICLES`) remain out of scope per the spec.
6. Legacy `bookingV2VanAutoAssign` must never be wired (never auto-pick a van).

Required to unblock: the projection design for the four fields above and a browser run of By-trip van assignment in ops mode.

## O5 — weather closures and trip actuals

### Server surface (verified)
- `operations.ts` (~1764-1830):
  - `POST /v1/weather-closures` (201): `{route_id|routeId, service_date|date, note?, reason?: 'weather' only}` (`parseNewClosure`)
  - `PATCH /v1/weather-closures/:id`: `{note}` (`parseClosurePatch`); closed closures refuse
  - `POST /v1/weather-closures/:id/bookings/:booking_id/notify`: no body
  - `POST /v1/weather-closures/:id/undo`: `{undo_anyway?: boolean}`
  - `GET /v1/weather-closures`, `GET /:id`
- `operations.ts` ~1261: `POST /v1/bookings/:id/cancel-weather`. Parser `parseWeatherCancel` (`domain/weather.ts` ~158): `{note?, outcome}`; `amount` is refused by design. **Body and outcome values not read end-to-end in this pass.**
- `costing.ts` ~231-330: `GET /v1/trip-actuals?from&to`, `GET /v1/trip-actuals/:date/:boat_id`, a dynamic set of `POST /v1/trip-actuals/:date/:boat_id/${path}` commands (close / reopen / ran / not-ran etc.), `PUT /v1/trip-actuals/:date/:boat_id/meal-overnight/:booking_id`. **Path list and bodies not read in this pass.** Trip-actuals domain is `domain/trip-actuals.ts`.

### Why it is blocked
- Legacy keeps closures in `SB_WEATHER_CLOSURES` / `sb_weather` and per-booking `bk.weatherResolve`; no projection from the closure view has been written, so the UI would not reflect server state.
- Actual/meal commands: bodies and the `${path}` list are not yet read. Legacy `pckMealSend` and the trip-actual handlers are not located in this pass.

Required to unblock: read `costing.ts` 231-330, `domain/trip-actuals.ts` (command parsers), `domain/weather.ts` parseWeatherCancel and `operations.ts` cancel-weather handler; write the closure projection; map `bookingV2WeatherMark*`, `bookingV2WeatherNotify`, `bookingV2WeatherUncancel`, `bookingV2WeatherResolveOne`, and the actual/meal handlers; browser-check.

## O1 — pier office and pier cash

### Server surface (verified literals, `routes/pier-office.ts`)
- `GET|PUT /v1/pier-cash/settings`
- `GET /v1/pier-cash/:pier/days/:date` (`?deleted=true`)
- `POST /v1/pier-cash/:pier/days/:date/rows` (201) → `{row, day}`
- `DELETE /v1/pier-cash/rows/:id?reason=` → `{row, day}`
- `POST /v1/pier-cash/:pier/days/:date/pull` (201) → `{rows, day}`
- `GET /v1/pier-cash/:pier/days/:date/certificate?ids=`
- `GET /v1/pier-cash/:pier/months/:month`, `…/months/:month/longtail?date=`, `…/months/:month/park?date=`
- `PATCH /v1/pier-cash/:pier/days/:date/longtail/:boat_id`, `PATCH …/park/:boat_id`
- `GET /v1/pier-office?pier=`; `POST /v1/pier-office/:list` (201); `PATCH /v1/pier-office/:list/:id`; `DELETE /v1/pier-office/:list/:id?unassign_anyway=`; `POST /v1/pier-office/:list/order`
- `:list` must pass `parseList` (`LIST_KEYS` in `domain/pier-office.ts`).

### Why it is blocked
- Request bodies are in `domain/pier-cash.ts` (`parseCashRow`, `applyLongtail`, `applyPark`, `parseSettings`) and `domain/pier-office.ts` (`planCreate`, `planPatch`, `planOrder`, `planDelete`, `LIST_KEYS`). **Not read in this pass.**
- Legacy stores (`PIER_MOVES`, `PIER_JOB`, `PIER_TEAM`) and the petty-cash UI functions were not mapped.
- The spec forbids inferring the per-list body; each list needs its own parser read.

## C3 — route, family and boat CRUD

### Server surface (verified literals)
- Routes: `POST /v1/routes` (`operations.ts` ~726), `PATCH|DELETE /v1/routes/:id` (~744, ~761), `POST /v1/routes/order` (~770)
- Families: `GET|POST /v1/route-families`, `PATCH|DELETE /v1/route-families/:id` (~698-708)
- Boats: `POST /v1/boats` (~777), `PATCH /v1/boats/:id` (~793), `POST /v1/boats/:id/retire|restore` (~821, ~831), status-log `POST|PATCH|DELETE /v1/boats/:id/status-log[/:entry_id]` (~846-868), capacity overrides `GET|PUT|DELETE /v1/boats/:id/capacity-overrides[/:date]` (~879-901)

### Why it is blocked
- Legacy candidates located: `saveBoat()` (`js/04-data-core.js` ~7496), `saveRoute()` (~11684), `delRoute(id)` (~11700). Their payload-building code was not read, and no legacy route-family handler was located.
- The handler-to-payload mapping has not been captured, and the parsers (`domain/catalogue.ts`, `domain/fleet.ts`) were not read. The spec says not to assign implementation until each is sourced.

## Machine-readable notes
`.agent-reports/O4.json`, `O5.json`, `O1.json`, `C3.json` carry the same status.
