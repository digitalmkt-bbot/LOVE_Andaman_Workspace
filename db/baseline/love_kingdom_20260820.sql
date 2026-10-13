--
-- PostgreSQL database dump
--

\restrict Zu99KuBTVcApNXsjacpVgvZRKCHZtNl1uEmqupdibdGu4w4quoPQmku5BKhsXLY

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
-- Name: love_kingdom; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA love_kingdom;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addon_variants; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.addon_variants (
    id text NOT NULL,
    name text NOT NULL,
    unit text NOT NULL
);


--
-- Name: b2c_channels; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.b2c_channels (
    id text NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    ops_agent_code text
);


--
-- Name: bed_types; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.bed_types (
    id text NOT NULL,
    name text NOT NULL
);


--
-- Name: booking_item_rooms; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.booking_item_rooms (
    id bigint NOT NULL,
    item_id bigint NOT NULL,
    room_type_id text,
    bed_type text,
    pax_adult integer DEFAULT 0 NOT NULL,
    pax_child integer DEFAULT 0 NOT NULL,
    pax_infant integer DEFAULT 0 NOT NULL,
    per_night_price numeric(12,2),
    per_night_net numeric(12,2),
    breakfast_included boolean,
    used_season text,
    special_request text,
    extras_selected jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: booking_item_rooms_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.booking_item_rooms ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.booking_item_rooms_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: booking_items; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.booking_items (
    id bigint NOT NULL,
    booking_id text NOT NULL,
    line_no integer NOT NULL,
    type text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    product_id text,
    variant_id text,
    route_id text,
    slot_id text,
    boat_name text,
    travel_date date,
    check_in date,
    check_out date,
    qty integer,
    pax_adult integer DEFAULT 0 NOT NULL,
    pax_child integer DEFAULT 0 NOT NULL,
    pax_infant integer DEFAULT 0 NOT NULL,
    pax_foc integer DEFAULT 0 NOT NULL,
    pax_thai integer DEFAULT 0 NOT NULL,
    pax_foreign integer DEFAULT 0 NOT NULL,
    promo_id text,
    promo_applied boolean DEFAULT false NOT NULL,
    used_season text,
    special_request text,
    remark text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_open_date boolean DEFAULT false NOT NULL,
    valid_until date,
    activated_at timestamp with time zone,
    activated_by text,
    cancellations jsonb DEFAULT '[]'::jsonb NOT NULL,
    item_uid text NOT NULL
);


--
-- Name: booking_items_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.booking_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.booking_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bookings; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.bookings (
    id text NOT NULL,
    customer_id text,
    channel_id text,
    channel_name text,
    travel_date date,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_name text,
    discount_note text,
    discount_reason text,
    surcharge_amount numeric(12,2) DEFAULT 0 NOT NULL,
    surcharge_name text,
    surcharge_note text,
    surcharge_reason text,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    deposit numeric(12,2) DEFAULT 0 NOT NULL,
    balance numeric(12,2) DEFAULT 0 NOT NULL,
    payment_method_id text,
    payment_method_name text,
    slip_url text,
    remark text,
    status text DEFAULT 'confirmed'::text NOT NULL,
    net_promo_codes text[] DEFAULT '{}'::text[] NOT NULL,
    passengers jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booked_by_email text,
    booked_by_name text,
    cancelled_at timestamp with time zone,
    cancelled_by text,
    cancellation_reason text,
    cancellation_fee numeric(12,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(12,2) DEFAULT 0 NOT NULL,
    credits_applied jsonb DEFAULT '[]'::jsonb NOT NULL,
    payments jsonb DEFAULT '[]'::jsonb NOT NULL,
    refunds jsonb DEFAULT '[]'::jsonb NOT NULL,
    edit_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    payment_type text,
    ops_agent_code text,
    guide_language text,
    guide_languages text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: credit_applications; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.credit_applications (
    id bigint NOT NULL,
    credit_note_id text NOT NULL,
    booking_id text NOT NULL,
    amount numeric(12,2) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_by text
);


--
-- Name: credit_applications_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.credit_applications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.credit_applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: credit_notes; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.credit_notes (
    id text NOT NULL,
    source_booking_id text NOT NULL,
    source_item_line integer,
    amount numeric(12,2) NOT NULL,
    remaining numeric(12,2) NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    valid_until date,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    issued_by text,
    reason text,
    notes text
);


--
-- Name: customers; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.customers (
    id text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    nationality text,
    social_media text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hotel_extras; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.hotel_extras (
    id bigint NOT NULL,
    hotel_id text NOT NULL,
    extra_id text NOT NULL,
    name text NOT NULL,
    pricing_model text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    description text
);


--
-- Name: hotel_extras_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.hotel_extras ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.hotel_extras_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hotel_room_types; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.hotel_room_types (
    id bigint NOT NULL,
    hotel_id text NOT NULL,
    room_id text NOT NULL,
    name text NOT NULL,
    price_per_night numeric(12,2),
    max_occupancy integer,
    net_rate numeric(12,2),
    selling_rate numeric(12,2),
    description text
);


--
-- Name: hotel_room_types_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.hotel_room_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.hotel_room_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hotels; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.hotels (
    id text NOT NULL,
    name text NOT NULL,
    location text,
    rsvn_email text,
    rsvn_phone text,
    contact_person text,
    rsvn_line_id text,
    address text,
    province text,
    rsvn_cc text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: partner_boats; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.partner_boats (
    id bigint NOT NULL,
    partner_id text NOT NULL,
    boat_id text NOT NULL,
    name text NOT NULL,
    class_id text,
    boat_type text,
    description text
);


--
-- Name: partner_boats_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.partner_boats ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.partner_boats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: partner_classes; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.partner_classes (
    id bigint NOT NULL,
    partner_id text NOT NULL,
    class_id text NOT NULL,
    name text NOT NULL,
    max_pax integer,
    description text
);


--
-- Name: partner_classes_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.partner_classes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.partner_classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: partner_pricing; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.partner_pricing (
    id bigint NOT NULL,
    partner_id text NOT NULL,
    class_id text NOT NULL,
    route_id text NOT NULL,
    slot_id text NOT NULL,
    base_pax integer,
    base_price numeric(12,2),
    extra_per_pax numeric(12,2),
    available boolean DEFAULT true NOT NULL
);


--
-- Name: partner_pricing_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.partner_pricing ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.partner_pricing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: partner_routes; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.partner_routes (
    id bigint NOT NULL,
    partner_id text NOT NULL,
    route_id text NOT NULL,
    name text NOT NULL,
    description text
);


--
-- Name: partner_routes_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.partner_routes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.partner_routes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: partner_time_slots; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.partner_time_slots (
    id bigint NOT NULL,
    partner_id text NOT NULL,
    slot_id text NOT NULL,
    name text NOT NULL,
    start_time text,
    end_time text,
    duration text
);


--
-- Name: partner_time_slots_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.partner_time_slots ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.partner_time_slots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payment_methods; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.payment_methods (
    id text NOT NULL,
    name text NOT NULL
);


--
-- Name: pricing_b2c; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.pricing_b2c (
    program_id text NOT NULL,
    rack_adult numeric(12,2),
    rack_child numeric(12,2),
    thai_adult numeric(12,2),
    thai_child numeric(12,2)
);


--
-- Name: private_boats; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.private_boats (
    id text NOT NULL,
    name text NOT NULL,
    boat_type text,
    engine_config text,
    max_pax integer,
    description text
);


--
-- Name: private_own_pricing; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.private_own_pricing (
    boat_id text NOT NULL,
    route_id text NOT NULL,
    base_pax integer,
    base_price numeric(12,2),
    extra_per_pax numeric(12,2),
    available boolean DEFAULT true NOT NULL
);


--
-- Name: private_partners; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.private_partners (
    id text NOT NULL,
    name text NOT NULL,
    partner_company text,
    contact_person text,
    rsvn_email text,
    rsvn_phone text,
    rsvn_line_id text,
    description text
);


--
-- Name: private_routes; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.private_routes (
    id text NOT NULL,
    name text NOT NULL,
    duration text,
    description text
);


--
-- Name: program_own_addons; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.program_own_addons (
    id bigint NOT NULL,
    program_id text NOT NULL,
    addon_id text NOT NULL,
    name text NOT NULL,
    variant_id text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    code text
);


--
-- Name: program_own_addons_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.program_own_addons ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.program_own_addons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: program_third_variants; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.program_third_variants (
    id bigint NOT NULL,
    program_id text NOT NULL,
    variant_id text NOT NULL,
    name text NOT NULL,
    cost_price numeric(12,2),
    selling_price numeric(12,2),
    description text
);


--
-- Name: program_third_variants_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.program_third_variants ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.program_third_variants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: programs_own; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.programs_own (
    id text NOT NULL,
    name text NOT NULL,
    route text,
    duration text,
    port text,
    has_park_fee boolean DEFAULT false NOT NULL,
    inventory_managed boolean DEFAULT false NOT NULL,
    description text,
    ops_route_id text
);


--
-- Name: programs_third; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.programs_third (
    id text NOT NULL,
    name text NOT NULL,
    partner_name text,
    cost_price numeric(12,2),
    selling_price numeric(12,2),
    rsvn_email text,
    rsvn_phone text,
    pricing_unit text,
    description text
);


--
-- Name: promo_daytrip_seasons; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.promo_daytrip_seasons (
    id bigint NOT NULL,
    promotion_id text NOT NULL,
    program_id text NOT NULL,
    label text,
    travel_from date,
    travel_to date,
    adult numeric(12,2) DEFAULT 0,
    child numeric(12,2) DEFAULT 0,
    infant numeric(12,2) DEFAULT 0,
    foc numeric(12,2) DEFAULT 0
);


--
-- Name: promo_daytrip_seasons_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.promo_daytrip_seasons ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.promo_daytrip_seasons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: promo_hotel_extras_seasons; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.promo_hotel_extras_seasons (
    id bigint NOT NULL,
    promotion_id text NOT NULL,
    hotel_id text NOT NULL,
    extra_id text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    season_index integer DEFAULT 0 NOT NULL,
    label text,
    travel_from date,
    travel_to date,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    net_rate numeric(12,2) DEFAULT 0 NOT NULL
);


--
-- Name: promo_hotel_extras_seasons_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.promo_hotel_extras_seasons ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.promo_hotel_extras_seasons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: promo_hotel_seasons; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.promo_hotel_seasons (
    id bigint NOT NULL,
    promotion_id text NOT NULL,
    hotel_id text NOT NULL,
    room_type_id text NOT NULL,
    net_promo_code text,
    active boolean DEFAULT true NOT NULL,
    label text,
    travel_from date,
    travel_to date,
    net_rate numeric(12,2),
    selling_rate numeric(12,2),
    breakfast_included boolean,
    fulfillment_mode text DEFAULT 'contract'::text,
    pool_id text,
    use_code boolean DEFAULT false,
    topup_amount numeric(12,2) DEFAULT 0,
    booking_from date,
    booking_to date
);


--
-- Name: promo_hotel_seasons_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.promo_hotel_seasons ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.promo_hotel_seasons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: promo_thirdparty_seasons; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.promo_thirdparty_seasons (
    id bigint NOT NULL,
    promotion_id text NOT NULL,
    program_id text NOT NULL,
    variant_id text NOT NULL,
    net_promo_code text,
    active boolean DEFAULT true NOT NULL,
    label text,
    travel_from date,
    travel_to date,
    adult numeric(12,2) DEFAULT 0,
    child numeric(12,2) DEFAULT 0,
    infant numeric(12,2) DEFAULT 0,
    foc numeric(12,2) DEFAULT 0,
    adult_net numeric(12,2) DEFAULT 0,
    child_net numeric(12,2) DEFAULT 0,
    fulfillment_mode text DEFAULT 'contract'::text,
    pool_id text,
    use_code boolean DEFAULT false,
    topup_amount numeric(12,2) DEFAULT 0
);


--
-- Name: promo_thirdparty_seasons_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.promo_thirdparty_seasons ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.promo_thirdparty_seasons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: promotions; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.promotions (
    id text NOT NULL,
    name text NOT NULL,
    code text,
    discount_type text,
    discount numeric(12,2),
    base_rate text,
    net_promo_code text,
    valid_from date,
    valid_to date,
    booking_from date,
    booking_to date,
    active boolean DEFAULT true NOT NULL,
    hotel_items_meta jsonb DEFAULT '[]'::jsonb NOT NULL,
    third_party_items_meta jsonb DEFAULT '[]'::jsonb NOT NULL,
    day_trip_items_meta jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.users (
    email text NOT NULL,
    pass_hash text NOT NULL,
    role text DEFAULT 'sales'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: van_types; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.van_types (
    id text NOT NULL,
    name text NOT NULL,
    pricing_model text,
    description text
);


--
-- Name: voucher_codes; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.voucher_codes (
    id bigint NOT NULL,
    pool_id text NOT NULL,
    code text NOT NULL,
    number integer NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    ever_used boolean DEFAULT false NOT NULL,
    assigned_booking_id text,
    assigned_item_id bigint,
    assigned_night integer,
    assigned_at timestamp with time zone,
    assigned_by text,
    return_requested_at timestamp with time zone,
    return_requested_by text,
    return_approved_at timestamp with time zone,
    return_approved_by text,
    notes text
);


--
-- Name: voucher_codes_id_seq; Type: SEQUENCE; Schema: love_kingdom; Owner: -
--

ALTER TABLE love_kingdom.voucher_codes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME love_kingdom.voucher_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: voucher_pool_activities; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.voucher_pool_activities (
    pool_id text NOT NULL,
    program_id text NOT NULL,
    variant_id text NOT NULL
);


--
-- Name: voucher_pool_hotels; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.voucher_pool_hotels (
    pool_id text NOT NULL,
    hotel_id text NOT NULL
);


--
-- Name: voucher_pools; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.voucher_pools (
    id text NOT NULL,
    name text NOT NULL,
    prefix text NOT NULL,
    start_number integer DEFAULT 1 NOT NULL,
    batch_size integer NOT NULL,
    purchase_cost numeric(12,2),
    cost_per_code numeric(12,2),
    purchase_date date,
    expiry_date date,
    notes text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vouchers; Type: TABLE; Schema: love_kingdom; Owner: -
--

CREATE TABLE love_kingdom.vouchers (
    id text NOT NULL,
    booking_id text NOT NULL,
    customer_name text,
    channel text,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: addon_variants addon_variants_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.addon_variants
    ADD CONSTRAINT addon_variants_pkey PRIMARY KEY (id);


--
-- Name: b2c_channels b2c_channels_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.b2c_channels
    ADD CONSTRAINT b2c_channels_pkey PRIMARY KEY (id);


--
-- Name: bed_types bed_types_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.bed_types
    ADD CONSTRAINT bed_types_pkey PRIMARY KEY (id);


--
-- Name: booking_item_rooms booking_item_rooms_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.booking_item_rooms
    ADD CONSTRAINT booking_item_rooms_pkey PRIMARY KEY (id);


--
-- Name: booking_items booking_items_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.booking_items
    ADD CONSTRAINT booking_items_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: credit_applications credit_applications_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.credit_applications
    ADD CONSTRAINT credit_applications_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: hotel_extras hotel_extras_hotel_id_extra_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.hotel_extras
    ADD CONSTRAINT hotel_extras_hotel_id_extra_id_key UNIQUE (hotel_id, extra_id);


--
-- Name: hotel_extras hotel_extras_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.hotel_extras
    ADD CONSTRAINT hotel_extras_pkey PRIMARY KEY (id);


--
-- Name: hotel_room_types hotel_room_types_hotel_id_room_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.hotel_room_types
    ADD CONSTRAINT hotel_room_types_hotel_id_room_id_key UNIQUE (hotel_id, room_id);


--
-- Name: hotel_room_types hotel_room_types_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.hotel_room_types
    ADD CONSTRAINT hotel_room_types_pkey PRIMARY KEY (id);


--
-- Name: hotels hotels_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.hotels
    ADD CONSTRAINT hotels_pkey PRIMARY KEY (id);


--
-- Name: partner_boats partner_boats_partner_id_boat_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_boats
    ADD CONSTRAINT partner_boats_partner_id_boat_id_key UNIQUE (partner_id, boat_id);


--
-- Name: partner_boats partner_boats_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_boats
    ADD CONSTRAINT partner_boats_pkey PRIMARY KEY (id);


--
-- Name: partner_classes partner_classes_partner_id_class_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_classes
    ADD CONSTRAINT partner_classes_partner_id_class_id_key UNIQUE (partner_id, class_id);


--
-- Name: partner_classes partner_classes_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_classes
    ADD CONSTRAINT partner_classes_pkey PRIMARY KEY (id);


--
-- Name: partner_pricing partner_pricing_partner_id_class_id_route_id_slot_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_pricing
    ADD CONSTRAINT partner_pricing_partner_id_class_id_route_id_slot_id_key UNIQUE (partner_id, class_id, route_id, slot_id);


--
-- Name: partner_pricing partner_pricing_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_pricing
    ADD CONSTRAINT partner_pricing_pkey PRIMARY KEY (id);


--
-- Name: partner_routes partner_routes_partner_id_route_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_routes
    ADD CONSTRAINT partner_routes_partner_id_route_id_key UNIQUE (partner_id, route_id);


--
-- Name: partner_routes partner_routes_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_routes
    ADD CONSTRAINT partner_routes_pkey PRIMARY KEY (id);


--
-- Name: partner_time_slots partner_time_slots_partner_id_slot_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_time_slots
    ADD CONSTRAINT partner_time_slots_partner_id_slot_id_key UNIQUE (partner_id, slot_id);


--
-- Name: partner_time_slots partner_time_slots_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_time_slots
    ADD CONSTRAINT partner_time_slots_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: pricing_b2c pricing_b2c_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.pricing_b2c
    ADD CONSTRAINT pricing_b2c_pkey PRIMARY KEY (program_id);


--
-- Name: private_boats private_boats_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.private_boats
    ADD CONSTRAINT private_boats_pkey PRIMARY KEY (id);


--
-- Name: private_own_pricing private_own_pricing_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.private_own_pricing
    ADD CONSTRAINT private_own_pricing_pkey PRIMARY KEY (boat_id, route_id);


--
-- Name: private_partners private_partners_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.private_partners
    ADD CONSTRAINT private_partners_pkey PRIMARY KEY (id);


--
-- Name: private_routes private_routes_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.private_routes
    ADD CONSTRAINT private_routes_pkey PRIMARY KEY (id);


--
-- Name: program_own_addons program_own_addons_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.program_own_addons
    ADD CONSTRAINT program_own_addons_pkey PRIMARY KEY (id);


--
-- Name: program_own_addons program_own_addons_program_id_addon_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.program_own_addons
    ADD CONSTRAINT program_own_addons_program_id_addon_id_key UNIQUE (program_id, addon_id);


--
-- Name: program_third_variants program_third_variants_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.program_third_variants
    ADD CONSTRAINT program_third_variants_pkey PRIMARY KEY (id);


--
-- Name: program_third_variants program_third_variants_program_id_variant_id_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.program_third_variants
    ADD CONSTRAINT program_third_variants_program_id_variant_id_key UNIQUE (program_id, variant_id);


--
-- Name: programs_own programs_own_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.programs_own
    ADD CONSTRAINT programs_own_pkey PRIMARY KEY (id);


--
-- Name: programs_third programs_third_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.programs_third
    ADD CONSTRAINT programs_third_pkey PRIMARY KEY (id);


--
-- Name: promo_daytrip_seasons promo_daytrip_seasons_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_daytrip_seasons
    ADD CONSTRAINT promo_daytrip_seasons_pkey PRIMARY KEY (id);


--
-- Name: promo_hotel_extras_seasons promo_hotel_extras_seasons_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_hotel_extras_seasons
    ADD CONSTRAINT promo_hotel_extras_seasons_pkey PRIMARY KEY (id);


--
-- Name: promo_hotel_seasons promo_hotel_seasons_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_hotel_seasons
    ADD CONSTRAINT promo_hotel_seasons_pkey PRIMARY KEY (id);


--
-- Name: promo_thirdparty_seasons promo_thirdparty_seasons_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_thirdparty_seasons
    ADD CONSTRAINT promo_thirdparty_seasons_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (email);


--
-- Name: van_types van_types_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.van_types
    ADD CONSTRAINT van_types_pkey PRIMARY KEY (id);


--
-- Name: voucher_codes voucher_codes_code_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_codes
    ADD CONSTRAINT voucher_codes_code_key UNIQUE (code);


--
-- Name: voucher_codes voucher_codes_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_codes
    ADD CONSTRAINT voucher_codes_pkey PRIMARY KEY (id);


--
-- Name: voucher_codes voucher_codes_pool_id_number_key; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_codes
    ADD CONSTRAINT voucher_codes_pool_id_number_key UNIQUE (pool_id, number);


--
-- Name: voucher_pool_activities voucher_pool_activities_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_pool_activities
    ADD CONSTRAINT voucher_pool_activities_pkey PRIMARY KEY (pool_id, program_id, variant_id);


--
-- Name: voucher_pool_hotels voucher_pool_hotels_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_pool_hotels
    ADD CONSTRAINT voucher_pool_hotels_pkey PRIMARY KEY (pool_id, hotel_id);


--
-- Name: voucher_pools voucher_pools_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_pools
    ADD CONSTRAINT voucher_pools_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: booking_item_rooms_item_id_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX booking_item_rooms_item_id_idx ON love_kingdom.booking_item_rooms USING btree (item_id);


--
-- Name: booking_items_booking_id_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX booking_items_booking_id_idx ON love_kingdom.booking_items USING btree (booking_id);


--
-- Name: booking_items_booking_item_uid_uq; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE UNIQUE INDEX booking_items_booking_item_uid_uq ON love_kingdom.booking_items USING btree (booking_id, item_uid);


--
-- Name: booking_items_booking_line_no_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX booking_items_booking_line_no_idx ON love_kingdom.booking_items USING btree (booking_id, line_no);


--
-- Name: booking_items_product_id_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX booking_items_product_id_idx ON love_kingdom.booking_items USING btree (product_id);


--
-- Name: booking_items_type_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX booking_items_type_idx ON love_kingdom.booking_items USING btree (type);


--
-- Name: bookings_customer_id_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX bookings_customer_id_idx ON love_kingdom.bookings USING btree (customer_id);


--
-- Name: bookings_ops_agent_code_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX bookings_ops_agent_code_idx ON love_kingdom.bookings USING btree (ops_agent_code);


--
-- Name: bookings_status_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX bookings_status_idx ON love_kingdom.bookings USING btree (status);


--
-- Name: bookings_travel_date_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX bookings_travel_date_idx ON love_kingdom.bookings USING btree (travel_date);


--
-- Name: credit_applications_booking_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX credit_applications_booking_idx ON love_kingdom.credit_applications USING btree (booking_id);


--
-- Name: credit_applications_credit_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX credit_applications_credit_idx ON love_kingdom.credit_applications USING btree (credit_note_id);


--
-- Name: credit_notes_source_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX credit_notes_source_idx ON love_kingdom.credit_notes USING btree (source_booking_id);


--
-- Name: credit_notes_status_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX credit_notes_status_idx ON love_kingdom.credit_notes USING btree (status);


--
-- Name: program_own_addons_code_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX program_own_addons_code_idx ON love_kingdom.program_own_addons USING btree (code);


--
-- Name: promo_hotel_extras_seasons_hotel_extra_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX promo_hotel_extras_seasons_hotel_extra_idx ON love_kingdom.promo_hotel_extras_seasons USING btree (hotel_id, extra_id);


--
-- Name: promo_hotel_extras_seasons_promo_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX promo_hotel_extras_seasons_promo_idx ON love_kingdom.promo_hotel_extras_seasons USING btree (promotion_id);


--
-- Name: voucher_codes_booking_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX voucher_codes_booking_idx ON love_kingdom.voucher_codes USING btree (assigned_booking_id) WHERE (assigned_booking_id IS NOT NULL);


--
-- Name: voucher_codes_pool_status_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX voucher_codes_pool_status_idx ON love_kingdom.voucher_codes USING btree (pool_id, status);


--
-- Name: vouchers_booking_id_idx; Type: INDEX; Schema: love_kingdom; Owner: -
--

CREATE INDEX vouchers_booking_id_idx ON love_kingdom.vouchers USING btree (booking_id);


--
-- Name: booking_item_rooms booking_item_rooms_item_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.booking_item_rooms
    ADD CONSTRAINT booking_item_rooms_item_id_fkey FOREIGN KEY (item_id) REFERENCES love_kingdom.booking_items(id) ON DELETE CASCADE;


--
-- Name: booking_items booking_items_booking_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.booking_items
    ADD CONSTRAINT booking_items_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_items booking_items_promo_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.booking_items
    ADD CONSTRAINT booking_items_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES love_kingdom.promotions(id);


--
-- Name: bookings bookings_channel_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.bookings
    ADD CONSTRAINT bookings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES love_kingdom.b2c_channels(id);


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES love_kingdom.customers(id);


--
-- Name: bookings bookings_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.bookings
    ADD CONSTRAINT bookings_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES love_kingdom.payment_methods(id);


--
-- Name: credit_applications credit_applications_booking_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.credit_applications
    ADD CONSTRAINT credit_applications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE CASCADE;


--
-- Name: credit_applications credit_applications_credit_note_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.credit_applications
    ADD CONSTRAINT credit_applications_credit_note_id_fkey FOREIGN KEY (credit_note_id) REFERENCES love_kingdom.credit_notes(id) ON DELETE CASCADE;


--
-- Name: credit_notes credit_notes_source_booking_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.credit_notes
    ADD CONSTRAINT credit_notes_source_booking_id_fkey FOREIGN KEY (source_booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE CASCADE;


--
-- Name: hotel_extras hotel_extras_hotel_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.hotel_extras
    ADD CONSTRAINT hotel_extras_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id) ON DELETE CASCADE;


--
-- Name: hotel_room_types hotel_room_types_hotel_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.hotel_room_types
    ADD CONSTRAINT hotel_room_types_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id) ON DELETE CASCADE;


--
-- Name: partner_boats partner_boats_partner_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_boats
    ADD CONSTRAINT partner_boats_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE;


--
-- Name: partner_classes partner_classes_partner_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_classes
    ADD CONSTRAINT partner_classes_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE;


--
-- Name: partner_pricing partner_pricing_partner_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_pricing
    ADD CONSTRAINT partner_pricing_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE;


--
-- Name: partner_routes partner_routes_partner_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_routes
    ADD CONSTRAINT partner_routes_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE;


--
-- Name: partner_time_slots partner_time_slots_partner_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.partner_time_slots
    ADD CONSTRAINT partner_time_slots_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES love_kingdom.private_partners(id) ON DELETE CASCADE;


--
-- Name: pricing_b2c pricing_b2c_program_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.pricing_b2c
    ADD CONSTRAINT pricing_b2c_program_id_fkey FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_own(id) ON DELETE CASCADE;


--
-- Name: private_own_pricing private_own_pricing_boat_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.private_own_pricing
    ADD CONSTRAINT private_own_pricing_boat_id_fkey FOREIGN KEY (boat_id) REFERENCES love_kingdom.private_boats(id) ON DELETE CASCADE;


--
-- Name: private_own_pricing private_own_pricing_route_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.private_own_pricing
    ADD CONSTRAINT private_own_pricing_route_id_fkey FOREIGN KEY (route_id) REFERENCES love_kingdom.private_routes(id) ON DELETE CASCADE;


--
-- Name: program_own_addons program_own_addons_program_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.program_own_addons
    ADD CONSTRAINT program_own_addons_program_id_fkey FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_own(id) ON DELETE CASCADE;


--
-- Name: program_own_addons program_own_addons_variant_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.program_own_addons
    ADD CONSTRAINT program_own_addons_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES love_kingdom.addon_variants(id);


--
-- Name: program_third_variants program_third_variants_program_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.program_third_variants
    ADD CONSTRAINT program_third_variants_program_id_fkey FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_third(id) ON DELETE CASCADE;


--
-- Name: promo_daytrip_seasons promo_daytrip_seasons_program_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_daytrip_seasons
    ADD CONSTRAINT promo_daytrip_seasons_program_id_fkey FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_own(id);


--
-- Name: promo_daytrip_seasons promo_daytrip_seasons_promotion_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_daytrip_seasons
    ADD CONSTRAINT promo_daytrip_seasons_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES love_kingdom.promotions(id) ON DELETE CASCADE;


--
-- Name: promo_hotel_extras_seasons promo_hotel_extras_seasons_hotel_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_hotel_extras_seasons
    ADD CONSTRAINT promo_hotel_extras_seasons_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id);


--
-- Name: promo_hotel_extras_seasons promo_hotel_extras_seasons_promotion_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_hotel_extras_seasons
    ADD CONSTRAINT promo_hotel_extras_seasons_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES love_kingdom.promotions(id) ON DELETE CASCADE;


--
-- Name: promo_hotel_seasons promo_hotel_seasons_hotel_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_hotel_seasons
    ADD CONSTRAINT promo_hotel_seasons_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id);


--
-- Name: promo_hotel_seasons promo_hotel_seasons_pool_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_hotel_seasons
    ADD CONSTRAINT promo_hotel_seasons_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE SET NULL;


--
-- Name: promo_hotel_seasons promo_hotel_seasons_promotion_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_hotel_seasons
    ADD CONSTRAINT promo_hotel_seasons_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES love_kingdom.promotions(id) ON DELETE CASCADE;


--
-- Name: promo_thirdparty_seasons promo_thirdparty_seasons_pool_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_thirdparty_seasons
    ADD CONSTRAINT promo_thirdparty_seasons_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE SET NULL;


--
-- Name: promo_thirdparty_seasons promo_thirdparty_seasons_program_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_thirdparty_seasons
    ADD CONSTRAINT promo_thirdparty_seasons_program_id_fkey FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_third(id);


--
-- Name: promo_thirdparty_seasons promo_thirdparty_seasons_promotion_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.promo_thirdparty_seasons
    ADD CONSTRAINT promo_thirdparty_seasons_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES love_kingdom.promotions(id) ON DELETE CASCADE;


--
-- Name: voucher_codes voucher_codes_assigned_booking_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_codes
    ADD CONSTRAINT voucher_codes_assigned_booking_id_fkey FOREIGN KEY (assigned_booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE SET NULL;


--
-- Name: voucher_codes voucher_codes_pool_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_codes
    ADD CONSTRAINT voucher_codes_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE CASCADE;


--
-- Name: voucher_pool_activities voucher_pool_activities_pool_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_pool_activities
    ADD CONSTRAINT voucher_pool_activities_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE CASCADE;


--
-- Name: voucher_pool_activities voucher_pool_activities_program_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_pool_activities
    ADD CONSTRAINT voucher_pool_activities_program_id_fkey FOREIGN KEY (program_id) REFERENCES love_kingdom.programs_third(id) ON DELETE CASCADE;


--
-- Name: voucher_pool_hotels voucher_pool_hotels_hotel_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_pool_hotels
    ADD CONSTRAINT voucher_pool_hotels_hotel_id_fkey FOREIGN KEY (hotel_id) REFERENCES love_kingdom.hotels(id) ON DELETE CASCADE;


--
-- Name: voucher_pool_hotels voucher_pool_hotels_pool_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.voucher_pool_hotels
    ADD CONSTRAINT voucher_pool_hotels_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES love_kingdom.voucher_pools(id) ON DELETE CASCADE;


--
-- Name: vouchers vouchers_booking_id_fkey; Type: FK CONSTRAINT; Schema: love_kingdom; Owner: -
--

ALTER TABLE ONLY love_kingdom.vouchers
    ADD CONSTRAINT vouchers_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES love_kingdom.bookings(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Zu99KuBTVcApNXsjacpVgvZRKCHZtNl1uEmqupdibdGu4w4quoPQmku5BKhsXLY

