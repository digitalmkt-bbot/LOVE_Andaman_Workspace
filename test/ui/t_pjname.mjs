// §pjName · ใบงานเรือ · ชื่อคนในช่องเลือกต้องขึ้นครบ ไม่โดนตัด
//
// ที่มา (2026-09-23) · ผู้ใช้ส่งภาพการ์ดมา · ทุกช่องขึ้นชื่อไม่เต็ม
//   "นายวีรพล จันทร์เจ้ย (เต้…" · "นางสาว…" · "นายอนันต์ กันติชล (ลิฟ) · กัปตัน (4 เ…"
//   วัดจริงที่จอ 1600 การ์ด 4 ใบ · การ์ดกว้าง 302px ช่อง select เหลือ 141px
//   ชื่อพนักงานจริงยาว 202px (กลาง) ถึง 329px (ยาวสุด) · ไม่พอสักคนเดียว
//   <select> ตัดคำเองไม่ได้ · ดันให้กว้างกว่านี้ในการ์ด 302px ก็ยังไม่พอ
//
// ทางแก้คือเอาชื่อออกมาวาดเองแล้ววาง select โปร่งใสทับ
//   เมนูยังเป็นของเบราว์เซอร์ (optgroup แยกท่า/ตำแหน่ง · พิมพ์ตัวแรกกระโดดได้)
//
// เทสนี้กันเจ็ดอย่าง
//   1 ชื่อต้องไม่ถูกตัดสักช่อง
//   2 ชื่อที่โชว์ต้องเป็นชื่อของคนที่ถูกเลือกจริง
//   3 select ที่ทับอยู่ต้องยังเป็นตัวที่รับคลิก (ไม่งั้นเลือกคนไม่ได้เลย)
//   4 เลือกคนใหม่แล้วต้องเปลี่ยนจริงและชื่อบนการ์ดต้องตาม
//   5 ช่องว่างต้องบอกว่าว่าง ไม่ใช่เงียบ
//   6 ชื่อต้องไม่ล้นออกนอกการ์ด (การ์ดเป็น overflow:hidden · ล้นแล้วหายเงียบ)
//   7 ใบที่ปิดแล้ว (ดูอย่างเดียว) ต้องไม่มี select ให้กด แต่ชื่อยังอ่านครบ
//   8 ห้ามตัดกลางคำ · Chrome ตัดภาษาไทยด้วยพจนานุกรมของมันเอง
//     (อัฟฟาน) ถูกหักเป็น (อัฟ / ฟาน) มาแล้ว · อ่านแล้วสะดุดและดูเหมือนคนละชื่อ
//   9 ชื่อส่วนใหญ่ต้องอยู่บรรทัดเดียว · ไม่ใช่แค่ "ไม่ถูกตัด" แต่ต้องอ่านรวดเดียวจบ
//     วัดด้วยชื่อที่ยาวระดับ 80% ของทะเบียนจริง (ไม่ใช่ชื่อสั้นที่สุด)
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1200 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);

/* ปลูกเคส · ใส่คนที่ชื่อยาวที่สุดลงทุกช่องของลำที่วิ่ง · วัดกรณีแย่สุดเสมอ */
const S = await page.evaluate(() => {
  const D = '2026-09-23';
  let pick = null;
  for (const pier of (PO_PIERS || []).map(x => x.k)){
    const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
    const rt = (ROUTES || []).find(r => (r.pier || '') === pier) || (ROUTES || [])[0];
    if (!mine.length || !rt) continue;
    TRIPS[D] = TRIPS[D] || {};
    mine.forEach(b => { if (!TRIPS[D][b.id]) TRIPS[D][b.id] = { route:rt.id, type:'normal', booked:0 }; });
    _poDate = D; _poPier = pier;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById('view-poj-' + pier); if (v) v.classList.add('active');
    renderPierJob(pier);
    const sw = document.querySelector('.pj-pop[id^="pjwb-"] .pj-sw[onclick]');
    const m = sw ? /pjWbSet\('([^']+)'/.exec(sw.getAttribute('onclick') || '') : null;
    if (m){ pick = { bid:m[1], pier }; break; }
  }
  if (!pick) return { err:'ไม่มีลำที่วิ่ง' };
  const staff = (PIER_STAFF || []).filter(s => s.active !== false);
  if (staff.length < 5) return { err:'ทะเบียนพนักงานน้อยเกินวัด (' + staff.length + ' คน)' };
  const len = s => ((s.name || '') + (s.nick || '') + (s.role || '')).length;
  const byLen = staff.slice().sort((a, z) => len(z) - len(a));
  pjSet(D, pick.bid, { cap:byLen[0].id, asst:byLen[1].id,
                       crew:[byLen[2].id, byLen[3].id, byLen[4].id] });
  renderPierJob(pick.pier);
  return { err:'', bid:pick.bid, pier:pick.pier, date:D,
           /* บีบช่องว่างซ้ำ · ทะเบียนจริงมีชื่อที่พิมพ์เว้นวรรคติดกันสองสามเคาะ
              ฝั่งการ์ดห่อทีละคำแล้วต่อด้วยช่องว่างเดียว จึงต้องเทียบบนฐานเดียวกัน */
           want: byLen.slice(0, 5).map(s => ((s.name || s.nick || s.id)
                   + (s.nick && s.name ? (' (' + s.nick + ')') : '')).replace(/\s+/g, ' ').trim()),
           canEdit:(typeof poCanEdit === 'function') ? poCanEdit() : null };
});
if (S.err){ console.log('  ! ' + S.err + ' · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0'); await close(); process.exit(0); }
if (!S.canEdit){ console.log('  ! ผู้ใช้ชุดนี้แก้ไม่ได้ · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0'); await close(); process.exit(0); }

const CARD = '#pj-host-' + S.pier;
const read = () => page.evaluate(id => {
  const pop = document.getElementById(id);
  const bc = pop && pop.closest('.bc');
  if (!bc) return { err:'ไม่พบการ์ด' };
  const cr = bc.getBoundingClientRect();
  const rows = [].slice.call(bc.querySelectorAll('.pj-rw')).filter(r => r.querySelector('.pj-nm'));
  /* ⚠ แถวที่มี select แต่ไม่มี .pj-nm = ยังเป็นของเดิมที่ชื่อโดนตัด
     ถ้าไม่นับไว้ แถวนั้นจะหายจากการวัดไปเฉย ๆ แล้วเทสผ่านโดยไม่ได้วัดอะไร */
  const withSel = [].slice.call(bc.querySelectorAll('.pj-rw')).filter(r => r.querySelector('select'));
  return { err:'', cardW:Math.round(cr.width),
    nSel: withSel.length,
    bare: withSel.filter(r => !r.querySelector('.pj-nm'))
                 .map(r => ((r.querySelector('.k') || {}).textContent || '').trim()),
    rows: rows.map(r => {
      const nm = r.querySelector('.pj-nm'), ov = r.querySelector('select.pj-ov');
      const b = nm.getBoundingClientRect();
      /* จุดกลางของกล่องชื่อ · ใครอยู่บนสุดตรงนั้นคือคนที่จะได้รับคลิก */
      const hit = document.elementFromPoint(Math.round(b.left + b.width/2), Math.round(b.top + b.height/2));
      return {
        k:(r.querySelector('.k') || {}).textContent.trim(),
        txt:(nm.textContent || '').trim(),
        /* ชื่อ = ทุกคำที่ไม่ได้อยู่ในตำแหน่ง (.pj-ro) · ต่อกลับด้วยช่องว่างเดียว */
        name: [].slice.call(nm.querySelectorAll('.pj-w'))
                .filter(w => !w.closest('.pj-ro'))
                .map(w => (w.textContent || '').trim()).join(' '),
        cut: nm.scrollWidth > nm.clientWidth + 1 || nm.scrollHeight > nm.clientHeight + 1,
        outside: Math.round(Math.max(0, b.right - cr.right, cr.left - b.left)),
        h: Math.round(r.getBoundingClientRect().height),
        hasOv: !!ov,
        hitIsOv: !!(hit && hit === ov),
        /* คำที่ถูกหักคนละบรรทัดจะมีกล่องมากกว่าหนึ่งใบ · นับตรง ๆ ได้เลย */
        words: nm.querySelectorAll('.pj-w').length,
        /* ⚠ getClientRects() ของตัวกล่องเองคืนกล่องเดียวเสมอ ไม่ว่าข้อความจะกี่บรรทัด
           (.pj-nm เป็น flex item = กล่องบล็อก) · เคยใช้แล้วเทสผ่านทั้งที่ตกสองบรรทัดจริง
           นับจากขอบบนของคำแต่ละคำแทน · คำเป็น inline จึงตอบความจริง */
        lines: new Set([].slice.call(nm.querySelectorAll('.pj-w'))
                 .map(w => Math.round(w.getBoundingClientRect().top))).size || 1,
        /* ป้ายช่องตกไปอยู่คนละบรรทัดกับชื่อหรือเปล่า · แถวเป็น flex-wrap
           ที่ไม่พอป้ายจะขึ้นไปบรรทัดบนของมันเอง ชื่อยังบรรทัดเดียวแต่แถวสูงสองเท่า */
        /* วัดที่กล่องนอก (.pj-sel) ไม่ใช่ตัวอักษรข้างใน
           ตัวข้างในหัก padding กับลูกศรออกไปราว 20px · เทียบกับขั้นต่ำที่ตั้งไว้ไม่ตรง */
        boxW: (function(){ const b = r.querySelector('.pj-sel');
          return b ? Math.round(b.getBoundingClientRect().width) : 0; })(),
        /* ⚠ เทียบที่ "กึ่งกลาง" ไม่ใช่ขอบบน · แถวเป็น align-items:center
           ช่องที่ชื่อตกสองบรรทัดจะสูงกว่าป้าย ขอบบนจึงไม่ตรงกันทั้งที่อยู่แถวเดียวกัน
           เคยรายงานว่าแถวไกด์พังทั้งที่เลย์เอาต์ถูก · วัดที่กึ่งกลางแทน */
        stacked: (function(){
          const k = r.querySelector('.k'), sel = r.querySelector('.pj-sel');
          if (!k || !sel) return false;
          const mid = e => { const q = e.getBoundingClientRect(); return q.top + q.height / 2; };
          return Math.abs(mid(k) - mid(sel)) > 6;
        })(),
        split: [].slice.call(nm.querySelectorAll('.pj-w'))
                 .filter(w => w.getClientRects().length > 1)
                 .map(w => (w.textContent || '').trim())
      };
    }) };
}, 'pjwb-' + S.bid.replace(/[^A-Za-z0-9_-]/g, '_'));

let R = await read();
if (R.err){ fail(R.err); console.log('\nพัง ' + bad); await close(); process.exit(1); }
console.log('ปลูกเคส · ' + S.date + ' ท่า ' + S.pier + ' · ' + S.bid + ' · การ์ดกว้าง ' + R.cardW + 'px · ' + R.rows.length + ' ช่อง');

/* ══ 0 · ทุกช่องเลือกคนต้องวาดชื่อไว้ข้างนอก ══════════════════════════════
   ช่องไหนยังเป็น <select> เปล่า ชื่อจะโดนตัดที่ช่องนั้นและเทสข้ออื่นจะมองไม่เห็น
   (ช่องไกด์เคยตกหล่นมาแล้วตอนแก้รอบแรก · ผู้ใช้เป็นคนเจอ ไม่ใช่เทส) */
{
  if (R.bare && R.bare.length)
    fail('ยังมีช่องที่เป็น select เปล่า ' + R.bare.length + ' ช่อง · ' + R.bare.join(' · ') + ' — ชื่อจะโดนตัดตรงนั้น');
  else ok('ทุกช่องเลือกคน (' + R.nSel + ' ช่อง) วาดชื่อไว้ข้างนอกครบ');
}

/* ══ 1 · ไม่มีชื่อไหนถูกตัด ════════════════════════════════════════════════ */
{
  const cut = R.rows.filter(r => r.cut);
  if (cut.length) fail('ชื่อถูกตัด ' + cut.length + ' ช่อง · ' + cut.map(r => r.k + '="' + r.txt + '"').join(' | '));
  else ok('ชื่อขึ้นครบทุกช่อง ' + R.rows.length + ' ช่อง · ไม่มีอันไหนถูกตัด');
}

/* ══ 2 · ชื่อที่โชว์ต้องเป็นของคนที่ถูกเลือกจริง ═══════════════════════════
   ชื่อที่คาดหวังมาจากทะเบียนพนักงานดิบ ไม่ได้ถามการ์ดมาเทียบกับตัวเอง */
{
  const shown = R.rows.map(r => r.name).filter(Boolean);
  const miss = S.want.filter(w => !shown.some(s => s === w));
  if (miss.length) fail('คนที่ใส่ไว้ไม่ขึ้นบนการ์ด · ' + miss.join(' · ') + ' (การ์ดขึ้น ' + shown.join(' · ') + ')');
  else ok('ชื่อบนการ์ดตรงกับคนที่ใส่ไว้ครบทั้ง ' + S.want.length + ' คน');
}

/* ══ 3 · select ที่ทับอยู่ต้องเป็นตัวที่รับคลิก ═══════════════════════════
   วาดชื่อทับ select แล้วลืมให้ select อยู่บนสุด = เห็นชื่อแต่กดเลือกคนไม่ได้เลย */
{
  const withOv = R.rows.filter(r => r.hasOv);
  const dead = withOv.filter(r => !r.hitIsOv);
  if (!withOv.length) fail('ไม่มีช่องไหนมี select เลย · เลือกคนไม่ได้');
  else if (dead.length) fail('กดตรงกลางชื่อแล้วไม่โดน select ' + dead.length + ' ช่อง · ' + dead.map(r => r.k).join(' · '));
  else ok('กดตรงไหนของชื่อก็โดน select · ' + withOv.length + ' ช่อง');
}

/* ══ 4 · เลือกคนใหม่แล้วต้องเปลี่ยนจริง ═══════════════════════════════════ */
{
  const res = await page.evaluate(a => {
    const staff = (PIER_STAFF || []).filter(s => s.active !== false);
    const cur = pjOf(a.d, a.b).cap;
    const other = staff.filter(s => s.id !== cur)[0];
    if (!other) return { skip:true };
    const pop = document.getElementById('pjwb-' + a.b.replace(/[^A-Za-z0-9_-]/g, '_'));
    const bc = pop && pop.closest('.bc');
    const ov = bc && bc.querySelector('.pj-rw select.pj-ov');
    if (!ov) return { err:'ไม่พบ select' };
    ov.value = other.id;
    ov.dispatchEvent(new Event('change', { bubbles:true }));
    return { want:other.id,
             wantName:((other.name || other.nick || other.id)
               + (other.nick && other.name ? (' (' + other.nick + ')') : '')).replace(/\s+/g, ' ').trim() };
  }, { d:S.date, b:S.bid });
  await page.waitForTimeout(400);
  if (res.skip) console.log('  ! มีพนักงานคนเดียว · ข้ามข้อ 4');
  else if (res.err) fail(res.err);
  else {
    const got = await page.evaluate(a => pjOf(a.d, a.b).cap, { d:S.date, b:S.bid });
    const R2 = await read();
    const first = (R2.rows[0] || {}).name || '';
    if (got !== res.want) fail('เลือกคนใหม่แล้วไม่ถูกเก็บ · ได้ "' + got + '"');
    else if (first !== res.wantName) fail('เก็บแล้วแต่ชื่อบนการ์ดไม่ตาม · การ์ดขึ้น "' + first + '"');
    else ok('เลือกคนใหม่ · เก็บจริงและชื่อบนการ์ดเปลี่ยนตาม "' + first + '"');
  }
}

/* ══ 5 · ช่องว่างต้องบอกว่าว่าง ═══════════════════════════════════════════ */
{
  await page.evaluate(a => { pjSet(a.d, a.b, { cap:'' }); renderPierJob(_poPier); }, { d:S.date, b:S.bid });
  await page.waitForTimeout(350);
  const R3 = await read();
  const r0 = R3.rows[0] || {};
  if (!/ว่าง/.test(r0.txt || '')) fail('ช่องว่างไม่ได้บอกว่าว่าง · ขึ้น "' + (r0.txt || '') + '"');
  else ok('ช่องว่างขึ้น "' + r0.txt + '"');
}

/* ══ 6 · ชื่อต้องไม่ล้นออกนอกการ์ด ════════════════════════════════════════
   การ์ดเป็น overflow:hidden · ล้นเมื่อไหร่หายเงียบ ไม่มีอะไรบอก */
{
  const R4 = await read();
  const out = R4.rows.filter(r => r.outside > 0);
  const tall = R4.rows.filter(r => r.h > 90);
  if (out.length) fail('ชื่อล้นออกนอกการ์ด ' + out.length + ' ช่อง · เกินไป ' + Math.max(...out.map(r => r.outside)) + 'px');
  else if (tall.length) fail('แถวสูงผิดปกติ ' + Math.max(...tall.map(r => r.h)) + 'px · ตัดบรรทัดมากเกินไป');
  else ok('ไม่มีชื่อล้นออกนอกการ์ด · แถวสูงสุด ' + Math.max(...R4.rows.map(r => r.h)) + 'px');
}

/* ══ 7 · ใบที่ปิดแล้ว · ไม่มี select ให้กด แต่ชื่อยังอ่านครบ ═══════════════ */
{
  await page.evaluate(a => {
    const staff = (PIER_STAFF || []).filter(s => s.active !== false);
    pjSet(a.d, a.b, { cap:staff[0].id, lock:1 });
    renderPierJob(_poPier);
  }, { d:S.date, b:S.bid });
  await page.waitForTimeout(400);
  const R5 = await read();
  const anyOv = R5.rows.some(r => r.hasOv);
  const cut = R5.rows.filter(r => r.cut);
  if (anyOv) fail('ใบปิดแล้วแต่ยังมี select ให้กดเปลี่ยนคน');
  else if (cut.length) fail('ใบปิดแล้วชื่อถูกตัด ' + cut.length + ' ช่อง');
  else ok('ใบที่ปิดแล้ว · ไม่มี select ให้กด และชื่อยังอ่านครบ');
  await page.evaluate(a => { pjSet(a.d, a.b, { lock:0 }); renderPierJob(_poPier); }, { d:S.date, b:S.bid });
}

/* ══ 8 · ห้ามตัดกลางคำ ════════════════════════════════════════════════════
   Chrome ตัดบรรทัดภาษาไทยด้วยพจนานุกรมของมันเอง แม้ไม่มีช่องว่าง
   word-break:keep-all ไม่ช่วย (Chrome ใช้กับ CJK เท่านั้น) · ต้องห่อทีละคำด้วย nowrap */
{
  await page.evaluate(a => {
    const staff = (PIER_STAFF || []).filter(s => s.active !== false);
    const len = s => ((s.name || '') + (s.nick || '')).length;
    const byLen = staff.slice().sort((x, z) => len(z) - len(x));
    pjSet(a.d, a.b, { cap:byLen[0].id, asst:byLen[1].id,
                      crew:[byLen[2].id, byLen[3].id, byLen[4].id], lock:0 });
    renderPierJob(_poPier);
  }, { d:S.date, b:S.bid });
  await page.waitForTimeout(400);
  const R6 = await read();
  const broken = R6.rows.filter(r => r.split && r.split.length);
  /* ไม่มี .pj-w เลย = ไม่ได้ห่อคำไว้ · ข้อนี้จะกลายเป็นข้อที่ผ่านโดยไม่ได้วัดอะไร */
  const unwrapped = R6.rows.filter(r => r.txt && !/ว่าง/.test(r.txt) && !r.words);
  if (unwrapped.length)
    fail('ไม่ได้ห่อคำไว้ ' + unwrapped.length + ' ช่อง · ข้อนี้วัดอะไรไม่ได้ และ Chrome จะตัดกลางคำไทยได้อีก');
  else if (broken.length)
    fail('คำถูกหักคนละบรรทัด ' + broken.length + ' ช่อง · ' + broken.map(r => r.split.join('/')).join(' | '));
  else ok('ไม่มีคำไหนถูกหักคนละบรรทัด · ตัดเฉพาะที่ช่องว่าง');
}

/* ══ 9 · ชื่อส่วนใหญ่ต้องอยู่บรรทัดเดียว ═══════════════════════════════════
   "ไม่ถูกตัด" ยังไม่พอ · สองบรรทัดอ่านสะดุดและทำให้การ์ดยาวขึ้นทั้งใบ
   วัดด้วยชื่อที่ยาวระดับ 80% ของทะเบียนจริง · ไม่ใช่ชื่อสั้นที่สุดซึ่งผ่านอยู่แล้วแน่ ๆ
   ที่ไม่วัดด้วยชื่อยาวที่สุด เพราะการ์ดกว้าง 302px · ชื่อ 203px ยังไงก็ต้องสองบรรทัด
   ตราบใดที่ยังไม่ย่อฟอนต์ ซึ่งแลกไม่คุ้มสำหรับหน้าจอที่ใช้ตอนเช้ามืด */
{
  const P80 = await page.evaluate(a => {
    const staff = (PIER_STAFF || []).filter(s => s.active !== false);
    const nm = s => (s.name || s.nick || s.id) + (s.nick && s.name ? (' (' + s.nick + ')') : '');
    const byLen = staff.slice().sort((x, z) => nm(x).length - nm(z).length);
    const pick = byLen[Math.floor(byLen.length * 0.8)] || byLen[byLen.length - 1];
    pjSet(a.d, a.b, { cap:pick.id, asst:pick.id, crew:[pick.id, pick.id, pick.id], lock:0 });
    /* จ่ายไกด์ด้วย · แถวไกด์มีป้าย "หัวหน้า" กับชิปภาษามาแย่งที่กับชื่อ
       เป็นแถวที่คับที่สุด · ไม่จ่ายไว้เทสจะมองไม่เห็นกรณีนี้เลย */
    try{
      let G=(typeof goGuides==='function')?goGuides().filter(g=>g.active!==false):[];
      /* เลือกไกด์ที่บีบช่องชื่อมากที่สุด · ชื่อยาว + ภาษาหลายชิป
         แถวแรกได้ป้าย "หัวหน้า" เพิ่มมาอีก · ตรงกับภาพที่ผู้ใช้ส่งมา */
      const wt = g => (((g.name||'')+(g.nick||'')).length)
                    + 8 * ((typeof goLangsOf==='function' ? (goLangsOf(g)||[]) : []).length);
      G = G.slice().sort((x,z) => wt(z) - wt(x));
      if(G.length>=2 && typeof goAsnSet==='function') goAsnSet(a.d, a.b, {g:[G[0].id,G[1].id], other:0});
    }catch(_){}
    renderPierJob(_poPier);
    return { name:nm(pick), len:nm(pick).length };
  }, { d:S.date, b:S.bid });
  await page.waitForTimeout(400);
  const R7 = await read();
  /* ⚠ ไม่วัดด้วยความสูงของแถว · แถวไกด์สูงสองบรรทัดโดยตั้งใจ
     เพราะป้ายหัวหน้า/ชิปภาษาถูกดันลงไป · ชื่อยังอยู่บรรทัดเดียวกับป้ายช่อง
     สิ่งที่ต้องวัดคือ "ชื่อกินกี่บรรทัด" กับ "ป้ายถูกดันขึ้นไปบรรทัดบนหรือเปล่า" */
  /* วัดเฉพาะชื่อที่ไม่ยาวเกินชื่อระดับ 80% ที่ปลูกไว้
     การ์ดกว้าง 302px · หักป้ายช่องแล้วเหลือให้ชื่อ 208px
     ชื่อ 35 ตัวกิน 208px → จะให้อยู่บรรทัดเดียวต้องย่อฟอนต์
     ซึ่งหน้านี้ใช้ตอนเช้ามืดกลางแจ้ง · แลกไม่คุ้ม
     ข้อบังคับจึงเป็น "ชื่อถึงระดับ 80% ต้องบรรทัดเดียว" · ที่ยาวกว่านั้นขอแค่อย่าให้ถูกตัด (ข้อ 1) */
  const long    = R7.rows.filter(r => r.name && r.name.length > P80.len);
  const multi   = R7.rows.filter(r => r.name && r.lines > 1 && r.name.length <= P80.len);
  const stacked = R7.rows.filter(r => r.name && r.stacked);
  if (multi.length)
    fail('ชื่อระดับ 80% ("' + P80.name + '") ตกสองบรรทัด ' + multi.length + ' ช่อง · '
      + multi.map(r => r.k + ' "' + r.name + '" กว้าง ' + r.boxW + 'px').join(' · '));
  else if (stacked.length)
    fail('ป้ายช่องถูกดันขึ้นไปคนละบรรทัดกับชื่อ ' + stacked.length + ' ช่อง · ' + stacked.map(r => r.k).join(' · '));
  else ok('ชื่อระดับ 80% ของทะเบียน ("' + P80.name + '" ' + P80.len
    + ' ตัว) อยู่บรรทัดเดียวกับป้ายช่องทุกช่อง · ช่องชื่อแคบสุด '
    + Math.min(...R7.rows.filter(r => r.name).map(r => r.boxW)) + 'px'
    + (long.length ? ('  (ยาวเกิน ' + P80.len + ' ตัว ' + long.length + ' ช่อง · ตกสองบรรทัด '
        + long.filter(r => r.lines > 1).length + ' · ไม่ถูกตัด)') : ''));
}

/* ══ 10 · ไม่มี error บนหน้า ══════════════════════════════════════════════ */
if (errors && errors.length) fail('มี error บนหน้า ' + errors.length + ' รายการ · ' + String(errors[0]).slice(0, 140));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await close();
process.exit(bad ? 1 : 0);
