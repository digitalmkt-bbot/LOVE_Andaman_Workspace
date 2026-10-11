# Operation-backend frontend migration — Luna execution plan

## Objective

Replace `allotment_v2` browser-local/legacy-blob persistence with the existing `operation_backend` `/v1` API without changing the classic-script UI or the backend contract. The target is the static `integration/operation-backend` frontend plus `operationbackend-production`.

This is **frontend integration only**. Do not add migrations, alter schema or mappings, run DDL, or modify `operation_backend` routes/schema. The database-change freeze is in effect through 2026-10-15.

## Non-negotiable safety rules

1. Do not add `defer`, `async`, or `type="module"` to any `allotment_v2` script tag; keep classic global-script ordering.
2. Use `window.laOpsFetch()` or the existing `window.LA_OPS` client. Never call `fetch()` directly for an operation-backend endpoint.
3. A successful mutation must update the in-memory globals/UI **only after** a successful API response. Do not make localStorage the source of truth.
4. On load, API data is authoritative. Browser localStorage may be a non-authoritative cache only where explicitly needed for transient UI state.
5. Preserve existing permissions. Route/API failures must visibly surface in English/ASCII console/alert text and must not silently claim a save succeeded.
6. Preserve legacy mode: integrations must activate only when `window.LA_LEGACY_UNAVAILABLE` / the operations API mode is active. Do not regress a real `lk-inbox` legacy session.
7. Follow backend request/response contracts in `D:/projects/operation-backend/src/routes/`; do not invent payload fields.
8. Do not touch unrelated user files, `HANDOFF_PARITY_TESTING.md`, or `parity-testing-flowchart.html`.
9. Before committing: `node --check` every touched JS file; run focused tests; no conflict markers; no `bkV2` identifiers in HTML/top-level JS.
10. Do not push `lk-inbox`. Do not push any branch unless explicitly asked.

## Shared implementation contract

- New adapters belong in `allotment_v2/js/ops/`; add a single explicit classic script tag in `allotment_v2/allotment_v2.html` only when a new adapter is needed. The adapter, its tag, and its focused test are the worker's frontend ownership.
- `01-auth-sync.js` supplies the Bearer token and `laOpsFetch`; `00-ops-core.js` supplies serialized server-first writes, rollback utilities, and booking `If-Match` handling. Reuse them.
- Activate wrappers/loaders only in operations mode (`LA_LEGACY_UNAVAILABLE` and an authenticated ops client). In legacy mode leave the original function and legacy persistence unchanged.
- For booking paths use `bk.opsId`, `bk.opsVersion`, and trip `opsTripId`, not legacy ids. Refresh/replace server-returned entities after commands with server side effects.
- The shared files `08-app.js`, `05-fleet.js`, `40-ops-bookings.js`, `90-ops-boot.js`, and the HTML script list require coordinator serialization. A worker must not edit one without reserving it in the handoff. Do not make two workers edit the same legacy renderer concurrently.
- Backend paths below are **read-only contract references**, not worker-owned edit targets. “Backend files” means the exact source to inspect and test against; editing it is out of scope.
- Any endpoint literal, request body, response shape, UI entry point, or reconciliation rule labelled **BLOCKED** was not verified in the audits. Do discovery first and update this plan/handoff with source evidence; do not guess or implement it.

## Dependency and order table

| Order | Packet(s) | Depends on | Shared-file / gate |
|---|---|---|---|
| 0 | P0 | none | Preserve `01-auth-sync.js`, `00-ops-core.js`, load order; run existing ops smoke test. |
| 1 | S6, C1, O6 | P0 | Already-wired staff/catalogue/auth regressions; no new domain migration until these pass. |
| 2 | S1–S5, C2 | P0 | Sales adapters and pickup are isolated new `js/ops` files; script-tag additions serialized. |
| 3 | F1–F5 | P0, C1 | Fleet workers serialize `05-fleet.js`; F1 mapping is prerequisite for boat-dependent F2/F3/F5. |
| 4 | M1, M2, M4 | P0, S1, S2 | M2 uses M1 invoice/payment UI; M4 is read-only and may run after its endpoint payload is confirmed. |
| 5 | O1, O3–O5, M3 | P0, booking adapter | Serialize edits to `40-ops-bookings.js` and `08-app.js`; M3 shares money routes with O1/O3. |
| 6 | O2, O4 | P0, C1, booking adapter | B2C reuses booking mapper; vans require verified trip-operation literals. |
| blocked | C3, O6 user UI portions, reconfirm/vans/pier-cash gaps | source discovery | No implementation assignment until the stated missing mapping is evidenced. |

## Packet index

`S` = Sales, `C` = catalogue/pickup, `F` = Fleet, `M` = money/finance, `O` = remaining operations. Each packet below is independently assignable only within its listed owned frontend files.

---

## P0 — Operations integration foundation/regression

- **Objective:** retain the established auth/core/boot contract while new adapters are added.
- **Owned frontend/backend files:** frontend test-only changes, if needed, under `test/ui/`; read-only contracts `allotment_v2/js/01-auth-sync.js`, `allotment_v2/js/ops/00-ops-core.js`, `90-ops-boot.js`, and `D:/projects/operation-backend/src/routes/operations.ts`. Do not edit auth/core/boot without coordinator approval.
- **Entry points/persistence:** `laOpsFetch`, `laOps.queue`, `laOps.bookingWrite`, and boot loaders; no new persistence.
- **Verified mapping:** login is `POST /v1/login`; authenticated calls carry Bearer token; a 401 clears token and reloads. Boot order is catalogue → staff → deployments → locks → booking hooks → availability.
- **Load/write/error/legacy:** existing adapters run only in ops mode; failed loaders are reported and their writers stay off. Preserve that behavior.
- **Tests/acceptance:** `npm run test:ops`; acceptance is staff/catalogue/deployment/locks/booking availability regression passes and no legacy-mode call is made.
- **Exclusions/coordination:** no auth protocol, script reorder, or direct fetch changes.

## Sales packets

### S1 — Agents

- **Objective:** hydrate and mutate Agents through `/v1/agents`, replacing `sb_agents` only in ops mode.
- **Owned files:** frontend new `js/ops/16-ops-agents.js`, its HTML tag, and agent-focused UI test; shared `08-app.js` only the reserved wrappers for `renderAgents`, `agNew`, `agEditOpen`, `agEditSave`, `agTbl*`. Backend references: `src/routes/sales-editing.ts`, `src/domain/agent-writes.ts`, `src/domain/agents.ts`.
- **Entry/persistence:** `renderAgents`, `agNew/agEditOpen/agEditSave`; `SB_AGENTS` ⇄ `sb_agents`; legacy persistence is `sbAgentsPersist()` and boot/refresh accepts `Array.isArray`.
- **Verified API mapping:** `GET /v1/agents?active=true|false|all&market=&sales=&q=` → `{agents:[AgentSummary]}`; detail `GET /v1/agents/:id` → Agent plus credit/history/template fields. `POST /v1/agents` → `201 Agent`, `PATCH /v1/agents/:id`, `PUT /:id/programs`, `PUT /:id/rate-type`, `PUT /:id/rate-seasons` → `{seasons}`, lifecycle `POST /:id/renew|activate|deactivate`, and unused-admin-only `DELETE` → `204`. Map legacy `market/sub/sales/payType/vatMode/creditDays/creditLimit/rateTypeId`, `companyInfo`, `agentSignatory`, `bookingChannel`, `programPeriods` to server snake/nested `market_id/sub_market/sales_id/pay_type/.../company/signatory/booking_channel/programs`; never flatten `companyInfo`.
- **Load/write/error/legacy:** server list/detail replaces projections after success; expose failures and refetch after lifecycle writes. In legacy mode retain `sbAgentsPersist()`. Salesperson scoping and server area authorization are authoritative.
- **Tests/acceptance:** `node --check allotment_v2/js/ops/16-ops-agents.js`; `cd D:/projects/operation-backend && npm test`; existing `npm run test:aginfo`, `npm run test:aghd`, `npm run test:ratebind` where affected. Acceptance: list/detail and one create/edit/lifecycle action use the documented API, failure does not persist locally.
- **Exclusions/coordination:** no rate-type UI mapping (S2), markets/salespeople (S5), contracts (S3), booking pricing (`40-ops-bookings.js`).

### S2 — Rate types and booking-price compatibility

- **Objective:** migrate Rate Type loading/writes without breaking the legacy shape consumed by booking quote functions.
- **Owned files:** new `js/ops/17-ops-rate-types.js`, tag, tests; reserved wrappers only for `rtOpenNew`, `rtOpenEdit`, `rtSaveDraft`, `rtPersist`, `rtAddonTypesOpen` in `08-app.js`. Backend references `src/routes/operations.ts`, `src/domain/rate-types.ts`.
- **Entry/persistence:** `SB_RATE_TYPES` ⇄ `sb_rate_types`; `rtPersist()` also writes `sb_agents_rate_bindings`; consumers are `bookingV2GetRT`, `bookingV2GetRTForTrip`, `bookingV2TripSubtotal`, `bookingV2AddOnInfo`, `bookingV2CalcQuote`.
- **Verified API mapping:** `GET /v1/rate-types?active=&q=` → `{rate_types:[RateTypeSummary]}`; `GET /v1/rate-types/:id` → RateType; `POST` → `201`, `PATCH /:id`, `PUT|DELETE /:id/routes/:route_id`, `DELETE /:id` → `204`. Header is `{name,code?,note?,color?,owner?,valid_from?,valid_to?,active?,nationality_scope?,transfer_unit?}`. A route block is `{travel_from,travel_to,longtail_bundle,zones,charter,longtail,transfer}`; `zones[zone]` uses `{net,sell,min_sell}` and pax keys `ad_fr,chd_fr,inf_fr,ad_th,chd_th,inf_th`; charter uses `starter_price/starter_includes/extra_per_pax`. Map legacy `seatRates/priceTiers/routeValidity/routeBundles/charterRates/addOns` into route blocks; legacy `adult-fr` requires conversion to `ad_fr`.
- **Load/write/error/legacy:** load server detail before edit; replace the projected legacy-compatible item after every success. `net` is chargeable; do not use `sell/min_sell` for booking prices. Legacy `rtPersist()` remains legacy-mode only.
- **Tests/acceptance:** node check; `cd D:/projects/operation-backend && npm test`; `npm run test:ratexp`, `npm run test:rtseason`, `npm run test:rtbulk`, `npm run test:ratebind`; backend `test/quote-legacy.test.ts` is required parity evidence. Acceptance: a route zone plus seasonal validity round-trip and quote parity remain intact.
- **Exclusions/coordination:** S4 owns add-on-service catalogue; S2 does not convert custom add-on types to services. Coordinate any `40-ops-bookings.js` edit with booking owner.

### S3 — Promo contracts, documents, and templates

- **Objective:** replace contract/artifact/template stores with server contract APIs.
- **Owned files:** new `js/ops/18-ops-contracts.js`, tag, tests; reserved wrappers for `ctDocOpen`, `ctRenewActivate`, `ctSaveAddPromo` in `08-app.js`. Backend references `src/routes/sales-editing.ts`, `src/domain/contracts.ts`, `contract-writes.ts`, `contract-templates.ts`.
- **Entry/persistence:** `SB_CONTRACTS`/`sb_contracts` via `sbContractsPersist()`; `_CT_ARTIFACTS`/`agent_artifacts` via `ctArtifactsPersist()`; `SB_CONTRACT_TEMPLATES`/`contract_templates` via `ctTmplPersist()`.
- **Verified API mapping:** `GET /v1/contracts?agent_id=&kind=main|promo&status=active|expired|void` → `{contracts:[Contract plus state,bonus_progress]}` and `GET /:id`; promo `POST /v1/contracts` → `201`, `PATCH /:id`, `POST /:id/void`. Contract model is `{id,agent_id,kind,status,rate_type_id,active_from,active_to,priority,version,price_mode,discount,bonus,book_window,created_date,created_by,note,doc_id,voided_at,voided_by,program_periods,seat_prices}`. Documents: `GET /v1/agents/:id/documents` → `{documents}`, `POST` → `201`, `GET|DELETE /v1/contract-documents/:id`. Templates: `GET|POST /v1/contract-templates`, `GET|PATCH|DELETE /:id`, `POST /:id/default`.
- **Load/write/error/legacy:** map program and seat-price rows explicitly, replace reads after successful commands, and surface void/delete errors. **BLOCKED:** an exact frontend client mapping for generated legacy artifact metadata is not verified; do not implement document-artifact upload/metadata mapping until inspected.
- **Tests/acceptance:** node check; `cd D:/projects/operation-backend && npm test` (includes `test/contracts.test.ts`); acceptance is promo create/edit/void, template default, and read-only document display use confirmed shapes.
- **Exclusions/coordination:** no Agent edits (S1), Rate Type edits (S2), or blob fallback in ops mode.

### S4 — Add-on services

- **Objective:** wire the durable server service catalogue, without conflating it with booking-priced add-ons.
- **Owned files:** new `js/ops/19-ops-addon-services.js`, tag, tests; reserved wrappers for `renderAddonSvc` in `08-app.js`. Backend references `src/routes/sales-editing.ts`, `src/domain/addon-services.ts`.
- **Entry/persistence:** legacy `SB_ADDON_SVCS` is RAM-only; `SB_ADDON_TYPES`/`sb_addon_types` persists through `sbAddonTypesPersist()`.
- **Verified API mapping:** `GET /v1/addon-services?active=true|false|all` → `{addon_services:[service]}`, `GET /:id`, `POST` → `201`, `PATCH`, `DELETE` → `204`; service is `{id,name,type:'boat'|'van'|'guide'|'other',description,active,sort,variants:[{id,name,unit,selling,net}],created_at,updated_at}`. PATCH replaces variants.
- **Load/write/error/legacy:** API replaces the in-memory services projection after success; do not write RAM-only list as durable fallback. **BLOCKED:** no verified mapping between `SB_ADDON_TYPES` and this catalogue; leave custom booking add-on type UI under legacy behavior.
- **Tests/acceptance:** node check; `cd D:/projects/operation-backend && npm test` (`test/sales-editing.test.ts`); acceptance is list/create/replace-variants/delete with no mutation of booking rate add-ons.
- **Exclusions/coordination:** rate-type route pricing is S2.

### S5 — Markets and salespeople/Sales Board

- **Objective:** load and mutate the sales reference and board data through confirmed routes.
- **Owned files:** new `js/ops/20-ops-sales-board.js`, tag, tests; exact legacy Markets/Sales Board entry points in `08-app.js` are **BLOCKED** until inspected. Backend reference `src/routes/sales-editing.ts`.
- **Entry/persistence:** legacy persistence functions/store keys for these screens are **BLOCKED**; identify them before wrappers are attached.
- **Verified API mapping:** markets `GET|POST /v1/markets`, `PUT /v1/markets/order`, `PATCH|DELETE /v1/markets/:id`; salespeople `GET|POST /v1/sales`, `GET|PATCH|DELETE /v1/sales/:id`, `PUT /v1/sales/:id/targets/:month`, `PUT /v1/sales/:id/followups`, `GET /v1/sales-board`.
- **Load/write/error/legacy:** API reads are authenticated; writes are config-area protected. Exact request/response body mapping for UI forms is **BLOCKED**; inspect route handlers and forms first.
- **Tests/acceptance:** node check; `cd D:/projects/operation-backend && npm test`; implementation acceptance is deferred until entry/persistence and form mapping are evidenced.
- **Exclusions/coordination:** S1 owns an agent's market/sales bindings; do not alter Agent UI simultaneously.

### S6 — Staff & Welfare (existing adapter regression)

- **Objective:** preserve and test the only already-wired Sales UI; do not rewrite it as part of another packet.
- **Owned files:** `allotment_v2/js/ops/15-ops-staff.js` and staff test only; backend references `src/routes/sales-editing.ts`, `src/domain/staff.ts`.
- **Entry/persistence:** wraps `staffAdd`, `staffSetField`, `staffSetQuota`, `staffDelete`, `staffSetTab`, `staffSetYear`, `staffTripsFor`, `staffQuota`, `staffWelfareUsed`, `staffRemaining`; legacy `SB_STAFF`/`sb_staff` is replaced from server roster.
- **Verified API mapping:** `GET /v1/staff?year=YYYY` → `{year,staff:[{id,code,name,dept,active,quotas,quota,used,remaining}]}`, `GET /v1/staff/trips?year=`, `GET /v1/staff/:id?year=`, `POST` → `201`, `PATCH /:id`, `PUT /:id/quotas/:year {free_seats}`, `DELETE` → `204`.
- **Load/write/error/legacy:** retain server roster mapping `{quota:quotas}` and server `quota/used/remaining`; ops-only wrappers and visible failures.
- **Tests/acceptance:** `node --check allotment_v2/js/ops/15-ops-staff.js`; `npm run test:ops`; `cd D:/projects/operation-backend && npm test` (`test/staff.test.ts`).
- **Exclusions/coordination:** no simultaneous edits by S1–S5 or O6.

## Catalogue and pickup packets

### C1 — Existing catalogue/calendar/deployment/lock regression

- **Objective:** protect the already-wired subset, not expand CRUD scope.
- **Owned files:** `js/ops/10-ops-catalogue.js`, `20-ops-deployments.js`, `30-ops-locks.js`, `50-ops-availability.js`, `90-ops-boot.js` only with coordinator reservation; backend reference `src/routes/operations.ts` and README catalogue/capacity sections.
- **Entry/persistence:** catalogue maps routes/boats/markets/sales/agents; calendar wrappers are `saveNewSeason`, `delSeason`, `toggleDayOverride`; deployments wrap `save('operations')`/`boatCapPersist`; locks wrap `sbSeatLocksPersist`; availability wraps `getAllotment`.
- **Verified API mapping:** catalogue reads `GET /v1/routes?from=&to=`, `/v1/boats`, `/v1/markets`, `/v1/sales`, `/v1/agents?active=all`; seasons `POST|DELETE /v1/routes/{id}/seasons`; days `PUT|DELETE /v1/routes/{id}/days/{date}` and retry `409 bookings_on_closed_day` with `close_anyway`. Deployments: `GET /operations/deployments?from=&to=&route_id=`, `POST /operations/deployments {boat_id,route_id,service_date,capacity,registered_persons?}`, `DELETE /operations/deployments/{service_date}/{boat_id}`. Locks and availability retain their current audited calls.
- **Load/write/error/legacy:** server-first diff/queue and rollback stay intact; availability is an overlay, not a durable write; all are ops-mode only.
- **Tests/acceptance:** `npm run test:ops`; `cd D:/projects/operation-backend && npm test`. Acceptance is boot mappings, season close conflict retry, deployment rollback, lock fan-out, and availability overlay.
- **Exclusions/coordination:** route/family/boat CRUD is C3, not this packet.

### C2 — Pickup areas and time profiles

- **Objective:** add the missing pickup adapter and hydrate server pickup state before Pickup Setup edits.
- **Owned files:** new `js/ops/21-ops-pickup.js`, tag, tests; reserved wrappers for `renderPickupSetup`, `psuSaveArea`, `psuDeleteArea`, `_psuInheritTimesForArea`, `psuSetTimeCell`, `psuPersist` in `08-app.js`. Backend references `src/domain/pickup-areas.ts` and documented pickup routes.
- **Entry/persistence:** `SB_PICKUP_AREAS`, `SB_PICKUP_TIMES`, `SB_PICKUP_TIME_PROFILES`; `psuPersist()` currently read-modify-writes `sb_pickup_areas`, `sb_pickup_times`, `sb_pickup_time_profiles`; legacy cells are free-form strings.
- **Verified API mapping:** areas `GET /v1/pickup-areas?active=true`, `POST {name,zone,time_group,region?}` → `201`, `PATCH /:id`, `DELETE` → inactive area. Profiles `GET /v1/pickup-time-profiles`, `GET /:id`, `POST {name,from_date,to_date,notes?,clone_from?}` → `201` profile plus copied times, `PATCH`, `DELETE` → `204`. Cells `PUT /v1/pickup-time-profiles/{id}/times/{route_id}/{target}` with `{pickup_time,pickup_time_end?}` or `{pickup_time_end,pickup_at_pier:true}`, `DELETE` → `204`; resolve `GET /v1/pickup-time?route_id=&area_id=&date=` → window plus `{profile_id,target}` or `404`. Map `timeGroup`/`from`/`to`/`clonedFrom`/`createdAt` to snake case and normalize free-form cells deliberately.
- **Load/write/error/legacy:** replace API projections after success; server inherited sibling-group cells must not be locally mass-written. Legacy `psuPersist()` remains only outside ops mode.
- **Tests/acceptance:** node check; `cd D:/projects/operation-backend && npm test` (`test/pickup-areas.test.ts`); add focused UI mapping test. Acceptance: area soft-delete, profile clone, normal and pier-deadline cell round-trip, resolution 404 shown without local fallback.
- **Exclusions/coordination:** no van jobs (O4) and no invented zone values; backend permits `PK|KL|RN|NoTransfer`.

### C3 — Route/family/boat CRUD mapping discovery — **BLOCKED**

- **Objective:** establish exact legacy handlers and payload mappings before any CRUD cutover.
- **Owned files:** discovery notes/test only; read-only frontend `10-ops-catalogue.js` and uninspected legacy handlers; backend README catalogue section and route handlers.
- **Verified API surface:** route `POST /v1/routes`, `PATCH|DELETE /v1/routes/:id`, `POST /v1/routes/order`; family CRUD `/v1/route-families`; boat CRUD/status/retire/capacity-override endpoints are documented.
- **Blocked facts:** no wrapper was verified for those endpoints, and no audited legacy handler-to-payload mapping was captured. Do not assign implementation or edit UI until each is sourced.
- **Exclusions/coordination:** calendar writes remain C1; Fleet boat status/assignment is F1.

## Fleet packets

All Fleet packets create a dedicated `js/ops/` adapter/tag/test and are ops-mode only. `flSave()` read-modify-writes the shared blob, so no packet may leave a later legacy `flSave()` able to clobber API-derived state. The exact cache/reconciliation policy is **BLOCKED** until the packet's save windows are inspected.

### F1 — Boat status, assignments, certificates, readiness

- **Owned files:** reserved `05-fleet.js` wrappers for `renderBoats`, `flRenderBoatList`, `flRenderBoatDetailPink`, `getBoatCurrentPier`, `flRetireBoat/flUnretireBoat`, `flOpenNewAssignment/flSaveAssignment`; new adapter/tag/test. Backend references `routes/fleet.ts`, `fleet-extras.ts`.
- **Entry/persistence:** `BOATS`/`boats`; `boat.log[]`, `boat.assignments[]`, `boat.docs[]`; assignment save directly writes `localStorage[LS_KEY].boats`.
- **Verified API mapping:** `GET /v1/boats[/:id]`, documented boat CRUD/status/retire/capacity endpoints; `GET|POST /v1/boats/:id/assignments`, `POST .../:asn_id/cancel`, POST body `{type,from_pier,to_pier,start_date,end_date,reason,cost}` → `{assignment,boat_pier}`; `GET /:id/documents`, `POST /:id/documents/renew`; `GET /v1/fleet/availability?from=&to=&boat_id=` → `{days}`. Map `cap/licensePax/totalcap/nameTh/docs/log` to `capacity/license_pax/registered_persons/name_th/documents/status_log`; status is `s/from/to` → `status/from_date/to_date`.
- **Load/write/error/legacy:** readiness uses server `status_effective`/`blocked_by`; temporary `pier_today` never overwrites home `pier`; refetch affected boat after commands. Legacy behavior untouched outside ops mode. **BLOCKED:** exact boat CRUD, status-log, retire, and capacity-override command bodies/responses were not captured; implement only assignments/documents/readiness until handler evidence is added.
- **Tests/acceptance:** node check; backend `npm test` (`test/fleet.test.ts`, `test/fleet-extras.test.ts`); acceptance covers assignment/cancel, status/readiness, and no home-pier overwrite.
- **Exclusions/coordination:** no engines (F2) or jobs (F3); catalogue base CRUD is C3.

### F2 — Engines, gearboxes, propellers

- **Owned files:** reserved `05-fleet.js` asset list/detail/save/service/swap/spare functions and `06-engine-assign.js`; new adapter/tag/test. Backend references `routes/fleet.ts`, `domain/fleet-assets.ts`.
- **Entry/persistence:** `FL_ENGINES/fleet_engines`, `FL_GEARBOXES/fleet_gearboxes`, `FL_PROPELLERS/fleet_propellers`; `flOpenAssignEngModal/flSaveAssignEng/flUnassignEng`, `flEquipSwapDo`, `flOpenMoveSpare/flConfirmMove`.
- **Verified API mapping:** each of `/v1/fleet/engines|gearboxes|propellers` supports `GET [ ?boat_id ]`, `GET/:id`, `POST`, `PATCH/:id`, `POST/:id/status|install|remove|swap`; engine/gearbox `POST/:id/service`; gearbox/propeller `POST/:id/move`. Command bodies: install `{boat_id,pos,job_id?}` or gearbox `{engine_id}` or propeller `{gearbox_id,prop_pos?}`, status `{status,note?}`, remove/move `{spare_location,note?}`, swap `{with_id}`. Map camel to snake but never PATCH server-owned links/computed hours/logs.
- **Load/write/error/legacy:** preserve engine→gearbox→propeller chain and normalize `Starboard/Stbd` to `Std`; command then refetch affected chain. API owns link fields/service baseline/hours.
- **Tests/acceptance:** node checks for both source files; backend `npm test` (`test/fleet.test.ts`); add mapping/command-choice UI test. Acceptance: install/remove/swap/service use commands, never raw link PATCH.
- **Exclusions/coordination:** F3 owns job side effects.

### F3 — Incidents and maintenance jobs

- **Owned files:** reserved incident/maintenance functions in `05-fleet.js`; new adapter/tag/test. Backend references `routes/fleet.ts`, `domain/fleet-jobs.ts`.
- **Entry/persistence:** `FL_INCIDENTS/fleet_incidents`, `FL_MAINT/fleet_maintenance`; `flRenderIncident/flSaveIncident`, `flRenderMaint/flSaveCreateJob`, start/close, swap, job asset/log/split functions. These currently also mutate boats/assets.
- **Verified API mapping:** incidents `GET /v1/fleet/incidents?status=&boat_id=`, `GET/:id`, `POST`, `PATCH|DELETE /:id`, `POST /:id/log|swap`. Jobs `GET /v1/fleet/jobs?status=&boat_id=&incident_id=`, `GET/:id`, `POST` → `{jobs}`, `PATCH|DELETE /:id`, commands `POST /:id/start|close|reset-service|boat-status|assets|log|split|steps|steps/template`, `DELETE /assets/:idx`, `PATCH|DELETE /steps/:idx`. Verified create `{no,boat_id,title,type,assets:[{type,asset_id}]}`, close `{outcome,note}`.
- **Load/write/error/legacy:** map documented snake fields (`damaged_assets`, `related_job_ids`, `progress_log`, `boat_status`, `set_fixing`); command response/refetch replaces incident/job and dependent boat/assets. Preserve `boatStatus || (setFixing===false ? available : fixing)`. **BLOCKED:** incident create/patch/log/swap and non-listed job-command payload/response mappings need handler inspection before those UI actions are wired.
- **Tests/acceptance:** node check; backend `npm test` (`test/fleet.test.ts`); acceptance covers start blocks deployment, close frees boat, and refusal leaves local state unchanged.
- **Exclusions/coordination:** job parts are F4; F1 owns boat renderer normalization.

### F4 — Inventory, consumables, and purchase memos

- **Owned files:** reserved inventory/memo/consumable functions in `05-fleet.js`; new adapter/tag/test. Backend reference `routes/fleet-stock.ts`.
- **Entry/persistence:** `FL_INVENTORY/fleet_inventory`, `FL_MEMOS/fleet_memos`, `FL_CONSUMABLE_LOGS/fleet_consumable_logs`; `flSaveReceive/flSaveTransfer/flSaveInvEdit/flSaveAddStock`, memo commands, `flConsumeSubmit/Delete`.
- **Verified API mapping:** warehouses `GET /v1/fleet/warehouses`; stock `GET|POST /v1/fleet/stock-items`, `GET|PATCH|DELETE /:id`, commands `POST /:id/receive|transfer|adjust|merge`; suppliers `GET /v1/fleet/suppliers`; job parts `POST|DELETE /v1/fleet/jobs/:id/parts[/:idx]`; consumables `GET|POST|DELETE /v1/fleet/consumables[/:id]`; memos `GET|POST /v1/fleet/memos`, `GET|PATCH /:id`, commands approve/order/receive/short-close/pay/cancel. Camel aliases are accepted on create but response uses `total_qty`, `primary_warehouse`, `movements`.
- **Load/write/error/legacy:** never send local replacement arrays, `stocks[].qty`, or history as owned state; quantities are movement-derived. Replace/refetch server records after commands. **BLOCKED:** command payload/response mappings beyond audited stock-create aliases must be read from `fleet-stock.ts` before wiring each receive/transfer/adjust/memo/consumable form.
- **Tests/acceptance:** node check; backend `npm test` (`test/fleet-stock.test.ts`); acceptance covers create/receive/transfer/adjust and excludes history submission.
- **Exclusions/coordination:** F3 owns job lifecycle; F5 owns fuel/daily log.

### F5 — Projects, daily log, safety, and fleet insights

- **Owned files:** reserved project/daily-log/safety/dashboard/report functions in `05-fleet.js`; new adapter/tag/test. Backend references `fleet-stock.ts`, `fleet-extras.ts`, `fleet-insights.ts`.
- **Entry/persistence:** `FL_PROJECTS/fleet_projects`, `FL_DAILY/fleet_daily`, `FL_FUEL_PRICE/fleet_fuelprice`, `FL_DR_LOCK/fleet_drlock`, `FL_SAFETY/fleet_safety`, `fleet_fuelbudget`; `flProj*`, `flSaveFuel/flSaveFuelPrice/flSaveMeter`, safety/inspection, dashboard/cost/fuel/insights renderers.
- **Verified API mapping:** projects list/create/detail/patch and lifecycle under `/v1/fleet/projects`; daily `GET /v1/fleet/daily-log?from=&to=`, `PATCH /daily-log/:date/boats/:boat_id` (e.g. `{fuel_litres,pax_actual,meters:{normal:{engineId:reading}}}`), water/issues/extras/pier requests, `PUT /:date/fuel-prices`, pier lock/unlock; safety CRUD/inspection and `POST /v1/fleet/safety/:id/replace`; `GET|PUT /v1/fleet/fuel-budgets[/:month]`; reports/dashboard/history; insights `GET /v1/fleet/insights?period=month|quarter|ytd|all`, fleet report `GET /v1/fleet/reports/fleet?from=&to=`.
- **Load/write/error/legacy:** a daily response replaces that date cache; honor API pier locks; backend project completion and safety replacement side effects are not reimplemented client-side. **BLOCKED:** exact project lifecycle, daily subresource, safety/inspection, and budget payload/response mappings other than the audited daily boat row must be sourced from handlers before implementation.
- **Tests/acceptance:** node check; backend `npm test` (`fleet-stock.test.ts`, `fleet-extras.test.ts`, `fleet-insights.test.ts`); acceptance covers one daily row replacement, project command, safety replacement, and read-only report rendering.
- **Exclusions/coordination:** F1 assignments/certificates remain F1; F3/F4 only consume returned affected records.

## Finance packets

### M1 — Invoices, payments, deposits, and refunds

- **Owned files:** new `js/ops/30-ops-money.js`, tag, tests; reserved accounting wrappers in `08-app.js` (`acctCreateInvoice`, `acctCreateFeeInvoice`, `acctRecordPayment`, `acctVoidInvoice`, statement/document UI). Backend references `routes/money.ts`, `credit.ts`, `domain/invoices.ts`, `refunds.ts`, `credit.ts`.
- **Entry/persistence:** `SB_INVOICES/sb_invoices`, `SB_PAYMENTS/sb_payments`, `SB_DEPOSITS/sb_deposits`; legacy `acctPersistBookings()` has an accounting/operations permission mismatch and must not be retained for backend-computed booking state.
- **Verified API mapping:** invoices `POST /v1/invoices {agent_id|agentId,booking_ids|bookingIds,kind?:'booking'|'prepay',note?,ref?,dear?,accept_at?,remark?}`, GET/list/detail, PATCH header/WHT, discounts, payments, corrections, void. View is server-derived (`status,paid,balance,refunded,credited,overpaid,booking_ids,payments,refunds`); methods `transfer|cash|card|credit`. Deposits `GET|POST /v1/deposits`, detail, void; POST `{agent_id|agentId,amount,method?,received_on|date?,ref?,note?,slip_ids|slips?}`. Deposit spend is invoice payment `{method:'credit'}`. Refund payout is `POST|DELETE /v1/refunds/:id/payout` with `{paid_on|date?,method:transfer|cash|cheque,ref?,slip_ids?}`; weather cancellation creates refunds/credits.
- **Load/write/error/legacy:** server computes VAT/amounts and booking invoice/payment state; never PATCH legacy `invoiceId/paymentStatus`. Handle `409 overpayment` and post-payment discount refusal visibly. Operations mode has no blob durable fallback.
- **Tests/acceptance:** node check; `cd D:/projects/operation-backend && npm test` (`test/invoices.test.ts`, `test/credit.test.ts`). No dedicated frontend finance test is verified: **BLOCKED**—inspect harness before adding one. Acceptance is create/pay/void/deposit-credit flow with server values displayed.
- **Exclusions/coordination:** M2 calls M1 invoice/payment APIs; M3 owns commissions/pier money; no booking pricing/cancellation rewrite.

### M2 — Daily PFM

- **Owned files:** new `js/ops/31-ops-pfm.js`, tag, tests; reserved `renderDailyPFM`, `pfm*` wrappers in `08-app.js`. Backend references `routes/money.ts`, `domain/pfm.ts`.
- **Entry/persistence:** legacy booking `bk.ops.pfm` and `bk.paymentSlips[]`; invoice/payment arrays shared with M1.
- **Verified API mapping:** `GET /v1/pfm?from=YYYY-MM-DD&to=YYYY-MM-DD` → `{from,to,rows,totals}`; `POST /v1/bookings/:id/pfm/approve-travel {approver|extended_by|extendedBy}`, `POST /:id/pfm/hold`, `POST /v1/pfm/remind {from,to}`. Rows include `booking_id`, `version`, invoice summary, totals/status, decision/reminder/cot fields. Invoice actions use M1 routes; proforma/prepay rules are server-owned.
- **Load/write/error/legacy:** rows are authoritative; refresh after every command and use existing fresh booking-version handling. Do not generic-patch `bk.ops.pfm`, slips, or counters.
- **Tests/acceptance:** node check; `cd D:/projects/operation-backend && npm test`. Targeted PFM test filename is **BLOCKED** (none verified); locate before a filtered command. Acceptance is approve/hold/remind refresh and no local PFM persistence in ops mode.
- **Exclusions/coordination:** M1 owns invoices/payments.

### M3 — Commission payout, pier money, handovers, after-trip finance

- **Owned files:** new `js/ops/32-ops-field-money.js`, tag, tests; wrappers only for finance-owned screens. Backend references `routes/money.ts`, `money-reports.ts`.
- **Entry/persistence:** legacy `SB_EXTRAS` and pier-payment booking fields; exact UI wrappers for commission/pier/after-trip are **BLOCKED** except `renderPierCheckin/pckPaySave/pckPayOpen` (coordinate with O1).
- **Verified API mapping:** `GET /v1/commissions?from&to&seller?&paid?`; commission payout list/detail/create/void. Pier money `GET /v1/pier-money`, `GET /v1/bookings/:id/pier-money?date=`, booking pier-payment create/slips/delete; handover list/preview/detail/create/accept/void. After-trip `GET /v1/after-trip` plus documented COT/no-show paths; backend updates invoices via `syncCotLines`.
- **Load/write/error/legacy:** use `bk.opsId` and booking version via `laOps.bookingWrite` for versioned pier/booking money writes; keep fee separate from payment amount. Agent-tied logins are excluded server-side.
- **Tests/acceptance:** node check; `cd D:/projects/operation-backend && npm test` (`test/money-reports.test.ts`); `npm run test:ops`. Acceptance requires one versioned pier payment and one read-only commission/after-trip load. Exact create payload mappings not captured here are **BLOCKED** pending route inspection.
- **Exclusions/coordination:** O1 owns pier office/cash; O3 owns tour sales and upgrades; do not concurrently edit Pier Check-in wrappers.

### M4 — Accounting/report adapters

- **Owned files:** new `js/ops/33-ops-money-reports.js`, tag, tests; reserved `renderAccounting`, `acctDashboardHtml`, `acctStatementOpen`, `renderTravelSum`, `renderDailyReport` wrappers. Backend references `routes/money-reports.ts`, `domain/money-reports.ts`.
- **Entry/persistence:** legacy aggregate functions read `SB_*`; Trip P&L uses `TRIP_ACT`, `cost_template`, `cost_plans`, `van_rates`, `MEAL_VENUES`.
- **Verified API mapping:** `GET /v1/reports/accounting`; `GET /v1/agents/:id/statement`; `GET /v1/reports/travel-summary?date=`; `GET /v1/reports/daily?date=`; `GET|PUT /v1/reports/daily/settings`. Responses are computed reads.
- **Load/write/error/legacy:** replace aggregate computation with endpoint response; permission errors are surfaced. **BLOCKED/unmigrated:** no endpoint is verified for Trip P&L, cost template/plans, P&L close/freeze—keep these legacy-only, do not approximate.
- **Tests/acceptance:** node check; backend `npm test` (`test/money-reports.test.ts`). No registered frontend finance/report test is verified; inspect harness first. Acceptance: dashboard/statement/daily/travel views render server payload and do not mutate local report state.
- **Exclusions/coordination:** M3 owns after-trip money; O5 owns weather/trip actual actions.

## Remaining operations packets

### O1 — Pier cash and pier office — **partially BLOCKED**

- **Owned files:** new `js/ops/34-ops-pier-office.js`, tag, tests; reserved `renderPierOffice`, `renderPierJob`, `renderPierAtt`, `renderPierLic` wrappers in `08-app.js`. Backend references `routes/pier-office.ts`, `routes/money.ts`.
- **Entry/persistence:** `renderPierCheckin/pckPay*` is M3-coordinated; office writes `PIER_MOVES`, job sheets `PIER_JOB/PIER_TEAM`.
- **Verified API mapping:** `GET|PUT /v1/pier-cash/settings`; day/month/certificate/pull routes under `/v1/pier-cash/:pier/...`; `GET|POST|PATCH|DELETE /v1/pier-office...`. Exact suffix literals, request bodies, and response models were not captured.
- **Load/write/error/legacy:** office/pier money writes require server pier/operations rights; do not claim successful local save. **BLOCKED:** inspect route source for every literal/body and map legacy stores before implementing.
- **Tests/acceptance:** backend `npm test && npm run check`; `npm run test:ops`. No implementation acceptance until blocked mapping is resolved.
- **Exclusions/coordination:** M3 owns pier payments/handovers; equipment/laundry, crew/roster/licenses are excluded unless their exact API mapping is verified.

### O2 — B2C operations UI

- **Owned files:** new `js/ops/35-ops-b2c.js`, tag, tests; reserved `renderB2C` wrapper only. Backend references `docs/love-kingdom-integration.md`, `routes/operations.ts`; do not edit `b2c-map.js`.
- **Entry/persistence:** `SB_B2C/sb_b2c`; website mapping uses `b2c-map.js` and legacy `relSyncB2C`.
- **Verified API mapping:** B2C uses `POST /v1/login`, reads routes/agents/availability, and `GET|POST|PATCH /v1/bookings` plus seat locks; bad held writes return `202 held_for_review`. Reuse `laOpsToServer/laOpsFromServer` in `40-ops-bookings.js`, including external id and server ids/versions; server preserves price for `b2c_` / `a_b2c` cases.
- **Load/write/error/legacy:** display 202 held-for-review as non-final; no browser server-to-server push and no second mapper. Ops mode only.
- **Tests/acceptance:** `npm run test:b2c`, `npm run test:ops`, backend `npm test && npm run check`; acceptance is a B2C booking map/read/write/held flow through existing mapper.
- **Exclusions/coordination:** external Love Kingdom integration and generic agent/channel CRUD are excluded.

### O3 — Day-of booking actions

- **Owned files:** new `js/ops/36-ops-day-actions.js`, tag, tests; reserved wrappers for `renderInsurance`, meal/reconfirm/check-in action functions in `08-app.js` and only coordinated mapping changes in `40-ops-bookings.js`. Backend references `routes/operations.ts`, `routes/money.ts`.
- **Entry/persistence:** insurance, `specialMeals/allergyList`, `ckWrite` to `ops.vanCheckin/ops.pierCheckin`, `bk.reconfirm`, and `SB_EXTRAS` on-tour sales.
- **Verified API mapping:** `PUT /v1/bookings/:id/insurance`; `PUT /v1/bookings/:id/meals`; `PUT|DELETE /operations/trip-ops/:trip_id/checkins/:kind/:slot`; tour sales `GET|POST /v1/bookings/:id/tour-sales`, `PATCH|DELETE /:sale_id`, collect, and upgrade collect. Booking action writes are versioned and returned booking replaces projection; check-ins merge returned `trip.operations` without a booking-version bump.
- **Load/write/error/legacy:** preserve no-show append-only semantics and server computation. **BLOCKED:** reconfirm route literal/request/response were not captured; inspect before adding reconfirm UI wiring.
- **Tests/acceptance:** node check; backend `npm test && npm run check`; `npm run test:ops`. Acceptance: insurance/meals/check-in/tour-sale action refreshes server state; reconfirm excluded until unblocked.
- **Exclusions/coordination:** cancellation/reschedule already belong to booking adapter; M3 owns money reporting/payout contexts.

### O4 — Vans and van jobs — **partially BLOCKED**

- **Owned files:** new `js/ops/37-ops-vans.js`, tag, tests; reserved wrappers for `renderVehicles`, `renderVanJobs`, `renderVanCheckin`, By-trip van mode. Backend reference `routes/operations.ts`; money report routes only if separately approved.
- **Entry/persistence:** `SB_VEHICLES`, `VANJOB_DRIVER`, `VANJOB_PICKUP_TH`, `VANJOB_SREQ`, `VANJOB_SENT`; booking `ops.vanGroup/vanId/vanReturnId/vanSplits`; server mapping needs each trip `opsTripId` and `van_parts`.
- **Verified API mapping:** `PATCH /operations/trip-ops/:trip_id`; `GET|POST /operations/van-groups`; `POST /operations/van-groups/clear`; check-in routes are O3. Van bills/rates are confirmed finance endpoints but excluded.
- **Load/write/error/legacy:** never auto-pick a van; outbound is group-level and return is per part/booking; backend locks route-day group changes. **BLOCKED:** van registry/day/matrix literals and their request/response mapping were not captured—do not migrate those screens yet.
- **Tests/acceptance:** `npm run test:vbdrop`, `npm run test:vanstop`, `npm run test:splitzone`, `npm run test:cklive`, `npm run test:ops`; backend `npm test && npm run check`. Acceptance is group clear/create and trip patch with return-van invariant, only after source mapping is verified.
- **Exclusions/coordination:** pickup C2, Fleet vehicle maintenance, partner billing, and rate editing are excluded.

### O5 — Weather closures and trip actuals

- **Owned files:** new `js/ops/38-ops-weather-actuals.js`, tag, tests; reserved weather/actual action wrappers (`bookingV2WeatherMark*`, `bookingV2WeatherResolveOne`, actual/meal handlers) only. Backend references `routes/operations.ts`, `routes/money-reports.ts`.
- **Entry/persistence:** `SB_WEATHER_CLOSURES/sb_weather`, `TRIP_ACT`, weather functions, `pckMealSend`; existing dashboard adapter is not owned.
- **Verified API mapping:** weather `GET|POST /v1/weather-closures`, `GET|PATCH /:id`, notify/undo per booking, and booking reschedule/cancel-weather commands. Actuals `GET /v1/trip-actuals?from=&to=`, `GET /:date/:boat_id`, venue/meal-order/meal-note/meal-overnight writes, and close/reopen/ran/not-ran commands. Weather closure does not alter availability; resolution is a versioned booking command.
- **Load/write/error/legacy:** reports are computed and M4-owned; actuals server responses replace projections. Venue writes need pier/operations; close/reopen/ran/not-ran accounting rights. **BLOCKED:** exact weather create/patch/notify and trip-actual command bodies/responses were not captured; inspect handlers before wiring those actions.
- **Tests/acceptance:** backend `npm test && npm run check`; `npm run test:ops`; use `npm run test:daydetail`/`npm run test:ovnmeal` only when the changed view is covered. Acceptance: closure create/resolve and one actual/meal action refresh from API.
- **Exclusions/coordination:** invoices, van bills, cost plans, reports, dashboard duplication excluded.

### O6 — Identity/admin boundary

- **Owned files:** `01-auth-sync.js` and user-admin renderer are coordinator-reserved; existing `15-ops-staff.js` is S6. Backend references `src/auth.ts` and README auth/permissions.
- **Entry/persistence:** auth already maps `/v1/login`, `/v1/me` through `opsMeFrom` to `LA_ME`; it maps `can_edit`, `edit_areas`, `actions`, `view_perms`, `sales_id`, `agent_id`, `dept`.
- **Verified API mapping:** `GET /v1/me`; admin-only `GET|POST /v1/users`, `PATCH /v1/users/:id`, `POST /v1/users/:id/password`; `POST /v1/logout`; `POST /v1/me/password`.
- **Load/write/error/legacy:** server checks rights on every request; frontend permissions are hints only. **BLOCKED:** user-admin frontend entry points/local persistence mapping were not audited. No user mutation UI work may start until inspected.
- **Tests/acceptance:** `npm run test:perm`, `npm run test:ops`, backend `npm test && npm run check`; implementation acceptance is blocked for user UI.
- **Exclusions/coordination:** do not alter JWT/auth protocol, Agent CRUD, or Staff adapter.

## Worker handoff JSON template

Every worker returns this JSON to the coordinator (and commits only their listed frontend files):

```json
{
  "packet": "S1",
  "status": "complete | blocked | partial",
  "objective": "",
  "branch": "",
  "commit": "",
  "owned_files_changed": [
    "allotment_v2/js/ops/16-ops-agents.js",
    "allotment_v2/allotment_v2.html",
    "test/ui/..."
  ],
  "shared_files_touched_with_coordination": [
    { "path": "allotment_v2/js/08-app.js", "reservation": "approved by coordinator", "entry_points": ["agEditSave"] }
  ],
  "backend_contract_files_inspected": [
    "D:/projects/operation-backend/src/routes/sales-editing.ts"
  ],
  "endpoints_exercised": [
    { "method": "GET", "path": "/v1/agents?active=all", "response_checked": "{agents:[...]}" }
  ],
  "legacy_mode_verified": true,
  "load_write_error_behavior": "",
  "mapping_notes": "",
  "tests": [
    { "command": "node --check allotment_v2/js/ops/16-ops-agents.js", "result": "pass" },
    { "command": "npm run test:ops", "result": "pass" }
  ],
  "acceptance_evidence": [""],
  "blocked_items": [
    { "item": "", "why": "not verified", "required_source_evidence": "" }
  ],
  "exclusions_honored": [""],
  "risks_or_followups": [""],
  "no_backend_or_db_changes": true
}
```

## Coordinator close-out

Merge packet commits serially by the dependency table, resolve reserved shared-file changes, run every packet's reported check plus `npm run test:ops`, and reject a handoff that invents an endpoint/payload or treats a BLOCKED item as implemented. No backend, schema, migration, mapping, or database change belongs in this plan.
