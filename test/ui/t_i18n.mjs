// §i18n · ปุ่มสลับภาษา ไทย / อังกฤษ
//   รอบแรก  · โครงระบบ + เมนู + หน้ากลุ่ม Sales
//   รอบสอง  · หน้า Dashboard + หน้า Booking · By trip (ที่ที่ Sales อยู่ทั้งวัน)
//   รอบสาม  · ป๊อปอัป "รายละเอียดทั้งวัน" + แท็บรออนุมัติ + ยุบตารางเดือนมาที่เดียว
//
// ที่มา (2026-09-25) · ผู้ใช้ขอ · "สามารถทำปุ่มเปลี่ยนภาษาได้ไหม ไทยกับอังกฤษ"
// คนที่ต้องใช้อังกฤษคือฝั่ง Sales · วัดหน้าจริงแล้วหน้ากลุ่ม Sales เป็นอังกฤษเกือบหมด
// เหลือไทยหน้าละไม่กี่คำ · รอบแรกวางโครง laT() + ปุ่ม แล้วรอบสองไล่สองหน้าที่เหลือ
//
// กติกาที่ต้องไม่พัง
//   - แปลได้เฉพาะ "เปลือกโปรแกรม" · ข้อมูลในฐานข้อมูล (ชื่อเอเยนต์ ชื่อลูกค้า) ห้ามถูกแปล
//   - ไม่มีคำแปล = คืนไทยเหมือนเดิม · ห่อผิดที่ต้องไม่ทำให้หน้าพัง
//   - พจนานุกรมต้องไม่เน่า · ทุกคำที่ใส่ไว้ต้องมีที่ใช้จริงในโค้ด
//   - สลับกลับเป็นไทยต้องได้ของเดิมคำต่อคำ · ไม่ใช่ "คล้ายเดิม"
//
// เทสนี้กันสิบห้าอย่าง
//   1 ปุ่ม TH/EN มีอยู่บนหัวแถบ และบอกภาษาที่ใช้อยู่ตอนนี้
//   2 กดแล้วภาษาเปลี่ยนจริง และจำไว้ต่อผู้ใช้ใน localStorage
//   3 เมนูซ้ายที่เป็นไทยแปลครบทุกอัน · สลับกลับแล้วได้ไทยเดิมคำต่อคำ
//   4 หน้าที่ห่อแล้ว (Agent List · B2C) ข้อความเปลี่ยนตามภาษาจริง
//   5 ข้อมูลไม่ถูกแปล · ชื่อเอเยนต์ไทยยังเป็นไทยตอนอยู่โหมดอังกฤษ
//   6 พจนานุกรมไม่เน่า · ทุกคำมีที่ใช้จริง (อ่านไฟล์ต้นฉบับมาตรวจ)
//   7 laT คืนไทยเมื่อไม่มีคำแปล และเมื่ออยู่โหมดไทย
//   8 หน้า Dashboard · โหมดอังกฤษไม่เหลือตัวอักษรไทยเลย และสลับกลับได้ไทยเดิมทั้งหน้า
//   9 หน้า By trip · โหมดอังกฤษเหลือไทยได้เฉพาะ "ชื่อคนจากฐานข้อมูล" เท่านั้น
//  10 laTp · ข้อความที่มีเลขแทรก เสียบเลขได้ทั้งสองภาษา และไม่มี {0} ค้างบนจอ
//  11 ชื่อเดือนย่อมาจากตารางเดียว (laMonAbbr) · ไม่ได้พิมพ์ซ้ำสองที่เหมือนเดิม
//  12 ป๊อปอัป "รายละเอียดทั้งวัน" ทั้งแบบวันเดียวและแบบช่วง · อังกฤษไม่เหลือไทย
//  13 แท็บรออนุมัติ · เหลือไทยได้เฉพาะชื่อคนจากฐานข้อมูล
//  14 ตารางเดือนไทยมีที่เดียวทั้งระบบ (laMonAbbrTH) และเป็นไทยล้วนเสมอ
//  15 ไม่มี error บนหน้า
//
// ⚠ ค่าที่คาดหวังคำนวณเองจาก DOM / SB_AGENTS / SB_BOOKINGS / ไฟล์ต้นฉบับ
//   ไม่ได้ถาม laT หรือพจนานุกรมมาตอบตัวเอง
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1400);

const TH = /[฀-๿]/;
const lang = () => page.evaluate(() => (typeof laLangGet === 'function') ? laLangGet() : '(none)');
const toggle = async () => { await page.evaluate(() => sbLangToggle()); await page.waitForTimeout(600); };
const goto = async v => {
  await page.evaluate(x => { const e = document.querySelector('.nav-item[data-view="' + x + '"]'); if (e) nav(e); }, v);
  await page.waitForTimeout(600);
};

/* ══ 1 · ปุ่มอยู่บนหัวแถบ และบอกภาษาปัจจุบัน ═════════════════════════════ */
const R1 = await page.evaluate(() => {
  const b = document.querySelector('.sb-lang');
  return { has: !!b, txt: b ? (b.textContent || '').trim() : '',
           title: b ? (b.getAttribute('title') || '') : '',
           nearPill: !!(b && b.parentElement && b.parentElement.querySelector('.sb-pill')),
           lang: (typeof laLangGet === 'function') ? laLangGet() : '(none)' };
});
if (!R1.has) fail('ไม่มีปุ่มสลับภาษาบนหัวแถบ');
else if (!R1.nearPill) fail('ปุ่มภาษาไม่ได้อยู่ชุดเดียวกับปุ่มธีม/ทรงพิล');
else if (R1.txt !== (R1.lang === 'en' ? 'EN' : 'TH'))
  fail('ปุ่มขึ้น "' + R1.txt + '" แต่ภาษาที่ใช้อยู่คือ ' + R1.lang);
else if (!R1.title) fail('ปุ่มภาษาไม่มี tooltip บอกว่ากดแล้วได้อะไร');
else ok('ปุ่มสลับภาษาอยู่บนหัวแถบชุดเดียวกับปุ่มธีม · ขึ้น "' + R1.txt +
        '" ตรงกับภาษาที่ใช้อยู่ (' + R1.lang + ')');

/* ══ 2 · กดแล้วเปลี่ยนจริง และจำไว้ ═══════════════════════════════════════ */
const before = await lang();
await toggle();
const after = await lang();
const R2 = await page.evaluate(() => {
  let raw = null;
  try { raw = localStorage.getItem('la_lang_' + laSbUser()); } catch (e) {}
  return { raw, btn: (document.querySelector('.sb-lang') || {}).textContent };
});
if (after === before) fail('กดปุ่มแล้วภาษาไม่เปลี่ยน · ยังเป็น ' + before);
else if (R2.raw !== after) fail('ภาษาบนจอเป็น ' + after + ' แต่ที่จำไว้คือ "' + R2.raw + '"');
else if ((R2.btn || '').trim() !== after.toUpperCase())
  fail('กดแล้วตัวหนังสือบนปุ่มไม่ตาม · ขึ้น "' + R2.btn + '" ควรเป็น ' + after.toUpperCase());
else ok('กดแล้วสลับ ' + before + ' → ' + after + ' · จำไว้ต่อผู้ใช้ใน la_lang_<user> · ปุ่มเปลี่ยนตาม');

/* ══ 3 · เมนูซ้ายแปลครบ และกลับมาเป็นไทยเดิมได้ ══════════════════════════ */
const R3 = await page.evaluate(() => {
  const items = [].slice.call(document.querySelectorAll('.sidebar .nav-item[data-view]'));
  /* ไทยต้นฉบับอ่านจาก dataset ที่เก็บไว้ตอนแปลครั้งแรก · ตัวที่ไม่เคยเป็นไทยจะไม่มีค่า */
  const thWas = items.filter(e => /[฀-๿]/.test(e.dataset.thLabel || ''))
                     .map(e => [e.dataset.view, e.dataset.thLabel]);
  const nowTH = items.map(e => (e.textContent || '').trim()).filter(t => /[฀-๿]/.test(t));
  return { thWas, leftTH: nowTH, n: items.length };
});
if (after !== 'en') fail('ลำดับการสลับเพี้ยน · ตอนนี้เป็น ' + after + ' ควรเป็น en');
else if (!R3.thWas.length) fail('ไม่มีเมนูไทยให้ตรวจเลย · ชุดข้อมูลนี้ทดสอบไม่ได้');
else if (R3.leftTH.length)
  fail('โหมดอังกฤษแล้วยังเหลือเมนูไทย ' + R3.leftTH.length + ' อัน · ' + R3.leftTH.slice(0, 4).join(' · '));
else {
  await toggle();
  const R3b = await page.evaluate((want) => {
    const miss = [];
    want.forEach(([v, th]) => {
      const e = document.querySelector('.sidebar .nav-item[data-view="' + v + '"]');
      const now = e ? (e.textContent || '').trim() : '(หาย)';
      if (now !== th) miss.push(v + ' = "' + now + '" ควรเป็น "' + th + '"');
    });
    return miss;
  }, R3.thWas);
  if (R3b.length) fail('สลับกลับเป็นไทยแล้วไม่ตรงของเดิม · ' + R3b.slice(0, 3).join(' · '));
  else ok('เมนูซ้ายที่เป็นไทย ' + R3.thWas.length + ' อันแปลครบไม่เหลือสักอัน · ' +
          'สลับกลับได้ไทยเดิมคำต่อคำทุกอัน');
  await toggle();   // กลับไปโหมดอังกฤษไว้ตรวจข้อต่อไป
}

/* ══ 4 · หน้าที่ห่อแล้วเปลี่ยนข้อความจริง ════════════════════════════════ */
const PAGES = [
  { v: 'agents', th: 'เลือก Agent จากเมนูด้านซ้าย', en: 'Pick an agent on the left' },
  { v: 'b2c',    th: 'รวมทุกช่องทาง',               en: 'All channels' }
];
const seen = [];
for (const p of PAGES) {
  await goto(p.v);
  const en = await page.evaluate(([a, b]) => {
    const t = document.body.innerText;
    return { hasEn: t.indexOf(a) >= 0, hasTh: t.indexOf(b) >= 0 };
  }, [p.en, p.th]);
  await toggle();
  const th = await page.evaluate(([a, b]) => {
    const t = document.body.innerText;
    return { hasEn: t.indexOf(a) >= 0, hasTh: t.indexOf(b) >= 0 };
  }, [p.en, p.th]);
  await toggle();
  seen.push({ ...p, en, th });
}
const p4 = seen.filter(x => x.en.hasEn || x.th.hasTh);
const bad4 = p4.filter(x => !(x.en.hasEn && !x.en.hasTh && x.th.hasTh && !x.th.hasEn));
if (!p4.length) fail('เปิดหน้าที่ห่อไว้แล้วไม่เจอข้อความที่ตรวจเลยสักหน้า');
else if (bad4.length)
  fail(bad4[0].v + ' · โหมด EN เจออังกฤษ=' + bad4[0].en.hasEn + ' ไทย=' + bad4[0].en.hasTh +
       ' · โหมด TH เจออังกฤษ=' + bad4[0].th.hasEn + ' ไทย=' + bad4[0].th.hasTh);
else ok('หน้าที่ห่อแล้วเปลี่ยนข้อความตามภาษาจริง ' + p4.length + ' หน้า (' +
        p4.map(x => x.v).join(', ') + ') · โหมดไหนก็เห็นภาษานั้นภาษาเดียว');

/* ══ 5 · ข้อมูลต้องไม่ถูกแปล ═════════════════════════════════════════════ */
await goto('agents');
const R5 = await page.evaluate(() => {
  /* ชื่อเอเยนต์ไทยจากข้อมูลดิบ · ต้องยังโผล่บนจอเหมือนเดิมตอนอยู่โหมดอังกฤษ */
  const TH = /[฀-๿]/;
  const names = (typeof SB_AGENTS !== 'undefined' ? SB_AGENTS : [])
    .map(a => a && a.name).filter(n => n && TH.test(n)).slice(0, 8);
  const t = document.body.innerText;
  return { lang: laLangGet(), names, shown: names.filter(n => t.indexOf(n) >= 0).length };
});
if (R5.lang !== 'en') fail('ควรอยู่โหมดอังกฤษตอนตรวจข้อนี้ · เจอ ' + R5.lang);
else if (!R5.names.length) fail('ชุดข้อมูลนี้ไม่มีชื่อเอเยนต์ภาษาไทย · ตรวจไม่ได้');
else if (!R5.shown)
  fail('โหมดอังกฤษแล้วชื่อเอเยนต์ไทย ' + R5.names.length + ' ชื่อหายไปจากจอ · ข้อมูลถูกแปลไปด้วย');
else ok('ข้อมูลไม่ถูกแปล · โหมดอังกฤษยังเห็นชื่อเอเยนต์ภาษาไทยจากฐานข้อมูล ' +
        R5.shown + '/' + R5.names.length + ' ชื่อ');

/* ══ 6 · พจนานุกรมไม่เน่า ════════════════════════════════════════════════ */
const R6 = await page.evaluate(async () => {
  const files = ['js/01-auth-sync.js','js/02-sidebar.js','js/04-data-core.js',
                 'js/05-fleet.js','js/08-app.js','js/09-action-board.js'];
  let src = '';
  for (const f of files) { try { src += await (await fetch(f)).text(); } catch (e) {} }
  if (!src) return { err: 'อ่านไฟล์ต้นฉบับไม่ได้' };
  const i = src.indexOf('var LA_T_EN={');
  if (i < 0) return { err: 'หาพจนานุกรมในไฟล์ไม่เจอ' };
  const j = src.indexOf('\n};', i);
  const dict = src.slice(i, j);
  const rest = src.slice(0, i) + src.slice(j);
  const keys = (dict.match(/'((?:nav\|)?[^']+)'\s*:\s*'/g) || [])
    .map(x => x.replace(/'\s*:\s*'$/, '').replace(/^'/, ''));
  /* ห่อได้สองทาง · laT('…') กับ laTp('… {0} …', n) สำหรับข้อความที่มีเลขแทรก
     และอาจมีบริบทเป็นอาร์กิวเมนต์ที่สอง  laT('ว่าง','seat') → กุญแจ 'seat|ว่าง' */
  const used = new Set();
  (rest.match(/laTp?\(\s*'([^']+)'(?:\s*,\s*'([^']+)')?/g) || []).forEach(x => {
    const m = /laTp?\(\s*'([^']+)'(?:\s*,\s*'([^']+)')?/.exec(x);
    if (!m) return;
    used.add(m[1]);
    if (m[2]) used.add(m[2] + '|' + m[1]);
  });
  const dead = keys.filter(k => !k.startsWith('nav|') && !used.has(k));
  return { total: keys.length, dead };
});
if (R6.err) fail(R6.err);
else if (!R6.total) fail('พจนานุกรมว่างเปล่า');
else if (R6.dead.length)
  fail('พจนานุกรมมีคำที่ยังไม่ได้ห่อใช้จริง ' + R6.dead.length + ' คำ · ' +
       R6.dead.slice(0, 4).join(' · ') + ' — ใส่คำแปลไว้แต่หน้าจอไม่เรียก จะหลงว่าแปลแล้ว');
else ok('พจนานุกรม ' + R6.total + ' คำ · ทุกคำมีที่ใช้จริงในโค้ด ไม่มีคำแปลลอยค้างไว้');

/* ══ 7 · ไม่มีคำแปล = คืนไทย · โหมดไทย = คืนไทยเสมอ ═════════════════════ */
const R7 = await page.evaluate(() => {
  const probe = 'ข้อความที่ไม่มีวันมีคำแปล ' + Date.now();
  const en = { miss: laT(probe), has: laT('FOC ตามเส้นทาง'), ctx: laT('ใบงานเรือ', 'nav') };
  const wasEn = (laLangGet() === 'en');
  laLangSet('th');
  const th = { miss: laT(probe), has: laT('FOC ตามเส้นทาง'), ctx: laT('ใบงานเรือ', 'nav') };
  laLangSet(wasEn ? 'en' : 'th');
  return { probe, en, th };
});
if (R7.en.miss !== R7.probe) fail('โหมดอังกฤษ · ไม่มีคำแปลแล้วไม่คืนไทย · ได้ "' + R7.en.miss + '"');
else if (R7.en.has !== 'FOC by route') fail('โหมดอังกฤษ · มีคำแปลแต่ไม่แปล · ได้ "' + R7.en.has + '"');
else if (R7.en.ctx !== 'Boat Job Sheet') fail('บริบท nav ไม่ทำงาน · ได้ "' + R7.en.ctx + '"');
else if (R7.th.has !== 'FOC ตามเส้นทาง' || R7.th.ctx !== 'ใบงานเรือ' || R7.th.miss !== R7.probe)
  fail('โหมดไทยแล้วยังแปล · ได้ "' + R7.th.has + '" / "' + R7.th.ctx + '"');
else ok('laT คืนไทยเมื่อไม่มีคำแปล · แปลเมื่อมี · บริบท nav แยกได้ · โหมดไทยคืนไทยทุกกรณี');

/* ══ ตัวช่วยสำหรับข้อ 8-9 · ตัวอักษรไทย "จริง" ไม่นับ ฿ (U+0E3F อยู่ในช่วงไทย) ═══ */
const TH_LETTER = '[\\u0E01-\\u0E2E\\u0E30-\\u0E3A\\u0E40-\\u0E4E]';
const scanView = () => page.evaluate((re) => {
  const TH = new RegExp(re);
  const h = [].slice.call(document.querySelectorAll('[id^="view-"]'))
              .filter(x => x.offsetParent !== null)[0];
  if (!h) return { err: 'ไม่มีหน้าที่เปิดอยู่' };
  const thai = [], tips = [];
  const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (!t || !TH.test(t)) continue;
    const p = n.parentElement;
    if (!p || p.tagName === 'STYLE' || p.tagName === 'SCRIPT' || p.closest('.sidebar')) continue;
    thai.push(t.slice(0, 70));
  }
  h.querySelectorAll('[title]').forEach(e => {
    const t = (e.getAttribute('title') || '').trim();
    if (t && TH.test(t)) tips.push(t.slice(0, 70));
  });
  return { text: h.innerText, thai: [...new Set(thai)], tips: [...new Set(tips)],
           brace: (h.innerText.match(/\{\d\}/g) || []).length };
}, TH_LETTER);

/* ══ 8 · หน้า Dashboard · อังกฤษไม่เหลือไทย · สลับกลับได้ไทยเดิมทั้งหน้า ══ */
await page.evaluate(() => { if (laLangGet() !== 'th') sbLangToggle(); });
await page.waitForTimeout(500);
await goto('dashboard');
const D_th1 = await scanView();
await toggle(); await goto('dashboard');
const D_en = await scanView();
await toggle(); await goto('dashboard');
const D_th2 = await scanView();
if (D_th1.err || D_en.err) fail('เปิดหน้า Dashboard ไม่ได้');
else if (!D_th1.thai.length) fail('โหมดไทยไม่เจอตัวอักษรไทยบนหน้า Dashboard เลย · ตรวจไม่ได้');
else if (D_en.thai.length || D_en.tips.length)
  fail('Dashboard โหมดอังกฤษยังเหลือไทย ' + D_en.thai.length + ' ก้อน · tooltip ' +
       D_en.tips.length + ' ก้อน · ' + D_en.thai.concat(D_en.tips).slice(0, 3).join(' | '));
else if (D_th2.text !== D_th1.text)
  fail('Dashboard สลับกลับเป็นไทยแล้วไม่ตรงของเดิม · ' +
       (function () { const A = D_th1.text.split('\n'), C = D_th2.text.split('\n');
         for (let i = 0; i < Math.max(A.length, C.length); i++)
           if (A[i] !== C[i]) return 'บรรทัด ' + i + ' เดิม "' + A[i] + '" ใหม่ "' + C[i] + '"';
         return 'ยาวไม่เท่ากัน'; })());
else ok('Dashboard · โหมดไทยมีไทย ' + D_th1.thai.length + ' ก้อน → โหมดอังกฤษเหลือ 0 ก้อน ' +
        '(tooltip 0) → สลับกลับได้ไทยเดิมครบทั้งหน้าคำต่อคำ');

/* ══ 9 · หน้า By trip · เหลือไทยได้เฉพาะชื่อคนจากฐานข้อมูล ═══════════════
   ปลูกล็อก + ใบรออนุมัติลงวันที่มี booking เยอะสุด · แถวล็อกกับแถวรออนุมัติ
   เป็นของใหม่จากรอบก่อน ๆ และเป็นไทยทั้งแถว ถ้าไม่ปลูกจะไม่ได้ตรวจเลย     */
const B = await page.evaluate(() => {
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const ag = (typeof SB_AGENTS !== 'undefined' ? SB_AGENTS : []).find(a => a && a.color);
  if (!ag) return { err: 'ไม่มีเอเยนต์ที่ตั้งสีไว้' };
  const today = (typeof bkV2LocalYMD === 'function') ? bkV2LocalYMD(new Date())
                                                     : new Date().toISOString().slice(0, 10);
  const pool = {};
  (SB_BOOKINGS || []).forEach(b => {
    if (!b || CXL.includes(b.status) || b.status === 'pending_approval') return;
    (b.trips || []).forEach(t => {
      if (!t || !t.routeId || !t.date || t.date <= today) return;
      const r = (ROUTES || []).find(x => x && x.id === t.routeId);
      if (!r) return;
      const st = (typeof getDayStatus === 'function') ? getDayStatus(r, t.date) : null;
      if (st && st.type !== 'open') return;
      (pool[t.routeId + '|' + t.date] = pool[t.routeId + '|' + t.date] || []).push(b.id);
    });
  });
  const key = Object.keys(pool).sort((a, b) => pool[b].length - pool[a].length)[0];
  if (!key || pool[key].length < 3) return { err: 'หาวันในอนาคตที่มี booking 3 ใบบนเส้นทางเดียวกันไม่ได้' };
  const rid = key.split('|')[0], date = key.split('|')[1], bkId = pool[key][0];
  const L = bkV2CreateLock({ scope: 'day', routeId: rid, date: date, holderType: 'agent',
    holderId: ag.id, qty: 10, reason: 'i18n', releaseDaysBefore: 2, releaseTime: '18:00' });
  bkV2DrawLock(L.id, 3, bkId, date);
  bkV2CreateSubLock(L.id, 'Poppy', 2);
  /* ชื่อลูกค้าภาษาไทยจากข้อมูลดิบ · คิดเองจาก SB_BOOKINGS ไม่ได้อ่านจากหน้าจอ */
  const TH = /[ก-ฮ]/;
  const names = [];
  let n = 0;
  (SB_BOOKINGS || []).forEach(b => {
    if (!b || CXL.includes(b.status)) return;
    if (!(b.trips || []).some(t => t.routeId === rid && t.date === date)) return;
    const nm = b.leadPax || b.customerName || '';
    if (nm && TH.test(nm)) names.push(nm);
    if (n < 2 && b.id !== bkId) { b.status = 'pending_approval'; n++; }
  });
  _bkV2.filterDate = date;
  return { rid, date, pend: n, names: [...new Set(names)] };
});
const paintBT = async () => {
  await page.evaluate(() => {
    const e = document.querySelector('.nav-item[data-view="booking"]'); if (e) nav(e);
    bkV2SwitchTab('bytrip');
  });
  await page.waitForTimeout(1300);
};
if (B.err) fail(B.err);
else {
  await paintBT();
  const T_th1 = await scanView();
  await toggle(); await paintBT();
  const T_en = await scanView();
  await toggle(); await paintBT();
  const T_th2 = await scanView();
  /* ไทยที่เหลือได้ = ชื่อคนจากฐานข้อมูลเท่านั้น · อย่างอื่นถือว่าลืมห่อ */
  const isData = s => B.names.some(nm => s.indexOf(nm) >= 0 || nm.indexOf(s) >= 0);
  const leak = T_en.thai.filter(s => !isData(s)).concat(T_en.tips.filter(s => !isData(s)));
  const nameShown = B.names.filter(nm => T_en.text.indexOf(nm) >= 0).length;
  if (!T_th1.thai.length) fail('โหมดไทยไม่เจอไทยบนหน้า By trip เลย · ตรวจไม่ได้');
  else if (leak.length)
    fail('By trip โหมดอังกฤษยังเหลือเปลือกโปรแกรมเป็นไทย ' + leak.length + ' ก้อน · ' +
         leak.slice(0, 3).join(' | '));
  else if (B.names.length && !nameShown)
    fail('โหมดอังกฤษแล้วชื่อลูกค้าไทย ' + B.names.length + ' ชื่อหายไปจากหน้า By trip · ข้อมูลถูกแปลไปด้วย');
  else if (T_th2.text !== T_th1.text)
    fail('By trip สลับกลับเป็นไทยแล้วไม่ตรงของเดิม · ' +
         (function () { const A = T_th1.text.split('\n'), C = T_th2.text.split('\n');
           for (let i = 0; i < Math.max(A.length, C.length); i++)
             if (A[i] !== C[i]) return 'บรรทัด ' + i + ' เดิม "' + A[i] + '" ใหม่ "' + C[i] + '"';
           return 'ยาวไม่เท่ากัน'; })());
  else ok('By trip (' + B.date + ' · ล็อก 1 ใบ + กรุ๊ปย่อย + ใบรออนุมัติ ' + B.pend + ' ใบ) · ' +
          'โหมดไทยมีไทย ' + T_th1.thai.length + ' ก้อน → โหมดอังกฤษเหลือแต่ชื่อคนจากฐานข้อมูล ' +
          nameShown + '/' + B.names.length + ' ชื่อ → สลับกลับได้ไทยเดิมทั้งหน้า');

  /* ══ 10 · laTp · เลขถูกเสียบจริง ไม่มี {0} ค้างบนจอ ══════════════════════ */
  const R10 = await page.evaluate(() => {
    const probe = 'ยังไม่มีคำแปลแน่ ๆ {0} ที่ {1}';
    const was = laLangGet();
    laLangSet('en');
    const en = { known: laTp('จาก {0} ลำ', 7), miss: laTp(probe, 4, 9) };
    laLangSet('th');
    const th = { known: laTp('จาก {0} ลำ', 7), miss: laTp(probe, 4, 9) };
    laLangSet(was);
    return { en, th };
  });
  const braceLeft = T_th1.brace + T_en.brace + D_en.brace + D_th1.brace;
  if (/\{\d\}/.test(R10.en.known) || /\{\d\}/.test(R10.th.known))
    fail('laTp ไม่เสียบเลขให้ · อังกฤษได้ "' + R10.en.known + '" ไทยได้ "' + R10.th.known + '"');
  else if (R10.en.known.indexOf('7') < 0 || R10.th.known.indexOf('7') < 0)
    fail('laTp เสียบเลขผิดช่อง · อังกฤษได้ "' + R10.en.known + '" ไทยได้ "' + R10.th.known + '"');
  else if (R10.en.miss !== 'ยังไม่มีคำแปลแน่ ๆ 4 ที่ 9')
    fail('ไม่มีคำแปลแล้ว laTp ต้องคืนไทยพร้อมเสียบเลข · ได้ "' + R10.en.miss + '"');
  else if (braceLeft)
    fail('มี {0} ค้างอยู่บนหน้าจอ ' + braceLeft + ' จุด · แปลว่าคำแปลบางคำช่องไม่ตรงกับไทย');
  else ok('laTp เสียบเลขได้ทั้งสองภาษา ("' + R10.th.known + '" / "' + R10.en.known +
          '") · ไม่มีคำแปลก็คืนไทยพร้อมเลข · ไม่มี {0} ค้างบนสองหน้าที่ทำรอบนี้');
}

/* ══ 11 · ชื่อเดือนย่อมาจากตารางเดียว ═══════════════════════════════════ */
const R11 = await page.evaluate(async () => {
  const was = laLangGet();
  laLangSet('th'); const th = laMonAbbr();
  laLangSet('en'); const en = laMonAbbr();
  laLangSet(was);
  /* หน้า Dashboard เคยพิมพ์ตารางเดือนไทยไว้สองที่ในไฟล์เดียว · TH_MON ใน renderDash
     กับ TH_MON_H ใน _dvHead · แก้ที่หนึ่งแล้วอีกที่ไม่ตาม ทั้งสองต้องอ่านจาก laMonAbbr
     (ที่อื่นในระบบยังพิมพ์ตารางนี้เองอีกหลายที่ · เป็นงานรอบถัดไป ไม่ใช่ของรอบนี้) */
  let src = '';
  try { src = await (await fetch('js/04-data-core.js')).text(); } catch (e) {}
  const viaFn = (src.match(/const TH_MON(_H)?\s*=\s*laMonAbbr\(\)/g) || []).length;
  const byHand = (src.match(/const TH_MON(_H)?\s*=\s*\['ม\.ค\.'/g) || []).length;
  const inFn = /function laMonAbbrTH\(\)\{[\s\S]{0,200}?\['ม\.ค\.'/.test(src);
  return { th, en, viaFn, byHand, inFn, hasFn: typeof laMonAbbr === 'function' };
});
if (!R11.hasFn) fail('ไม่มี laMonAbbr');
else if (R11.th.length !== 12 || R11.en.length !== 12) fail('ตารางเดือนไม่ครบ 12 ช่อง');
else if (R11.th[0] !== 'ม.ค.' || R11.th[11] !== 'ธ.ค.')
  fail('โหมดไทยไม่ได้ชื่อเดือนไทย · ได้ ' + R11.th[0] + ' … ' + R11.th[11]);
else if (R11.en[0] !== 'Jan' || R11.en[11] !== 'Dec')
  fail('โหมดอังกฤษไม่ได้ชื่อเดือนอังกฤษ · ได้ ' + R11.en[0] + ' … ' + R11.en[11]);
else if (!R11.inFn) fail('อ่านไฟล์ต้นฉบับแล้วไม่เจอตารางเดือนไทยใน laMonAbbrTH');
else if (R11.byHand)
  fail('หน้า Dashboard ยังพิมพ์ตารางเดือนไทยเองอยู่ ' + R11.byHand + ' ที่ ' +
       '(TH_MON / TH_MON_H) · ต้องอ่านจาก laMonAbbr ทั้งคู่ ไม่งั้นแก้ที่หนึ่งอีกที่ไม่ตาม');
else if (R11.viaFn !== 2)
  fail('เจอ TH_MON/TH_MON_H ที่อ่านจาก laMonAbbr แค่ ' + R11.viaFn + ' ที่ · ควรมีสองที่');
else ok('ชื่อเดือนย่อของหน้า Dashboard อ่านจาก laMonAbbr ทั้งสองที่ (TH_MON · TH_MON_H) · ' +
        'ไทย ' + R11.th[0] + '…' + R11.th[11] + ' · อังกฤษ ' + R11.en[0] + '…' + R11.en[11]);

/* ══ 12 · ป๊อปอัป "รายละเอียดทั้งวัน" · ทั้งแบบวันเดียวและแบบช่วง ══════════
   ป๊อปอัปนี้แขวนไว้ที่ body ไม่ได้อยู่ใน view- จึงต้องส่องที่ #dv-ddov ตรง ๆ
   แบบช่วงมีข้อความชุดของตัวเองอีกชุด (ช่วงนี้ / N วัน / แท่งรายวัน) ต้องเปิดดูด้วย */
const scanPopup = () => page.evaluate((re) => {
  const TH = new RegExp(re);
  const h = document.getElementById('dv-ddov');
  if (!h) return { err: 'ไม่เจอป๊อปอัป' };
  const thai = [], tips = [];
  const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (!t || !TH.test(t)) continue;
    const p = n.parentElement;
    if (!p || p.tagName === 'STYLE' || p.tagName === 'SCRIPT') continue;
    thai.push(t.slice(0, 70));
  }
  h.querySelectorAll('[title]').forEach(e => {
    const t = (e.getAttribute('title') || '').trim();
    if (t && TH.test(t)) tips.push(t.slice(0, 70));
  });
  return { text: h.innerText, thai: [...new Set(thai)], tips: [...new Set(tips)],
           brace: (h.innerText.match(/\{\d\}/g) || []).length };
}, TH_LETTER);
const openPopup = async (preset) => {
  await page.evaluate(() => {
    const e = document.querySelector('.nav-item[data-view="dashboard"]'); if (e) nav(e);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => dashOpenDayDetail('b2c'));
  await page.waitForTimeout(800);
  if (preset) { await page.evaluate(p => dashDayDetailPreset(p), preset); await page.waitForTimeout(700); }
};
await page.evaluate(() => { if (laLangGet() !== 'th') sbLangToggle(); });
await page.waitForTimeout(400);
await openPopup(null);
const Q_th1 = await scanPopup();
await openPopup('d7');
const Q7_th = await scanPopup();
await page.evaluate(() => dashDayDetailClose());
await toggle();
await openPopup(null);
const Q_en = await scanPopup();
await openPopup('d7');
const Q7_en = await scanPopup();
await page.evaluate(() => dashDayDetailClose());
await toggle();
await openPopup(null);
const Q_th2 = await scanPopup();
await page.evaluate(() => dashDayDetailClose());
if (Q_th1.err || Q_en.err) fail('เปิดป๊อปอัป "รายละเอียดทั้งวัน" ไม่ได้');
else if (!Q_th1.thai.length) fail('โหมดไทยไม่เจอไทยในป๊อปอัปเลย · ตรวจไม่ได้');
else if (!Q7_th.thai.length) fail('โหมดไทยไม่เจอไทยในป๊อปอัปแบบช่วง 7 วัน · ตรวจไม่ได้');
else if (Q_en.thai.length || Q_en.tips.length)
  fail('ป๊อปอัป (วันเดียว) โหมดอังกฤษยังเหลือไทย ' + Q_en.thai.length + ' ก้อน · tooltip ' +
       Q_en.tips.length + ' · ' + Q_en.thai.concat(Q_en.tips).slice(0, 3).join(' | '));
else if (Q7_en.thai.length || Q7_en.tips.length)
  fail('ป๊อปอัป (ช่วง 7 วัน) โหมดอังกฤษยังเหลือไทย ' + Q7_en.thai.length + ' ก้อน · tooltip ' +
       Q7_en.tips.length + ' · ' + Q7_en.thai.concat(Q7_en.tips).slice(0, 3).join(' | '));
else if (Q_en.brace + Q7_en.brace + Q_th1.brace + Q7_th.brace)
  fail('มี {0} ค้างอยู่ในป๊อปอัป · คำแปลบางคำช่องไม่ตรงกับไทย');
else if (Q_th2.text !== Q_th1.text)
  fail('ป๊อปอัปสลับกลับเป็นไทยแล้วไม่ตรงของเดิม · ' +
       (function () { const A = Q_th1.text.split('\n'), C = Q_th2.text.split('\n');
         for (let i = 0; i < Math.max(A.length, C.length); i++)
           if (A[i] !== C[i]) return 'บรรทัด ' + i + ' เดิม "' + A[i] + '" ใหม่ "' + C[i] + '"';
         return 'ยาวไม่เท่ากัน'; })());
else ok('ป๊อปอัป "รายละเอียดทั้งวัน" · วันเดียวไทย ' + Q_th1.thai.length + ' ก้อน / ช่วง 7 วันไทย ' +
        Q7_th.thai.length + ' ก้อน → โหมดอังกฤษเหลือ 0 ทั้งสองแบบ (tooltip 0) → ' +
        'สลับกลับได้ไทยเดิมทั้งป๊อปอัป');

/* ══ 13 · แท็บรออนุมัติ · เหลือไทยได้เฉพาะชื่อคนจากฐานข้อมูล ══════════════ */
const AP = await page.evaluate(() => {
  const CXL = ['cancelled', 'rejected', 'cancelled_weather'];
  const TH = /[ก-ฮ]/;
  const names = [];
  let n = 0;
  (SB_BOOKINGS || []).forEach(b => {
    if (n >= 4 || !b || CXL.includes(b.status) || b.status === 'pending_approval') return;
    if (!(b.trips || []).length) return;
    b.status = 'pending_approval';
    /* สามเหตุผลที่แท็บนี้แยกป้ายคนละสี · ต้องโผล่ให้ครบทั้งสามในรอบเดียว */
    b.approval = (n === 0) ? { reason: 'b2c_hold', over: [], totOver: 0, discount: 0 }
               : (n === 1) ? { reason: 'over_cap', over: [{}], totOver: 3, discount: 0 }
               : (n === 2) ? { reason: 'over_cap', over: [], totOver: 0, discount: 1500 }
                           : { reason: 'closed_day', over: [], totOver: 0, discount: 0 };
    n++;
  });
  /* ชื่อคนที่จะโผล่บนแท็บนี้ = ทุกใบที่สถานะ pending_approval ตอนนี้
     ไม่ใช่แค่สี่ใบที่เพิ่งปลูก · ข้อก่อน ๆ ปลูกไว้แล้วบางใบ และแท็บนี้แสดงทุกใบ */
  (SB_BOOKINGS || []).forEach(b => {
    if (!b || b.status !== 'pending_approval') return;
    const nm = b.leadPax || b.customerName || '';
    if (nm && TH.test(nm)) names.push(nm);
    const ag = (typeof sbGetAgent === 'function') ? sbGetAgent(b.agentId) : null;
    if (ag && ag.name && TH.test(ag.name)) names.push(ag.name);
  });
  const e = document.querySelector('.nav-item[data-view="booking"]'); if (e) nav(e);
  bkV2SwitchTab('approvals');
  return { pend: n, names: [...new Set(names)] };
});
await page.waitForTimeout(1200);
const AP_th1 = await scanView();
await toggle();
await page.evaluate(() => { const e = document.querySelector('.nav-item[data-view="booking"]'); if (e) nav(e); bkV2SwitchTab('approvals'); });
await page.waitForTimeout(1200);
const AP_en = await scanView();
await toggle();
await page.evaluate(() => { const e = document.querySelector('.nav-item[data-view="booking"]'); if (e) nav(e); bkV2SwitchTab('approvals'); });
await page.waitForTimeout(1200);
const AP_th2 = await scanView();
if (!AP.pend) fail('ปลูกใบรออนุมัติไม่ได้ · ตรวจแท็บนี้ไม่ได้');
else if (!AP_th1.thai.length) fail('โหมดไทยไม่เจอไทยบนแท็บรออนุมัติ · ตรวจไม่ได้');
else {
  const isData = s => AP.names.some(nm => s.indexOf(nm) >= 0 || nm.indexOf(s) >= 0);
  const leak = AP_en.thai.filter(s => !isData(s)).concat(AP_en.tips.filter(s => !isData(s)));
  const shown = AP.names.filter(nm => AP_en.text.indexOf(nm) >= 0).length;
  if (leak.length)
    fail('แท็บรออนุมัติ โหมดอังกฤษยังเหลือเปลือกโปรแกรมเป็นไทย ' + leak.length + ' ก้อน · ' +
         leak.slice(0, 3).join(' | '));
  else if (AP.names.length && !shown)
    fail('โหมดอังกฤษแล้วชื่อลูกค้าไทย ' + AP.names.length + ' ชื่อหายไปจากแท็บรออนุมัติ');
  else if (AP_th2.text !== AP_th1.text)
    fail('แท็บรออนุมัติสลับกลับเป็นไทยแล้วไม่ตรงของเดิม');
  else ok('แท็บรออนุมัติ (ปลูก ' + AP.pend + ' ใบ · ครบทั้งสามเหตุผล) · โหมดไทยมีไทย ' +
          AP_th1.thai.length + ' ก้อน → โหมดอังกฤษเหลือแต่ชื่อคนจากฐานข้อมูล ' + shown + '/' +
          AP.names.length + ' ชื่อ → สลับกลับได้ไทยเดิม');
}

/* ══ 14 · ตารางเดือนไทยมีที่เดียวทั้งระบบ ═════════════════════════════════
   ก่อนรอบนี้ตารางนี้ถูกพิมพ์เองซ้ำ 21 ที่ใน 4 ไฟล์ · แก้ที่หนึ่งอีก 20 ที่ไม่ตาม
   laMonAbbrTH() เป็นตารางไทยล้วน ต้องไม่ขึ้นกับภาษา · หน้าที่ยังไม่ได้แปลจะได้ไทยเหมือนเดิม */
const R14 = await page.evaluate(async () => {
  const FILES = ['js/01-auth-sync.js','js/02-sidebar.js','js/03-topbar-nav.js','js/04-data-core.js',
                 'js/05-fleet.js','js/06-engine-assign.js','js/07-charter.js','js/08-app.js',
                 'js/09-action-board.js'];
  const per = [];
  let src = '';
  for (const f of FILES) {
    let t = '';
    try { t = await (await fetch(f)).text(); } catch (e) {}
    src += t;
    const n = (t.match(/\['ม\.ค\.','ก\.พ\./g) || []).length;
    if (n) per.push(f.replace('js/', '') + ' ' + n);
  }
  if (!src) return { err: 'อ่านไฟล์ต้นฉบับไม่ได้' };
  const hand = (src.match(/\['ม\.ค\.','ก\.พ\./g) || []).length;
  const calls = (src.match(/laMonAbbrTH\(\)/g) || []).length;
  const was = laLangGet();
  laLangSet('en'); const en = laMonAbbrTH();
  laLangSet('th'); const th = laMonAbbrTH();
  laLangSet(was);
  return { hand, calls, per, en, th, has: typeof laMonAbbrTH === 'function' };
});
const MON_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const monSame = a => Array.isArray(a) && a.length === 12 && a.every((x, i) => x === MON_TH[i]);
if (R14.err) fail(R14.err);
else if (!R14.has) fail('ไม่มี laMonAbbrTH');
else if (!monSame(R14.th)) fail('laMonAbbrTH โหมดไทยไม่ได้ตารางไทยครบ 12 ช่อง');
else if (!monSame(R14.en))
  fail('laMonAbbrTH เปลี่ยนตามภาษา · ต้องเป็นไทยล้วนเสมอ ไม่งั้นหน้าที่ยังไม่ได้แปลจะเพี้ยน · ' +
       'โหมดอังกฤษได้ ' + R14.en[0] + '…' + R14.en[11]);
else if (R14.hand !== 1)
  fail('ตารางเดือนไทยยังถูกพิมพ์เองอยู่ ' + R14.hand + ' ที่ (' + R14.per.join(' · ') +
       ') · ต้องมีที่เดียวคือใน laMonAbbrTH');
else if (R14.calls < 20)
  fail('มีที่เรียก laMonAbbrTH() แค่ ' + R14.calls + ' ที่ · ก่อนรอบนี้มีตารางพิมพ์เอง 21 ที่ ' +
       'แปลว่ายังมีที่ที่ไม่ได้ต่อสาย');
else ok('ตารางเดือนไทยมีที่เดียวทั้งระบบ · เรียกใช้ ' + R14.calls + ' ที่ ไม่มีที่ไหนพิมพ์เองอีก · ' +
        'laMonAbbrTH เป็นไทยล้วนทั้งสองภาษา (หน้าที่ยังไม่ได้แปลจึงไม่เพี้ยน)');

/* ══ 15 · ไม่มี error บนหน้า ════════════════════════════════════════════ */
const errs = (errors || []).filter(e => !/favicon|fonts\.googleapis/i.test(String(e)));
if (errs.length) fail('มี error บนหน้า ' + errs.length + ' ตัว · ' + String(errs[0]).slice(0, 150));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
