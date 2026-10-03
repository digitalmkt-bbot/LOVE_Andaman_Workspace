-- 031_addon_join_pax.sql  (2026-09-15)   [§ltJoinQty]
--
-- How many people actually got on the longtail, instead of assuming everyone did.
--
-- Longtail Join has been an all-or-nothing tick since it was built: check it, and the price and
-- every downstream count treat every adult and child on the trip as having taken the boat. Real
-- groups do not behave that way. A party of nine books the trip and two of them go out on the
-- longtail while the rest stay aboard.
--
-- The cost side of the house already hit this and worked around it the hard way. On 16 Aug an
-- Oceanus trip carried 35 passengers, two of whom bought a join, and the formula charged all 35 —
-- seventeen times the real cost. The line was switched off to stop the bleeding, which then meant
-- the trip P&L stopped counting longtail at all. Neither number was ever right.
--
-- jad / jchd hold the counts the staff actually keyed. NULL means a booking taken before this
-- migration, or one where nobody narrowed it down, and every reader falls back to "all pax" — the
-- old behaviour, unchanged, so no existing booking's price or job order moves.
--
-- The count has to reach the database, not just the screen. bkV2AddOnFlags → bkLtState →
-- pxLongtail is the path that feeds the longtail job order and the per-trip cost line; if the
-- number lived only in the browser, the booking screen would say two while the job order and the
-- P&L still said nine.
--
-- Counts are per booking add-on, not per trip. A booking with two trips fills the first trip's
-- seats before the second — arbitrary either way, but predictable and explainable to the person
-- at the pier, which "spread proportionally" is not.

ALTER TABLE operation_schemas.sb_bookings__addons
  ADD COLUMN IF NOT EXISTS jad  bigint,
  ADD COLUMN IF NOT EXISTS jchd bigint;

COMMENT ON COLUMN operation_schemas.sb_bookings__addons.jad IS
  'longtail-join · adults actually taking the longtail · NULL = not narrowed down, readers count every adult (pre-031 behaviour)';
COMMENT ON COLUMN operation_schemas.sb_bookings__addons.jchd IS
  'longtail-join · children actually taking the longtail · NULL = not narrowed down, readers count every child';
