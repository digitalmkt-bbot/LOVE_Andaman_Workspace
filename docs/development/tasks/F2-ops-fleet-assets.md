# F2 — Drivetrain assets adapter (`23-ops-fleet-assets.js`)

## Input contract

- **Requested outcome:** Migrate engines (`FL_ENGINES`), gearboxes (`FL_GEARBOXES`), and propellers (`FL_PROPELLERS`) to `operation-backend` in operations mode using dedicated commands (`install`, `remove`, `move`, `status`, `swap`, `service`) instead of raw link-field PATCH.
- **Acceptance criteria:**
  - Hydrate and refetch the engine → gearbox → propeller chain from `/v1/fleet/engines`, `/v1/fleet/gearboxes`, and `/v1/fleet/propellers`.
  - Normalize `Starboard` / `Stbd` positions to `Std`.
  - Never PATCH server-owned link fields, computed hours, logs, or service baselines.

## Output contract

### Backend files inspected

- `D:/projects/operation-backend/src/routes/fleet.ts`
- `D:/projects/operation-backend/src/domain/fleet-assets.ts`
- `D:/projects/operation-backend/test/fleet.test.ts`

### Endpoints exercised

| Method | Path | Body |
|---|---|---|
| `GET` | `/v1/fleet/engines`, `/v1/fleet/gearboxes`, `/v1/fleet/propellers` | optional `?boat_id=` |
| `GET` | `/v1/fleet/:family/:id` | none |
| `POST` | `/v1/fleet/:family` | client facts + initial links/status |
| `PATCH` | `/v1/fleet/:family/:id` | client facts only |
| `POST` | `/v1/fleet/engines/:id/install` | `{ boat_id, pos, job_id? }` |
| `POST` | `/v1/fleet/gearboxes/:id/install` | `{ engine_id }` |
| `POST` | `/v1/fleet/propellers/:id/install` | `{ gearbox_id, prop_pos? }` |
| `POST` | `/v1/fleet/:family/:id/status` | `{ status, note? }` |
| `POST` | `/v1/fleet/:family/:id/remove` | `{ spare_location?, note? }` |
| `POST` | `/v1/fleet/gearboxes\|propellers/:id/move` | `{ spare_location, note? }` |
| `POST` | `/v1/fleet/:family/:id/swap` | `{ with_id }` |
| `POST` | `/v1/fleet/engines\|gearboxes/:id/service` | `{ hours }` |

### Verification

- `node --check allotment_v2/js/ops/23-ops-fleet-assets.js` — passed
- `node --check test/unit/ops-fleet-assets.test.mjs` — passed
- `node --test test/unit/ops-fleet-assets.test.mjs` — 3/3 passed
- `cd D:/projects/operation-backend && node --import tsx --import ./test/setup.ts --test test/fleet.test.ts` — passed
- `git diff --check` — passed
