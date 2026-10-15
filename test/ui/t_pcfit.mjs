// §pcFit · เงินสดย่อย · หน้าต่างพิมพ์เปิดมาให้ทั้งหน้าพอดีจอ
// ที่มา (2026-10-15) · owner ส่งภาพใบรับรองแทนใบเสร็จ (หน้าต่างเต็มจอ ใบเล็กลอยกลาง) "ตัวปริ้นขอขึ้นให้มาพอดีจอ"
//   เดิม: ขยายตามความกว้างอย่างเดียว ไม่เกิน 1.5 เท่า
// กัน (ใบรับรอง 1 หน้า · หน้าต่าง 1900×1200 และ 1220×880)
//   1 ทั้งหน้าอยู่ในจอ (ไม่ต้องเลื่อน) และด้านใดด้านหนึ่งเต็มจอ (≥ 92%) · ทั้งสองขนาดหน้าต่าง
//   2 ปุ่ม − แล้ว "พอดีจอ" → กลับมาขนาดเดียวกัน · 3 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
await goView(page, 'pop-tublamu', 1000);
await page.evaluate(() => { window.pcCoName = () => 'TEST CO'; const P = 'tublamu', D = pcDay(P, '2026-10-15', true); D.out = [];
  for (let i = 0; i < 10; i++) D.out.push({ id: 'x' + i, txt: 'ค่ารถตู้นอกโซนภูเก็ต SL 15/10/26 (1คัน) นาย' + i, amt: 2800 + i * 100, at: '16:0' + i });
  _pcPier = P; _pcDate = '2026-10-15'; });
const M = [];
for (const [w, h] of [[1900, 1200], [1220, 880]]) {
  const [pop] = await Promise.all([page.context().waitForEvent('page'), page.evaluate(() => pcPrintCert())]);
  await pop.setViewportSize({ width: w, height: h }); await pop.waitForTimeout(700);
  const g = () => pop.evaluate(() => { const s = document.getElementById('sheet'), r = s.getBoundingClientRect(), tb = document.querySelector('.tb').offsetHeight;
    return { z: +(+getComputedStyle(s).zoom).toFixed(3), top: r.top, bottom: r.bottom, right: r.right, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, tb }; });
  const a = await g();
  await pop.evaluate(() => { zm(-1); }); await pop.waitForTimeout(200); const b = await g();
  await pop.evaluate(() => { zm(0); }); await pop.waitForTimeout(200); const c = await g();
  M.push({ w, h, a, b, c }); await pop.close();
}
const fits = x => x.a.bottom <= x.a.vh + 1 && x.a.right <= x.a.vw + 1 && ((x.a.h >= (x.a.vh - x.a.tb - 30) * 0.92) || (x.a.w >= (x.a.vw - 40) * 0.92));
if (M.every(fits)) ok('1 ทั้งหน้าอยู่ในจอและเต็มด้านหนึ่ง · ' + M.map(x => `${x.w}×${x.h} zoom ${x.a.z} (${Math.round(x.a.h)}/${x.a.vh}px)`).join(' · ')); else fail('1 ' + JSON.stringify(M));
if (M.every(x => x.b.z < x.a.z && Math.abs(x.c.z - x.a.z) < 0.01)) ok('2 ปุ่ม − ย่อได้ · "พอดีจอ" กลับมาขนาดพอดีจอเท่าเดิม'); else fail('2 ' + JSON.stringify(M.map(x => [x.a.z, x.b.z, x.c.z])));
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('3 ไม่มี error'); else fail('3 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
