// §bopFree · Boat Operation · แถว "เรือว่าง · ยังไม่จัด" ในตาราง  ·  §bsCalPier · ปฏิทินเรือบอกท่ารายวัน
//
// ที่มา (2026-10-03) · ผู้ใช้ส่งภาพหน้า Boat Operation กับหน้า Boat Status
//   "1 ในตัว Matrix จะทำยังไงให้เห็นว่าเรือว่างที่ยังไม่ Deploy มีอะไรบ้าง"
//   "2 ปฏิทินของเรือ ระบุด้วยว่าอยู่ที่ท่าเรือไหน วันนั้น ๆ"
//   ของเดิม ข้อ 1 ต้องกดเลือกทีละวันแล้วอ่านรายการ AVAILABLE ทางขวา · ข้อ 2 สีบอกแค่สถานะ ไม่บอกท่า
//
// กันเก้าอย่าง
//   1 ตารางเดือน · ทุกกลุ่มท่าที่มีเส้นทาง มีแถว "เรือว่าง · ยังไม่จัด" ครบทุกวัน
//   2 จำนวนและชื่อเรือในแต่ละช่อง ตรงกับรายการ AVAILABLE ของวันนั้น (กติกาเดียวกัน) แยกตามท่าที่เรืออยู่วันนั้น
//   3 เรือที่วางบนเส้นทางแล้ว / ไม่พร้อมใช้ ไม่อยู่ในแถวนี้
//   4 วางเรือว่างลงเส้นทางหนึ่งวัน · ช่องของวันนั้นลดลงหนึ่งลำ ชื่อหายไป
//   5 กดช่อง = เลือกวันนั้น · ชี้ค้างเห็นชื่อเรือกับความจุ
//   6 มุมมองสัปดาห์ · ช่องเขียนชื่อเรือให้เลย
//   7 ปฏิทินเรือ · ทุกวันมีป้ายท่า ตรงกับ getBoatCurrentPier ของวันนั้น
//   8 ย้ายท่าช่วงหนึ่งของเดือน · ป้ายในช่วงนั้นเปลี่ยน นอกช่วงเท่าเดิม
//   9 ไม่มี error บนหน้า
import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });
await goView(page, 'operation', 1200);

const read = () => page.evaluate(() => [...document.querySelectorAll('#view-operation [data-bopfree]')].map(c => ({ pier: c.dataset.bopfree, d: c.dataset.date, n: +c.dataset.n, names: c.dataset.names ? c.dataset.names.split('|') : [], txt: c.textContent.trim(), title: c.title })));
const S = await page.evaluate(async () => {
  /* เดือนที่มีเรือวางอยู่มากที่สุด */
  const cnt = {}; Object.keys(TRIPS || {}).forEach(d => { const m = d.slice(0, 7); cnt[m] = (cnt[m] || 0) + Object.values(TRIPS[d] || {}).filter(o => o && !Array.isArray(o) && o.route).length; });
  const ym = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  _bop2.pier = 'all'; _bop2.selDate = ym + '-15'; if (typeof bop2SetViewMode === 'function') bop2SetViewMode('month'); else { _bop2.viewMode = 'month'; renderOp(); }
  await new Promise(z => setTimeout(z, 600));
  const labels = [...document.querySelectorAll('#view-operation [data-bopfree-label]')].map(x => x.dataset.bopfreeLabel);
  const heads = [...document.querySelectorAll('#view-operation .bop2-cell-pier')].map(x => x.textContent.trim());
  return { ym, labels, heads, days: document.querySelectorAll('#view-operation .bo-day-h').length };
});
const C = await read();

/* ══ 1 ══ */
const perPier = {}; C.forEach(c => { perPier[c.pier] = (perPier[c.pier] || 0) + 1; });
if (S.labels.length >= 1 && S.labels.length === S.heads.length && S.labels.every(p => perPier[p] === S.days) && S.days >= 28)
  ok(`1 เดือน ${S.ym} · ${S.labels.length} กลุ่มท่า (${S.labels.join(', ')}) มีแถวเรือว่างครบ ${S.days} วัน`);
else fail('1 ' + JSON.stringify({ S, perPier }));

/* ══ 2–3 · เทียบกับกติกาของรายการ AVAILABLE ══ */
const chk = await page.evaluate(cells => { const bad = [], seenAssigned = []; let withBoats = 0;
  const byDate = {}; cells.forEach(c => { (byDate[c.d] = byDate[c.d] || []).push(c); });
  Object.keys(byDate).forEach(d => {
    const keep = _bop2.pier;
    byDate[d].forEach(c => { _bop2.pier = c.pier; const av = bop2FleetStatus(d).available.map(x => x.boat.name || x.boat.id).sort(); _bop2.pier = keep;
      if (av.length) withBoats++;
      if (av.length !== c.n || av.join('|') !== c.names.slice().sort().join('|')) bad.push({ d, pier: c.pier, cell: c.names, want: av });
      c.names.forEach(nm => { const b = BOATS.find(x => (x.name || x.id) === nm); const op = (TRIPS[d] || {})[b.id];
        if ((op && op.route) || boatEffStatus(b, d).s !== 'available' || getBoatCurrentPier(b, d) !== c.pier) seenAssigned.push({ d, nm }); }); });
  });
  return { bad: bad.slice(0, 3), nBad: bad.length, seenAssigned: seenAssigned.slice(0, 3), withBoats, total: cells.length }; }, C);
if (!chk.nBad && chk.withBoats >= 5) ok(`2 ${chk.total} ช่อง (${chk.withBoats} ช่องมีเรือว่าง) · จำนวนและชื่อเรือตรงกับรายการ AVAILABLE ของวันนั้น แยกตามท่า`);
else fail('2 ' + JSON.stringify(chk));
if (!chk.seenAssigned.length) ok('3 ไม่มีเรือที่วางเส้นทางแล้วหรือไม่พร้อมใช้ หลุดเข้ามาในแถวเรือว่าง');
else fail('3 ' + JSON.stringify(chk.seenAssigned));

/* ══ 4 · วางเรือแล้วหายจากแถว ══ */
const pick = C.find(c => c.n >= 1 && c.d >= S.ym + '-02');
if (!pick) fail('4 setup · no cell with a free boat');
else {
  const r4 = await page.evaluate(async p => { const b = BOATS.find(x => (x.name || x.id) === p.names[0]);
    const rt = ROUTES.find(r => !laIsLandRoute(r.id) && (r.pier || '') === p.pier) || ROUTES.find(r => !laIsLandRoute(r.id));
    TRIPS[p.d] = TRIPS[p.d] || {}; const had = TRIPS[p.d][b.id];
    TRIPS[p.d][b.id] = { route: rt.id, type: 'normal', booked: 0 }; renderOp(); await new Promise(z => setTimeout(z, 500));
    const c = document.querySelector('#view-operation [data-bopfree="' + p.pier + '"][data-date="' + p.d + '"]');
    const out = { n: +c.dataset.n, names: c.dataset.names };
    /* คืนสภาพ · ห้ามลบช่อง TRIPS ของจริง · ช่องนี้เทสสร้างเอง จึงคืนเป็นค่าก่อนหน้า */
    if (had === undefined) TRIPS[p.d][b.id] = { route: '', type: 'normal', booked: 0 }; else TRIPS[p.d][b.id] = had;
    renderOp(); await new Promise(z => setTimeout(z, 400));
    const c2 = document.querySelector('#view-operation [data-bopfree="' + p.pier + '"][data-date="' + p.d + '"]');
    return { ...out, back: +c2.dataset.n, boat: b.name }; }, pick);
  if (r4.n === pick.n - 1 && !r4.names.split('|').includes(r4.boat) && r4.back === pick.n) ok(`4 วาง ${r4.boat} ลงเส้นทางวันที่ ${pick.d} · ช่องลดจาก ${pick.n} เหลือ ${r4.n} ลำ ชื่อหายไป`);
  else fail('4 ' + JSON.stringify({ r4, pick }));
}

/* ══ 5 · กด / ชี้ค้าง ══ */
if (pick) {
  const r5 = await page.evaluate(async p => { const c = document.querySelector('#view-operation [data-bopfree="' + p.pier + '"][data-date="' + p.d + '"]'); const title = c.title; c.click(); await new Promise(z => setTimeout(z, 500)); return { sel: _bop2.selDate, title, txt: p.txt }; }, pick);
  if (r5.sel === pick.d && r5.title.includes(pick.names[0]) && /\(\d+\)/.test(r5.title) && pick.txt === String(pick.n)) ok(`5 ช่องเขียน "${pick.txt}" · ชี้ค้างเห็น "${r5.title.slice(0, 70)}" · กดแล้วเลือกวันที่ ${r5.sel}`);
  else fail('5 ' + JSON.stringify({ r5, pick }));
}

/* ══ 6 · สัปดาห์ ══ */
const W = await page.evaluate(async p => { _bop2.selDate = p.d; if (typeof bop2SetViewMode === 'function') bop2SetViewMode('week'); else { _bop2.viewMode = 'week'; renderOp(); } await new Promise(z => setTimeout(z, 500));
  const c = document.querySelector('#view-operation [data-bopfree="' + p.pier + '"][data-date="' + p.d + '"]'); const out = c ? { txt: c.textContent.replace(/\s+/g, ' ').trim(), n: +c.dataset.n } : null;
  if (typeof bop2SetViewMode === 'function') bop2SetViewMode('month'); return out; }, pick || { d: S.ym + '-15', pier: S.labels[0] });
if (pick && W && W.n === pick.n && pick.names.every(nm => W.txt.includes(nm))) ok(`6 มุมมองสัปดาห์ · ช่องเขียนชื่อเรือ "${W.txt.slice(0, 60)}"`);
else fail('6 ' + JSON.stringify({ W, pick }));

/* ══ 7–8 · ปฏิทินเรือ ══ */
await goView(page, 'fl-boatstatus', 900);
const B = await page.evaluate(async ym => {
  const b = BOATS.find(x => !x.retired && x.ownership !== 'charter' && (x.pier === 'panwa' || x.pier === 'tublamu')) || BOATS[0];
  selBoatId = b.id; window.bsCalDate = new Date(ym + '-10T12:00:00'); renderBoats(); if (typeof renderBoatDetailPink === 'function') renderBoatDetailPink(); await new Promise(z => setTimeout(z, 600));
  const SH = { tublamu: 'TL', panwa: 'VP', ranong: 'RN' };
  const read = () => [...document.querySelectorAll('[data-bspier]')].map(x => ({ p: x.dataset.bspier, t: x.textContent.trim(), ds: (x.title.match(/\d{4}-\d{2}-\d{2}/) || [''])[0], vis: x.getBoundingClientRect().width > 6 && x.getBoundingClientRect().height > 6 }));
  const t1 = read(), wrong1 = t1.filter(x => x.p !== getBoatCurrentPier(b, x.ds) || (SH[x.p] && x.t !== SH[x.p]) || !x.vis);
  const dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  /* ย้ายท่า 12–18 ของเดือน */
  const home = getBoatCurrentPier(b, ym + '-12'), to = home === 'tublamu' ? 'panwa' : 'tublamu';
  b.assignments = Array.isArray(b.assignments) ? b.assignments : [];
  const a = { id: 'asn_test', fromPier: home, toPier: to, startDate: ym + '-12', endDate: ym + '-18', type: 'temporary', status: 'planned' };
  b.assignments.push(a); renderBoatDetailPink(); await new Promise(z => setTimeout(z, 500));
  const t2 = read();
  const inR = t2.filter(x => x.ds >= ym + '-12' && x.ds <= ym + '-18'), outR = t2.filter(x => x.ds < ym + '-12' || x.ds > ym + '-18');
  const before = {}; t1.forEach(x => { before[x.ds] = x.p; });
  const res = { boat: b.name, n1: t1.length, dim, wrong1: wrong1.slice(0, 3), home, to, inOk: inR.length === 7 && inR.every(x => x.p === to && x.t === SH[to]), outOk: outR.every(x => x.p === before[x.ds]), moved: inR.some(x => before[x.ds] !== x.p),
    legend: !!document.querySelector('[data-bspier-legend]'), sample: t1.slice(0, 3) };
  b.assignments = b.assignments.filter(x => x !== a); renderBoatDetailPink();
  return res; }, S.ym);
if (B.n1 === B.dim && !B.wrong1.length && B.legend) ok(`7 ปฏิทินของ ${B.boat} · ${B.n1} วันมีป้ายท่า ตรงกับท่าของวันนั้น (เช่น ${B.sample.map(x => x.ds.slice(8) + ':' + x.t).join(' ')}) · มีคำอธิบายตัวย่อ`);
else fail('7 ' + JSON.stringify(B));
if (B.inOk && B.outOk && B.moved) ok(`8 ย้ายท่า ${B.home} → ${B.to} วันที่ 12–18 · ป้ายในช่วงนั้นเปลี่ยน นอกช่วงเท่าเดิม`);
else fail('8 ' + JSON.stringify(B));

const e1 = errors.filter(e => !/Failed to load resource/.test(e));
if (!e1.length) ok('9 ไม่มี error บนหน้า'); else fail('9 ' + e1.slice(0, 3).join(' | '));
if (process.env.SHOT) { await goView(page, 'operation', 900); await page.waitForTimeout(400); const el = await page.$('#view-operation .bop2-grid'); if (el) await el.screenshot({ path: process.env.SHOT }); }
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
