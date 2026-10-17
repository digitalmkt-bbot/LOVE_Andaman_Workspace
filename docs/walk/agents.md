# Walk report: AGENTS, CONTRACTS, RATE TYPES, USERS (branch walk/agents)

Test: `node test/ui/t_walk_agents.mjs` (about 55 s, 70 checks, all pass). Real UI against a real seeded backend;
every check reads the screen and asks the server directly. `ONLY=3,5` runs single items.

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Needs action rows + list KPI from server alerts | PASS | a01 `contract_rate_differs`, a no-rate agent `no_rate_bound`, a route-without-price agent `route_no_price`: each row on the agent page carries the server's message text; "Blocked" severity on the two blocked ones; popup counts and the "Needs action" chip equal the server's counts (3) |
| 2 | Agent Excel import | PASS after fix | sheet built in the page with SheetJS, `agImportFile`; preview from `POST /v1/agents/import dry_run:true` (sheet rows as typed); server `create`/`update`/`error` shown; Import sends `dry_run:false, select:[2,3]`; only those lines saved; the refused row (bad pay_type) is unticked. FIX: the refused row's server message was not drawn (see commits) |
| 3 | rtUnbindAgent | PASS | real click on the ✕ (after opening the folded "AGENTS" chips): `PUT /v1/agents/{id}/rate-type {rate_type_id:null}`, server null + `no_rate_bound` raised, still unbound after a page reload |
| 4 | Rate type add-ons, add-on types dialog, Active switch | PASS | dialog opens; 3 custom types created (`POST /v1/addon-types`), one deleted; save sent `PUT .../addons/{key}` per-pax `{adult:300,child:150,applies:[r5]}` and flat `{price:900}`; server holds both; switch off + save sent `DELETE .../addons/{key}`; Deactivate/Activate send `PATCH {active}` and the card follows |
| 5 | Contract documents | PASS after fix | Generate New opens the wizard, Export PDF posts `POST /v1/agents/a01/documents` (server stamps id gc_..., generated_by, activity "Contract generated"), history lists it, View/Edit reopens (GET `/v1/contract-documents/{id}`), ✕ sends `DELETE`. FIX: Generate New only alerted "No contract documents have been issued" |
| 6 | User window | PASS | server `wide` (red), `no_menus` (amber) and overview (`many_admins`) texts shown as sent; `nav_pages`: GET then PUT once, before `GET /v1/users`, no repeat on later reads; rename through the dialog (`POST /v1/users/{id}/rename`, `previous_usernames` holds the old name); agent colour `PATCH {color}` and Alt reset `{color:null}` |
| 7 | Promo badge / bonus counter, agIncompleteFields | PASS | active / scheduled / void / expired promos show the server state's badge; counter = server `bonus_progress` (a real booking: sold 4, earned 2); `agIncompleteFields` on every list row = server `incomplete` (a01 shows no false "Contact" gap); list badge and "Incomplete profile" row match |

## Commits (branch walk/agents)
Fixes (each with its proving test):
- `fix(ops): agent import dry run redraws through the wrapped render so a refused row shows the server's message` (ops/16-ops-agents.js)
- `fix(ops): Generate New / View-Edit open the contract wizard again (ctDocOpen no longer swapped for the read-only viewer)` (ops/18-ops-contracts.js)

Tests: `test(walk): agents walk scaffold + item 1`, `item 3`, `item 4`, `item 6`; items 2, 5, 7 ride in the fix commits / the last test commit.
Harness: `test/helpers/ops-backend-local.mjs` seeds a second rate type (rt002) and a live MAIN contract for a01 naming it, ONLY when
`WALK_AGENTS=1` (set by the new test), so t_ops is unchanged. The backend needs this because the API creates no main contract.

## Needs the developer's decision (reported, not changed)
1. Refused import row: the server says `error`, but the legacy badge on that row still reads "มีแล้ว · ไม่มีอะไรเปลี่ยน" (the screen files it as action update with no writes) next to the red server message. The message is now shown and the row is unticked; whether to hide the legacy badge is a screen decision.
2. The ops wrapper `rtAddonTypeDelete` confirm still says "Existing prices in rate types are kept but hidden"; the server now refuses (409 in_use) instead (people-and-catalogue.md section 3 notes it).
3. The two ✕ unbind buttons on the Rate Types screen sit inside a folded "AGENTS · N (click to show / hide)" block; works, just not visible until opened.
4. `window.print()` cannot be answered in a headless run, so the test fires `afterprint` itself; the app's own print flow then records the document. The native dialog was not exercised.
