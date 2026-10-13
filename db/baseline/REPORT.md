# Production schema baseline — REPORT

Generated 2026-08-20T06:20:31.154Z · server **PostgreSQL 18.4** · **read-only** introspection.
Views captured with `pg_get_viewdef(oid, true)`, never from a repo file.

> Source of truth for task `P0-01`. Raw DDL lives beside this file as
> `<schema>_<date>.sql` (dumped with pg_dump 18, `--schema-only --no-owner --no-privileges`).

## 1. Schema layout

The database hosts **four** schemas, not one. This materially changes the rewrite plan.

| Schema | Tables | With PK | With any FK | Total rows | What it is |
|---|---:|---:|---:|---:|---|
| `operation_schemas` | 133 | 120 | 52 | 50,802 | The ops app (`allotment_v2.html`) — bookings, fleet, accounting |
| `love_kingdom` | 39 | 39 | 24 | 1,641 | B2C / ERP (Loveandaman-Kingdom) — the second writer |
| `allotment` | 4 | 3 | 0 | 3,075 | Small — inspect before assuming |
| `public` | 8 | 8 | 0 | 1,314 | Default schema — inspect before assuming |

## 2. Referential integrity — the headline

| Metric | Count | of 184 tables |
|---|---:|---:|
| Has a PRIMARY KEY | 170 | 92% |
| Has at least one FOREIGN KEY | 76 | 41% |
| Has **neither** PK nor FK | 14 | 8% |
| Columns that look like FKs but are **not enforced** | 126 | — |

### 2.1 Tables with no PK and no FK

| Table | Rows | Cols |
|---|---:|---:|
| `operation_schemas.pier_moves` | 218 | 13 |
| `operation_schemas.pier_shift` | 124 | 3 |
| `operation_schemas.pier_staff` | 37 | 11 |
| `operation_schemas.pier_items` | 30 | 7 |
| `operation_schemas.app_meta` | 26 | 2 |
| `operation_schemas.pier_licenses` | 26 | 8 |
| `operation_schemas.pier_job` | 22 | 3 |
| `allotment.users` | 16 | 9 |
| `operation_schemas.pier_codes` | 11 | 8 |
| `operation_schemas.pier_cfg` | 7 | 3 |
| `operation_schemas.pier_duty` | 7 | 3 |
| `operation_schemas.pier_lic_classes` | 4 | 6 |
| `operation_schemas.pier_lic_types` | 2 | 6 |
| `operation_schemas.pier_team` | 0 | 3 |

### 2.2 Unenforced foreign keys (top 60 by table size)

Columns named like references, with no FK constraint behind them. Each is a place where the rewrite must add a real FK — and where orphan rows may already exist.

| Table | Column | Type | Table rows |
|---|---|---|---:|
| `allotment.attachments` | `booking_id` | text | 3,038 |
| `operation_schemas.sb_bookings__trips` | `routeid` | text | 2,873 |
| `operation_schemas.sb_bookings__trips` | `charterboatid` | text | 2,873 |
| `operation_schemas.sb_bookings__trips` | `ops_boatid` | text | 2,873 |
| `operation_schemas.sb_bookings__trips` | `ops_vanid` | text | 2,873 |
| `operation_schemas.sb_bookings__trips` | `ops_vanreturnid` | text | 2,873 |
| `operation_schemas.sb_bookings` | `agentid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `pickupareaid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `dropoffareaid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `staffid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `marketsnapshot_agentid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `ops_boatid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `ops_vanreturnid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `ops_vanid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `invoiceid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `editlock_uid` | text | 2,870 |
| `operation_schemas.sb_bookings` | `paymentsnapshot_paid` | bigint | 2,870 |
| `operation_schemas.sb_contracts__programperiods` | `sb_contracts_id` | text | 2,111 |
| `operation_schemas.sb_contracts__programperiods` | `routeid` | text | 2,111 |
| `operation_schemas.sb_agents__programperiods` | `routeid` | text | 1,621 |
| `public.report_agent_sales_7m_2026` | `agent_id` | text | 1,313 |
| `operation_schemas.sb_seat_locks__log` | `bookingid` | text | 925 |
| `operation_schemas.sb_contracts` | `agentid` | text | 792 |
| `operation_schemas.sb_contracts` | `ratetypeid` | text | 792 |
| `operation_schemas.sb_contracts` | `docid` | text | 792 |
| `operation_schemas.sb_agents` | `ratetypeid` | text | 771 |
| `operation_schemas.sb_agents` | `companyinfo_taxid` | text | 771 |
| `operation_schemas.sb_agents` | `contracttemplateid` | text | 771 |
| `operation_schemas.sb_agents_rate_bindings` | `ratetypeid` | text | 771 |
| `operation_schemas.fleet_inventory__history` | `jobid` | text | 734 |
| `operation_schemas.fleet_inventory__history` | `consumeid` | text | 734 |
| `operation_schemas.fleet_memos__items` | `invid` | text | 603 |
| `operation_schemas.trips` | `b13_charterbookingid` | text | 338 |
| `operation_schemas.trips` | `b6_charterbookingid` | text | 338 |
| `operation_schemas.trips` | `b8_charterbookingid` | text | 338 |
| `operation_schemas.trips` | `b14_charterbookingid` | text | 338 |
| `operation_schemas.trips` | `b15_charterbookingid` | text | 338 |
| `operation_schemas.boats__repairhistory__assets` | `boats_repairhistory_id` | text | 327 |
| `love_kingdom.promo_hotel_seasons` | `room_type_id` | text | 318 |
| `operation_schemas.sb_seat_locks` | `routeid` | text | 298 |
| `operation_schemas.sb_seat_locks` | `boatid` | text | 298 |
| `operation_schemas.sb_seat_locks` | `holderid` | text | 298 |
| `operation_schemas.sb_seat_locks` | `parentid` | text | 298 |
| `love_kingdom.promo_hotel_extras_seasons` | `extra_id` | text | 293 |
| `operation_schemas.sb_invoices` | `agentid` | text | 286 |
| `operation_schemas.fleet_maintenance__parts` | `invid` | text | 232 |
| `operation_schemas.sb_payments` | `invoiceid` | text | 228 |
| `operation_schemas.sb_payments` | `agentid` | text | 228 |
| `operation_schemas.pier_moves` | `itemid` | text | 218 |
| `operation_schemas.pier_moves` | `boatid` | text | 218 |
| `operation_schemas.pier_moves` | `finepaid` | boolean | 218 |
| `love_kingdom.hotel_extras` | `extra_id` | text | 172 |
| `operation_schemas.fleet_propellers__log` | `incidentid` | text | 160 |
| `love_kingdom.hotel_room_types` | `room_id` | text | 154 |
| `operation_schemas.fleet_memos` | `boatid` | text | 147 |
| `operation_schemas.fleet_memos` | `maintid` | text | 147 |
| `operation_schemas.fleet_memos` | `projectid` | text | 147 |
| `love_kingdom.booking_items` | `product_id` | text | 143 |
| `love_kingdom.booking_items` | `variant_id` | text | 143 |
| `love_kingdom.booking_items` | `route_id` | text | 143 |

_…and 66 more — see `inventory.json`._

### 2.3 Foreign keys that DO exist

| Table | Constraint | Definition |
|---|---|---|
| `love_kingdom.booking_item_rooms` | `booking_item_rooms_item_id_fkey` | `FOREIGN KEY (item_id) REFERENCES love_kingdom.booking_items(id) ON DELETE CASCADE` |
| `love_kingdom.booking_items` | `booking_items_booking_id_fkey` | `FOREIGN KEY (booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE CASCADE` |
| `love_kingdom.booking_items` | `booking_items_promo_id_fkey` | `FOREIGN KEY (promo_id) REFERENCES love_kingdom.promotions(id)` |
| `love_kingdom.bookings` | `bookings_payment_method_id_fkey` | `FOREIGN KEY (payment_method_id) REFERENCES love_kingdom.payment_methods(id)` |
| `love_kingdom.bookings` | `bookings_channel_id_fkey` | `FOREIGN KEY (channel_id) REFERENCES love_kingdom.b2c_channels(id)` |
| `love_kingdom.bookings` | `bookings_customer_id_fkey` | `FOREIGN KEY (customer_id) REFERENCES love_kingdom.customers(id)` |
| `love_kingdom.credit_applications` | `credit_applications_booking_id_fkey` | `FOREIGN KEY (booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE CASCADE` |
| `love_kingdom.credit_applications` | `credit_applications_credit_note_id_fkey` | `FOREIGN KEY (credit_note_id) REFERENCES love_kingdom.credit_notes(id) ON DELETE CASCADE` |
| `love_kingdom.credit_notes` | `credit_notes_source_booking_id_fkey` | `FOREIGN KEY (source_booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE CASCADE` |
| `love_kingdom.hotel_extras` | `hotel_extras_hotel_id_fkey` | `FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id) ON DELETE CASCADE` |
| `love_kingdom.hotel_room_types` | `hotel_room_types_hotel_id_fkey` | `FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id) ON DELETE CASCADE` |
| `love_kingdom.partner_boats` | `partner_boats_partner_id_fkey` | `FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE` |
| `love_kingdom.partner_classes` | `partner_classes_partner_id_fkey` | `FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE` |
| `love_kingdom.partner_pricing` | `partner_pricing_partner_id_fkey` | `FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE` |
| `love_kingdom.partner_routes` | `partner_routes_partner_id_fkey` | `FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE` |
| `love_kingdom.partner_time_slots` | `partner_time_slots_partner_id_fkey` | `FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE` |
| `love_kingdom.pricing_b2c` | `pricing_b2c_program_id_fkey` | `FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_own(id) ON DELETE CASCADE` |
| `love_kingdom.private_own_pricing` | `private_own_pricing_boat_id_fkey` | `FOREIGN KEY (boat_id) REFERENCES love_kingdom.private_boats(id) ON DELETE CASCADE` |
| `love_kingdom.private_own_pricing` | `private_own_pricing_route_id_fkey` | `FOREIGN KEY (route_id) REFERENCES love_kingdom.private_routes(id) ON DELETE CASCADE` |
| `love_kingdom.program_own_addons` | `program_own_addons_variant_id_fkey` | `FOREIGN KEY (variant_id) REFERENCES love_kingdom.addon_variants(id)` |
| `love_kingdom.program_own_addons` | `program_own_addons_program_id_fkey` | `FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_own(id) ON DELETE CASCADE` |
| `love_kingdom.program_third_variants` | `program_third_variants_program_id_fkey` | `FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_third(id) ON DELETE CASCADE` |
| `love_kingdom.promo_daytrip_seasons` | `promo_daytrip_seasons_promotion_id_fkey` | `FOREIGN KEY (promotion_id) REFERENCES love_kingdom.promotions(id) ON DELETE CASCADE` |
| `love_kingdom.promo_daytrip_seasons` | `promo_daytrip_seasons_program_id_fkey` | `FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_own(id)` |
| `love_kingdom.promo_hotel_extras_seasons` | `promo_hotel_extras_seasons_hotel_id_fkey` | `FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id)` |
| `love_kingdom.promo_hotel_extras_seasons` | `promo_hotel_extras_seasons_promotion_id_fkey` | `FOREIGN KEY (promotion_id) REFERENCES love_kingdom.promotions(id) ON DELETE CASCADE` |
| `love_kingdom.promo_hotel_seasons` | `promo_hotel_seasons_hotel_id_fkey` | `FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id)` |
| `love_kingdom.promo_hotel_seasons` | `promo_hotel_seasons_pool_id_fkey` | `FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE SET NULL` |
| `love_kingdom.promo_hotel_seasons` | `promo_hotel_seasons_promotion_id_fkey` | `FOREIGN KEY (promotion_id) REFERENCES love_kingdom.promotions(id) ON DELETE CASCADE` |
| `love_kingdom.promo_thirdparty_seasons` | `promo_thirdparty_seasons_pool_id_fkey` | `FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE SET NULL` |
| `love_kingdom.promo_thirdparty_seasons` | `promo_thirdparty_seasons_promotion_id_fkey` | `FOREIGN KEY (promotion_id) REFERENCES love_kingdom.promotions(id) ON DELETE CASCADE` |
| `love_kingdom.promo_thirdparty_seasons` | `promo_thirdparty_seasons_program_id_fkey` | `FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_third(id)` |
| `love_kingdom.voucher_codes` | `voucher_codes_pool_id_fkey` | `FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE CASCADE` |
| `love_kingdom.voucher_codes` | `voucher_codes_assigned_booking_id_fkey` | `FOREIGN KEY (assigned_booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE SET NULL` |
| `love_kingdom.voucher_pool_activities` | `voucher_pool_activities_program_id_fkey` | `FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_third(id) ON DELETE CASCADE` |
| `love_kingdom.voucher_pool_activities` | `voucher_pool_activities_pool_id_fkey` | `FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE CASCADE` |
| `love_kingdom.voucher_pool_hotels` | `voucher_pool_hotels_pool_id_fkey` | `FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE CASCADE` |
| `love_kingdom.voucher_pool_hotels` | `voucher_pool_hotels_hotel_id_fkey` | `FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id) ON DELETE CASCADE` |
| `love_kingdom.vouchers` | `vouchers_booking_id_fkey` | `FOREIGN KEY (booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE CASCADE` |
| `operation_schemas.boats__assignments` | `fk_boats_assignments` | `FOREIGN KEY (boats_id) REFERENCES operation_schemas.boats(id) ON DELETE CASCADE` |
| `operation_schemas.boats__docs` | `fk_boats_docs` | `FOREIGN KEY (boats_id) REFERENCES operation_schemas.boats(id) ON DELETE CASCADE` |
| `operation_schemas.boats__log` | `fk_boats_log` | `FOREIGN KEY (boats_id) REFERENCES operation_schemas.boats(id) ON DELETE CASCADE` |
| `operation_schemas.boats__repairhistory` | `fk_boats_repairhistory` | `FOREIGN KEY (boats_id) REFERENCES operation_schemas.boats(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_daily__trips` | `fleet_daily__trips_fleet_daily_id_fkey` | `FOREIGN KEY (fleet_daily_id) REFERENCES operation_schemas.fleet_daily(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_engines__log` | `fk_fleet_engines_log` | `FOREIGN KEY (fleet_engines_id) REFERENCES operation_schemas.fleet_engines(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_gearboxes__log` | `fk_fleet_gearboxes_log` | `FOREIGN KEY (fleet_gearboxes_id) REFERENCES operation_schemas.fleet_gearboxes(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_incidents__damagedassets` | `fk_fleet_incidents_damagedassets` | `FOREIGN KEY (fleet_incidents_id) REFERENCES operation_schemas.fleet_incidents(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_incidents__progresslog` | `fk_fleet_incidents_progresslog` | `FOREIGN KEY (fleet_incidents_id) REFERENCES operation_schemas.fleet_incidents(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_incidents__relatedmaintids` | `fk_fleet_incidents_relatedmaintids` | `FOREIGN KEY (fleet_incidents_id) REFERENCES operation_schemas.fleet_incidents(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_inventory__history` | `fk_fleet_inventory_history` | `FOREIGN KEY (fleet_inventory_id) REFERENCES operation_schemas.fleet_inventory(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_inventory__stocks` | `fk_fleet_inventory_stocks` | `FOREIGN KEY (fleet_inventory_id) REFERENCES operation_schemas.fleet_inventory(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_maintenance__assets` | `fk_fleet_maintenance_assets` | `FOREIGN KEY (fleet_maintenance_id) REFERENCES operation_schemas.fleet_maintenance(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_maintenance__parts` | `fk_fleet_maintenance_parts` | `FOREIGN KEY (fleet_maintenance_id) REFERENCES operation_schemas.fleet_maintenance(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_maintenance__progresslog` | `fk_fleet_maintenance_progresslog` | `FOREIGN KEY (fleet_maintenance_id) REFERENCES operation_schemas.fleet_maintenance(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_memos__items` | `fk_fleet_memos_items` | `FOREIGN KEY (fleet_memos_id) REFERENCES operation_schemas.fleet_memos(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_projects__log` | `fk_fleet_projects_log` | `FOREIGN KEY (fleet_projects_id) REFERENCES operation_schemas.fleet_projects(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_projects__plan` | `fk_fleet_projects_plan` | `FOREIGN KEY (fleet_projects_id) REFERENCES operation_schemas.fleet_projects(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_propellers__log` | `fk_fleet_propellers_log` | `FOREIGN KEY (fleet_propellers_id) REFERENCES operation_schemas.fleet_propellers(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_safety__inspections` | `fk_fleet_safety_inspections` | `FOREIGN KEY (fleet_safety_id) REFERENCES operation_schemas.fleet_safety(id) ON DELETE CASCADE` |
| `operation_schemas.fleet_safety__log` | `fk_fleet_safety_log` | `FOREIGN KEY (fleet_safety_id) REFERENCES operation_schemas.fleet_safety(id) ON DELETE CASCADE` |
| `operation_schemas.routes__overrides` | `routes__overrides_routes_id_fkey` | `FOREIGN KEY (routes_id) REFERENCES operation_schemas.routes(id) ON DELETE CASCADE` |
| `operation_schemas.routes__seasons` | `fk_routes_seasons` | `FOREIGN KEY (routes_id) REFERENCES operation_schemas.routes(id) ON DELETE CASCADE` |
| `operation_schemas.routes__times` | `fk_routes_times` | `FOREIGN KEY (routes_id) REFERENCES operation_schemas.routes(id) ON DELETE CASCADE` |
| `operation_schemas.sb_agents__activity` | `fk_sb_agents_activity` | `FOREIGN KEY (sb_agents_id) REFERENCES operation_schemas.sb_agents(id) ON DELETE CASCADE` |
| `operation_schemas.sb_agents__contracthistory` | `fk_sb_agents_contracthistory` | `FOREIGN KEY (sb_agents_id) REFERENCES operation_schemas.sb_agents(id) ON DELETE CASCADE` |
| `operation_schemas.sb_agents__programperiods` | `fk_sb_agents_programperiods` | `FOREIGN KEY (sb_agents_id) REFERENCES operation_schemas.sb_agents(id) ON DELETE CASCADE` |
| `operation_schemas.sb_agents__programs` | `fk_sb_agents_programs` | `FOREIGN KEY (sb_agents_id) REFERENCES operation_schemas.sb_agents(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__addons` | `fk_sb_bookings_addons` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__adjustments` | `fk_sb_bookings_adjustments` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__feeitems` | `fk_sb_bookings_feeitems` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__history` | `fk_sb_bookings_history` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__over` | `fk_sb_bookings_over` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__partialcancels` | `fk_sb_bookings_partialcancels` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__passengers` | `fk_sb_bookings_passengers` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__trips` | `fk_sb_bookings_trips` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_bookings__upgrades` | `fk_sb_bookings_upgrades` | `FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE` |
| `operation_schemas.sb_invoices__bookingids` | `fk_sb_invoices_bookingids` | `FOREIGN KEY (sb_invoices_id) REFERENCES operation_schemas.sb_invoices(id) ON DELETE CASCADE` |
| `operation_schemas.sb_invoices__lineitems` | `fk_sb_invoices_lineitems` | `FOREIGN KEY (sb_invoices_id) REFERENCES operation_schemas.sb_invoices(id) ON DELETE CASCADE` |
| `operation_schemas.sb_markets__subs` | `fk_sb_markets_subs` | `FOREIGN KEY (sb_markets_id) REFERENCES operation_schemas.sb_markets(id) ON DELETE CASCADE` |
| `operation_schemas.sb_pickup_time_profiles__times` | `fk_sb_pickup_time_profiles_times` | `FOREIGN KEY (sb_pickup_time_profiles_id) REFERENCES operation_schemas.sb_pickup_time_profiles(id) ON DELETE CASCADE` |
| `operation_schemas.sb_rate_types__addons` | `fk_sb_rate_types_addons` | `FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE` |
| `operation_schemas.sb_rate_types__charterrates` | `fk_sb_rate_types_charterrates` | `FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE` |
| `operation_schemas.sb_rate_types__routebundles` | `fk_sb_rate_types_routebundles` | `FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE` |
| `operation_schemas.sb_rate_types__routes` | `fk_sb_rate_types_routes` | `FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE` |
| `operation_schemas.sb_rate_types__routevalidity` | `fk_sb_rate_types_routevalidity` | `FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE` |
| `operation_schemas.sb_rate_types__seatrates` | `fk_sb_rate_types_seatrates` | `FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE` |
| `operation_schemas.sb_seat_locks__log` | `fk_sb_seat_locks_log` | `FOREIGN KEY (sb_seat_locks_id) REFERENCES operation_schemas.sb_seat_locks(id) ON DELETE CASCADE` |
| `operation_schemas.sb_vehicles__dayroute` | `sb_vehicles__dayroute_sb_vehicles_id_fkey` | `FOREIGN KEY (sb_vehicles_id) REFERENCES operation_schemas.sb_vehicles(id) ON DELETE CASCADE` |
| `operation_schemas.sb_vehicles__daystatus` | `sb_vehicles__daystatus_sb_vehicles_id_fkey` | `FOREIGN KEY (sb_vehicles_id) REFERENCES operation_schemas.sb_vehicles(id) ON DELETE CASCADE` |
| `operation_schemas.sb_vehicles__log` | `fk_sb_vehicles_log` | `FOREIGN KEY (sb_vehicles_id) REFERENCES operation_schemas.sb_vehicles(id) ON DELETE CASCADE` |
| `operation_schemas.sb_vehicles__statusranges` | `fk_sb_vehicles_statusranges` | `FOREIGN KEY (sb_vehicles_id) REFERENCES operation_schemas.sb_vehicles(id) ON DELETE CASCADE` |

## 3. Views

| Schema | View |
|---|---|
| `operation_schemas` | `v_seat_availability` |
| `operation_schemas` | `v_seat_availability_unmapped` |

Full definitions are in `inventory.json` under `views[]`, captured from `pg_get_viewdef`.

## 4. Enum types

None — every status/enum-like column is free text or a CHECK.

## 5. Largest tables

| Table | Rows |
|---|---:|
| `operation_schemas.sb_bookings__history` | 8,984 |
| `operation_schemas.nat_learn` | 7,231 |
| `allotment.attachments` | 3,038 |
| `operation_schemas.sb_bookings__trips` | 2,873 |
| `operation_schemas.sb_bookings` | 2,870 |
| `operation_schemas.insurance_overrides` | 2,748 |
| `operation_schemas.sb_bookings__passengers` | 2,507 |
| `operation_schemas.sb_contracts__programperiods` | 2,111 |
| `operation_schemas.sb_vehicles__log` | 1,688 |
| `operation_schemas.sb_agents__programperiods` | 1,621 |
| `operation_schemas.sb_agents__programs` | 1,597 |
| `public.report_agent_sales_7m_2026` | 1,313 |
| `operation_schemas.sb_seat_locks__log` | 925 |
| `operation_schemas.sb_contracts` | 792 |
| `operation_schemas.sb_agents` | 771 |
| `operation_schemas.sb_agents_rate_bindings` | 771 |
| `operation_schemas.fleet_inventory__history` | 734 |
| `operation_schemas.sb_vehicles__dayroute` | 663 |
| `operation_schemas.sb_agents__activity` | 637 |
| `operation_schemas.fleet_memos__items` | 603 |
| `operation_schemas.fleet_maintenance__progresslog` | 590 |
| `operation_schemas.sb_vehicles__daystatus` | 589 |
| `operation_schemas.vanjob_pickup_th` | 542 |
| `operation_schemas.fleet_inventory__stocks` | 462 |
| `operation_schemas.fleet_incidents__progresslog` | 459 |

## 6. Full table inventory

| Table | Kind | Rows | Cols | PK | FKs | Idx |
|---|---|---:|---:|---|---:|---:|
| `allotment.app_state` | r | 2 | 5 | `id` | 0 | 1 |
| `allotment.attachments` | r | 3,038 | 8 | `id` | 0 | 2 |
| `allotment.schema_migrations` | r | 19 | 6 | `name` | 0 | 1 |
| `allotment.users` | r | 16 | 9 | — | 0 | 0 |
| `love_kingdom.addon_variants` | r | 5 | 3 | `id` | 0 | 1 |
| `love_kingdom.b2c_channels` | r | 6 | 4 | `id` | 0 | 1 |
| `love_kingdom.bed_types` | r | 5 | 2 | `id` | 0 | 1 |
| `love_kingdom.booking_item_rooms` | r | 12 | 13 | `id` | 1 | 2 |
| `love_kingdom.booking_items` | r | 143 | 32 | `id` | 2 | 6 |
| `love_kingdom.bookings` | r | 112 | 41 | `id` | 3 | 5 |
| `love_kingdom.credit_applications` | r | 4 | 6 | `id` | 2 | 3 |
| `love_kingdom.credit_notes` | r | 7 | 11 | `id` | 1 | 3 |
| `love_kingdom.customers` | r | 91 | 7 | `id` | 0 | 1 |
| `love_kingdom.hotel_extras` | r | 172 | 7 | `id` | 1 | 2 |
| `love_kingdom.hotel_room_types` | r | 154 | 9 | `id` | 1 | 2 |
| `love_kingdom.hotels` | r | 48 | 10 | `id` | 0 | 1 |
| `love_kingdom.partner_boats` | r | 4 | 7 | `id` | 1 | 2 |
| `love_kingdom.partner_classes` | r | 2 | 6 | `id` | 1 | 2 |
| `love_kingdom.partner_pricing` | r | 20 | 9 | `id` | 1 | 2 |
| `love_kingdom.partner_routes` | r | 2 | 5 | `id` | 1 | 2 |
| `love_kingdom.partner_time_slots` | r | 5 | 7 | `id` | 1 | 2 |
| `love_kingdom.payment_methods` | r | 3 | 2 | `id` | 0 | 1 |
| `love_kingdom.pricing_b2c` | r | 6 | 5 | `program_id` | 1 | 1 |
| `love_kingdom.private_boats` | r | 4 | 6 | `id` | 0 | 1 |
| `love_kingdom.private_own_pricing` | r | 16 | 6 | `boat_id, route_id` | 2 | 1 |
| `love_kingdom.private_partners` | r | 1 | 8 | `id` | 0 | 1 |
| `love_kingdom.private_routes` | r | 4 | 4 | `id` | 0 | 1 |
| `love_kingdom.program_own_addons` | r | 23 | 8 | `id` | 2 | 3 |
| `love_kingdom.program_third_variants` | r | 29 | 7 | `id` | 1 | 2 |
| `love_kingdom.programs_own` | r | 6 | 9 | `id` | 0 | 1 |
| `love_kingdom.programs_third` | r | 9 | 9 | `id` | 0 | 1 |
| `love_kingdom.promo_daytrip_seasons` | r | 17 | 10 | `id` | 2 | 1 |
| `love_kingdom.promo_hotel_extras_seasons` | r | 293 | 11 | `id` | 2 | 3 |
| `love_kingdom.promo_hotel_seasons` | r | 318 | 18 | `id` | 3 | 1 |
| `love_kingdom.promo_thirdparty_seasons` | r | 4 | 19 | `id` | 3 | 1 |
| `love_kingdom.promotions` | r | 4 | 15 | `id` | 0 | 1 |
| `love_kingdom.users` | r | 10 | 6 | `email` | 0 | 1 |
| `love_kingdom.van_types` | r | 2 | 4 | `id` | 0 | 1 |
| `love_kingdom.voucher_codes` | r | 0 | 16 | `id` | 2 | 5 |
| `love_kingdom.voucher_pool_activities` | r | 0 | 3 | `pool_id, program_id, variant_id` | 2 | 1 |
| `love_kingdom.voucher_pool_hotels` | r | 0 | 2 | `pool_id, hotel_id` | 2 | 1 |
| `love_kingdom.voucher_pools` | r | 0 | 12 | `id` | 0 | 1 |
| `love_kingdom.vouchers` | r | 100 | 5 | `id` | 1 | 2 |
| `operation_schemas.agent_artifacts` | r | 6 | 3 | `id` | 0 | 1 |
| `operation_schemas.app_hooks` | r | 86 | 3 | `id` | 0 | 1 |
| `operation_schemas.app_meta` | r | 26 | 2 | — | 0 | 0 |
| `operation_schemas.app_state` | r | 1 | 5 | `id` | 0 | 1 |
| `operation_schemas.attachments` | r | 0 | 8 | `id` | 0 | 2 |
| `operation_schemas.boat_capovr` | r | 2 | 6 | `id` | 0 | 1 |
| `operation_schemas.boats` | r | 16 | 32 | `id` | 0 | 1 |
| `operation_schemas.boats__assignments` | r | 6 | 13 | `row_pk` | 1 | 1 |
| `operation_schemas.boats__docs` | r | 76 | 6 | `row_pk` | 1 | 1 |
| `operation_schemas.boats__log` | r | 106 | 14 | `row_pk` | 1 | 1 |
| `operation_schemas.boats__repairhistory` | r | 36 | 14 | `row_pk` | 1 | 1 |
| `operation_schemas.boats__repairhistory__assets` | r | 327 | 4 | `row_pk` | 0 | 1 |
| `operation_schemas.contract_templates` | r | 8 | 3 | `id` | 0 | 1 |
| `operation_schemas.fleet_consumable_logs` | r | 1 | 14 | `id` | 0 | 1 |
| `operation_schemas.fleet_daily` | r | 72 | 9 | `id` | 0 | 1 |
| `operation_schemas.fleet_daily__boat` | r | 143 | 4 | `row_pk` | 0 | 2 |
| `operation_schemas.fleet_daily__trips` | r | 147 | 5 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_drlock` | r | 69 | 4 | `id` | 0 | 1 |
| `operation_schemas.fleet_engines` | r | 53 | 16 | `id` | 0 | 1 |
| `operation_schemas.fleet_engines__log` | r | 109 | 13 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_fuelprice` | r | 69 | 8 | `id` | 0 | 1 |
| `operation_schemas.fleet_gearboxes` | r | 59 | 21 | `id` | 0 | 1 |
| `operation_schemas.fleet_gearboxes__log` | r | 137 | 14 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_incidents` | r | 61 | 16 | `id` | 0 | 1 |
| `operation_schemas.fleet_incidents__damagedassets` | r | 71 | 12 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_incidents__progresslog` | r | 459 | 7 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_incidents__relatedmaintids` | r | 12 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_inventory` | r | 367 | 15 | `id` | 0 | 1 |
| `operation_schemas.fleet_inventory__history` | r | 734 | 12 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_inventory__history__changes` | r | 64 | 6 | `row_pk` | 0 | 1 |
| `operation_schemas.fleet_inventory__stocks` | r | 462 | 6 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_maintenance` | r | 87 | 19 | `id` | 0 | 1 |
| `operation_schemas.fleet_maintenance__assets` | r | 90 | 11 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_maintenance__parts` | r | 232 | 10 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_maintenance__progresslog` | r | 590 | 7 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_memos` | r | 147 | 40 | `id` | 0 | 1 |
| `operation_schemas.fleet_memos__items` | r | 603 | 16 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_projects` | r | 19 | 16 | `id` | 0 | 1 |
| `operation_schemas.fleet_projects__log` | r | 131 | 6 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_projects__plan` | r | 32 | 8 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_propellers` | r | 62 | 21 | `id` | 0 | 1 |
| `operation_schemas.fleet_propellers__log` | r | 160 | 12 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_safety` | r | 94 | 15 | `id` | 0 | 1 |
| `operation_schemas.fleet_safety__inspections` | r | 4 | 8 | `row_pk` | 1 | 1 |
| `operation_schemas.fleet_safety__log` | r | 98 | 6 | `row_pk` | 1 | 1 |
| `operation_schemas.insurance_overrides` | r | 2,748 | 3 | `id` | 0 | 1 |
| `operation_schemas.meal_venues` | r | 3 | 9 | `id` | 0 | 1 |
| `operation_schemas.nat_learn` | r | 7,231 | 3 | `id` | 0 | 1 |
| `operation_schemas.pier_cfg` | r | 7 | 3 | — | 0 | 0 |
| `operation_schemas.pier_codes` | r | 11 | 8 | — | 0 | 1 |
| `operation_schemas.pier_duty` | r | 7 | 3 | — | 0 | 0 |
| `operation_schemas.pier_items` | r | 30 | 7 | — | 0 | 1 |
| `operation_schemas.pier_job` | r | 22 | 3 | — | 0 | 0 |
| `operation_schemas.pier_kinds` | r | 3 | 7 | `id` | 0 | 1 |
| `operation_schemas.pier_lic_classes` | r | 4 | 6 | — | 0 | 1 |
| `operation_schemas.pier_lic_types` | r | 2 | 6 | — | 0 | 0 |
| `operation_schemas.pier_licenses` | r | 26 | 8 | — | 0 | 2 |
| `operation_schemas.pier_moves` | r | 218 | 13 | — | 0 | 3 |
| `operation_schemas.pier_sect` | r | 5 | 4 | `id` | 0 | 1 |
| `operation_schemas.pier_shift` | r | 124 | 3 | — | 0 | 0 |
| `operation_schemas.pier_staff` | r | 37 | 11 | — | 0 | 1 |
| `operation_schemas.pier_team` | r | 0 | 3 | — | 0 | 0 |
| `operation_schemas.routes` | r | 14 | 8 | `id` | 0 | 1 |
| `operation_schemas.routes__overrides` | r | 271 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.routes__seasons` | r | 28 | 7 | `row_pk` | 1 | 1 |
| `operation_schemas.routes__times` | r | 14 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_agents` | r | 771 | 39 | `id` | 0 | 1 |
| `operation_schemas.sb_agents__activity` | r | 637 | 7 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_agents__contracthistory` | r | 7 | 14 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_agents__programperiods` | r | 1,621 | 9 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_agents__programs` | r | 1,597 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_agents_rate_bindings` | r | 771 | 2 | `id` | 0 | 1 |
| `operation_schemas.sb_bookings` | r | 2,870 | 146 | `id` | 0 | 1 |
| `operation_schemas.sb_bookings__addons` | r | 212 | 8 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_bookings__adjustments` | r | 42 | 8 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_bookings__feeitems` | r | 15 | 7 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_bookings__history` | r | 8,984 | 8 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_bookings__over` | r | 0 | 10 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_bookings__partialcancels` | r | 9 | 20 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_bookings__passengers` | r | 2,507 | 7 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_bookings__trips` | r | 2,873 | 46 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_bookings__upgrades` | r | 4 | 18 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_contracts` | r | 792 | 13 | `id` | 0 | 1 |
| `operation_schemas.sb_contracts__programperiods` | r | 2,111 | 9 | `row_pk` | 0 | 2 |
| `operation_schemas.sb_extras` | r | 61 | 17 | `id` | 0 | 1 |
| `operation_schemas.sb_invoices` | r | 286 | 16 | `id` | 0 | 1 |
| `operation_schemas.sb_invoices__bookingids` | r | 286 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_invoices__lineitems` | r | 47 | 5 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_market_monthly` | r | 17 | 3 | `id` | 0 | 1 |
| `operation_schemas.sb_market_stats` | r | 46 | 3 | `id` | 0 | 1 |
| `operation_schemas.sb_markets` | r | 10 | 4 | `id` | 0 | 1 |
| `operation_schemas.sb_markets__subs` | r | 38 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_nationalities` | r | 48 | 4 | `id` | 0 | 1 |
| `operation_schemas.sb_payments` | r | 228 | 8 | `id` | 0 | 1 |
| `operation_schemas.sb_pickup_areas` | r | 48 | 5 | `id` | 0 | 1 |
| `operation_schemas.sb_pickup_time_profiles` | r | 1 | 7 | `id` | 0 | 1 |
| `operation_schemas.sb_pickup_time_profiles__times` | r | 13 | 51 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_pickup_times` | r | 3 | 17 | `id` | 0 | 1 |
| `operation_schemas.sb_rate_types` | r | 44 | 12 | `id` | 0 | 1 |
| `operation_schemas.sb_rate_types__addons` | r | 76 | 10 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_rate_types__addons__applies` | r | 83 | 4 | `row_pk` | 0 | 1 |
| `operation_schemas.sb_rate_types__addons__byroute` | r | 83 | 7 | `row_pk` | 0 | 1 |
| `operation_schemas.sb_rate_types__addons__r10` | r | 75 | 5 | `row_pk` | 0 | 1 |
| `operation_schemas.sb_rate_types__addons__r11` | r | 70 | 5 | `row_pk` | 0 | 1 |
| `operation_schemas.sb_rate_types__addons__r12` | r | 73 | 5 | `row_pk` | 0 | 1 |
| `operation_schemas.sb_rate_types__addons__r4` | r | 66 | 5 | `row_pk` | 0 | 1 |
| `operation_schemas.sb_rate_types__addons__r5` | r | 69 | 5 | `row_pk` | 0 | 1 |
| `operation_schemas.sb_rate_types__addons__r6` | r | 66 | 5 | `row_pk` | 0 | 1 |
| `operation_schemas.sb_rate_types__charterrates` | r | 100 | 9 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_rate_types__routebundles` | r | 30 | 6 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_rate_types__routes` | r | 229 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_rate_types__routevalidity` | r | 143 | 5 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_rate_types__seatrates` | r | 229 | 22 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_sales` | r | 7 | 11 | `id` | 0 | 1 |
| `operation_schemas.sb_seat_locks` | r | 298 | 21 | `id` | 0 | 1 |
| `operation_schemas.sb_seat_locks__log` | r | 925 | 11 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_staff` | r | 19 | 6 | `id` | 0 | 1 |
| `operation_schemas.sb_vehicles` | r | 24 | 15 | `id` | 0 | 1 |
| `operation_schemas.sb_vehicles__dayroute` | r | 663 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_vehicles__daystatus` | r | 589 | 4 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_vehicles__log` | r | 1,688 | 6 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_vehicles__statusranges` | r | 9 | 7 | `row_pk` | 1 | 1 |
| `operation_schemas.sb_weather` | r | 5 | 6 | `id` | 0 | 1 |
| `operation_schemas.travel_sum` | r | 17 | 7 | `id` | 0 | 1 |
| `operation_schemas.trip_actuals` | r | 10 | 3 | `id` | 0 | 1 |
| `operation_schemas.trips` | r | 338 | 52 | `id` | 0 | 1 |
| `operation_schemas.ts_cot` | r | 49 | 8 | `id` | 0 | 1 |
| `operation_schemas.users` | r | 24 | 12 | `id` | 0 | 2 |
| `operation_schemas.v_seat_availability` | v | ? | 8 | — | 0 | 0 |
| `operation_schemas.v_seat_availability_unmapped` | v | ? | 8 | — | 0 | 0 |
| `operation_schemas.vanjob_driver` | r | 1 | 5 | `id` | 0 | 1 |
| `operation_schemas.vanjob_pickup_th` | r | 542 | 3 | `id` | 0 | 1 |
| `operation_schemas.vanjob_sent` | r | 260 | 3 | `id` | 0 | 1 |
| `operation_schemas.vanjob_sreq` | r | 4 | 3 | `id` | 0 | 1 |
| `operation_schemas.vanjob_th_flag` | r | 0 | 3 | `id` | 0 | 1 |
| `public.app_state` | r | 1 | 5 | `id` | 0 | 1 |
| `public.attachments` | r | 0 | 8 | `id` | 0 | 2 |
| `public.meal_venues` | r | 0 | 9 | `id` | 0 | 1 |
| `public.pier_kinds` | r | 0 | 7 | `id` | 0 | 1 |
| `public.pier_sect` | r | 0 | 4 | `id` | 0 | 1 |
| `public.report_agent_sales_7m_2026` | r | 1,313 | 13 | `id` | 0 | 5 |
| `public.trip_actuals` | r | 0 | 3 | `id` | 0 | 1 |
| `public.users` | r | 0 | 10 | `id` | 0 | 2 |

---

## 7. Cross-schema reality — the finding that reshapes the plan

The rewrite plan was written assuming one schema. There are four, and **booking data is spread
across three of them with no enforced relationship between any of them.**

### 7.1 Where booking data actually lives

| Schema | Table | Rows | Role |
|---|---|---:|---|
| `operation_schemas` | `sb_bookings` | 2,870 | The ops app's bookings. 144 are `b2c_`-prefixed |
| `operation_schemas` | `sb_bookings__trips` | 2,873 | Child trips, joined by `sb_bookings_id` (no FK) |
| `love_kingdom` | `bookings` | 112 | **B2C's own bookings**, ids like `BK-001`, `LOV-0049646` |
| `love_kingdom` | `booking_items` | 143 | B2C line items |
| `allotment` | `attachments` | 3,038 | **Booking attachments live in a third schema**, keyed by `booking_id`, no FK |

### 7.2 The B2C sync is lossy and unenforced

The link between B2C and ops is a **string prefix**, not a key: ops `b2c_<lkId>[_<n>]` → `love_kingdom.bookings.id`.

| Measurement | Count |
|---|---:|
| ops rows with a `b2c_` prefix | 144 |
| distinct base ids after stripping the prefix and `_N` suffix | 133 |
| `love_kingdom.bookings` rows | 112 |
| ops rows whose base matches an lk booking (prefix match) | 122 |
| ops rows matching an lk id **exactly** | 3 |
| **ops `b2c_` rows with NO love_kingdom parent** | **22** |
| **love_kingdom bookings never synced to ops** | **1** |

One B2C booking fans out into several ops rows (`b2c_BK-001`, `b2c_BK-001_1`, `b2c_BK-001_4`),
so the relationship is one-to-many via a naming convention that nothing validates.

### 7.3 Orphans that already exist

| Orphan | Count |
|---|---:|
| `allotment.attachments` pointing at no `sb_bookings` row | 118 |
| ops `b2c_` bookings with no `love_kingdom` parent | 22 |

These must be triaged before any FK can be added — adding the constraint will fail otherwise.

### 7.4 `public` and `allotment` look like abandoned scaffolding

`public` holds 8 tables of which 6 are empty and several duplicate names in other schemas
(`attachments`, `users`, `app_state`, `trip_actuals`). `allotment` holds the live
`attachments` table plus a `schema_migrations` table with 19 rows — evidence of an older
migration lineage unrelated to the deleted `db/migrations/`.

**Do not assume either schema is dead.** `allotment.attachments` has 3,038 live rows and
`public.report_agent_sales_7m_2026` has 1,313.

### 7.5 Other facts worth carrying into the design

- **No enum types exist anywhere.** Every status column is free text. The 8-value booking status
  set is a convention, not a constraint.
- `love_kingdom` is **better modelled than `operation_schemas`**: 39/39 tables have a PK and 24 have
  FKs, versus 120/133 and 52/133. When merging the two models, prefer love_kingdom's shapes.
- The server is **PostgreSQL 18.4**. `pg_dump` 17 refuses to dump it — use
  `/c/Program Files/PostgreSQL/18/bin/pg_dump`.
- `operation_schemas` has **133 tables**, not the ~103 quoted in `CLAUDE.md`.
