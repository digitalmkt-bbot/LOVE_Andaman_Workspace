// §pjPierSkin · ใบงานเรือ (pjPrint) · หัวใบเป็นอังกฤษ และทับละมุเป็นพื้น #00bcdf แยกจากพันวา
//
// ที่มา (7 ต.ค. 2026) · เจ้าของ: "ใบงานนี้ของทับละมุ ใช้ภาษาอังกฤษ และสีพื้นหลังใช้สี #00bcdf เพื่อแยกความแตกต่างของสองท่าเรือ"
//
// กันห้าอย่าง
//   1 ใบของทับละมุ · ชื่อท่าในหัวใบเป็น "Tub Lamu" (CSS ทำตัวพิมพ์ใหญ่) (ไม่มีตัวไทยในหัวใบ) · .shead พื้น #00bcdf ทึบ · ตัวหนังสือสีเข้ม (ไม่ใช่ขาวบนฟ้า)
//   2 ใบของพันวา · ยังเป็น navy เดิม ตัวขาว · ชื่อ "VISIT PANWA"
//   3 แถบวันที่ (.dstrip) เส้นใต้ตามสีท่า · เดือน-ปีสีตามท่า
//   4 สีที่ใช้ตรงกับหัว Travel Summary (TS_HEAD_COL.tublamu.bg) · ใบสองใบของสองท่า header ต่างกันจริง (คนละสี)
//   5 เนื้อใบ (Section A/B · ตารางลูกเรือ) ไม่เปลี่ยน · ข้อความในหัวใบของ ranong ยังเปิดได้ไม่ error
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);
const D = '2026-09-23';

const capture = (pier) => page.evaluate(({ D, pier }) => {
  const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
  const rt = (ROUTES || []).find(r => (r.pier || '') === pier) || (ROUTES || [])[0];
  if (!mine.length || !rt) return { err: 'no boats/route for ' + pier };
  TRIPS[D] = TRIPS[D] || {};
  mine.forEach(b => { if (!TRIPS[D][b.id]) TRIPS[D][b.id] = { route: rt.id, type: 'normal', booked: 0 }; });
  _poDate = D; _poPier = pier; _pjF = 'all';
  let cap = ''; const real = window.open;
  window.open = () => ({ focus() {}, document: { open() {}, write(h) { cap += h; }, close() {} } });
  try { pjPrint(); } catch (e) { cap = 'ERR:' + (e && e.message); }
  window.open = real;
  if (cap.indexOf('ERR:') === 0 || !cap) return { err: cap || 'empty' };
  /* วาดลงใน iframe เพื่อวัดสีจริง */
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-2000px;width:1200px;height:900px'; document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(cap.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<link[^>]+fonts[^>]*>/g, '')); f.contentDocument.close();
  const d = f.contentDocument, sh = d.querySelector('.shead'), nm = d.querySelector('.sh-c span'), br = d.querySelector('.sh-c b'), ds = d.querySelector('.dstrip'), mo = d.querySelector('.dstrip i');
  const cs = el => f.contentWindow.getComputedStyle(el);
  const out = { pier, name: nm && nm.textContent.trim(), nameThai: /[ก-฾เ-๛]/.test((sh && sh.textContent) || ''),
    bg: sh && cs(sh).backgroundColor, bgImg: sh && cs(sh).backgroundImage, ink: nm && cs(nm).color, brand: br && cs(br).color,
    line: ds && cs(ds).borderBottomColor, moCol: mo && cs(mo).color,
    secA: /Section A/.test(cap), secB: /Section B/.test(cap), crewTbl: d.querySelectorAll('table').length, tsCol: (typeof TS_HEAD_COL !== 'undefined' && TS_HEAD_COL.tublamu) ? TS_HEAD_COL.tublamu.bg : null };
  f.remove(); return out;
}, { D, pier });

const T = await capture('tublamu'), P = await capture('panwa');
const rgb = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
const lum = (c) => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(c || ''); return m ? (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) : -1; };

/* 1 */
if (!T.err && /^tub lamu$/i.test(T.name) && !T.nameThai && T.bg === rgb('#00bcdf') && T.bgImg === 'none' && lum(T.ink) < 100 && lum(T.brand) < 120)
  ok(`1 ทับละมุ · หัวใบ "${T.name}" ไม่มีตัวไทย · พื้น ${T.bg} ทึบ · ตัวหนังสือเข้ม (${T.ink})`);
else fail('1 ' + JSON.stringify(T));

/* 2 */
if (!P.err && /^visit panwa$/i.test(P.name) && P.bgImg !== 'none' && /16265c|22, 38, 92/i.test(P.bgImg) && lum(P.ink) > 240)
  ok(`2 พันวา · หัวใบ "${P.name}" · navy gradient เดิม ตัวขาว`);
else fail('2 ' + JSON.stringify(P));

/* 3 */
if (T.line === rgb('#00bcdf') && lum(T.moCol) < 150 && P.line === rgb('#16265C') && P.moCol === rgb('#16265C'))
  ok(`3 แถบวันที่ · ทับละมุเส้นใต้ ${T.line} เดือนสี ${T.moCol} · พันวา ${P.line}`);
else fail('3 ' + JSON.stringify({ T: { line: T.line, mo: T.moCol }, P: { line: P.line, mo: P.moCol } }));

/* 4 */
if (T.tsCol && T.tsCol.toLowerCase() === '#00bcdf' && T.bg !== P.bg + P.bgImg && (T.bg !== P.bg || T.bgImg !== P.bgImg))
  ok(`4 สีตรงกับหัว Travel Summary (${T.tsCol}) · หัวใบสองท่าต่างกัน`);
else fail('4 ' + JSON.stringify({ tsCol: T.tsCol, T: T.bg, P: P.bg + ' ' + P.bgImg }));

/* 5 */
const R = await capture('ranong');
if (T.secA && T.secB && T.crewTbl >= 1 && P.secA && P.secB && (R.err ? /no boats|empty/.test(R.err) : /^ranong$/i.test(R.name)))
  ok(`5 เนื้อใบครบ (Section A/B · ตาราง ${T.crewTbl}) · ranong ${R.err ? 'ไม่มีเรือ/ทริปในชุดนี้ (ข้าม)' : 'หัว "' + R.name + '"'}`);
else fail('5 ' + JSON.stringify({ T: { a: T.secA, b: T.secB, t: T.crewTbl }, P: { a: P.secA, b: P.secB }, R }));

const e1 = errors.filter(e => !/favicon|fonts\.|cdnjs|net::ERR/.test(e));
if (e1.length) fail('errors: ' + e1.slice(0, 3).join(' | '));
await close();
console.log(bad ? `\n  ${bad} FAILED` : '\n  all passed');
process.exit(bad ? 1 : 0);
