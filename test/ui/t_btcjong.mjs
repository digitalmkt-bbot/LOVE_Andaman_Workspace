// §btcJongRed · Booking (Compact) · ป้าย "จอง N" ต่อท้ายตัวเลขเดินทางจริง สีแดง
// ที่มา (2026-10-17) · owner ส่งภาพแถวที่ AD เป็น 0 มีป้าย "จอง 3" ลอยคร่อมเส้นบนของช่อง (ดูเหมือนเป็นของแถวบน)
//   "ลอย แต่ขยับไปอยู่หลังเลข 0 พร้อมทั้งเป็นสีแดง"
// กัน
//   1 ป้ายอยู่ขวาของตัวเลข ระดับเดียวกัน ไม่คร่อมเส้นบน · ตัวเลขยังอยู่กลางช่อง
//   2 ป้ายสีแดง (ตัวแดงบนพื้นแดงอ่อน) · ขึ้นคำว่า "จอง 3" · ชี้เมาส์ได้ "จองมา 3"
//   3 ช่องถัดไปว่าง → ขึ้น "จอง N" ลอยข้ามไปได้ · ช่องถัดไปมีตัวเลข → ย่อเป็น "/N" และไม่ทับเลขนั้น
//   4 ผิว Classic ไม่โดน (ยอดจองยังเป็นเลขขีดฆ่าใต้ตัวเลขแบบเดิม)
//   5 ไม่มี error
import { open, goView } from './_harness.mjs';
let bad = 0;
const ok = m => console.log('  ✓ ' + m), fail = m => { bad++; console.log('  ✗ ' + m); };
const { page, errors, close } = await open({ blob: process.env.LAD, width: 1560, height: 1000 });
await goView(page, 'booking', 900);
const G = await page.evaluate(() => {
  const c = {};
  (SB_BOOKINGS || []).forEach(b => { if (['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)) return;
    (b.trips || []).forEach(t => { if (t && t.date) c[t.date] = (c[t.date] || 0) + 1; }); });
  const day = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  const P = (o, k) => +((o || {})[k + '_fr'] || 0) + +((o || {})[k + '_th'] || 0) + +((o || {})[k] || 0);
  const picks = (SB_BOOKINGS || []).filter(b => !['cancelled', 'rejected', 'cancelled_weather'].includes(b.status)
    && (b.trips || []).some(t => t.date === day && t.bookingMode !== 'charter' && P(t.pax, 'ad') >= 3)).slice(0, 2);
  const LOST = {}; if (picks[0]) LOST[picks[0].id] = { ad: 'all' }; if (picks[1]) LOST[picks[1].id] = { ad: 1 };
  [0, 1].forEach(i => { const p = picks[i]; if (!p) return; const t = p.trips.find(t => t.date === day); t.pax = Object.assign({}, t.pax);
    ['chd', 'inf', 'foc'].forEach(k => { delete t.pax[k + '_fr']; delete t.pax[k + '_th']; delete t.pax[k]; });
    if (i === 1) t.pax.chd_fr = 2; });                       // แถวแรก CHD ว่าง · แถวสอง CHD มี 2 คน
  const oL = window.ckLostByType, oP = window.ckPaxLeft;
  window.ckLostByType = (b, d) => LOST[b.id] ? { total: 1 } : (oL ? oL(b, d) : null);
  window.ckPaxLeft = (b, d, k, bkd) => { const L = LOST[b.id]; if (!L) return oP ? oP(b, d, k, bkd) : bkd;
    if (L[k] === 'all') return 0; if (L[k]) return Math.max(0, bkd - L[k]); return bkd; };
  _bkV2.filterDate = day; _bkV2.filterRoute = null; btcSet('compact');
  if (typeof bookingV2SwitchTab === 'function') bookingV2SwitchTab('bytrip');
  const ad0 = picks[0] ? P(picks[0].trips.find(t => t.date === day).pax, 'ad') : 0;
  return { day, n: picks.length, ad0 };
});
await page.waitForTimeout(1800);
const look = () => page.evaluate(() => {
  const ws = [...document.querySelectorAll('tr.t2-row td.t2-c .btc-lnum')];
  return ws.map(w => { const n = w.firstElementChild, b = w.querySelector('.btc-ft.bk'), td = w.closest('td');
    const rn = n.getBoundingClientRect(), rb = b.getBoundingClientRect(), rt = td.getBoundingClientRect();
    const nb = td.nextElementSibling, rg = document.createRange(); rg.selectNodeContents(nb); const rc = rg.getBoundingClientRect();
    const nbTxt = nb.textContent.trim(), nbEmpty = !nbTxt || !!nb.querySelector(':scope > .t2-dim');
    return { num: n.textContent, txt: getComputedStyle(b, '::before').content.replace(/"/g, '') + b.textContent, title: b.title,
      right: rb.left >= rn.right - 1, sameLine: Math.abs((rb.top + rb.bottom) / 2 - (rn.top + rn.bottom) / 2) <= 3,
      inside: rb.top >= rt.top - 1 && rb.bottom <= rt.bottom + 1, centred: Math.abs((rn.left + rn.right) / 2 - (rt.left + rt.right) / 2) <= 3,
      nbEmpty, hitsNext: !nbEmpty && rb.right + 2 > rc.left,
      color: getComputedStyle(b).color, bg: getComputedStyle(b).backgroundColor, tight: w.classList.contains('tight') }; });
});
const A = await look();
const a0 = A.find(x => x.num === '0');
if (A.length >= 2 && a0 && A.every(x => x.right && x.sameLine && x.inside && x.centred)) ok('1 ป้ายอยู่ขวาของตัวเลข ระดับเดียวกัน ไม่คร่อมเส้นบน · ตัวเลขยังอยู่กลางช่อง (' + A.length + ' ช่อง)');
else fail('1 ' + JSON.stringify({ G, A }));
if (a0 && a0.color === 'rgb(180, 35, 24)' && a0.bg === 'rgb(254, 228, 226)' && a0.txt === 'จอง ' + G.ad0 && a0.title === 'จองมา ' + G.ad0)
  ok('2 สีแดง · "' + a0.num + ' ' + a0.txt + '" · ชี้เมาส์ "' + a0.title + '"');
else fail('2 ' + JSON.stringify(a0));

const full = A.find(x => x.nbEmpty), tg = A.find(x => !x.nbEmpty);
if (full && !full.tight && full.txt.startsWith('จอง ') && tg && tg.tight && tg.txt === '/' + tg.title.replace(/\D/g, '') && A.every(x => !x.hitsNext))
  ok('3 ช่องถัดไปว่าง ขึ้น "' + full.num + ' ' + full.txt + '" · ช่องถัดไปมีตัวเลข ย่อเป็น "' + tg.num + ' ' + tg.txt + '" ไม่ทับเลขนั้น');
else fail('3 ' + JSON.stringify(A));

const D = await page.evaluate(async () => { btcSet('classic'); await new Promise(r => setTimeout(r, 900));
  const lt = [...document.querySelectorAll('tr.t2-row td.t2-c > div[style*="line-through"]')];
  return { lt: lt.length, lnum: document.querySelectorAll('.btc-lnum').length }; });
if (D.lt >= 1 && D.lnum === 0) ok('4 ผิว Classic ไม่โดน · ยอดจองยังเป็นเลขขีดฆ่าใต้ตัวเลข (' + D.lt + ' ช่อง)'); else fail('4 ' + JSON.stringify(D));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR|Failed to load resource/.test(e));
if (!e1.length) ok('5 ไม่มี error'); else fail('5 ' + e1.slice(0, 3).join(' | '));
await close(); console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed'); process.exit(bad ? 1 : 0);
