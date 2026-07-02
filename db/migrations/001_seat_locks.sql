-- Harden the existing converted seat-lock table so overselling is impossible under any
-- concurrency. The CHECK is the real backstop; draw_seat() adds a row lock + friendly error.
-- Idempotent: safe to re-run.

-- 1) oversell guard — the DB itself rejects used > qty
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sb_seat_locks_no_oversell') THEN
    ALTER TABLE operation_schemas.sb_seat_locks
      ADD CONSTRAINT sb_seat_locks_no_oversell CHECK (used <= qty);
  END IF;
END $$;

-- 2) atomic draw. FOR UPDATE serializes concurrent draws on the SAME lock (others unaffected).
--    Runs inside PostgREST's per-request transaction, or any BEGIN..COMMIT.
--    qty/used are the dump's bigint columns and may be null → coalesce to 0.
CREATE OR REPLACE FUNCTION operation_schemas.draw_seat(p_lock_id text, p_qty int)
RETURNS operation_schemas.sb_seat_locks
LANGUAGE plpgsql AS $$
DECLARE r operation_schemas.sb_seat_locks;
BEGIN
  SELECT * INTO r FROM operation_schemas.sb_seat_locks WHERE id = p_lock_id FOR UPDATE;  -- 2nd caller waits
  IF NOT FOUND THEN
    RAISE EXCEPTION 'seat lock % not found', p_lock_id USING errcode = 'P0002';
  END IF;
  IF coalesce(r.used,0) + p_qty > coalesce(r.qty,0) THEN                                  -- friendly 409
    RAISE EXCEPTION 'not enough seats: % left, need %', coalesce(r.qty,0) - coalesce(r.used,0), p_qty
      USING errcode = '23514';
  END IF;
  UPDATE operation_schemas.sb_seat_locks SET used = coalesce(used,0) + p_qty
    WHERE id = p_lock_id RETURNING * INTO r;
  RETURN r;
END $$;
