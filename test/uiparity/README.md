# UI parity check · legacy vs the new frontend

`run.mjs` opens **every sidebar page and every toggle on it** in two apps at once, with the same data, and compares
what each shows:

| side | what runs | data |
|---|---|---|
| legacy | `server.js` from a checkout of `origin/lk-inbox` (`DATA_BACKEND=relational`, as production) | local DB `legacy_ui` |
| new | this branch's `allotment_v2/` (static) → a local operation-backend (`src/server.ts`) | local DB `operations_ui` |

For each page × toggle state it records the visible text, the row and card counts, the buttons, the console errors,
the failed API calls, the writes a toggle sent and any `alert/confirm` it raised. Then it compares the two and
sorts each difference by where the fix probably belongs: a missing endpoint or field (operation-backend work), a
JS error or a missing control (frontend wiring or a not-yet-synced lk-inbox feature), or numbers that differ on an
identical layout (the server's computation, or the import).

The other UI tests in `test/ui/` each check one feature on one app. This one compares the two apps screen by screen.

## Set up once

Both databases are **local copies** of the ones the operation-backend parity pipeline (`npm run pipeline:parity`)
leaves in its Docker PostgreSQL (`localhost:55433`): `legacy` (legacy's data) and `operations` (the cutover import of it).
The copies keep the pipeline's own databases untouched, and they absorb the few writes a toggle can make.

```bash
P="docker exec operation-backend-db-1 psql -U postgres -tA"
$P -c "CREATE DATABASE legacy_ui TEMPLATE legacy"          # ~3 min each
$P -c "CREATE DATABASE operations_ui TEMPLATE operations"
# one login on both sides: uiparity / uiparity (same scrypt format on both)
H=$(node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');console.log(s+':'+c.scryptSync('uiparity',s,32).toString('hex'))")
$P -d legacy_ui -c "INSERT INTO operation_schemas.users(username,pass_hash,name,role,can_edit) VALUES('uiparity','$H','UI Parity','admin',true)"
$P -d operations_ui -c "INSERT INTO users(username,pass_hash,name,role,can_edit) VALUES('uiparity','$H','UI Parity','admin',true)"

git worktree add --detach ../wt-uip-legacy origin/lk-inbox && (cd ../wt-uip-legacy && npm ci)
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci                   # this checkout · uses the installed Chrome
```

operation-backend needs its `node_modules` (`npm ci` in its checkout).

## Run

```bash
OPS_BACKEND_DIR=D:/projects/operation-backend LEGACY_DIR=D:/projects/wt-uip-legacy node test/uiparity/run.mjs
#   --views=dashboard,agents   only these pages     --workers=2   app pairs in parallel (default 2)
#   --max-toggles=15  --max-dialogs=5  --no-dialogs  --out=<dir>
node test/uiparity/inventory.mjs test/uiparity/out/<run> > docs/ui-parity/inventory.md
```

A full run takes about 40 minutes with 2 workers. The output goes to `test/uiparity/out/<time>/` (gitignored):
`report.md`, `compare.json` (every state, with the differing lines), `states.json` (everything recorded),
`inventory.json`, and the two servers' logs.

**Safety.** It refuses any database URL that is not localhost. Both servers start with a clean environment (only
PATH-like variables), so a shell's `DATABASE_URL`, `B2C_*` or `API_PROXY_URL` cannot reach them. The new frontend's
calls to the production backend URL are routed to the local one, as `test/ui/t_ops.mjs` does.

## What it clicks, and what it does not

- **Toggles:** visible `[onclick]` elements in the open page that look like a tab, chip, pill, segment, filter or
  mode switch (by class, `role=tab`, or a group of siblings where one is `active`/`on`/`sel`). It skips anything
  whose handler name looks like a write (`save`, `delete`, `confirm`, `assign`, `lock`, `pay`, `add…`, `edit…`, …)
  and multi-line cards (list items).
- **Selects:** up to 4 per page, 2 other options each. **Checkboxes:** up to 5 per page.
- **Dialogs:** buttons whose handler is `open…`/`show…`/`…Modal`/`…Detail`/`…Sheet` etc. (not `…Edit`/`…Form`):
  it opens one, records it, then closes it (Escape, then a ×/ปิด/ยกเลิก button).
- Every state starts from the page freshly opened (`nav()` again), on both sides.
- `alert/confirm/prompt` are dismissed, never accepted.

A control is found again on the new side by `label|handler`, with digits replaced by `#`, so a count that
differs ("ต้องจัดการ 6" vs "1") does not hide it. Two controls whose labels differ only by a number share a key, and
only the first is clicked.

## Reading the verdicts

- `same` · the text, rows, buttons, errors and calls match.
- `numbers` · the same lines with other numbers: the layout is wired, the data or the server's computation differs.
  Check the data parity report (`pipeline:parity`) before blaming the screen.
- `differs` · lines, rows, buttons or dialogs differ, or the new side has errors or failed calls.

The kind column is a first guess from the evidence (a 404 is a missing endpoint, a JS error is wiring). The
hand-checked list is in `docs/ui-parity/`.

## Rule replay, method B (`replay-live.mjs`, check 3)

operation-backend's `cutover-replay` (check 3, method A) compares our rules with the answers legacy **stored**. For an
answer legacy only computes on screen, and as the arbiter when a stored answer differs, `replay-live.mjs` runs
**legacy's own functions in the legacy page** and compares them with this backend's API for the same case:

| rule | legacy (in the page) | ours |
|---|---|---|
| `seats` | `getAllotment(route, date)`: seat pool, booked, locked, seats left | `GET /v1/availability?from&to`, every route-day |
| `booking-price-live`, `trip-price-live` | `bkV2CalcQuote` / `bkV2TripSubtotal` on each stored booking, prepared as `bkV2EditBooking` does (§rtKeep), without opening the form | the figures `cutover-replay --json` priced with `priceBooking` |

```bash
# in operation-backend: the method-A cases as JSON
DATABASE_URL=…/operations ORIGINAL_DATABASE_URL=…/legacy node --import tsx src/tools/cutover-replay.ts --json=cases.json
# here (own copies of legacy / operations with the uiparity login, as above; ports 3931/3932 by default)
LEGACY_DIR=<origin/lk-inbox checkout> OPS_BACKEND_DIR=<operation-backend> LEGACY_DB=…/<legacy copy> OPS_DB=…/<operations copy> \
  node test/uiparity/replay-live.mjs --cases=cases.json [--rules=seats,booking-price] [--from= --to=] [--out=<dir>]
```

It writes `replay-live.md` / `replay-live.json` and exits 1 when a case differs. A booking-price case where legacy
**today** equals ours but its stored figure does not is legacy's own drift (the rate changed after the save): it goes in
operation-backend `todo/parity-accepted.md`. Legacy's page sends 2 `_batch` writes while it boots (its own sweeps): use a copy.

Result 2026-11-27 (local data of 2026-11-26): seats 5,551 route-days 2026-10-28..2027-01-26, 5,548 same, 3 different
(a charter with no boat: fixed in operation-backend, `dayCapacity`); booking price 13,381 / 13,381 same; trip price
13,226 / 13,226 same.
