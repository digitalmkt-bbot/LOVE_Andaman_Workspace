# S5 — Markets and salespeople (operation-backend), partial

Status: implemented for markets and salespeople CRUD + market reorder. Sales targets, followups and the Sales Board read are NOT implemented (blocked, see below).

## Evidence (read before coding)
- Backend: `D:/projects/operation-backend/src/routes/sales-editing.ts` lines ~416-560 (`/v1/sales*`, `/v1/markets*`); `src/domain/team.ts` `parseSalesFields`, `planSalesCreate`, `planSalesPatch`, `planMarketCreate`, `planMarketPatch`, `planMarketOrder`, `assertMarketDeletable`, `assertSalesDeletable`.
- Legacy entry points in `allotment_v2/js/08-app.js`: `tmSaveModal` (sales and market branches, ~line 45580), `tmDeleteMarket` (~45397), `tmDeleteSales` (~45367), `renderTeamMkt`; `tmApplyMarketOrder` in `04-data-core.js` (~10791). Modal state globals: `_tmModalType`, `_tmModalEditId`, `_tmModalDraft`.
- Reads were already projected by `10-ops-catalogue.js` (`/v1/markets`, `/v1/sales` into `SB_MARKETS` / `SB_SALES`).

## Endpoints wired
| Legacy action | Request |
|---|---|
| `tmSaveModal`, market add | `POST /v1/markets` `{id,name,color,subs}` |
| `tmSaveModal`, market edit | `PATCH /v1/markets/:id` `{name,color,subs}` |
| `tmDeleteMarket` | `DELETE /v1/markets/:id` (server refuses while agents are in it) |
| `tmApplyMarketOrder(ids)` | `PUT /v1/markets/order` `{ids}` |
| `tmSaveModal`, sales add | `POST /v1/sales` `{code,name,full_name,designation,email,tel,color,signature?,active}` (no `id`) |
| `tmSaveModal`, sales edit | `PATCH /v1/sales/:id` (same fields) |
| `tmDeleteSales` | `DELETE /v1/sales/:id` (409 while logins or rate types use the person) |

Legacy `sbMarketsPersist` / `sbSalesPersist` are no-ops in ops mode.

## Projection
Each response replaces only its row. Market reorder replaces the list from the `markets` array in the response. A salesperson's signature is kept locally when a response omits it. After a salesperson delete succeeds, agents bound to that person get `sales = null` locally (the server does the same).

## Blocked (S5 remainder)
- `PUT /v1/sales/:id/targets/:month`, `PUT /v1/sales/:id/followups`, `GET /v1/sales-board`: the legacy functions (`sbEditTarget` and the board/followup UI) and their bodies were not mapped in this packet. Required evidence: legacy writer functions and their payloads, plus the parser in `src/domain/sales-board.ts`.

## Files
- `allotment_v2/js/ops/27-ops-sales-board.js` (new; the spec's `20-` name is taken by `20-ops-deployments.js`)
- `allotment_v2/allotment_v2.html` (one tag)
- `test/unit/ops-sales-markets.test.mjs`

## Tests
- `node --test test/unit/ops-sales-markets.test.mjs`: 10/10 pass (mappers; market create no local change before answer; refused save keeps list and modal; edit never sends id; reorder; delete; salesperson create without id; signature kept; delete unassigns agents only after answer; blob writers no-op; legacy mode delegates with no request).

## Confirmation
No backend, DB, schema, migration, mapping JSON, or SQL change.
