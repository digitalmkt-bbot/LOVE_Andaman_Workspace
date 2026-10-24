// §attachRange · /api/attach/<id> answers HTTP Range so Safari / iOS can play fleet-job video clips (§flpVideo)
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// server.js starts listening on require · lift just the helper out of the file text instead
// server.js lives on lk-inbox only (main has no legacy server), so on main these tests skip instead of failing
const HAS_SERVER = fs.existsSync(new URL('../../server.js', import.meta.url));
const src = HAS_SERVER ? fs.readFileSync(new URL('../../server.js', import.meta.url), 'utf8') : '';
const m = HAS_SERVER ? /function attachRange\(h, len\)\{[\s\S]*?\n\}\n/.exec(src) : null;
if (HAS_SERVER) assert.ok(m, 'attachRange not found in server.js');
const _ar = HAS_SERVER ? vm.runInNewContext(m[0] + '; attachRange') : null;
const test = HAS_SERVER ? nodeTest : nodeTest.skip;
const attachRange = (h, len) => { const r = _ar(h, len); return r && typeof r === 'object' ? { start: r.start, end: r.end } : r; };   // objects cross the vm boundary · copy them so deepEqual compares values

test('no header or empty file → whole file (200)', () => {
  assert.equal(attachRange(undefined, 100), undefined);
  assert.equal(attachRange('bytes=0-1', 0), undefined);
  assert.equal(attachRange('items=0-1', 100), undefined);
});
test("Safari probe 'bytes=0-1' and open-ended / suffix ranges", () => {
  assert.deepEqual(attachRange('bytes=0-1', 100), { start: 0, end: 1 });
  assert.deepEqual(attachRange('bytes=50-', 100), { start: 50, end: 99 });
  assert.deepEqual(attachRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(attachRange('bytes=0-500', 100), { start: 0, end: 99 }, 'end clamped to the file');
});
test('unsatisfiable → null (416)', () => {
  assert.equal(attachRange('bytes=100-', 100), null);
  assert.equal(attachRange('bytes=30-20', 100), null);
});
