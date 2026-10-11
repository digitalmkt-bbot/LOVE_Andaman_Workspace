# F5 — Fleet projects, daily log, safety, fuel budgets, and reports (`26-ops-fleet-daily.js`)

## Input contract

- **Requested outcome:** Migrate fleet projects (`FL_PROJECTS`), Daily Fleet Log (`FL_DAILY`, `FL_FUEL_PRICE`, `FL_DR_LOCK`, water, issues, extras, pier requests), safety equipment (`FL_SAFETY`), monthly fuel budgets, and fleet report/insight reads to `operation-backend` in operations mode.
- **Acceptance criteria:**
  - A daily response replaces the cache for only that date.
  - Honor server pier locks (`FL_DR_LOCK`).
  - Do not recreate server project-completion or safety-replacement side effects in the browser.

## Output contract

### Backend files inspected (inspect-first evidence)

- `D:/projects/operation-backend/src/routes/fleet-stock.ts`
- `D:/projects/operation-backend/src/routes/fleet-extras.ts`
- `D:/projects/operation-backend/src/routes/fleet-insights.ts`
- `D:/projects/operation-backend/src/domain/fleet-projects.ts`
- `D:/projects/operation-backend/src/domain/fleet-daily.ts`
- `D:/projects/operation-backend/src/domain/fleet-safety.ts`
- `D:/projects/operation-backend/src/domain/fleet-replace.ts`

### Inspected payload contracts

- Projects:
  - `POST /v1/fleet/projects`: `{ no, name, boat_id, type, vendor?, plan_from, plan_to?, planned_budget?, notes? }`
  - `PATCH /v1/fleet/projects/:id`: `{ name?, boat_id?, type?, vendor?, plan_from?, plan_to?, planned_budget?, notes?, phase?, bill_note? }`
  - Lifecycle: `POST /v1/fleet/projects/:id/start|resume|reopen|bill-back` (`{}`), `hold` (`{ reason }`), `cancel` (`{ reason, unlink_jobs? }`), `work-done` (`{ note? }`), `complete` (`{ no_cost_reason? }`)
  - Plan: `POST /v1/fleet/projects/:id/plan` (`{ text }`), `PATCH /plan/:item_id` (`{ done }`), `DELETE /plan/:item_id`
- Daily Log:
  - `GET /v1/fleet/daily-log?from=&to=`
  - `PATCH /v1/fleet/daily-log/:date/boats/:boat_id`: `{ fuel_litres?, pax_actual?, meters?: { [trip_type]: { [engine_id]: reading } } }`
  - `PUT /v1/fleet/daily-log/:date/boats/:boat_id/water`: `{ open, close }`
  - `PUT /v1/fleet/daily-log/:date/boats/:boat_id/issues`: `{ [item_id]: qty | null }`
  - `POST|PUT|DELETE /v1/fleet/daily-log/:date/boats/:boat_id/extras[/:extra_id]`: `{ name, qty, unit }`
  - `POST|PUT|DELETE /v1/fleet/daily-log/:date/piers/:pier/requests[/:request_id]`: `{ name, pax, fuel, price, engine_hours, water_open, water_close, issues }`
  - `PUT /v1/fleet/daily-log/:date/fuel-prices`: `{ [pierOrBoatId]: price | null }`
  - `POST /v1/fleet/daily-log/:date/piers/:pier/lock|unlock`
- Safety & Budgets:
  - `POST|PATCH /v1/fleet/safety[/:id]`, `POST|PATCH|DELETE /v1/fleet/safety/:id/inspections[/:insp_id]`
  - `POST /v1/fleet/safety/:id/replace`: `{ reason, description?, date, source: 'inventory'|'buy', item_id?, warehouse?, brand?, model?, supplier?, price?, serial?, install_date?, installer?, labour?, incident_no, job_no, memo_no?, expiry_date?, allow_negative?, serial_anyway? }`
  - `PUT /v1/fleet/fuel-budgets/:month`: `{ amount: number | null }`

### Verification

- `node --check allotment_v2/js/ops/26-ops-fleet-daily.js` — passed
- `node --check test/unit/ops-fleet-daily.test.mjs` — passed
- `node --test test/unit/ops-fleet-daily.test.mjs` — 3/3 passed
- `git diff --check` — passed
