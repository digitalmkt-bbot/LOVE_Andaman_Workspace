-- 0005_booking-lifecycle
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file.
--
-- BK-01 · everything that happens to a booking after it exists: the audit
-- trail, approvals, cancellation, partial cancellation, reschedule, and the
-- weather-disruption resolution.
--
-- The one-to-one tables here (cancellation, reschedule, approval, foc_approval,
-- weather_resolve) all use booking_id as the primary key. That is what makes
-- "this never happened" a missing row instead of a row full of nulls, and it
-- makes a second one impossible rather than merely unexpected.

create table operation_schemas.booking_history (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references operation_schemas.booking (id) on delete cascade,
  at           timestamptz not null default now(),
  -- Monotonic within a booking, so two entries written in the same millisecond
  -- still have a defined order. `at` alone is not a stable sort key.
  seq          integer not null,
  -- The blob called this `type` in the model file and `kind` in the mapper;
  -- `kind` wins because `type` is a reserved word in too many client languages.
  kind         text,
  title        text,
  body         text,
  tag          text,
  actor        text,
  -- Whatever else the event carried. History entries are heterogeneous and
  -- read-only once written, so the tail stays a document.
  data         jsonb not null default '{}'::jsonb,

  constraint booking_history_seq_uk unique (booking_id, seq),
  constraint booking_history_seq_nonneg_ck check (seq >= 0)
);

comment on table operation_schemas.booking_history is
  'Append-only audit trail. Enforced by grants and the write path, not by a trigger: a trigger would also block the BK-04 backfill and any future corrective migration.';

create index booking_history_booking_at_idx on operation_schemas.booking_history (booking_id, at desc);

-- Over-capacity approval. Raised when a booking would exceed a boat's booking
-- cap; over the licensed seat count is a hard block and never reaches here.
create table operation_schemas.booking_approval (
  booking_id      uuid primary key references operation_schemas.booking (id) on delete cascade,
  status          text not null,
  reason          text,
  -- Which status the booking moves to once approved — usually 'confirmed', but
  -- the queue also approves quotes, so it is stored rather than assumed.
  target_status   text,
  -- [{routeId, date, name, need, capFree, overBy, licFree}] — the capacity
  -- picture at the moment the approver saw it. A frozen snapshot for a human to
  -- read, never re-queried, so it stays a document.
  over            jsonb not null default '[]'::jsonb,
  tot_over        integer,
  discount        numeric(12, 2),
  sale_name       text,
  requested_by    text,
  requested_at    timestamptz,
  approved_by     text,
  approved_at     timestamptz,
  note            text,

  constraint booking_approval_status_ck check (status in ('pending', 'approved', 'rejected')),
  constraint booking_approval_target_status_ck check (target_status is null or target_status in (
    'quote', 'pending_foc', 'pending_approval', 'confirmed',
    'cancelled', 'cancelled_weather', 'rejected', 'completed'
  ))
);

-- The approval queue is a live worklist, so it gets its own small index rather
-- than scanning every booking that was ever approved.
create index booking_approval_pending_idx
  on operation_schemas.booking_approval (requested_at)
  where status = 'pending';

create table operation_schemas.booking_foc_approval (
  booking_id      uuid primary key references operation_schemas.booking (id) on delete cascade,
  -- How many free-of-charge heads were requested.
  pax_count       integer not null default 0,
  reason          text,
  status          text not null,
  requested_at    timestamptz,
  requested_by    text,
  approved_at     timestamptz,
  approved_by     text,
  reject_reason   text,

  constraint booking_foc_approval_status_ck check (status in ('pending', 'approved', 'rejected')),
  constraint booking_foc_approval_count_ck check (pax_count >= 0)
);

create index booking_foc_approval_pending_idx
  on operation_schemas.booking_foc_approval (requested_at)
  where status = 'pending';

create table operation_schemas.booking_cancellation (
  booking_id       uuid primary key references operation_schemas.booking (id) on delete cascade,
  -- Cancelled at this instant. The booking's status says which of the three
  -- cancelled statuses applies; this says when.
  cancelled_at     timestamptz,
  category         text,
  -- Label frozen at cancellation time, because the category catalogue is edited.
  category_label   text,
  -- `group` is reserved in SQL; renamed rather than quoted forever.
  group_name       text,
  reason           text,
  note             text,
  charge_type      text,
  charge_amount    numeric(12, 2) not null default 0,
  recorded_at      timestamptz,
  recorded_by      text
);

-- Part of a party drops out but the booking lives on. One row per event, so the
-- history of a shrinking group is preserved instead of overwritten.
create table operation_schemas.booking_partial_cancel (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references operation_schemas.booking (id) on delete cascade,
  seq              smallint not null,
  -- Which day and which trip lost passengers.
  trip_date        date,
  trip_index       smallint,
  -- {ad_fr, chd_th, ...}: who was removed. A document rather than rows in
  -- booking_trip_pax, because this is the historical delta — the live counts
  -- are already normalised on the trip, and nothing re-aggregates a cancellation
  -- by pax kind.
  pax_removed      jsonb not null default '{}'::jsonb,
  pax_count        integer not null default 0,
  category         text,
  category_label   text,
  group_name       text,
  note             text,
  refund_mode      text,
  refund           numeric(12, 2) not null default 0,
  -- Split of the cancelled heads into charged and waived, with the money each
  -- side represents. Both counts and both amounts are stored because a partial
  -- waiver is a negotiated outcome, not a formula.
  charged_count    integer not null default 0,
  charged_amount   numeric(12, 2) not null default 0,
  waived_count     integer not null default 0,
  waived_amount    numeric(12, 2) not null default 0,
  recorded_at      timestamptz,
  recorded_by      text,

  constraint booking_partial_cancel_seq_uk unique (booking_id, seq),
  constraint booking_partial_cancel_seq_nonneg_ck check (seq >= 0),
  constraint booking_partial_cancel_trip_index_ck check (trip_index is null or trip_index >= 0),
  constraint booking_partial_cancel_counts_ck check (
    pax_count >= 0 and charged_count >= 0 and waived_count >= 0
  )
);

create table operation_schemas.booking_reschedule (
  booking_id      uuid primary key references operation_schemas.booking (id) on delete cascade,
  from_date       date,
  to_date         date,
  reason          text,
  charge_type     text,
  charge_amount   numeric(12, 2) not null default 0,
  -- When and how the reschedule fee is taken: 'now', 'on-tour', 'invoice'.
  collect         text,
  recorded_at     timestamptz,
  recorded_by     text
);

comment on table operation_schemas.booking_reschedule is
  'One row per booking: the monolith keeps only the latest reschedule on bk.reschedule. Earlier moves survive in booking_history, which is where the full chain is read from.';

-- Weather disruption. The event is declared centrally; this row is one
-- booking's outcome under it.
create table operation_schemas.booking_weather_resolve (
  booking_id      uuid primary key references operation_schemas.booking (id) on delete cascade,
  -- Intended FK -> weather_event(id) once that table is migrated.
  event_id        text,
  status          text,
  notified_at     timestamptz,
  -- 'moved', 'refunded', 'credited', 'proceeded'.
  outcome         text,
  resolved_at     timestamptz,
  new_date        date
);

comment on column operation_schemas.booking_weather_resolve.event_id is
  'Intended FK -> weather_event(id). That table is not migrated yet.';

create index booking_weather_resolve_status_idx
  on operation_schemas.booking_weather_resolve (status)
  where resolved_at is null;
