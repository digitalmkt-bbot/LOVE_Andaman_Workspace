// Market Data ⑤ Sales & Agents / ⑥ Agents read the server's figures (99-ops-md-sales-load.js, §mdSrvSales in 08-app.js):
// one GET /v1/market-stats/sales-agents instead of paging a year of bookings (~70 × /v1/bookings/recent).
//   node --test test/unit/ops-md-sales-load.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const MD_SRC = fs.readFileSync('allotment_v2/js/ops/99-ops-md-sales-load.js', 'utf8');
const APP = fs.readFileSync('allotment_v2/js/08-app.js', 'utf8');
const fnSrc = (name) => { const a = APP.indexOf('function ' + name + '('); const b = APP.indexOf('\nfunction ', a + 10); return APP.slice(a, b); };

const ANSWER = {
  today: '2026-11-25', month: '2026-11', previous_month: '2026-10', active_from: '2026-10-27',
  totals: { val: 1000000, pax: 400, bk: 100, tot: 110, cancel: 10, no_show: 1, paid: 900000, ar: 100000 },
  sales: [{ id: 's1', val: 800000, pax: 300, bk: 80, tot: 85, cancel: 5, no_show: 0, paid: 760000, ar: 40000, cur: 300000, prev: 200000 }],
  agents: [{ id: 'a1', val: 600000, pax: 250, bk: 60, tot: 64, cancel: 4, no_show: 0, paid: 500000, ar: 100000, fam: { similan: 200, phiphi: 50 }, area: { 'pk-patong': 250 } }],
  active_agents: ['a1'],
  mix: { gross: 1100000, disc: -50000, extra: 10000, foc: 12, pax_all: 412, with_addon: 9, active_bk: 100,
    families: { similan: { name: 'Similan Islands', color: '#185fa5', pax: 300 } }, piers: { tublamu: 300 }, channels: { 'Invoice (credit)': 1000000 }, markets: { ru: 400 } },
};

function mdRuntime({ enabled = true, answer = ANSWER, tab = 'sales', real = false } = {}) {
  const gets = [], draws = [];
  const window = {
    laOps: { enabled: () => enabled, activeView: () => 'marketdata', onWrite() {}, fail() {},
      get: (p) => { gets.push(p); return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer); } },
    mdTabSales: () => 'SALES-HTML', mdTabAgents: () => 'AGENTS-HTML',
    mdNote: (t) => 'NOTE:' + t,
    renderMarketData: () => draws.push('draw'),
  };
  const ctx = { window, console, Date, Promise, Math, Object, Array, Number, String, Set, JSON, _mdTab: tab };
  if (real) {
    Object.assign(ctx, {
      SB_BOOKINGS: [], SB_AGENTS: [{ id: 'a1', name: 'Agent One', sales: 's1', market: 'ru' }, { id: 'a2', name: 'Dormant', sales: 's1' }], SB_MARKETS: [],
      sbSalesActive: () => [{ id: 's1', name: 'Khun Misha', color: '#f00', designation: 'Sales Executive' }],
      sbGetAgent: (id) => ctx.SB_AGENTS.find((a) => a.id === id) || null, mdFmt: (n) => String(Math.round(n || 0)), mdMarketName: (id) => id,
      _mdAgZone: false, bookingV2GetArea: () => null, mdNote: (t) => 'NOTE:' + t,
    });
    vm.createContext(ctx);
    vm.runInContext(fnSrc('mdTabSales') + '\n' + fnSrc('mdTabAgents') + '\nwindow.mdTabSales=mdTabSales; window.mdTabAgents=mdTabAgents;', ctx);
    vm.runInContext(MD_SRC, ctx);
    return { window: ctx.window, gets, draws };
  }
  vm.runInNewContext(MD_SRC, ctx);
  return { window, gets, draws };
}
const tick = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };

test('§mdSrvSales: one GET /v1/market-stats/sales-agents, a loading note, then the legacy tab drawn', async () => {
  const rt = mdRuntime();
  assert.match(rt.window.mdTabSales([]), /^NOTE:Loading the sales figures/);
  assert.deepEqual(rt.gets, ['/v1/market-stats/sales-agents']);
  await tick();
  assert.deepEqual(rt.draws, ['draw']);
  assert.equal(rt.window.mdTabSales([]), 'SALES-HTML');
  assert.equal(rt.window.mdTabAgents([]), 'AGENTS-HTML', 'the other tab reads the same answer');
  assert.equal(rt.gets.length, 1, 'kept a minute: no second read');
  assert.equal(rt.window._opsMdSales().totals.val, 1000000);
});

test('§mdSrvSales: a failed read says so once and does not loop; legacy mode reads nothing', async () => {
  const rt = mdRuntime({ answer: new Error('down') });
  rt.window.mdTabSales([]);
  await tick();
  assert.match(rt.window.mdTabSales([]), /could not load/);
  assert.equal(rt.gets.length, 1);
  const off = mdRuntime({ enabled: false });
  assert.equal(off.window.mdTabSales([]), 'SALES-HTML');
  assert.equal(off.gets.length, 0);
  assert.equal(off.window._opsMdSales(), null);
});

test('§mdSrvSales: legacy\'s own mdTabSales and mdTabAgents draw the server\'s figures with no booking loaded', async () => {
  const rt = mdRuntime({ real: true });
  rt.window.mdTabSales([]);
  await tick();
  const html = rt.window.mdTabSales([]);
  assert.match(html, /฿1\.00M/, 'Sales value: the server\'s total');
  assert.match(html, /100 bookings/, 'Pax sold and bookings');
  assert.match(html, /90%/, 'Collected = paid / (paid + AR)');
  assert.match(html, /1<span[^>]*>\/2<\/span>/, 'active agents: the server\'s list against the agents on file');
  assert.match(html, /Misha.*฿800k.*300.*80.*95%.*฿40k/s, 'the leaderboard row of the salesperson');
  assert.match(html, /\+50%/, 'MoM from cur / prev');
  assert.match(html, /Similan Islands/, 'product mix by programme');
  const agents = rt.window.mdTabAgents([]);
  assert.match(agents, /1 agents · 250 pax/);
  assert.match(agents, /Agent One/);
});
