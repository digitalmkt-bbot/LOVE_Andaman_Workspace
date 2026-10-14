// §tsVat · Travel Summary VAT filter, from the server roster + the agent's vatMode.
//   node --test test/unit/ops-travelsum-vat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, bk, SUMMARY } from './travelsum-harness.mjs';

const AGENTS = { agV: { id: 'agV', name: 'Vat Co', vatMode: 'exclude' }, agN: { id: 'agN', name: 'Plain Co', vatMode: 'none' }, agU: { id: 'agU', name: 'Unset Co' } };
const sbGetAgent = (id) => AGENTS[id] || null;
const bookings = [bk('b1', 'r_pw', { agent_id: 'agV' }), bk('b2', 'r_pw2', { agent_id: 'agN' }), bk('b3', 'r_tl', { agent_id: undefined }), bk('b5', 'r_tl', { agent_id: 'agU' })];
const summary = { ...SUMMARY, collect_rows: [...SUMMARY.collect_rows, { booking_id: 'b5', voucher_ref: 'V-b5', route_id: 'r_tl', target: 50, paid: 0, due: 50, cot: 0 }] };
const run = async (state) => { const h = load({ sbGetAgent, ...state }, { bookings, summary }); await h.ctx.window.renderTravelSum(); return h; };

test('VAT chips count the roster by the agent vat mode (walk-in and unset = no VAT)', async () => {
  const { host } = await run({});
  assert.match(host.innerHTML, /With VAT <b>1<\/b>/);
  assert.match(host.innerHTML, /No VAT <b>3<\/b>/);
  assert.match(host.innerHTML, /tsPickVat\('vat'\)/);
});

test('With VAT keeps only VAT agents rows and tags the doc number', async () => {
  const { host } = await run({ _tsVatF: 'vat' });
  assert.ok(host.innerHTML.includes('V-b1'));
  for (const v of ['V-b2', 'V-b3', 'V-b5']) assert.ok(!host.innerHTML.includes(v), v);
  assert.match(host.innerHTML, /Doc no\. TS-20261014-ALL-VAT/);
});

test('No VAT keeps the rest and tags -NOVAT', async () => {
  const { host } = await run({ _tsVatF: 'novat' });
  assert.ok(!host.innerHTML.includes('V-b1'));
  for (const v of ['V-b2', 'V-b3', 'V-b5']) assert.ok(host.innerHTML.includes(v), v);
  assert.match(host.innerHTML, /-ALL-NOVAT/);
});

test('VAT combines with the pier scope', async () => {
  const { host } = await run({ _tsVatF: 'novat', _tsPier: 'tublamu' });
  assert.ok(host.innerHTML.includes('V-b3') && !host.innerHTML.includes('V-b2'));
  assert.match(host.innerHTML, /TS-20261014-TUBLAMU-NOVAT/);
});

test('an agent with no VAT mode set is named in a warning', async () => {
  const { host } = await run({});
  assert.match(host.innerHTML, /data-ops-ts-vatgap[^>]*>No VAT mode set for Unset Co/);
});
