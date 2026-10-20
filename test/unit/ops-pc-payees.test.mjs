import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, plain } from './fe-harness.mjs';

// FE-6: the petty-cash payee register and the claim's receipts are the server's (/v1/pier-cash/payees, rows/{id}/payee, claims/{id}/receipts).
const PRE = `
var _pcPyRow = 'row1', _pcPyQ = '', _pcPyTab = 'all', _pcPyCats = [], _pcPyImg = null, _pcPyUp = 0;
var PC_PY_CAT = [{k:'van',t:'รถตู้'},{k:'guide',t:'ไกด์'},{k:'lt',t:'หางยาว'},{k:'oth',t:'อื่น ๆ'}];
var kept = 0, closed = 0, printed = null, legacy = [];
function pcGuard(){ return true; } function pcKeep(){ kept++; } function ckReasonClose(){ closed++; } function pcPyAcc(){ return true; }
function pcPyCatT(k){ for(var i=0;i<PC_PY_CAT.length;i++) if(PC_PY_CAT[i].k===k) return PC_PY_CAT[i].t; return ''; }
function pcE(s){ return String(s==null?'':s); }
function mk(n){ return function(){ legacy.push(n); return 'legacy:' + n; }; }
var pcPyOf = mk('pcPyOf'), pcPyDB = mk('pcPyDB'), pcPyStats = mk('pcPyStats'), pcRcptCount = mk('pcRcptCount'), pcPyList = mk('pcPyList'),
  pcPySet = mk('pcPySet'), pcPySave = mk('pcPySave'), pcPyDel = mk('pcPyDel'), pcPrintReceipts = mk('pcPrintReceipts');
function pcPyPick(){ legacy.push('pcPyPick'); }
function pcClmGet(id){ return { id: id }; } function pcClmRows(){ return []; }
function pcPrintWin(title, fname, css, sheet, land){ printed = { title: title, fname: fname, sheet: sheet }; }
`;
const PAYEES = { payees: [
  { id: 'py_1', name: 'นายสมชาย ใจดี', vehicle: 'ลาภู', categories: ['van'], categories_guessed: false, uses: 3, suggested: true, has_id_no: true, has_id_card: false, id_no: '1234567890123', address: { no: '1', moo: '2', road: 'r', sub: 's', dist: 'd', prov: 'p' }, id_card_attachment_id: null },
  { id: 'py_2', name: 'Guide Ann', vehicle: '', categories: ['guide'], categories_guessed: true, uses: 0, suggested: false, has_id_no: false, has_id_card: false },
], counts: { all: 2, van: 1, guide: 1, lt: 0, oth: 0 }, row_category: 'van' };

function rt(handlers, globals = {}, enabled = true) {
  let els = {};
  const ctxEls = { 'pc-py-ls': { innerHTML: '' }, 'pc-py-tabs': { innerHTML: '' }, 'pc-py-add': { textContent: '' } };
  const r = runtime({ files: [], pre: PRE, handlers, enabled, globals: { document: { getElementById: (id) => ctxEls[id] || els[id] || null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} }, ...globals } });
  r.O.pierCashClaims = { state: { payee: {}, rcpt: {} } };
  r.O.wrote = () => {};
  r.load('99-ops-pc-payees.js');
  return { ...r, ctxEls, setEl: (id, v) => { els[id] = v; } };
}

test('a line\'s payee and a claim\'s receipt count come from the claim lines the server answered', () => {
  const r = rt({});
  const CL = r.O.pierCashClaims.state;
  CL.payee.row1 = { id: 'py_1', name: 'Somchai' }; CL.rcpt.c1 = { with_payee: 2, lines: 5 };
  assert.deepEqual(plain(r.ctx.pcPyOf({ id: 'row1' })), { id: 'py_1', name: 'Somchai' });
  assert.equal(r.ctx.pcPyOf({ id: 'row9' }), null);
  assert.deepEqual(plain(r.ctx.pcRcptCount('panwa', 'c1')), { n: 2, all: 5 });
});

test('the dialog list: asked for the line, the text and the tab; the server\'s suggested block, tabs, uses and ID flags are drawn', async () => {
  const r = rt({ 'GET /v1/pier-cash/payees': { body: PAYEES } });
  r.ctx.pcPyPick('row1');   // legacy shell stub; sets nothing but the flag
  r.ctx.pcPyList();
  await r.settle();
  assert.match(r.requests[0].path, /row_id=row1/);
  const html = r.ctxEls['pc-py-ls'].innerHTML;
  assert.match(html, /<div class="sec">แนะนำ<\/div><div class="o sug">/);
  assert.match(html, /ใช้ 3 ครั้ง/); assert.match(html, /เลขบัตร ✓/); assert.match(html, /ไม่มีเลขบัตร/);
  assert.match(r.ctxEls['pc-py-tabs'].innerHTML, /รถตู้ <i>1<\/i>/);
  assert.equal(r.ctx._pcPyTab, 'van', 'first open: the tab of the line\'s own category when someone is in it');
});

test('picking a payee links the line (PUT) and the chip reads it; unlinking sends null', async () => {
  const r = rt({ 'PUT /v1/pier-cash/rows/row1/payee': (b) => ({ body: { row_id: 'row1', payee: b.payee_id ? { id: b.payee_id, name: 'Somchai' } : null } }) });
  await r.ctx.pcPySet('py_1');
  assert.deepEqual(plain(r.requests[0].body), { payee_id: 'py_1' });
  assert.deepEqual(plain(r.ctx.pcPyOf({ id: 'row1' })), { id: 'py_1', name: 'Somchai' });
  assert.equal(r.ctx.closed, 1); assert.equal(r.ctx.kept, 1);
  await r.ctx.pcPySet('');
  assert.deepEqual(plain(r.requests[1].body), { payee_id: null });
  assert.equal(r.ctx.pcPyOf({ id: 'row1' }), null);
});

test('save: a new payee is POSTed with the identity fields (accounting) and then linked; a refusal is shown', async () => {
  const fields = { name: ' Somchai ', veh: 'Lapu', idno: '123', no: '1', moo: '', road: '', sub: '', dist: '', prov: 'Phuket' };
  const r = rt({ 'POST /v1/pier-cash/payees': { status: 201, body: { payee: { id: 'py_9', name: 'Somchai', categories: ['van'], uses: 0 } } }, 'PUT /v1/pier-cash/rows/row1/payee': { body: {} } });
  Object.keys(fields).forEach((k) => r.setEl('pc-py-' + k, { value: fields[k] }));
  r.ctx._pcPyCats = ['van']; r.ctx._pcPyImg = { id: 'att7' };
  await r.ctx.pcPySave('');
  assert.deepEqual(plain(r.requests[0].body), { name: 'Somchai', vehicle: 'Lapu', categories: ['van'], id_no: '123', address: { no: '1', moo: '', road: '', sub: '', dist: '', prov: 'Phuket' }, id_card_attachment_id: 'att7' });
  assert.deepEqual(plain(r.requests[1].body), { payee_id: 'py_9' });
  const bad = rt({ 'PATCH /v1/pier-cash/payees/py_1': { status: 403, body: { statusCode: 403, code: 'accounting_only', message: 'id_no can be set only with the accounting edit right' } } });
  Object.keys(fields).forEach((k) => bad.setEl('pc-py-' + k, { value: fields[k] }));
  await bad.ctx.pcPySave('py_1');
  assert.ok(bad.toasts.some((t) => /accounting edit right/.test(t.sub)));
  assert.equal(bad.ctx.closed, 0, 'the dialog stays');
});

test('delete confirms with the lines it will unlink; receipts are laid out from the server pages with the ID card path without the origin', async () => {
  const del = rt({ 'GET /v1/pier-cash/payees': { body: PAYEES }, 'DELETE /v1/pier-cash/payees/py_1': { status: 204 } });
  del.O.pierCashClaims.state.payee = { r1: { id: 'py_1', name: 'x' }, r2: { id: 'py_1', name: 'x' }, r3: { id: 'py_2', name: 'y' } };
  del.ctx.pcPyList(); await del.settle();   // the register learns py_1 from the list
  await del.ctx.pcPyDel('py_1');
  assert.ok(del.confirms.some((c) => /2 ledger line\(s\) will lose their payee/.test(c)), del.confirms.join("|"));
  assert.deepEqual(del.requests.map((q) => q.method), ['GET', 'DELETE']);
  assert.equal(del.O.pierCashClaims.state.payee.r3.id, "py_2", "only the deleted payee lines lose it");
  assert.equal(del.O.pierCashClaims.state.payee.r1, undefined);
  const R = { claim: { id: 'c1', name: 'Van 16 Oct', pier: 'panwa', date: '2026-10-16' }, company: { name_full: 'บริษัท เลิฟ ไอแลนด์ จำกัด', address: 'Phuket' }, skipped: 1, lines: 3,
    pages: [{ row_id: 'r1', date: '2026-10-16', date_th: '16/10/2569', description: 'ค่ารถตู้', amount: 1700, amount_display: '1,700.00', amount_text_th: 'หนึ่งพันเจ็ดร้อยบาทถ้วน',
      payee: { id: 'py_1', name: 'Somchai', id_no: '123', address: { no: '1', moo: '2', road: 'r', sub: 's', dist: 'd', prov: 'p' }, id_card: { id: 'a b', name: 'c.jpg', mime: 'image/jpeg' } } }] };
  const r = rt({ 'GET /v1/pier-cash/claims/c1/receipts': { body: R } });
  await r.ctx.pcPrintReceipts('c1');
  assert.ok(r.confirms.some((c) => /1 of 3 lines have no payee and will be skipped\.\nPrint the other 1\?/.test(c)));
  assert.equal(r.ctx.printed.fname, 'pettycash_receipts_panwa_2026-10-16_c1');
  const h = r.ctx.printed.sheet;
  assert.match(h, /16\/10\/2569/); assert.match(h, /1,700\.00/); assert.match(h, /หนึ่งพันเจ็ดร้อยบาทถ้วน/); assert.match(h, /บริษัท เลิฟ ไอแลนด์ จำกัด/);
  assert.match(h, /<img class="idc" src="\/api\/attach\/a%20b"/, 'no origin in front of /api/attach/');
  const empty = rt({ 'GET /v1/pier-cash/claims/c2/receipts': { status: 409, body: { statusCode: 409, code: 'no_payee', message: 'No line in this claim has a payee yet' } } });
  await empty.ctx.pcPrintReceipts('c2');
  assert.match(empty.alerts[0], /No line in this claim has a payee yet/);
  assert.equal(empty.ctx.printed, null);
});

test('ops off: legacy functions run', () => {
  const r = rt({}, {}, false);
  assert.equal(r.ctx.pcPyOf({ id: 'x' }), 'legacy:pcPyOf');
  assert.equal(r.ctx.pcPrintReceipts('c'), 'legacy:pcPrintReceipts');
});
