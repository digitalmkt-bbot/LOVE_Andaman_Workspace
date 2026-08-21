--
-- PostgreSQL database dump
--

\restrict ceZlpJj5d5C1EVeJznp3PnVhxt7a0cYubcUZkVgNJHRjgRlcabdahHFupF6xzbH

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: operation_schemas; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA operation_schemas;


--
-- Name: f_trip_date_iso(text, text); Type: FUNCTION; Schema: operation_schemas; Owner: -
--

CREATE FUNCTION operation_schemas.f_trip_date_iso(raw text, created text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
  -- Explicit arrays, not to_char/to_date with 'Dy'/'Mon': those honour lc_time, so a server with a
  -- non-English locale would silently stop matching. These are locale-proof.
  dows  constant text[] := ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  months constant text[] := ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  mon_i int;
  day_i int;
  base_y int;
  cand date;
BEGIN
  IF raw IS NULL OR raw = '' THEN
    RETURN NULL;
  END IF;

  -- 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SSZ' both truncate cleanly.
  IF raw ~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN left(raw, 10);
  END IF;

  -- 'Sat Jul 04'
  IF raw ~ '^[A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-9]\d$' THEN
    mon_i := array_position(months, substr(raw, 5, 3));
    day_i := NULLIF(btrim(substr(raw, 9, 2)), '')::int;
    base_y := NULLIF(left(COALESCE(created, ''), 4), '')::int;
    IF mon_i IS NULL OR day_i IS NULL OR base_y IS NULL THEN
      RETURN NULL;
    END IF;
    -- A booking is created at most ~1 year before travel, so createdat's year or the next one.
    FOR i IN 0..1 LOOP
      BEGIN
        cand := make_date(base_y + i, mon_i, day_i);
      EXCEPTION WHEN others THEN
        cand := NULL;                      -- e.g. 'Feb 30' in a corrupt row
      END;
      IF cand IS NOT NULL
         AND dows[EXTRACT(dow FROM cand)::int + 1] = left(raw, 3) THEN
        RETURN to_char(cand, 'YYYY-MM-DD');
      END IF;
    END LOOP;
    RETURN NULL;                           -- weekday agrees with no plausible year
  END IF;

  RETURN NULL;                             -- unrecognised shape
END
$_$;


--
-- Name: FUNCTION f_trip_date_iso(raw text, created text); Type: COMMENT; Schema: operation_schemas; Owner: -
--

COMMENT ON FUNCTION operation_schemas.f_trip_date_iso(raw text, created text) IS 'TEMPORARY. Normalises legacy weekday-format trip dates to ISO. Drop after backfilling sb_bookings__trips.date.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_artifacts; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.agent_artifacts (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: app_hooks; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.app_hooks (
    id text NOT NULL,
    key text,
    value boolean
);


--
-- Name: app_meta; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.app_meta (
    key text,
    value text
);


--
-- Name: app_state; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.app_state (
    id text NOT NULL,
    data text,
    version integer DEFAULT 0,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: attachments; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.attachments (
    id text NOT NULL,
    booking_id text,
    filename text,
    mime text,
    size integer,
    data bytea,
    uploaded_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: boat_capovr; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.boat_capovr (
    id text NOT NULL,
    key text,
    cap bigint,
    reason text,
    by text,
    at text
);


--
-- Name: boats; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.boats (
    id text NOT NULL,
    name text,
    type text,
    pier text,
    cap bigint,
    enginecount bigint,
    use text,
    material text,
    reg text,
    callsign text,
    imo text,
    year text,
    homeportcity text,
    gt double precision,
    nt double precision,
    dwt text,
    loa double precision,
    beam double precision,
    depth double precision,
    draft text,
    lbp double precision,
    bhp double precision,
    licensepax bigint,
    crew bigint,
    fishcrew text,
    totalcap bigint,
    owner text,
    homeport text,
    owneraddr text,
    color text,
    ownership text,
    retired boolean
);


--
-- Name: boats__assignments; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.boats__assignments (
    boats_id text,
    idx bigint,
    row_pk text NOT NULL,
    id text,
    type text,
    frompier text,
    topier text,
    startdate text,
    enddate text,
    reason text,
    cost bigint,
    status text,
    createddate text
);


--
-- Name: boats__docs; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.boats__docs (
    boats_id text,
    idx bigint,
    row_pk text NOT NULL,
    name text,
    exp text,
    renewstatus text
);


--
-- Name: boats__log; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.boats__log (
    boats_id text,
    idx bigint,
    row_pk text NOT NULL,
    id text,
    s text,
    "from" text,
    "to" text,
    loc text,
    note text,
    province text,
    loctype text,
    detail text,
    reason text,
    projectid text
);


--
-- Name: boats__repairhistory; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.boats__repairhistory (
    boats_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    jobno text,
    title text,
    detail text,
    type text,
    location text,
    cost double precision,
    startdate text,
    enddate text,
    outcome text,
    closenote text
);


--
-- Name: boats__repairhistory__assets; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.boats__repairhistory__assets (
    boats_repairhistory_id text,
    idx bigint,
    row_pk text NOT NULL,
    value text
);


--
-- Name: contract_templates; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.contract_templates (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: fleet_consumable_logs; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_consumable_logs (
    id text NOT NULL,
    date text,
    itemid text,
    itemname text,
    unit text,
    qty bigint,
    unitcost double precision,
    cost double precision,
    location text,
    boatid text,
    engineid text,
    enginelabel text,
    by text,
    note text
);


--
-- Name: fleet_daily; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_daily (
    id text NOT NULL,
    key text,
    b2_fuel double precision,
    b10_fuel double precision,
    b6_fuel double precision,
    b13_fuel double precision,
    b12_fuel double precision,
    b10_paxactual bigint,
    b2_paxactual bigint
);


--
-- Name: fleet_daily__boat; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_daily__boat (
    row_pk text NOT NULL,
    fleet_daily_id text,
    key text,
    value text
);


--
-- Name: fleet_daily__trips; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_daily__trips (
    fleet_daily_id text,
    boat text,
    key text,
    row_pk text NOT NULL,
    value text
);


--
-- Name: fleet_drlock; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_drlock (
    id text NOT NULL,
    key text,
    panwa boolean,
    value text
);


--
-- Name: fleet_engines; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_engines (
    id text NOT NULL,
    brand text,
    model text,
    serial text,
    hp bigint,
    boatid text,
    pos text,
    status text,
    basehours double precision,
    serviceinterval bigint,
    buydate text,
    note text,
    sparelocation text,
    price text,
    lastservicehours double precision,
    lastservicedate text
);


--
-- Name: fleet_engines__log; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_engines__log (
    fleet_engines_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    type text,
    "desc" text,
    detail text,
    hours double precision,
    by text,
    cost double precision,
    outcome text,
    enginehours bigint,
    text text
);


--
-- Name: fleet_fuelprice; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_fuelprice (
    id text NOT NULL,
    key text,
    panwa double precision,
    b10 double precision,
    b2 double precision,
    b13 double precision,
    b6 double precision,
    value text
);


--
-- Name: fleet_gearboxes; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_gearboxes (
    id text NOT NULL,
    boatid text,
    engineid text,
    brand text,
    model text,
    serial text,
    status text,
    basehours bigint,
    buydate text,
    note text,
    sparelocation text,
    shaftlength text,
    modelsuffix text,
    installhours double precision,
    rotation text,
    gearratio text,
    oilcapacity text,
    serviceinterval bigint,
    lastservicedate text,
    onboatid text,
    onboatpos text
);


--
-- Name: fleet_gearboxes__log; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_gearboxes__log (
    fleet_gearboxes_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    type text,
    "desc" text,
    enginehours double precision,
    fromloc text,
    toloc text,
    usedhours bigint,
    incidentid text,
    outcome text,
    detail text,
    text text
);


--
-- Name: fleet_incidents; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_incidents (
    id text NOT NULL,
    no text,
    boatid text,
    date text,
    "time" text,
    title text,
    detail text,
    remark text,
    priority bigint,
    severity text,
    type text,
    status text,
    maintid text,
    closeddate text,
    quickfix boolean,
    resolveddate text
);


--
-- Name: fleet_incidents__damagedassets; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_incidents__damagedassets (
    fleet_incidents_id text,
    idx bigint,
    row_pk text NOT NULL,
    type text,
    id text,
    label text,
    swapped boolean,
    swappedto text,
    swappeddate text,
    engid text,
    gbid text,
    propid text
);


--
-- Name: fleet_incidents__progresslog; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_incidents__progresslog (
    fleet_incidents_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    text text,
    by text,
    createdat text
);


--
-- Name: fleet_incidents__relatedmaintids; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_incidents__relatedmaintids (
    fleet_incidents_id text,
    idx bigint,
    row_pk text NOT NULL,
    value text
);


--
-- Name: fleet_inventory; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_inventory (
    id text NOT NULL,
    name text,
    partno text,
    category text,
    supplier text,
    location text,
    unit text,
    qty bigint,
    minqty bigint,
    cost double precision,
    note text,
    totalqty bigint,
    primarylocation text,
    createddate text,
    createdfrom text
);


--
-- Name: fleet_inventory__history; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_inventory__history (
    fleet_inventory_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    type text,
    qty bigint,
    note text,
    by text,
    location text,
    jobid text,
    consumeid text,
    "desc" text
);


--
-- Name: fleet_inventory__history__changes; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_inventory__history__changes (
    fleet_inventory_history_id text,
    idx bigint,
    row_pk text NOT NULL,
    field text,
    "from" text,
    "to" text
);


--
-- Name: fleet_inventory__stocks; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_inventory__stocks (
    fleet_inventory_id text,
    idx bigint,
    row_pk text NOT NULL,
    location text,
    qty bigint,
    minqty bigint
);


--
-- Name: fleet_maintenance; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_maintenance (
    id text NOT NULL,
    no text,
    boatid text,
    type text,
    title text,
    detail text,
    location text,
    status text,
    startdate text,
    enddate text,
    cost double precision,
    incidentid text,
    boatstatus text,
    boatstatusreason text,
    setfixing boolean,
    outcome text,
    parentprojectid text,
    awaitinginvoice boolean,
    closenote text
);


--
-- Name: fleet_maintenance__assets; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_maintenance__assets (
    fleet_maintenance_id text,
    idx bigint,
    row_pk text NOT NULL,
    type text,
    engid text,
    label text,
    detail text,
    status text,
    gbid text,
    propid text,
    id text
);


--
-- Name: fleet_maintenance__parts; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_maintenance__parts (
    fleet_maintenance_id text,
    idx bigint,
    row_pk text NOT NULL,
    invid text,
    name text,
    qty bigint,
    unit text,
    cost double precision,
    location text,
    date text
);


--
-- Name: fleet_maintenance__progresslog; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_maintenance__progresslog (
    fleet_maintenance_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    text text,
    by text,
    createdat text
);


--
-- Name: fleet_memos; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_memos (
    id text NOT NULL,
    no text,
    title text,
    boatid text,
    memotype text,
    proposer text,
    "from" text,
    "to" text,
    cc text,
    createddate text,
    status text,
    currentstep bigint,
    vatenabled boolean,
    vatrate bigint,
    refnote text,
    subtotal double precision,
    discount double precision,
    vat double precision,
    amount double precision,
    approvedby text,
    approveddate text,
    approvenote text,
    ordereddate text,
    receiveddate text,
    supplier text,
    discountpct bigint,
    maintid text,
    scope text,
    generalcategory text,
    note text,
    orderedby text,
    receivedby text,
    paiddate text,
    paidby text,
    paidvia text,
    discountamt bigint,
    afterdiscount double precision,
    receivedlocation text,
    receivedsummary text,
    projectid text
);


--
-- Name: fleet_memos__items; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_memos__items (
    fleet_memos_id text,
    idx bigint,
    row_pk text NOT NULL,
    name text,
    qty double precision,
    price double precision,
    category text,
    partno text,
    invid text,
    unit text,
    frominventory boolean,
    discountpct double precision,
    autoregister boolean,
    inventorysnapshot_cost double precision,
    inventorysnapshot_primarylocation text,
    inventorysnapshot_qtyatselection double precision
);


--
-- Name: fleet_projects; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_projects (
    id text NOT NULL,
    no text,
    name text,
    boatid text,
    type text,
    vendor text,
    planfrom text,
    planto text,
    actualfrom text,
    actualto text,
    status text,
    plannedbudget bigint,
    notes text,
    createdat text,
    createdby text,
    originalplanto text
);


--
-- Name: fleet_projects__log; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_projects__log (
    fleet_projects_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    text text,
    by text
);


--
-- Name: fleet_projects__plan; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_projects__plan (
    fleet_projects_id text,
    idx bigint,
    row_pk text NOT NULL,
    id text,
    text text,
    done boolean,
    addedat text,
    donedate text
);


--
-- Name: fleet_propellers; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_propellers (
    id text NOT NULL,
    boatid text,
    gearboxid text,
    brand text,
    serial text,
    diameter double precision,
    pitch double precision,
    size text,
    blades text,
    material text,
    rotation text,
    hubsize text,
    cupping text,
    cost bigint,
    status text,
    buydate text,
    note text,
    sparelocation text,
    oldserial text,
    proppos text,
    engineid text
);


--
-- Name: fleet_propellers__log; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_propellers__log (
    fleet_propellers_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    type text,
    "desc" text,
    enginehours bigint,
    fromloc text,
    toloc text,
    incidentid text,
    detail text,
    outcome text
);


--
-- Name: fleet_safety; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_safety (
    id text NOT NULL,
    boatid text,
    category text,
    name text,
    brand text,
    model text,
    serial text,
    qty bigint,
    installdate text,
    expirydate text,
    nextpm text,
    lastinspect text,
    status text,
    location text,
    note text
);


--
-- Name: fleet_safety__inspections; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_safety__inspections (
    fleet_safety_id text,
    idx bigint,
    row_pk text NOT NULL,
    id text,
    date text,
    result text,
    note text,
    by text
);


--
-- Name: fleet_safety__log; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.fleet_safety__log (
    fleet_safety_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    type text,
    "desc" text
);


--
-- Name: insurance_overrides; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.insurance_overrides (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: meal_venues; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.meal_venues (
    id text NOT NULL,
    name text,
    place text,
    price_ad numeric,
    price_ch numeric,
    phone text,
    note text,
    active boolean,
    eta text
);


--
-- Name: nat_learn; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.nat_learn (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: pier_cfg; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_cfg (
    id text,
    key text,
    value text
);


--
-- Name: pier_codes; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_codes (
    id text,
    code text,
    label text,
    color text,
    bg text,
    kind text,
    ord bigint,
    active boolean
);


--
-- Name: pier_duty; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_duty (
    id text,
    key text,
    value text
);


--
-- Name: pier_items; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_items (
    id text,
    pier text,
    kind text,
    label text,
    total bigint,
    active boolean,
    note text
);


--
-- Name: pier_job; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_job (
    id text,
    key text,
    value text
);


--
-- Name: pier_kinds; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_kinds (
    id text NOT NULL,
    name text,
    unit text,
    color text,
    ord bigint,
    active boolean,
    name_en text
);


--
-- Name: pier_lic_classes; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_lic_classes (
    id text,
    typeid text,
    name text,
    maxgt double precision,
    maxbhp double precision,
    ord bigint
);


--
-- Name: pier_lic_types; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_lic_types (
    id text,
    side text,
    short text,
    formal text,
    perboat bigint,
    active boolean
);


--
-- Name: pier_licenses; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_licenses (
    id text,
    staffid text,
    classid text,
    no text,
    exp text,
    issuedat text,
    issuer text,
    note text
);


--
-- Name: pier_moves; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_moves (
    id text,
    date text,
    pier text,
    itemid text,
    boatid text,
    type text,
    qty bigint,
    frombucket text,
    fine double precision,
    finepaid boolean,
    note text,
    by text,
    at text
);


--
-- Name: pier_sect; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_sect (
    id text NOT NULL,
    pier text,
    name text,
    ord bigint
);


--
-- Name: pier_shift; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_shift (
    id text,
    key text,
    value text
);


--
-- Name: pier_staff; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_staff (
    id text,
    pier text,
    nick text,
    name text,
    role text,
    phone text,
    active boolean,
    defcode text,
    sect text,
    note text,
    ord bigint
);


--
-- Name: pier_team; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.pier_team (
    id text,
    key text,
    value text
);


--
-- Name: routes; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.routes (
    id text NOT NULL,
    name text,
    islands text,
    color text,
    pier text,
    sort bigint,
    code text,
    mealvenueid text
);


--
-- Name: routes__overrides; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.routes__overrides (
    routes_id text,
    key text,
    row_pk text NOT NULL,
    value text
);


--
-- Name: routes__seasons; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.routes__seasons (
    routes_id text,
    idx bigint,
    row_pk text NOT NULL,
    id text,
    type text,
    "from" text,
    "to" text
);


--
-- Name: routes__times; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.routes__times (
    routes_id text,
    idx bigint,
    row_pk text NOT NULL,
    value text
);


--
-- Name: sb_agents; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_agents (
    id text NOT NULL,
    code text,
    name text,
    market text,
    sub text,
    sales text,
    paytype text,
    vatmode text,
    creditdays bigint,
    creditlimit bigint,
    creditbalance bigint,
    contact text,
    email text,
    phone text,
    note text,
    contractstatus text,
    contractversion text,
    companyinfo_legalname text,
    companyinfo_tatlicense text,
    companyinfo_address text,
    companyinfo_tel text,
    companyinfo_hotline text,
    companyinfo_fax text,
    companyinfo_website text,
    agentsignatory_name text,
    agentsignatory_designation text,
    agentsignatory_tel text,
    agentsignatory_signeddate text,
    bookingchannel_method text,
    bookingchannel_cutoff text,
    bookingchannel_cancelpolicy text,
    bookingchannel_email text,
    bookingchannel_phone text,
    contractstart text,
    contractend text,
    ratetypeid text,
    color text,
    companyinfo_taxid text,
    contracttemplateid text
);


--
-- Name: sb_agents__activity; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_agents__activity (
    sb_agents_id text,
    idx bigint,
    row_pk text NOT NULL,
    at text,
    by text,
    kind text,
    text text
);


--
-- Name: sb_agents__contracthistory; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_agents__contracthistory (
    sb_agents_id text,
    idx bigint,
    row_pk text NOT NULL,
    version text,
    archivedat text,
    contractstart text,
    contractend text,
    snapshot_agentsignatory_name text,
    snapshot_agentsignatory_designation text,
    snapshot_agentsignatory_tel text,
    snapshot_agentsignatory_signeddate text,
    snapshot_programperiods text,
    snapshot_addonservices text,
    snapshot_prices text
);


--
-- Name: sb_agents__programperiods; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_agents__programperiods (
    sb_agents_id text,
    idx bigint,
    row_pk text NOT NULL,
    routeid text,
    bookfrom text,
    bookto text,
    travelfrom text,
    travelto text,
    note text
);


--
-- Name: sb_agents__programs; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_agents__programs (
    sb_agents_id text,
    idx bigint,
    row_pk text NOT NULL,
    value text
);


--
-- Name: sb_agents_rate_bindings; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_agents_rate_bindings (
    id text NOT NULL,
    ratetypeid text
);


--
-- Name: sb_bookings; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings (
    id text NOT NULL,
    schemaver bigint,
    createdat text,
    createdby text,
    voucherref text,
    agentid text,
    ratetyperef text,
    leadpax text,
    leadnationality text,
    leadtype text,
    leadfoc boolean,
    leadphone text,
    leademail text,
    pickupareaid text,
    pickupself boolean,
    pickuparea text,
    pickupzone text,
    hotelname text,
    roomnumber text,
    dropoffsame boolean,
    dropoffareaid text,
    dropoffarea text,
    dropoffhotelname text,
    guides_english boolean,
    guides_russian boolean,
    guides_chinese boolean,
    guides_otherlang text,
    notes text,
    specialmeals_veg bigint,
    specialmeals_vegan bigint,
    specialmeals_halal bigint,
    specialmeals_allergies text,
    largeluggage bigint,
    cashontour text,
    focapproval text,
    paymentsnapshot_method text,
    paymentsnapshot_netdays bigint,
    paymentsnapshot_source text,
    paymentsnapshot_contractversion text,
    pricebreakdown_seat bigint,
    pricebreakdown_addon bigint,
    pricebreakdown_focdiscount bigint,
    pricebreakdown_discount bigint,
    pricebreakdown_extra bigint,
    pricebreakdown_total bigint,
    status text,
    total bigint,
    soldby text,
    pricemode text,
    manualtotal bigint,
    purpose text,
    staffid text,
    staffpurpose text,
    note text,
    bookedat text,
    bookingdate text,
    marketsnapshot_market text,
    marketsnapshot_sub text,
    marketsnapshot_agentid text,
    marketsnapshot_at text,
    confirmedby text,
    confirmedat text,
    ops_boatid text,
    updatedat text,
    updatedby text,
    focapproval_count bigint,
    focapproval_reason text,
    focapproval_status text,
    focapproval_requestedat text,
    focapproval_requestedby text,
    focapproval_approvedat text,
    focapproval_approvedby text,
    focreason text,
    ops_vangroup bigint,
    ops_vanseq bigint,
    ops_vanreturnid text,
    ops_vanid text,
    invoiceid text,
    paymentstatus text,
    ops_returnsamevan boolean,
    cashontour_amount bigint,
    cashontour_currency text,
    cashontour_handling text,
    cashontour_note text,
    cancelledat text,
    cancellation_category text,
    cancellation_categorylabel text,
    cancellation_group text,
    cancellation_note text,
    cancellation_reason text,
    cancellation_chargetype text,
    cancellation_chargeamount bigint,
    cancellation_at text,
    cancellation_by text,
    cancelcategory text,
    cancelreason text,
    reschedule_fromdate text,
    reschedule_todate text,
    reschedule_reason text,
    reschedule_chargetype text,
    reschedule_chargeamount bigint,
    reschedule_collect text,
    reschedule_at text,
    reschedule_by text,
    rebook_from text,
    rebook_to text,
    rebook_reason text,
    rebook_at text,
    ops_pickuptimefinal text,
    approval_status text,
    approval_reason text,
    approval_targetstatus text,
    approval_totover bigint,
    approval_requestedby text,
    approval_requestedat text,
    approval_approvedby text,
    approval_approvedat text,
    approval_note text,
    ops_reconfirm text,
    weatherresolve_event text,
    weatherresolve_status text,
    weatherresolve_notifiedat text,
    weatherresolve_outcome text,
    weatherresolve_resolvedat text,
    weatherresolve_newdate text,
    editlock_uid text,
    editlock_by text,
    editlock_at bigint,
    doccheck text,
    attachments text,
    paymentslips text,
    incomplete text,
    approval_over text,
    altpickups text,
    ops_vansplits text,
    ops_vancheckin text,
    ops_piercheckin text,
    paymentsnapshot_paid bigint,
    paymentsnapshot_paidstatus text,
    pierpayments text,
    ops_boatsplits text,
    ops_piernote text,
    b2coverride text,
    paymentsnapshot_deposit bigint,
    paymentsnapshot_balance bigint,
    specialmeals_allergylist text
);


--
-- Name: COLUMN sb_bookings.paymentsnapshot_deposit; Type: COMMENT; Schema: operation_schemas; Owner: -
--

COMMENT ON COLUMN operation_schemas.sb_bookings.paymentsnapshot_deposit IS 'B2C bookings.deposit — amount already taken. Order-level, so it lands on the first line of a multi-item order only.';


--
-- Name: COLUMN sb_bookings.paymentsnapshot_balance; Type: COMMENT; Schema: operation_schemas; Owner: -
--

COMMENT ON COLUMN operation_schemas.sb_bookings.paymentsnapshot_balance IS 'B2C bookings.balance — amount still owed. Order-level, first line only, same as deposit.';


--
-- Name: COLUMN sb_bookings.specialmeals_allergylist; Type: COMMENT; Schema: operation_schemas; Owner: -
--

COMMENT ON COLUMN operation_schemas.sb_bookings.specialmeals_allergylist IS 'JSON array [{name, qty}] — structured food allergies; qty = number of people. Paired with specialmeals_allergies (free-text note).';


--
-- Name: sb_bookings__addons; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__addons (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    type text,
    label text,
    amount bigint,
    qty bigint,
    note text
);


--
-- Name: sb_bookings__adjustments; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__adjustments (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    kind text,
    mode text,
    value bigint,
    label text,
    note text
);


--
-- Name: sb_bookings__feeitems; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__feeitems (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    type text,
    label text,
    amount bigint,
    at text
);


--
-- Name: sb_bookings__history; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__history (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    at text,
    kind text,
    text text,
    tag text,
    by text
);


--
-- Name: sb_bookings__over; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__over (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    routeid text,
    date text,
    name text,
    need bigint,
    capfree bigint,
    overby bigint,
    licfree bigint
);


--
-- Name: sb_bookings__partialcancels; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__partialcancels (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    tripidx bigint,
    paxremoved_foc_th bigint,
    count bigint,
    category text,
    categorylabel text,
    "group" text,
    note text,
    refundmode text,
    refund bigint,
    charged_count bigint,
    charged_amount bigint,
    waived_count bigint,
    waived_amount bigint,
    at text,
    by text,
    paxremoved_ad_fr bigint
);


--
-- Name: sb_bookings__passengers; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__passengers (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    name text,
    nationality text,
    type text,
    foc boolean
);


--
-- Name: sb_bookings__trips; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__trips (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    routeid text,
    date text,
    zone text,
    pax_ad_fr bigint,
    pax_chd_fr bigint,
    pax_inf_fr bigint,
    pax_foc_fr bigint,
    pax_ad_th bigint,
    pax_chd_th bigint,
    pax_inf_th bigint,
    pax_foc_th bigint,
    pax_ad bigint,
    pickuptime text,
    bookingmode text,
    charterboatid text,
    charterpricemode text,
    charterpricemanual bigint,
    charterpricenote text,
    charterdisplacementack boolean,
    ovn text,
    ovnreturndate text,
    ovncharge bigint,
    ovnleg boolean,
    ovnof text,
    seatsource_locked bigint,
    seatsource_general bigint,
    subtotal bigint,
    pax_foc bigint,
    lockdrawsel text,
    lockdraws text,
    ops_boatid text,
    ops_vanid text,
    ops_vanreturnid text,
    ops_returnsamevan boolean,
    ops_vangroup bigint,
    ops_vanseq bigint,
    ops_pickuptimefinal text,
    ops_vansplits text,
    ops_reconfirm text,
    ops_vancheckin text,
    ops_piercheckin text,
    ops_boatsplits text,
    ops_piernote text
);


--
-- Name: sb_bookings__upgrades; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_bookings__upgrades (
    sb_bookings_id text,
    idx bigint,
    row_pk text NOT NULL,
    id text,
    label text,
    sellprice bigint,
    tocompany bigint,
    commission bigint,
    collected boolean,
    note text,
    seller text,
    settle text,
    at text,
    method text,
    feepct double precision,
    fee bigint,
    customerpaid bigint,
    slips text
);


--
-- Name: sb_contracts; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_contracts (
    id text NOT NULL,
    agentid text,
    kind text,
    ratetypeid text,
    activefrom text,
    activeto text,
    priority bigint,
    version text,
    status text,
    createddate text,
    createdby text,
    note text,
    docid text
);


--
-- Name: sb_contracts__programperiods; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_contracts__programperiods (
    sb_contracts_id text,
    idx bigint,
    row_pk text NOT NULL,
    routeid text,
    bookfrom text,
    bookto text,
    travelfrom text,
    travelto text,
    note text
);


--
-- Name: sb_extras; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_extras (
    id text NOT NULL,
    bookingid text,
    tripdate text,
    service text,
    qty bigint,
    unitprice bigint,
    total bigint,
    tocompany bigint,
    commission bigint,
    seller text,
    method text,
    settle text,
    date text,
    feepct double precision,
    fee bigint,
    customerpaid bigint,
    slips text
);


--
-- Name: sb_invoices; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_invoices (
    id text NOT NULL,
    number text,
    agentid text,
    subtotal bigint,
    depositapplied bigint,
    total bigint,
    issuedat text,
    dueat text,
    status text,
    createdby text,
    netamount bigint,
    vatmode text,
    vatrate double precision,
    vatamount bigint,
    feetype text,
    note text
);


--
-- Name: sb_invoices__bookingids; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_invoices__bookingids (
    sb_invoices_id text,
    idx bigint,
    row_pk text NOT NULL,
    value text
);


--
-- Name: sb_invoices__lineitems; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_invoices__lineitems (
    sb_invoices_id text,
    idx bigint,
    row_pk text NOT NULL,
    label text,
    amount bigint
);


--
-- Name: sb_market_monthly; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_market_monthly (
    id text NOT NULL,
    key text,
    value bigint
);


--
-- Name: sb_market_stats; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_market_stats (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: sb_markets; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_markets (
    id text NOT NULL,
    name text,
    color text,
    sort bigint
);


--
-- Name: sb_markets__subs; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_markets__subs (
    sb_markets_id text,
    idx bigint,
    row_pk text NOT NULL,
    value text
);


--
-- Name: sb_nationalities; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_nationalities (
    id text NOT NULL,
    code text,
    name text,
    custom boolean
);


--
-- Name: sb_payments; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_payments (
    id text NOT NULL,
    invoiceid text,
    agentid text,
    amount bigint,
    method text,
    date text,
    type text,
    slips text
);


--
-- Name: sb_pickup_areas; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_pickup_areas (
    id text NOT NULL,
    name text,
    zone text,
    region text,
    timegroup text
);


--
-- Name: sb_pickup_time_profiles; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_pickup_time_profiles (
    id text NOT NULL,
    name text,
    "from" text,
    "to" text,
    notes text,
    clonedfrom text,
    createdat text
);


--
-- Name: sb_pickup_time_profiles__times; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_pickup_time_profiles__times (
    sb_pickup_time_profiles_id text,
    key text,
    row_pk text NOT NULL,
    pk_maikhao text,
    pk_naithon text,
    pk_naiyang text,
    pk_airport text,
    pk_talang text,
    pk_aopor text,
    pk_pakhlok text,
    pk_yamu text,
    pk_monument text,
    pk_kokaeo text,
    pk_sapam text,
    pk_layan text,
    pk_laguna text,
    pk_bangtao text,
    pk_cherngtalay text,
    pk_surin text,
    pk_kamala text,
    pk_kalim text,
    pk_tritrang text,
    pk_patong text,
    pk_karon text,
    pk_kata text,
    pk_rawai text,
    pk_naiharn text,
    pk_saiyuan text,
    pk_chalong text,
    pk_chaofa text,
    pk_siray text,
    pk_town text,
    pk_aoyon text,
    pk_panwa text,
    nt_panwa_pier text,
    pk_kathu text,
    pk_khokkloi text,
    pk_natai text,
    nt_tublamu_pier text,
    kl_numkhem text,
    kl_bangsak text,
    kl_pakwip text,
    kl_pakarang text,
    kl_khukkhak text,
    kl_bangniang text,
    kl_nanglao text,
    kl_center text,
    kl_khaolak text,
    kl_merlin text,
    kl_poseidon text,
    kl_tublamuhotel text
);


--
-- Name: sb_pickup_times; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_pickup_times (
    id text NOT NULL,
    key text,
    pk_n1 text,
    pk_n2 text,
    pk_e1 text,
    pk_e2 text,
    pk_wn1 text,
    pk_w1 text,
    pk_w2 text,
    pk_s1 text,
    pk_s2 text,
    pk_c1 text,
    pk_c2 text,
    pk_pa1 text,
    nt_vp text,
    pk_pn1 text,
    nt_tl text
);


--
-- Name: sb_rate_types; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types (
    id text NOT NULL,
    code text,
    name text,
    note text,
    color text,
    createddate text,
    validfrom text,
    validto text,
    active boolean,
    pricetiers text,
    nationalityscope text,
    owner text
);


--
-- Name: sb_rate_types__addons; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons (
    sb_rate_types_id text,
    key text,
    row_pk text NOT NULL,
    adult bigint,
    child bigint,
    unit text,
    join_adult bigint,
    join_child bigint,
    charter_price bigint,
    charter_capacity bigint
);


--
-- Name: sb_rate_types__addons__applies; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons__applies (
    sb_rate_types_addons_id text,
    idx bigint,
    row_pk text NOT NULL,
    value text
);


--
-- Name: sb_rate_types__addons__byroute; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons__byroute (
    sb_rate_types_addons_id text,
    key text,
    row_pk text NOT NULL,
    join_adult bigint,
    join_child bigint,
    charter_price bigint,
    charter_capacity bigint
);


--
-- Name: sb_rate_types__addons__r10; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons__r10 (
    sb_rate_types_addons_id text,
    key text,
    row_pk text NOT NULL,
    sedan bigint,
    van bigint
);


--
-- Name: sb_rate_types__addons__r11; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons__r11 (
    sb_rate_types_addons_id text,
    key text,
    row_pk text NOT NULL,
    sedan bigint,
    van bigint
);


--
-- Name: sb_rate_types__addons__r12; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons__r12 (
    sb_rate_types_addons_id text,
    key text,
    row_pk text NOT NULL,
    sedan bigint,
    van bigint
);


--
-- Name: sb_rate_types__addons__r4; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons__r4 (
    sb_rate_types_addons_id text,
    key text,
    row_pk text NOT NULL,
    sedan bigint,
    van bigint
);


--
-- Name: sb_rate_types__addons__r5; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons__r5 (
    sb_rate_types_addons_id text,
    key text,
    row_pk text NOT NULL,
    sedan bigint,
    van bigint
);


--
-- Name: sb_rate_types__addons__r6; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__addons__r6 (
    sb_rate_types_addons_id text,
    key text,
    row_pk text NOT NULL,
    sedan bigint,
    van bigint
);


--
-- Name: sb_rate_types__charterrates; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__charterrates (
    sb_rate_types_id text,
    key text,
    row_pk text NOT NULL,
    speedboat_starterprice bigint,
    speedboat_starterincludes bigint,
    speedboat_extraperpax bigint,
    catamaran_starterprice bigint,
    catamaran_starterincludes bigint,
    catamaran_extraperpax bigint
);


--
-- Name: sb_rate_types__routebundles; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__routebundles (
    sb_rate_types_id text,
    key text,
    row_pk text NOT NULL,
    longtail_mode text,
    longtail_adult bigint,
    longtail_child bigint
);


--
-- Name: sb_rate_types__routes; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__routes (
    sb_rate_types_id text,
    idx bigint,
    row_pk text NOT NULL,
    value text
);


--
-- Name: sb_rate_types__routevalidity; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__routevalidity (
    sb_rate_types_id text,
    key text,
    row_pk text NOT NULL,
    "from" text,
    "to" text
);


--
-- Name: sb_rate_types__seatrates; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_rate_types__seatrates (
    sb_rate_types_id text,
    key text,
    row_pk text NOT NULL,
    pk_adult_thai bigint,
    pk_adult_fr bigint,
    pk_child_thai bigint,
    pk_child_fr bigint,
    pk_infant_thai bigint,
    pk_infant_fr bigint,
    kl_adult_thai bigint,
    kl_adult_fr bigint,
    kl_child_thai bigint,
    kl_child_fr bigint,
    kl_infant_thai bigint,
    kl_infant_fr bigint,
    notransfer_adult_thai bigint,
    notransfer_adult_fr bigint,
    notransfer_child_thai bigint,
    notransfer_child_fr bigint,
    notransfer_infant_thai bigint,
    notransfer_infant_fr bigint,
    kl text
);


--
-- Name: sb_sales; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_sales (
    id text NOT NULL,
    code text,
    name text,
    color text,
    email text,
    fullname text,
    designation text,
    tel text,
    signature text,
    targets text,
    followup text
);


--
-- Name: sb_seat_locks; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_seat_locks (
    id text NOT NULL,
    routeid text,
    date text,
    boatid text,
    holdertype text,
    holderid text,
    qty bigint,
    used bigint,
    reason text,
    expiry text,
    status text,
    createdat text,
    createdby text,
    scope text,
    month text,
    monthfrom text,
    monthto text,
    parentid text,
    subname text,
    releasedaysbefore bigint,
    releasetime text
);


--
-- Name: sb_seat_locks__log; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_seat_locks__log (
    sb_seat_locks_id text,
    idx bigint,
    row_pk text NOT NULL,
    date text,
    type text,
    qty bigint,
    at text,
    by text,
    bookingid text,
    sub boolean,
    note text
);


--
-- Name: sb_staff; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_staff (
    id text NOT NULL,
    code text,
    name text,
    dept text,
    active boolean,
    quota_2026 bigint
);


--
-- Name: sb_vehicles; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_vehicles (
    id text NOT NULL,
    name text,
    plate text,
    type text,
    capacity bigint,
    ownership text,
    partnername text,
    zonebase text,
    active boolean,
    note text,
    driver text,
    driverphone text,
    dayzone_2026_06_12 text,
    color text,
    costperday numeric
);


--
-- Name: sb_vehicles__dayroute; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_vehicles__dayroute (
    sb_vehicles_id text,
    key text,
    row_pk text NOT NULL,
    value text
);


--
-- Name: sb_vehicles__daystatus; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_vehicles__daystatus (
    sb_vehicles_id text,
    key text,
    row_pk text NOT NULL,
    value text
);


--
-- Name: sb_vehicles__log; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_vehicles__log (
    sb_vehicles_id text,
    idx bigint,
    row_pk text NOT NULL,
    at text,
    kind text,
    text text
);


--
-- Name: sb_vehicles__statusranges; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_vehicles__statusranges (
    sb_vehicles_id text,
    idx bigint,
    row_pk text NOT NULL,
    s text,
    "from" text,
    "to" text,
    note text
);


--
-- Name: sb_weather; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.sb_weather (
    id text NOT NULL,
    routeid text,
    date text,
    reason text,
    at text,
    note text
);


--
-- Name: travel_sum; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.travel_sum (
    id text NOT NULL,
    key text,
    decision text,
    amount bigint,
    note text,
    by text,
    at text
);


--
-- Name: trip_actuals; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.trip_actuals (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: trips; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.trips (
    id text NOT NULL,
    key text,
    b1_route text,
    b1_type text,
    b1_booked bigint,
    b3_route text,
    b3_type text,
    b3_booked bigint,
    b4_route text,
    b4_type text,
    b4_booked bigint,
    b5_route text,
    b5_type text,
    b5_booked bigint,
    b6_route text,
    b6_type text,
    b6_booked bigint,
    b7_route text,
    b7_type text,
    b7_booked bigint,
    b9_route text,
    b9_type text,
    b9_booked bigint,
    b10_route text,
    b10_type text,
    b10_booked bigint,
    b12_route text,
    b12_type text,
    b12_booked bigint,
    b11_route text,
    b11_type text,
    b11_booked bigint,
    b13_route text,
    b13_type text,
    b13_booked bigint,
    b2_route text,
    b2_type text,
    b2_booked bigint,
    b13_charterbookingid text,
    b6_charterbookingid text,
    b8_route text,
    b8_type text,
    b8_booked bigint,
    b8_charterbookingid text,
    b14_route text,
    b14_type text,
    b14_booked bigint,
    b14_charterbookingid text,
    b15_route text,
    b15_type text,
    b15_booked bigint,
    b15_charterbookingid text
);


--
-- Name: ts_cot; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.ts_cot (
    id text NOT NULL,
    key text,
    mode text,
    deduct bigint,
    payout bigint,
    ref text,
    by text,
    at text
);


--
-- Name: users; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.users (
    id integer NOT NULL,
    username text NOT NULL,
    pass_hash text NOT NULL,
    name text,
    role text DEFAULT 'staff'::text,
    created_at timestamp with time zone DEFAULT now(),
    perms text,
    can_edit boolean DEFAULT true,
    edit_areas text,
    dept text,
    sales_id text,
    logout_after bigint
);


--
-- Name: COLUMN users.logout_after; Type: COMMENT; Schema: operation_schemas; Owner: -
--

COMMENT ON COLUMN operation_schemas.users.logout_after IS 'ms epoch of last sign-out; session tokens issued at or before this are rejected (see verify() in server.js)';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: operation_schemas; Owner: -
--

CREATE SEQUENCE operation_schemas.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: operation_schemas; Owner: -
--

ALTER SEQUENCE operation_schemas.users_id_seq OWNED BY operation_schemas.users.id;


--
-- Name: v_seat_availability; Type: VIEW; Schema: operation_schemas; Owner: -
--

CREATE VIEW operation_schemas.v_seat_availability AS
 WITH deploy AS (
         SELECT tr.key AS date,
            bo.id AS boatid,
            LEAST(COALESCE(o.cap, bo.cap), COALESCE(NULLIF(bo.licensepax, 0), bo.cap)) AS cap,
            (to_jsonb(tr.*) ->> (bo.id || '_route'::text)) AS routeid,
            (to_jsonb(tr.*) ->> (bo.id || '_type'::text)) AS btype
           FROM ((operation_schemas.trips tr
             CROSS JOIN operation_schemas.boats bo)
             LEFT JOIN operation_schemas.boat_capovr o ON ((o.key = ((tr.key || '::'::text) || bo.id))))
        ), cap AS (
         SELECT d_1.date,
            d_1.routeid,
            (COALESCE(sum(d_1.cap) FILTER (WHERE (d_1.btype IS DISTINCT FROM 'charter'::text)), (0)::numeric))::bigint AS capacity,
            string_agg(d_1.boatid, '+'::text) FILTER (WHERE (d_1.btype IS DISTINCT FROM 'charter'::text)) AS boats
           FROM deploy d_1
          WHERE ((d_1.routeid IS NOT NULL) AND (d_1.routeid <> ''::text))
          GROUP BY d_1.date, d_1.routeid
        ), demand AS (
         SELECT operation_schemas.f_trip_date_iso(t.date, b.createdat) AS date,
            t.routeid,
            (COALESCE(sum((((((((((COALESCE(t.pax_ad, (0)::bigint) + COALESCE(t.pax_ad_fr, (0)::bigint)) + COALESCE(t.pax_ad_th, (0)::bigint)) + COALESCE(t.pax_chd_fr, (0)::bigint)) + COALESCE(t.pax_chd_th, (0)::bigint)) + COALESCE(t.pax_inf_fr, (0)::bigint)) + COALESCE(t.pax_inf_th, (0)::bigint)) + COALESCE(t.pax_foc, (0)::bigint)) + COALESCE(t.pax_foc_fr, (0)::bigint)) + COALESCE(t.pax_foc_th, (0)::bigint))), (0)::numeric))::bigint AS booked
           FROM (operation_schemas.sb_bookings__trips t
             JOIN operation_schemas.sb_bookings b ON ((b.id = t.sb_bookings_id)))
          WHERE ((b.status <> ALL (ARRAY['cancelled'::text, 'cancelled_weather'::text, 'rejected'::text])) AND (t.bookingmode IS DISTINCT FROM 'charter'::text) AND (t.routeid IS NOT NULL) AND (t.routeid <> ''::text))
          GROUP BY (operation_schemas.f_trip_date_iso(t.date, b.createdat)), t.routeid
        ), locks AS (
         SELECT "left"(sl.date, 10) AS date,
            sl.routeid,
            (COALESCE(sum(GREATEST((((sl.qty - COALESCE(sl.used, (0)::bigint)))::numeric - COALESCE(ch.child_used, ((0)::bigint)::numeric)), ((0)::bigint)::numeric)), (0)::numeric))::bigint AS locked
           FROM (operation_schemas.sb_seat_locks sl
             LEFT JOIN LATERAL ( SELECT COALESCE(sum(COALESCE(c_1.used, (0)::bigint)), ((0)::bigint)::numeric) AS child_used
                   FROM operation_schemas.sb_seat_locks c_1
                  WHERE (c_1.parentid = sl.id)) ch ON (true))
          WHERE ((sl.status = 'active'::text) AND ((sl.parentid IS NULL) OR (sl.parentid = ''::text)) AND (sl.date IS NOT NULL) AND (sl.date <> ''::text) AND (sl.routeid IS NOT NULL) AND (sl.routeid <> ''::text))
          GROUP BY ("left"(sl.date, 10)), sl.routeid
        ), keys AS (
         SELECT cap.date,
            cap.routeid
           FROM cap
        UNION
         SELECT demand.date,
            demand.routeid
           FROM demand
          WHERE (demand.date IS NOT NULL)
        UNION
         SELECT locks.date,
            locks.routeid
           FROM locks
        )
 SELECT k.date,
    k.routeid,
    COALESCE(c.capacity, (0)::bigint) AS capacity,
    COALESCE(d.booked, (0)::bigint) AS booked,
    COALESCE(l.locked, (0)::bigint) AS locked,
    GREATEST(((COALESCE(c.capacity, (0)::bigint) - COALESCE(d.booked, (0)::bigint)) - COALESCE(l.locked, (0)::bigint)), (0)::bigint) AS available,
    COALESCE(c.boats, ''::text) AS boats,
    (c.date IS NOT NULL) AS board_exists
   FROM (((keys k
     LEFT JOIN cap c ON (((c.date = k.date) AND (c.routeid = k.routeid))))
     LEFT JOIN demand d ON (((d.date = k.date) AND (d.routeid = k.routeid))))
     LEFT JOIN locks l ON (((l.date = k.date) AND (l.routeid = k.routeid))));


--
-- Name: VIEW v_seat_availability; Type: COMMENT; Schema: operation_schemas; Owner: -
--

COMMENT ON VIEW operation_schemas.v_seat_availability IS 'Single source of truth for seat availability by (date, routeid). Consumers SELECT from this, never from the base tables. `locked` counts parent/standalone holds only — sub-holds live inside their parent''s qty.';


--
-- Name: v_seat_availability_unmapped; Type: VIEW; Schema: operation_schemas; Owner: -
--

CREATE VIEW operation_schemas.v_seat_availability_unmapped AS
 SELECT t.row_pk,
    t.sb_bookings_id,
    t.routeid,
    t.date AS raw_date,
    b.createdat,
    b.bookingdate,
    b.status,
    (((((((((COALESCE(t.pax_ad, (0)::bigint) + COALESCE(t.pax_ad_fr, (0)::bigint)) + COALESCE(t.pax_ad_th, (0)::bigint)) + COALESCE(t.pax_chd_fr, (0)::bigint)) + COALESCE(t.pax_chd_th, (0)::bigint)) + COALESCE(t.pax_inf_fr, (0)::bigint)) + COALESCE(t.pax_inf_th, (0)::bigint)) + COALESCE(t.pax_foc, (0)::bigint)) + COALESCE(t.pax_foc_fr, (0)::bigint)) + COALESCE(t.pax_foc_th, (0)::bigint)) AS uncounted_pax
   FROM (operation_schemas.sb_bookings__trips t
     JOIN operation_schemas.sb_bookings b ON ((b.id = t.sb_bookings_id)))
  WHERE ((b.status <> ALL (ARRAY['cancelled'::text, 'cancelled_weather'::text, 'rejected'::text])) AND (t.bookingmode IS DISTINCT FROM 'charter'::text) AND (operation_schemas.f_trip_date_iso(t.date, b.createdat) IS NULL));


--
-- Name: VIEW v_seat_availability_unmapped; Type: COMMENT; Schema: operation_schemas; Owner: -
--

COMMENT ON VIEW operation_schemas.v_seat_availability_unmapped IS 'Trip rows excluded from v_seat_availability because their date could not be normalised. Should be empty.';


--
-- Name: vanjob_driver; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.vanjob_driver (
    id text NOT NULL,
    key text,
    driver text,
    phone text,
    plate text
);


--
-- Name: vanjob_pickup_th; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.vanjob_pickup_th (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: vanjob_sent; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.vanjob_sent (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: vanjob_sreq; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.vanjob_sreq (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: vanjob_th_flag; Type: TABLE; Schema: operation_schemas; Owner: -
--

CREATE TABLE operation_schemas.vanjob_th_flag (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: users id; Type: DEFAULT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.users ALTER COLUMN id SET DEFAULT nextval('operation_schemas.users_id_seq'::regclass);


--
-- Name: agent_artifacts agent_artifacts_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.agent_artifacts
    ADD CONSTRAINT agent_artifacts_pkey PRIMARY KEY (id);


--
-- Name: app_hooks app_hooks_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.app_hooks
    ADD CONSTRAINT app_hooks_pkey PRIMARY KEY (id);


--
-- Name: app_state app_state_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.app_state
    ADD CONSTRAINT app_state_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: boat_capovr boat_capovr_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boat_capovr
    ADD CONSTRAINT boat_capovr_pkey PRIMARY KEY (id);


--
-- Name: boats__assignments boats__assignments_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__assignments
    ADD CONSTRAINT boats__assignments_pkey PRIMARY KEY (row_pk);


--
-- Name: boats__docs boats__docs_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__docs
    ADD CONSTRAINT boats__docs_pkey PRIMARY KEY (row_pk);


--
-- Name: boats__log boats__log_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__log
    ADD CONSTRAINT boats__log_pkey PRIMARY KEY (row_pk);


--
-- Name: boats__repairhistory__assets boats__repairhistory__assets_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__repairhistory__assets
    ADD CONSTRAINT boats__repairhistory__assets_pkey PRIMARY KEY (row_pk);


--
-- Name: boats__repairhistory boats__repairhistory_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__repairhistory
    ADD CONSTRAINT boats__repairhistory_pkey PRIMARY KEY (row_pk);


--
-- Name: boats boats_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats
    ADD CONSTRAINT boats_pkey PRIMARY KEY (id);


--
-- Name: contract_templates contract_templates_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.contract_templates
    ADD CONSTRAINT contract_templates_pkey PRIMARY KEY (id);


--
-- Name: fleet_consumable_logs fleet_consumable_logs_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_consumable_logs
    ADD CONSTRAINT fleet_consumable_logs_pkey PRIMARY KEY (id);


--
-- Name: fleet_daily__boat fleet_daily__boat_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_daily__boat
    ADD CONSTRAINT fleet_daily__boat_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_daily__trips fleet_daily__trips_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_daily__trips
    ADD CONSTRAINT fleet_daily__trips_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_daily fleet_daily_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_daily
    ADD CONSTRAINT fleet_daily_pkey PRIMARY KEY (id);


--
-- Name: fleet_drlock fleet_drlock_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_drlock
    ADD CONSTRAINT fleet_drlock_pkey PRIMARY KEY (id);


--
-- Name: fleet_engines__log fleet_engines__log_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_engines__log
    ADD CONSTRAINT fleet_engines__log_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_engines fleet_engines_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_engines
    ADD CONSTRAINT fleet_engines_pkey PRIMARY KEY (id);


--
-- Name: fleet_fuelprice fleet_fuelprice_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_fuelprice
    ADD CONSTRAINT fleet_fuelprice_pkey PRIMARY KEY (id);


--
-- Name: fleet_gearboxes__log fleet_gearboxes__log_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_gearboxes__log
    ADD CONSTRAINT fleet_gearboxes__log_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_gearboxes fleet_gearboxes_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_gearboxes
    ADD CONSTRAINT fleet_gearboxes_pkey PRIMARY KEY (id);


--
-- Name: fleet_incidents__damagedassets fleet_incidents__damagedassets_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_incidents__damagedassets
    ADD CONSTRAINT fleet_incidents__damagedassets_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_incidents__progresslog fleet_incidents__progresslog_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_incidents__progresslog
    ADD CONSTRAINT fleet_incidents__progresslog_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_incidents__relatedmaintids fleet_incidents__relatedmaintids_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_incidents__relatedmaintids
    ADD CONSTRAINT fleet_incidents__relatedmaintids_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_incidents fleet_incidents_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_incidents
    ADD CONSTRAINT fleet_incidents_pkey PRIMARY KEY (id);


--
-- Name: fleet_inventory__history__changes fleet_inventory__history__changes_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_inventory__history__changes
    ADD CONSTRAINT fleet_inventory__history__changes_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_inventory__history fleet_inventory__history_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_inventory__history
    ADD CONSTRAINT fleet_inventory__history_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_inventory__stocks fleet_inventory__stocks_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_inventory__stocks
    ADD CONSTRAINT fleet_inventory__stocks_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_inventory fleet_inventory_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_inventory
    ADD CONSTRAINT fleet_inventory_pkey PRIMARY KEY (id);


--
-- Name: fleet_maintenance__assets fleet_maintenance__assets_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_maintenance__assets
    ADD CONSTRAINT fleet_maintenance__assets_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_maintenance__parts fleet_maintenance__parts_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_maintenance__parts
    ADD CONSTRAINT fleet_maintenance__parts_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_maintenance__progresslog fleet_maintenance__progresslog_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_maintenance__progresslog
    ADD CONSTRAINT fleet_maintenance__progresslog_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_maintenance fleet_maintenance_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_maintenance
    ADD CONSTRAINT fleet_maintenance_pkey PRIMARY KEY (id);


--
-- Name: fleet_memos__items fleet_memos__items_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_memos__items
    ADD CONSTRAINT fleet_memos__items_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_memos fleet_memos_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_memos
    ADD CONSTRAINT fleet_memos_pkey PRIMARY KEY (id);


--
-- Name: fleet_projects__log fleet_projects__log_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_projects__log
    ADD CONSTRAINT fleet_projects__log_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_projects__plan fleet_projects__plan_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_projects__plan
    ADD CONSTRAINT fleet_projects__plan_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_projects fleet_projects_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_projects
    ADD CONSTRAINT fleet_projects_pkey PRIMARY KEY (id);


--
-- Name: fleet_propellers__log fleet_propellers__log_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_propellers__log
    ADD CONSTRAINT fleet_propellers__log_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_propellers fleet_propellers_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_propellers
    ADD CONSTRAINT fleet_propellers_pkey PRIMARY KEY (id);


--
-- Name: fleet_safety__inspections fleet_safety__inspections_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_safety__inspections
    ADD CONSTRAINT fleet_safety__inspections_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_safety__log fleet_safety__log_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_safety__log
    ADD CONSTRAINT fleet_safety__log_pkey PRIMARY KEY (row_pk);


--
-- Name: fleet_safety fleet_safety_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_safety
    ADD CONSTRAINT fleet_safety_pkey PRIMARY KEY (id);


--
-- Name: insurance_overrides insurance_overrides_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.insurance_overrides
    ADD CONSTRAINT insurance_overrides_pkey PRIMARY KEY (id);


--
-- Name: meal_venues meal_venues_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.meal_venues
    ADD CONSTRAINT meal_venues_pkey PRIMARY KEY (id);


--
-- Name: nat_learn nat_learn_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.nat_learn
    ADD CONSTRAINT nat_learn_pkey PRIMARY KEY (id);


--
-- Name: pier_kinds pier_kinds_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.pier_kinds
    ADD CONSTRAINT pier_kinds_pkey PRIMARY KEY (id);


--
-- Name: pier_sect pier_sect_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.pier_sect
    ADD CONSTRAINT pier_sect_pkey PRIMARY KEY (id);


--
-- Name: routes__overrides routes__overrides_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.routes__overrides
    ADD CONSTRAINT routes__overrides_pkey PRIMARY KEY (row_pk);


--
-- Name: routes__seasons routes__seasons_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.routes__seasons
    ADD CONSTRAINT routes__seasons_pkey PRIMARY KEY (row_pk);


--
-- Name: routes__times routes__times_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.routes__times
    ADD CONSTRAINT routes__times_pkey PRIMARY KEY (row_pk);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: sb_agents__activity sb_agents__activity_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents__activity
    ADD CONSTRAINT sb_agents__activity_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_agents__contracthistory sb_agents__contracthistory_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents__contracthistory
    ADD CONSTRAINT sb_agents__contracthistory_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_agents__programperiods sb_agents__programperiods_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents__programperiods
    ADD CONSTRAINT sb_agents__programperiods_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_agents__programs sb_agents__programs_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents__programs
    ADD CONSTRAINT sb_agents__programs_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_agents sb_agents_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents
    ADD CONSTRAINT sb_agents_pkey PRIMARY KEY (id);


--
-- Name: sb_agents_rate_bindings sb_agents_rate_bindings_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents_rate_bindings
    ADD CONSTRAINT sb_agents_rate_bindings_pkey PRIMARY KEY (id);


--
-- Name: sb_bookings__addons sb_bookings__addons_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__addons
    ADD CONSTRAINT sb_bookings__addons_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings__adjustments sb_bookings__adjustments_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__adjustments
    ADD CONSTRAINT sb_bookings__adjustments_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings__feeitems sb_bookings__feeitems_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__feeitems
    ADD CONSTRAINT sb_bookings__feeitems_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings__history sb_bookings__history_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__history
    ADD CONSTRAINT sb_bookings__history_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings__over sb_bookings__over_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__over
    ADD CONSTRAINT sb_bookings__over_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings__partialcancels sb_bookings__partialcancels_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__partialcancels
    ADD CONSTRAINT sb_bookings__partialcancels_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings__passengers sb_bookings__passengers_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__passengers
    ADD CONSTRAINT sb_bookings__passengers_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings__trips sb_bookings__trips_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__trips
    ADD CONSTRAINT sb_bookings__trips_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings__upgrades sb_bookings__upgrades_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__upgrades
    ADD CONSTRAINT sb_bookings__upgrades_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_bookings sb_bookings_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings
    ADD CONSTRAINT sb_bookings_pkey PRIMARY KEY (id);


--
-- Name: sb_contracts__programperiods sb_contracts__programperiods_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_contracts__programperiods
    ADD CONSTRAINT sb_contracts__programperiods_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_contracts sb_contracts_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_contracts
    ADD CONSTRAINT sb_contracts_pkey PRIMARY KEY (id);


--
-- Name: sb_extras sb_extras_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_extras
    ADD CONSTRAINT sb_extras_pkey PRIMARY KEY (id);


--
-- Name: sb_invoices__bookingids sb_invoices__bookingids_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_invoices__bookingids
    ADD CONSTRAINT sb_invoices__bookingids_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_invoices__lineitems sb_invoices__lineitems_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_invoices__lineitems
    ADD CONSTRAINT sb_invoices__lineitems_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_invoices sb_invoices_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_invoices
    ADD CONSTRAINT sb_invoices_pkey PRIMARY KEY (id);


--
-- Name: sb_market_monthly sb_market_monthly_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_market_monthly
    ADD CONSTRAINT sb_market_monthly_pkey PRIMARY KEY (id);


--
-- Name: sb_market_stats sb_market_stats_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_market_stats
    ADD CONSTRAINT sb_market_stats_pkey PRIMARY KEY (id);


--
-- Name: sb_markets__subs sb_markets__subs_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_markets__subs
    ADD CONSTRAINT sb_markets__subs_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_markets sb_markets_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_markets
    ADD CONSTRAINT sb_markets_pkey PRIMARY KEY (id);


--
-- Name: sb_nationalities sb_nationalities_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_nationalities
    ADD CONSTRAINT sb_nationalities_pkey PRIMARY KEY (id);


--
-- Name: sb_payments sb_payments_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_payments
    ADD CONSTRAINT sb_payments_pkey PRIMARY KEY (id);


--
-- Name: sb_pickup_areas sb_pickup_areas_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_pickup_areas
    ADD CONSTRAINT sb_pickup_areas_pkey PRIMARY KEY (id);


--
-- Name: sb_pickup_time_profiles__times sb_pickup_time_profiles__times_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_pickup_time_profiles__times
    ADD CONSTRAINT sb_pickup_time_profiles__times_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_pickup_time_profiles sb_pickup_time_profiles_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_pickup_time_profiles
    ADD CONSTRAINT sb_pickup_time_profiles_pkey PRIMARY KEY (id);


--
-- Name: sb_pickup_times sb_pickup_times_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_pickup_times
    ADD CONSTRAINT sb_pickup_times_pkey PRIMARY KEY (id);


--
-- Name: sb_rate_types__addons__applies sb_rate_types__addons__applies_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons__applies
    ADD CONSTRAINT sb_rate_types__addons__applies_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__addons__byroute sb_rate_types__addons__byroute_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons__byroute
    ADD CONSTRAINT sb_rate_types__addons__byroute_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__addons__r10 sb_rate_types__addons__r10_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons__r10
    ADD CONSTRAINT sb_rate_types__addons__r10_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__addons__r11 sb_rate_types__addons__r11_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons__r11
    ADD CONSTRAINT sb_rate_types__addons__r11_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__addons__r12 sb_rate_types__addons__r12_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons__r12
    ADD CONSTRAINT sb_rate_types__addons__r12_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__addons__r4 sb_rate_types__addons__r4_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons__r4
    ADD CONSTRAINT sb_rate_types__addons__r4_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__addons__r5 sb_rate_types__addons__r5_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons__r5
    ADD CONSTRAINT sb_rate_types__addons__r5_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__addons__r6 sb_rate_types__addons__r6_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons__r6
    ADD CONSTRAINT sb_rate_types__addons__r6_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__addons sb_rate_types__addons_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons
    ADD CONSTRAINT sb_rate_types__addons_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__charterrates sb_rate_types__charterrates_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__charterrates
    ADD CONSTRAINT sb_rate_types__charterrates_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__routebundles sb_rate_types__routebundles_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__routebundles
    ADD CONSTRAINT sb_rate_types__routebundles_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__routes sb_rate_types__routes_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__routes
    ADD CONSTRAINT sb_rate_types__routes_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__routevalidity sb_rate_types__routevalidity_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__routevalidity
    ADD CONSTRAINT sb_rate_types__routevalidity_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types__seatrates sb_rate_types__seatrates_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__seatrates
    ADD CONSTRAINT sb_rate_types__seatrates_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_rate_types sb_rate_types_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types
    ADD CONSTRAINT sb_rate_types_pkey PRIMARY KEY (id);


--
-- Name: sb_sales sb_sales_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_sales
    ADD CONSTRAINT sb_sales_pkey PRIMARY KEY (id);


--
-- Name: sb_seat_locks__log sb_seat_locks__log_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_seat_locks__log
    ADD CONSTRAINT sb_seat_locks__log_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_seat_locks sb_seat_locks_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_seat_locks
    ADD CONSTRAINT sb_seat_locks_pkey PRIMARY KEY (id);


--
-- Name: sb_staff sb_staff_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_staff
    ADD CONSTRAINT sb_staff_pkey PRIMARY KEY (id);


--
-- Name: sb_vehicles__dayroute sb_vehicles__dayroute_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles__dayroute
    ADD CONSTRAINT sb_vehicles__dayroute_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_vehicles__daystatus sb_vehicles__daystatus_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles__daystatus
    ADD CONSTRAINT sb_vehicles__daystatus_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_vehicles__log sb_vehicles__log_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles__log
    ADD CONSTRAINT sb_vehicles__log_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_vehicles__statusranges sb_vehicles__statusranges_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles__statusranges
    ADD CONSTRAINT sb_vehicles__statusranges_pkey PRIMARY KEY (row_pk);


--
-- Name: sb_vehicles sb_vehicles_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles
    ADD CONSTRAINT sb_vehicles_pkey PRIMARY KEY (id);


--
-- Name: sb_weather sb_weather_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_weather
    ADD CONSTRAINT sb_weather_pkey PRIMARY KEY (id);


--
-- Name: travel_sum travel_sum_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.travel_sum
    ADD CONSTRAINT travel_sum_pkey PRIMARY KEY (id);


--
-- Name: trip_actuals trip_actuals_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.trip_actuals
    ADD CONSTRAINT trip_actuals_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: ts_cot ts_cot_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.ts_cot
    ADD CONSTRAINT ts_cot_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: vanjob_driver vanjob_driver_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.vanjob_driver
    ADD CONSTRAINT vanjob_driver_pkey PRIMARY KEY (id);


--
-- Name: vanjob_pickup_th vanjob_pickup_th_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.vanjob_pickup_th
    ADD CONSTRAINT vanjob_pickup_th_pkey PRIMARY KEY (id);


--
-- Name: vanjob_sent vanjob_sent_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.vanjob_sent
    ADD CONSTRAINT vanjob_sent_pkey PRIMARY KEY (id);


--
-- Name: vanjob_sreq vanjob_sreq_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.vanjob_sreq
    ADD CONSTRAINT vanjob_sreq_pkey PRIMARY KEY (id);


--
-- Name: vanjob_th_flag vanjob_th_flag_pkey; Type: CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.vanjob_th_flag
    ADD CONSTRAINT vanjob_th_flag_pkey PRIMARY KEY (id);


--
-- Name: idx_attach_booking; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX idx_attach_booking ON operation_schemas.attachments USING btree (booking_id);


--
-- Name: idx_fleetdaily_boat; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX idx_fleetdaily_boat ON operation_schemas.fleet_daily__boat USING btree (fleet_daily_id);


--
-- Name: idx_sbcontracts_pp; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX idx_sbcontracts_pp ON operation_schemas.sb_contracts__programperiods USING btree (sb_contracts_id);


--
-- Name: pier_codes_code_idx; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_codes_code_idx ON operation_schemas.pier_codes USING btree (code);


--
-- Name: pier_items_pier_idx; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_items_pier_idx ON operation_schemas.pier_items USING btree (pier);


--
-- Name: pier_lic_classes_type; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_lic_classes_type ON operation_schemas.pier_lic_classes USING btree (typeid);


--
-- Name: pier_licenses_exp_idx; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_licenses_exp_idx ON operation_schemas.pier_licenses USING btree (exp);


--
-- Name: pier_licenses_staff_idx; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_licenses_staff_idx ON operation_schemas.pier_licenses USING btree (staffid);


--
-- Name: pier_moves_date_idx; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_moves_date_idx ON operation_schemas.pier_moves USING btree (date);


--
-- Name: pier_moves_item_idx; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_moves_item_idx ON operation_schemas.pier_moves USING btree (itemid);


--
-- Name: pier_moves_pier_date; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_moves_pier_date ON operation_schemas.pier_moves USING btree (pier, date);


--
-- Name: pier_staff_pier_idx; Type: INDEX; Schema: operation_schemas; Owner: -
--

CREATE INDEX pier_staff_pier_idx ON operation_schemas.pier_staff USING btree (pier);


--
-- Name: boats__assignments fk_boats_assignments; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__assignments
    ADD CONSTRAINT fk_boats_assignments FOREIGN KEY (boats_id) REFERENCES operation_schemas.boats(id) ON DELETE CASCADE;


--
-- Name: boats__docs fk_boats_docs; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__docs
    ADD CONSTRAINT fk_boats_docs FOREIGN KEY (boats_id) REFERENCES operation_schemas.boats(id) ON DELETE CASCADE;


--
-- Name: boats__log fk_boats_log; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__log
    ADD CONSTRAINT fk_boats_log FOREIGN KEY (boats_id) REFERENCES operation_schemas.boats(id) ON DELETE CASCADE;


--
-- Name: boats__repairhistory fk_boats_repairhistory; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.boats__repairhistory
    ADD CONSTRAINT fk_boats_repairhistory FOREIGN KEY (boats_id) REFERENCES operation_schemas.boats(id) ON DELETE CASCADE;


--
-- Name: fleet_engines__log fk_fleet_engines_log; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_engines__log
    ADD CONSTRAINT fk_fleet_engines_log FOREIGN KEY (fleet_engines_id) REFERENCES operation_schemas.fleet_engines(id) ON DELETE CASCADE;


--
-- Name: fleet_gearboxes__log fk_fleet_gearboxes_log; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_gearboxes__log
    ADD CONSTRAINT fk_fleet_gearboxes_log FOREIGN KEY (fleet_gearboxes_id) REFERENCES operation_schemas.fleet_gearboxes(id) ON DELETE CASCADE;


--
-- Name: fleet_incidents__damagedassets fk_fleet_incidents_damagedassets; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_incidents__damagedassets
    ADD CONSTRAINT fk_fleet_incidents_damagedassets FOREIGN KEY (fleet_incidents_id) REFERENCES operation_schemas.fleet_incidents(id) ON DELETE CASCADE;


--
-- Name: fleet_incidents__progresslog fk_fleet_incidents_progresslog; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_incidents__progresslog
    ADD CONSTRAINT fk_fleet_incidents_progresslog FOREIGN KEY (fleet_incidents_id) REFERENCES operation_schemas.fleet_incidents(id) ON DELETE CASCADE;


--
-- Name: fleet_incidents__relatedmaintids fk_fleet_incidents_relatedmaintids; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_incidents__relatedmaintids
    ADD CONSTRAINT fk_fleet_incidents_relatedmaintids FOREIGN KEY (fleet_incidents_id) REFERENCES operation_schemas.fleet_incidents(id) ON DELETE CASCADE;


--
-- Name: fleet_inventory__history fk_fleet_inventory_history; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_inventory__history
    ADD CONSTRAINT fk_fleet_inventory_history FOREIGN KEY (fleet_inventory_id) REFERENCES operation_schemas.fleet_inventory(id) ON DELETE CASCADE;


--
-- Name: fleet_inventory__stocks fk_fleet_inventory_stocks; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_inventory__stocks
    ADD CONSTRAINT fk_fleet_inventory_stocks FOREIGN KEY (fleet_inventory_id) REFERENCES operation_schemas.fleet_inventory(id) ON DELETE CASCADE;


--
-- Name: fleet_maintenance__assets fk_fleet_maintenance_assets; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_maintenance__assets
    ADD CONSTRAINT fk_fleet_maintenance_assets FOREIGN KEY (fleet_maintenance_id) REFERENCES operation_schemas.fleet_maintenance(id) ON DELETE CASCADE;


--
-- Name: fleet_maintenance__parts fk_fleet_maintenance_parts; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_maintenance__parts
    ADD CONSTRAINT fk_fleet_maintenance_parts FOREIGN KEY (fleet_maintenance_id) REFERENCES operation_schemas.fleet_maintenance(id) ON DELETE CASCADE;


--
-- Name: fleet_maintenance__progresslog fk_fleet_maintenance_progresslog; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_maintenance__progresslog
    ADD CONSTRAINT fk_fleet_maintenance_progresslog FOREIGN KEY (fleet_maintenance_id) REFERENCES operation_schemas.fleet_maintenance(id) ON DELETE CASCADE;


--
-- Name: fleet_memos__items fk_fleet_memos_items; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_memos__items
    ADD CONSTRAINT fk_fleet_memos_items FOREIGN KEY (fleet_memos_id) REFERENCES operation_schemas.fleet_memos(id) ON DELETE CASCADE;


--
-- Name: fleet_projects__log fk_fleet_projects_log; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_projects__log
    ADD CONSTRAINT fk_fleet_projects_log FOREIGN KEY (fleet_projects_id) REFERENCES operation_schemas.fleet_projects(id) ON DELETE CASCADE;


--
-- Name: fleet_projects__plan fk_fleet_projects_plan; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_projects__plan
    ADD CONSTRAINT fk_fleet_projects_plan FOREIGN KEY (fleet_projects_id) REFERENCES operation_schemas.fleet_projects(id) ON DELETE CASCADE;


--
-- Name: fleet_propellers__log fk_fleet_propellers_log; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_propellers__log
    ADD CONSTRAINT fk_fleet_propellers_log FOREIGN KEY (fleet_propellers_id) REFERENCES operation_schemas.fleet_propellers(id) ON DELETE CASCADE;


--
-- Name: fleet_safety__inspections fk_fleet_safety_inspections; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_safety__inspections
    ADD CONSTRAINT fk_fleet_safety_inspections FOREIGN KEY (fleet_safety_id) REFERENCES operation_schemas.fleet_safety(id) ON DELETE CASCADE;


--
-- Name: fleet_safety__log fk_fleet_safety_log; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_safety__log
    ADD CONSTRAINT fk_fleet_safety_log FOREIGN KEY (fleet_safety_id) REFERENCES operation_schemas.fleet_safety(id) ON DELETE CASCADE;


--
-- Name: routes__seasons fk_routes_seasons; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.routes__seasons
    ADD CONSTRAINT fk_routes_seasons FOREIGN KEY (routes_id) REFERENCES operation_schemas.routes(id) ON DELETE CASCADE;


--
-- Name: routes__times fk_routes_times; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.routes__times
    ADD CONSTRAINT fk_routes_times FOREIGN KEY (routes_id) REFERENCES operation_schemas.routes(id) ON DELETE CASCADE;


--
-- Name: sb_agents__activity fk_sb_agents_activity; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents__activity
    ADD CONSTRAINT fk_sb_agents_activity FOREIGN KEY (sb_agents_id) REFERENCES operation_schemas.sb_agents(id) ON DELETE CASCADE;


--
-- Name: sb_agents__contracthistory fk_sb_agents_contracthistory; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents__contracthistory
    ADD CONSTRAINT fk_sb_agents_contracthistory FOREIGN KEY (sb_agents_id) REFERENCES operation_schemas.sb_agents(id) ON DELETE CASCADE;


--
-- Name: sb_agents__programperiods fk_sb_agents_programperiods; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents__programperiods
    ADD CONSTRAINT fk_sb_agents_programperiods FOREIGN KEY (sb_agents_id) REFERENCES operation_schemas.sb_agents(id) ON DELETE CASCADE;


--
-- Name: sb_agents__programs fk_sb_agents_programs; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_agents__programs
    ADD CONSTRAINT fk_sb_agents_programs FOREIGN KEY (sb_agents_id) REFERENCES operation_schemas.sb_agents(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__addons fk_sb_bookings_addons; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__addons
    ADD CONSTRAINT fk_sb_bookings_addons FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__adjustments fk_sb_bookings_adjustments; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__adjustments
    ADD CONSTRAINT fk_sb_bookings_adjustments FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__feeitems fk_sb_bookings_feeitems; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__feeitems
    ADD CONSTRAINT fk_sb_bookings_feeitems FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__history fk_sb_bookings_history; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__history
    ADD CONSTRAINT fk_sb_bookings_history FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__over fk_sb_bookings_over; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__over
    ADD CONSTRAINT fk_sb_bookings_over FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__partialcancels fk_sb_bookings_partialcancels; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__partialcancels
    ADD CONSTRAINT fk_sb_bookings_partialcancels FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__passengers fk_sb_bookings_passengers; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__passengers
    ADD CONSTRAINT fk_sb_bookings_passengers FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__trips fk_sb_bookings_trips; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__trips
    ADD CONSTRAINT fk_sb_bookings_trips FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_bookings__upgrades fk_sb_bookings_upgrades; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_bookings__upgrades
    ADD CONSTRAINT fk_sb_bookings_upgrades FOREIGN KEY (sb_bookings_id) REFERENCES operation_schemas.sb_bookings(id) ON DELETE CASCADE;


--
-- Name: sb_invoices__bookingids fk_sb_invoices_bookingids; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_invoices__bookingids
    ADD CONSTRAINT fk_sb_invoices_bookingids FOREIGN KEY (sb_invoices_id) REFERENCES operation_schemas.sb_invoices(id) ON DELETE CASCADE;


--
-- Name: sb_invoices__lineitems fk_sb_invoices_lineitems; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_invoices__lineitems
    ADD CONSTRAINT fk_sb_invoices_lineitems FOREIGN KEY (sb_invoices_id) REFERENCES operation_schemas.sb_invoices(id) ON DELETE CASCADE;


--
-- Name: sb_markets__subs fk_sb_markets_subs; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_markets__subs
    ADD CONSTRAINT fk_sb_markets_subs FOREIGN KEY (sb_markets_id) REFERENCES operation_schemas.sb_markets(id) ON DELETE CASCADE;


--
-- Name: sb_pickup_time_profiles__times fk_sb_pickup_time_profiles_times; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_pickup_time_profiles__times
    ADD CONSTRAINT fk_sb_pickup_time_profiles_times FOREIGN KEY (sb_pickup_time_profiles_id) REFERENCES operation_schemas.sb_pickup_time_profiles(id) ON DELETE CASCADE;


--
-- Name: sb_rate_types__addons fk_sb_rate_types_addons; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__addons
    ADD CONSTRAINT fk_sb_rate_types_addons FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE;


--
-- Name: sb_rate_types__charterrates fk_sb_rate_types_charterrates; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__charterrates
    ADD CONSTRAINT fk_sb_rate_types_charterrates FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE;


--
-- Name: sb_rate_types__routebundles fk_sb_rate_types_routebundles; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__routebundles
    ADD CONSTRAINT fk_sb_rate_types_routebundles FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE;


--
-- Name: sb_rate_types__routes fk_sb_rate_types_routes; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__routes
    ADD CONSTRAINT fk_sb_rate_types_routes FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE;


--
-- Name: sb_rate_types__routevalidity fk_sb_rate_types_routevalidity; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__routevalidity
    ADD CONSTRAINT fk_sb_rate_types_routevalidity FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE;


--
-- Name: sb_rate_types__seatrates fk_sb_rate_types_seatrates; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_rate_types__seatrates
    ADD CONSTRAINT fk_sb_rate_types_seatrates FOREIGN KEY (sb_rate_types_id) REFERENCES operation_schemas.sb_rate_types(id) ON DELETE CASCADE;


--
-- Name: sb_seat_locks__log fk_sb_seat_locks_log; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_seat_locks__log
    ADD CONSTRAINT fk_sb_seat_locks_log FOREIGN KEY (sb_seat_locks_id) REFERENCES operation_schemas.sb_seat_locks(id) ON DELETE CASCADE;


--
-- Name: sb_vehicles__log fk_sb_vehicles_log; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles__log
    ADD CONSTRAINT fk_sb_vehicles_log FOREIGN KEY (sb_vehicles_id) REFERENCES operation_schemas.sb_vehicles(id) ON DELETE CASCADE;


--
-- Name: sb_vehicles__statusranges fk_sb_vehicles_statusranges; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles__statusranges
    ADD CONSTRAINT fk_sb_vehicles_statusranges FOREIGN KEY (sb_vehicles_id) REFERENCES operation_schemas.sb_vehicles(id) ON DELETE CASCADE;


--
-- Name: fleet_daily__trips fleet_daily__trips_fleet_daily_id_fkey; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.fleet_daily__trips
    ADD CONSTRAINT fleet_daily__trips_fleet_daily_id_fkey FOREIGN KEY (fleet_daily_id) REFERENCES operation_schemas.fleet_daily(id) ON DELETE CASCADE;


--
-- Name: routes__overrides routes__overrides_routes_id_fkey; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.routes__overrides
    ADD CONSTRAINT routes__overrides_routes_id_fkey FOREIGN KEY (routes_id) REFERENCES operation_schemas.routes(id) ON DELETE CASCADE;


--
-- Name: sb_vehicles__dayroute sb_vehicles__dayroute_sb_vehicles_id_fkey; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles__dayroute
    ADD CONSTRAINT sb_vehicles__dayroute_sb_vehicles_id_fkey FOREIGN KEY (sb_vehicles_id) REFERENCES operation_schemas.sb_vehicles(id) ON DELETE CASCADE;


--
-- Name: sb_vehicles__daystatus sb_vehicles__daystatus_sb_vehicles_id_fkey; Type: FK CONSTRAINT; Schema: operation_schemas; Owner: -
--

ALTER TABLE ONLY operation_schemas.sb_vehicles__daystatus
    ADD CONSTRAINT sb_vehicles__daystatus_sb_vehicles_id_fkey FOREIGN KEY (sb_vehicles_id) REFERENCES operation_schemas.sb_vehicles(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ceZlpJj5d5C1EVeJznp3PnVhxt7a0cYubcUZkVgNJHRjgRlcabdahHFupF6xzbH

