// §sbColorGone · แถบ "🎨 สีแท็บ" ในเมนูซ้ายถูกตัดออก · ตัวพับกลุ่มต้องไม่พังตาม
//
// ที่มา (2026-09-25) · ผู้ใช้แจ้งเอง · "ตัดแถบเลือกสีออกได้เลย เหมือนตอนนี้ไม่มีผลแล้ว"
// จริงตามนั้น · ของเดิมยัด <style> ว่า
//   .sidebar .nav-item.active{background:<สีที่เลือก> !important}
// แต่สกินอัตลักษณ์องค์กร (§sbPill) มีกฎที่เจาะจงกว่าทับอยู่
//   html[data-sb-pill="cyan"] .sidebar .nav-item.active{background:var(--ci-cyan)!important}
// ความเจาะจง (0,4,1) ชนะ (0,3,0) ไม่ว่าลำดับไหน · กดสีไหนพื้นเมนูก็ไม่ขยับ
//
// จุดที่ต้องระวังตอนตัดออก · แถบนั้นเคยถูกใช้เป็น "เครื่องหมาย" ว่าเมนูซ้ายถูกวาดใหม่หรือยัง
//   nav()            · ถ้าไม่เจอแถบ = เมนูถูกวาดใหม่ → เรียก laSbInit ติดตัวพับกลุ่มคืน
//   01-auth-sync.js  · ลูปตอนบูตวนรอจนกว่าแถบจะโผล่
// ถ้าตัดแถบทิ้งเฉย ๆ · ลูปบูตจะวนครบ 25 รอบทุกครั้ง และ nav() จะเรียก laSbInit ทุกคลิก
// ทั้งสองที่ต้องเปลี่ยนไปดู data-acc บนหัวกลุ่มแทน
//
// เทสนี้กันห้าอย่าง
//   1 ไม่มีแถบเลือกสีหลงเหลืออยู่ในหน้า และไม่มีฟังก์ชันของมันค้างไว้
//   2 ไม่มี <style> ที่เคยยัดสีเมนูค้างอยู่ใน <head>
//   3 ตัวพับ/กางกลุ่มยังติดครบทุกหัวกลุ่ม (เครื่องหมาย data-acc + ลูกศร)
//   4 พับแล้วเมนูในกลุ่มหายจริง กางแล้วกลับมา · และจำสถานะไว้
//   5 เมนูซ้ายถูกวาดใหม่แล้วกด nav() · ตัวพับกลุ่มต้องกลับมาเอง (เครื่องหมายใหม่ทำงาน)
//
// ⚠ ค่าที่คาดหวังนับจาก DOM ของเมนูจริง ไม่ได้เรียกฟังก์ชันของหน้าจอมาตอบตัวเอง
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1000 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1300);

/* ของจริงเรียก laSbInit จากลูปตอนบูตใน 01-auth-sync (หลัง /api/me ผ่าน)
   ชุดทดสอบไม่ได้เดินเส้นนั้น จึงเรียกเองหนึ่งครั้งให้เหมือนตอนเปิดหน้าจริง
   ต้องเรียก "ก่อน" ตรวจข้อ 1 ด้วย · ไม่งั้นโค้ดที่แอบสร้างแถบสีคืนจะรอดสายตา */
await page.evaluate(() => { if (typeof laSbInit === 'function') laSbInit(); });
await page.waitForTimeout(200);

/* ══ 1+2 · ไม่มีอะไรของแถบเลือกสีเหลืออยู่ ═══════════════════════════════ */
const R1 = await page.evaluate(() => {
  const txt = (document.querySelector('.sidebar') || {}).innerText || '';
  return {
    sw: document.querySelectorAll('#la-sbcolor-sw').length,
    ch: document.querySelectorAll('#la-sbcolor-ch').length,
    dots: document.querySelectorAll('.sidebar [data-c]').length,
    label: /สีแท็บ/.test(txt),
    styleTag: document.querySelectorAll('#la-sbcolor').length,
    fns: ['laSbColorPickerHTML', 'laSetSidebarColor', 'laSbResetColor',
          'laSbToggleColorPicker', 'laApplySidebarColor']
         .filter(n => typeof window[n] === 'function'),
    consts: (typeof LA_SB_COLORS !== 'undefined') ? 'LA_SB_COLORS' : ''
  };
});
if (R1.sw || R1.ch || R1.dots || R1.label)
  fail('ยังมีแถบเลือกสีอยู่ในเมนู · กล่อง ' + R1.sw + ' · จุดสี ' + R1.dots +
       (R1.label ? ' · ยังมีคำว่า "สีแท็บ"' : ''));
else if (R1.styleTag) fail('ยังมี <style> ที่ยัดสีเมนู (#la-sbcolor) ค้างอยู่ใน head');
else if (R1.fns.length || R1.consts)
  fail('ยังมีโค้ดของแถบสีค้างอยู่ · ' + R1.fns.concat(R1.consts).filter(Boolean).join(', '));
else ok('แถบเลือกสีถูกตัดออกหมดแล้ว · ไม่มีกล่อง ไม่มีจุดสี ไม่มีคำว่า "สีแท็บ" ' +
        'ไม่มี <style> ค้าง และไม่มีฟังก์ชันของมันเหลือ');

/* ══ 3 · ตัวพับกลุ่มยังติดครบ ═══════════════════════════════════════════ */
const R3 = await page.evaluate(() => {
  const secs = [].slice.call(document.querySelectorAll('.sidebar .nav-section'));
  return { n: secs.length,
    marked: secs.filter(s => s.dataset.acc === '1').length,
    chev: secs.filter(s => s.querySelector('.acc-ch')).length,
    labels: secs.map(s => (s.dataset.acclbl || '').trim()).filter(Boolean).length };
});
if (!R3.n) fail('ไม่มีหัวกลุ่มในเมนูซ้ายเลย · เทียบไม่ได้');
else if (R3.marked !== R3.n || R3.chev !== R3.n)
  fail('หัวกลุ่ม ' + R3.n + ' กลุ่ม · ติดเครื่องหมาย ' + R3.marked + ' · มีลูกศร ' + R3.chev);
else if (R3.labels !== R3.n) fail('หัวกลุ่มบางอันไม่มีป้ายชื่อไว้จำสถานะพับ');
else ok('ตัวพับกลุ่มติดครบทุกหัวกลุ่ม ' + R3.n + ' กลุ่ม (เครื่องหมาย data-acc + ลูกศร + ป้ายชื่อ)');

/* ══ 4 · พับ/กางได้จริง และจำสถานะ ═════════════════════════════════════ */
const R4 = await page.evaluate(() => {
  const sec = document.querySelector('.sidebar .nav-section[data-acc]');
  if (!sec) return { err: 'ไม่มีหัวกลุ่ม' };
  /* นับเมนูในกลุ่มนี้เองจาก DOM · ไล่จากหัวกลุ่มไปจนเจอหัวกลุ่มถัดไป */
  const mine = [];
  for (let n = sec.nextElementSibling; n && !n.classList.contains('nav-section'); n = n.nextElementSibling)
    if (n.classList.contains('nav-item')) mine.push(n);
  const vis = () => mine.filter(x => !x.classList.contains('acc-hidden')).length;
  const before = vis();
  sec.click();
  const folded = vis();
  const stored = (function () { try { return localStorage.getItem('la_sbacc_' + laSbUser()) || ''; } catch (e) { return ''; } })();
  sec.click();
  const back = vis();
  return { n: mine.length, before, folded, back, lbl: sec.dataset.acclbl,
           remembered: stored.indexOf(sec.dataset.acclbl) >= 0 };
});
if (R4.err) fail(R4.err);
else if (!R4.n) fail('กลุ่มแรกไม่มีเมนูข้างใน · ทดสอบพับไม่ได้');
else if (R4.folded !== 0) fail('พับกลุ่ม "' + R4.lbl + '" แล้วยังเห็นเมนู ' + R4.folded + ' อัน');
else if (R4.back !== R4.before) fail('กางกลับมาได้ ' + R4.back + ' อัน · ตอนแรกมี ' + R4.before);
else if (!R4.remembered) fail('พับแล้วไม่ได้จำสถานะลง la_sbacc_<user>');
else ok('พับ/กางกลุ่มยังทำงาน · "' + R4.lbl + '" ' + R4.before + ' เมนู → พับหาย 0 → กางกลับครบ ' +
        R4.back + ' · จำสถานะไว้ต่อเครื่อง');

/* ══ 5 · เมนูถูกวาดใหม่แล้ว nav() ต้องติดตัวพับกลับมาเอง ════════════════ */
const R5 = await page.evaluate(() => {
  /* จำลองการวาดเมนูใหม่ · ลบเครื่องหมายกับลูกศรออกให้เหมือนถูกสร้างใหม่ทั้งดุ้น */
  const secs = [].slice.call(document.querySelectorAll('.sidebar .nav-section'));
  secs.forEach(s => { delete s.dataset.acc; const c = s.querySelector('.acc-ch'); if (c) c.remove(); });
  const wiped = document.querySelectorAll('.sidebar .nav-section[data-acc]').length;
  /* กดเมนูสักอัน · nav() ต้องรู้ว่าเมนูถูกวาดใหม่แล้วเรียก laSbInit เอง */
  const item = document.querySelector('.sidebar .nav-item[data-view]');
  if (item && typeof nav === 'function') nav(item);
  const after = document.querySelectorAll('.sidebar .nav-section[data-acc]').length;
  const chev  = document.querySelectorAll('.sidebar .nav-section .acc-ch').length;
  return { total: secs.length, wiped, after, chev };
});
if (R5.wiped !== 0) fail('ลบเครื่องหมายไม่สำเร็จ · ทดสอบไม่ได้');
else if (R5.after !== R5.total || R5.chev !== R5.total)
  fail('เมนูถูกวาดใหม่แล้วกดเมนู · ตัวพับกลับมาแค่ ' + R5.after + '/' + R5.total +
       ' กลุ่ม (ลูกศร ' + R5.chev + ') · เครื่องหมายที่ใช้เช็คว่าเมนูถูกวาดใหม่ไม่ทำงาน');
else ok('เมนูถูกวาดใหม่แล้วกดเมนูสักอัน · ตัวพับกลุ่มกลับมาเองครบ ' + R5.after + '/' + R5.total +
        ' กลุ่ม (เดิมใช้แถบสีเป็นตัวเช็ค · ตอนนี้ใช้ data-acc แทน)');

/* ══ 6 · ไม่มี error บนหน้า ═══════════════════════════════════════════ */
const errs = (errors || []).filter(e => !/favicon|fonts\.googleapis/i.test(String(e)));
if (errs.length) fail('มี error บนหน้า ' + errs.length + ' ตัว · ' + String(errs[0]).slice(0, 150));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
