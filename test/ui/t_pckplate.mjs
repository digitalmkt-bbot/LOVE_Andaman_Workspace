// §pckPlate · Pier Check-in · ค้นหาทะเบียนรถได้ · ตัวเลือกรถโชว์ทะเบียน · ปุ่ม X ล้างคำค้น
//
// ที่มา (2026-10-15) · owner: "เพิ่มการค้นหา ทะเบียนรถได้หมด · ตัวให้เลือกรถโชว์ทะเบียนด้วย · มีปุ่มล้าง X กรณีค้นหาเสร็จแล้วได้ค้นหาต่อ"
// กัน
//   1 ตัวเลือก "ทุกคัน" · ทุก option ที่รถมีทะเบียน ต้องมีทะเบียนต่อท้ายชื่อ (ทะเบียนของวันนั้น · vanJobsDriverInfo)
//   2 พิมพ์ทะเบียน (แบบไม่มีช่องว่าง) → เหลือเฉพาะแถวของรถคันนั้น · เท่ากับกรองด้วยตัวเลือกรถ
//   3 มีคำค้น → ปุ่ม X ขึ้น · กด X → คำค้นว่าง แถวกลับมาครบ โฟกัสยังอยู่ในช่อง
//   4 ค้น voucher/ชื่อ แบบเดิมยังได้ · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await goView(page, 'booking', 600);
await page.evaluate(() => { nav(document.querySelector('.nav-item[data-view="piercheckin"]')); pckSetView('sheet'); });
await page.waitForTimeout(600);
// วันที่มีรถจัดแล้วมากที่สุด (นับจากข้อมูลดิบ) · เปิดวันนั้น
const pick = await page.evaluate(() => { const by = {};
  (SB_BOOKINGS || []).forEach(b => (b.trips || []).forEach(t => { const O = (typeof bkOpsRead === 'function') ? bkOpsRead(b, t.date) : (b.ops || {}); if (O && O.vanId && vehGet(O.vanId)) (by[t.date] = by[t.date] || new Set()).add(O.vanId); }));
  const d = Object.keys(by).sort((a, z) => by[z].size - by[a].size)[0]; return d ? { date: d, n: by[d].size } : null; });
if (!pick) { console.log('  ! ไม่มีวันที่จัดรถไว้ · ข้าม'); await close(); process.exit(0); }
await page.evaluate(d => { _pckDate = d; _pckQ = ''; _pckVan = ''; _pckBoat = ''; _pckArr = ''; _pckStat = ''; renderPierCheckin(); }, pick.date);
await page.waitForTimeout(600);
const st = () => page.evaluate(() => { const h = document.querySelector('.pck-host') || document;
  const opts = [...document.querySelectorAll('#pck-van option')].slice(1).map(o => ({ id: o.value, text: o.textContent }));
  const rows = [...document.querySelectorAll('#piercheckin-host td.pcs-nm[data-bk]')].map(t => t.getAttribute('data-bk'));
  const q = document.getElementById('pck-q'); return { opts, rows: [...new Set(rows)], q: q ? q.value : null, ph: q ? q.placeholder : '', x: !!document.querySelector('.pck-qx'), focus: document.activeElement === q, pckQ: _pckQ }; });
let a = await st();
// 1 options carry the plate of the day
const want = await page.evaluate(({ ids, d }) => ids.map(id => { const i = vanJobsDriverInfo(id, d); const v = vehGet(id) || {}; return { id, name: v.name || id, plate: (i.plate && i.plate !== '-') ? i.plate : '' }; }), { ids: a.opts.map(o => o.id), d: pick.date });
const withPlate = want.filter(w => w.plate);
const o1 = a.opts.length > 0 && a.opts.every(o => { const w = want.find(x => x.id === o.id); return o.text.includes(w.name) && (!w.plate || o.text.includes(' · ' + w.plate)) && /\(\d+\)$/.test(o.text); });
if (o1 && /ทะเบียนรถ/.test(a.ph)) ok(`1 ${pick.date} · ตัวเลือกรถ ${a.opts.length} คัน มีทะเบียน ${withPlate.length} คัน เช่น "${(a.opts.find(o => withPlate.some(w => w.id === o.id)) || a.opts[0]).text}" · placeholder มี ทะเบียนรถ`); else fail('1 ' + JSON.stringify({ opts: a.opts, want, ph: a.ph }));
// 2 search by plate (no spaces) == van filter
const tgt = withPlate[0];
if (!tgt) { console.log('  ! ไม่มีรถที่มีทะเบียนในวันนี้ · ข้ามข้อ 2'); }
else {
  const all = a.rows.length;
  await page.evaluate(id => { pckSetVan(id); }, tgt.id); await page.waitForTimeout(300); const viaVan = (await st()).rows.sort().join();
  await page.evaluate(() => { pckSetVan(''); }); await page.waitForTimeout(200);
  await page.evaluate(p => { const i = document.getElementById('pck-q'); i.value = p; i.dispatchEvent(new Event('input')); }, tgt.plate.replace(/[\s\-]+/g, '')); await page.waitForTimeout(300);
  a = await st();
  if (viaVan.length && a.rows.sort().join() === viaVan && a.rows.length < all && a.x) ok(`2 พิมพ์ "${tgt.plate.replace(/[\s\-]+/g, '')}" → ${a.rows.length}/${all} แถว = กรองด้วยตัวเลือก ${tgt.name} · ปุ่ม X ขึ้น`); else fail('2 ' + JSON.stringify({ viaVan, rows: a.rows, all, x: a.x }));
  // 3 X clears
  await page.click('.pck-qx'); await page.waitForTimeout(300); a = await st();
  if (a.pckQ === '' && a.q === '' && !a.x && a.rows.length === all && a.focus) ok(`3 กด X → คำค้นว่าง · แถวกลับมา ${all} · ไม่มีปุ่ม X · โฟกัสยังอยู่ในช่อง`); else fail('3 ' + JSON.stringify({ pckQ: a.pckQ, q: a.q, x: a.x, rows: a.rows.length, all, focus: a.focus }));
}
// 4 old search still works
const vc = await page.evaluate(() => { const ids = [...document.querySelectorAll('#piercheckin-host td.pcs-nm[data-bk]')].map(t => t.getAttribute('data-bk')); const b = (SB_BOOKINGS || []).find(x => ids.includes(x.id) && x.voucherRef); return b ? b.voucherRef : ''; });
if (vc) { await page.evaluate(v => { const i = document.getElementById('pck-q'); i.value = v; i.dispatchEvent(new Event('input')); }, vc); await page.waitForTimeout(300); a = await st(); }
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if ((!vc || (a.rows.length >= 1 && a.x)) && !e1.length) ok(`4 ค้น voucher "${vc}" ยังได้ (${a.rows.length} แถว) · ไม่มี error`); else fail('4 ' + JSON.stringify({ vc, rows: a.rows.length, e1: e1.slice(0, 3) }));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
