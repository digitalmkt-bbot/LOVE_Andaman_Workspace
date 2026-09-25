// §i18n · ปุ่มสลับภาษา ไทย / อังกฤษ · รอบแรก (โครงระบบ + เมนู + หน้ากลุ่ม Sales)
//
// ที่มา (2026-09-25) · ผู้ใช้ขอ · "สามารถทำปุ่มเปลี่ยนภาษาได้ไหม ไทยกับอังกฤษ"
// คนที่ต้องใช้อังกฤษคือฝั่ง Sales · วัดหน้าจริงแล้วหน้ากลุ่ม Sales เป็นอังกฤษเกือบหมด
// เหลือไทยหน้าละไม่กี่คำ · รอบนี้วางโครง laT() + ปุ่ม + แปลเมนูและหน้ากลุ่ม Sales
//
// กติกาที่ต้องไม่พัง
//   - แปลได้เฉพาะ "เปลือกโปรแกรม" · ข้อมูลในฐานข้อมูล (ชื่อเอเยนต์ ชื่อโรงแรม) ห้ามถูกแปล
//   - ไม่มีคำแปล = คืนไทยเหมือนเดิม · ห่อผิดที่ต้องไม่ทำให้หน้าพัง
//   - พจนานุกรมต้องไม่เน่า · ทุกคำที่ใส่ไว้ต้องมีที่ใช้จริงในโค้ด
//
// เทสนี้กันแปดอย่าง
//   1 ปุ่ม TH/EN มีอยู่บนหัวแถบ และบอกภาษาที่ใช้อยู่ตอนนี้
//   2 กดแล้วภาษาเปลี่ยนจริง และจำไว้ต่อผู้ใช้ใน localStorage
//   3 เมนูซ้ายที่เป็นไทยแปลครบทุกอัน · สลับกลับแล้วได้ไทยเดิมคำต่อคำ
//   4 หน้าที่ห่อแล้ว (Agent List · B2C) ข้อความเปลี่ยนตามภาษาจริง
//   5 ข้อมูลไม่ถูกแปล · ชื่อเอเยนต์ไทยยังเป็นไทยตอนอยู่โหมดอังกฤษ
//   6 พจนานุกรมไม่เน่า · ทุกคำมีที่ใช้จริง (อ่านไฟล์ต้นฉบับมาตรวจ)
//   7 laT คืนไทยเมื่อไม่มีคำแปล และเมื่ออยู่โหมดไทย
//   8 ไม่มี error บนหน้า
//
// ⚠ ค่าที่คาดหวังคำนวณเองจาก DOM / SB_AGENTS / ไฟล์ต้นฉบับ ไม่ได้ถาม laT มาตอบตัวเอง
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
  const used = new Set((rest.match(/laT\(\s*'([^']+)'/g) || [])
    .map(x => x.replace(/^laT\(\s*'/, '').replace(/'$/, '')));
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

/* ══ 8 · ไม่มี error บนหน้า ═════════════════════════════════════════════ */
const errs = (errors || []).filter(e => !/favicon|fonts\.googleapis/i.test(String(e)));
if (errs.length) fail('มี error บนหน้า ' + errs.length + ' ตัว · ' + String(errs[0]).slice(0, 150));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
