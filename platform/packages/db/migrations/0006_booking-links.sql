-- 0006_booking-links
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file.
--
-- BK-01 · the two links that leave the booking schema: uploaded documents
-- (which live in `allotment`) and the B2C booking they came from (which lives
-- in `love_kingdom`).

-- Attachment metadata with a REAL foreign key to the booking — the thing the
-- current arrangement cannot do. Today `allotment.attachments.booking_id` is an
-- unenforced text column, and 118 of its 3,038 rows already point at no
-- booking at all.
--
-- The bytes are NOT copied here. `allotment.attachments.data` stays where it
-- is: moving 3,038 bytea blobs is a separate, slow, revertible operation
-- (P0-09), and copying them would leave two masters in the meantime. This table
-- is the index; `legacy_attachment_id` is the pointer to the bytes.
create table operation_schemas.booking_attachment (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid not null references operation_schemas.booking (id) on delete cascade,
  -- allotment.attachments.id. Unique, so the same blob cannot be indexed twice.
  legacy_attachment_id   text unique,
  filename               text not null,
  mime                   text,
  size_bytes             integer,
  uploaded_by            text,
  uploaded_at            timestamptz not null default now(),
  -- 'voucher', 'passport', 'payment-slip', ... open-ended: doc-check adds kinds.
  kind                   text,

  constraint booking_attachment_size_ck check (size_bytes is null or size_bytes >= 0)
);

comment on column operation_schemas.booking_attachment.legacy_attachment_id is
  'Points at allotment.attachments(id), where the bytea still lives. The cross-schema FK is legal in Postgres but is deferred to P0-09, which has to relink or soft-delete the 118 known orphans first — adding it now would fail on real data.';

create index booking_attachment_booking_id_idx on operation_schemas.booking_attachment (booking_id);

-- Replaces the `b2c_<lkId>[_<n>]` id-prefix convention with a real row.
--
-- Per the P0-08 decision, an ops booking and a love_kingdom booking stay
-- distinct entities — love_kingdom is hotel-package shaped, with booking_items,
-- hotels and room_types that have no ops equivalent — joined by this table
-- rather than merged. The prefix convention could not express the fan-out
-- (one B2C booking becoming several ops bookings) without encoding it in a
-- string, and nothing validated the string: 22 `b2c_` bookings in production
-- have no love_kingdom parent.
create table operation_schemas.booking_b2c_link (
  booking_id       uuid primary key references operation_schemas.booking (id) on delete cascade,
  -- love_kingdom.bookings.id.
  lk_booking_id    text not null,
  -- The `_<n>` suffix: which leg of a multi-tour B2C booking this ops booking
  -- is. 0 for the first/only leg, so the uniqueness below actually bites — a
  -- nullable column would let duplicates through, since NULL <> NULL.
  leg_index        smallint not null default 0,
  -- The per-field ownership split the app already encodes in BKV2_B2C_OWN and
  -- bk.b2cOverride[]: which side wins on each field when both have edited.
  -- Held as a document because the field list is app-level policy that changes
  -- without a schema change.
  owned_fields     jsonb not null default '{}'::jsonb,
  linked_at        timestamptz not null default now(),

  constraint booking_b2c_link_leg_uk unique (lk_booking_id, leg_index),
  constraint booking_b2c_link_leg_nonneg_ck check (leg_index >= 0)
);

comment on column operation_schemas.booking_b2c_link.lk_booking_id is
  'Intended FK -> love_kingdom.bookings(id). Cross-schema FKs are legal, but this one is deferred to P0-09: 22 ops bookings already carry a b2c id with no love_kingdom row behind it, and the constraint would fail on them.';
