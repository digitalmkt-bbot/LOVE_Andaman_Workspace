-- ============================================================
-- Migration 002: Add operation_schemas to Database A
-- Safe: does NOT drop anything. All CREATE statements use
-- IF NOT EXISTS so this is idempotent and can be re-run.
-- Does NOT touch existing public.* tables.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS operation_schemas;

CREATE TABLE IF NOT EXISTS operation_schemas."app_meta" (
    "key" text,
    "value" text
);

CREATE TABLE IF NOT EXISTS operation_schemas."routes" (
    "id" text,
    "name" text,
    "islands" text,
    "color" text,
    "pier" text,
    "overrides_2026_05_31" text,
    "overrides_2026_05_30" text,
    "overrides_2026_06_07" text,
    "overrides_2026_06_14" text,
    "overrides_2026_06_21" text,
    "overrides_2026_06_28" text,
    "overrides_2026_06_29" text,
    "overrides_2026_06_22" text,
    "overrides_2026_06_15" text,
    "overrides_2026_06_08" text,
    "overrides_2026_06_01" text,
    "overrides_2026_06_02" text,
    "overrides_2026_06_09" text,
    "overrides_2026_06_16" text,
    "overrides_2026_06_23" text,
    "overrides_2026_06_30" text,
    "overrides_2026_06_25" text,
    "overrides_2026_06_18" text,
    "overrides_2026_06_11" text,
    "overrides_2026_06_04" text,
    "overrides_2026_06_05" text,
    "overrides_2026_06_19" text,
    "overrides_2026_06_12" text,
    "overrides_2026_06_26" text,
    "overrides_2026_06_27" text,
    "overrides_2026_06_20" text,
    "overrides_2026_06_13" text,
    "overrides_2026_06_06" text,
    "overrides_2026_06_03" text,
    "overrides_2026_06_10" text,
    "overrides_2026_06_17" text,
    "overrides_2026_06_24" text,
    "overrides_2026_07_05" text,
    "overrides_2026_07_06" text,
    "overrides_2026_07_13" text,
    "overrides_2026_07_12" text,
    "overrides_2026_07_19" text,
    "overrides_2026_07_20" text,
    "overrides_2026_07_27" text,
    "overrides_2026_07_26" text,
    "overrides_2026_07_01" text,
    "overrides_2026_07_08" text,
    "overrides_2026_07_15" text,
    "overrides_2026_07_22" text,
    "overrides_2026_07_29" text,
    "overrides_2026_07_30" text,
    "overrides_2026_07_23" text,
    "overrides_2026_07_16" text,
    "overrides_2026_07_09" text,
    "overrides_2026_07_02" text,
    "overrides_2026_07_03" text,
    "overrides_2026_07_10" text,
    "overrides_2026_07_17" text,
    "overrides_2026_07_31" text,
    "overrides_2026_07_24" text,
    "overrides_2026_07_25" text,
    "overrides_2026_07_18" text,
    "overrides_2026_07_11" text,
    "overrides_2026_07_04" text,
    "overrides_2026_08_01" text,
    "overrides_2026_08_15" text,
    "overrides_2026_08_22" text,
    "overrides_2026_08_29" text,
    "overrides_2026_08_03" text,
    "overrides_2026_08_10" text,
    "overrides_2026_08_17" text,
    "overrides_2026_08_24" text,
    "overrides_2026_08_05" text,
    "overrides_2026_08_06" text,
    "overrides_2026_08_12" text,
    "overrides_2026_08_13" text,
    "overrides_2026_08_19" text,
    "overrides_2026_08_20" text,
    "overrides_2026_08_26" text,
    "overrides_2026_08_27" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."routes__times" (
    "routes_id" text,
    "idx" bigint,
    "row_pk" text,
    "value" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."routes__seasons" (
    "routes_id" text,
    "idx" bigint,
    "row_pk" text,
    "id" text,
    "type" text,
    "from" text,
    "to" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."boats" (
    "id" text,
    "name" text,
    "type" text,
    "pier" text,
    "cap" bigint,
    "enginecount" bigint,
    "use" text,
    "material" text,
    "reg" text,
    "callsign" text,
    "imo" text,
    "year" text,
    "homeportcity" text,
    "gt" double precision,
    "nt" double precision,
    "dwt" text,
    "loa" double precision,
    "beam" double precision,
    "depth" double precision,
    "draft" text,
    "lbp" double precision,
    "bhp" double precision,
    "licensepax" bigint,
    "crew" bigint,
    "fishcrew" text,
    "totalcap" bigint,
    "owner" text,
    "homeport" text,
    "owneraddr" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."boats__docs" (
    "boats_id" text,
    "idx" bigint,
    "row_pk" text,
    "name" text,
    "exp" text,
    "renewstatus" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."boats__log" (
    "boats_id" text,
    "idx" bigint,
    "row_pk" text,
    "id" text,
    "s" text,
    "from" text,
    "to" text,
    "loc" text,
    "note" text,
    "province" text,
    "loctype" text,
    "detail" text,
    "reason" text,
    "projectid" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."boats__repairhistory" (
    "boats_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "jobno" text,
    "title" text,
    "detail" text,
    "type" text,
    "location" text,
    "cost" double precision,
    "startdate" text,
    "enddate" text,
    "outcome" text,
    "closenote" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."boats__repairhistory__assets" (
    "boats_repairhistory_id" text,
    "idx" bigint,
    "row_pk" text,
    "value" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."boats__assignments" (
    "boats_id" text,
    "idx" bigint,
    "row_pk" text,
    "id" text,
    "type" text,
    "frompier" text,
    "topier" text,
    "startdate" text,
    "enddate" text,
    "reason" text,
    "cost" bigint,
    "status" text,
    "createddate" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."trips" (
    "id" text,
    "key" text,
    "b1_route" text,
    "b1_type" text,
    "b1_booked" bigint,
    "b3_route" text,
    "b3_type" text,
    "b3_booked" bigint,
    "b4_route" text,
    "b4_type" text,
    "b4_booked" bigint,
    "b5_route" text,
    "b5_type" text,
    "b5_booked" bigint,
    "b6_route" text,
    "b6_type" text,
    "b6_booked" bigint,
    "b7_route" text,
    "b7_type" text,
    "b7_booked" bigint,
    "b9_route" text,
    "b9_type" text,
    "b9_booked" bigint,
    "b10_route" text,
    "b10_type" text,
    "b10_booked" bigint,
    "b12_route" text,
    "b12_type" text,
    "b12_booked" bigint,
    "b11_route" text,
    "b11_type" text,
    "b11_booked" bigint,
    "b13_route" text,
    "b13_type" text,
    "b13_booked" bigint,
    "b2_route" text,
    "b2_type" text,
    "b2_booked" bigint,
    "b13_charterbookingid" text,
    "b6_charterbookingid" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_engines" (
    "id" text,
    "brand" text,
    "model" text,
    "serial" text,
    "hp" bigint,
    "boatid" text,
    "pos" text,
    "status" text,
    "basehours" double precision,
    "serviceinterval" bigint,
    "buydate" text,
    "note" text,
    "sparelocation" text,
    "price" text,
    "lastservicehours" double precision,
    "lastservicedate" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_engines__log" (
    "fleet_engines_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "type" text,
    "desc" text,
    "detail" text,
    "hours" double precision,
    "by" text,
    "cost" double precision,
    "outcome" text,
    "enginehours" bigint,
    "text" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_gearboxes" (
    "id" text,
    "boatid" text,
    "engineid" text,
    "brand" text,
    "model" text,
    "serial" text,
    "status" text,
    "basehours" bigint,
    "buydate" text,
    "note" text,
    "sparelocation" text,
    "shaftlength" text,
    "modelsuffix" text,
    "installhours" double precision,
    "rotation" text,
    "gearratio" text,
    "oilcapacity" text,
    "serviceinterval" bigint,
    "lastservicedate" text,
    "onboatid" text,
    "onboatpos" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_gearboxes__log" (
    "fleet_gearboxes_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "type" text,
    "desc" text,
    "enginehours" double precision,
    "fromloc" text,
    "toloc" text,
    "usedhours" bigint,
    "incidentid" text,
    "outcome" text,
    "detail" text,
    "text" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_propellers" (
    "id" text,
    "boatid" text,
    "gearboxid" text,
    "brand" text,
    "serial" text,
    "diameter" double precision,
    "pitch" double precision,
    "size" text,
    "blades" text,
    "material" text,
    "rotation" text,
    "hubsize" text,
    "cupping" text,
    "cost" bigint,
    "status" text,
    "buydate" text,
    "note" text,
    "sparelocation" text,
    "oldserial" text,
    "proppos" text,
    "engineid" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_propellers__log" (
    "fleet_propellers_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "type" text,
    "desc" text,
    "enginehours" bigint,
    "fromloc" text,
    "toloc" text,
    "incidentid" text,
    "detail" text,
    "outcome" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_daily" (
    "id" text,
    "key" text,
    "b2_fuel" double precision,
    "b10_fuel" double precision,
    "b6_fuel" double precision,
    "b13_fuel" double precision,
    "b12_fuel" double precision,
    "b10_paxactual" bigint,
    "b2_paxactual" bigint,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_daily__trips" (
    "fleet_daily_id" text,
    "key" text,
    "row_pk" text,
    "engines_e6" double precision,
    "engines_e33" bigint,
    "engines_e34" bigint,
    "engines_e35" bigint,
    "engines_e36" bigint,
    "engines_e7" double precision,
    "engines_e8" double precision,
    "engines_e20" double precision,
    "engines_e26" double precision,
    "engines_e27" double precision,
    "engines_e28" double precision,
    "engines_e43" bigint,
    "engines_e44" bigint,
    "engines_e51" bigint,
    "engines_e52" bigint,
    "engines_e45" double precision,
    "engines_e46" double precision,
    "engines_e47" double precision,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_maintenance" (
    "id" text,
    "no" text,
    "boatid" text,
    "type" text,
    "title" text,
    "detail" text,
    "location" text,
    "status" text,
    "startdate" text,
    "enddate" text,
    "cost" double precision,
    "incidentid" text,
    "boatstatus" text,
    "boatstatusreason" text,
    "setfixing" boolean,
    "outcome" text,
    "parentprojectid" text,
    "awaitinginvoice" boolean,
    "closenote" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_maintenance__assets" (
    "fleet_maintenance_id" text,
    "idx" bigint,
    "row_pk" text,
    "type" text,
    "engid" text,
    "label" text,
    "detail" text,
    "status" text,
    "gbid" text,
    "propid" text,
    "id" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_maintenance__progresslog" (
    "fleet_maintenance_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "text" text,
    "by" text,
    "createdat" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_maintenance__parts" (
    "fleet_maintenance_id" text,
    "idx" bigint,
    "row_pk" text,
    "invid" text,
    "name" text,
    "qty" bigint,
    "unit" text,
    "cost" double precision,
    "location" text,
    "date" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_incidents" (
    "id" text,
    "no" text,
    "boatid" text,
    "date" text,
    "time" text,
    "title" text,
    "detail" text,
    "remark" text,
    "priority" bigint,
    "severity" text,
    "type" text,
    "status" text,
    "maintid" text,
    "closeddate" text,
    "quickfix" boolean,
    "resolveddate" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_incidents__damagedassets" (
    "fleet_incidents_id" text,
    "idx" bigint,
    "row_pk" text,
    "type" text,
    "id" text,
    "label" text,
    "swapped" boolean,
    "swappedto" text,
    "swappeddate" text,
    "engid" text,
    "gbid" text,
    "propid" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_incidents__progresslog" (
    "fleet_incidents_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "text" text,
    "by" text,
    "createdat" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_incidents__relatedmaintids" (
    "fleet_incidents_id" text,
    "idx" bigint,
    "row_pk" text,
    "value" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_inventory" (
    "id" text,
    "name" text,
    "partno" text,
    "category" text,
    "supplier" text,
    "location" text,
    "unit" text,
    "qty" bigint,
    "minqty" bigint,
    "cost" double precision,
    "note" text,
    "totalqty" bigint,
    "primarylocation" text,
    "createddate" text,
    "createdfrom" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_inventory__history" (
    "fleet_inventory_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "type" text,
    "qty" bigint,
    "note" text,
    "by" text,
    "location" text,
    "jobid" text,
    "consumeid" text,
    "desc" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_inventory__stocks" (
    "fleet_inventory_id" text,
    "idx" bigint,
    "row_pk" text,
    "location" text,
    "qty" bigint,
    "minqty" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_inventory__history__changes" (
    "fleet_inventory_history_id" text,
    "idx" bigint,
    "row_pk" text,
    "field" text,
    "from" text,
    "to" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_memos" (
    "id" text,
    "no" text,
    "title" text,
    "boatid" text,
    "memotype" text,
    "proposer" text,
    "from" text,
    "to" text,
    "cc" text,
    "createddate" text,
    "status" text,
    "currentstep" bigint,
    "vatenabled" boolean,
    "vatrate" bigint,
    "refnote" text,
    "subtotal" double precision,
    "discount" double precision,
    "vat" double precision,
    "amount" double precision,
    "approvedby" text,
    "approveddate" text,
    "approvenote" text,
    "ordereddate" text,
    "receiveddate" text,
    "supplier" text,
    "discountpct" bigint,
    "maintid" text,
    "scope" text,
    "generalcategory" text,
    "note" text,
    "orderedby" text,
    "receivedby" text,
    "paiddate" text,
    "paidby" text,
    "paidvia" text,
    "discountamt" bigint,
    "afterdiscount" double precision,
    "receivedlocation" text,
    "receivedsummary" text,
    "projectid" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_memos__items" (
    "fleet_memos_id" text,
    "idx" bigint,
    "row_pk" text,
    "name" text,
    "qty" bigint,
    "price" double precision,
    "category" text,
    "partno" text,
    "invid" text,
    "unit" text,
    "frominventory" boolean,
    "discountpct" bigint,
    "autoregister" boolean,
    "inventorysnapshot_cost" double precision,
    "inventorysnapshot_primarylocation" text,
    "inventorysnapshot_qtyatselection" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."app_hooks" (
    "id" text,
    "key" text,
    "value" boolean,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types" (
    "id" text,
    "code" text,
    "name" text,
    "note" text,
    "color" text,
    "createddate" text,
    "validfrom" text,
    "validto" text,
    "active" boolean,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__routes" (
    "sb_rate_types_id" text,
    "idx" bigint,
    "row_pk" text,
    "value" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__seatrates" (
    "sb_rate_types_id" text,
    "key" text,
    "row_pk" text,
    "pk_adult_thai" bigint,
    "pk_adult_fr" bigint,
    "pk_child_thai" bigint,
    "pk_child_fr" bigint,
    "pk_infant_thai" bigint,
    "pk_infant_fr" bigint,
    "kl_adult_thai" bigint,
    "kl_adult_fr" bigint,
    "kl_child_thai" bigint,
    "kl_child_fr" bigint,
    "kl_infant_thai" bigint,
    "kl_infant_fr" bigint,
    "notransfer_adult_thai" bigint,
    "notransfer_adult_fr" bigint,
    "notransfer_child_thai" bigint,
    "notransfer_child_fr" bigint,
    "notransfer_infant_thai" bigint,
    "notransfer_infant_fr" bigint,
    "kl" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__charterrates" (
    "sb_rate_types_id" text,
    "key" text,
    "row_pk" text,
    "speedboat_starterprice" bigint,
    "speedboat_starterincludes" bigint,
    "speedboat_extraperpax" bigint,
    "catamaran_starterprice" bigint,
    "catamaran_starterincludes" bigint,
    "catamaran_extraperpax" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons" (
    "sb_rate_types_id" text,
    "key" text,
    "row_pk" text,
    "adult" bigint,
    "child" bigint,
    "unit" text,
    "join_adult" bigint,
    "join_child" bigint,
    "charter_price" bigint,
    "charter_capacity" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons__applies" (
    "sb_rate_types_addons_id" text,
    "idx" bigint,
    "row_pk" text,
    "value" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons__r5" (
    "sb_rate_types_addons_id" text,
    "key" text,
    "row_pk" text,
    "sedan" bigint,
    "van" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons__r6" (
    "sb_rate_types_addons_id" text,
    "key" text,
    "row_pk" text,
    "sedan" bigint,
    "van" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons__r10" (
    "sb_rate_types_addons_id" text,
    "key" text,
    "row_pk" text,
    "sedan" bigint,
    "van" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons__r11" (
    "sb_rate_types_addons_id" text,
    "key" text,
    "row_pk" text,
    "sedan" bigint,
    "van" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons__r12" (
    "sb_rate_types_addons_id" text,
    "key" text,
    "row_pk" text,
    "sedan" bigint,
    "van" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__routevalidity" (
    "sb_rate_types_id" text,
    "key" text,
    "row_pk" text,
    "from" text,
    "to" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons__byroute" (
    "sb_rate_types_addons_id" text,
    "key" text,
    "row_pk" text,
    "join_adult" bigint,
    "join_child" bigint,
    "charter_price" bigint,
    "charter_capacity" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__addons__r4" (
    "sb_rate_types_addons_id" text,
    "key" text,
    "row_pk" text,
    "sedan" bigint,
    "van" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_rate_types__routebundles" (
    "sb_rate_types_id" text,
    "key" text,
    "row_pk" text,
    "longtail_mode" text,
    "longtail_adult" bigint,
    "longtail_child" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents_rate_bindings" (
    "id" text,
    "ratetypeid" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_safety" (
    "id" text,
    "boatid" text,
    "category" text,
    "name" text,
    "brand" text,
    "model" text,
    "serial" text,
    "qty" bigint,
    "installdate" text,
    "expirydate" text,
    "nextpm" text,
    "lastinspect" text,
    "status" text,
    "location" text,
    "note" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_safety__log" (
    "fleet_safety_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "type" text,
    "desc" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_safety__inspections" (
    "fleet_safety_id" text,
    "idx" bigint,
    "row_pk" text,
    "id" text,
    "date" text,
    "result" text,
    "note" text,
    "by" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_pickup_areas" (
    "id" text,
    "name" text,
    "zone" text,
    "region" text,
    "timegroup" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_pickup_times" (
    "id" text,
    "key" text,
    "pk_n1" text,
    "pk_n2" text,
    "pk_e1" text,
    "pk_e2" text,
    "pk_wn1" text,
    "pk_w1" text,
    "pk_w2" text,
    "pk_s1" text,
    "pk_s2" text,
    "pk_c1" text,
    "pk_c2" text,
    "pk_pa1" text,
    "nt_vp" text,
    "pk_pn1" text,
    "nt_tl" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_pickup_time_profiles" (
    "id" text,
    "name" text,
    "from" text,
    "to" text,
    "notes" text,
    "clonedfrom" text,
    "createdat" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_pickup_time_profiles__times" (
    "sb_pickup_time_profiles_id" text,
    "key" text,
    "row_pk" text,
    "pk_maikhao" text,
    "pk_naithon" text,
    "pk_naiyang" text,
    "pk_airport" text,
    "pk_talang" text,
    "pk_aopor" text,
    "pk_pakhlok" text,
    "pk_yamu" text,
    "pk_monument" text,
    "pk_kokaeo" text,
    "pk_sapam" text,
    "pk_layan" text,
    "pk_laguna" text,
    "pk_bangtao" text,
    "pk_cherngtalay" text,
    "pk_surin" text,
    "pk_kamala" text,
    "pk_kalim" text,
    "pk_tritrang" text,
    "pk_patong" text,
    "pk_karon" text,
    "pk_kata" text,
    "pk_rawai" text,
    "pk_naiharn" text,
    "pk_saiyuan" text,
    "pk_chalong" text,
    "pk_chaofa" text,
    "pk_siray" text,
    "pk_town" text,
    "pk_aoyon" text,
    "pk_panwa" text,
    "nt_panwa_pier" text,
    "pk_kathu" text,
    "pk_khokkloi" text,
    "pk_natai" text,
    "nt_tublamu_pier" text,
    "kl_numkhem" text,
    "kl_bangsak" text,
    "kl_pakwip" text,
    "kl_pakarang" text,
    "kl_khukkhak" text,
    "kl_bangniang" text,
    "kl_nanglao" text,
    "kl_center" text,
    "kl_khaolak" text,
    "kl_merlin" text,
    "kl_poseidon" text,
    "kl_tublamuhotel" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_projects" (
    "id" text,
    "no" text,
    "name" text,
    "boatid" text,
    "type" text,
    "vendor" text,
    "planfrom" text,
    "planto" text,
    "actualfrom" text,
    "actualto" text,
    "status" text,
    "plannedbudget" bigint,
    "notes" text,
    "createdat" text,
    "createdby" text,
    "originalplanto" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_projects__log" (
    "fleet_projects_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "text" text,
    "by" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_projects__plan" (
    "fleet_projects_id" text,
    "idx" bigint,
    "row_pk" text,
    "id" text,
    "text" text,
    "done" boolean,
    "addedat" text,
    "donedate" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_seat_locks" (
    "id" text,
    "routeid" text,
    "date" text,
    "boatid" text,
    "holdertype" text,
    "holderid" text,
    "qty" bigint,
    "used" bigint,
    "reason" text,
    "expiry" text,
    "status" text,
    "createdat" text,
    "createdby" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_seat_locks__log" (
    "sb_seat_locks_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "type" text,
    "qty" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_sales" (
    "id" text,
    "code" text,
    "name" text,
    "color" text,
    "email" text,
    "fullname" text,
    "designation" text,
    "tel" text,
    "signature" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents" (
    "id" text,
    "code" text,
    "name" text,
    "market" text,
    "sub" text,
    "sales" text,
    "paytype" text,
    "vatmode" text,
    "creditdays" bigint,
    "creditlimit" bigint,
    "creditbalance" bigint,
    "contact" text,
    "email" text,
    "phone" text,
    "note" text,
    "contractstatus" text,
    "contractversion" text,
    "companyinfo_legalname" text,
    "companyinfo_tatlicense" text,
    "companyinfo_address" text,
    "companyinfo_tel" text,
    "companyinfo_hotline" text,
    "companyinfo_fax" text,
    "companyinfo_website" text,
    "agentsignatory_name" text,
    "agentsignatory_designation" text,
    "agentsignatory_tel" text,
    "agentsignatory_signeddate" text,
    "bookingchannel_method" text,
    "bookingchannel_cutoff" text,
    "bookingchannel_cancelpolicy" text,
    "bookingchannel_email" text,
    "bookingchannel_phone" text,
    "contractstart" text,
    "contractend" text,
    "ratetypeid" text,
    "color" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents__programs" (
    "sb_agents_id" text,
    "idx" bigint,
    "row_pk" text,
    "value" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents__programperiods" (
    "sb_agents_id" text,
    "idx" bigint,
    "row_pk" text,
    "routeid" text,
    "bookfrom" text,
    "bookto" text,
    "travelfrom" text,
    "travelto" text,
    "note" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents__activity" (
    "sb_agents_id" text,
    "idx" bigint,
    "row_pk" text,
    "at" text,
    "by" text,
    "kind" text,
    "text" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents__contracthistory" (
    "sb_agents_id" text,
    "idx" bigint,
    "row_pk" text,
    "version" text,
    "archivedat" text,
    "contractstart" text,
    "contractend" text,
    "snapshot_agentsignatory_name" text,
    "snapshot_agentsignatory_designation" text,
    "snapshot_agentsignatory_tel" text,
    "snapshot_agentsignatory_signeddate" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents__contracthistory__programperiods" (
    "sb_agents_contracthistory_id" text,
    "idx" bigint,
    "row_pk" text,
    "routeid" text,
    "bookfrom" text,
    "bookto" text,
    "travelfrom" text,
    "travelto" text,
    "note" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents__contracthistory__addonservices" (
    "sb_agents_contracthistory_id" text,
    "idx" bigint,
    "row_pk" text,
    "svcid" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents__contracthistory__addonservices__variants" (
    "sb_agents_contracthistory_addonservices_id" text,
    "idx" bigint,
    "row_pk" text,
    "varid" text,
    "selling" bigint,
    "net" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_agents__contracthistory__prices" (
    "sb_agents_contracthistory_id" text,
    "key" text,
    "row_pk" text,
    "pk_adult_thai" bigint,
    "pk_adult_fr" bigint,
    "pk_child_thai" bigint,
    "pk_child_fr" bigint,
    "pk_infant_thai" bigint,
    "pk_infant_fr" bigint,
    "kl_adult_thai" bigint,
    "kl_adult_fr" bigint,
    "kl_child_thai" bigint,
    "kl_child_fr" bigint,
    "kl_infant_thai" bigint,
    "kl_infant_fr" bigint,
    "notransfer_adult_thai" bigint,
    "notransfer_adult_fr" bigint,
    "notransfer_child_thai" bigint,
    "notransfer_child_fr" bigint,
    "notransfer_infant_thai" bigint,
    "notransfer_infant_fr" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings" (
    "id" text,
    "schemaver" bigint,
    "createdat" text,
    "createdby" text,
    "voucherref" text,
    "agentid" text,
    "ratetyperef" text,
    "leadpax" text,
    "leadnationality" text,
    "leadtype" text,
    "leadfoc" boolean,
    "leadphone" text,
    "leademail" text,
    "pickupareaid" text,
    "pickupself" boolean,
    "pickuparea" text,
    "pickupzone" text,
    "hotelname" text,
    "roomnumber" text,
    "dropoffsame" boolean,
    "dropoffareaid" text,
    "dropoffarea" text,
    "dropoffhotelname" text,
    "guides_english" boolean,
    "guides_russian" boolean,
    "guides_chinese" boolean,
    "guides_otherlang" text,
    "notes" text,
    "specialmeals_veg" bigint,
    "specialmeals_vegan" bigint,
    "specialmeals_halal" bigint,
    "specialmeals_allergies" text,
    "largeluggage" bigint,
    "cashontour" text,
    "focapproval" text,
    "paymentsnapshot_method" text,
    "paymentsnapshot_netdays" bigint,
    "paymentsnapshot_source" text,
    "paymentsnapshot_contractversion" text,
    "pricebreakdown_seat" bigint,
    "pricebreakdown_addon" bigint,
    "pricebreakdown_focdiscount" bigint,
    "pricebreakdown_discount" bigint,
    "pricebreakdown_extra" bigint,
    "pricebreakdown_total" bigint,
    "status" text,
    "total" bigint,
    "soldby" text,
    "pricemode" text,
    "manualtotal" bigint,
    "purpose" text,
    "staffid" text,
    "staffpurpose" text,
    "note" text,
    "bookedat" text,
    "bookingdate" text,
    "marketsnapshot_market" text,
    "marketsnapshot_sub" text,
    "marketsnapshot_agentid" text,
    "marketsnapshot_at" text,
    "confirmedby" text,
    "confirmedat" text,
    "ops_boatid" text,
    "updatedat" text,
    "updatedby" text,
    "focapproval_count" bigint,
    "focapproval_reason" text,
    "focapproval_status" text,
    "focapproval_requestedat" text,
    "focapproval_requestedby" text,
    "focapproval_approvedat" text,
    "focapproval_approvedby" text,
    "focreason" text,
    "ops_vangroup" bigint,
    "ops_vanseq" bigint,
    "ops_vanreturnid" text,
    "ops_vanid" text,
    "invoiceid" text,
    "paymentstatus" text,
    "ops_returnsamevan" boolean,
    "cashontour_amount" bigint,
    "cashontour_currency" text,
    "cashontour_handling" text,
    "cashontour_note" text,
    "cancelledat" text,
    "cancellation_category" text,
    "cancellation_categorylabel" text,
    "cancellation_group" text,
    "cancellation_note" text,
    "cancellation_reason" text,
    "cancellation_chargetype" text,
    "cancellation_chargeamount" bigint,
    "cancellation_at" text,
    "cancellation_by" text,
    "cancelcategory" text,
    "cancelreason" text,
    "reschedule_fromdate" text,
    "reschedule_todate" text,
    "reschedule_reason" text,
    "reschedule_chargetype" text,
    "reschedule_chargeamount" bigint,
    "reschedule_collect" text,
    "reschedule_at" text,
    "reschedule_by" text,
    "rebook_from" text,
    "rebook_to" text,
    "rebook_reason" text,
    "rebook_at" text,
    "ops_pickuptimefinal" text,
    "approval_status" text,
    "approval_reason" text,
    "approval_targetstatus" text,
    "approval_totover" bigint,
    "approval_requestedby" text,
    "approval_requestedat" text,
    "approval_approvedby" text,
    "approval_approvedat" text,
    "approval_note" text,
    "ops_reconfirm" text,
    "weatherresolve_event" text,
    "weatherresolve_status" text,
    "weatherresolve_notifiedat" text,
    "weatherresolve_outcome" text,
    "weatherresolve_resolvedat" text,
    "weatherresolve_newdate" text,
    "editlock_uid" text,
    "editlock_by" text,
    "editlock_at" bigint,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__passengers" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "name" text,
    "nationality" text,
    "type" text,
    "foc" boolean,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__trips" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "routeid" text,
    "date" text,
    "zone" text,
    "pax_ad_fr" bigint,
    "pax_chd_fr" bigint,
    "pax_inf_fr" bigint,
    "pax_foc_fr" bigint,
    "pax_ad_th" bigint,
    "pax_chd_th" bigint,
    "pax_inf_th" bigint,
    "pax_foc_th" bigint,
    "pax_ad" bigint,
    "pickuptime" text,
    "bookingmode" text,
    "charterboatid" text,
    "charterpricemode" text,
    "charterpricemanual" bigint,
    "charterpricenote" text,
    "charterdisplacementack" boolean,
    "ovn" text,
    "ovnreturndate" text,
    "ovncharge" bigint,
    "ovnleg" boolean,
    "ovnof" text,
    "seatsource_locked" bigint,
    "seatsource_general" bigint,
    "subtotal" bigint,
    "pax_foc" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__addons" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "type" text,
    "label" text,
    "amount" bigint,
    "qty" bigint,
    "note" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__history" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "at" text,
    "kind" text,
    "text" text,
    "tag" text,
    "by" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__upgrades" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "id" text,
    "label" text,
    "sellprice" bigint,
    "tocompany" bigint,
    "commission" bigint,
    "collected" boolean,
    "note" text,
    "seller" text,
    "settle" text,
    "at" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__feeitems" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "type" text,
    "label" text,
    "amount" bigint,
    "at" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__partialcancels" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "date" text,
    "tripidx" bigint,
    "paxremoved_foc_th" bigint,
    "count" bigint,
    "category" text,
    "categorylabel" text,
    "group" text,
    "note" text,
    "refundmode" text,
    "refund" bigint,
    "charged_count" bigint,
    "charged_amount" bigint,
    "waived_count" bigint,
    "waived_amount" bigint,
    "at" text,
    "by" text,
    "paxremoved_ad_fr" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__adjustments" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "kind" text,
    "mode" text,
    "value" bigint,
    "label" text,
    "note" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_bookings__over" (
    "sb_bookings_id" text,
    "idx" bigint,
    "row_pk" text,
    "routeid" text,
    "date" text,
    "name" text,
    "need" bigint,
    "capfree" bigint,
    "overby" bigint,
    "licfree" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."nat_learn" (
    "id" text,
    "key" text,
    "il" bigint,
    "sa" bigint,
    "th" bigint,
    "in" bigint,
    "sg" bigint,
    "my" bigint,
    "au" bigint,
    "de" bigint,
    "us" bigint,
    "om" bigint,
    "eg" bigint,
    "ae" bigint,
    "br" bigint,
    "cn" bigint,
    "es" bigint,
    "mx" bigint,
    "kr" bigint,
    "bar2" bigint,
    "bar" bigint,
    "nl" bigint,
    "ru" bigint,
    "jo" bigint,
    "jp" bigint,
    "gb" bigint,
    "ca" bigint,
    "qa" bigint,
    "irq" bigint,
    "za" bigint,
    "cub" bigint,
    "fr" bigint,
    "eth" bigint,
    "ie" bigint,
    "kz" bigint,
    "uz" bigint,
    "tw" bigint,
    "it" bigint,
    "se" bigint,
    "nig" bigint,
    "ge" bigint,
    "ph" bigint,
    "ar" bigint,
    "gha" bigint,
    "nz" bigint,
    "pk" bigint,
    "kw" bigint,
    "lk" bigint,
    "mon" bigint,
    "by" bigint,
    "aus" bigint,
    "cl" bigint,
    "dk" bigint,
    "kh" bigint,
    "tr" bigint,
    "rs" bigint,
    "pt" bigint,
    "gr" bigint,
    "lit" bigint,
    "be" bigint,
    "fi" bigint,
    "no" bigint,
    "usa" bigint,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_nationalities" (
    "id" text,
    "code" text,
    "name" text,
    "custom" boolean,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_invoices" (
    "id" text,
    "number" text,
    "agentid" text,
    "subtotal" bigint,
    "depositapplied" bigint,
    "total" bigint,
    "issuedat" text,
    "dueat" text,
    "status" text,
    "createdby" text,
    "netamount" bigint,
    "vatmode" text,
    "vatrate" double precision,
    "vatamount" bigint,
    "feetype" text,
    "note" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_invoices__bookingids" (
    "sb_invoices_id" text,
    "idx" bigint,
    "row_pk" text,
    "value" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_invoices__lineitems" (
    "sb_invoices_id" text,
    "idx" bigint,
    "row_pk" text,
    "label" text,
    "amount" bigint,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_weather" (
    "id" text,
    "routeid" text,
    "date" text,
    "reason" text,
    "at" text,
    "note" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_payments" (
    "id" text,
    "invoiceid" text,
    "agentid" text,
    "amount" bigint,
    "method" text,
    "date" text,
    "type" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_markets" (
    "id" text,
    "name" text,
    "color" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_markets__subs" (
    "sb_markets_id" text,
    "idx" bigint,
    "row_pk" text,
    "value" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_market_stats" (
    "id" text,
    "key" text,
    "date" text,
    "in_col" bigint,
    "in_zwe" bigint,
    "in_overseas" bigint,
    "out_col" bigint,
    "out_zwe" bigint,
    "out_overseas" bigint,
    "out_1951_convention" bigint,
    "inat" text,
    "outat" text,
    "intotal" bigint,
    "outtotal" bigint,
    "in_1951_convention" bigint,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_market_monthly" (
    "id" text,
    "key" text,
    "value" bigint,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_staff" (
    "id" text,
    "code" text,
    "name" text,
    "dept" text,
    "active" boolean,
    "quota_2026" bigint,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_vehicles" (
    "id" text,
    "name" text,
    "plate" text,
    "type" text,
    "capacity" bigint,
    "ownership" text,
    "partnername" text,
    "zonebase" text,
    "active" boolean,
    "note" text,
    "driver" text,
    "driverphone" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_vehicles__log" (
    "sb_vehicles_id" text,
    "idx" bigint,
    "row_pk" text,
    "at" text,
    "kind" text,
    "text" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_vehicles__statusranges" (
    "sb_vehicles_id" text,
    "idx" bigint,
    "row_pk" text,
    "s" text,
    "from" text,
    "to" text,
    "note" text,
    PRIMARY KEY ("row_pk")
);

CREATE TABLE IF NOT EXISTS operation_schemas."sb_extras" (
    "id" text,
    "bookingid" text,
    "tripdate" text,
    "service" text,
    "qty" bigint,
    "unitprice" bigint,
    "total" bigint,
    "tocompany" bigint,
    "commission" bigint,
    "seller" text,
    "method" text,
    "settle" text,
    "date" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_fuelprice" (
    "id" text,
    "key" text,
    "panwa" double precision,
    "b10" double precision,
    "b2" double precision,
    "b13" double precision,
    "b6" double precision,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_drlock" (
    "id" text,
    "key" text,
    "panwa" boolean,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."vanjob_pickup_th" (
    "id" text,
    "key" text,
    "value" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."vanjob_driver" (
    "id" text,
    "key" text,
    "driver" text,
    "phone" text,
    "plate" text,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS operation_schemas."fleet_consumable_logs" (
    "id" text,
    "date" text,
    "itemid" text,
    "itemname" text,
    "unit" text,
    "qty" bigint,
    "unitcost" double precision,
    "cost" double precision,
    "location" text,
    "boatid" text,
    "engineid" text,
    "enginelabel" text,
    "by" text,
    "note" text,
    PRIMARY KEY ("id")
);

-- ---------- FOREIGN KEYS (errors ignored — safe to re-run) ----------
\set ON_ERROR_STOP off

ALTER TABLE operation_schemas."routes__times" ADD CONSTRAINT "fk_routes_times" FOREIGN KEY ("routes_id") REFERENCES operation_schemas."routes" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."routes__seasons" ADD CONSTRAINT "fk_routes_seasons" FOREIGN KEY ("routes_id") REFERENCES operation_schemas."routes" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."boats__docs" ADD CONSTRAINT "fk_boats_docs" FOREIGN KEY ("boats_id") REFERENCES operation_schemas."boats" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."boats__log" ADD CONSTRAINT "fk_boats_log" FOREIGN KEY ("boats_id") REFERENCES operation_schemas."boats" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."boats__repairhistory" ADD CONSTRAINT "fk_boats_repairhistory" FOREIGN KEY ("boats_id") REFERENCES operation_schemas."boats" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."boats__assignments" ADD CONSTRAINT "fk_boats_assignments" FOREIGN KEY ("boats_id") REFERENCES operation_schemas."boats" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_engines__log" ADD CONSTRAINT "fk_fleet_engines_log" FOREIGN KEY ("fleet_engines_id") REFERENCES operation_schemas."fleet_engines" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_gearboxes__log" ADD CONSTRAINT "fk_fleet_gearboxes_log" FOREIGN KEY ("fleet_gearboxes_id") REFERENCES operation_schemas."fleet_gearboxes" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_propellers__log" ADD CONSTRAINT "fk_fleet_propellers_log" FOREIGN KEY ("fleet_propellers_id") REFERENCES operation_schemas."fleet_propellers" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_daily__trips" ADD CONSTRAINT "fk_fleet_daily_trips" FOREIGN KEY ("fleet_daily_id") REFERENCES operation_schemas."fleet_daily" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_maintenance__assets" ADD CONSTRAINT "fk_fleet_maintenance_assets" FOREIGN KEY ("fleet_maintenance_id") REFERENCES operation_schemas."fleet_maintenance" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_maintenance__progresslog" ADD CONSTRAINT "fk_fleet_maintenance_progresslog" FOREIGN KEY ("fleet_maintenance_id") REFERENCES operation_schemas."fleet_maintenance" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_maintenance__parts" ADD CONSTRAINT "fk_fleet_maintenance_parts" FOREIGN KEY ("fleet_maintenance_id") REFERENCES operation_schemas."fleet_maintenance" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_incidents__damagedassets" ADD CONSTRAINT "fk_fleet_incidents_damagedassets" FOREIGN KEY ("fleet_incidents_id") REFERENCES operation_schemas."fleet_incidents" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_incidents__progresslog" ADD CONSTRAINT "fk_fleet_incidents_progresslog" FOREIGN KEY ("fleet_incidents_id") REFERENCES operation_schemas."fleet_incidents" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_incidents__relatedmaintids" ADD CONSTRAINT "fk_fleet_incidents_relatedmaintids" FOREIGN KEY ("fleet_incidents_id") REFERENCES operation_schemas."fleet_incidents" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_inventory__history" ADD CONSTRAINT "fk_fleet_inventory_history" FOREIGN KEY ("fleet_inventory_id") REFERENCES operation_schemas."fleet_inventory" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_inventory__stocks" ADD CONSTRAINT "fk_fleet_inventory_stocks" FOREIGN KEY ("fleet_inventory_id") REFERENCES operation_schemas."fleet_inventory" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_memos__items" ADD CONSTRAINT "fk_fleet_memos_items" FOREIGN KEY ("fleet_memos_id") REFERENCES operation_schemas."fleet_memos" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_rate_types__routes" ADD CONSTRAINT "fk_sb_rate_types_routes" FOREIGN KEY ("sb_rate_types_id") REFERENCES operation_schemas."sb_rate_types" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_rate_types__seatrates" ADD CONSTRAINT "fk_sb_rate_types_seatrates" FOREIGN KEY ("sb_rate_types_id") REFERENCES operation_schemas."sb_rate_types" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_rate_types__charterrates" ADD CONSTRAINT "fk_sb_rate_types_charterrates" FOREIGN KEY ("sb_rate_types_id") REFERENCES operation_schemas."sb_rate_types" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_rate_types__addons" ADD CONSTRAINT "fk_sb_rate_types_addons" FOREIGN KEY ("sb_rate_types_id") REFERENCES operation_schemas."sb_rate_types" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_rate_types__routevalidity" ADD CONSTRAINT "fk_sb_rate_types_routevalidity" FOREIGN KEY ("sb_rate_types_id") REFERENCES operation_schemas."sb_rate_types" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_rate_types__routebundles" ADD CONSTRAINT "fk_sb_rate_types_routebundles" FOREIGN KEY ("sb_rate_types_id") REFERENCES operation_schemas."sb_rate_types" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_safety__log" ADD CONSTRAINT "fk_fleet_safety_log" FOREIGN KEY ("fleet_safety_id") REFERENCES operation_schemas."fleet_safety" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_safety__inspections" ADD CONSTRAINT "fk_fleet_safety_inspections" FOREIGN KEY ("fleet_safety_id") REFERENCES operation_schemas."fleet_safety" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_pickup_time_profiles__times" ADD CONSTRAINT "fk_sb_pickup_time_profiles_times" FOREIGN KEY ("sb_pickup_time_profiles_id") REFERENCES operation_schemas."sb_pickup_time_profiles" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_projects__log" ADD CONSTRAINT "fk_fleet_projects_log" FOREIGN KEY ("fleet_projects_id") REFERENCES operation_schemas."fleet_projects" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."fleet_projects__plan" ADD CONSTRAINT "fk_fleet_projects_plan" FOREIGN KEY ("fleet_projects_id") REFERENCES operation_schemas."fleet_projects" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_seat_locks__log" ADD CONSTRAINT "fk_sb_seat_locks_log" FOREIGN KEY ("sb_seat_locks_id") REFERENCES operation_schemas."sb_seat_locks" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_agents__programs" ADD CONSTRAINT "fk_sb_agents_programs" FOREIGN KEY ("sb_agents_id") REFERENCES operation_schemas."sb_agents" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_agents__programperiods" ADD CONSTRAINT "fk_sb_agents_programperiods" FOREIGN KEY ("sb_agents_id") REFERENCES operation_schemas."sb_agents" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_agents__activity" ADD CONSTRAINT "fk_sb_agents_activity" FOREIGN KEY ("sb_agents_id") REFERENCES operation_schemas."sb_agents" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_agents__contracthistory" ADD CONSTRAINT "fk_sb_agents_contracthistory" FOREIGN KEY ("sb_agents_id") REFERENCES operation_schemas."sb_agents" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__passengers" ADD CONSTRAINT "fk_sb_bookings_passengers" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__trips" ADD CONSTRAINT "fk_sb_bookings_trips" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__addons" ADD CONSTRAINT "fk_sb_bookings_addons" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__history" ADD CONSTRAINT "fk_sb_bookings_history" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__upgrades" ADD CONSTRAINT "fk_sb_bookings_upgrades" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__feeitems" ADD CONSTRAINT "fk_sb_bookings_feeitems" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__partialcancels" ADD CONSTRAINT "fk_sb_bookings_partialcancels" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__adjustments" ADD CONSTRAINT "fk_sb_bookings_adjustments" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_bookings__over" ADD CONSTRAINT "fk_sb_bookings_over" FOREIGN KEY ("sb_bookings_id") REFERENCES operation_schemas."sb_bookings" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_invoices__bookingids" ADD CONSTRAINT "fk_sb_invoices_bookingids" FOREIGN KEY ("sb_invoices_id") REFERENCES operation_schemas."sb_invoices" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_invoices__lineitems" ADD CONSTRAINT "fk_sb_invoices_lineitems" FOREIGN KEY ("sb_invoices_id") REFERENCES operation_schemas."sb_invoices" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_markets__subs" ADD CONSTRAINT "fk_sb_markets_subs" FOREIGN KEY ("sb_markets_id") REFERENCES operation_schemas."sb_markets" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_vehicles__log" ADD CONSTRAINT "fk_sb_vehicles_log" FOREIGN KEY ("sb_vehicles_id") REFERENCES operation_schemas."sb_vehicles" ("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE operation_schemas."sb_vehicles__statusranges" ADD CONSTRAINT "fk_sb_vehicles_statusranges" FOREIGN KEY ("sb_vehicles_id") REFERENCES operation_schemas."sb_vehicles" ("id") ON DELETE CASCADE NOT VALID;

-- Also apply the seat-lock oversell guard (from migration 001)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sb_seat_locks_no_oversell') THEN
    ALTER TABLE operation_schemas.sb_seat_locks
      ADD CONSTRAINT sb_seat_locks_no_oversell CHECK (used <= qty);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION operation_schemas.draw_seat(p_lock_id text, p_qty int)
RETURNS operation_schemas.sb_seat_locks
LANGUAGE plpgsql AS $$
DECLARE r operation_schemas.sb_seat_locks;
BEGIN
  SELECT * INTO r FROM operation_schemas.sb_seat_locks WHERE id = p_lock_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'seat lock % not found', p_lock_id USING errcode = 'P0002';
  END IF;
  IF coalesce(r.used,0) + p_qty > coalesce(r.qty,0) THEN
    RAISE EXCEPTION 'not enough seats: % left, need %', coalesce(r.qty,0) - coalesce(r.used,0), p_qty
      USING errcode = '23514';
  END IF;
  UPDATE operation_schemas.sb_seat_locks SET used = coalesce(used,0) + p_qty
    WHERE id = p_lock_id RETURNING * INTO r;
  RETURN r;
END $$;
