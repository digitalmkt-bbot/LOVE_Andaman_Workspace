--
-- PostgreSQL database dump
--

\restrict ullUCdxSQl65B5MTTVIePgSCLDDIYgYuEFCdLjCZdXzkh0rHYWN7uo9BOrOIyJL

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: notify_booking_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_booking_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM pg_notify('booking_changed', NEW.id);
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_state (
    id text NOT NULL,
    data text,
    version integer DEFAULT 0,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
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
-- Name: meal_venues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_venues (
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
-- Name: pier_kinds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pier_kinds (
    id text NOT NULL,
    name text,
    unit text,
    color text,
    ord bigint,
    active boolean,
    name_en text
);


--
-- Name: pier_sect; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pier_sect (
    id text NOT NULL,
    pier text,
    name text,
    ord bigint
);


--
-- Name: report_agent_sales_7m_2026; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_agent_sales_7m_2026 (
    id bigint NOT NULL,
    sheet_row integer,
    agent_id text,
    agent_code text,
    agent_name text,
    source_name text,
    sheet_market text,
    agent_market text,
    program text,
    amount_7m numeric(14,2),
    match_status text,
    period_start date DEFAULT '2026-01-01'::date,
    period_end date DEFAULT '2026-07-31'::date
);


--
-- Name: report_agent_sales_7m_2026_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_agent_sales_7m_2026_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_agent_sales_7m_2026_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_agent_sales_7m_2026_id_seq OWNED BY public.report_agent_sales_7m_2026.id;


--
-- Name: trip_actuals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_actuals (
    id text NOT NULL,
    key text,
    value text
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    pass_hash text NOT NULL,
    name text,
    role text DEFAULT 'staff'::text,
    created_at timestamp with time zone DEFAULT now(),
    perms text,
    can_edit boolean DEFAULT true,
    edit_areas text,
    logout_after bigint
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: report_agent_sales_7m_2026 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_agent_sales_7m_2026 ALTER COLUMN id SET DEFAULT nextval('public.report_agent_sales_7m_2026_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: app_state app_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_state
    ADD CONSTRAINT app_state_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: meal_venues meal_venues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_venues
    ADD CONSTRAINT meal_venues_pkey PRIMARY KEY (id);


--
-- Name: pier_kinds pier_kinds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pier_kinds
    ADD CONSTRAINT pier_kinds_pkey PRIMARY KEY (id);


--
-- Name: pier_sect pier_sect_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pier_sect
    ADD CONSTRAINT pier_sect_pkey PRIMARY KEY (id);


--
-- Name: report_agent_sales_7m_2026 report_agent_sales_7m_2026_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_agent_sales_7m_2026
    ADD CONSTRAINT report_agent_sales_7m_2026_pkey PRIMARY KEY (id);


--
-- Name: trip_actuals trip_actuals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_actuals
    ADD CONSTRAINT trip_actuals_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_attach_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attach_booking ON public.attachments USING btree (booking_id);


--
-- Name: report_agent_sales_7m_2026_agent_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX report_agent_sales_7m_2026_agent_code_idx ON public.report_agent_sales_7m_2026 USING btree (agent_code);


--
-- Name: report_agent_sales_7m_2026_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX report_agent_sales_7m_2026_agent_id_idx ON public.report_agent_sales_7m_2026 USING btree (agent_id);


--
-- Name: report_agent_sales_7m_2026_program_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX report_agent_sales_7m_2026_program_idx ON public.report_agent_sales_7m_2026 USING btree (program);


--
-- Name: report_agent_sales_7m_2026_sheet_market_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX report_agent_sales_7m_2026_sheet_market_idx ON public.report_agent_sales_7m_2026 USING btree (sheet_market);


--
-- PostgreSQL database dump complete
--

\unrestrict ullUCdxSQl65B5MTTVIePgSCLDDIYgYuEFCdLjCZdXzkh0rHYWN7uo9BOrOIyJL

