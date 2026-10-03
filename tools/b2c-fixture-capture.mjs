#!/usr/bin/env node
// §b2cMapMod · capture a real B2C order as a test fixture for test/unit/b2c-map.test.mjs.
//
//   B2C_DB_URL=… OPS_DATABASE_URL=… B2C_SCHEMA=love_kingdom \
//     node tools/b2c-fixture-capture.mjs LOV-7485231 "lead TH + TH + US sold as 3 Thai"
//
// Read-only on both databases. It pulls exactly what relSyncB2C feeds the mapper — the item rows
// (B2C_ITEM_JOIN), the traveller list, the four catalogs and the ops pickup areas — by running the
// loader code out of server.js itself, so the fixture cannot drift from what the sync really reads.
// Names, phones, emails and free-text notes are replaced before anything touches disk; nationality,
// counts, money, dates and ids are kept, because those are what the mapper decides on.
//
// Writes test/fixtures/b2c/<id>.json. Then add the assertion that pins the bug to the test file —
// the fixture alone only proves the mapper still runs, not that it is right.
import fs from 'node:fs';
import path from 'node:path';
import { openLive, ROOT } from './b2c-live.mjs';

const [id, ...noteParts] = process.argv.slice(2);
if (!id) { console.error('usage: node tools/b2c-fixture-capture.mjs <B2C booking id> "<what bug it pins>"'); process.exit(2); }

const live = await openLive();
try {
  const items = await live.itemsFor(id);
  if (!items.length) throw new Error(`no B2C item rows for ${id}`);
  const c = await live.context(items);
  const paxMap = c.paxByBooking, areas = c.areas;
  const [addon, prog, trf, ext] = [c.addonCat, c.progCat, c.trfCat, c.extCat];

  // ── scrub ── a fixture is committed, so no real person may be identifiable from it.
  let n = 0; const fake = new Map();
  const alias = v => { const k = String(v); if (!fake.has(k)) fake.set(k, 'Guest ' + (++n)); return fake.get(k); };
  // An explicit list, not a key pattern: `name` inside details.addonsSelected is a PRODUCT name the
  // mapper prints, and "pickupHotel" contains "tel". Pattern-matching mangled both.
  const PERSON = ['booked_by_name', 'bk_customer_name', 'customer_name'];
  const EMAIL  = ['booked_by_email', 'customer_email'];
  const PHONE  = ['customer_phone'];
  const NOTE   = ['special_request', 'remark'];
  const email = v => alias(v).toLowerCase().replace(' ', '') + '@example.test';
  const note  = v => (v ? '[scrubbed note]' : v);
  const scrubPax = p => (!p || typeof p !== 'object') ? p : {
    ...p, name: p.name ? alias(p.name) : p.name, phone: p.phone ? '+66000000000' : p.phone,
    passport: p.passport ? 'X0000000' : p.passport, dob: p.dob ? '1990-01-01' : p.dob,
    remark: note(p.remark), email: p.email ? email(p.email) : p.email };
  // details is product/pickup data the mapper decides on; only its contact keys are personal.
  const scrubDetails = d => (!d || typeof d !== 'object') ? d : Object.fromEntries(Object.entries(d).map(([k, v]) =>
    [k, /^(customer|contact)(Name|Phone|Email)?$|phone$|email$|passport/i.test(k) && typeof v === 'string' && v ? '[scrubbed]' : v]));
  const viaJson = (v, f) => { if (typeof v !== 'string') return f(v);
    try { return JSON.stringify(f(JSON.parse(v))); } catch (_) { return v; } };
  const scrubObj = rows => rows.map(r => {
    const o = { ...r };
    for (const k of PERSON) if (o[k]) o[k] = alias(o[k]);
    for (const k of EMAIL)  if (o[k]) o[k] = email(o[k]);
    for (const k of PHONE)  if (o[k]) o[k] = '+66000000000';
    for (const k of NOTE)   if (o[k]) o[k] = note(o[k]);
    if (o.bk_passengers != null) o.bk_passengers = viaJson(o.bk_passengers, a => Array.isArray(a) ? a.map(scrubPax) : a);
    if (o.details != null) o.details = viaJson(o.details, scrubDetails);
    return o;
  });
  // pg hands date columns back as Date at LOCAL midnight and the mapper formats them with local
  // getters; a plain JSON round-trip would turn them into UTC strings and shift the travel date.
  // Tag them so the test can rebuild the exact same kind of value.
  const enc = v => {
    if (v instanceof Date) {
      const dateOnly = !v.getHours() && !v.getMinutes() && !v.getSeconds() && !v.getMilliseconds();
      const p = x => String(x).padStart(2, '0');
      return dateOnly ? { $date: v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate()) } : { $ts: v.toISOString() };
    }
    if (Array.isArray(v)) return v.map(enc);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
    return v;
  };
  const fx = {
    id, note: noteParts.join(' ') || '', capturedAt: new Date().toISOString().slice(0, 10),
    items: enc(scrubObj(items)),
    paxRows: (paxMap.get(id) || []).map(p => ({ ...p, name: p.name ? alias(p.name) : '' })),
    catalogs: { addon: [...addon], prog: [...prog], trf: [...trf], ext: [...ext] },
    areas,
  };
  const out = path.join(ROOT, 'test', 'fixtures', 'b2c', id + '.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(fx, null, 1) + '\n');
  console.log(`wrote ${path.relative(ROOT, out)} · ${items.length} line(s), ${fx.paxRows.length} traveller(s), ${fake.size} name(s) scrubbed`);
} finally {
  await live.close();
}
