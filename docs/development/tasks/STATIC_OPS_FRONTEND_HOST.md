# Static operation-backend frontend host

## Outcome

`integration/operation-backend` no longer starts `server.js` on Railway. Both `npm start` and
`railway.json` start `static-server.js`, a deliberately small static host for the staff frontend.

## Boundary

The host serves frontend files, redirects `/` to the app, and exposes `/health`. It deliberately
does **not** implement the legacy database, migrations, `/api/*`, API proxy, OIDC, or embed-token
routes. Moved UI functionality must call operation-backend directly.

## Verification

- `node --check static-server.js`
- Local smoke: `/health` returns 200, `/` redirects to the app, the app and dashboard adapter are
  served, and `/api/load` returns 404.

## Rollback

Restore the Railway/package start command to `node server.js`.
