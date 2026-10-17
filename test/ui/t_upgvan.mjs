// §upgVan · Upgrade ทั้งคัน (By trip › โหมดจัดรถ › หัวกรุ๊ปรถ)
//
// ที่มา (2026-10-17) · owner: "พรุ่งนี้ Similan Cat กับ Similan Speed ว่าง จะอัพเกรดบางคันขึ้นไป
//   เพื่อปรับเรือ Speed เหลือ 3 เครื่อง ประหยัดต้นทุน" · ถาม "มันจะไม่พังใช่ไหม เพราะมันต้องเป็นทั้งใบงาน ทั้ง Van Check-in"
//   ของเดิม (§upgRoute) ย้ายทีละใบ และเลขกรุ๊ปรถติดไปชนกรุ๊ปของปลายทาง
//
// ชุดข้อมูล subset_daydetail: 2026-09-15 · Phi Phi Bamboo by Speedboat (r10 · ออก 09:00) มีกรุ๊ปรถหลายกรุ๊ป
//   ปลายทาง Whale Shark (r12 · ออก 10:00 · ท่าเดียวกัน) ว่าง 23 · มีกรุ๊ป 1 และ 2 ของตัวเองอยู่แล้ว (รถคนละคัน)
//   ย้ายกรุ๊ป 12 ของ r10 (5 ใบ · 8 pax · รถ veh18) → ต้องได้กรุ๊ปใหม่ใต้ r12 (เลขถัดจากที่มี) ไม่ชนกรุ๊ปเดิม
//   (ใบหนึ่งในกรุ๊ปดึงที่นั่งจาก seat lock · เทสปลดออกก่อน · กติกาเดิมไม่ให้ย้ายใบแบบนั้น)
//
// กัน
//   1 หัวกรุ๊ปโหมดจัดรถมีปุ่ม "Upgrade ทั้งคัน" · กดแล้วเปิดหน้าต่าง · มีปลายทาง r12 · มีกล่องเลข "ตอนนี้/หลังย้าย"
//   2 เลือก r12 แล้วขึ้นเตือนเวลาออกเรือไม่เท่ากัน (09:00 → 10:00) · ที่ว่างโชว์ "23 → 15"
//   3 ไม่ใส่เหตุผล → alert (ASCII) · ไม่ย้าย
//   4 ใส่เหตุผล + เวลารับใหม่ → หน้าสรุป (ชื่อลูกค้าครบ 5 · รถ · กรุ๊ปใหม่) → ยืนยัน
//   5 ข้อมูล: ทุกใบ routeId=r12 · upg.van {gid:12,newGid:3} · รถ/ลำดับรับเดิม · vanGroup=3 · เรือถูกล้าง · เวลารับใหม่
//     ที่นั่ง r10 ลด 8 · r12 เพิ่ม 8 · ไม่มี "รถปนกันในกรุ๊ป" · กรุ๊ป 1/2 ของ r12 ไม่ถูกแตะ · ประวัติลงทุกใบ
//   6 ใบงานรถ veh18: รายชื่อ 5 ใบอยู่ใต้ r12 กรุ๊ป 3 · ใต้ r10 ไม่เหลือ · ใบงานพิมพ์ชื่อครบและเวลารับใหม่
//   7 Van check-in: รถ veh18 ขึ้นใต้ Whale Shark เลขกรุ๊ป 3 · ไม่ขึ้นใต้ Phi Phi Speedboat
//   8 จุดแวะ (VAN_STOPS) ของรถ+กรุ๊ปนี้ ย้ายคีย์ตามไป r12 กรุ๊ป 3
//   9 Pier check-in / By trip วาดได้ ไม่มี error
//  10 หัวกรุ๊ป 3 ของ r12 ขึ้นปุ่ม "ยกเลิก Upgrade ทั้งคัน" · กดแล้ว (confirm) ทุกอย่างกลับเหมือนเดิม: routeId r10 · กรุ๊ป 12 · เวลารับเดิม
//     ที่นั่งกลับ · จุดแวะกลับ · upg หาย · เรือยังต้องจัดใหม่ (null)
//  11 ใบติดเงื่อนไข (ค้างคืน) ในกรุ๊ป → กล่องแดงบอกชื่อ+เหตุ · ปุ่มย้าย disabled · กด Apply ก็ไม่ย้าย
//  12 ดูอย่างเดียว (laGuardEdit=false) → กดปุ่มแล้วไม่เปิดหน้าต่าง
//  13 ไม่มี pageerror ตลอดเทส
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1000 });
const dialogs = [];
let acceptNext = true;
page.on('dialog', d => { dialogs.push(d.message()); if (acceptNext) d.accept(); else d.dismiss(); });

const DATE = '2026-09-15', FROM = 'r10', TO = 'r12', GID = 12, VAN = 'veh18';
await goView(page, 'booking', 900);

const base = await page.evaluate(([date, from, to, gid, van]) => {
  // ชุดข้อมูลจริงมีใบที่ดึงที่นั่งจาก seat lock อยู่ในกรุ๊ปนี้ 1 ใบ · กติกาเดิม (§upgRoute) ไม่ให้ย้าย → ปลดการดึงออกเพื่อทดสอบทางปกติ (ทางที่ติดเงื่อนไขเทสข้อ 11)
  bkUpgVanMembers(date, from, gid).forEach(x => { if (x.why) { x.t.lockUse = 0; if (x.t.seatSource) x.t.seatSource.locked = 0; } });
  const m = bkUpgVanMembers(date, from, gid);
  const al = r => { const a = getAllotment(r, date, null); return { used: a.seatsConsumed, free: a.seatsAvailable }; };
  const r12g = {};
  SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t.date !== date || t.routeId !== to) return; const o = bkOpsRead(b, date); if (o.vanGroup) r12g[o.vanGroup] = o.vanId; }));
  // จุดแวะของรถคันนี้ · ไว้ดูว่าย้ายคีย์ตาม
  VAN_STOPS[vsKey(date, from, 'uvtest')] = { label: 'T-UV guide', kind: 'staff', pax: 1, vanId: van, vanGroup: gid, time: '07:00', leg: 'out' };
  _bkV2.vanAssignMode = true; _bkV2.tab = 'bytrip'; _bkV2.filterRoute = from; _bkV2.filterDate = date; bkV2Render();
  const hdr = document.querySelector('tr[data-grp="' + gid + '"]');
  return { n: m.length, pax: m.reduce((s, x) => s + x.pax, 0), ids: m.map(x => x.b.id), why: m.map(x => x.why).filter(Boolean),
    seq: m.map(x => +(x.o.vanSeq || 0)), pick: bkUpgVanPick(m), vans: m.map(x => x.o.vanId),
    from: al(from), to: al(to), r12g, conf: bkV2VanGroupConflicts(date).length,
    btn: !!(hdr && hdr.querySelector('button[data-upgvan="go"]')) };
}, [DATE, FROM, TO, GID, VAN]);

if (base.n !== 5 || base.pax !== 8 || base.why.length || base.vans.some(v => v !== VAN)) fail('ชุดข้อมูลไม่ตรงที่คาด · ' + JSON.stringify(base));
else if (!base.btn) fail('หัวกรุ๊ป ' + GID + ' ในโหมดจัดรถไม่มีปุ่ม Upgrade ทั้งคัน');
else ok('กรุ๊ป ' + GID + ' · ' + base.n + ' ใบ ' + base.pax + ' pax · รถ ' + VAN + ' · เวลารับ ' + base.pick + ' · มีปุ่ม Upgrade ทั้งคัน');

/* ══ 1 · เปิดหน้าต่าง ═══════════════════════════════════════════════ */
await page.click('tr[data-grp="' + GID + '"] button[data-upgvan="go"]');
await page.waitForTimeout(250);
const m1 = await page.evaluate(() => {
  const ov = document.getElementById('bkv2-upgvan-ov'); if (!ov) return { err: 'no modal' };
  return { to: [...ov.querySelectorAll('[data-upgvan-to]')].map(x => x.dataset.upgvanTo), math: !!ov.querySelector('[data-upgvan-math]'),
    warn: !!ov.querySelector('[data-upgvan-timewarn]'), need: (ov.querySelector('[data-upgvan-need]') || {}).textContent || '',
    head: ov.textContent.replace(/\s+/g, ' ').slice(0, 200) };
});
if (m1.err) fail('กดปุ่มแล้วไม่เปิดหน้าต่าง');
else if (!m1.to.includes(TO)) fail('หน้าต่างไม่มีปลายทาง ' + TO + ' · ' + JSON.stringify(m1.to));
else if (!m1.math) fail('ไม่มีกล่องเลข ตอนนี้/หลังย้าย');
else if (m1.warn) fail('ยังไม่เลือกปลายทางแต่ขึ้นเตือนเวลาแล้ว');
else ok('หน้าต่างเปิด · ปลายทาง ' + m1.to.join(',') + ' · กล่องเลขมี · หลังย้ายใช้เรือ "' + m1.need + '"');

/* ══ 2 · เลือก r12 → เตือนเวลา · ที่ว่าง 23 → 15 ═════════════════════ */
await page.click('#bkv2-upgvan-ov [data-upgvan-to="' + TO + '"] input');
await page.waitForTimeout(200);
const m2 = await page.evaluate(to => {
  const ov = document.getElementById('bkv2-upgvan-ov');
  const w = ov.querySelector('[data-upgvan-timewarn]');
  const lab = ov.querySelector('[data-upgvan-to="' + to + '"]');
  return { warn: w ? w.textContent.replace(/\s+/g, ' ') : '', lab: lab.textContent.replace(/\s+/g, ' '), pickVal: document.getElementById('bkupgvan-pick').value };
}, TO);
if (!m2.warn || !/09:00/.test(m2.warn) || !/10:00/.test(m2.warn)) fail('ไม่เตือนเวลาออกเรือต่างกัน · "' + m2.warn + '"');
else if (!/23 .*→ 15|23[^0-9]+15/.test(m2.lab)) fail('ที่ว่างไม่โชว์ ก่อน → หลัง · "' + m2.lab + '"');
else if (m2.pickVal !== base.pick) fail('ช่องเวลารับไม่ได้เติมค่าเดิม · ' + m2.pickVal);
else ok('เลือก Whale Shark · เตือน 09:00 → 10:00 · ที่ว่าง 23 → 15 · เวลารับเติม ' + m2.pickVal);

/* ══ 3 · ไม่ใส่เหตุผล → alert · ไม่ย้าย ══════════════════════════════ */
dialogs.length = 0;
await page.click('#bkv2-upgvan-ov [data-upgvan-go]');
await page.waitForTimeout(200);
const m3 = await page.evaluate(([date, from, gid]) => ({ still: bkUpgVanMembers(date, from, gid).length, open: !!document.getElementById('bkv2-upgvan-ov'), confirm: !!document.querySelector('#bkv2-upgvan-ov [data-upg-confirm]') }), [DATE, FROM, GID]);
if (!dialogs.length || !/reason/i.test(dialogs[0])) fail('ไม่ใส่เหตุผลแล้วไม่เตือน · ' + JSON.stringify(dialogs));
else if (/[^\x00-\x7F]/.test(dialogs[0])) fail('alert ไม่ใช่ ASCII · ' + dialogs[0]);
else if (m3.still !== 5 || m3.confirm) fail('ไม่ใส่เหตุผลแต่ไปต่อ');
else ok('ไม่ใส่เหตุผล → alert ASCII · ยังไม่ย้าย');

/* ══ 4 · เหตุผล + เวลารับใหม่ → หน้าสรุป → ยืนยัน ═══════════════════ */
await page.fill('#bkupgvan-reason', 'ลดเรือ Speed');
await page.fill('#bkupgvan-pick', '08:30');
await page.click('#bkv2-upgvan-ov [data-upgvan-go]');
await page.waitForTimeout(250);
const m4 = await page.evaluate(ids => {
  const c = document.querySelector('#bkv2-upgvan-ov [data-upg-confirm]'); if (!c) return { err: 'no confirm view' };
  const txt = c.textContent.replace(/\s+/g, ' ');
  const names = ids.map(id => { const b = SB_BOOKINGS.find(x => x.id === id); return (b.leadPax || b.customerName || b.voucherRef || b.id); });
  return { txt: txt.slice(0, 400), allNames: names.every(n => txt.includes(n)), has830: /08:30/.test(txt), hasVan: /veh18|ลมใต้|รถ/.test(txt), hasDo: !!c.querySelector('[data-upgvan-do]') };
}, base.ids);
if (m4.err) fail('กด Upgrade แล้วไม่ขึ้นหน้าสรุป');
else if (!m4.allNames) fail('หน้าสรุปไม่ครบชื่อลูกค้าทั้ง 5 · ' + m4.txt);
else if (!m4.has830) fail('หน้าสรุปไม่โชว์เวลารับใหม่ 08:30 · ' + m4.txt);
else ok('หน้าสรุปครบ: 5 ชื่อ · รถ · เวลารับใหม่ 08:30');
await page.click('#bkv2-upgvan-ov [data-upgvan-do]');
await page.waitForTimeout(500);

/* ══ 5 · ข้อมูลหลังย้าย ═══════════════════════════════════════════════ */
const a5 = await page.evaluate(([date, from, to, gid, van, ids, pax0]) => {
  const al = r => { const a = getAllotment(r, date, null); return { used: a.seatsConsumed, free: a.seatsAvailable }; };
  const rows = ids.map(id => { const b = SB_BOOKINGS.find(x => x.id === id); const t = (b.trips || []).find(x => x.date === date); const o = bkOpsRead(b, date);
    const h = (b.history || []).slice(-1)[0] || {};
    return { rid: t.routeId, upgTo: t.upg && t.upg.toRouteId, upgFrom: t.upg && t.upg.fromRouteId, van: t.upg && t.upg.van, vanId: o.vanId, vanGroup: o.vanGroup, vanSeq: +(o.vanSeq || 0), boat: o.boatId || null, pick: o.pickupTimeFinal, charge: t.upg && t.upg.charge, ups: (b.upgrades || []).length,
      hist: String(h.text || h.msg || JSON.stringify(h)).slice(0, 120) }; });
  const r12g = {};
  SB_BOOKINGS.forEach(b => (b.trips || []).forEach(t => { if (t.date !== date || t.routeId !== to) return; const o = bkOpsRead(b, date); if (o.vanGroup) r12g[o.vanGroup] = o.vanId; }));
  const newGid = rows[0].vanGroup;
  return { rows, from: al(from), to: al(to), r12g, newGid, conf: bkV2VanGroupConflicts(date).length, modal: !!document.getElementById('bkv2-upgvan-ov'),
    stillFromGrp: bkUpgVanMembers(date, from, gid).length,
    hdrTxt: (document.querySelector('tr[data-grp="' + newGid + '"]') || { textContent: '' }).textContent.replace(/\s+/g, ' ').slice(0, 160) };
}, [DATE, FROM, TO, GID, VAN, base.ids, base.pax]);
{
  const R = a5.rows;
  const badRows = R.filter((r, i) => r.rid !== TO || r.upgTo !== TO || r.upgFrom !== FROM || !r.van || r.van.gid !== GID || r.vanId !== VAN || r.vanGroup !== a5.newGid || r.vanSeq !== base.seq[i] || r.boat !== null || r.pick !== '08:30' || r.charge !== 0 || r.ups !== 0 || !/whole van/i.test(r.hist));
  if (a5.modal) fail('ยืนยันแล้วหน้าต่างยังค้าง');
  if (badRows.length) fail('ข้อมูลใบหลังย้ายไม่ตรง · ' + JSON.stringify(badRows.slice(0, 2)));
  else ok('ทุกใบ: r12 · upg.van{gid:12} · รถ ' + VAN + ' + ลำดับรับเดิม · กรุ๊ปใหม่ ' + a5.newGid + ' · เรือล้าง · เวลารับ 08:30 · ไม่เก็บเงิน · ประวัติลง');
  const others = Object.keys(base.r12g).map(Number);
  if (others.includes(a5.newGid)) fail('เลขกรุ๊ปใหม่ชนของเดิม · ' + a5.newGid + ' ใน ' + JSON.stringify(others));
  else if (others.some(g => a5.r12g[g] !== base.r12g[g])) fail('กรุ๊ปเดิมของ Whale Shark ถูกแตะ · ' + JSON.stringify([base.r12g, a5.r12g]));
  else if (a5.conf) fail('ขึ้น "รถปนกันในกรุ๊ป" หลังย้าย');
  else ok('กรุ๊ปใหม่เลข ' + a5.newGid + ' ไม่ชนกรุ๊ป ' + others.join('/') + ' ของ Whale Shark · ไม่มีรถปนกัน');
  if (a5.from.used !== base.from.used - 8 || a5.to.used !== base.to.used + 8) fail('ที่นั่งไม่ขยับตาม · r10 ' + base.from.used + '→' + a5.from.used + ' · r12 ' + base.to.used + '→' + a5.to.used);
  else ok('ที่นั่ง: Speed ' + base.from.used + '→' + a5.from.used + ' · Whale Shark ' + base.to.used + '→' + a5.to.used);
  if (a5.stillFromGrp) fail('กรุ๊ป 12 ของ r10 ยังมีสมาชิกเหลือ ' + a5.stillFromGrp);
}

/* ══ 6 · ใบงานรถ ══════════════════════════════════════════════════════ */
const j6 = await page.evaluate(([date, from, to, gid, van, ids, newGid]) => {
  const under = (rid, g) => vanJobsBookingsFor(date, van, rid, 'out', g).map(b => b.id);
  const html = (typeof vanJobsOrderInner === 'function') ? vanJobsOrderInner(date, van, to, null, newGid) : '';
  const host = document.createElement('div'); host.innerHTML = html; const txt = host.textContent.replace(/\s+/g, ' ');
  const names = ids.map(id => { const b = SB_BOOKINGS.find(x => x.id === id); return (b.leadPax || b.customerName || b.voucherRef || b.id); });
  return { toIds: under(to, newGid), fromIds: under(from, gid), sheetNames: names.filter(n => txt.includes(n)).length, sheet830: (txt.match(/08:30/g) || []).length, stop: /T-UV guide/.test(txt) };
}, [DATE, FROM, TO, GID, VAN, base.ids, a5.newGid]);
if (j6.toIds.length !== 5 || base.ids.some(id => !j6.toIds.includes(id))) fail('ใบงานรถ veh18 ใต้ Whale Shark ไม่ครบ 5 ใบ · ' + JSON.stringify(j6.toIds));
else if (j6.fromIds.length) fail('ใบงานรถ veh18 ใต้ Phi Phi Speedboat ยังมี ' + j6.fromIds.length + ' ใบ');
else if (j6.sheetNames !== 5) fail('ใบงานพิมพ์ชื่อไม่ครบ · ' + j6.sheetNames + '/5');
else if (j6.sheet830 < 5) fail('ใบงานไม่ขึ้นเวลารับใหม่ 08:30 ครบทุกแถว · ' + j6.sheet830);
else if (!j6.stop) fail('จุดแวะ T-UV guide ไม่ตามมาในใบงานใต้ Whale Shark');
else ok('ใบงานรถ veh18: 5 ใบใต้ Whale Shark กรุ๊ป ' + a5.newGid + ' · ใต้ Speedboat ไม่เหลือ · ชื่อครบ · เวลารับ 08:30 · จุดแวะตามมา');

/* ══ 7 · Van check-in ═════════════════════════════════════════════════ */
await page.evaluate(d => { window._vanCkDate = d; }, DATE);
await goView(page, 'vancheckin', 900);
const v7 = await page.evaluate(([van, newGid]) => {
  if (typeof renderVanCheckin === 'function') renderVanCheckin();
  const vn = (vehGet(van) || {}).name || van;
  const heads = [...document.querySelectorAll('#vancheckin-host tr.ck-ghd')].map(r => r.textContent.replace(/\s+/g, ' ')).filter(t => t.includes(vn));
  return { vn, heads: heads.map(t => t.slice(0, 140)), ws: heads.filter(t => /Whale Shark/.test(t)).length, pp: heads.filter(t => /Phi Phi Bamboo by Speedboat/.test(t)).length, gno: heads.some(t => new RegExp('\\b' + newGid + '\\b').test(t)) };
}, [VAN, a5.newGid]);
if (!v7.ws) fail('Van check-in: รถ ' + v7.vn + ' ไม่ขึ้นใต้ Whale Shark · ' + JSON.stringify(v7.heads));
else if (v7.pp) fail('Van check-in: รถ ' + v7.vn + ' ยังขึ้นใต้ Phi Phi Speedboat');
else ok('Van check-in: รถ ' + v7.vn + ' ย้ายไปใต้ Whale Shark ทั้งคัน' + (v7.gno ? ' · เลขกรุ๊ป ' + a5.newGid : ''));

/* ══ 8 · จุดแวะย้ายคีย์ ═══════════════════════════════════════════════ */
const s8 = await page.evaluate(([date, from, to, newGid]) => ({ old: !!VAN_STOPS[vsKey(date, from, 'uvtest')], nw: VAN_STOPS[vsKey(date, to, 'uvtest')] || null }), [DATE, FROM, TO, a5.newGid]);
if (s8.old || !s8.nw || +s8.nw.vanGroup !== a5.newGid) fail('จุดแวะไม่ย้ายคีย์ตาม · ' + JSON.stringify(s8));
else ok('จุดแวะย้ายไป r12 กรุ๊ป ' + a5.newGid);

/* ══ 9 · Pier check-in + By trip วาดได้ ═════════════════════════════ */
await page.evaluate(d => { window._pierCkDate = d; }, DATE);
await goView(page, 'piercheckin', 700);
await goView(page, 'booking', 700);
if (errors.length) fail('error ระหว่างวาด Pier check-in / By trip · ' + errors.join(' | ')); else ok('Pier check-in · By trip วาดได้หลังย้าย');

/* ══ 10 · ยกเลิกทั้งคัน ═══════════════════════════════════════════════ */
dialogs.length = 0;
const h10 = await page.evaluate(([date, to, newGid]) => { _bkV2.vanAssignMode = true; _bkV2.tab = 'bytrip'; _bkV2.filterRoute = to; _bkV2.filterDate = date; bkV2Render();
  const hdr = document.querySelector('tr[data-grp="' + newGid + '"]'); return { undo: !!(hdr && hdr.querySelector('button[data-upgvan="undo"]')), go: !!(hdr && hdr.querySelector('button[data-upgvan="go"]')), txt: hdr ? hdr.textContent.replace(/\s+/g, ' ').slice(0, 160) : '' }; }, [DATE, TO, a5.newGid]);
await page.waitForTimeout(300);
if (!h10.undo || h10.go) fail('หัวกรุ๊ป ' + a5.newGid + ' ฝั่ง Whale Shark ไม่มีปุ่มยกเลิก Upgrade ทั้งคัน (หรือยังมีปุ่ม Upgrade) · "' + h10.txt + '"');
else ok('หัวกรุ๊ป ' + a5.newGid + ' (ฝั่ง Whale Shark) มีปุ่มยกเลิก Upgrade ทั้งคัน แทนปุ่ม Upgrade');
await page.click('tr[data-grp="' + a5.newGid + '"] button[data-upgvan="undo"]');
await page.waitForTimeout(500);
const u10 = await page.evaluate(([date, from, to, gid, van, ids]) => {
  const al = r => { const a = getAllotment(r, date, null); return { used: a.seatsConsumed, free: a.seatsAvailable }; };
  const rows = ids.map(id => { const b = SB_BOOKINGS.find(x => x.id === id); const t = (b.trips || []).find(x => x.date === date); const o = bkOpsRead(b, date);
    return { rid: t.routeId, upg: !!t.upg, vanId: o.vanId, vanGroup: o.vanGroup, vanSeq: +(o.vanSeq || 0), boat: o.boatId || null, pick: (o.pickupTimeFinal || t.pickupTime || '') }; });   // เวลารับที่ใช้จริง = ที่คนจัดตั้ง ไม่งั้นของใบ
  return { rows, from: al(from), to: al(to), conf: bkV2VanGroupConflicts(date).length, stopBack: VAN_STOPS[vsKey(date, from, 'uvtest')] || null, stopGone: !VAN_STOPS[vsKey(date, to, 'uvtest')],
    toUnder: vanJobsBookingsFor(date, van, to, 'out', 0).length, fromUnder: vanJobsBookingsFor(date, van, from, 'out', gid).length };
}, [DATE, FROM, TO, GID, VAN, base.ids]);
{
  const R = u10.rows;
  const badRows = R.filter((r, i) => r.rid !== FROM || r.upg || r.vanId !== VAN || r.vanGroup !== GID || r.vanSeq !== base.seq[i] || r.boat !== null || r.pick !== base.pick);
  if (!dialogs.length || /[^\x00-\x7F]/.test(dialogs[0])) fail('ยกเลิกไม่ถาม confirm ASCII · ' + JSON.stringify(dialogs));
  if (badRows.length) fail('ยกเลิกแล้วข้อมูลไม่กลับ · ' + JSON.stringify(badRows.slice(0, 2)) + ' · คาด pick ' + base.pick);
  else if (u10.from.used !== base.from.used || u10.to.used !== base.to.used) fail('ที่นั่งไม่กลับ · ' + JSON.stringify([u10.from, u10.to]));
  else if (!u10.stopBack || +u10.stopBack.vanGroup !== GID || !u10.stopGone) fail('จุดแวะไม่กลับ · ' + JSON.stringify(u10.stopBack));
  else if (u10.fromUnder !== 5 || u10.toUnder) fail('ใบงานรถหลังยกเลิกไม่กลับ · ใต้ r10 ' + u10.fromUnder + ' · ใต้ r12 ' + u10.toUnder);
  else if (u10.conf) fail('รถปนกันหลังยกเลิก');
  else ok('ยกเลิกทั้งคัน: กลับ r10 กรุ๊ป ' + GID + ' · รถ/ลำดับ/เวลารับเดิม · ที่นั่งกลับ · จุดแวะกลับ · เรือยังต้องจัดใหม่');
}

/* ══ 11 · ใบติดเงื่อนไข → ย้ายทั้งคันไม่ได้ ════════════════════════════ */
const b11 = await page.evaluate(([date, from, gid, ids]) => {
  const b = SB_BOOKINGS.find(x => x.id === ids[0]); const t = b.trips.find(x => x.date === date); t.ovn = true;
  _bkV2.vanAssignMode = true; _bkV2.tab = 'bytrip'; _bkV2.filterRoute = from; _bkV2.filterDate = date; bkV2Render();
  bkV2VanUpgrade(date, from, '', gid);
  const ov = document.getElementById('bkv2-upgvan-ov'); if (!ov) return { err: 'no modal' };
  const box = ov.querySelector('[data-upgvan-blocked]'); const go = ov.querySelector('[data-upgvan-go]');
  const nm = (b.leadPax || b.customerName || b.voucherRef || b.id);
  _bkUpgVan.to = 'r12'; _bkUpgVan.reason = 'x';
  bkV2UpgVanApply(true);
  const moved = bkUpgVanMembers(date, from, gid).filter(x => x.t.routeId !== from).length;
  const still = bkUpgVanMembers(date, from, gid).length;
  delete t.ovn; bkV2UpgVanClose();
  return { box: box ? box.textContent.replace(/\s+/g, ' ') : '', named: !!(box && box.textContent.includes(nm)), disabled: !!(go && go.disabled), moved, still };
}, [DATE, FROM, GID, base.ids]);
if (b11.err) fail('ข้อ 11 · ' + b11.err);
else if (!b11.box || !b11.named || !/ค้างคืน/.test(b11.box)) fail('ไม่ขึ้นกล่องแดงบอกใบติดเงื่อนไข · "' + b11.box + '"');
else if (!b11.disabled) fail('มีใบติดเงื่อนไขแต่ปุ่มย้ายยังกดได้');
else if (b11.moved || b11.still !== 5) fail('ฝืนเรียก apply แล้วย้ายไปบางใบ · moved ' + b11.moved);
else ok('ใบค้างคืนในกรุ๊ป → กล่องแดงบอกชื่อ+เหตุ · ปุ่ม disabled · ฝืน apply ก็ไม่ย้ายสักใบ');

/* ══ 12 · ดูอย่างเดียว ════════════════════════════════════════════════ */
const r12 = await page.evaluate(([date, from, gid]) => {
  const old = window.laGuardEdit; window.laGuardEdit = () => false;
  try { bkV2VanUpgrade(date, from, '', gid); return { modal: !!document.getElementById('bkv2-upgvan-ov') }; }
  finally { window.laGuardEdit = old; const ov = document.getElementById('bkv2-upgvan-ov'); if (ov) ov.remove(); }
}, [DATE, FROM, GID]);
if (r12.modal) fail('สิทธิ์ดูอย่างเดียวยังเปิดหน้าต่างได้'); else ok('ดูอย่างเดียว → ไม่เปิดหน้าต่าง');

/* ══ 13 · error ══════════════════════════════════════════════════════ */
await page.evaluate(([date, from]) => { delete VAN_STOPS[vsKey(date, from, 'uvtest')]; }, [DATE, FROM]);
if (errors.length) fail('pageerror · ' + errors.join(' | ')); else ok('ไม่มี error บนหน้า');

await close();
console.log(bad ? ('FAILED ' + bad) : 'ALL OK');
process.exit(bad ? 1 : 0);
