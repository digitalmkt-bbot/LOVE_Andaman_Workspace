# os-backend — blob ⇄ operation_schemas adapter (option 1)

Stands up a small Express backend that becomes the data layer **without rewriting the
client**. It stores data in the real relational schema `operation_schemas` (103 tables)
but exposes the same whole-`app_state` object the client already speaks, via a
reversible mapping engine.

## Layout
```
src/mapping/os_repo.js        core engine: assembleBlob() / decomposeBlob() (pure, DB-independent)
src/mapping/field_mapping.json source of truth for the transform (1,397 cols, 103 tables)
src/mapping/operation_schemas_model.json   table→columns/types
src/relationalStore.js        relational backend (read=assemble, write=decompose in one txn)
src/blobStore.js              legacy blob backend (public.app_state.data) — default
src/db.js / src/config.js     pg pool + env config (sets search_path = operation_schemas, public)
src/app.js / src/server.js    Express: GET/PUT /api/state, GET /api/events (SSE), /api/health
test/roundtrip.test.js        offline synthetic round-trip (node --test, no DB)
scripts/roundtrip_staging.js  real-data round-trip against staging (read-only)
```

## Env (`.env`, never commit real creds)
```
DATABASE_URL=postgresql://…            # STAGING only — you set this
DB_SCHEMA=operation_schemas
DATA_BACKEND=blob                      # blob (default) | relational
PORT=3000
# APP_STATE_ID=main                    # id of the legacy public.app_state row (blob backend)
```

## Run
```
npm install
npm test                 # offline engine round-trip (no DB) — must pass
npm start                # starts the server on $PORT
```

## Feature flag
- `DATA_BACKEND=blob` (default) → reads/writes `public.app_state.data` (unchanged behavior).
- `DATA_BACKEND=relational` → read = `assembleBlob(SELECT * FROM operation_schemas.*)`,
  write = `decomposeBlob(payload)` then DELETE+INSERT all tables in **one transaction**.

## Endpoints
- `GET  /api/state`  → the full app_state object (from whichever backend the flag selects).
- `PUT  /api/state`  → accept the app_state object, persist it.
- `GET  /api/events` → SSE (real-time contract preserved); emits on each PUT.
- `GET  /api/health`, `GET /api/_rowcounts` (relational diagnostics).

## Validate on staging (before wiring the client)
```
DATABASE_URL=<staging> node scripts/roundtrip_staging.js
```
Checks per-table row-count parity + re-assemble stability, read-only.

## Safety (enforced)
- Works only against `DATABASE_URL` you set in env; **no credentials in code**.
- Touches only `operation_schemas`. Never modifies the other ~142 `public` tables.
- Never drops/alters `public.app_state` (legacy client still uses it).
- `blob` stays the default until staging round-trip passes.

## Known item to verify on staging
`fleet_daily__trips` is a deeply nested map-in-map-in-map that the normalizer flattened
with per-boat column prefixes (e.g. `engines_e6` belongs to `b2`). The generic engine
handles every other table cleanly; this one may show a row-count diff on the staging
round-trip and, if so, needs a small table-specific handler. All core business tables
(bookings, agents, invoices, boats, routes, fleet_*, seat locks, …) round-trip cleanly.

## Next step (later phase)
Point the client's load/save at `GET/PUT /api/state` (or keep its diff endpoints and add a
thin translation) — only after the staging round-trip passes and `DATA_BACKEND=relational`
is verified.
