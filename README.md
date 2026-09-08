# LOVE Andaman — Allotment v2

Phuket marine-tourism operations app (bookings, fleet, transfers, accounting).
Front-end in `allotment_v2/` — `allotment_v2.html` (markup) plus `js/01..08-*.js` (all the app code) and `css/01-base.css` + `css/02-skins.css` — talking to a Node backend (`server.js`) backed by **Postgres — the durable source of truth**. The browser keeps a working copy of the current state in memory/`localStorage` for the UI to read, but every change is synced to Postgres; `localStorage` alone is not where the data lives. See `ARCHITECTURE.md` for the full data-flow write-up.

## Run locally
```bash
npm start          # serves on http://localhost:3000  → opens the app
```
Or open `allotment_v2/allotment_v2.html` via a local server (not file://).

## Deploy (Railway)
Railway auto-detects Node (Nixpacks) and runs `npm start` (`server.js`).

Set these variables in Railway → **Variables** to lock the public URL behind a login:
- `ADMIN_USER` — username
- `ADMIN_PASS` — password

(If unset, the app is open to anyone with the URL.)

### Authentik single sign-on (optional)

With these set, **Authentik becomes the login page**: opening the app unauthenticated redirects to
Authentik, and on success the browser lands in `allotment_v2/allotment_v2.html` already signed in —
the built-in username/password modal never appears. The whole authorization-code + PKCE flow runs
**server-side**. Leave them unset and the routes 404, the gate is off, and password login is
exactly as before. See `auth/oidc.js`.

- **Escape hatch:** `…/allotment_v2/allotment_v2.html?login=password` always serves the built-in
  form. Without it, a misconfigured or unreachable Authentik would lock out everyone — including the
  admin who has to fix it.
- **Signing out** ends the Authentik session too (`/auth/logout` → the provider's `end_session`
  endpoint). Clearing only the app's own cookie would be pointless: the next page load hits the gate,
  Authentik still holds its session, and the user is signed straight back in.

- `AUTH_OIDC_ISSUER` — e.g. `https://auth.example.com/application/o/<slug>/`
- `AUTH_OIDC_CLIENT_ID`
- `AUTH_OIDC_CLIENT_SECRET` — omit for a public client (PKCE still applies)
- `AUTH_OIDC_SCOPES` — default `openid profile email`
- `AUTH_OIDC_REDIRECT_URI` — override; normally derived from the request host as `<origin>/auth/callback`
- `AUTH_OIDC_AUTOCREATE` — `off` (default) or `full`

In Authentik, the provider's redirect URI must be `https://<your-host>/auth/callback`.

⚠ `AUTH_OIDC_AUTOCREATE=full` provisions any unknown Authentik user as a **full-access admin** on
first sign-in (`perms` NULL and `edit_areas` NULL both mean "no restriction"; role `admin` opens user
management and the System Log). It exists for testing on a deployment where you control who
Authentik admits. Left `off`, an Authentik user with no row in the app's `users` table is refused
with a message saying so.

### Switching `/api` to the new backend

`allotment_v2` has no API base URL to change — every call is a hardcoded same-origin absolute path
(`/api/load`, `/api/save`, `/api/v1/_batch`, `/api/me`, …, mostly in
`allotment_v2/js/01-auth-sync.js`), and it is classic `<script src>` files, so the Vite
`VITE_API_BASE_URL` never reaches it. The switch is therefore server-side, in `api-proxy.js`.

- `API_PROXY_URL` — target origin, e.g. `https://operationbackend-production.up.railway.app`.
  **Unset = nothing changes at all.**
- `API_PROXY_ROUTES` — comma-separated path prefixes to send upstream, e.g.
  `/api/v1/rate-types,/api/agents`. Default `*` = every `/api` route.
- `API_PROXY_TIMEOUT_MS` — default `30000`.

Proxying, rather than pointing the client at another origin, keeps every request same-origin: the
existing `SameSite=Lax` session cookie keeps working and no CORS setup is needed. Only `/api` paths
are ever proxied — the app HTML, the js/css files and `/auth/*` cannot be, by construction.

⚠ **`API_PROXY_ROUTES` is the point.** Move routes across one at a time, as the new backend
implements them; anything unlisted is still served by `server.js` from the same database. Setting
only `API_PROXY_URL` sends **everything** upstream — including `/api/login` and `/api/load` — so if
the target does not implement them yet, the app is down.

## Data
- No customer data is stored in this repo. Postgres (via `server.js`) is the durable store; each browser's `localStorage`/in-memory copy is a working cache, not the source of truth.
- Use the in-app **💾 Backup** button to export/import data between machines.
- `allotment_v2/data_exports/` and `allotment_v2/BACKUP/` are git-ignored (contain real data / large backups).
