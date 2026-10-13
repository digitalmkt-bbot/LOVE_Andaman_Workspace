// §wbHue · เช็คอินหน้าท่า · แถวที่เช็คอินแล้วต้องขึ้นพื้นเป็น "สีของสายรัด" จริง ๆ
//
// ที่มา (2026-09-23) · หน้าจริงเช็คอินครบ 26/26 แต่ทุกแถวพื้นเทา
//   วัดสีพื้นจากภาพหน้าจอได้ (245,246,247) ซึ่งตรงเป๊ะกับเทาสำรอง #B9BFC9 ที่ถูก tint
//   สาเหตุ: ล็อตวันนั้นเป็นเหลืองนีออน #FDFF71 สว่าง 0.934 เกินด่าน 0.88
//   ด่านเดิมเปลี่ยนสีที่สว่างเกินเป็นเทา = ทิ้งเนื้อสีทิ้งไปเลย
//   ทั้งที่สีคือทั้งหมดของเรื่องนี้ คนที่ท่าเอาแถวไปเทียบกับข้อมือแขก
//
// เทสนี้กันห้าอย่าง
//   1 สีอ่อนมากต้องยังเป็นสีของมัน ไม่ใช่เทา
//   2 พื้นต้องไม่จางจนแยกไม่ออกจากแถวที่ยังไม่เช็คอิน (เหตุผลเดิมของด่าน ต้องยังอยู่)
//   3 สีเข้มที่ใช้กันอยู่ทุกวันต้องได้พื้นเท่าเดิมเป๊ะ ไม่ใช่เปลี่ยนไปทั้งระบบ
//   4 พื้นหลังปุ่มเช็คอินต้องเข้มพอให้ตัวหนังสือสีขาวอ่านออก
//   5 สายรัดสีขาวยังต้องเป็นเทา · ขาวบนขาวโชว์ไม่ได้จริง ๆ
//
// ⚠ ค่าที่คาดหวังคำนวณในเทสเอง ไม่ได้เรียกฟังก์ชันของหน้ามาเทียบกับตัวเอง
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

/* ── คณิตสีฉบับเทส · เขียนแยกจากของในหน้าโดยตั้งใจ ────────────────────── */
const hx = h => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); };
const lum = ([r,g,b]) => (0.299*r + 0.587*g + 0.114*b) / 255;
const shade = (rgb,k) => rgb.map(v => Math.round(v*k));
const tint  = (rgb,t) => rgb.map(v => Math.round(v + (255-v)*t));
const hex   = rgb => '#' + rgb.map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
/* กติกาที่ต้องการ · หรี่ลงจนสว่างไม่เกิน 0.60 แล้วค่อยผสมขาว 86% เป็นพื้นแถว */
const want  = c => { const p = hx(c), L = lum(p); return tint(L > 0.60 ? shade(p, 0.60/L) : p, 0.86); };
const wantAccent = c => { const p = hx(c), L = lum(p); return L > 0.60 ? shade(p, 0.60/L) : p; };
const near = (a,b,tol=3) => a.length === b.length && a.every((v,i) => Math.abs(v-b[i]) <= tol);
const rgbOf = s => { const m = /rgba?\(([^)]+)\)/.exec(s||''); return m ? m[1].split(',').slice(0,3).map(x => Math.round(parseFloat(x))) : null; };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);

/* วันที่มีคนเช็คอินหน้าท่ามากที่สุด · คิดจากข้อมูลดิบ ไม่ได้ถามหน้า */
const D = await page.evaluate(() => {
  const n = {};
  (SB_BOOKINGS || []).forEach(b => (b && b.trips || []).forEach(t => {
    if (t && t.date) n[t.date] = (n[t.date] || 0) + 1; }));
  return Object.keys(n).sort((a,z) => n[z] - n[a])[0] || '';
});
if (!D){ console.log('  ! ชุดข้อมูลนี้ไม่มีใบจองเลย · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0'); await close(); process.exit(0); }

/* เปิดหน้าเช็คอินหน้าท่าแบบตาราง · ทุกลำใช้สีเดียวกันทั้งหมด จะได้ชี้ชัดว่าแถวไหนควรได้สีอะไร */
const paint = async col => page.evaluate(a => {
  _pckDate = a.d;
  try{ if (typeof _pckView !== 'undefined') pckSetView('sheet'); }catch(_){}
  (BOATS || []).forEach(b => { try{ pjSet(a.d, b.id, { wb:'ทดสอบ', wbc:a.c }); }catch(_){} });
  /* เช็คอินให้ทุกใบของวันนั้น · ต้องมีแถว ck-done ถึงจะมีพื้นให้วัด */
  (SB_BOOKINGS || []).forEach(b => {
    if (!b || !(b.trips || []).some(t => t && t.date === a.d)) return;
    try{ const v = ckRead(b, a.d, 'pier'); if (!(v && v.at)) ckToggle(b.id, a.d, 'pier'); }catch(_){}
  });
  renderPierCheckin();
}, { d:D, c:col });

/* พื้นของแถวที่เช็คอินแล้ว · อ่านจากสีที่เบราว์เซอร์คำนวณออกมาจริง ไม่ใช่จากตัวแปร */
const rowBg = () => page.evaluate(() => {
  const td = document.querySelector('#piercheckin-host tbody.pcs-set tr.ck-row.ck-done > td');
  if (!td) return { err:'ไม่มีแถวที่เช็คอินแล้วให้วัด' };
  const bare = document.querySelector('#piercheckin-host tbody.pcs-set tr.ck-row:not(.ck-done) > td');
  const btn = document.querySelector('#piercheckin-host tbody.pcs-set .pck-ok:not(.off)');
  return { bg: getComputedStyle(td).backgroundColor,
           bare: bare ? getComputedStyle(bare).backgroundColor : '',
           btn: btn ? getComputedStyle(btn).backgroundColor : '' };
});

/* ══ 1 · เหลืองนีออน · ต้องได้พื้นเหลือง ไม่ใช่เทา ═══════════════════════ */
const NEON = '#FDFF71';
await paint(NEON);
await page.waitForTimeout(700);
let R = await rowBg();
const GREY = tint(hx('#B9BFC9'), 0.86);            /* เทาสำรองของเดิม · ต้องไม่ได้ค่านี้ */
if (R.err) fail(R.err);
else {
  const got = rgbOf(R.bg), exp = want(NEON);
  if (!got) fail('อ่านสีพื้นไม่ได้ · ได้ "' + R.bg + '"');
  else if (near(got, GREY)) fail('ยังเป็นเทาเหมือนเดิม ' + hex(got) + ' · สีสายรัดถูกทิ้ง (อาการที่ผู้ใช้เจอ)');
  else if (!near(got, exp)) fail('พื้นไม่ตรงกติกา · ได้ ' + hex(got) + ' ควรเป็น ' + hex(exp));
  else if (got[2] >= got[0] || got[2] >= got[1]) fail('พื้น ' + hex(got) + ' ไม่ออกเหลือง · ช่องน้ำเงินไม่ต่ำกว่าแดง/เขียว');
  else ok('เหลืองนีออน ' + NEON + ' · พื้นแถว ' + hex(got) + ' ออกเหลืองจริง (เดิมได้เทา ' + hex(GREY) + ')');
}

/* ══ 2 · ต้องยังต่างจากแถวที่ยังไม่เช็คอิน ════════════════════════════════
   เหตุผลเดิมของด่านคือ "อ่อนจนแยกไม่ออก" · แก้แล้วเหตุผลนั้นต้องยังถูกกันอยู่ */
if (!R.err && R.bare){
  const a = rgbOf(R.bg), b = rgbOf(R.bare);
  const d = (a && b) ? Math.max(...a.map((v,i) => Math.abs(v-b[i]))) : 0;
  if (d < 4) fail('พื้นแถวที่เช็คอินแล้วกับยังไม่เช็คอินต่างกันแค่ ' + d + ' · แยกด้วยตาไม่ออก');
  else ok('ต่างจากแถวที่ยังไม่เช็คอิน ' + d + ' ระดับสี · ยังแยกออก');
}

/* ══ 3 · สีเข้มที่ใช้กันอยู่ทุกวันต้องได้พื้นเท่าเดิมเป๊ะ ══════════════════
   ของจริง 53 ใบใช้ ม่วง/ดำ/น้ำเงิน/ฟ้า TQ เป็นหลัก · แก้ครั้งนี้ต้องไม่ไปแตะ */
for (const [nm, c] of [['ม่วง','#8E2FD6'], ['ดำ','#1A1A1A'], ['น้ำเงิน','#185FA5']]){
  await paint(c);
  await page.waitForTimeout(500);
  const r = await rowBg();
  if (r.err){ fail(r.err); break; }
  const got = rgbOf(r.bg), exp = tint(hx(c), 0.86);   /* ไม่ผ่านการหรี่ · สว่างไม่ถึง 0.60 */
  if (!near(got, exp)) fail(nm + ' ' + c + ' · พื้นเปลี่ยนไปเป็น ' + hex(got) + ' (ต้องเท่าเดิม ' + hex(exp) + ')');
  else ok(nm + ' ' + c + ' · พื้น ' + hex(got) + ' เท่าเดิมทุกพิกเซล');
}

/* ══ 4 · ปุ่มเช็คอินต้องเข้มพอให้ตัวหนังสือขาวอ่านออก ════════════════════
   ครีม #EFE0B0 สว่าง 0.875 · ด่าน 0.88 ปล่อยผ่านมาตลอด ตัวหนังสือขาวจึงจม */
{
  const CREAM = '#EFE0B0';
  await paint(CREAM);
  await page.waitForTimeout(500);
  const r = await rowBg();
  if (r.err) fail(r.err);
  else if (!r.btn) console.log('  ! ไม่มีปุ่มเช็คอินให้วัด · ข้ามข้อ 4');
  else {
    const got = rgbOf(r.btn);
    const L = got ? lum(got) : 1;
    if (L > 0.62) fail('ครีม ' + CREAM + ' · พื้นปุ่ม ' + hex(got) + ' สว่าง ' + L.toFixed(3) + ' ตัวหนังสือขาวอ่านไม่ออก');
    else if (!near(got, wantAccent(CREAM))) fail('พื้นปุ่มไม่ตรงกติกา · ได้ ' + hex(got) + ' ควรเป็น ' + hex(wantAccent(CREAM)));
    else ok('ครีม ' + CREAM + ' · พื้นปุ่มหรี่เป็น ' + hex(got) + ' (สว่าง ' + L.toFixed(3) + ') ตัวหนังสือขาวอ่านออก');
  }
}

/* ══ 5 · สายรัดสีขาว · ยังต้องเป็นเทา ═══════════════════════════════════
   ขาวบนขาวโชว์ไม่ได้จริง ๆ · เทาคือคำตอบที่ซื่อสัตย์สำหรับเคสนี้เคสเดียว */
{
  await paint('#FFFFFF');
  await page.waitForTimeout(500);
  const r = await rowBg();
  if (r.err) fail(r.err);
  else {
    const got = rgbOf(r.bg);
    const spread = got ? (Math.max(...got) - Math.min(...got)) : 99;
    if (spread > 4) fail('สายรัดขาวแต่พื้นออกสี ' + hex(got) + ' · ขาวไม่ควรมีเนื้อสี');
    else if (lum(got) > 0.97) fail('สายรัดขาว · พื้น ' + hex(got) + ' ขาวจนแยกจากแถวที่ยังไม่เช็คอินไม่ออก');
    else ok('สายรัดขาว · พื้นเป็นเทากลาง ' + hex(got) + ' ตามเดิม');
  }
}

/* ══ 6 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
if (errors && errors.length) fail('มี error บนหน้า ' + errors.length + ' รายการ · ' + String(errors[0]).slice(0, 140));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await close();
process.exit(bad ? 1 : 0);
