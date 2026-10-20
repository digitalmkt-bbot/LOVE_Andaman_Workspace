import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runtime } from './fe-harness.mjs';

// The Executive Board adapter draws the server's answers. test/unit/fixtures/exec-board-answers.json holds real answers built by the
// backend's own domain functions (overview, salesPerformance, gapView, salesTargets, movement) from a small made-up week.
const A = JSON.parse(fs.readFileSync('test/unit/fixtures/exec-board-answers.json', 'utf8'));
const FILES = ['99-ops-exec-board.js', '99-ops-eb-overview.js', '99-ops-eb-sales.js', '99-ops-eb-gap.js', '99-ops-eb-move.js'];

function board(handlers) {
  const wrap = { innerHTML: '' }, style = [];
  const doc = {
    getElementById: (id) => (id === 'eb-wrap' ? wrap : id === 'eb-style' ? (style.length ? style[0] : null) : id === 'view-execboard' ? { classList: { contains: () => true } } : null),
    querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {},
    head: { appendChild: (s) => style.push(s) }, createElement: () => ({ style: {}, set textContent(v) { this._t = v; } }), body: { appendChild: () => {} }, hidden: false,
  };
  const rt = runtime({
    files: FILES, handlers, globals: { document: doc, scrollTo: () => {}, scrollX: 0, scrollY: 0, setInterval: () => 1, clearInterval: () => {}, localStorage: { getItem: () => null, setItem: () => {} }, _eb: undefined },
    pre: 'var window_eb = null;',
  });
  return { rt, wrap, style, EB: rt.ctx._eb };
}
const ans = (key) => ({ body: A[key] });
const H = {
  'GET /v1/exec-board/overview': (b, p) => ans(/period=today/.test(p) ? 'overview_today' : 'overview_month'),
  'GET /v1/exec-board/sales': (b, p) => ans(/kind=month/.test(p) ? 'sales_month' : 'sales_week'),
  'GET /v1/exec-board/sales-targets': ans('targets'),
  'GET /v1/exec-board/gap': ans('gap'),
  'GET /v1/exec-board/movement': ans('movement'),
  'GET /v1/exec-board/alloc/2026-10': ans('alloc'),
};
async function draw(b, set) {
  Object.assign(b.EB, set);
  b.rt.ctx.ebRender();
  assert.match(b.wrap.innerHTML, /กำลังโหลด/, 'a miss draws "loading" first');
  await b.rt.settle();
  return b.wrap.innerHTML;
}

test('every tab draws from its answer without a render error', async () => {
  const cases = [
    [{ tab: 'rev', per: 'today' }, [/ทริปวันนี้/, /รายได้ของทริปวันนี้/, /เอเย่นต์ที่ส่งยอดวันนี้/]],
    [{ tab: 'rev', per: 'month' }, [/คาดการณ์สิ้น/, /รายได้ตามโปรแกรม/, /ส่วนลดที่ให้ไป/]],
    [{ tab: 'sales', sp: 'week', off: 0 }, [/อันดับเซลส์/, /Sales One/, /แนวโน้ม 7 สัปดาห์/]],
    [{ tab: 'sales', sp: 'month', off: 0 }, [/เอเยนต์ทั้งหมด/, /Activation/]],
    [{ tab: 'tgt', stm: 'this' }, [/ทั้งทีมได้/, /คัดลอกสรุปส่งไลน์/]],
    [{ tab: 'gap', gp: 'h' }, [/ต้องหาอีก/, /เส้นทาง × วัน/, /ตัดสินใจเที่ยวนี้/, /ช่องว่างแบ่งให้เซลส์/]],
    [{ tab: 'move', mvd: '' }, [/ผู้โดยสารแยก Variant/, /Booking Movement · Today/, /7 วันข้างหน้า/, /ลำที่ต้องช่วย/]],
  ];
  for (const [set, wants] of cases) {
    const b = board(H);
    const html = await draw(b, set);
    assert.doesNotMatch(html, /Render error/, JSON.stringify(set) + ' ' + html.slice(0, 300));
    assert.doesNotMatch(html, /undefined|NaN|\[object/, JSON.stringify(set) + ' draws a missing field: ' + (html.match(/.{40}(undefined|NaN|\[object).{20}/) || [])[0]);
    for (const w of wants) assert.match(html, w, JSON.stringify(set));
    assert.equal(b.style.length, 1, 'the stylesheet is added once');
  }
});

test('the numbers on screen are the answer\'s', async () => {
  const b = board(H);
  let html = await draw(b, { tab: 'gap', gp: 'h' });
  assert.ok(html.includes('>' + A.gap.totals.gap.toLocaleString('en-US') + '</span> ที่นั่ง'), 'gap seats');
  b.EB.gx = 's1'; b.rt.ctx.ebRender(); html = b.wrap.innerHTML;
  assert.match(html, /eg-sx/, 'a salesperson row opens');
  const m = board(H); html = await draw(m, { tab: 'move' });
  assert.ok(html.includes(A.movement.label.full_th), 'the board day');
  assert.equal(m.rt.requests.find((r) => r.path.includes('/movement')).path.includes('date='), false, 'no date asked: the server answers tomorrow');
  const s = board(H); await draw(s, { tab: 'sales', sp: 'week', off: -2 });
  assert.match(s.rt.requests.find((r) => r.path.includes('/sales?')).path, /offset=-2/);
});

test('a refusal is drawn as the server\'s message, nothing from the browser', async () => {
  const b = board({ 'GET /v1/exec-board/overview': { status: 403, body: { statusCode: 403, code: 'forbidden', message: 'The Executive Board is for staff' } } });
  const html = await draw(b, { tab: 'rev', per: 'today' });
  assert.match(html, /The Executive Board is for staff/);
});

test('allocation window: load, save sends only the draft and the server\'s answer closes it', async () => {
  const sent = [];
  const b = board({ ...H, 'PUT /v1/exec-board/alloc/2026-10': (body) => { sent.push(body); return { body: { month: '2026-10' } }; } });
  const inputs = [{ dataset: { f: 'f1', s: 's1' }, value: '70' }, { dataset: { f: 'f1', s: 's2' }, value: '30' }, { dataset: { lf: 'f1' }, value: '90' }];
  const box = { querySelectorAll: (q) => (q.startsWith('input[data-f][data-s]') ? inputs.filter((i) => i.dataset.s) : q.startsWith('input[data-lf]') ? inputs.filter((i) => i.dataset.lf) : []), querySelector: () => null };
  const doc = b.rt.ctx.document, orig = doc.getElementById;
  doc.getElementById = (id) => (id === 'eb-alloc' ? box : id === 'eb-alloc-ov' ? { _A: A.alloc, remove: () => {} } : orig(id));
  b.rt.ctx.ebAllocSave('2026-10');
  await b.rt.settle();
  assert.deepEqual(sent, [{ shares: { f1: { s1: 70, s2: 30 } }, lf: {} }], 'a load factor equal to the default and not stored is not sent');
});

test('with ops off the legacy functions are called', async () => {
  const calls = [];
  const rt = runtime({ files: FILES, enabled: false, globals: { document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, hidden: false }, setInterval: () => 1, clearInterval: () => {},
    ebRender: () => calls.push('render'), ebSet: () => calls.push('set') } });
  rt.ctx.ebRender(); rt.ctx.ebSet('tab', 'gap');
  assert.deepEqual(calls, ['render', 'set']);
});
