# LOVE Andaman — Allotment v2

Phuket marine-tourism operations app (bookings, fleet, transfers, accounting).
Single-file front-end (`allotment_v2/allotment_v2.html`) — all runtime data lives in the browser's `localStorage`.

## Run locally
```bash
npm start          # serves on http://localhost:3000  → opens the app
```
Or open `allotment_v2/allotment_v2.html` via a local server (not file://).

## Deploy (Railway)
Railway auto-detects Node (Nixpacks) and runs `npm start` (`server.js`).

Set these variables in Railway → **Variables** to lock the public URL behind a login:
- `APP_USER` — username
- `APP_PASS` — password

(If unset, the app is open to anyone with the URL.)

## Data
- No customer data is stored in this repo. Each browser keeps its own data in `localStorage`.
- Use the in-app **💾 Backup** button to export/import data between machines.
- `allotment_v2/data_exports/` and `allotment_v2/BACKUP/` are git-ignored (contain real data / large backups).
