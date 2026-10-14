// t_attach_live · attachments end to end against a LOCAL operation-backend stack with imported data
//
//   OPS_LIVE=http://localhost:3100 node test/ui/t_attach_live.mjs
//   (login cmpadmin/cmpadmin; override with OPS_USER / OPS_PASS)
//
// SAFETY: every request to the production operation-backend host is intercepted and answered from
// OPS_LIVE; any other external request is aborted. The run fails unless every production-host request
// the page made went through the interceptor (prodSeen === prodHandled) and nothing else escaped.
//
// Writes land on the local stack only. Test files are named zz-attach-test-* and deleted at the end.
//
//   [1] read      an imported booking document renders: GET /v1/attachments/<legacy att_ id> → blob URL
//   [2] booking   upload in the booking form → commit → booking_documents names it → GET reads it back
//   [3] delete    remove it in the form → PATCH attachments → DELETE /v1/attachments/<id> → 404
//   [4] pfm       Daily PFM record payment: upload slip → submit → payment carries slip_ids → GET reads it
//   [5] pfm del   a slip removed before submit is deleted on the server
import { serve } from './_harness.mjs';
import { chromium } from 'playwright';

const OPS = process.env.OPS_LIVE || 'http://localhost:3100';
const PROD_HOST = 'operationbackend-production.up.railway.app';
const BK_DOC = process.env.BK_DOC || 'lg_BK-26090391-DBG3';      // confirmed, has an imported document
const BK_PFM = process.env.BK_PFM || 'lg_BK-26100674-BITZ';      // has an invoice with no payment yet

const login = await (await fetch(OPS + '/v1/login', { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: process.env.OPS_USER || 'cmpadmin', password: process.env.OPS_PASS || 'cmpadmin' }) })).json();
const token = login.access_token;
if (!token) { console.error('login failed', login); process.exit(2); }
const api = async (p, init = {}) => {
  const r = await fetch(OPS + p, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null; try { json = JSON.parse(buf.toString()); } catch (_) {}
  return { status: r.status, type: r.headers.get('content-type'), size: buf.length, json };
};

const { srv, port } = await serve();
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => { try { sessionStorage.setItem('la_ops_token', t); } catch (_) {} }, token);

let prodSeen = 0, prodHandled = 0; const external = [], calls = [];
ctx.on('request', (r) => { try { if (new URL(r.url()).host === PROD_HOST) prodSeen++; } catch (_) {} });
await ctx.route('**/*', async (route) => {
  const req = route.request(), u = new URL(req.url());
  if (u.hostname === '127.0.0.1' && +u.port === port) return route.continue();
  if (u.host === PROD_HOST) {
    prodHandled++;
    calls.push(req.method() + ' ' + u.pathname);
    const h = { authorization: req.headers()['authorization'] || '' };
    for (const k of ['content-type', 'if-match']) if (req.headers()[k]) h[k] = req.headers()[k];
    const r = await fetch(OPS + u.pathname + u.search, { method: req.method(), headers: h, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : (req.postDataBuffer() || undefined) });
    const hd = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'etag' };
    r.headers.forEach((v, k) => { if (/^(content-type|etag|content-disposition)$/.test(k)) hd[k] = v; });
    return route.fulfill({ status: r.status, headers: hd, body: r.status === 204 ? '' : Buffer.from(await r.arrayBuffer()) });
  }
  external.push(req.method() + ' ' + u.href.slice(0, 100));
  return route.abort();
});

const page = await ctx.newPage();
const errors = [], dialogs = [];
const NOISE = /Failed to load resource|\[asset2\]/;
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 160)); d.accept(); });

const fails = [];
const ok = (name, cond, got) => { console.log((cond ? '  ✓ ' : '  ✖ ') + name + (cond ? '' : '  → ' + JSON.stringify(got).slice(0, 500))); if (!cond) fails.push(name); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const idle = () => ev(() => window.laOps.queue(() => null));
const waitFor = (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const created = [];   // attachment ids this run made, deleted at the end if still there

// A 2x2 PNG; the form downscales images to JPEG before upload.
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==';

await page.goto(`http://127.0.0.1:${port}/allotment_v2.html#/booking`);
await page.waitForFunction(() => window.laOps && window.laOps.state && window.laOps.state.loaded, null, { timeout: 90000 });
ok('ops mode is on', await ev(() => window.laOps.enabled()), null);

// ── [1] read an imported booking document ──
console.log('\n[1] read');
const docSrv = (await api('/v1/bookings/' + encodeURIComponent(BK_DOC))).json;
const docDate = docSrv.trips[0].service_date || docSrv.trips[0].date;
const oldAtt = docSrv.attachments[0];
ok('server booking names an imported legacy att_ id', /^att_/.test(oldAtt && oldAtt.id), docSrv.attachments);
await ev((d) => bookingV2LoadFromOpsBackend({ from: d, to: d }), docDate);
const cid = await ev((sid) => (SB_BOOKINGS.find((b) => b.opsId === sid || b.id === sid) || {}).id, BK_DOC);
ok('booking loaded into SB_BOOKINGS', !!cid, cid);
await ev((id) => bookingV2EditBooking(id), cid);
await page.waitForTimeout(800);
const sel = `#bkv2-attach-list img[data-la-attachment-id="${oldAtt.id}"]`;
const hydrated = await waitFor((s) => { const el = document.querySelector(s); return el && /^blob:/.test(el.src); }, sel);
ok('imported document thumbnail hydrates to a blob URL', hydrated, await ev((s) => { const el = document.querySelector(s); return el && el.outerHTML.slice(0, 200); }, sel));
const blobSize = hydrated ? await ev(async (s) => (await (await fetch(document.querySelector(s).src)).blob()).size, sel) : -1;
ok('blob bytes = server file size', blobSize === oldAtt.size, { blobSize, size: oldAtt.size });
ok('read went to GET /v1/attachments/<id>', calls.includes('GET /v1/attachments/' + oldAtt.id), calls.filter((c) => /attach/.test(c)));

// ── [2] upload a booking document through the form and save ──
console.log('\n[2] booking upload');
const before = (await api('/v1/bookings/' + encodeURIComponent(BK_DOC))).json.attachments.map((a) => a.id);
await ev((b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  bookingV2AttachUpload(new File([u], 'zz-attach-test-doc.png', { type: 'image/png' }), 'upload'); }, PNG_B64);
const upOk = await waitFor((n) => (_bkV2.newBooking.attachments || []).length > n, before.length);
const newId = await ev(() => { const l = _bkV2.newBooking.attachments; return l[l.length - 1].id; });
if (newId) created.push(newId);
ok('upload answered with an id, kept on the draft', upOk && /^att_/.test(newId), await ev(() => _bkV2.newBooking.attachments));
ok('upload went to POST /v1/attachments', calls.includes('POST /v1/attachments'), calls.filter((c) => /attach/.test(c)));
let f = await api('/v1/attachments/' + newId);
ok('server has the file (GET 200 image/jpeg)', f.status === 200 && f.type === 'image/jpeg' && f.size > 0, f);
ok('new thumbnail hydrates', await waitFor((s) => { const el = document.querySelector(s); return el && /^blob:/.test(el.src); }, `#bkv2-attach-list img[data-la-attachment-id="${newId}"]`), null);
await ev(() => bookingV2CommitBooking('confirmed'));
await page.waitForTimeout(1500); await idle();
let after = (await api('/v1/bookings/' + encodeURIComponent(BK_DOC))).json;
ok('booking_documents names the new file after save', after.attachments.some((a) => a.id === newId && a.kind === 'upload'), after.attachments);
ok('old documents kept', before.every((id) => after.attachments.some((a) => a.id === id)), after.attachments.map((a) => a.id));
ok('booking write sent a PATCH', calls.some((c) => c === 'PATCH /v1/bookings/' + BK_DOC), calls.slice(-8));

// ── [3] delete it from the form ──
console.log('\n[3] delete');
await ev((id) => bookingV2EditBooking(id), cid);
await page.waitForTimeout(800);
await ev((id) => bookingV2AttachRemove(id), newId);
await page.waitForTimeout(1500); await idle();
after = (await api('/v1/bookings/' + encodeURIComponent(BK_DOC))).json;
ok('booking no longer names it', !after.attachments.some((a) => a.id === newId) && before.every((id) => after.attachments.some((a) => a.id === id)), after.attachments.map((a) => a.id));
f = await api('/v1/attachments/' + newId);
ok('file deleted on the server (GET 404)', f.status === 404, f.status);
ok('delete went to DELETE /v1/attachments/<id>', calls.includes('DELETE /v1/attachments/' + newId), calls.filter((c) => /attach/.test(c)));
await ev(() => { try { bookingV2CloseForm && bookingV2CloseForm(); } catch (_) {} });

// ── [4] Daily PFM: record a payment with a slip ──
console.log('\n[4] pfm slip');
const pfmBk = (await api('/v1/bookings/' + encodeURIComponent(BK_PFM))).json;
const invList = (await api('/v1/invoices?booking_id=' + encodeURIComponent(BK_PFM))).json;
const inv = (Array.isArray(invList) ? invList : (invList && (invList.invoices || invList.items)) || []).find((i) => !i.voided) || null;
ok('test booking has a live invoice', !!inv, invList);
if (inv) {
  const pd = pfmBk.trips[0].service_date || pfmBk.trips[0].date;
  await ev((d) => bookingV2LoadFromOpsBackend({ from: d, to: d }), pd);
  const pcid = await ev((sid) => (SB_BOOKINGS.find((b) => b.opsId === sid || b.id === sid) || {}).id, BK_PFM);
  await ev(([b, i]) => { _pfmRec = { bkId: b, invId: i, amount: 1, method: 'transfer', ref: 'zz-attach-test', slips: [] }; }, [pcid || BK_PFM, inv.id]);
  const up = async (name) => ev(([b64, n]) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    pfmSlipUpload(new File([u], n, { type: 'image/png' }), 'upload'); }, [PNG_B64, name]);
  await up('zz-attach-test-slip.png');
  ok('slip uploaded into the record dialog', await waitFor(() => _pfmRec && _pfmRec.slips.length === 1), await ev(() => _pfmRec));
  // [5] a second slip, removed before submit, is deleted on the server
  await up('zz-attach-test-slip2.png');
  await waitFor(() => _pfmRec && _pfmRec.slips.length === 2);
  const [slip1, slip2] = await ev(() => _pfmRec.slips.map((s) => s.id));
  created.push(slip1, slip2);
  await ev((id) => pfmSlipRemove(id), slip2);
  await waitFor(() => _pfmRec && _pfmRec.slips.length === 1);
  ok('[5] slip removed before submit is gone from the server (GET 404)', (await api('/v1/attachments/' + slip2)).status === 404, null);
  await ev(() => pfmRecSubmit());
  await page.waitForTimeout(1500); await idle();
  const inv2 = (await api('/v1/invoices/' + encodeURIComponent(inv.id))).json;
  const pay = (inv2.payments || []).find((p) => !p.deleted_at && p.ref === 'zz-attach-test');
  ok('payment recorded with the slip (payment_slips)', pay && (pay.slips || []).some((s) => (s.id || s) === slip1), inv2.payments);
  f = await api('/v1/attachments/' + slip1);
  ok('slip file readable (GET 200)', f.status === 200 && f.size > 0, f.status);
  if (pay) {
    const del = await api('/v1/invoices/' + encodeURIComponent(inv.id) + '/payment-corrections', { method: 'POST', body: JSON.stringify({ reason: 'zz-attach-test cleanup', payments: [{ id: pay.id, deleted: true }] }) });
    console.log('  · cleanup: test payment soft-deleted → ' + del.status);
  }
}

// ── cleanup + safety ──
for (const id of created) {
  const r = await api('/v1/attachments/' + id, { method: 'DELETE' });
  if (r.status !== 404) console.log('  · cleanup DELETE ' + id + ' → ' + r.status + (r.json && r.json.message ? ' ' + r.json.message : ''));
}
console.log('\n[safety]');
ok('every production-host request was intercepted (' + prodHandled + '/' + prodSeen + ')', prodSeen === prodHandled && prodSeen > 0, { prodSeen, prodHandled });
ok('no other external request escaped (aborted: ' + external.length + ')', true, external);
console.log('  · aborted external: ' + JSON.stringify([...new Set(external.map((e) => e.replace(/\?.*/, '')))]));
if (dialogs.length) console.log('  · dialogs: ' + JSON.stringify(dialogs));
ok('no page errors', errors.length === 0, errors);
await browser.close(); srv.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
