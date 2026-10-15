// B35 · an agent whose VAT mode was never set reads as '' in the browser, as in legacy (blank
// sb_agents.vatmode). Totals still treat it as no VAT (legacy `a.vatMode||'none'`); Travel Summary's
// "⚠ N agent ยังไม่ได้ตั้งโหมด" and the Agents page VAT-gap filter flag it. The server now answers
// vat_mode: null for it; before, both mappers turned null into 'none' and the warning could never show.
//   node --test test/unit/ops-agent-vatmode.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CATALOGUE = fs.readFileSync('allotment_v2/js/ops/10-ops-catalogue.js', 'utf8');
const AGENTS = fs.readFileSync('allotment_v2/js/ops/16-ops-agents.js', 'utf8');

function base() {
  const ctx = { console: { log() {}, warn() {} }, Promise, Array, Object, Error, String, Number, JSON, Set, Map, Math, Date, RegExp, encodeURIComponent, setTimeout };
  ctx.window = ctx;
  return ctx;
}

test('catalogue summary/detail: null vat_mode stays blank, a set mode is kept', () => {
  const ctx = base();
  ctx.laOps = { enabled: () => true, get: () => Promise.resolve({}), onWrite() {}, wrote() {} };
  vm.createContext(ctx); vm.runInContext(CATALOGUE, ctx);
  const map = ctx.laOps.catalogue.mapAgentDetail;
  assert.equal(map({ id: 'a1', name: 'Never set', vat_mode: null }).vatMode, '');
  assert.equal(map({ id: 'a2', name: 'Excl', vat_mode: 'exclude' }).vatMode, 'exclude');
  assert.equal(map({ id: 'a3', name: 'None', vat_mode: 'none' }).vatMode, 'none');
});

test('agent detail read: null vat_mode stays blank on SB_AGENTS', async () => {
  const ctx = base();
  ctx.SB_AGENTS = [{ id: 'a1', name: 'Old', vatMode: 'none' }];
  ctx.agRenderDetail = () => {};
  ctx.laOps = {
    enabled: () => true,
    get: (p) => Promise.resolve(/activity$/.test(p) ? { activity: [] } : { id: 'a1', name: 'Never set', active: true, vat_mode: null }),
    call: () => Promise.reject(new Error('no write expected')), queue: (fn) => fn(), wrote() {}, fail() {}, onWrite() {},
  };
  vm.createContext(ctx); vm.runInContext(AGENTS, ctx);
  await ctx.agRenderDetail('a1');
  assert.equal(ctx.SB_AGENTS[0].vatMode, '', 'the stale local "none" is replaced by the server\'s never-set');
});
