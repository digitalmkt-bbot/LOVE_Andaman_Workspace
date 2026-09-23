// §flDeploy · Fleet Deployment · วางกำลังเรือก่อนเปิดฤดู
//
// ที่มา (2026-09-23) · ก่อนเปิดไฮซีซั่นต้องตอบสามคำถามติดกัน
//   ลำไหนอยู่ท่าไหน → ลำไหนยังติดซ่อมและต้องเสร็จวันไหน → ลำไหนวิ่งเส้นไหนในแต่ละวัน
// ของเดิมกระจายอยู่สามหน้า (Boat Status · Maintenance · Boat Operation)
//
// เทสนี้กันเก้าอย่าง
//   0 เมนูมีจริง และกดแล้วหน้าเปิดจริง (ไม่ใช่ div เปล่า)
//   1 เรือทุกลำต้องโผล่บนกระดาน · หายไปลำเดียวก็แปลว่าวางแผนจากของไม่ครบ
//   2 Seats ready ต้องนับเฉพาะลำที่พร้อมใช้ · ตัวเลขนี้คือตัวที่เอาไปตั้งโควตาขาย
//   3 ย้ายท่าต้องเป็น "ร่าง" · ข้อมูลจริงห้ามขยับจนกว่าคนจะกดบันทึก
//     (หน้านี้เป็นกระดานวางแผน · ลากเล่นดูภาพรวมต้องไม่ไปโผล่ที่หน้าอื่น)
//   4 ปฏิทินต้องเคารพฤดูกาลของเส้นทาง · วันที่ยังไม่เปิดขายต้องขึ้น "ปิดฤดู"
//   5 ที่นั่งต่อวันบนปฏิทินต้องตรงกับที่คำนวณเองจาก TRIPS
//   6 ใส่/ถอดเรือต้องไปผ่านตัวเขียนของ Boat Operation · ด่านกันวันที่ผ่านมาแล้วต้องยังอยู่
//   7 คิวซ่อม · งานไม่มีวันเสร็จต้องเป็นแถบลายทาง · งานที่เสร็จหลังวันเปิดฤดูต้องขึ้นสีเตือน
//   8 หน้านี้ต้องอยู่ในทะเบียนสิทธิ์ · laAllowed() ปล่อยผ่านเมนูที่ไม่รู้จัก = เปิดให้ทุกคน
//
// ⚠ ทุกข้อคำนวณค่าที่คาดหวังจากข้อมูลดิบเอง ไม่เรียกฟังก์ชันของหน้ามาเทียบกับตัวเอง
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1500, height: 1300 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1000);

/* ══ 0 · เมนูมีจริง และกดแล้วหน้าเปิด ═════════════════════════════════════ */
const R0 = await page.evaluate(() => {
  const el = document.querySelector('.nav-item[data-view="fl-deployment"]');
  if (!el) return { err: 'ไม่มีเมนู Fleet Deployment ในไซด์บาร์' };
  nav(el);
  const v = document.getElementById('view-fl-deployment');
  const w = document.getElementById('fl-deploy-wrap');
  return {
    err: !v ? 'ไม่มีกล่องหน้า #view-fl-deployment' : '',
    active: !!(v && v.classList.contains('active')),
    len: (w && w.innerHTML || '').length,
    label: el.textContent.trim()
  };
});
if (R0.err) { fail(R0.err); console.log('\nพัง ' + bad); await close(); process.exit(1); }
if (!R0.active)        fail('กดเมนูแล้วหน้าไม่ active');
else if (R0.len < 2000) fail('หน้าเปิดแต่วาดได้แค่ ' + R0.len + ' ตัวอักษร · แทบไม่มีอะไร');
else ok('เมนู "' + R0.label + '" เปิดหน้าได้ · วาด ' + R0.len + ' ตัวอักษร');

/* ══ 1 · เรือทุกลำต้องโผล่บนกระดาน ═══════════════════════════════════════ */
const R1 = await page.evaluate(() => {
  const w = document.getElementById('fl-deploy-wrap');
  const onBoard = [].slice.call(w.querySelectorAll('.fd-boat')).length;
  const want = (BOATS || []).filter(b => b && !b.retired).length;
  const cols = [].slice.call(w.querySelectorAll('.fd-col')).length;
  return { onBoard, want, cols };
});
if (R1.onBoard !== R1.want)
  fail('เรือบนกระดาน ' + R1.onBoard + ' ลำ แต่ทะเบียนมี ' + R1.want + ' ลำ · หายไป ' + (R1.want - R1.onBoard));
else if (R1.cols < 4) fail('กระดานมีแค่ ' + R1.cols + ' คอลัมน์ · ต้องมีสามท่า + อู่');
else ok('เรือครบทุกลำบนกระดาน ' + R1.want + ' ลำ · ' + R1.cols + ' คอลัมน์');

/* ══ 2 · Seats ready ต้องนับเฉพาะลำที่พร้อมใช้ ════════════════════════════
   คำนวณเองจาก BOATS + boatEffStatus โดยไม่แตะฟังก์ชันของหน้า
   (ถ้านับลำที่ยังซ่อมเข้าไปด้วย ตัวเลขนี้จะบวมและถูกเอาไปตั้งโควตาขายเกินจริง) */
const R2 = await page.evaluate(() => {
  const w = document.getElementById('fl-deploy-wrap');
  const from = w.querySelector('.fd-season input').value;
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  /* คาดหวัง · รวม cap ของลำที่สถานะวันเปิดฤดู = available เท่านั้น แยกตามท่า */
  const want = {};
  fleet.forEach(b => {
    const p = getBoatCurrentPier(b, from);
    const st = (boatEffStatus(b, from) || {}).s;
    if (!want[p]) want[p] = { ready: 0, all: 0 };
    want[p].all += (b.cap || 0);
    if (st === 'available') want[p].ready += (b.cap || 0);
  });
  const got = {};
  [].slice.call(w.querySelectorAll('.fd-col')).forEach(c => {
    const nm = (c.querySelector('.nm') || {}).textContent || '';
    const m  = c.querySelectorAll('.fd-mini b');
    if (m.length >= 2) got[nm.replace(/\d+\s*ลำ$/, '').trim()] = { ready: +m[0].textContent, all: +m[1].textContent };
  });
  return { from, want, got, labels: (typeof PIER_LABELS !== 'undefined') ? PIER_LABELS : {} };
});
{
  const miss = [];
  Object.keys(R2.want).forEach(k => {
    if (k === 'shop') return;                                  /* คอลัมน์อู่ไม่มีแถบตัวเลข */
    const lbl = R2.labels[k] || k;
    const g = R2.got[lbl];
    if (!g) { miss.push(lbl + ' ไม่มีแถบตัวเลข'); return; }
    if (g.ready !== R2.want[k].ready) miss.push(lbl + ' seats ready ' + g.ready + ' ควรเป็น ' + R2.want[k].ready);
    if (g.all   !== R2.want[k].all)   miss.push(lbl + ' seats total ' + g.all + ' ควรเป็น ' + R2.want[k].all);
  });
  if (miss.length) fail('ตัวเลขที่นั่งไม่ตรงกับที่คำนวณเอง · ' + miss.join(' · '));
  else ok('Seats ready/total ตรงกับที่คำนวณเองทุกท่า ณ ' + R2.from);
}

/* ══ 3 · ย้ายท่าต้องเป็น "ร่าง" · ข้อมูลจริงห้ามขยับ ══════════════════════
   หน้านี้คือกระดานวางแผน · ลากเล่นดูภาพรวมต้องไม่ไปโผล่ที่ใบงานเรือ
   หน้า Boat Status หรือหน้าจัดเรือ จนกว่าคนจะกดบันทึกเอง */
const R3 = await page.evaluate(() => {
  fdSetScope('month'); _fdWinIx = 0;
  _fdPlan = { pier: [], drop: [], trip: {} }; fdPlanSave(); flRenderDeployment();
  const W = fdWindows();
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b = fleet.find(x => getBoatCurrentPier(x, W[0].from) !== 'shop');
  if (!b) return { skip: 'ไม่มีเรือที่ย้ายได้' };
  const was = getBoatCurrentPier(b, W[0].from);
  const to  = ['tublamu', 'panwa', 'ranong'].find(p => p !== was);
  /* ถ่ายรูปข้อมูลจริงไว้ก่อน · ทั้งใบย้ายท่าของลำนี้ และตารางเดินเรือของวันนั้น */
  const snapA = JSON.stringify(b.assignments || []);
  const snapT = JSON.stringify((TRIPS || {})[W[0].from] || {});
  _fdSel = b.id;
  fdMove(to);
  const w = document.getElementById('fl-deploy-wrap');
  let col = '';
  [].slice.call(w.querySelectorAll('.fd-col')).forEach(c => {
    if ([].slice.call(c.querySelectorAll('.fd-boat .bn')).some(x => x.textContent.trim() === b.name))
      col = ((c.querySelector('.nm') || {}).textContent || '').replace(/\d+\s*ลำ$/, '').trim();
  });
  return {
    name: b.name, was, to, w0: W[0],
    planN: fdPlanN(),
    board: fdPierOf(b, W[0].from),
    real:  getBoatCurrentPier(b, W[0].from),
    asnSame:  JSON.stringify(b.assignments || []) === snapA,
    tripSame: JSON.stringify((TRIPS || {})[W[0].from] || {}) === snapT,
    col, want: (typeof PIER_LABELS !== 'undefined' ? PIER_LABELS[to] : to),
    bar: !!w.querySelector('.fd-planbar.on')
  };
});
if (R3.skip) console.log('  ! ' + R3.skip + ' · ข้ามข้อ 3');
else if (R3.planN !== 1)   fail('ย้ายแล้วร่างมี ' + R3.planN + ' รายการ · ต้องเป็น 1');
else if (!R3.asnSame)      fail('ย้ายแล้วใบย้ายท่าจริงของ ' + R3.name + ' ถูกแก้ · ร่างต้องไม่แตะข้อมูลจริง');
else if (!R3.tripSame)     fail('ย้ายแล้วตารางเดินเรือจริงถูกแก้ · ร่างต้องไม่แตะข้อมูลจริง');
else if (R3.real !== R3.was)
  fail('getBoatCurrentPier (ตัวที่หน้าอื่นใช้) เปลี่ยนเป็น ' + R3.real + ' แล้ว · ต้องยังเป็น ' + R3.was);
else if (R3.board !== R3.to) fail('กระดานยังไม่ขยับ · ยังเห็นเป็น ' + R3.board + ' · ควรเป็น ' + R3.to);
else if (R3.col !== R3.want) fail('การ์ดยังอยู่คอลัมน์ "' + R3.col + '" · ควรอยู่ "' + R3.want + '"');
else if (!R3.bar)            fail('ไม่มีแถบบอกว่ามีแผนร่างค้างอยู่');
else ok('ย้ายแล้วเป็นร่าง · ' + R3.name + ' บนกระดานอยู่ ' + R3.to
      + ' แต่ข้อมูลจริงยังเป็น ' + R3.was + ' · ใบย้ายท่าและตารางเดินเรือไม่ถูกแตะ');

/* ══ 3b · ร่างต้องครอบแค่ช่วงที่เลือก ════════════════════════════════════
   ถ้าร่างครอบทั้งฤดู แผนโยกสลับระหว่างฤดูจะทำไม่ได้เลย */
const R3b = await page.evaluate(() => {
  const W = fdWindows();
  if (W.length < 2) return { skip: 'ฤดูนี้มีช่วงเดียว' };
  const p = (_fdPlan.pier || [])[0];
  if (!p) return { skip: 'ไม่มีร่างให้ตรวจ' };
  const b = (BOATS || []).find(x => x.id === p.boatId);
  return { name: b.name, w0: W[0], w1: W[1], rec: { s: p.from, e: p.to },
           inWin: fdPierOf(b, W[0].to), next: fdPierOf(b, W[1].from),
           nextReal: getBoatCurrentPier(b, W[1].from), to: p.toPier };
});
if (R3b.skip) console.log('  ! ' + R3b.skip + ' · ข้ามข้อ 3b');
else if (R3b.rec.s !== R3b.w0.from || R3b.rec.e !== R3b.w0.to)
  fail('ร่างครอบ ' + R3b.rec.s + '→' + R3b.rec.e + ' · ควรครอบแค่ ' + R3b.w0.from + '→' + R3b.w0.to);
else if (R3b.inWin !== R3b.to)
  fail('ท้ายช่วงเรือหลุดไป ' + R3b.inWin + ' · ควรยังเป็น ' + R3b.to);
else if (R3b.next !== R3b.nextReal)
  fail('ช่วงถัดไปถูกร่างลากไปด้วย · กระดานเห็น ' + R3b.next + ' แต่ของจริงเป็น ' + R3b.nextReal);
else ok('ร่างครอบแค่ ' + R3b.w0.lb + ' (' + R3b.rec.s + '→' + R3b.rec.e + ') · ' + R3b.w1.lb + ' ไม่ขยับ');

/* ══ 3c · กดบันทึกแล้วจึงเขียนจริง และต้องไม่มีใบซ้อน ═════════════════════ */
const R3c = await page.evaluate(() => {
  const W = fdWindows();
  const p = (_fdPlan.pier || [])[0];
  if (!p) return { skip: 'ไม่มีร่างให้บันทึก' };
  const b = (BOATS || []).find(x => x.id === p.boatId);
  const n0 = (b.assignments || []).length;
  fdPlanApply();
  /* รอบสอง · วางทับใบที่เพิ่งเขียนไป เพื่อบังคับให้ตัวตัดใบทำงานจริง
     ถ้าไม่ทำขั้นนี้ จะมีแค่ใบเดียว แล้วข้อ "ไม่มีใบซ้อน" จะผ่านโดยไม่ได้วัดอะไร */
  fdSetScope('season');
  const was2 = fdPierOf(b, W[0].from);
  const to2  = ['tublamu', 'panwa', 'ranong'].find(q => q !== was2);
  _fdSel = b.id; fdMove(to2); fdPlanApply();
  fdSetScope('month'); _fdWinIx = 0;
  const A = (b.assignments || []).filter(a => a && a.status !== 'cancelled' && a.startDate && a.endDate);
  const mine = A.filter(a => a.src === 'fldeploy').pop() || {};
  const overlaps = [];
  for (let i = 0; i < A.length; i++)
    for (let j = i + 1; j < A.length; j++)
      if (A[i].startDate <= A[j].endDate && A[j].startDate <= A[i].endDate)
        overlaps.push(A[i].startDate + '→' + A[i].endDate + ' กับ ' + A[j].startDate + '→' + A[j].endDate);
  return { name: b.name, grew: (b.assignments || []).length - n0, planN: fdPlanN(),
           rec: { s: mine.startDate, e: mine.endDate, to: mine.toPier },
           real: getBoatCurrentPier(b, W[0].from), want: to2, n: A.length, overlaps };
});
if (R3c.skip) console.log('  ! ' + R3c.skip + ' · ข้ามข้อ 3c');
else if (R3c.planN !== 0)   fail('บันทึกแล้วร่างยังเหลือ ' + R3c.planN + ' รายการ');
else if (R3c.grew < 1)      fail('บันทึกแล้วใบย้ายท่าไม่เพิ่มเลย');
else if (R3c.real !== R3c.want)
  fail('บันทึกแล้ว getBoatCurrentPier ยังตอบ ' + R3c.real + ' · ควรเป็น ' + R3c.want);
else if (R3c.overlaps.length)
  fail('ใบย้ายท่าซ้อนกัน ' + R3c.overlaps.length + ' คู่ · ' + R3c.overlaps.slice(0, 2).join(' · ')
    + ' — ท่าของเรือจะขึ้นกับลำดับใน array');
else ok('กดบันทึกแล้วเขียนจริง · ' + R3c.name + ' ได้ใบ ' + R3c.rec.s + '→' + R3c.rec.e
      + ' และไม่มีใบซ้อนสักคู่ (' + R3c.n + ' ใบเรียงต่อกัน)');

/* ══ 3d · ลากวางได้ และเอาออกจากร่างได้ ══════════════════════════════════ */
const R3d = await page.evaluate(() => {
  flRenderDeployment();
  const w = document.getElementById('fl-deploy-wrap');
  const cards = [].slice.call(w.querySelectorAll('.fd-boat'));
  const cols  = [].slice.call(w.querySelectorAll('.fd-col[data-pier]'));
  const drag  = cards.filter(c => c.getAttribute('draggable') === 'true').length;
  const drop  = cols.filter(c => c.getAttribute('ondrop')).length;
  const W = fdWindows();
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b = fleet.find(x => fdPierOf(x, W[0].from) !== 'shop'
                         && !(_fdPlan.pier || []).some(p => p.boatId === x.id));
  if (!b) return { drag, drop, cards: cards.length, cols: cols.length, skip: 1 };
  const was = fdPierOf(b, W[0].from);
  const to  = ['tublamu', 'panwa', 'ranong'].find(p => p !== was);
  const col = cols.find(c => c.dataset.pier === to);
  const snapA = JSON.stringify(b.assignments || []);
  const n0 = fdPlanN();
  /* ลากจริง · เรียก fdDrop ด้วย event ปลอม เหมือนที่เบราว์เซอร์ส่งมา */
  fdDrop({ preventDefault(){}, dataTransfer:{ getData(){ return b.id; } } }, col);
  const afterDrop = fdPierOf(b, W[0].from);
  const nDrop = fdPlanN();
  const fresh = (_fdPlan.pier || []).filter(p => p.boatId === b.id).pop();
  let back = null, nBack = null;
  if (fresh) { fdPlanDel(fresh.id); back = fdPierOf(b, W[0].from); nBack = fdPlanN(); }
  return { drag, drop, cards: cards.length, cols: cols.length, name: b.name, was, to,
           afterDrop, back, added: nDrop - n0, removed: nDrop - nBack,
           asnSame: JSON.stringify(b.assignments || []) === snapA };
});
{
  const bad3d = [];
  if (R3d.drag !== R3d.cards) bad3d.push('การ์ดลากได้ ' + R3d.drag + ' จาก ' + R3d.cards + ' ใบ');
  if (R3d.drop !== R3d.cols)  bad3d.push('คอลัมน์รับของที่ลากมา ' + R3d.drop + ' จาก ' + R3d.cols);
  if (!R3d.skip) {
    if (R3d.added !== 1)          bad3d.push('ลากวางแล้วร่างเพิ่ม ' + R3d.added + ' รายการ · ต้องเป็น 1');
    if (R3d.afterDrop !== R3d.to) bad3d.push('ลากวางแล้วกระดานยังเห็น ' + R3d.afterDrop + ' · ควรเป็น ' + R3d.to);
    if (R3d.removed !== 1)        bad3d.push('กด ✕ แล้วร่างลดลง ' + R3d.removed + ' · ต้องเป็น 1');
    if (R3d.back !== R3d.was)     bad3d.push('เอาออกจากร่างแล้วยังเห็น ' + R3d.back + ' · ควรกลับไป ' + R3d.was);
    if (!R3d.asnSame)             bad3d.push('ลากวางไปแตะใบย้ายท่าจริงเข้าแล้ว');
  }
  if (bad3d.length) fail('ลากวาง/เอาออกจากร่าง · ' + bad3d.join(' · '));
  else ok('ลากวางได้ทุกใบ (' + R3d.cards + ' การ์ด / ' + R3d.cols + ' คอลัมน์) · ลาก ' + R3d.name
      + ' → ' + R3d.to + ' เป็นร่าง แล้วกด ✕ เอาออก กลับไป ' + R3d.was + ' · ข้อมูลจริงไม่ถูกแตะ');
}
/* ══ 4 · ปฏิทินต้องเคารพฤดูกาลของเส้นทาง ══════════════════════════════════ */
const R4 = await page.evaluate(() => {
  fdTab('month');
  const w = document.getElementById('fl-deploy-wrap');
  const pier = _fdPier, month = _fdMonth;
  const cells = [].slice.call(w.querySelectorAll('.fd-day:not(.pad)'));
  /* คาดหวัง · คำนวณจาก ROUTES + getDayStatus เอง ไม่เรียก fdOpenRoutes ของหน้า */
  const out = { pier, month, wrongClosed: [], wrongOpen: [], n: cells.length };
  cells.forEach((c, i) => {
    const day = month + '-' + String(i + 1).padStart(2, '0');
    const open = (ROUTES || []).filter(r => {
      if ((r.pier || '') !== pier) return false;
      const d = getDayStatus(r, day);
      return !d || d.type === 'open';
    }).length;
    const shown = c.classList.contains('closed');
    if (open > 0 && shown)  out.wrongClosed.push(day);
    if (open === 0 && !shown) out.wrongOpen.push(day);
  });
  return out;
});
if (R4.wrongClosed.length)
  fail('ปฏิทินขึ้น "ปิดฤดู" ทั้งที่มีโปรแกรมเปิดขาย ' + R4.wrongClosed.length + ' วัน · ' + R4.wrongClosed.slice(0, 4).join(' · '));
else if (R4.wrongOpen.length)
  fail('ปฏิทินเปิดให้จัดเรือทั้งที่ยังไม่เปิดฤดู ' + R4.wrongOpen.length + ' วัน · ' + R4.wrongOpen.slice(0, 4).join(' · '));
else ok('ปฏิทิน ' + R4.month + ' ท่า ' + R4.pier + ' · เปิด/ปิดฤดูตรงกับที่ตั้งไว้ในเส้นทางทั้ง ' + R4.n + ' วัน');

/* ══ 5 · ที่นั่งต่อวันต้องตรงกับที่คำนวณเองจาก TRIPS ══════════════════════ */
const R5 = await page.evaluate(() => {
  const w = document.getElementById('fl-deploy-wrap');
  const pier = _fdPier, month = _fdMonth;
  const cells = [].slice.call(w.querySelectorAll('.fd-day:not(.pad)'));
  const wrong = [];
  let checked = 0;
  cells.forEach((c, i) => {
    if (c.classList.contains('closed')) return;
    const day = month + '-' + String(i + 1).padStart(2, '0');
    const t = (TRIPS || {})[day] || {};
    let want = 0;
    Object.keys(t).forEach(id => {
      const r = (ROUTES || []).find(x => x.id === t[id].route);
      if (!r || (r.pier || '') !== pier) return;
      const b = (BOATS || []).find(x => x.id === id);
      if (!b || b.retired) return;
      if (((boatEffStatus(b, day) || {}).s) === 'available') want += (b.cap || 0);
    });
    const txt = ((c.querySelector('.dh i') || {}).textContent || '');
    const m = /·\s*(\d+)\s*ที่/.exec(txt);
    const got = m ? +m[1] : -1;
    checked++;
    if (got !== want) wrong.push(day + ' หน้าจอ ' + got + ' ควรเป็น ' + want);
  });
  return { wrong, checked };
});
if (!R5.checked) console.log('  ! เดือนนี้ไม่มีวันที่เปิดขายเลย · ข้ามข้อ 5');
else if (R5.wrong.length)
  fail('ที่นั่งต่อวันไม่ตรง ' + R5.wrong.length + ' วัน · ' + R5.wrong.slice(0, 3).join(' · '));
else ok('ที่นั่งต่อวันตรงกับที่คำนวณเองจาก TRIPS ทั้ง ' + R5.checked + ' วันที่เปิดขาย');

/* ══ 6 · ตารางเดินเรือก็เป็นร่าง · ตอนบันทึกต้องผ่านตัวเขียนของ Boat Operation ══
   ด่านที่ต้องยังอยู่คือ "วันที่ผ่านมาแล้วแก้ไม่ได้" · ถ้าหน้านี้เขียน TRIPS เอง
   ด่านนั้นจะหายเงียบ ๆ แล้ววันเก่าที่ออกรายงานไปแล้วจะถูกแก้ได้ */
const R6 = await page.evaluate(() => {
  const pier = _fdPier;
  const fleet = (BOATS || []).filter(b => b && !b.retired && fdPierOf(b, _fdFrom) === pier);
  if (!fleet.length) return { skip: 'ท่านี้ไม่มีเรือ' };
  const openOn = d => (ROUTES || []).filter(r => (r.pier || '') === pier &&
    (() => { const s = getDayStatus(r, d); return !s || s.type === 'open'; })());
  const days = [];
  for (let i = 1; i <= 31; i++) days.push(_fdMonth + '-' + String(i).padStart(2, '0'));
  const future = days.find(d => d > TODAY_STR && openOn(d).length && fleet.some(b => !((TRIPS || {})[d] || {})[b.id]));
  if (!future) return { skip: 'ไม่มีวันในอนาคตที่ว่างพอจะทดสอบ' };
  const r = openOn(future)[0];
  const b = fleet.find(x => !((TRIPS || {})[future] || {})[x.id]);

  /* 1 · ใส่เรือ = ร่าง · TRIPS จริงต้องยังไม่ขยับ */
  const snap = JSON.stringify((TRIPS || {})[future] || {});
  fdOpenDay(future);
  fdAssign(r.id, future, b.id);
  const draftOnly = JSON.stringify((TRIPS || {})[future] || {}) === snap;
  const onBoard = !!fdTripsOn(future)[b.id];

  /* 2 · ใส่ร่างของวันเก่าเข้าไปด้วย แล้วกดบันทึกทีเดียว */
  const back = [];
  for (let i = 1; i <= 90; i++) {
    const d = new Date(TODAY_STR); d.setDate(d.getDate() - i);
    back.push(d.toISOString().slice(0, 10));
  }
  const anyRoute = (ROUTES || []).find(x => (x.pier || '') === pier);
  const past = anyRoute ? back.find(d => !((TRIPS || {})[d] || {})[b.id]) : null;
  if (past) fdAssign(anyRoute.id, past, b.id);

  fdPlanApply();
  const added   = !!(((TRIPS || {})[future] || {})[b.id]);
  const route2  = added ? TRIPS[future][b.id].route === r.id : false;
  const guarded = past ? !(((TRIPS || {})[past] || {})[b.id]) : null;

  /* 3 · ถอดเรือออก = ร่างอีกรอบ แล้วบันทึก */
  fdUnassign(future, b.id);
  const stillThere = !!(((TRIPS || {})[future] || {})[b.id]);
  fdPlanApply();
  const removed = !(((TRIPS || {})[future] || {})[b.id]);

  return { future, past, boat: b.name, route: r.name,
           draftOnly, onBoard, added, route2, guarded, stillThere, removed };
});
if (R6.skip) console.log('  ! ' + R6.skip + ' · ข้ามข้อ 6');
else if (!R6.draftOnly) fail('ใส่เรือในปฏิทินแล้ว TRIPS จริงขยับทันที · ต้องเป็นร่างก่อน');
else if (!R6.onBoard)   fail('ใส่เรือแล้วกระดานไม่เห็นร่างนั้น · ' + R6.boat + ' ' + R6.future);
else if (!R6.added)     fail('กดบันทึกแล้ว TRIPS ไม่เปลี่ยน · ' + R6.boat + ' ' + R6.future);
else if (!R6.route2)    fail('บันทึกแล้วได้เส้นทางผิด · ' + R6.future);
else if (R6.stillThere !== true)
  fail('ถอดเรือแล้ว TRIPS จริงหายทันที · ต้องเป็นร่างก่อนเหมือนกัน');
else if (!R6.removed)   fail('บันทึกการถอดแล้วยังค้างอยู่ใน TRIPS · ' + R6.boat + ' ' + R6.future);
else if (R6.guarded === false)
  fail('บันทึกร่างของวันที่ผ่านมาแล้ว (' + R6.past + ') สำเร็จ · ด่านกันวันเก่าหายไป — แปลว่าไม่ได้เรียกผ่าน Boat Operation');
else ok('ตารางเดินเรือเป็นร่างจนกว่าจะบันทึก · ' + R6.boat + ' → ' + R6.route + ' ' + R6.future
      + ' · ถอดออกก็เป็นร่าง' + (R6.past ? (' · ด่านวันเก่ายังกัน ' + R6.past + ' ได้') : ''));
/* ══ 7 · คิวซ่อม · แถบต้องบอกความจริงเรื่องวันเสร็จ ═══════════════════════ */
const R7 = await page.evaluate(() => {
  fdTab('fix');
  const w = document.getElementById('fl-deploy-wrap');
  const from = _fdFrom;
  const open = (FL_MAINT || []).filter(m => m && m.status !== 'done' && m.status !== 'cancelled');
  const wantNoEnd = open.filter(m => !m.endDate).length;
  const wantLate  = open.filter(m => m.endDate && m.endDate > from).length;
  return {
    rows: w.querySelectorAll('.fd-rw .rr').length,
    open: open.length, wantNoEnd, wantLate,
    gotOpen: w.querySelectorAll('.fd-rw .jb.open').length,
    gotLate: w.querySelectorAll('.fd-rw .jb.late').length,
    gotDated: w.querySelectorAll('.fd-rw .jb.dated').length,
    foot: (w.querySelector('.fd-rw .rwf') || {}).textContent || ''
  };
});
{
  /* แถบแสดงลำละไม่เกิน 3 งาน · จึงเทียบแบบ "ต้องไม่เกินของจริง และต้องไม่เป็นศูนย์ถ้าของจริงมี" */
  const bad7 = [];
  if (R7.wantNoEnd && !R7.gotOpen) bad7.push('มีงานไม่มีวันเสร็จ ' + R7.wantNoEnd + ' งาน แต่ไม่มีแถบลายทางสักอัน');
  if (R7.gotOpen > R7.wantNoEnd)   bad7.push('แถบลายทาง ' + R7.gotOpen + ' อัน มากกว่างานที่ไม่มีวันเสร็จจริง ' + R7.wantNoEnd);
  if (R7.wantLate && !R7.gotLate)  bad7.push('มีงานที่เสร็จหลังวันเปิดฤดู ' + R7.wantLate + ' งาน แต่ไม่ขึ้นสีเตือน');
  if (!/\d+\s*งานไม่มีวันเสร็จ/.test(R7.foot)) bad7.push('ท้ายตารางไม่ได้สรุปจำนวนงานที่ไม่มีวันเสร็จ');
  if (bad7.length) fail('คิวซ่อม · ' + bad7.join(' · '));
  else ok('คิวซ่อม ' + R7.rows + ' ลำ · งานค้าง ' + R7.open + ' งาน · ไม่มีวันเสร็จ ' + R7.wantNoEnd
        + ' (แถบลายทาง ' + R7.gotOpen + ') · เลยวันเปิดฤดู ' + R7.wantLate + ' (แถบเตือน ' + R7.gotLate + ')');
}

/* ══ 8 · ต้องอยู่ในทะเบียนสิทธิ์ ══════════════════════════════════════════
   laAllowed() ปล่อยผ่านเมนูที่ไม่รู้จัก · ลืมใส่ = หน้านี้เปิดให้ทุกคนเงียบ ๆ */
const R8 = await page.evaluate(async () => {
  /* ชุดทดสอบไม่มี /api/me ชั้น sync จึงถอยก่อนจะประกาศ laAllowed
     จึงตรวจที่ทะเบียนสิทธิ์โดยตรง · สองที่ ขาดที่ไหนก็เปิดให้ทุกคนเงียบ ๆ */
  let txt = '';
  try { txt = await (await fetch('js/01-auth-sync.js')).text(); } catch (e) { return { err: String(e) }; }
  return {
    err: '',
    inArea: /'fl-deployment'\s*:\s*'fleet'/.test(txt),
    inNav:  /\{\s*v\s*:\s*'fl-deployment'[^}]*a\s*:\s*'fleet'\s*\}/.test(txt),
    live:   (typeof laAllowed === 'function')
  };
});
if (R8.err) fail('อ่านทะเบียนสิทธิ์ไม่ได้ · ' + R8.err);
else if (!R8.inArea) fail('fl-deployment ไม่อยู่ใน LA_VIEW_AREA · หน้านี้จะไม่ถูกจัดเข้าพื้นที่ fleet');
else if (!R8.inNav)  fail('fl-deployment ไม่อยู่ใน LA_NAV · laAllowed() ปล่อยผ่านเมนูที่ไม่รู้จัก = เปิดให้ทุกคน');
else ok('อยู่ในทะเบียนสิทธิ์ครบทั้งสองที่ (LA_VIEW_AREA + LA_NAV) · พื้นที่ fleet');

/* ══ 9 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
if (errors.length) fail('มี error ' + errors.length + ' ครั้ง · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
