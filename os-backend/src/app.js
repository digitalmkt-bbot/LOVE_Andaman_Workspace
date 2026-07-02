'use strict';
const express = require('express');
const cfg = require('./config');

const store = cfg.DATA_BACKEND === 'relational'
  ? require('./relationalStore')
  : require('./blobStore');

const app = express();
app.use(express.json({ limit: '64mb' }));

// --- real-time (preserve the client's SSE contract) ---
const sseClients = new Set();
function notify() { for (const r of sseClients) { try { r.write('data: {"changed":true}\n\n'); } catch (_) {} } }
app.get('/api/events', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
  res.write('retry: 5000\n\n');
  sseClients.add(res);
  const hb = setInterval(() => { try { res.write(':hb\n\n'); } catch (_) {} }, 25000);
  req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
});

app.get('/api/health', (req, res) => res.json({ ok: true, backend: cfg.DATA_BACKEND, schema: cfg.DB_SCHEMA }));

// --- state contract (whole app_state object) ---
app.get('/api/state', async (req, res) => {
  try { res.json(await store.loadState()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/state', async (req, res) => {
  try { await store.saveState(req.body || {}); notify(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// diagnostics — work against operation_schemas regardless of the active flag (read-only)
const relstore = require('./relationalStore');
app.get('/api/_rowcounts', async (req, res) => {
  try { res.json(await relstore.rowCounts()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// full round-trip validation in the browser: assemble live tables -> blob -> decompose,
// compare per-table row counts + re-assemble stability. Read-only.
app.get('/api/_roundtrip', async (req, res) => {
  try {
    const { decomposeBlob, assembleBlob } = require('./mapping/os_repo');
    const live = await relstore.rowCounts();
    const blob = await relstore.loadState();
    const rt = decomposeBlob(blob);
    const diffs = [];
    let rowCountParity = true;
    for (const t of relstore.TABLES) {
      const a = live[t] || 0, b = (rt[t] || []).length;
      if (a !== b) { rowCountParity = false; diffs.push({ table: t, live: a, roundtrip: b }); }
    }
    const stable = JSON.stringify(assembleBlob(rt)) === JSON.stringify(blob);
    res.json({ rowCountParity, stable, tables: relstore.TABLES.length, diffCount: diffs.length, diffs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = app;
