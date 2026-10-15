// §bkMro · Booking · By trip บนมือถือ สำหรับผู้ใช้ดูได้อย่างเดียว
// ที่มา (2026-10-15) · owner: "User ที่ดูได้อย่างเดียว · โหมดจัดรถเรือไม่ต้องขึ้น · ชื่อ Agent ไม่ต้องแสดง · หมายถึงในหน้าโทรศัพท์" + mockup → "ทำเลย"
// กัน
//   1 มือถือ + ดูอย่างเดียว → เปิด · ซ่อนแท็บ Seat Locks/รออนุมัติ/Cancellations/All · + New booking · การ์ดโหมด Van/Boat/Re-confirm · Seat Lock · ตาราง
//     · การ์ด Programmes / Boats running / ค้นหา / Notice ยังอยู่ · ป้ายดูอย่างเดียว
//   2 การ์ดต่อใบ = จำนวนแถวในตาราง · ไม่มีชื่อเอเจนต์ ไม่มี ฿ · ไม่มีปุ่มอื่นนอกจากการ์ด · เวลา/เรือตรงกับแถว
//   3 แตะการ์ด → แผ่นรายละเอียด (voucher · ชื่อ · ไม่มีปุ่มนอกจากปิด) · ปิดได้
//   4 จอคอม หรือ ผู้ใช้แก้ไขได้ → ไม่เปิด (ตารางเดิม) · 5 อยู่แท็บ All แล้วเปิด → กลับ By trip · 6 ไม่มี error
// รอบ 2 (owner ส่งภาพมือถือจริง: "ยังไม่เหมือน Mockup · Calendar ให้เหลือแค่ปฏิทิน · มันโยกไปมาได้")
//   7 ไม่มีอะไรล้นจอ (360px) ทั้ง By trip และ Calendar · ยกเว้นของในแถบเลื่อนของตัวเอง · หัวไม่ตรึง (sticky) แล้ว
//   8 หัวแบบ mockup: แท็บ 2 อัน + ป้าย · แถบวันที่ · ยอด booking/pax/ลำ ตรงกับหน้าคอม · Programmes / Boats running วาดใหม่ (การ์ดหน้าคอมซ่อน)
//   9 ใบยกเลิกพับไว้ท้ายหน้า · รวมทั้งวันตรงกับยอดหน้าคอม · รวมท้ายเส้นทาง
//  10 Calendar เหลือแค่ปฏิทิน (ไม่มีการ์ดสถิติ / ค่าเฉลี่ย / แผงขวา) · 7 คอลัมน์พอดีจอ · แตะวัน → By trip ของวันนั้น
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 390, height: 844 });
await page.evaluate(() => { window.__bkMroForce = true; });
await goView(page, 'booking', 800);
await page.evaluate(() => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = '2026-09-16'; bkV2Render(); }); await page.waitForTimeout(1200);
const vis = 'e => !!e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0';
const S = () => page.evaluate((visSrc) => { const vis = eval(visSrc); const h = document.getElementById('view-booking');
  const tab = k => vis(h.querySelector('.bk-mro-tabs button[onclick*="\'' + k + '\'"]')) || vis(h.querySelector('.bkv2-utab[onclick*="\'' + k + '\'"]'));
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
    prog: vis(h.querySelector('.bt-prog')), boat: vis(h.querySelector('.bt-boat')), mprog: vis(h.querySelector('.bk-mro-pg')), mboat: vis(h.querySelector('.bk-mro-bc')), search: vis(h.querySelector('#bt-q')), notice: vis(h.querySelector('.bt-notice')), ro: vis(h.querySelector('.bk-mro-ro')),
    cards: list ? list.querySelectorAll('.bk-mro-c').length : 0, rows: rows.length, agHit: agOnly.filter(n => lt.includes(n)), nAg: agOnly.length, agEl: list ? list.querySelectorAll('.t2-ag,[onclick*="AgentColor"]').length : -1, baht: /฿/.test(lt), otherBtns: list ? [...list.querySelectorAll('button')].filter(b => !b.classList.contains('bk-mro-c')).length : -1, tab: _bkV2.tab };
}, vis);
let a = await S();
if (a.on && a.tabs.cal && a.tabs.bytrip && !a.tabs.all && !a.tabs.locks && !a.tabs.appr && !a.tabs.cancel && !a.newbtn && !a.mode && !a.lock && !a.table && !a.prog && !a.boat && a.mprog && a.mboat && a.search && a.notice && a.ro)
  ok('1 มือถือ+ดูอย่างเดียว · เหลือแท็บ Calendar/By trip · ไม่มี New booking · ไม่มีการ์ดโหมด Van/Boat/Re-confirm · ไม่มี Seat Lock · ไม่มีตาราง · Programmes/Boats running (วาดใหม่)/ค้นหา/Notice อยู่ · ป้ายดูอย่างเดียว');
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
// 7-10 · รอบ 2
const OVF = `(() => { const vw = document.documentElement.clientWidth, out = [];
  const scroller = e => { for (let p = e.parentElement; p && p.id !== 'view-booking'; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  document.querySelectorAll('#view-booking *').forEach(e => { const b = e.getBoundingClientRect(); if (b.width && b.right > vw + 1 && getComputedStyle(e).display !== 'none' && !scroller(e)) out.push((typeof e.className === 'string' && e.className.slice(0, 30)) || e.tagName); });
  return { sw: document.documentElement.scrollWidth, vw, out: out.slice(0, 5), n: out.length,
    sticky: [...document.querySelectorAll('#view-booking .bkv2-topcard,#view-booking .bt-pkh')].filter(e => getComputedStyle(e).position === 'sticky').length }; })()`;
await page.setViewportSize({ width: 360, height: 800 }); await page.waitForTimeout(500);
const o7a = await page.evaluate(OVF);
await page.evaluate(() => bkV2SwitchTab('cal')); await page.waitForTimeout(800);
const o7b = await page.evaluate(OVF);
if (o7a.sw <= o7a.vw && !o7a.n && !o7a.sticky && o7b.sw <= o7b.vw && !o7b.n && !o7b.sticky) ok('7 จอ 360px · By trip และ Calendar ไม่มีอะไรล้นจอ (ไม่โยก) · หัวไม่ตรึงทับหัวแอป');
else fail('7 ' + JSON.stringify({ o7a, o7b }));
// 10 calendar
const c10 = await page.evaluate((visSrc) => { const vis = eval(visSrc); const h = document.getElementById('view-booking');
  const g = h.querySelector('.bkv2-cal-grid'), vw = document.documentElement.clientWidth;
  const cell = [...h.querySelectorAll('.bkv2-cal-cell')].find(c => /'(\d{4}-\d{2}-\d{2})'/.test(c.getAttribute('onclick') || '') && !/past/.test(c.className)) || [...h.querySelectorAll('.bkv2-cal-cell')].find(c => /'(\d{4}-\d{2}-\d{2})'/.test(c.getAttribute('onclick') || ''));
  const d = cell ? /'(\d{4}-\d{2}-\d{2})'/.exec(cell.getAttribute('onclick'))[1] : '';
  const r = { stats: vis(h.querySelector('.bkv2-stats')), avg: vis(h.querySelector('.bkv2-routes')), side: vis(h.querySelector('.bkv2-selday')), hints: vis(h.querySelector('.bkv2-foot-hints')),
    grid: vis(g), gw: g ? Math.round(g.getBoundingClientRect().right) : 0, vw, cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0, d, tabs: h.querySelectorAll('.bk-mro-tabs button').length };
  if (cell) cell.click(); return r; }, vis);
await page.waitForTimeout(900);
const c10b = await page.evaluate(() => ({ tab: _bkV2.tab, d: bkV2Tab2ActiveDate(), sel: _bkV2.selected }));
if (!c10.stats && !c10.avg && !c10.side && !c10.hints && c10.grid && c10.gw <= c10.vw && c10.cols === 7 && c10.d && c10b.tab === 'bytrip' && c10b.d === c10.d && !c10b.sel)
  ok(`10 Calendar เหลือแค่ปฏิทิน (ไม่มีการ์ดสถิติ/ค่าเฉลี่ย/แผงขวา) · 7 คอลัมน์พอดีจอ · แตะ ${c10.d} → By trip วันนั้น`);
else fail('10 ' + JSON.stringify({ c10, c10b }));
await page.evaluate(() => { _bkV2.tab = 'bytrip'; _bkV2.filterDate = '2026-09-16'; bkV2Render(); }); await page.waitForTimeout(1000);
// 8 header
const c8 = await page.evaluate(() => { const h = document.getElementById('view-booking');
  const dt = [...h.querySelectorAll('.bt-prog .bt-daytot b')].map(b => +b.textContent);
  const tl = [...h.querySelectorAll('.bk-mro-tiles b')].map(b => +b.textContent);
  const bc = h.querySelector('.bt-boat .bt-ct .bt-cnt'); const nb = bc ? +(bc.textContent.match(/\d+/) || [0])[0] : -1;
  const fams = h.querySelectorAll('.bt-prog .bt-pgf').length, pf = h.querySelectorAll('.bk-mro-pg .bk-mro-pf').length;
  const tps = h.querySelectorAll('.bt-boat .bt-tgp').length, mtp = h.querySelectorAll('.bk-mro-bc .bk-mro-tp').length;
  const chips = [...h.querySelectorAll('.bk-mro-pg .bk-mro-chips button')].map(b => b.textContent.trim());
  return { dt, tl, nb, fams, pf, tps, mtp, chips, date: !!h.querySelector('.bk-mro-date .dn'), dn: (h.querySelector('.bk-mro-date .dn') || {}).textContent, tabs: h.querySelectorAll('.bk-mro-tabs .seg button').length, ro: !!h.querySelector('.bk-mro-tabs .bk-mro-ro') }; });
if (c8.tabs === 2 && c8.ro && c8.date && c8.dn === '16' && c8.tl[0] === c8.dt[0] && c8.tl[1] === c8.dt[1] && c8.tl[2] === c8.nb && c8.pf === c8.fams && c8.fams > 0 && c8.mtp === c8.tps && c8.chips.length === 4 && c8.chips.every(Boolean))
  ok(`8 หัวแบบ mockup · แท็บ 2 + ป้าย · วันที่ 16 · ยอด ${c8.tl.join('/')} = หน้าคอม · Programmes ${c8.pf} แถว · Boats running ${c8.mtp} ทริป · ชิปท่า ${c8.chips.join(',')}`);
else fail('8 ' + JSON.stringify(c8));
// pier chip works
await page.evaluate(() => [...document.querySelectorAll('.bk-mro-pg .bk-mro-chips button')].find(b => b.textContent.trim() === 'Tub Lamu').click()); await page.waitForTimeout(700);
const c8b = await page.evaluate(() => ({ p: _bkV2T2Pier, on: (document.querySelector('.bk-mro-pg .bk-mro-chips button.on') || {}).textContent }));
await page.evaluate(() => bkV2Tab2SetPier('all')); await page.waitForTimeout(700);
if (c8b.p === 'tublamu' && /Tub Lamu/.test(c8b.on || '')) ok('8b แตะชิปท่า → กรองท่าเหมือนหน้าคอม'); else fail('8b ' + JSON.stringify(c8b));
// 9 cancelled + day totals · 15 ก.ย. มีใบยกเลิก 3 ใบ (หน้าคอมวาดเป็นกล่อง .t2-cxl-row ท้ายทริป ไม่ใช่แถวตาราง)
await page.evaluate(() => { _bkV2.filterDate = '2026-09-15'; bkV2Render(); }); await page.waitForTimeout(1000);
const c9 = await page.evaluate(() => { const h = document.getElementById('view-booking');
  const cxR = [...h.querySelectorAll('.t2-cxl-row,.t2-ghost-row')];
  const cx = new Set(cxR.map(r => r.querySelector('[class$="-vc"]').textContent + '|' + r.querySelector('[class$="-cu"]').textContent)).size + h.querySelectorAll('table.t2-mtbl tr.t2-row.t2-cxl[data-al]').length;
  const det = h.querySelector('.bk-mro-cx'); const inDet = det ? det.querySelectorAll('.bk-mro-c,.bk-mro-cr').length : 0;
  const agN = [...new Set(cxR.map(r => (r.querySelector('.t2-cxl-ag,.t2-ghost-ag') || {}).textContent).filter(n => n && n.length > 3))];
  const dTxt = det ? det.textContent : ''; const leak = agN.filter(n => dTxt.includes(n)); const baht = /฿/.test(dTxt);
  const outCx = [...h.querySelectorAll('.bk-mro-rt .bk-mro-c.cx')].length;
  const dt = [...h.querySelectorAll('.bt-prog .bt-daytot b')].map(b => +b.textContent);
  const f = (h.querySelector('.bk-mro-dt .f') || {}).textContent || ''; const m = f.match(/(\d+) ใบ · (\d+) คน/);
  const g = [...h.querySelectorAll('.bk-mro-dt .g b')].map(b => +b.textContent);
  const rf = h.querySelectorAll('.bk-mro-rf').length, bands = h.querySelectorAll('table.t2-mtbl tr.t2-pband').length;
  return { cx, inDet, outCx, agN: agN.length, leak, baht, open: det ? det.open : null, dt, f, n: m ? [+m[1], +m[2]] : null, gsum: g.reduce((a, b) => a + b, 0), rf, bands }; });
if (c9.cx > 0 && c9.inDet === c9.cx && !c9.outCx && c9.open === false && !c9.leak.length && !c9.baht && c9.n && c9.n[1] === c9.dt[1] && c9.gsum === c9.dt[1] && c9.rf >= 1 && c9.rf <= c9.bands)
  ok(`9 15 ก.ย. ใบยกเลิก/ย้ายวัน ${c9.cx} ใบพับไว้ท้ายหน้า (ไม่มีชื่อเอเจนต์ ${c9.agN} เจ้า · ไม่มีค่าปรับ ฿) · รวมทั้งวัน ${c9.n[0]} ใบ ${c9.n[1]} คน = หน้าคอม · รวมท้ายเส้นทาง ${c9.rf}`);
else fail('9 ' + JSON.stringify(c9));
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
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
