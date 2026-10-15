// §bkMro · Booking · By trip บนมือถือ สำหรับผู้ใช้ดูได้อย่างเดียว
// ที่มา (2026-10-15) · owner: "User ที่ดูได้อย่างเดียว · โหมดจัดรถเรือไม่ต้องขึ้น · ชื่อ Agent ไม่ต้องแสดง · หมายถึงในหน้าโทรศัพท์" + mockup → "ทำเลย"
// กัน
//   1 มือถือ + ดูอย่างเดียว → เปิด · ซ่อนแท็บ Seat Locks/รออนุมัติ/Cancellations/All · + New booking · การ์ดโหมด Van/Boat/Re-confirm · Seat Lock · ตาราง
//     · การ์ด Programmes / Boats running / ค้นหา / Notice ยังอยู่ · ป้ายดูอย่างเดียว
//   2 การ์ดต่อใบ = จำนวนแถวในตาราง · ไม่มีชื่อเอเจนต์ ไม่มี ฿ · ไม่มีปุ่มอื่นนอกจากการ์ด · เวลา/เรือตรงกับแถว
//   3 แตะการ์ด → แผ่นรายละเอียด (voucher · ชื่อ · ไม่มีปุ่มนอกจากปิด) · ปิดได้
//   4 จอคอม หรือ ผู้ใช้แก้ไขได้ → ไม่เปิด (ตารางเดิม) · 5 อยู่แท็บ All แล้วเปิด → กลับ By trip · 6 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 390, height: 844 });
await page.evaluate(() => { window.__bkMroForce = true; });
await goView(page, 'booking', 800);
await page.evaluate(() => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = '2026-09-16'; bkV2Render(); }); await page.waitForTimeout(1200);
const vis = 'e => !!e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0';
const S = () => page.evaluate((visSrc) => { const vis = eval(visSrc); const h = document.getElementById('view-booking');
  const tab = k => vis(h.querySelector('.bkv2-utab[onclick*="\'' + k + '\'"]'));
  const mode = [...h.querySelectorAll('.bt-c')].find(c => c.querySelector('.bt-mrow'));
  const list = h.querySelector('.bk-mro-l');
  const rows = [...h.querySelectorAll('table.t2-mtbl tr.t2-row[data-al]')];
  const ags = [...new Set(rows.map(r => { const b = SB_BOOKINGS.find(x => x.id === r.getAttribute('data-al')); const a = b && sbGetAgent(b.agentId); return a && a.name; }).filter(n => n && n.length > 3))];
  const lt = list ? list.textContent : '';
  /* ชื่อเอเจนต์บางเจ้าเป็นชื่อเดียวกับโรงแรม/อยู่ในข้อความคำขอ (Club Wyndham · Lamoon Resotel) · นับเฉพาะชื่อที่มีแค่ในช่อง Agency */
  const iAg = [...h.querySelector('table.t2-mtbl').querySelectorAll('thead th')].findIndex(t => /^agency/i.test(t.textContent.trim()));
  const restTxt = rows.map(r => [...r.children].filter((c, i) => i !== iAg).map(c => c.textContent).join(' ')).join(' ');
  const agOnly = ags.filter(n => !restTxt.includes(n));
  return { on: document.body.classList.contains('bk-mro'), tabs: { cal: tab('cal'), bytrip: tab('bytrip'), all: tab('all'), locks: tab('locks'), appr: tab('approvals'), cancel: tab('cancel') },
    newbtn: vis(h.querySelector('.bkv2-newbtn2')) || vis(h.querySelector('.bkv2-newbtn')), mode: vis(mode), lock: vis(h.querySelector('.bt-lockc')), table: vis(h.querySelector('.t2-wrap')),
    prog: vis(h.querySelector('.bt-prog')), boat: vis(h.querySelector('.bt-boat')), search: vis(h.querySelector('#bt-q')), notice: vis(h.querySelector('.bt-notice')), ro: vis(h.querySelector('.bk-mro-ro')),
    cards: list ? list.querySelectorAll('.bk-mro-c').length : 0, rows: rows.length, agHit: agOnly.filter(n => lt.includes(n)), nAg: agOnly.length, agEl: list ? list.querySelectorAll('.t2-ag,[onclick*="AgentColor"]').length : -1, baht: /฿/.test(lt), otherBtns: list ? [...list.querySelectorAll('button')].filter(b => !b.classList.contains('bk-mro-c')).length : -1, tab: _bkV2.tab };
}, vis);
let a = await S();
if (a.on && a.tabs.cal && a.tabs.bytrip && !a.tabs.all && !a.tabs.locks && !a.tabs.appr && !a.tabs.cancel && !a.newbtn && !a.mode && !a.lock && !a.table && a.prog && a.boat && a.search && a.notice && a.ro)
  ok('1 มือถือ+ดูอย่างเดียว · เหลือแท็บ Calendar/By trip · ไม่มี New booking · ไม่มีการ์ดโหมด Van/Boat/Re-confirm · ไม่มี Seat Lock · ไม่มีตาราง · Programmes/Boats running/ค้นหา/Notice อยู่ · ป้ายดูอย่างเดียว');
else fail('1 ' + JSON.stringify(a));
const chk = await page.evaluate(() => { const rows = [...document.querySelectorAll('table.t2-mtbl tr.t2-row[data-al]')]; const cards = [...document.querySelectorAll('.bk-mro-c')];
  const ths = [...document.querySelector('table.t2-mtbl').querySelectorAll('thead th')].map(t => t.textContent.trim().toLowerCase()); const iT = ths.findIndex(x => /^time/.test(x));
  const bad = []; rows.forEach((r, i) => { const c = cards[i]; if (!c) { bad.push(i); return; } const tm = (r.children[iT].textContent.match(/\d{1,2}[:.]\d{2}/) || [''])[0]; if (tm && !c.querySelector('.tm').textContent.startsWith(tm)) bad.push('tm' + i);
    const be = r.lastElementChild.querySelector('[title$="เรือที่ขึ้น"]'); const bn = be ? be.getAttribute('title').split(' · ')[0] : ''; if (bn && !c.textContent.includes('→ ' + bn)) bad.push('bt' + i); });
  return { bad: bad.slice(0, 5), n: rows.length }; });
if (a.cards === a.rows && a.rows > 0 && a.nAg > 0 && !a.agHit.length && a.agEl === 0 && !a.baht && a.otherBtns === 0 && !chk.bad.length) ok(`2 การ์ด ${a.cards} ใบ = แถวตาราง · เวลา/เรือตรง · ไม่มีชื่อเอเจนต์ (${a.nAg} เจ้าในวันนั้น) · ไม่มี ฿ · ไม่มีปุ่มอื่น`);
else fail('2 ' + JSON.stringify({ cards: a.cards, rows: a.rows, agHit: a.agHit, baht: a.baht, other: a.otherBtns, chk }));
// 3 sheet
await page.evaluate(() => document.querySelectorAll('.bk-mro-c')[2].click()); await page.waitForTimeout(300);
const sh = await page.evaluate(() => { const s = document.getElementById('bk-mro-sh'); if (!s) return null; const id = [...document.querySelectorAll('table.t2-mtbl tr.t2-row[data-al]')][2].getAttribute('data-al'); const b = SB_BOOKINGS.find(x => x.id === id); const ag = sbGetAgent(b.agentId);
  return { name: s.textContent.includes(b.leadPax), btns: [...s.querySelectorAll('button')].map(x => x.getAttribute('aria-label') || x.textContent), ag: !!(ag && ag.name && ag.name.length > 3 && s.textContent.includes(ag.name)), baht: /฿/.test(s.textContent) }; });
await page.evaluate(() => document.querySelector('#bk-mro-sh .x').click()); await page.waitForTimeout(150);
const shGone = await page.evaluate(() => !document.getElementById('bk-mro-sh'));
if (sh && sh.name && sh.btns.length === 1 && !sh.ag && !sh.baht && shGone) ok('3 แตะการ์ด → แผ่นรายละเอียด (ชื่อลูกค้า · ไม่มีชื่อเอเจนต์/เงิน · มีแค่ปุ่มปิด) · ปิดได้'); else fail('3 ' + JSON.stringify({ sh, shGone }));
// 5 tab all → back to bytrip
await page.evaluate(() => { _bkV2.tab = 'all'; bkV2Render(); }); await page.waitForTimeout(700); const t5 = await page.evaluate(() => _bkV2.tab);
// 4 desktop / editor
await page.setViewportSize({ width: 1500, height: 900 }); await page.waitForTimeout(600); const d4 = await S();
await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { window.__bkMroForce = false; bkV2Render(); }); await page.waitForTimeout(600); const e4 = await S();
if (!d4.on && d4.table && d4.tabs.all && !e4.on && e4.table) ok('4 จอคอม (ดูอย่างเดียว) → ตารางเดิม · มือถือแต่แก้ไขได้ → ตารางเดิม'); else fail('4 ' + JSON.stringify({ d4: { on: d4.on, table: d4.table, all: d4.tabs.all }, e4: { on: e4.on, table: e4.table } }));
if (t5 === 'bytrip') ok('5 อยู่แท็บ All bookings ตอนเปิดผิวมือถือ → พากลับ By trip'); else fail('5 ' + t5);
const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('6 ไม่มี error'); else fail('6 ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
