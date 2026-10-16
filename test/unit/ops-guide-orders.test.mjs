import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/* vm tests for ops/62-ops-guide-orders.js (+ the config store it builds on) · laOps is stubbed,
   nothing here reaches a network. GUIDE_ORDERS_FILE swaps the file under test (fail-without proofs). */
const store61 = fs.readFileSync('allotment_v2/js/ops/61-ops-config-store.js', 'utf8');
const source = fs.readFileSync(process.env.GUIDE_ORDERS_FILE || 'allotment_v2/js/ops/62-ops-guide-orders.js', 'utf8');
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

function harness({ enabled = true, agent = false, failIssueFor = null, orders = {}, nextNo = 41, denyPut = null } = {}) {
  const calls = [], local = [], errors = [], opened = [], printed = [], closed = [], asked = [];
  let chain = Promise.resolve();
  const srv = {
    orders: { ...orders },                       // 'date|bid' -> view
    settings: { next_no: nextNo, highest_issued: null, signers: [{ name: 'S1', title: 'T1' }], head: { en: 'LOVE' } },
    guides: { key: 'guides', value: [{ id: 'g1', name: 'A' }], saved: true, version: 1 },
  };
  const view = (date, bid) => {
    const r = srv.orders[date + '|' + bid];
    return { date, boat_id: bid, guide_ids: r ? r.guide_ids : [], other_count: r ? r.other_count : 0, signer_index: r ? r.signer_index : 0,
      order_no: r ? r.order_no : null, recorded: !!r };
  };
  const ctx = {
    console, Promise, setTimeout, clearTimeout, Date,
    document: { querySelector: () => null }, _pckDate: '2026-11-02',
    ctRead(k) { local.push(['read', k]); return { legacy: true }; },
    ctWrite(k, v) { local.push(['write', k, v]); },
    goAsn(d, b) { local.push(['goAsn', d, b]); return { g: ['legacy'], other: 0, sign: 0 }; },
    goAsnSet(d, b, o) { local.push(['goAsnSet', d, b, o]); },
    goNoFor(d, b, issue) { local.push(['goNoFor', d, b, issue]); return 'legacy-no'; },
    goPrint(b) { local.push(['goPrint', b]); },
    goPrintIds: (b) => (b === 'all' ? ['b1', 'b2', 'b3'] : [b]),
    goPrintAsk: (d, ids) => { asked.push(ids.length); return ctx.__ask !== false; },
    goPrintOpen: (b, d, ids, w) => { printed.push({ ids, w, nos: ids.map(k => ctx.goNoFor(d, k, true)) }); },
    pjGdBusy: (d) => { local.push(['pjGdBusy', d]); return Object.keys(ctx.ctRead('go_asn') || {}); },
    goSetupOpen: (b) => { local.push(['goSetupOpen', b, ctx._pckDate]); },
    goRegOpen: () => { local.push(['goRegOpen']); },
    pckGuideJobOrder: (b) => { local.push(['pckGuideJobOrder', b, ctx._pckDate]); },
    nav() {},
    open: () => { const w = { close: () => closed.push(1) }; opened.push(w); return w; },
  };
  ctx.window = ctx;
  if (agent) ctx.LA_ME = { agentId: 'ag_1' };
  ctx.laOps = {
    enabled: () => enabled, state: { loaded: false }, busy: () => false, clone,
    fail: (t, e) => errors.push([t, e.message, e.code]),
    onWrite() {}, wrote() {},
    get: async (p, q) => {
      calls.push(['GET', p, q]);
      if (p === '/v1/guide-orders') return { date: q.date, orders: Object.entries(srv.orders).filter(([k]) => k.startsWith(q.date + '|')).map(([k]) => view(q.date, k.split('|')[1])) };
      if (p === '/v1/guide-orders/settings') return clone(srv.settings);
      if (p === '/v1/config') return { entries: [srv.guides] };
      if (p === '/v1/reports/daily/settings') return { van_cost: 1, van_quota: 1, target_per_pax: 1 };
      throw new Error('unexpected GET ' + p);
    },
    post: async (p, b) => ctx.laOps.call('POST', p, b === undefined ? {} : b),
    queue(fn) { const pr = chain.then(fn); chain = pr.catch(() => {}); return pr; },
    call: async (m, p, body) => {
      calls.push([m, p, body]);
      let x;
      if ((x = /^\/v1\/guide-orders\/([^/]+)\/([^/]+)\/issue$/.exec(p))) {
        if (failIssueFor === x[2]) throw Object.assign(new Error('issue refused'), { status: 500 });
        const key = x[1] + '|' + x[2];
        srv.orders[key] = srv.orders[key] || { guide_ids: [], other_count: 0, signer_index: 0, order_no: null };
        if (!srv.orders[key].order_no) srv.orders[key].order_no = srv.settings.next_no++;
        return view(x[1], x[2]);
      }
      if ((x = /^\/v1\/guide-orders\/([^/]+)\/([^/]+)$/.exec(p)) && x[2] !== 'settings') {
        if (denyPut) throw Object.assign(new Error(denyPut), { status: 403 });
        if ('order_no' in body) throw Object.assign(new Error('order_no is the server\'s'), { status: 400 });
        const key = x[1] + '|' + x[2], was = srv.orders[key];
        srv.orders[key] = { ...body, order_no: was ? was.order_no : null };
        return view(x[1], x[2]);
      }
      if (p === '/v1/guide-orders/settings') {
        if (ctx.__denySettings) { const d = ctx.__denySettings; ctx.__denySettings = null; throw Object.assign(new Error(d.message), d); }
        Object.assign(srv.settings, body); return clone(srv.settings);
      }
      throw new Error('unexpected ' + m + ' ' + p);
    },
  };
  vm.createContext(ctx);
  vm.runInContext(store61, ctx); vm.runInContext(source, ctx);
  return { ctx, calls, local, errors, opened, closed, printed, asked, srv, flush: () => ctx.laOps.guideOrders && ctx.laOps.guideOrders.flushSettings() };
}
const tick = () => new Promise(r => setTimeout(r, 5));
const D = '2026-11-02';
const J = v => JSON.stringify(v);
const posts = h => h.calls.filter(c => c[0] === 'POST').map(c => c[1]);
const puts = h => h.calls.filter(c => c[0] === 'PUT' && /guide-orders\/20/.test(c[1]));

test('goAsn: reads the day from GET /v1/guide-orders?date= (legacy shape), not from the blob', async () => {
  const h = harness({ orders: { [D + '|b1']: { guide_ids: ['g1', 'g2'], other_count: 2, signer_index: 1, order_no: 7 } } });
  assert.equal(J(h.ctx.goAsn(D, 'b1')), J({ g: [], other: 0, sign: 0 }), 'first read: blank, load started');
  await tick();
  assert.equal(h.calls.filter(c => c[1] === '/v1/guide-orders').length, 1);
  assert.equal(h.calls.find(c => c[1] === '/v1/guide-orders')[2].date, D);
  assert.equal(J(h.ctx.goAsn(D, 'b1')), J({ g: ['g1', 'g2'], other: 2, sign: 1 }));
  assert.equal(J(h.ctx.goAsn(D, 'b9')), J({ g: [], other: 0, sign: 0 }), 'an unsaved boat reads blank');
  assert.equal(h.local.filter(l => l[0] === 'goAsn').length, 0, 'the legacy blob reader is never called');
});

test('goAsnSet: sends the whole record, never an order_no, shows at once, and keeps the number it had', async () => {
  const h = harness({ orders: { [D + '|b1']: { guide_ids: [], other_count: 0, signer_index: 0, order_no: 7 } } });
  h.ctx.goAsn(D, 'b1'); await tick();
  const p = h.ctx.goAsnSet(D, 'b1', { g: ['g1'], other: 3, sign: 1 });
  assert.equal(J(h.ctx.goAsn(D, 'b1')), J({ g: ['g1'], other: 3, sign: 1 }), 'optimistic');
  await p;
  const put = puts(h)[0];
  assert.equal(put[1], '/v1/guide-orders/' + D + '/b1');
  assert.equal(J(put[2]), J({ guide_ids: ['g1'], other_count: 3, signer_index: 1 }));
  assert.equal('order_no' in put[2], false);
  assert.equal(h.ctx.goNoFor(D, 'b1', false), 7, 'the number survives a re-save');
  assert.equal(h.local.filter(l => l[0] === 'goAsnSet').length, 0);
});

test('goAsnSet: a refused save puts the old assignment back and shows the server message', async () => {
  const h = harness({ orders: { [D + '|b1']: { guide_ids: ['g1'], other_count: 0, signer_index: 0, order_no: null } }, denyPut: 'You may not edit guide orders' });
  h.ctx.goAsn(D, 'b1'); await tick();
  await h.ctx.goAsnSet(D, 'b1', { g: ['g1', 'g2'], other: 0, sign: 0 });
  assert.equal(J(h.ctx.goAsn(D, 'b1').g), J(['g1']));
  assert.equal(h.errors[0][1], 'You may not edit guide orders');
});

test('goPrint all: one issue per boat, in order, before the sheets; numbers come from the server', async () => {
  const h = harness({ nextNo: 41 });
  await h.ctx.goPrint('all'); await tick();
  assert.equal(J(posts(h)), J(['/v1/guide-orders/' + D + '/b1/issue', '/v1/guide-orders/' + D + '/b2/issue', '/v1/guide-orders/' + D + '/b3/issue']));
  assert.equal(h.printed.length, 1);
  assert.equal(J(h.printed[0].nos), J([41, 42, 43]), 'the sheets are drawn with the issued numbers');
  assert.equal(h.local.filter(l => l[0] === 'goPrint').length, 0, 'the legacy print (which numbered inside the renderer) is not used');
  assert.equal(h.local.filter(l => l[0] === 'goNoFor').length, 0);
});

test('goPrint: a reprint asks for no new numbers; goNoFor(issue=true) never makes one', async () => {
  const h = harness();
  await h.ctx.goPrint('b1'); await tick();
  const before = posts(h).length;
  await h.ctx.goPrint('b1'); await tick();
  assert.equal(posts(h).length, before, 'second print: no POST');
  assert.equal(J(h.printed.map(p => p.nos)), J([[41], [41]]), 'same number both times');
  assert.equal(h.ctx.goNoFor(D, 'b2', true), null, 'asking for a number while drawing does not make one');
  assert.equal(h.srv.settings.next_no, 42, 'the counter is the server\'s: one boat issued, one step');
});

test('goPrint: the pop-up window is opened first when the print must wait on the server, and used', async () => {
  const h = harness();
  await h.ctx.goPrint('b1'); await tick();
  assert.equal(h.opened.length, 1);
  assert.equal(h.printed[0].w, h.opened[0]);
});

test('goPrint: a refused issue prints nothing, closes the window and says why', async () => {
  const h = harness({ failIssueFor: 'b2' });
  await h.ctx.goPrint('all'); await tick();
  assert.equal(h.printed.length, 0);
  assert.equal(h.closed.length, 1);
  assert.equal(h.errors[0][1], 'issue refused');
  assert.match(h.errors[0][0], /nothing printed/);
});

test('goPrint: answering "no" to the missing-guide question issues no number', async () => {
  const h = harness(); h.ctx.__ask = false;
  await h.ctx.goPrint('all'); await tick();
  assert.equal(posts(h).length, 0); assert.equal(h.printed.length, 0); assert.equal(h.closed.length, 1);
});

test('goPrint: a save made just before is sent before the number is asked for', async () => {
  const h = harness();
  h.ctx.goAsn(D, 'b1'); await tick();
  h.ctx.goAsnSet(D, 'b1', { g: ['g1'], other: 0, sign: 0 });
  await h.ctx.goPrint('b1'); await tick();
  const order = h.calls.filter(c => c[0] === 'PUT' || c[0] === 'POST').map(c => c[0]);
  assert.equal(J(order), J(['PUT', 'POST']));
});

test('settings: go_cfg reads GET /v1/guide-orders/settings as {next, signers, head}', async () => {
  const h = harness({ nextNo: 41 }); await tick();
  const c = h.ctx.ctRead('go_cfg');
  assert.equal(c.next, 41); assert.equal(c.signers[0].name, 'S1'); assert.equal(c.head.en, 'LOVE');
  assert.equal(h.local.length, 0);
});

test('settings: changing the next number sends only next_no; 409 number_used shows the server message and puts it back', async () => {
  const h = harness({ nextNo: 41 }); await tick();
  const c = h.ctx.ctRead('go_cfg'); c.next = 50; h.ctx.ctWrite('go_cfg', c); await h.flush();
  const put = h.calls.find(x => x[0] === 'PUT' && x[1] === '/v1/guide-orders/settings');
  assert.equal(J(put[2]), J({ next_no: 50 }));
  assert.equal(h.ctx.ctRead('go_cfg').next, 50);

  h.ctx.__denySettings = { message: 'Number 3 is already used: orders up to 49 have been issued', status: 409, code: 'number_used' };
  const c2 = h.ctx.ctRead('go_cfg'); c2.next = 3; h.ctx.ctWrite('go_cfg', c2); await h.flush();
  assert.equal(h.ctx.ctRead('go_cfg').next, 50, 'back to what the server holds');
  assert.equal(h.errors[0][1], 'Number 3 is already used: orders up to 49 have been issued');
  assert.equal(h.errors[0][2], 'number_used');
});

test('settings: removing the last signer is refused by the server in legacy\'s Thai words, shown as they are, and the signer returns', async () => {
  const h = harness(); await tick();
  const thai = 'ต้องเหลือผู้ลงนามอย่างน้อย 1 คน (signers needs at least one)';
  h.ctx.__denySettings = { message: thai, status: 400 };
  const c = h.ctx.ctRead('go_cfg'); c.signers = []; h.ctx.ctWrite('go_cfg', c); await h.flush();
  assert.equal(h.errors[0][1], thai);
  assert.equal(h.ctx.ctRead('go_cfg').signers.length, 1);
});

test('pjGdBusy: loads the day first and the legacy reader sees the server assignments through go_asn', async () => {
  const h = harness({ orders: { [D + '|b1']: { guide_ids: ['g1'], other_count: 0, signer_index: 0, order_no: null } } });
  assert.equal(h.ctx.pjGdBusy(D).length, 0);
  await tick();
  assert.equal(J(h.ctx.pjGdBusy(D)), J([D + '|b1']));
});

test('screens that need the data wait for it and run on the date they were asked for', async () => {
  const h = harness();
  h.ctx._pckDate = D;
  h.ctx.goSetupOpen('b1'); h.ctx._pckDate = '1999-01-01';       // the caller puts its own date back at once
  await tick();
  const run = h.local.find(l => l[0] === 'goSetupOpen');
  assert.equal(run[2], D);
  assert.equal(h.ctx._pckDate, '1999-01-01');
});

test('agent logins and legacy mode: the legacy local functions run, no server call', async () => {
  const ag = harness({ agent: true }); await tick();
  assert.equal(ag.calls.length, 0);
  ag.ctx.goAsn(D, 'b1'); ag.ctx.goPrint('b1'); assert.equal(ag.calls.length, 0);
  assert.equal(ag.local.filter(l => l[0] === 'goAsn' || l[0] === 'goPrint').length, 2);
  const off = harness({ enabled: false }); await tick();
  assert.equal(off.ctx.goNoFor(D, 'b1', true), 'legacy-no'); assert.equal(off.calls.length, 0);
});
