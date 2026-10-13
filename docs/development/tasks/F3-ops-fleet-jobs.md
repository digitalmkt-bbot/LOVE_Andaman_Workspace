# F3 — Incidents and maintenance jobs (`24-ops-fleet-jobs.js`)

## Input contract

- **Requested outcome:** Migrate incidents (`FL_INCIDENTS`) and maintenance jobs (`FL_MAINT`) to `operation-backend` in operations mode, inspecting `src/routes/fleet.ts` and `src/domain/fleet-jobs.ts` first for exact payload contracts.
- **Acceptance criteria:**
  - Hydrate `FL_INCIDENTS` and `FL_MAINT` from `/v1/fleet/incidents` and `/v1/fleet/jobs`.
  - Preserve `boatStatus || (setFixing === false ? 'available' : 'fixing')` behavior.
  - Replace/refetch affected incident/job plus dependent boat/assets after commands.

## Output contract

### Backend files inspected (inspect-first evidence)

- `D:/projects/operation-backend/src/routes/fleet.ts`
- `D:/projects/operation-backend/src/domain/fleet-jobs.ts`
- `D:/projects/operation-backend/test/fleet.test.ts`

### Inspected payload contracts

- `POST /v1/fleet/incidents`: `{ no, boat_id, date, time?, title, detail?, remark?, cause?, quick_fix?, priority?, damaged_assets: [{ type, asset_id } | { type: 'hull', label }] }`
- `PATCH /v1/fleet/incidents/:id`: `{ no?, boat_id?, date?, time?, title?, detail?, remark?, priority?, damaged_assets? }`
- `POST /v1/fleet/incidents/:id/log`: `{ text, by? }`
- `POST /v1/fleet/incidents/:id/swap`: `{ asset_type: 'gearbox'|'propeller', asset_id, spare_id, propellers?: [{ id, action: 'keep'|'stock'|'repair', location? }] }`
- `POST /v1/fleet/jobs`: `{ no?, nos?, per_asset?, create_anyway?, boat_id, title, type, detail?, location?, start_date?, incident_id?, boat_status?, boat_status_reason?, parent_project_id?, assets? }`
- `POST /v1/fleet/jobs/:id/start`: `{ gear?: 'keep'|'stash'|'swap', stash_location? }`
- `POST /v1/fleet/jobs/:id/close`: `{ outcome, note, awaiting_invoice?, reset_service? }`
- `POST /v1/fleet/jobs/:id/boat-status`: `{ status, effective_date, reason?, note? }`
- `POST /v1/fleet/jobs/:id/assets`: `{ type, asset_id?, label?, detail? }`, `DELETE /v1/fleet/jobs/:id/assets/:idx`
- `POST /v1/fleet/jobs/:id/log`: `{ text, by?, date? }`
- `POST /v1/fleet/jobs/:id/split`: `{ by: 'job_engines'|'boat_engines', nos: string[] }`
- `POST /v1/fleet/jobs/:id/steps`: `{ text }`, `POST .../steps/template`, `PATCH|DELETE .../steps/:idx`

### Verification

- `node --check allotment_v2/js/ops/24-ops-fleet-jobs.js` — passed
- `node --check test/unit/ops-fleet-jobs.test.mjs` — passed
- `node --test test/unit/ops-fleet-jobs.test.mjs` — 3/3 passed
- `cd D:/projects/operation-backend && node --import tsx --import ./test/setup.ts --test test/fleet.test.ts` — passed
- `git diff --check` — passed
