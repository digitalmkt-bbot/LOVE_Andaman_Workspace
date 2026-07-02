// ERP backend — Express over operation_schemas. Reads via SELECT grants; writes only
// through vetted SECURITY DEFINER RPCs (e.g. draw_seat). Connects as the scoped erp_api role.
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const DB_URL = process.env.DATABASE_URL || '';
const pool = new Pool({
  connectionString: DB_URL,
  ssl: /railway|rlwy/.test(DB_URL) ? { rejectUnauthorized: false } : false,
  max: 10,
});

const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try { await pool.query('select 1'); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// read — bookings (limited). ponytail: no pagination/filtering yet, add when a screen needs it.
app.get('/api/bookings', async (req, res) => {
  try {
    const r = await pool.query('select * from operation_schemas.sb_bookings limit 50');
    res.json({ count: r.rowCount, rows: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// write — concurrency-safe seat draw via the RPC (DB serializes; oversell → 409)
app.post('/api/seat-locks/:id/draw', async (req, res) => {
  const qty = parseInt(req.body?.qty, 10);
  if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'qty must be a positive integer' });
  try {
    const r = await pool.query('select * from operation_schemas.draw_seat($1,$2)', [req.params.id, qty]);
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23514') return res.status(409).json({ error: e.message });   // not enough seats
    if (e.code === 'P0002') return res.status(404).json({ error: e.message });   // lock not found
    res.status(500).json({ error: e.message });
  }
});

// serve the static front (plain HTML/JS — no build step)
const pub = path.join(__dirname, 'public');
app.use(express.static(pub));
app.get('*', (req, res) => res.sendFile(path.join(pub, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('erp-api on ' + PORT + (DB_URL ? ' · db on' : ' · NO DATABASE_URL')));
