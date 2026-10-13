// §nbSideLive · ฟอร์มจอง · พิมพ์เหตุผล FOC แล้วปุ่ม Update / Submit ต้องกดได้ทันที
//
// ที่มา (9 ต.ค. 2026) · เจ้าของ: "เขียน FOC แล้ว ยังไม่สามารถกดอัพเดทได้ ติดตรงไหนเหรอ"
//   สาเหตุ · ช่องเหตุผล FOC ตั้งใจไม่วาดฟอร์มใหม่ (กันหลุดโฟกัส) · กล่องเช็คกับปุ่มทางขวาเลยค้างของเก่า
//
// กันสี่อย่าง
//   1 ก่อนพิมพ์ · ปุ่ม "Update · FOC review" กดไม่ได้ · กล่องเช็คขึ้น "Enter the FOC reason"
//   2 พิมพ์ทีละตัวในช่องเหตุผล · ปุ่มกดได้ทันที กล่องเช็คไม่ขอเหตุผล FOC แล้ว · ช่องที่พิมพ์ยังมีโฟกัส ข้อความครบ
//   3 ลบข้อความจนว่าง · ปุ่มกลับเป็นกดไม่ได้
//   4 ชื่อลูกค้า (lead) ก็เหมือนกัน · ลบชื่อแล้วปุ่มปิด พิมพ์กลับแล้วปุ่มเปิด · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1000 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);
const prep = await page.evaluate(() => {
  const bk = SB_BOOKINGS.find(b => b.status === 'confirmed' && b.agentId && b.leadPax && (b.trips || []).length === 1 && b.trips[0].routeId && b.trips[0].date && !/^b2c_/.test(b.id) && b.rateTypeRef);
  if (!bk) return { err: 'no editable booking' };
  bookingV2EditBooking(bk.id);
  const d = _bkV2.newBooking; if (!d) return { err: 'edit form did not open' };
  d.trips[0].pax = Object.assign({}, d.trips[0].pax, { foc: 2 }); d.focReason = ''; bookingV2Render();
  const ta = [...document.querySelectorAll('textarea')].find(t => /bookingV2SetFocReason/.test(t.getAttribute('oninput') || ''));
  return { id: bk.id, foc: bookingV2CalcQuote().totalFoc, ta: !!ta };
});
if (prep.err || !prep.ta || !(prep.foc > 0)) { fail('prep ' + JSON.stringify(prep)); await close(); process.exit(1); }
const read = () => page.evaluate(() => {
  const btn = [...document.querySelectorAll('#nbf-submit-slot button')][0];
  const chk = (document.getElementById('nbf-checks-slot') || {}).textContent || '';
  const ta = [...document.querySelectorAll('textarea')].find(t => /bookingV2SetFocReason/.test(t.getAttribute('oninput') || ''));
  return { btn: btn ? btn.textContent.trim() : null, dis: btn ? btn.disabled : null, need: /Enter the FOC reason/.test(chk), done: /FOC reason entered/.test(chk),
    focus: document.activeElement === ta, val: ta ? ta.value : null };
});
const R1 = await read();
if (R1.dis === true && R1.need && /FOC review/.test(R1.btn || '')) ok('1 ก่อนพิมพ์ · "' + R1.btn + '" กดไม่ได้ · กล่องเช็คขอเหตุผล FOC');
else fail('1 ' + JSON.stringify(R1));
const sel = 'textarea[oninput*="bookingV2SetFocReason"]';
await page.click(sel); await page.type(sel, 'FOC : Guide', { delay: 15 }); await page.waitForTimeout(150);
const R2 = await read();
if (R2.dis === false && !R2.need && R2.focus && R2.val === 'FOC : Guide') ok('2 พิมพ์ "FOC : Guide" · ปุ่มกดได้ทันที · กล่องเช็คผ่าน · ช่องยังโฟกัสอยู่ ข้อความครบ');
else fail('2 ' + JSON.stringify(R2));
await page.click(sel, { clickCount: 3 }); await page.keyboard.press('Backspace'); await page.waitForTimeout(150);
const R3 = await read();
if (R3.dis === true && R3.need && R3.val === '') ok('3 ลบจนว่าง · ปุ่มกลับเป็นกดไม่ได้');
else fail('3 ' + JSON.stringify(R3));
await page.type(sel, 'Guide FOC', { delay: 10 }); await page.waitForTimeout(150);
const lead = await page.evaluate(() => { const i = [...document.querySelectorAll('input')].find(x => /bookingV2SetBookingField\('leadPax'/.test(x.getAttribute('oninput') || '')); return !!i; });
let R4 = { lead };
if (lead) {
  const ls = 'input[oninput*="bookingV2SetBookingField(\'leadPax\'"]';
  const v0 = await page.$eval(ls, e => e.value);
  await page.click(ls, { clickCount: 3 }); await page.keyboard.press('Backspace'); await page.waitForTimeout(150);
  R4.off = (await read()).dis;
  await page.type(ls, v0 || 'Test Guest', { delay: 5 }); await page.waitForTimeout(150);
  R4.on = (await read()).dis;
  R4.focus = await page.evaluate(() => /leadPax/.test((document.activeElement && document.activeElement.getAttribute('oninput')) || ''));
}
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (R4.lead && R4.off === true && R4.on === false && R4.focus && !e1.length) ok('4 ชื่อลูกค้า · ลบแล้วปุ่มปิด พิมพ์กลับแล้วปุ่มเปิด · ช่องยังโฟกัส · ไม่มี error');
else fail('4 ' + JSON.stringify(R4) + ' ' + e1.slice(0, 2).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
