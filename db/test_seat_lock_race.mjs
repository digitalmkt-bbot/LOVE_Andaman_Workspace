// Proof: N users draw the last seats at once → the DB never oversells.
// Self-contained — builds an isolated table on a SCRATCH db, mirrors the draw_seat logic
// from migrations/001_seat_locks.sql. Run: DATABASE_URL=postgres://... node test_seat_lock_race.mjs
import { Pool } from 'pg';
import assert from 'node:assert';

const CAP = 10, TRIES = 25;                       // 25 people fight over 10 seats
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 30 });

// ponytail: draw logic duplicated from 001 so the test needs no prod schema; keep the two in sync.
await pool.query(`
  DROP SCHEMA IF EXISTS pt_test CASCADE;
  CREATE SCHEMA pt_test;
  CREATE TABLE pt_test.locks (id text PRIMARY KEY, qty int, used int, CHECK (used <= qty));
  INSERT INTO pt_test.locks VALUES ('L1', ${CAP}, 0);
  CREATE FUNCTION pt_test.draw(p_id text, p_qty int) RETURNS void LANGUAGE plpgsql AS $$
  DECLARE r pt_test.locks;
  BEGIN
    SELECT * INTO r FROM pt_test.locks WHERE id = p_id FOR UPDATE;
    IF coalesce(r.used,0) + p_qty > coalesce(r.qty,0) THEN
      RAISE EXCEPTION 'not enough seats' USING errcode = '23514';
    END IF;
    UPDATE pt_test.locks SET used = coalesce(used,0) + p_qty WHERE id = p_id;
  END $$;`);

const res = await Promise.allSettled(
  Array.from({ length: TRIES }, () => pool.query('SELECT pt_test.draw($1,1)', ['L1'])));
const ok   = res.filter(r => r.status === 'fulfilled').length;
const fail = res.filter(r => r.status === 'rejected').length;
const { rows: [row] } = await pool.query('SELECT used, qty FROM pt_test.locks WHERE id=$1', ['L1']);
await pool.query('DROP SCHEMA pt_test CASCADE');

assert.equal(ok, CAP,           `expected ${CAP} successes, got ${ok}`);
assert.equal(fail, TRIES - CAP, `expected ${TRIES - CAP} rejections, got ${fail}`);
assert.ok(row.used <= row.qty,  'OVERSOLD — this must never happen');

console.log(`PASS: ${TRIES} concurrent draws on ${CAP} seats → ${ok} booked, ${fail} rejected, used=${row.used}/${row.qty} (never oversold)`);
await pool.end();
