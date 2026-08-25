-- 0003_booking-money
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file.
--
-- BK-01 · everything that moves the price: add-ons, adjustments, fee items,
-- day-of upgrades, and the one price breakdown per booking.
--
-- All money is numeric(12,2). The blob and the current mapper use whole-baht
-- integers, which is lossless into this type; the two decimals exist because
-- VAT-inclusive agent rates already produce satang in the accounting module and
-- rounding them at the booking layer is how totals drift by a baht.

create table operation_schemas.booking_addon (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references operation_schemas.booking (id) on delete cascade,
  seq          smallint not null,
  -- Matches an RT_ADDON_DEFS key ('longtail', 'privateTransfer', ...). Not an
  -- enum: add-on types are data-driven and staff create new ones in the UI.
  type         text not null,
  -- Label frozen at sale time, so renaming an add-on does not rewrite history.
  label        text,
  amount       numeric(12, 2) not null default 0,
  qty          integer not null default 1,
  note         text,

  constraint booking_addon_seq_uk unique (booking_id, seq),
  constraint booking_addon_seq_nonneg_ck check (seq >= 0),
  constraint booking_addon_qty_nonneg_ck check (qty >= 0)
);

create table operation_schemas.booking_adjustment (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references operation_schemas.booking (id) on delete cascade,
  seq          smallint not null,
  -- 'discount', 'surcharge', 'commission', ... open-ended by design.
  kind         text not null,
  mode         text not null,
  -- Signed. A discount is negative in 'amount' mode; in 'percent' mode the sign
  -- of `value` carries the same meaning, so nothing has to know a kind's
  -- direction to total a booking.
  value        numeric(12, 2) not null default 0,
  label        text,
  note         text,

  constraint booking_adjustment_seq_uk unique (booking_id, seq),
  constraint booking_adjustment_seq_nonneg_ck check (seq >= 0),
  constraint booking_adjustment_mode_ck check (mode in ('amount', 'percent')),
  -- A percentage outside ±100 is a typo, not a discount.
  constraint booking_adjustment_percent_range_ck check (
    mode <> 'percent' or (value >= -100 and value <= 100)
  )
);

-- Post-sale charges raised by ops: cancellation fees, reschedule fees, damage.
-- Separate from adjustments because those are priced at sale time and these are
-- raised afterwards, each with its own timestamp for the invoice.
create table operation_schemas.booking_fee_item (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references operation_schemas.booking (id) on delete cascade,
  seq          smallint not null,
  type         text not null,
  label        text,
  amount       numeric(12, 2) not null default 0,
  raised_at    timestamptz,

  constraint booking_fee_item_seq_uk unique (booking_id, seq),
  constraint booking_fee_item_seq_nonneg_ck check (seq >= 0)
);

-- Day-of upsells sold at the pier by crew (`upgrades[]` in the blob). Money
-- splits three ways — the company's cut, the seller's commission, and what the
-- customer actually handed over — so it cannot collapse into booking_addon.
create table operation_schemas.booking_upgrade (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references operation_schemas.booking (id) on delete cascade,
  seq             smallint not null,
  -- The upgrade product code from the pier catalogue.
  upgrade_code    text,
  label           text,
  sell_price      numeric(12, 2) not null default 0,
  to_company      numeric(12, 2) not null default 0,
  commission      numeric(12, 2) not null default 0,
  collected       boolean not null default false,
  seller          text,
  -- How the seller settles with the office: 'cash', 'transfer', ...
  settle          text,
  method          text,
  -- Card/gateway fee, as a percentage and as the resulting amount. Both are
  -- stored because the percentage in force changes and the amount is what the
  -- statement has to reconcile against.
  fee_pct         numeric(6, 3),
  fee             numeric(12, 2) not null default 0,
  customer_paid   numeric(12, 2) not null default 0,
  slips           jsonb not null default '[]'::jsonb,
  note            text,
  sold_at         timestamptz,

  constraint booking_upgrade_seq_uk unique (booking_id, seq),
  constraint booking_upgrade_seq_nonneg_ck check (seq >= 0),
  constraint booking_upgrade_amounts_nonneg_ck check (
    sell_price >= 0 and to_company >= 0 and commission >= 0 and fee >= 0 and customer_paid >= 0
  )
);

comment on column operation_schemas.booking_upgrade.seller is
  'Intended FK -> staff(id). Crew member who made the sale; that table is not migrated yet.';

-- Exactly one per booking: booking_id is the primary key, so "no breakdown" is
-- a missing row, and there is no way to end up with two.
create table operation_schemas.booking_price_breakdown (
  booking_id     uuid primary key references operation_schemas.booking (id) on delete cascade,
  seat           numeric(12, 2) not null default 0,
  addon          numeric(12, 2) not null default 0,
  -- Signed and NEGATIVE, exactly as the monolith stores them. Kept negative
  -- rather than flipped to positive-magnitude so `seat + addon + foc_discount +
  -- discount + extra` is the total by plain addition, everywhere, with no
  -- component needing to know its own sign convention.
  foc_discount   numeric(12, 2) not null default 0,
  discount       numeric(12, 2) not null default 0,
  extra          numeric(12, 2) not null default 0,
  total          numeric(12, 2) not null default 0,

  constraint booking_price_breakdown_foc_sign_ck check (foc_discount <= 0),
  constraint booking_price_breakdown_discount_sign_ck check (discount <= 0),
  constraint booking_price_breakdown_seat_sign_ck check (seat >= 0),
  constraint booking_price_breakdown_addon_sign_ck check (addon >= 0)
);

comment on table operation_schemas.booking_price_breakdown is
  'The single total for a booking. The blob also carried bk.total as a duplicate of priceBreakdown.total; BK-04 asserts they agree and reports mismatches instead of migrating both.';

-- Deliberately NOT enforced as a CHECK: `total` is not always the sum of the
-- five components. A manual-price booking (booking.price_mode = 'manual')
-- sets it from booking.manual_total, and rounding to whole baht at the point of
-- sale can leave a satang of slack. The invariant belongs in a reconciliation
-- report, not in a constraint that would reject legitimate historical rows.
