# ERP Loveandaman — API + web (dev)

Vue (Vite) SPA served by an Express API over the Postgres `operation_schemas` schema.
Deployed on Railway (ERP-Loveandaman / dev).

## Layout
- `server.js` — Express API. Connects as the scoped `erp_api` role (SELECT + EXECUTE only).
  Reads via `SELECT`; writes only through vetted `SECURITY DEFINER` RPCs (e.g. `draw_seat`).
- `web/` — Vite Vue app, built to `web/dist` and served by `server.js`.

## Endpoints
- `GET  /api/health`
- `GET  /api/bookings` — first 50 (no pagination yet)
- `POST /api/seat-locks/:id/draw` `{qty}` — concurrency-safe seat draw; oversell → 409

## Run locally
```
npm install
npm run build                 # builds web/dist
DATABASE_URL=postgresql://erp_api:...@host:port/railway npm start
# dev with hot reload: cd web && npm run dev  (proxies /api to :3000)
```

## Deploy
Railway builds this repo: `npm install` → `npm run build` → `npm start`.
Set `DATABASE_URL` in the service (points at the `Postgres` service, `erp_api` role).
