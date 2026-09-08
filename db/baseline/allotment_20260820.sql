--
-- PostgreSQL database dump
--

\restrict XqBxB7tF6b7xGeeqQPOTAfH3Oy5StJ6gff5DYymSbN9XAPXnIh8ieUvYnAJO3Qj

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
-- Name: allotment; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA allotment;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_state; Type: TABLE; Schema: allotment; Owner: -
--

CREATE TABLE allotment.app_state (
    id text NOT NULL,
    data text,
    version integer DEFAULT 0,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: attachments; Type: TABLE; Schema: allotment; Owner: -
--

CREATE TABLE allotment.attachments (
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
-- Name: schema_migrations; Type: TABLE; Schema: allotment; Owner: -
--

CREATE TABLE allotment.schema_migrations (
    name text NOT NULL,
    sha1 text,
    applied_at timestamp with time zone DEFAULT now(),
    baseline boolean DEFAULT false,
    ms integer,
    err text
);


--
-- Name: users; Type: TABLE; Schema: allotment; Owner: -
--

CREATE TABLE allotment.users (
    id integer,
    username text,
    pass_hash text,
    name text,
    role text,
    created_at timestamp with time zone,
    perms text,
    can_edit boolean,
    edit_areas text
);


--
-- Name: app_state app_state_pkey; Type: CONSTRAINT; Schema: allotment; Owner: -
--

ALTER TABLE ONLY allotment.app_state
    ADD CONSTRAINT app_state_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: allotment; Owner: -
--

ALTER TABLE ONLY allotment.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: allotment; Owner: -
--

ALTER TABLE ONLY allotment.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: idx_attach_booking; Type: INDEX; Schema: allotment; Owner: -
--

CREATE INDEX idx_attach_booking ON allotment.attachments USING btree (booking_id);


--
-- PostgreSQL database dump complete
--

\unrestrict XqBxB7tF6b7xGeeqQPOTAfH3Oy5StJ6gff5DYymSbN9XAPXnIh8ieUvYnAJO3Qj

