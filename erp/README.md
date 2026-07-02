# ERP Loveandaman — API + web (dev)

Express API over the Postgres `operation_schemas` schema, serving a plain static HTML front
(no framework, no build step). Deployed on Railway (ERP-Loveandaman / dev).

## Layout
- `server.js` — Express API. Connects as the scoped `erp_api` role (SELECT + EXECUTE only).
  Reads via `SELECT`; writes only through vetted `SECURITY DEFINER` RPCs (e.g. `draw_seat`).
- `public/` — static `index.html` (vanilla JS), served by `server.js`.

## Endpoints
- `GET  /api/health`
- `GET  /api/bookings` — first 50 (no pagination yet)
- `POST /api/seat-locks/:id/draw` `{qty}` — concurrency-safe seat draw; oversell → 409

## Run locally
```
npm install
DATABASE_URL=postgresql://erp_api:...@host:port/railway npm start
```

## Deploy
Railway builds this dir (Root Directory `erp`): `npm install` → `npm start`. No build step.
Set `DATABASE_URL` in the service (points at the `Postgres` service, `erp_api` role).
