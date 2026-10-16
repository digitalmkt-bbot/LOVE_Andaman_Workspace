// §nbRvFlow · New Booking · แตะ add-on ได้ทุกขนาดจอ · แผง Booking Review ไม่ลอยทับฟอร์มบนจอแคบ
// ที่มา (2026-10-16) · owner "ตรวจในหน้า New booking รายการที่กด Addon เด้ง กดไม่ได้"
// สาเหตุ: ที่ <=820px กริดฟอร์มยุบเหลือคอลัมน์เดียว แต่แผง Review ยัง position:fixed → ทับ add-on
// กัน (ทุกความกว้าง 390 · 800 · 1389)
//   1 จุดกลางแถว add-on แรก (และช่องติ๊ก) เป็นของ add-on ไม่ใช่แผงอื่น
//   2 แตะแล้วติ๊กจริง (Longtail Join เข้า addOns) · แตะ Private Van แล้วเข้าเหมือนกัน
//   3 จอแคบ: แผง Review อยู่ใต้ฟอร์ม (ไม่ fixed) · จอใหญ่: ยัง fixed ลอยด้านขวาตามเดิม · 4 ไม่มี error
// §nbVanKeep (owner "ใน Rate type ก็มี ตอนเลือกก็มี แต่พอกดเพิ่ม เด้งหาย") · เส้นที่ไม่มีหางยาว (r5 ของเรท a01)
//   5 ติ๊ก Private Van · Khao Lak → การ์ด Add-ons ยังอยู่ · ติ๊กค้าง · ที่นั่งย้ายไป No-Transfer · เอาติ๊กออกได้ (addOns ว่าง)
//   6 ที่นั่งเป็น No-Transfer ตั้งแต่แรก ก็ยังเห็นเหมารถ
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
for (const W of [390, 800, 1389]) {
  const { page, errors, close } = await open({ blob: process.env.LAD, width: W, height: 860 });
  await goView(page, 'booking', 1000);
  await page.evaluate(() => { window.laGuardEdit = () => true; bkV2NewBooking(); const d = _bkV2.newBooking; d.agentId = 'a01';
    d.trips[0].routeId = 'r10'; d.trips[0].pax.ad_fr = 2; bkV2Render(); });
  await page.waitForTimeout(700);
  const hitAt = async (i, dx) => { const l = page.locator('.bkv2-nb-addon').nth(i); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
    const b = await l.boundingBox(); const x = dx == null ? b.x + b.width / 2 : b.x + dx, y = b.y + Math.min(20, b.height / 2);
    const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.bkv2-nb-addon')); }, [x, y]);
    return { hit, x, y }; };
  const h0 = await hitAt(0), h0c = await hitAt(0, 18);
  if (h0.hit && h0c.hit) ok(W + 'px · 1 แถว add-on แตะได้ (กลางแถว + ช่องติ๊ก)'); else fail(W + 'px · 1 ' + JSON.stringify({ h0, h0c }));
  await page.mouse.click(h0.x, h0.y); await page.waitForTimeout(400);
  const h2 = await hitAt(2); await page.mouse.click(h2.x, h2.y); await page.waitForTimeout(400);
  const ao = await page.evaluate(() => _bkV2.newBooking.addOns.map(a => a.type));
  if (ao.includes('longtail-join') && ao.some(t => /^transfer-r10-/.test(t))) ok(W + 'px · 2 แตะแล้วติ๊กจริง: ' + ao.join(', ')); else fail(W + 'px · 2 ' + JSON.stringify(ao));
  const rv = await page.evaluate(() => { const s = document.querySelector('.bkv2-review-sticky'), f = document.querySelector('.bkv2-nb-addon');
    return { pos: getComputedStyle(s).position, below: s.getBoundingClientRect().top + scrollY >= f.getBoundingClientRect().bottom + scrollY - 1 }; });
  const want = W <= 820 ? (rv.pos === 'static' && rv.below) : rv.pos === 'fixed';
  if (want) ok(W + 'px · 3 แผง Review ' + (W <= 820 ? 'อยู่ใต้ฟอร์ม' : 'ลอยด้านขวาตามเดิม')); else fail(W + 'px · 3 ' + JSON.stringify(rv));
  const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
  if (!e1.length) ok(W + 'px · 4 ไม่มี error'); else fail(W + 'px · 4 ' + e1.slice(0, 3).join(' | '));
  await close();
}
{
  const { page, errors, close } = await open({ blob: process.env.LAD, width: 1389, height: 860 });
  await goView(page, 'booking', 1000);
  await page.evaluate(() => { window.laGuardEdit = () => true; bkV2NewBooking(); const d = _bkV2.newBooking; d.agentId = 'a01';
    d.trips[0].routeId = 'r5'; d.trips[0].pax.ad_fr = 2; bkV2Render(); });
  await page.waitForTimeout(700);
  const st = () => page.evaluate(() => { const L = [...document.querySelectorAll('.bkv2-nb-addon')];
    return { n: L.length, on: L.filter(l => l.querySelector('input').checked).map(l => l.innerText.split('\n')[0].trim()), ao: _bkV2.newBooking.addOns.map(a => a.type), zone: _bkV2.newBooking.trips[0].zone }; });
  const s0 = await st();
  const kl = page.locator('.bkv2-nb-addon', { hasText: 'Khao Lak' }).first();
  await kl.scrollIntoViewIfNeeded(); await kl.click(); await page.waitForTimeout(500);
  const s1 = await st();
  const kl2 = page.locator('.bkv2-nb-addon', { hasText: 'Khao Lak' }).first();
  let s2 = { n: -1 };
  if (await kl2.count()) { await kl2.click(); await page.waitForTimeout(500); s2 = await st(); }
  if (s0.n === 2 && s1.n === 2 && s1.on.length === 1 && /Khao Lak/.test(s1.on[0]) && s1.zone === 'NoTransfer' && s1.ao.length === 1 && s2.ao && s2.ao.length === 0 && s2.n === 2)
    ok('5 r5 (ไม่มีหางยาว) · ติ๊ก Private Van KL แล้วการ์ดยังอยู่ · ที่นั่ง No-Transfer · เอาออกได้');
  else fail('5 ' + JSON.stringify({ s0, s1, s2 }));
  const s3 = await page.evaluate(() => { const d = _bkV2.newBooking; d.addOns = []; d.trips[0].zone = 'NoTransfer'; bkV2Render(); return document.querySelectorAll('.bkv2-nb-addon').length; });
  if (s3 === 2) ok('6 ที่นั่ง No-Transfer ตั้งแต่แรก · ยังเห็นเหมารถ 2 แบบ'); else fail('6 ' + s3);
  const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
  if (e1.length) fail('5/6 error ' + e1.slice(0, 3).join(' | '));
  await close();
}
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
