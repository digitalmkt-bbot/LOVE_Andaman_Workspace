-- 029_b2b_promo_own_pricing.sql  (2026-09-15)   [§b2bPromo]
--
-- Promotions that carry their own prices, instead of every promotion needing a Rate Type.
--
-- The old model forced one Rate Type per promotion. Rate Types therefore grew without bound:
-- contract prices and short-lived promo prices sat in the same list, one agent's promo showed up
-- as a choice for every other agent, and after a season nobody could tell which tier was a real
-- contract and which was a promo that expired months ago.
--
-- A promotion now chooses where its price comes from:
--   pricemode 'rate'      the existing behaviour · reads rate_type_id (unchanged, still supported)
--   pricemode 'own'       prices live on the promotion itself, in `rates`
--   pricemode 'discount'  a % or per-head amount off the agent's main contract price
-- NULL pricemode means a row written before this migration, which the client reads as 'rate' —
-- so every promotion created up to now keeps behaving exactly as it did.
--
-- `rates` mirrors the shape the pricing code already reads everywhere:
--   {routeId: {zone: {"adult-thai","child-thai","adult-fr","child-fr", …}}}
-- It is stored as JSON text for the same reason sb_rate_types.price_tiers is: the pricing engine
-- consumes the whole nested object at once, and splitting it into a child table would buy nothing
-- but joins. Only the zones the promotion actually sets are stored; a zone left out falls through
-- to the standard rate, which is the behaviour staff were promised in the modal.
--
-- bookwin exists because promotions have two independent windows — the dates you must book in,
-- and the dates you must travel in ("book by 31 Oct to travel in Nov"). The columns for both
-- already existed on sb_contracts__programperiods, but every promotion written so far set all
-- four to the same range, because the UI only offered one. Enforcing the booking window on those
-- rows now would drop promotions off bookings that were made before the promotion started, and
-- silently reprice work that has already been sold. bookwin = 1 marks the rows that mean it.
--
-- bonus holds buy-N-get-1 ({on, buy, free, basis}). The system counts and warns; it never adds the
-- free seat itself, because a free seat that the system invents is a seat the boat does not know
-- about. Staff key the FOC passenger, which consumes allotment through the normal path.
--
-- sb_bookings__trips.promoid records which promotion actually priced that trip, at the moment it
-- was sold. The money was already frozen (the booking stores its own totals), but nothing recorded
-- *why* it was that number. Without it, a report that re-derives the contract price has to guess
-- from today's promotions — so editing a promotion made last month's bookings look mispriced.

ALTER TABLE operation_schemas.sb_contracts
  ADD COLUMN IF NOT EXISTS pricemode text,
  ADD COLUMN IF NOT EXISTS rates      text,
  ADD COLUMN IF NOT EXISTS discount   text,
  ADD COLUMN IF NOT EXISTS bonus      text,
  ADD COLUMN IF NOT EXISTS bookwin   bigint;

ALTER TABLE operation_schemas.sb_bookings__trips
  ADD COLUMN IF NOT EXISTS promoid text;

COMMENT ON COLUMN operation_schemas.sb_contracts.pricemode IS
  'rate | own | discount · NULL = written before 029, read as rate';
COMMENT ON COLUMN operation_schemas.sb_contracts.rates IS
  'JSON {routeId:{zone:{paxType:price}}} · only for pricemode = own · zones left out fall back to the standard rate';
COMMENT ON COLUMN operation_schemas.sb_contracts.discount IS
  'JSON {mode:"pct"|"amt", value} · only for pricemode = discount · always off the main contract price';
COMMENT ON COLUMN operation_schemas.sb_contracts.bonus IS
  'JSON {on,buy,free,basis} · buy-N-get-1 · counted and warned about, never auto-applied';
COMMENT ON COLUMN operation_schemas.sb_contracts.bookwin IS
  '1 = the booking window on program_periods is meant to be enforced · older rows leave it NULL on purpose';
COMMENT ON COLUMN operation_schemas.sb_bookings__trips.promoid IS
  'the promotion that priced this trip when it was sold · NULL = no promotion, or sold before 029';
