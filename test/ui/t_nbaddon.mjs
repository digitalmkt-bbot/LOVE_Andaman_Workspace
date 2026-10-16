// §nbRvFlow · New Booking · แตะ add-on ได้ทุกขนาดจอ · แผง Booking Review ไม่ลอยทับฟอร์มบนจอแคบ
// ที่มา (2026-10-16) · owner "ตรวจในหน้า New booking รายการที่กด Addon เด้ง กดไม่ได้"
// สาเหตุ: ที่ <=820px กริดฟอร์มยุบเหลือคอลัมน์เดียว แต่แผง Review ยัง position:fixed → ทับ add-on
// กัน (ทุกความกว้าง 390 · 800 · 1389)
//   1 จุดกลางแถว add-on แรก (และช่องติ๊ก) เป็นของ add-on ไม่ใช่แผงอื่น
//   2 แตะแล้วติ๊กจริง (Longtail Join เข้า addOns) · แตะ Private Van แล้วเข้าเหมือนกัน
//   3 จอแคบ: แผง Review อยู่ใต้ฟอร์ม (ไม่ fixed) · จอใหญ่: ยัง fixed ลอยด้านขวาตามเดิม · 4 ไม่มี error
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
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
