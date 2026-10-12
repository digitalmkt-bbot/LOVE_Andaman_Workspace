import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/29-ops-addon-types.js', 'utf8');

function runtime({ enabled = true, answers = {}, confirmAnswer = true, form = { en: 'National Park Fee', th: 'ค่าอุทยาน', model: 'perPax', unit: '' } } = {}) {
  const calls = [];
  const failures = [];
  const wrote = [];
  const legacyCalls = [];
  const SB_ADDON_TYPES = [{ key: 'old_fee', label: { en: 'Old fee', th: 'เก่า' }, model: 'flat', unit: 'per trip', builtin: false }];
  const rebuilds = [];
  const respond = async (method, path, body) => {
    calls.push({ method, path, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)) });
    const a = answers[method + ' ' + path];
    if (a instanceof Error) throw a;
    return a;
  };
  const elements = {
    'rtat-en': { value: form.en }, 'rtat-th': { value: form.th },
    'rtat-model': { value: form.model }, 'rtat-unit': { value: form.unit },
  };
  const window = {
    laOps: {
      enabled: () => enabled,
      get: (p) => respond('GET', p),
      post: (p, b) => respond('POST', p, b),
      del: (p) => respond('DELETE', p),
      queue: (fn) => Promise.resolve().then(fn),
      wrote: (k) => wrote.push(k),
      fail: (title, e) => failures.push({ title, message: e && e.message }),
    },
    rtAddonTypeCreate: () => { legacyCalls.push('create'); return 'legacy-create'; },
    rtAddonTypeDelete: () => { legacyCalls.push('delete'); return 'legacy-delete'; },
  };
  const ctx = {
    window, SB_ADDON_TYPES, console, Promise, Array, Object, Error, String,
    document: { getElementById: (id) => elements[id] || null },
    confirm: () => confirmAnswer,
    alert: () => {},
    rtRebuildAddonDefs: () => rebuilds.push(true),
    rtAddonTypesRenderBody: () => {},
  };
  vm.runInNewContext(SOURCE, ctx);
  return { window, calls, failures, wrote, legacyCalls, rebuilds, get SB_ADDON_TYPES() { return ctx.SB_ADDON_TYPES; } };
}

const plain = (x) => JSON.parse(JSON.stringify(x));

test('load maps server rows to the legacy shape and rebuilds the defs', async () => {
  const rt = runtime({ answers: { 'GET /v1/addon-types': { addon_types: [
    { key: 'national_park_fee', name: 'National Park Fee', name_th: 'ค่าอุทยาน', model: 'perPax', unit: 'per pax' },
  ] } } });
  await rt.window.laOps.addonTypes.load();
  assert.deepEqual(plain(rt.SB_ADDON_TYPES), [{ key: 'national_park_fee', label: { en: 'National Park Fee', th: 'ค่าอุทยาน' }, model: 'perPax', unit: 'per pax', builtin: false }]);
  assert.equal(rt.rebuilds.length, 1);
});

test('create posts the form, and the list changes only from the server answer', async () => {
  const rt = runtime({ answers: { 'POST /v1/addon-types': { key: 'national_park_fee', name: 'National Park Fee', name_th: 'ค่าอุทยาน', model: 'perPax', unit: 'per pax' } } });
  await rt.window.rtAddonTypeCreate();
  assert.deepEqual(rt.calls, [{ method: 'POST', path: '/v1/addon-types', body: { name: 'National Park Fee', name_th: 'ค่าอุทยาน', model: 'perPax', unit: 'per pax' } }]);
  assert.deepEqual(rt.SB_ADDON_TYPES.map((c) => c.key), ['old_fee', 'national_park_fee']);
  assert.deepEqual(rt.wrote, ['addon-types']);
});

test('a refused create leaves the list unchanged', async () => {
  const rt = runtime({ answers: { 'POST /v1/addon-types': Object.assign(new Error('bad model'), { code: 'bad' }) } });
  await rt.window.rtAddonTypeCreate();
  assert.deepEqual(rt.SB_ADDON_TYPES.map((c) => c.key), ['old_fee']);
  assert.equal(rt.failures.length, 1);
  assert.deepEqual(rt.wrote, []);
});

test('delete removes the type only after the server says yes', async () => {
  const rt = runtime({ answers: { 'DELETE /v1/addon-types/old_fee': null } });
  await rt.window.rtAddonTypeDelete('old_fee');
  assert.deepEqual(rt.calls.map((c) => c.method + ' ' + c.path), ['DELETE /v1/addon-types/old_fee']);
  assert.deepEqual(rt.SB_ADDON_TYPES, []);
});

test('an add-on in use is refused and the type stays', async () => {
  const rt = runtime({ answers: { 'DELETE /v1/addon-types/old_fee': Object.assign(new Error('in use by a booking'), { code: 'in_use' }) } });
  await rt.window.rtAddonTypeDelete('old_fee');
  assert.deepEqual(rt.SB_ADDON_TYPES.map((c) => c.key), ['old_fee']);
  assert.equal(rt.failures[0].message, 'in use by a booking');
});

test('legacy mode delegates create and delete and makes no API call', () => {
  const rt = runtime({ enabled: false });
  assert.equal(rt.window.rtAddonTypeCreate(), 'legacy-create');
  assert.equal(rt.window.rtAddonTypeDelete('x'), 'legacy-delete');
  assert.deepEqual(rt.legacyCalls, ['create', 'delete']);
  assert.deepEqual(rt.calls, []);
});
