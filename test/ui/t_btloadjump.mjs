// §btLoadJump · By trip date · เลื่อนไปวันถัดไปแล้ว scroll ลงทันที · ต้องไม่ค้าง/ไม่เด้งกลับขึ้นบน
//
// ที่มา (28 พ.ย. 2026) · เจ้าของ: "ไปที่หน้า By trip date เวลาเลื่อนไปวันถัดไป จะต้องใช้เวลารอนิดนึง เพื่อให้ระบบโหลดข้อมูล
//   ถ้าเลื่อนแล้ว scroll down เลย จะค้างและเด้งใหม่"
//   สาเหตุ · คำตอบของวันใหม่ (bookings ของวัน, /operations/by-trip, van board, ...) มาถึงทีละตัว แต่ละตัววาดทั้งหน้าใหม่ทันที
//   ด้วย bookingV2Render() ที่ไม่จำตำแหน่งเลื่อน · หลายรอบติดกัน = ค้าง · ตารางกลับไปบนสุด = เด้ง
//
// จำลอง: โหลดของวันใหม่ใช้เวลา 600 ms แล้วตามด้วยคำตอบอีกสองตัว (เหมือน by-trip + van board) · ระหว่างนั้นเลื่อนลงด้วยล้อเมาส์
//   1 หลังคำตอบมาครบ ตำแหน่งเลื่อนยังอยู่ที่ที่เลื่อนไว้ (ไม่กลับขึ้นบน)
//   2 ไม่วาดทั้งหน้าระหว่างที่ยังเลื่อนอยู่ และคำตอบที่มาพร้อมกันวาดรวมรอบเดียว
//   3 ระหว่างโหลดขึ้นป้าย "กำลังโหลด" · 4 โหลดวันข้าง ๆ ไว้ล่วงหน้า
//   5 คำตอบของวันที่ไม่ได้เปิดอยู่แล้ว ไม่วาดอะไร · ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1400, height: 800 });
page.on('dialog', d => d.accept());
await goView(page, 'booking', 900);
await page.evaluate(() => {
  _bkV2.filterDate = bookingV2LocalYMD(new Date()); _bkV2.filterRoute = null; bookingV2SwitchTab('bytrip');
  /* ทำให้หน้ายาวพอเลื่อนได้แน่ ๆ ไม่ว่าชุดข้อมูลมีกี่แถว */
  const st = document.createElement('style'); st.textContent = '.bkv2-bodycard{min-height:5000px !important} #la-login{display:none !important} html{overflow:auto !important}'; document.head.appendChild(st);
  /* นับการวาดทั้งหน้า + วันใหม่โหลด 600 ms แล้วตามด้วยคำตอบอีกสองตัว */
  window._T = { draws: [], drawsWhileScrolling: 0 };
  const R = window.bookingV2Render;
  window.bookingV2Render = function(){ _T.draws.push(Date.now()); if(Date.now() - (_T.lastWheel || 0) < 200) _T.drawsWhileScrolling++; return R.apply(this, arguments); };
  const seen = new Set([_bkV2.filterDate]), pending = new Set();
  _T.asked = [];
  window.bookingV2OpsDayStatus = d => pending.has(d) ? 'loading' : '';
  window.bookingV2OpsEnsureDay = function(date){
    _T.asked.push(date);
    if(seen.has(date)) return null; seen.add(date); pending.add(date);
    return new Promise(res => setTimeout(() => {
      pending.delete(date); res({ bookings: [] });
      /* เหมือน /operations/by-trip กับ van board มาถึงตามกันมา */
      const later = () => typeof bookingV2RedrawAfterLoad === 'function' ? bookingV2RedrawAfterLoad(() => bookingV2Tab2ActiveDate() === date) : bookingV2Render();   /* ก่อนแก้: วาดทันที */
      setTimeout(later, 40); setTimeout(later, 90);
    }, 600));
  };
});
await page.waitForTimeout(600);
const scroller = () => page.evaluate(() => {
  const m = document.querySelector('.main'); const se = document.scrollingElement;
  return { main: m ? Math.round(m.scrollTop) : 0, win: Math.round(se.scrollTop) };
});
const pos = s => Math.max(s.main, s.win);
await page.evaluate(() => { _T.draws.length = 0; bookingV2Tab2DateShift(1); _T.draws.length = 0; });
await page.mouse.move(700, 500);
const chipDuring = await page.evaluate(() => !!document.querySelector('.bt-dayload'));
for (let i = 0; i < 12; i++) { await page.evaluate(() => { _T.lastWheel = Date.now(); }); await page.mouse.wheel(0, 120); await page.waitForTimeout(70); }
const mid = await scroller();
await page.waitForTimeout(1600);
const end = await scroller();
const T = await page.evaluate(() => ({ draws: _T.draws.length, dws: _T.drawsWhileScrolling }));
if (pos(mid) > 300 && Math.abs(pos(end) - pos(mid)) <= 4) ok(`1 เลื่อนลงไป ${pos(mid)}px ระหว่างโหลด · คำตอบมาครบแล้วยังอยู่ที่ ${pos(end)}px`);
else fail('1 ' + JSON.stringify({ mid, end }));
if (T.dws === 0 && T.draws === 1) ok(`2 วาดใหม่ ${T.draws} รอบ หลังหยุดเลื่อน · ระหว่างเลื่อน ${T.dws} รอบ`);
else fail('2 ' + JSON.stringify(T));
const P = await page.evaluate(() => { const d = bookingV2Tab2ActiveDate(), f = n => { const x = new Date(d + 'T00:00'); x.setDate(x.getDate() + n); return bookingV2LocalYMD(x); };
  return { chipAfter: !!document.querySelector('.bt-dayload'), next: _T.asked.includes(f(1)), prev: _T.asked.includes(f(-1)) }; });
if (chipDuring && !P.chipAfter) ok('3 ระหว่างโหลดขึ้น "กำลังโหลดข้อมูลวันนี้…" · โหลดเสร็จแล้วหายไป'); else fail('3 ' + JSON.stringify({ chipDuring, P }));
if (P.next && P.prev) ok('4 โหลดวันก่อน/วันถัดไปไว้ล่วงหน้า (กด ‹ › แล้วขึ้นทันที)'); else fail('4 ' + JSON.stringify(P));
/* 5 · คำตอบของวันที่ปิดไปแล้ว */
await page.evaluate(() => { _T.draws.length = 0; if (typeof bookingV2RedrawAfterLoad === 'function') bookingV2RedrawAfterLoad(() => bookingV2Tab2ActiveDate() === '1999-01-01'); });
await page.waitForTimeout(500);
const n3 = await page.evaluate(() => _T.draws.length);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (n3 === 0 && !e1.length) ok('5 คำตอบของวันที่ไม่ได้เปิด ไม่วาด · ไม่มี error'); else fail('5 ' + n3 + ' ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
