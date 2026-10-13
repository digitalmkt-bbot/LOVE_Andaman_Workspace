// §pjWbTxt · ใบงานเรือ · ชื่อสีสายรัดข้อมือต้องพิมพ์เองได้
//
// ที่มา (2026-09-23) · ช่อง Wristband เลือกสีได้อย่างเดียว
//   ชุดสีมาตรฐานมาพร้อมชื่อ แต่ล็อตที่ซื้อมาได้สีนอกชุด กด "เลือกสีเอง" แล้ว
//   ชื่อถูกตั้งเป็นคำว่า "สีเอง" ตายตัว แก้ไม่ได้
//   ใบงานเรือถูกปริ้นขาวดำและถูกแคปส่งไลน์ · บนใบนั้น "สีเอง" บอกอะไรไม่ได้เลย
//   และคนสั่งสายรัดล็อตต่อไปทางไลน์ก็พิมพ์ชื่อสีไม่ได้
//
// เทสนี้กันหกอย่าง
//   1 ป๊อปอัพสายรัดต้องมีช่องพิมพ์ชื่อสี
//   2 คลิกในช่องแล้วป๊อปอัพต้องไม่หุบ (ป๊อปอัพเปิด/ปิดด้วย onclick ที่ span แม่)
//   3 พิมพ์ชื่อแล้วต้องเก็บจริง และขึ้นบนการ์ด
//   4 เลือกสีเองทีหลัง ต้องไม่ทับชื่อที่พิมพ์ไว้ด้วยคำว่า "สีเอง"
//   5 พิมพ์ชื่อโดยไม่มีสีก็ได้ · และชื่อต้องไปโผล่บนใบที่ปริ้น
//   6 ชื่อยาวเกินต้องถูกตัด ไม่ใช่เก็บยาวไปทำใบแตก
//   7 ป๊อปอัพทั้งกล่องต้องอยู่ในกรอบที่มองเห็น · การ์ดเป็น overflow:hidden
//     ยาวเกินขอบล่างเมื่อไหร่ แถวล่างสุด (เลือกสีเอง · ล้างสี) ถูกกลืนหายโดยไม่มีอะไรบอก
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);

/* ปลูกเคส · ให้เรือของท่าหนึ่งมีทริปในวันนั้น แล้วหาการ์ดที่มีช่องสายรัดจริง
   ไม่เดาว่าลำไหน "วิ่ง" · ช่องนี้ขึ้นเฉพาะลำที่สถานะวันนั้นเป็น run
   จึงอ่านจากของที่วาดออกมาแล้ว ไม่ใช่จากกติกาที่เดาเอง */
const S = await page.evaluate(() => {
  const D = '2026-09-23';
  const tryPier = pier => {
    const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
    const rt = (ROUTES || []).find(r => (r.pier || '') === pier) || (ROUTES || [])[0];
    if (!mine.length || !rt) return null;
    TRIPS[D] = TRIPS[D] || {};
    mine.forEach(b => { if (!TRIPS[D][b.id]) TRIPS[D][b.id] = { route: rt.id, type: 'normal', booked: 0 }; });
    _poDate = D; _poPier = pier;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById('view-poj-' + pier);
    if (v) v.classList.add('active');
    renderPierJob(pier);
    /* ดึง bid จาก onclick ของช่องสีมาตรฐาน · ชื่อ id ถูกแปลงอักขระไปแล้ว ย้อนกลับไม่ได้
       ⚠ .pj-sw ถูกใช้กับป๊อปอัพสีโปรแกรม/สีสถานะด้วย และอยู่ก่อนในหน้า
          ไม่เจาะจง id ของป๊อปอัพสายรัด = ได้ช่องสีของป๊อปอัพอื่นมาแทน */
    const sw = document.querySelector('.pj-pop[id^="pjwb-"] .pj-sw[onclick]');
    const m = sw ? /pjWbSet\('([^']+)'/.exec(sw.getAttribute('onclick') || '') : null;
    return m ? { bid: m[1], pier, nCards: document.querySelectorAll('.pj-wb').length } : null;
  };
  let got = null;
  for (const p of (PO_PIERS || []).map(x => x.k)){ got = tryPier(p); if (got) break; }
  return Object.assign({ bid:'', pier:'', nCards:0, date:D,
    canEdit: (typeof poCanEdit === 'function') ? poCanEdit() : null }, got || {});
});

if (!S.canEdit){ console.log('  ! ผู้ใช้ชุดนี้แก้ไม่ได้ · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0'); await close(); process.exit(0); }
if (!S.bid){ console.log('  ! วันนี้ไม่มีลำที่วิ่งบนท่านี้ · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0'); await close(); process.exit(0); }

const WID = 'pjwb-' + S.bid.replace(/[^A-Za-z0-9_-]/g, '_');
const SEL = '#' + WID + ' input.pj-wbni';
console.log('ปลูกเคส · ' + S.date + ' ท่า ' + S.pier + ' · ' + S.nCards + ' ลำมีช่องสายรัด · ใช้ ' + S.bid);

const stored = () => page.evaluate(b => {
  const o = PIER_JOB[pjKey(_poDate, b)] || {};
  return { wb: String(o.wb || ''), wbc: String(o.wbc || '') };
}, S.bid);
const openPop = async () => {
  await page.evaluate(id => { try{ pjPopToggle(id); }catch(_){} }, WID);
  await page.waitForTimeout(150);
};
const cardText = () => page.evaluate(id => {
  const p = document.getElementById(id);
  const host = p && p.closest('.pj-wb');
  if (!host) return '';
  /* เอาเฉพาะข้อความที่โชว์บนการ์ด ไม่เอาข้างในป๊อปอัพ */
  return [].slice.call(host.childNodes)
    .filter(n => !(n.id === id))
    .map(n => (n.textContent || '')).join(' ').trim();
}, WID);

/* ══ 1 · ป๊อปอัพต้องมีช่องพิมพ์ชื่อสี ══════════════════════════════════════ */
await openPop();
const box = await page.evaluate(id => {
  const p = document.getElementById(id);
  if (!p || !p.classList.contains('on')) return { err: 'ป๊อปอัพไม่เปิด' };
  const i = p.querySelector('input.pj-wbni');
  if (!i) return { err: 'ไม่มีช่องพิมพ์ชื่อสี' };
  const r = i.getBoundingClientRect(), q = p.getBoundingClientRect();
  return { w: Math.round(r.width), inside: (r.left >= q.left - 1 && r.right <= q.right + 1),
           ph: i.getAttribute('placeholder') || '' };
}, WID);
if (box.err) fail(box.err);
else if (!box.inside || box.w < 60) fail('ช่องชื่อสีล้นกรอบป๊อปอัพ หรือแคบเกินพิมพ์ (' + box.w + 'px)');
else ok('ป๊อปอัพมีช่องพิมพ์ชื่อสี · กว้าง ' + box.w + 'px');

/* ══ 2 · คลิกในช่องแล้วป๊อปอัพต้องไม่หุบ ══════════════════════════════════
   ป๊อปอัพถูกเปิด/ปิดด้วย onclick ที่ span แม่ · คลิกอะไรข้างในก็เด้งขึ้นไปถึง
   ไม่หยุดไว้ = จิ้มช่องแล้วหุบทันที พิมพ์ไม่ได้เลยสักตัว */
if (!box.err){
  await page.click(SEL);
  await page.waitForTimeout(150);
  const alive = await page.evaluate(id => {
    const p = document.getElementById(id);
    return { on: !!(p && p.classList.contains('on')),
             focus: document.activeElement === (p && p.querySelector('input.pj-wbni')) };
  }, WID);
  if (!alive.on) fail('คลิกในช่องชื่อสีแล้วป๊อปอัพหุบ · พิมพ์ไม่ได้');
  else if (!alive.focus) fail('คลิกแล้วโฟกัสไม่เข้าช่อง');
  else ok('คลิกในช่องชื่อสี · ป๊อปอัพยังเปิดและโฟกัสอยู่ในช่อง');
}

/* ══ 3 · พิมพ์ชื่อแล้วต้องเก็บจริง และขึ้นบนการ์ด ═══════════════════════════ */
const NAME1 = 'ส้มอ่อน ล็อต 7';
if (!box.err){
  await page.fill(SEL, NAME1);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const v = await stored(), t = await cardText();
  if (v.wb !== NAME1) fail('พิมพ์ชื่อแล้วไม่ถูกเก็บ · ได้ "' + v.wb + '"');
  else if (t.indexOf(NAME1) < 0) fail('เก็บแล้วแต่การ์ดไม่โชว์ชื่อ · การ์ดขึ้น "' + t + '"');
  else ok('พิมพ์ "' + NAME1 + '" · เก็บจริงและขึ้นบนการ์ด');
}

/* ══ 4 · เลือกสีเองทีหลัง ต้องไม่ทับชื่อที่พิมพ์ไว้ ════════════════════════
   ลำดับที่คนทำจริงคือพิมพ์ชื่อก่อนแล้วค่อยจิ้มสีให้ตรงกับของในมือ
   ของเดิม onchange ยัด 'สีเอง' ลงไปตายตัว · พิมพ์ไปเท่าไหร่ก็หายหมด */
if (!box.err){
  await openPop();
  await page.evaluate(id => {
    const i = document.querySelector('#' + id + ' input[type=color]');
    if (i){ i.value = '#7a4b26'; i.dispatchEvent(new Event('change', { bubbles: true })); }
  }, WID);
  await page.waitForTimeout(500);
  const v = await stored();
  if ((v.wbc || '').toLowerCase() !== '#7a4b26') fail('เลือกสีเองแล้วสีไม่ถูกเก็บ · ได้ "' + v.wbc + '"');
  else if (v.wb !== NAME1) fail('เลือกสีเองแล้วชื่อที่พิมพ์ไว้ถูกทับเป็น "' + v.wb + '"');
  else ok('เลือกสีเองทีหลัง · สีเปลี่ยนเป็น ' + v.wbc + ' แต่ชื่อ "' + v.wb + '" ยังอยู่');
}

/* ══ 5 · พิมพ์ชื่อโดยไม่มีสีก็ได้ · และต้องไปโผล่บนใบที่ปริ้น ══════════════
   ใบนี้คือเหตุผลทั้งหมดของช่องนี้ · ปริ้นขาวดำแล้วเหลือแต่ชื่อให้อ่าน */
const NAME2 = 'น้ำตาลอ่อน';
if (!box.err){
  await page.evaluate(b => pjWbSet(b, '', ''), S.bid);     /* ล้างสี · กลับเป็นยังไม่ระบุ */
  await page.waitForTimeout(350);
  await openPop();
  await page.fill(SEL, NAME2);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const v = await stored();
  if (v.wb !== NAME2 || v.wbc) fail('พิมพ์ชื่อล้วนไม่ได้ · เก็บเป็น wb="' + v.wb + '" wbc="' + v.wbc + '"');
  else {
    /* ดักใบที่ปริ้น · pjPrint เขียน html ลงหน้าต่างใหม่ · สวมหน้าต่างปลอมไว้รับ */
    const html = await page.evaluate(() => {
      let cap = '';
      const real = window.open;
      window.open = () => ({ focus(){}, document: { open(){}, write(h){ cap += h; }, close(){} } });
      try { pjPrint(); } catch(e){ cap = 'ERR:' + (e && e.message); }
      window.open = real;
      return cap;
    });
    if (html.indexOf('ERR:') === 0) fail('เปิดใบปริ้นไม่ได้ · ' + html.slice(0, 120));
    else if (!html) fail('ใบปริ้นว่าง · วัดอะไรไม่ได้');
    else if (html.indexOf(NAME2) < 0) fail('ชื่อสีไม่ไปโผล่บนใบที่ปริ้น · ใบขาวดำจะไม่เหลืออะไรให้อ่าน');
    else ok('ชื่อล้วนไม่มีสีก็เก็บได้ · และ "' + NAME2 + '" ไปโผล่บนใบที่ปริ้น');
  }
}

/* ══ 6 · ชื่อยาวเกินต้องถูกตัด ════════════════════════════════════════════ */
if (!box.err){
  await openPop();
  const LONG = 'ก'.repeat(40);
  await page.evaluate(b => pjWbName(b, 'ก'.repeat(40)), S.bid);
  await page.waitForTimeout(400);
  const v = await stored();
  if (v.wb.length === 0) fail('ชื่อยาวถูกทิ้งทั้งหมด');
  else if (v.wb.length > 24) fail('ชื่อยาว ' + LONG.length + ' ตัวถูกเก็บทั้งดุ้น (' + v.wb.length + ' ตัว)');
  else ok('ชื่อยาว ' + LONG.length + ' ตัว ถูกตัดเหลือ ' + v.wb.length + ' ตัว');
}

/* ══ 7 · ป๊อปอัพต้องไม่ถูกกรอบการ์ดตัด ═══════════════════════════════════
   §pjPopFit · การ์ดเป็น overflow:hidden · กล่องที่ยาวเกินขอบล่างหายไปเงียบ ๆ
   เพิ่มแถวชื่อสีเข้าไป = กล่องสูงขึ้น ~35px · การ์ดที่อยู่ค่อนล่างของจอโดนตัดทันที
   ของที่หายคือแถวปุ่ม ไม่ใช่แค่ข้อความประดับ · วัดทุกความสูงจอที่ใช้งานจริง */
for (const h of [1100, 950, 820, 720]){
  await page.setViewportSize({ width: 1600, height: h });
  await page.waitForTimeout(300);
  await page.evaluate(() => { try{ renderPierJob(_poPier); }catch(_){} });
  await page.waitForTimeout(300);
  await openPop();
  const F = await page.evaluate(id => {
    const p = document.getElementById(id);
    if (!p || !p.classList.contains('on')) return { err: 'ป๊อปอัพไม่เปิด' };
    const r = p.getBoundingClientRect();
    let n = p.parentElement, worst = 0, who = '';
    while (n && n !== document.body){
      const cs = getComputedStyle(n);
      if (/hidden|clip|auto|scroll/.test(cs.overflowY) || /hidden|clip|auto|scroll/.test(cs.overflowX)){
        const q = n.getBoundingClientRect();
        const cut = Math.round(Math.max(0, r.bottom - q.bottom, q.top - r.top));
        if (cut > worst){ worst = cut; who = String(n.className || n.tagName).slice(0, 24); }
      }
      n = n.parentElement;
    }
    /* แถวล่างสุดของกล่องคือปุ่มที่ต้องกดจริง · ต้องอยู่ในกล่องด้วย
       ⚠ ไม่วัดกับขอบจอ · การ์ดที่อยู่ต่ำกว่าจอเป็นเรื่องปกติ เลื่อนหน้าลงไปก็ถึง
          ที่เลื่อนแล้วไม่ถึงคือของที่ถูก overflow ของแม่ตัดทิ้ง ซึ่งวัดไว้ที่ cut แล้ว */
    const btn = p.querySelector('.pj-wbc');
    const br = btn ? btn.getBoundingClientRect() : null;
    return { cut: worst, who, h: Math.round(r.height),
             btnOK: !!(br && br.height > 0 && br.bottom <= r.bottom + 1) };
  }, WID);
  if (F.err) fail(F.err);
  else if (F.cut > 0) fail('จอสูง ' + h + 'px · ป๊อปอัพถูก ' + F.who + ' ตัดไป ' + F.cut + 'px · ปุ่มแถวล่างหาย');
  else if (!F.btnOK) fail('จอสูง ' + h + 'px · ปุ่มเลือกสีเองหลุดออกนอกกล่องป๊อปอัพ');
  else ok('จอสูง ' + h + 'px · ป๊อปอัพ ' + F.h + 'px อยู่ในกรอบครบทั้งกล่อง');
}
await page.setViewportSize({ width: 1600, height: 1100 });

/* ══ 8 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
if (errors && errors.length) fail('มี error บนหน้า ' + errors.length + ' รายการ · ' + String(errors[0]).slice(0, 140));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await close();
process.exit(bad ? 1 : 0);
