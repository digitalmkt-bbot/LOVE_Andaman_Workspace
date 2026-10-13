import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE = fs.readFileSync('allotment_v2/js/ops/38-ops-attachments.js', 'utf8');

function boot({ enabled = true, fleet = null, globals = {}, setup = null } = {}) {
  const calls = [];
  const legacyCalls = [];
  const replies = [];
  const window = {
    laOps: { enabled: () => enabled, fleetDaily: fleet, fail: (t, e) => calls.push(['fail', t, e && e.message]) },
    fetch: (u, o) => { legacyCalls.push([u, o]); return Promise.resolve(new Response('legacy')); },
    laOpsFetch: (p, o) => { calls.push([p, o]); const r = replies.shift(); return Promise.resolve(r || new Response('{}', { status: 200 })); },
    open: (...a) => ({ opened: a }),
    ...globals,
  };
  const document = { readyState: 'complete', documentElement: {}, querySelectorAll: () => [], addEventListener() {} };
  const ctx = {
    window, document, console, Response, Promise, JSON, String, Array, Object, encodeURIComponent, decodeURIComponent, setTimeout,
    MutationObserver: class { observe() {} },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    ...globals,
  };
  window.window = window;
  if (setup) setup(window, ctx);
  vm.runInNewContext(SOURCE, ctx);
  return { window, calls, legacyCalls, replies, ctx };
}

test('upload maps dataB64 to data_b64 and name to filename', async () => {
  const t = boot();
  t.replies.push(new Response(JSON.stringify({ id: 'att_1', name: 'a.jpg', mime: 'image/jpeg', size: 3 }), { status: 201 }));
  const r = await t.window.fetch('/api/attach', { method: 'POST', body: JSON.stringify({ bookingId: 'b', filename: 'a.jpg', mime: 'image/jpeg', dataB64: 'QUJD' }) });
  const j = await r.json();
  assert.equal(t.calls[0][0], '/v1/attachments');
  assert.equal(t.calls[0][1].body, JSON.stringify({ filename: 'a.jpg', mime: 'image/jpeg', data_b64: 'QUJD' }));
  assert.equal(j.id, 'att_1');
  assert.equal(j.filename, 'a.jpg');
  assert.equal(j.error, undefined);
});

test('a refused upload surfaces as {error} so the legacy alert fires and no undefined id is stored', async () => {
  const t = boot();
  t.replies.push(new Response(JSON.stringify({ statusCode: 400, message: 'mime must be one of image/jpeg' }), { status: 400 }));
  const j = await (await t.window.fetch('/api/attach', { method: 'POST', body: '{}' })).json();
  assert.match(j.error, /mime must be/);
});

test('delete: 204 becomes parseable JSON; a 409 becomes {error}', async () => {
  const t = boot();
  t.replies.push(new Response(null, { status: 204 }));
  const ok = await (await t.window.fetch('/api/attach/att_1', { method: 'DELETE' })).json();
  assert.equal(t.calls[0][0], '/v1/attachments/att_1');
  assert.equal(t.calls[0][1].method, 'DELETE');
  assert.equal(ok.error, undefined);
  t.replies.push(new Response(JSON.stringify({ statusCode: 409, message: 'still on booking B1', code: 'attachment_in_use' }), { status: 409 }));
  const bad = await (await t.window.fetch('/api/attach/att_2', { method: 'DELETE' })).json();
  assert.equal(bad.code, 'attachment_in_use');
  assert.match(bad.error, /still on booking/);
});

test('GET goes to /v1/attachments/:id; other fetches and legacy mode are untouched', async () => {
  const t = boot();
  await t.window.fetch('/api/attach/att%201');
  assert.equal(t.calls[0][0], '/v1/attachments/att%201');
  await t.window.fetch('/api/mailimg/x');
  assert.equal(t.legacyCalls[0][0], '/api/mailimg/x');
  const off = boot({ enabled: false });
  await off.window.fetch('/api/attach', { method: 'POST', body: '{}' });
  assert.equal(off.legacyCalls[0][0], '/api/attach');
  assert.equal(off.calls.length, 0);
});

test('idsIn / rewriteHtml replace every attachment URL, including pdf canvas data attributes', () => {
  const { window } = boot();
  const A = window.laOpsAttachments;
  const html = '<img src="/api/attach/att_a"><canvas data-pdf="/api/attach/att_b%2F1"></canvas><img src="/api/attach/att_a">';
  assert.equal(JSON.stringify(A.idsIn(html)), JSON.stringify(['att_a', 'att_b/1']));
  const out = A.rewriteHtml(html, { att_a: 'blob:A', 'att_b/1': 'blob:B' });
  assert.equal(out, '<img src="blob:A"><canvas data-pdf="blob:B"></canvas><img src="blob:A">');
  assert.ok(!/api\/attach/.test(A.rewriteHtml(html, {})));
});

test('print wrapper hands the legacy function a stand-in window and writes rewritten HTML to the real one', async () => {
  const written = [];
  const real = { document: { write: (h) => written.push(h), close: () => written.push('closed') }, focus() {}, print() {} };
  let drove = null;
  const t = boot({
    setup(w, ctx) {
      w.open = () => real;
      w.pfmPrintReport = function () { const x = w.open('', '_blank'); x.document.write('<img src="/api/attach/att_z">'); x.document.close(); return x; };
      w._docPackDrive = function (x) { drove = x; };
    },
  });
  const stand = t.window.pfmPrintReport();
  assert.notEqual(stand, real);
  assert.equal(stand.__laReal, real);
  t.window._docPackDrive(stand);
  await stand.__laReady;
  assert.equal(written[0], '<img src="blob:x">');
  assert.equal(drove, real);
  assert.equal(t.window.open('', '_blank'), real);
});

test('fleet project document wrappers post attachment_id after the upload', async () => {
  const posted = [];
  const fleet = { projectDoc: (...a) => { posted.push(a); return Promise.resolve({}); } };
  const t = boot({
    fleet,
    setup(w, ctx) {
      const boom = () => { throw new Error('legacy path'); };
      w.flProjAttachToDoc = boom; w.flProjUpdateDocStatus = boom; w.flProjDeleteDoc = boom;
      ctx.confirm = () => true;
      ctx._flProjPickFiles = (accept, multi, cb) => cb([{ name: 'x.pdf' }]);
      ctx._flProjUploadAll = (files, projId, each, done) => { each({ id: 'att_9', name: 'x.pdf' }, files[0]); done(1); };
    },
  });
  t.window.flProjAttachToDoc('p1', 'dc_1');
  await new Promise((r) => setTimeout(r, 5));
  await t.window.flProjUpdateDocStatus('p1', 'dc_1', 'received');
  await t.window.flProjDeleteDoc('p1', 'dc_1');
  assert.equal(JSON.stringify(posted[0]), JSON.stringify(['PATCH', 'p1', 'dc_1', { attachment_id: 'att_9' }]));
  assert.equal(JSON.stringify(posted[1]), JSON.stringify(['PATCH', 'p1', 'dc_1', { status: 'received' }]));
  assert.equal(JSON.stringify(posted[2].slice(0, 3)), JSON.stringify(['DELETE', 'p1', 'dc_1']));
});

function slipBoot({ enabled = true, addSlips, inv } = {}) {
  const alerts = [], legacy = [], removed = [];
  const invoice = inv === undefined ? { id: 'inv_1', payments: [{ id: 'pay_old', method: 'cash', amount: 5, slips: [] }, { id: 'pay_1', method: 'transfer', amount: 10, slips: [{ id: 'att_old', name: 'o.jpg', mime: 'image/jpeg' }], recordedAt: 't' }, { id: 'pay_cr', method: 'credit', amount: 1, slips: [] }] } : inv;
  const money = { addPaymentSlips: (...a) => addSlips ? addSlips(...a) : Promise.resolve({}), removePaymentSlip: (...a) => { removed.push(a); return Promise.resolve({}); } };
  const t = boot({
    enabled,
    setup(w, ctx) {
      w.laOps.money = money;
      w.pfmSlipsAttach = (...a) => legacy.push(a);
      w.pfmSlipDelete = (...a) => legacy.push(['del', ...a]);
      w.pfmViewSlips = () => {};
      w.pfmSlipsRender = () => alerts.push('render');
      w.acctBookingInvoice = (id) => (id === 'B1' ? invoice : null);
      ctx.alert = (m) => alerts.push(m);
      ctx.confirm = () => true;
      ctx._pfmSlipBk = 'B1';
      ctx.SB_BOOKINGS = [{ id: 'B1' }];
      ctx.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,QUJD'; setTimeout(() => this.onload(), 0); } };
    },
  });
  return { ...t, alerts, legacy, removed, invoice };
}
const slipFile = { type: 'application/pdf', name: 'a.pdf', size: 3 };
const tick = () => new Promise((r) => setTimeout(r, 10));

test('pfmSlipsAttach uploads then adds the slip to the latest non-credit payment', async () => {
  const added = [];
  const t = slipBoot({ addSlips: (...a) => { added.push(a); return Promise.resolve({}); } });
  t.replies.push(new Response(JSON.stringify({ id: 'att_new', name: 'a.pdf' }), { status: 201 }));
  t.window.pfmSlipsAttach(slipFile, 'upload');
  await tick();
  assert.equal(t.calls[0][0], '/v1/attachments');
  assert.equal(JSON.stringify(added), JSON.stringify([['inv_1', 'pay_1', ['att_new']]]));
  assert.equal(t.calls.filter((c) => c[1] && c[1].method === 'DELETE').length, 0);
  assert.ok(t.alerts.includes('render'));
});

test('pfmSlipsAttach deletes the uploaded file when the server refuses the attach', async () => {
  const t = slipBoot({ addSlips: () => Promise.reject(new Error('refused')) });
  t.replies.push(new Response(JSON.stringify({ id: 'att_new', name: 'a.pdf' }), { status: 201 }));
  t.replies.push(new Response(null, { status: 204 }));
  t.window.pfmSlipsAttach(slipFile, 'upload');
  await tick();
  const del = t.calls.find((c) => c[1] && c[1].method === 'DELETE');
  assert.equal(del[0], '/v1/attachments/att_new');
  assert.ok(!t.alerts.includes('render'));
});

test('pfmSlipsAttach with no recorded payment uploads nothing', async () => {
  const t = slipBoot({ inv: { id: 'inv_1', payments: [] } });
  t.window.pfmSlipsAttach(slipFile, 'upload');
  await tick();
  assert.equal(t.calls.length, 0);
  assert.match(t.alerts[0], /Record a payment/);
});

test('pfmSlipsAttach and pfmSlipDelete fall back to legacy when operations mode is off', async () => {
  const t = slipBoot({ enabled: false });
  t.window.pfmSlipsAttach(slipFile, 'upload');
  t.window.pfmSlipDelete('att_old');
  assert.equal(t.legacy.length, 2);
  assert.equal(t.calls.length, 0);
});

test('pfmSlipDelete takes the slip off its payment first, then deletes the file', async () => {
  const t = slipBoot();
  t.replies.push(new Response(null, { status: 204 }));
  await t.window.pfmSlipDelete('att_old');
  assert.equal(JSON.stringify(t.removed), JSON.stringify([['inv_1', 'pay_1', 'att_old']]));
  assert.equal(t.calls[0][0], '/v1/attachments/att_old');
});
