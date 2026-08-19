# LOVE Andaman — Allotment v2

Phuket marine-tourism operations app (bookings, fleet, transfers, accounting).
Single-file front-end (`allotment_v2/allotment_v2.html`) talking to a Node backend (`server.js`) backed by **Postgres — the durable source of truth**. The browser keeps a working copy of the current state in memory/`localStorage` for the UI to read, but every change is synced to Postgres; `localStorage` alone is not where the data lives. See `ARCHITECTURE.md` for the full data-flow write-up.

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

## Data
- No customer data is stored in this repo. Postgres (via `server.js`) is the durable store; each browser's `localStorage`/in-memory copy is a working cache, not the source of truth.
- Use the in-app **💾 Backup** button to export/import data between machines.
- `allotment_v2/data_exports/` and `allotment_v2/BACKUP/` are git-ignored (contain real data / large backups).
