// §pkFixKey · ช่องที่ยังไม่มีชื่อในชีทตั๋วอุทยาน: แก้ประเภทแล้วต้องแก้คืนได้ · ชื่อที่พิมพ์หลังแก้ประเภทต้องไม่หาย
import { open } from './_harness.mjs';
let bad = 0; const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1000);
const r = await page.evaluate(async () => {
  const zz = ms => new Promise(f => setTimeout(f, ms));
  const el = document.querySelector('.nav-item[data-view^="pok-"]'); if (!el) return { none: true }; nav(el); await zz(300);
  // วัน/ท่าแรกที่มีช่องว่าง (ยังไม่มีชื่อ)
  const days = [...new Set((SB_BOOKINGS || []).flatMap(b => (b.trips || []).map(t => t.date)).filter(Boolean))].sort();
  let date = null, pier = null, hit = null;
  for (const d of days) { for (const pp of PO_PIERS.map(p => p.k)) { let D = []; try { D = pkTkData(d, pp) || []; } catch (_) { continue; }
    D.forEach(g => (g.boats || []).forEach(B => (B.people || []).forEach(p => { if (!hit && p.ph && !p.typed) { hit = { bkId: p.bkId, auto: p.auto, cat: p.cat, seq: p.seq, bid: B.bid, rid: g.rid }; date = d; pier = pp; } }))); if (hit) break; } if (hit) break; }
  if (!hit) return { none: true };
  renderPierPark(pier); pkSetView('day'); pkSetDate(date); await zz(300);
  (pkTkData(date, pier) || []).forEach(g => (g.boats || []).forEach(B => (B.people || []).forEach(p => { if (!hit && p.ph && !p.typed) hit = { bkId: p.bkId, auto: p.auto, cat: p.cat, seq: p.seq, bid: B.bid, rid: g.rid }; })));
  if (!hit) return { none: true };
  const find = () => { let f = null; (pkTkData(date, pier) || []).forEach(g => (g.boats || []).forEach(B => (B.people || []).forEach(p => { if (!f && p.ph && p.bkId === hit.bkId && (p.auto || p.cat) === hit.auto && p.seq === hit.seq) f = p; }))); return f; };
  const other = ['adTH', 'chTH', 'adFR', 'chFR', 'inf'].find(k => k !== hit.auto);
  // 1 · แก้ประเภทครั้งแรก (คีย์ประเภทเดิม — ทางเดียวที่ใช้ได้มาตลอด)
  pkFixSet(date, hit.bkId, 'ph|' + hit.auto + '|' + hit.seq, other); await zz(100);
  const a = find();
  // 2 · ตัวเลือกประเภท + ช่องชื่อ ในแถวนั้นต้องส่งคีย์ด้วยประเภทเดิม
  try { pkTab(hit.rid, hit.bid); } catch (_) {} await zz(300);
  const rows = [...document.querySelectorAll('.pk-sheet tbody tr')];
  const row = rows.find(tr => { const s = tr.querySelector('td.cd select'); return s && s.getAttribute('onchange').indexOf("'" + hit.bkId + "'") >= 0 && s.getAttribute('onchange').indexOf('|' + hit.seq + "'") >= 0; });
  const selKey = row && (row.querySelector('td.cd select').getAttribute('onchange').match(/'(ph\|[^']+)'/) || [])[1];
  const nmKey = row && row.querySelector('input.nmin') && row.querySelector('input.nmin').getAttribute('onchange');
  // 3 · พิมพ์ชื่อหลังแก้ประเภท ผ่านช่องจริง
  const inp = row && row.querySelector('input.nmin'); let typed = null;
  if (inp) { inp.value = 'ทดสอบ คีย์ประเภท'; inp.dispatchEvent(new Event('change')); await zz(300); typed = (find() || {}).full; }
  // 4 · แก้คืน: เลือกประเภทเดิมในตัวเลือก (ทางที่ผู้ใช้ทำ)
  const row2 = [...document.querySelectorAll('.pk-sheet tbody tr')].find(tr => { const s = tr.querySelector('td.cd select'); return s && s.getAttribute('onchange').indexOf("'" + hit.bkId + "'") >= 0 && s.getAttribute('onchange').indexOf('|' + hit.seq + "'") >= 0; });
  const sel = row2 && row2.querySelector('td.cd select'); let b = null;
  if (sel) { sel.value = hit.auto; sel.dispatchEvent(new Event('change')); await zz(300); b = find(); }
  const strays = Object.keys(PIER_CFG.parkFix || {}).filter(k => k.indexOf(date + '|' + hit.bkId + '|ph|') === 0);
  pkNmSet(date, hit.bkId, hit.auto, hit.seq, '');   // เก็บกวาด
  return { hit, other, a: a && { cat: a.cat, fixed: a.fixed }, selKey, nmKeyOk: !!(nmKey && nmKey.indexOf("'" + hit.auto + "'," + hit.seq) >= 0), typed, b: b && { cat: b.cat, fixed: b.fixed, full: b.full }, strays };
});
if (r.none) { console.log('  · ไม่มีช่องว่างในข้อมูลทดสอบ'); }
else {
  if (r.a && r.a.cat === r.other && r.a.fixed) ok(`1 แก้ประเภท ${r.hit.auto} → ${r.other} ติดป้ายแก้ประเภท`); else fail('1 ' + JSON.stringify(r));
  if (r.selKey === 'ph|' + r.hit.auto + '|' + r.hit.seq && r.nmKeyOk) ok('2 ตัวเลือกประเภทและช่องชื่อส่งคีย์ด้วยประเภทเดิม (ไม่ใช่ประเภทที่แก้แล้ว)'); else fail('2 ' + JSON.stringify({ selKey: r.selKey, nmKeyOk: r.nmKeyOk, hit: r.hit }));
  if (r.typed === 'ทดสอบ คีย์ประเภท') ok('3 พิมพ์ชื่อหลังแก้ประเภท · ชื่อยังอยู่ในแถวเดิม'); else fail('3 ' + JSON.stringify(r.typed));
  if (r.b && r.b.cat === r.hit.auto && !r.b.fixed && r.b.full === 'ทดสอบ คีย์ประเภท' && r.strays.length === 0) ok('4 เลือกประเภทเดิมในตัวเลือก → กลับเป็นปกติ ป้ายหาย ชื่อยังอยู่ ไม่มีคีย์ค้าง'); else fail('4 ' + JSON.stringify({ b: r.b, strays: r.strays }));
}
if (errors.length) fail('errors: ' + errors.join(' | ')); else ok('5 ไม่มี error');
await close(); console.log(bad ? `FAIL ${bad}` : 'PASS'); process.exit(bad ? 1 : 0);
