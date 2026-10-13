// §vckStay · Van Check-in · ติ๊กแล้วตารางต้องไม่เด้งกลับขึ้นบน
//
// ที่มา (9 ต.ค. 2026) · เจ้าของ: "Van Check-in ตรวจดูเรื่อง ติ๊ก แล้วเด้ง หน่อย"
//   สาเหตุ · ตารางเลื่อนในกล่องของตัวเอง (.vck-tw) · ติ๊กแล้ววาดใหม่ทั้งหน้า กล่องใหม่เริ่มที่ 0
//   ckAfter คืนตำแหน่งให้หน้าจอ (window) อย่างเดียว
//
// กันสามอย่าง
//   1 เลื่อนตารางลงไป แล้วเปลี่ยนแถวล่าง ๆ เป็น "ขึ้นรถแล้ว" · เช็คอินได้จริง และตารางอยู่ตำแหน่งเดิม
//   2 ย้อนแถวเดิมกลับเป็น "รอ" (ถอนติ๊ก) · ไม่เด้งเหมือนกัน
//   3 วาดใหม่จากที่อื่น (รีเฟรช / นาฬิกา) ก็ไม่เด้ง · ไม่มี error
import { open } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 900 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1200);
const SEL = '#vancheckin-host .vck-tw select.vck-sel';
const prep = await page.evaluate((SEL) => {
  const el = document.querySelector('.nav-item[data-view="vancheckin"]'); if (el) nav(el);
  const c = {}; (SB_BOOKINGS || []).forEach(b => (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }));
  let best = null, bestN = 0;
  for (const d of Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 25)) {
    _vanCkDate = d; renderVanCheckin(); const n = document.querySelectorAll(SEL).length;
    if (n > bestN) { bestN = n; best = d; } if (n >= 6) break;
  }
  _vanCkDate = best; renderVanCheckin();
  const st = document.createElement('style'); st.textContent = '#vancheckin-host .vck-tw{max-height:220px !important;min-height:0 !important}'; document.head.appendChild(st);
  return { day: best, n: bestN };
}, SEL);
if (!(prep.n >= 2)) { fail('prep ' + JSON.stringify(prep)); await close(); process.exit(1); }
await page.waitForTimeout(300);
const pane = () => page.evaluate(() => { const w = document.querySelector('#vancheckin-host .vck-tw'); return w ? { top: Math.round(w.scrollTop), max: w.scrollHeight - w.clientHeight } : null; });
const S0 = await page.evaluate(() => { const w = document.querySelector('#vancheckin-host .vck-tw'); w.scrollTop = w.scrollHeight; return Math.round(w.scrollTop); });
let _id = null;
const setSt = (v) => page.evaluate(({ v, id, SEL }) => {
  const bs = [...document.querySelectorAll(SEL)];
  const pick = x => /vckStatus\('([^']+)','([^']+)','([^']+)'/.exec(x.getAttribute('onchange') || '');
  const b = id ? bs.find(x => { const m = pick(x); return m && m[1] === id; }) : bs[bs.length - 1];
  const m = pick(b);
  b.value = v; b.dispatchEvent(new Event('change', { bubbles: true }));
  const bk = SB_BOOKINGS.find(x => x.id === m[1]);
  return { id: m[1], at: !!((ckRead(bk, m[2], m[3]) || {}).at) };
}, { v, id: _id, SEL });
const t1 = await setSt('checkin'); _id = t1.id; await page.waitForTimeout(400);
const p1 = await pane();
if (S0 > 0 && t1.at && p1 && Math.abs(p1.top - S0) <= 2) ok(`1 เช็คอินแถวล่างสุด (${t1.id}) · ตารางอยู่ที่ ${p1.top}px เท่าเดิม (ก่อนกด ${S0}) · วัน ${prep.day} ${prep.n} แถว`);
else fail('1 ' + JSON.stringify({ S0, t1, p1, prep }));
const t2 = await setSt('pending'); await page.waitForTimeout(400);
const p2 = await pane();
if (!t2.at && p2 && Math.abs(p2.top - S0) <= 2) ok('2 ย้อนเป็น "รอ" (ถอนติ๊ก) · ไม่เด้ง');
else fail('2 ' + JSON.stringify({ t2, p2, S0 }));
await page.evaluate(() => renderVanCheckin()); await page.waitForTimeout(300);
const p3 = await pane();
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (p3 && Math.abs(p3.top - S0) <= 2 && !e1.length) ok('3 วาดใหม่จากที่อื่นก็ไม่เด้ง · ไม่มี error');
else fail('3 ' + JSON.stringify({ p3, S0 }) + ' ' + e1.slice(0, 2).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
