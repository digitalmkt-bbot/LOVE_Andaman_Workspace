'use strict';
// blob backend (default): read/write the legacy single JSON blob in public.app_state.data.
// Unchanged behavior — the legacy client keeps working through this while we validate relational.
const { getPool } = require('./db');
const STATE_ID = process.env.APP_STATE_ID || 'main';   // must match the legacy row id

async function loadState() {
  const pool = getPool();
  const r = await pool.query('SELECT data FROM public.app_state WHERE id=$1', [STATE_ID]);
  if (!r.rows[0] || !r.rows[0].data) return {};
  try { return JSON.parse(r.rows[0].data); } catch (_) { return {}; }
}

async function saveState(blob) {
  const pool = getPool();
  const data = JSON.stringify(blob);
  await pool.query(
    `INSERT INTO public.app_state(id,data,version,updated_at) VALUES($1,$2,1,now())
     ON CONFLICT(id) DO UPDATE SET data=$2, version=public.app_state.version+1, updated_at=now()`,
    [STATE_ID, data]
  );
}

module.exports = { loadState, saveState };
