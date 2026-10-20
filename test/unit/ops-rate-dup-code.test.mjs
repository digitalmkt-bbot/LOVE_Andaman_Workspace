// Rate Type duplicate-code banner and fix button are off in ops mode (17-ops-rate-types.js)
//   node --test test/unit/ops-rate-dup-code.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { runtime, plain } from './fe-harness.mjs';

// ── 15 ──────────────────────────────────────────────────────────────────────
const PRE = `
  var SB_RATE_TYPES = [{id:'a',code:'X'},{id:'b',code:'x'}]; var _fixed = 0;
  function rtDupCodeScan(){ return [{code:'X', list: SB_RATE_TYPES}]; }
  function rtDupCodeFix(){ _fixed++; }
`;
test('15: in ops mode the duplicate-code scan finds none and the fix button does nothing; legacy mode keeps both', async () => {
  const r = runtime({ files: ['17-ops-rate-types.js'], pre: PRE, enabled: true, handlers: { 'GET /v1/rate-types': { body: { rate_types: [] } } } });
  await r.settle();
  assert.deepEqual(plain(r.ctx.rtDupCodeScan()), []);
  r.ctx.rtDupCodeFix();
  assert.equal(vm.runInContext('_fixed', r.ctx), 0);
  const l = runtime({ files: ['17-ops-rate-types.js'], pre: PRE, enabled: false });
  assert.equal(l.ctx.rtDupCodeScan().length, 1);
  l.ctx.rtDupCodeFix();
  assert.equal(vm.runInContext('_fixed', l.ctx), 1);
});
