# O3 — Day-of booking actions (`36-ops-day-actions.js`)

## Input contract

- **Requested outcome:** Migrate day-of booking actions (insurance, special meals, check-in, and on-tour sales/upgrade collection) to `operation-backend` in operations mode.
- **Acceptance criteria:**
  - Booking action writes (`PUT /v1/bookings/:id/insurance`, `PUT /v1/bookings/:id/meals`, `POST|PATCH|DELETE /v1/bookings/:id/tour-sales...`, `POST .../collect`, `POST .../upgrades/:upgrade_id/collect`) use `laOps.bookingWrite`, preserve `bk.opsId` / `bk.opsVersion`, and replace the returned booking.
  - Check-ins (`PUT|DELETE /operations/trip-ops/:trip_id/checkins/:kind/:slot`) merge returned `trip.operations`, do not create a booking version bump, and preserve append-only no-show/cxl events.
  - Leave reconfirm legacy-only until verified per O3 specification.

## Output contract

### Backend files inspected

- `D:/projects/operation-backend/src/routes/operations.ts`
- `D:/projects/operation-backend/src/routes/sales-editing.ts`
- `D:/projects/operation-backend/src/routes/money.ts`
- `D:/projects/operation-backend/src/domain/insurance.ts`
- `D:/projects/operation-backend/src/domain/checkin.ts`
- `D:/projects/operation-backend/src/domain/pier-money.ts`
- `D:/projects/operation-backend/src/domain/upgrades.ts`

### Endpoints exercised

| Method | Path | Body |
|---|---|---|
| `PUT` | `/v1/bookings/:id/insurance` | `{ passengers: [{ passenger: 'lead'\|number, age?, reviewed? }] }` + `If-Match` |
| `PUT` | `/v1/bookings/:id/meals` | `{ veg, vegan, halal, allergies }` + `If-Match` |
| `PUT` | `/operations/trip-ops/:trip_id/checkins/:kind/:slot` | `{ expected, actual_pax, checked_in_at, checked_in_by, ..., events }` |
| `DELETE` | `/operations/trip-ops/:trip_id/checkins/:kind/:slot` | none |
| `GET` | `/v1/bookings/:id/tour-sales` | none |
| `POST` | `/v1/bookings/:id/tour-sales` | `{ trip_date?, service, qty, unit_price, to_company, seller?, method, fee_pct?, slip_ids? }` + `If-Match` |
| `PATCH` | `/v1/bookings/:id/tour-sales/:sale_id` | `{ service?, qty?, unit_price?, to_company?, seller?, method?, fee_pct?, slip_ids? }` + `If-Match` |
| `POST` | `/v1/bookings/:id/tour-sales/:sale_id/collect` | `{ method, fee_pct?, slip_ids? }` + `If-Match` |
| `DELETE` | `/v1/bookings/:id/tour-sales/:sale_id` | `If-Match` |
| `POST` | `/v1/bookings/:id/upgrades/:upgrade_id/collect` | `{ method, fee_pct?, slip_ids? }` + `If-Match` |

### Verification

- `node --check allotment_v2/js/ops/36-ops-day-actions.js` — passed
- `node --check test/unit/ops-day-actions.test.mjs` — passed
- `node --test test/unit/ops-day-actions.test.mjs` — 3/3 passed
- `cd D:/projects/operation-backend && node --import tsx --import ./test/setup.ts --test test/checkin.test.ts` — passed
- `git diff --check` — passed
