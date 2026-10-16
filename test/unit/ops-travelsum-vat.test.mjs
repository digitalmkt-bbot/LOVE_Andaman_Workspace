// §tsVat · Travel Summary VAT tabs (legacy tsPickVat), from the server roster + the agent's vatMode.
//   node --test test/unit/ops-travelsum-vat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, bk, SUMMARY, handed, section } from './travelsum-harness.mjs';

const AGENTS = { agV: { id: 'agV', name: 'Vat Co', vatMode: 'exclude' }, agN: { id: 'agN', name: 'Plain Co', vatMode: 'none' }, agU: { id: 'agU', name: 'Unset Co' } };
const sbGetAgent = (id) => AGENTS[id] || null;
const bookings = [bk('b1', 'r_pw', { agent_id: 'agV' }), bk('b2', 'r_pw2', { agent_id: 'agN' }), bk('b3', 'r_tl', { agent_id: undefined }), bk('b5', 'r_tl', { agent_id: 'agU' })];
const summary = { ...SUMMARY, collect_rows: [...SUMMARY.collect_rows, { booking_id: 'b5', voucher_ref: 'V-b5', route_id: 'r_tl', target: 50, paid: 0, due: 50, cot: 0 }] };
const run = async (state) => { const h = load({ sbGetAgent, ...state }, { bookings, summary }); await h.ctx.window.renderTravelSum(); return h; };
const docNo = (html) => /data-ops-ts-docno="([^"]*)"/.exec(html)[1];

test('VAT tabs count the roster by the agent vat mode (walk-in and unset = no VAT)', async () => {
  const { host } = await run({});
  const H = handed(host.innerHTML, 'H');
  assert.equal(H.nAll, 4); assert.equal(H.nVat, 1); assert.equal(H.nNoVat, 3);
  assert.equal(H.vat, '');
});

test('With VAT keeps only VAT agents rows and tags the doc number', async () => {
  const { host } = await run({ _tsVatF: 'vat' });
  const s03 = section(host.innerHTML, '03');
  assert.ok(s03.includes('V-b1'));
  for (const v of ['V-b2', 'V-b3', 'V-b5']) assert.ok(!s03.includes(v), v);
  assert.equal(docNo(host.innerHTML), 'TS-20261014-ALL-VAT');
  assert.equal(handed(host.innerHTML, 'H').target, 1000, 'the selection\'s money is its rows\' money');
});

test('No VAT keeps the rest and tags -NOVAT', async () => {
  const { host } = await run({ _tsVatF: 'novat' });
  const s04 = section(host.innerHTML, '04');
  assert.ok(!s04.includes('V-b1'));
  for (const v of ['V-b2', 'V-b3', 'V-b5']) assert.ok(s04.includes(v), v);
  assert.match(docNo(host.innerHTML), /-ALL-NOVAT$/);
});

test('VAT combines with the pier scope, and the pier chips count only the chosen VAT side', async () => {
  const { host } = await run({ _tsVatF: 'novat', _tsPier: 'tublamu' });
  const s04 = section(host.innerHTML, '04');
  assert.ok(s04.includes('V-b3') && !s04.includes('V-b2'));
  assert.equal(docNo(host.innerHTML), 'TS-20261014-TUBLAMU-NOVAT');
  const H = handed(host.innerHTML, 'H');
  assert.equal(H.pMap.panwa.n, 1, 'b1 (VAT) is left out of the panwa chip');
});

test('an agent with no VAT mode set is named for the warning', async () => {
  const { host } = await run({});
  assert.deepEqual(JSON.parse(JSON.stringify(handed(host.innerHTML, 'H').vgap)), ['Unset Co']);
});
