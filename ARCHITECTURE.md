# Architecture

This file is a pointer, not a duplicate. The real architecture and per-domain design docs live in:

```
allotment_v2/docs/workflows/
```

Start with `allotment_v2/docs/workflows/README.md` — it lists all eight domain docs (booking
lifecycle, sales/agents/pricing, boat operations, transfer/vans/pickup, fleet management,
accounting/finance, data persistence & API, shell/dashboards/config) and tells you which one to
read for which kind of task.

There is no `CHANGELOG.md` in this repo — despite `CLAUDE.md` referencing one historically, it was
never tracked in git (`git log --all -- CHANGELOG.md` returns nothing). The workflow docs above are
the closest thing to a durable design record; grep the relevant doc instead of looking for a
changelog.

## The system in one paragraph

`allotment_v2/allotment_v2.html` (~228KB of markup) plus `allotment_v2/js/01..08-*.js` (~6.2MB,
where all the code lives) and `allotment_v2/css/{01-base,02-skins}.css` (~295KB) is the front end;
it talks to `server.js` (Node, no framework) over a REST API. Until 2026-08-27 that was one 6.7MB
HTML file with the JS and CSS inline — the two splits moved the bytes and nothing else. The eight files are **classic scripts loaded in order**, so they still
share one global scope exactly as the inline blocks did; `allotment_v2/js/README.md` explains why
`defer` / `async` / `type="module"` must never be added to those tags. **Postgres is the durable
source of truth** — `server.js` reads and writes an `operation_schemas` schema (~103 tables) via a
mapping layer in `os-backend/`. The browser keeps a working copy of the current state in memory and
in `localStorage` under the key `loveandaman_v2`, seeded from the `DEFAULT_*` constants in
`js/04-data-core.js` / `js/05-fleet.js` on first run and refreshed from the server on login; every
change the user makes is diffed and synced back to Postgres. `localStorage` is a
working cache for the UI, not the store of record — see
`allotment_v2/docs/workflows/07-data-persistence-api.md` §1 for the full three-layer breakdown
(Postgres / RAM / localStorage) and §4 for the four-registration checklist a new persisted field
needs.

## Running it locally

- **Full stack, with the backend:** `npm start` (`node server.js`) — needs a `DATABASE_URL` to
  reach Postgres; without one, login and cloud sync are disabled (the server still serves the
  static app). Set `ADMIN_USER` / `ADMIN_PASS` to seed an admin login (see `server.js:19-20` and
  `README.md`).
- **Static-only, no backend:** `allotment_v2/start_server.command` starts a plain static file
  server on `http://localhost:8765` (`ruby -run -e httpd`, falling back to `python3 -m
  http.server`). It serves **no `/api`** — there is no login and no sync to Postgres from this
  path. Use it only for pure front-end/UI work; see
  `allotment_v2/docs/workflows/07-data-persistence-api.md` §2.1 for the degraded-mode path this
  triggers in the client.

## Known drift worth knowing about

- `db/migrations/` (referenced by `tools/apply-migration.js`'s header example,
  `db/migrations/003_v_seat_availability.sql`) is absent from this tree — a fresh database cannot be
  provisioned from migrations in this repo as-is; `database_migration/operation_schemas_structure.sql`
  is the current DDL snapshot instead.
- `allotment_v2/docs/workflows/07-data-persistence-api.md` §10 keeps a running "Documentation drift
  found" table (README.md / SYSTEM_MAP.md / CLAUDE.md / HANDOFF claims vs. what the code actually
  does) — check it before trusting a claim in an older doc.

## Companion docs

- `CLAUDE.md` — cowork context file for the `allotment_v2` module (safety rules, schema reference,
  gotchas).
- `SYSTEM_MAP.md` — AI-readable architecture map.
- `BACKLOG.md` / `allotment_v2/docs/MODERNIZATION_BACKLOG.md` — pending work.
- `OPERATIONS_PIPELINE_DESIGN.md` — van-assign/grouping spec.
