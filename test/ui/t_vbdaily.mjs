// §vbDaily · หน้าวางบิลรถร่วม (รายเจ้า) · สรุปรายวัน + พิมพ์ได้
//
// ที่มา (2026-10-23) · owner (ภาพหน้ารายเจ้า "พี่โจ้ like van") "หน้าต่างนี้ เพิ่มที่เป็นรายการสรุปรายวันได้ด้วย และปริ้นได้"
//   เลือก: สรุปรายวันของเจ้านี้ · พิมพ์ได้ทั้งฉบับส่งเจ้ารถและฉบับภายใน
//
// ⚠ เทสเขียนใบวางบิลของตัวเองบนข้อมูลจริง แล้วคืนสถานะตอนจบ
// กัน
//   1 การ์ด "สรุปรายวัน" ใต้ตาราง · แถวละวัน · เที่ยว/คน/เรียกเก็บของแต่ละวัน = ผลรวมแถวของวันนั้นในตาราง · แถวรวม = การ์ดเรียกเก็บ
//   2 ใส่เรต/Extra/หัก แล้วยอดรายวันเปลี่ยนตาม (สูตรเดียวกับตาราง) · รถนอกที่มีวันที่ไปอยู่วันนั้น
//   3 เลือกคันเดียว → สรุปรายวันเหลือเฉพาะคันนั้น
//   4 พิมพ์ฉบับเจ้ารถ: หัว "สรุปรายวันค่ารถร่วม" · ไม่มีราคาขาย/กำไร · ยอดรวม = ใบวางบิล · ฉบับภายใน: มีราคาขาย/กำไร + ป้ายห้ามส่ง
//   5 ไม่มี error · คืนใบวางบิลเดิม
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1900, height: 1100 });
await goView(page, 'vanbill', 900);
/* จับหน้าต่างพิมพ์ */
await page.evaluate(() => { window.__pw = []; window.open = () => { const d = { html: '', write(h) { this.html += h; }, close() {} }; const w = { document: d, focus() {}, print() {} }; window.__pw.push(w); return w; }; });

const S = await page.evaluate(() => {
  /* ชุดข้อมูลทดสอบไม่มีงานรถร่วม · สร้างเอง: เจ้าที่มีรถ ≥2 คัน · จัดใบจอง Similan ใน 1–10 ต.ค. ลงรถสองคันนั้น 2 วัน */
  { const L = (typeof SB_VEHICLES !== 'undefined' && Array.isArray(SB_VEHICLES)) ? SB_VEHICLES : VEHICLES; const v0 = vbVans()[0];
    if (v0) L.push(Object.assign(JSON.parse(JSON.stringify(v0)), { id: 'vehZZ1', name: 'ZZ-Test', plate: 'กข-0001' })); }   /* ให้เจ้าแรกมี 2 คัน */
  const V = vbVans(); const bySup = {}; V.forEach(v => { (bySup[vbSupOf(v)] = bySup[vbSupOf(v)] || []).push(v); });
  const sup = Object.keys(bySup).find(k => bySup[k].length >= 2 && !/ไม่ระบุ/.test(k));
  if (sup) { const vv = bySup[sup]; let n = 0;
    SB_BOOKINGS.filter(b => b.status === 'confirmed' && (b.trips || []).length === 1 && b.trips[0].pax && /^r[1-6]$/.test(b.trips[0].routeId)).slice(0, 8).forEach((b, i) => {
      b.trips[0].date = i < 4 ? '2026-10-03' : '2026-10-05'; b.ops = Object.assign({}, b.ops || {}, { vanId: vv[i % 2].id }); delete b.ops.vanSplits; n++; }); }
  const sups = vbSuppliers(); let p = null;
  outer:
  for (const s of sups) for (const ym of ['2026-10'])
    for (const per of [1, 2, 3]) { _vb.sup = s; _vb.ym = ym; _vb.per = per; _vb.van = ''; _vb.pier = '';
      const rows = vbRows(); const days = new Set(rows.map(r => r.date)); const vans = new Set(rows.map(r => r.vanId));
      if (rows.length >= 4 && days.size >= 2 && vans.size >= 2) { p = { s, ym, per }; break outer; } }
  if (!p) return { err: 'ไม่มีเจ้าที่มีงาน ≥4 แถว 2 วัน 2 คัน' };
  _vb.sup = p.s; _vb.ym = p.ym; _vb.per = p.per; _vb.mode = 'one'; _vb.edit = 0; _vb.open = {}; _vb.pier = '';
  const key = vbKey(); const snap = VAN_BILL[key] ? JSON.stringify(VAN_BILL[key]) : null;
  VAN_BILL[key] = { perPax: 0, rate: 0, rows: {}, extra: [], by: '', at: '' };
  renderVanBill();
  return { p, key, snap };
});
if (S.err) { fail(S.err); await close(); process.exit(1); }

/* ใส่เรต 1000 ทุกรหัส + ขาย/คน 300 + แถวแรก extra 200 หัก 50 + รถนอกวันแรก */
const prep = await page.evaluate(() => {
  const st = vbState(), pier = _vb.pier;
  st.rateC = st.rateC || {}; vbCodesIn(vbRows().filter(r => vbPk(r.routeId) === pier)).forEach(C => { st.rateC[C.c] = 1000; });
  st.perPaxP = st.perPaxP || {}; st.perPaxP[pier] = 300;
  const rows = vbRows().filter(r => vbPk(r.routeId) === pier); const k0 = vbRowKey(rows[0]);
  st.rows[k0] = { ex: 200, cut: 50 };
  st.extra.push({ id: 'zzx1', date: rows[0].date, note: 'test', van: 2, pax: 10, rate: 900, ex: 0, cut: 0, per: 300, pier });
  renderVanBill();
  return { d0: rows[0].date, pier };
});

const read = () => page.evaluate(() => {
  const h = document.getElementById('vanbill-host'); const c = h.querySelector('.vbx-dy');
  if (!c) return { none: true };
  const num = t => +String(t).replace(/[^\d.-]/g, '') || 0;
  const rows = [...c.querySelectorAll('tbody tr:not(.t)')].map(tr => [...tr.children].map(td => td.textContent.trim()));
  const tot = [...c.querySelector('tr.t').children].map(td => td.textContent.trim());
  /* ตารางหลัก: นับแถวต่อวัน + เรียกเก็บต่อวัน */
  const byDay = {}; let cur = '';
  [...h.querySelectorAll('.vbx-xl tbody tr')].forEach(tr => {
    if (tr.classList.contains('vbx-day')) { cur = tr.textContent.trim(); return; }
    const b = tr.querySelector('td.bill'); if (!b || tr.classList.contains('vbx-xr') || tr.classList.contains('vbx-tot')) return;
    (byDay[cur] = byDay[cur] || { n: 0, bill: 0 }); byDay[cur].n++; byDay[cur].bill += num(b.textContent); });
  const card = (h.querySelector('.vbx-kp .k.nv b') || {}).textContent || '';
  return { rows, tot, byDay, card: num(card), head: c.querySelector('.hh').textContent };
});

const R1 = await read();
if (R1.none) fail('1 ไม่มีการ์ดสรุปรายวัน');
else {
  const dayN = Object.values(R1.byDay).map(x => x.n);
  const sumBill = R1.rows.reduce((s, r) => s + (+r[7].replace(/,/g, '') || 0), 0);
  const totBill = +R1.tot[7].replace(/,/g, '');
  const tripsOk = R1.rows.length >= 2 && R1.rows.every(r => +r[1] >= 1);
  if (tripsOk && sumBill === totBill && totBill === R1.card) ok('1 การ์ดสรุปรายวัน ' + R1.rows.length + ' วัน · ผลรวมรายวัน ' + totBill.toLocaleString() + ' = แถวรวม = การ์ดเรียกเก็บ · ' + R1.head.replace(/\s+/g, ' ').slice(0, 60));
  else fail('1 ' + JSON.stringify({ rows: R1.rows, tot: R1.tot, card: R1.card, dayN }));
}

/* 2 · วันแรกต้องมี extra 200 หัก 50 + รถนอก 2 คัน × 900 · ตรวจตัวเลขวันแรกเทียบกับสูตร */
const R2 = await page.evaluate((P) => {
  const st = vbState(); const rows = vbRows().filter(r => vbPk(r.routeId) === P.pier && r.date === P.d0);
  let bill = 0, ex = 0, cut = 0, trips = rows.length + 2;
  rows.forEach(r => { const m = st.rows[vbRowKey(r)] || {}; const C = vbCode(r.routeId); const rate = (m.rate != null ? m.rate : vbRateOf(C.c, st)) || 0; ex += +m.ex || 0; cut += +m.cut || 0; bill += rate + (+m.ex || 0) - (+m.cut || 0); });
  bill += 2 * 900;
  const tr = document.querySelector('#vanbill-host .vbx-dy tbody tr'); const td = [...tr.children].map(x => x.textContent.trim());
  return { exp: { bill, ex, cut, trips }, got: td };
}, prep);
if (+R2.got[1] === R2.exp.trips && +R2.got[7].replace(/,/g, '') === R2.exp.bill && R2.got[5].replace(/,/g, '') === String(R2.exp.ex) && R2.got[6] === '-' + R2.exp.cut)
  ok('2 วันแรก: ' + R2.exp.trips + ' เที่ยว (รวมรถนอก 2) · Extra ' + R2.exp.ex + ' · หัก ' + R2.exp.cut + ' · เรียกเก็บ ' + R2.exp.bill.toLocaleString() + ' ตรงสูตรตาราง');
else fail('2 ' + JSON.stringify(R2));

/* 3 · เลือกคันเดียว */
const R3 = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('#vanbill-host .vbx-vc button')].find(b => !/ทุกคัน/.test(b.textContent) && !b.classList.contains('dim'));
  const id = (btn.getAttribute('onclick').match(/'van','([^']+)'/) || [])[1]; vbPick('van', id);
  const c = document.querySelector('#vanbill-host .vbx-dy'); const tot = [...c.querySelector('tr.t').children].map(td => td.textContent.trim());
  const n = vbRows().filter(r => vbPk(r.routeId) === _vb.pier && r.vanId === id).length;
  const head = c.querySelector('.hh').textContent; vbPick('van', ''); return { n, trips: +tot[1], head };
});
if (R3.trips === R3.n && /เฉพาะ/.test(R3.head)) ok('3 เลือกคันเดียว → สรุปรายวันเหลือ ' + R3.n + ' เที่ยวของคันนั้น · หัวการ์ดบอก "เฉพาะ…"');
else fail('3 ' + JSON.stringify(R3));

/* 4 · พิมพ์ */
const R4 = await page.evaluate(() => {
  window.__pw = [];
  document.querySelector('#vanbill-host .vbx-dy button.pri').click();
  [...document.querySelectorAll('#vanbill-host .vbx-dy button')].find(b => /ฉบับภายใน/.test(b.textContent)).click();
  vbPrint();   /* ใบวางบิลปกติไว้เทียบยอด */
  const [a, b, c] = window.__pw.map(w => w.document.html);
  const tot = h => { const m = h.match(/<tr class="tot">([\s\S]*?)<\/tr>/); return m ? m[1].replace(/<[^>]+>/g, '|').split('|').filter(Boolean) : []; };
  return { a: { t: /สรุปรายวันค่ารถร่วม/.test(a), sale: /ราคาขาย|กำไร/.test(a), own: /ฉบับเจ้าของรถ/.test(a), tot: tot(a) },
           b: { sale: /<th>ราคาขาย<\/th>/.test(b) && /<th>กำไร<\/th>/.test(b), tag: /ห้ามส่งให้เจ้าของรถ/.test(b) },
           billTot: tot(c) };
});
const aBill = R4.a.tot[R4.a.tot.length - 1], cBill = R4.billTot[R4.billTot.length - 1];
if (R4.a.t && !R4.a.sale && R4.a.own && aBill === cBill && R4.b.sale && R4.b.tag)
  ok('4 พิมพ์ฉบับเจ้ารถ: "สรุปรายวันค่ารถร่วม" ไม่มีราคาขาย/กำไร · ยอดรวม ' + aBill + ' = ใบวางบิล · ฉบับภายในมีราคาขาย/กำไร + "ห้ามส่งให้เจ้าของรถ"');
else fail('4 ' + JSON.stringify({ R4, aBill, cBill }));

/* 5 · คืนสถานะ */
await page.evaluate(S => { if (S.snap) VAN_BILL[S.key] = JSON.parse(S.snap); else delete VAN_BILL[S.key]; }, S);
if (errors.length === 0) ok('5 ไม่มี error · คืนใบวางบิลเดิมแล้ว');
else fail('5 ' + JSON.stringify(errors.slice(0, 3)));
await close();
if (bad) { console.log(bad + ' FAILED'); process.exit(1); } console.log('ALL OK');
