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

/* ══ 1b · เรือบริษัทกับเรือเช่าต้องแยกกันออก ════════════════
   ลำบริษัทคือกำลังที่ต้องวางคนและรับภาระซ่อมเอง · ลำเช่าคือกำลังเสริมที่เพิ่ม-ถอนได้
   นับรวมกันแล้ววางแผนกำลังคนผิดทันที */
const R1b = await page.evaluate(() => {
  const w = document.getElementById('fl-deploy-wrap');
  const n = () => [].slice.call(w.querySelectorAll('.fd-boat')).length;
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const wantChr = fleet.filter(b => b.ownership === 'charter').length;
  const wantOwn = fleet.length - wantChr;
  fdSetOwn('all');     const all = n();
  fdSetOwn('own');     const own = n(), ownTags = w.querySelectorAll('.fd-own-tag').length;
  fdSetOwn('charter'); const chr = n(), chrTags = w.querySelectorAll('.fd-own-tag').length;
  fdSetOwn('all');
  return { all, own, chr, wantOwn, wantChr, ownTags, chrTags,
           split: w.querySelectorAll('.fd-split').length };
});
if (!R1b.wantChr) console.log('  ! ชุดนี้ไม่มีเรือเช่า · ข้ามข้อ 1b');
else if (R1b.own !== R1b.wantOwn || R1b.chr !== R1b.wantChr)
  fail('ตัวกรองเจ้าของนับผิด · บริษัท ' + R1b.own + '/' + R1b.wantOwn
    + ' · เช่า ' + R1b.chr + '/' + R1b.wantChr);
else if (R1b.own + R1b.chr !== R1b.all)
  fail('บริษัท ' + R1b.own + ' + เช่า ' + R1b.chr + ' ≠ ทั้งหมด ' + R1b.all + ' · มีลำที่นับซ้ำหรือหายไป');
else if (R1b.ownTags !== 0)
  fail('กรองเรือบริษัทแต่ยังมีป้าย "เช่า" โผล่ ' + R1b.ownTags + ' ใบ');
else if (R1b.chrTags !== R1b.chr)
  fail('กรองเรือเช่า ' + R1b.chr + ' ลำ แต่มีป้ายแค่ ' + R1b.chrTags + ' ใบ');
else ok('แยกเรือบริษัท ' + R1b.wantOwn + ' ลำ / เรือเช่า ' + R1b.wantChr
      + ' ลำ ได้ถูก · ป้าย "เช่า" ขึ้นเฉพาะลำเช่า · หัวคอลัมน์แยกตัวเลข ' + R1b.split + ' ท่า');

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

/* ══ 3e · ช่วงกำหนดเอง ═════════════════════════════
   เดือน/สัปดาห์ไม่พอ · เรือเช่ามา 10 วัน หรือโยกเรือกลางสัปดาห์ ก็ต้องกำหนดเองได้ */
const R3e = await page.evaluate(() => {
  const S = fdSeason();
  const from = fdAddDays(S.from, 20), to = fdAddDays(S.from, 29);
  fdSetScope('custom');
  fdSetCustom('from', from);
  fdSetCustom('to', to);
  const win = fdWin();
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b = fleet.find(x => fdPierOf(x, from) !== 'shop'
                         && !(_fdPlan.pier || []).some(p => p.boatId === x.id));
  if (!b) return { skip: 'ไม่มีเรือที่ย้ายได้', win, from, to };
  const was = fdPierOf(b, from);
  const dest = ['tublamu', 'panwa', 'ranong'].find(p => p !== was);
  _fdSel = b.id; fdMove(dest);
  const rec = (_fdPlan.pier || []).filter(p => p.boatId === b.id).pop() || {};
  const out = { win, from, to, name: b.name, was, dest, rec: { s: rec.from, e: rec.to },
    inside:  fdPierOf(b, to),
    before:  fdPierOf(b, fdAddDays(from, -1)),
    after:   fdPierOf(b, fdAddDays(to, 1)) };
  if (rec.id) fdPlanDel(rec.id);
  fdSetScope('month'); _fdWinIx = 0;
  return out;
});
if (R3e.skip) console.log('  ! ' + R3e.skip + ' · ข้ามข้อ 3e');
else if (R3e.win.from !== R3e.from || R3e.win.to !== R3e.to)
  fail('ตั้งช่วงเอง ' + R3e.from + '→' + R3e.to + ' แต่หน้าใช้ ' + R3e.win.from + '→' + R3e.win.to);
else if (R3e.rec.s !== R3e.from || R3e.rec.e !== R3e.to)
  fail('ร่างครอบ ' + R3e.rec.s + '→' + R3e.rec.e + ' · ควรครอบวันที่ตั้งเอง ' + R3e.from + '→' + R3e.to);
else if (R3e.inside !== R3e.dest)
  fail('วันสุดท้ายของช่วงเรือหลุดไป ' + R3e.inside + ' · ควรเป็น ' + R3e.dest);
else if (R3e.before === R3e.dest || R3e.after === R3e.dest)
  fail('ร่างรั่วออกนอกช่วง · ก่อนหน้า=' + R3e.before + ' หลัง=' + R3e.after);
else ok('ช่วงกำหนดเอง ' + R3e.from + '→' + R3e.to + ' (10 วัน) · '
      + R3e.name + ' อยู่ ' + R3e.dest + ' เฉพาะในช่วง · ก่อนหน้าหลังไม่ขยับ');

/* ══ 3c · หน้านี้ต้องไม่มีทางเขียนกลับระบบเลย ═════════════════════════════
   ข้อนี้คือสัญญาหลักของหน้า · ลากอะไรก็ได้ กดอะไรก็ได้
   BOATS กับ TRIPS ต้องเหมือนเดิมทุกตัวอักษร */
const R3c = await page.evaluate(() => {
  const snapB = JSON.stringify(BOATS);
  const snapT = JSON.stringify(TRIPS);
  const W = fdWindows();
  const fleet = (BOATS || []).filter(b => b && !b.retired);
  const b = fleet.find(x => fdPierOf(x, W[0].from) !== 'shop');
  /* กวนให้ครบทุกทาง · ย้ายท่า · ตั้งช่วงเช่า · เพิ่มเรือ · จัดเส้นทางในปฏิทิน */
  if (b) {
    const to = ['tublamu', 'panwa', 'ranong'].find(p => p !== fdPierOf(b, W[0].from));
    _fdSel = b.id; fdMove(to);
    fdSetScope('season'); _fdSel = b.id; fdMove(to === 'ranong' ? 'panwa' : 'ranong');
    fdSetScope('month'); _fdWinIx = 0;
    fdAvailOn(b.id); fdSetAvail(b.id, 'to', W[0].to);
  }
  _fdAddPier = 'tublamu'; flRenderDeployment();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('fd-nb-name', 'ทดสอบไม่เขียนกลับ'); set('fd-nb-cap', '40');
  fdAddSave('tublamu');
  /* ปฏิทิน · ใส่และถอดเรือ */
  fdTab('month');
  const d = _fdMonth + '-20';
  const r = (ROUTES || []).find(x => (x.pier || '') === _fdPier);
  if (r && b) { fdOpenDay(d); fdAssign(r.id, d, b.id); fdUnassign(d, b.id); }
  fdTab('pier');
  return {
    boatsSame: JSON.stringify(BOATS) === snapB,
    tripsSame: JSON.stringify(TRIPS) === snapT,
    noApply:   (typeof fdPlanApply === 'undefined'),
    noTrim:    (typeof fdTrim === 'undefined'),
    planN: fdPlanN(),
    btns: [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-planbar button'))
            .map(x => x.textContent.trim())
  };
});
if (!R3c.boatsSame) fail('ทำอะไรบนกระดานแล้ว BOATS จริงเปลี่ยน · หน้านี้ต้องไม่เขียนกลับระบบ');
else if (!R3c.tripsSame) fail('ทำอะไรบนกระดานแล้ว TRIPS จริงเปลี่ยน · หน้านี้ต้องไม่เขียนกลับระบบ');
else if (!R3c.noApply)  fail('ยังมีฟังก์ชัน fdPlanApply อยู่ · ทางเขียนกลับต้องถูกถอดออก');
else if (!R3c.noTrim)   fail('ยังมีฟังก์ชัน fdTrim อยู่ · ตัวนี้มีไว้แก้ใบจริงเท่านั้น');
else if (!R3c.planN)    fail('กวนไปตั้งหลายอย่างแต่ร่างว่าง · กระดานไม่ได้จำอะไรเลย');
else if (R3c.btns.some(t => /บันทึก|save/i.test(t)))
  fail('ยังมีปุ่มบันทึกอยู่บนแถบแผน · ' + R3c.btns.join(' / '));
else ok('กวนครบทุกทาง (ย้ายท่า · ตั้งช่วงเช่า · เพิ่มเรือ · จัดเส้นทาง) รวม ' + R3c.planN
      + ' รายการ · BOATS/TRIPS จริงไม่ขยับสักตัวอักษร · ไม่มีปุ่มบันทึกและไม่มีทางเขียนกลับ');

/* ══ 3f · เรือเช่าที่เช่ามาแค่บางวัน ══════════════════════════════════════
   สองทาง · ตั้งช่วงเช่าให้ลำที่มีในทะเบียน และเพิ่มลำใหม่ที่ยังไม่มี
   นอกช่วงต้องหายจากกระดาน ไม่งั้นจะนับที่นั่งเกินจริงทั้งฤดู */
const R3f = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [] }; fdPlanSave();
  fdSetScope('month'); _fdWinIx = 0; flRenderDeployment();
  const W = fdWindows();
  const f = fdAddDays(W[0].from, 3), t = fdAddDays(W[0].from, 7);
  const names = d => fdBoatsAt('tublamu', d).map(x => x.name);
  const seats = d => fdBoatsAt('tublamu', d).filter(x => fdCanRun(x, d))
                      .reduce((s, x) => s + (x.cap || 0), 0);
  const seat0 = seats(f);

  /* 1 · เพิ่มลำใหม่ที่ยังไม่มีในทะเบียน */
  _fdAddPier = 'tublamu'; flRenderDeployment();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('fd-nb-name', 'เรือเช่าทดสอบ'); set('fd-nb-cap', '48'); set('fd-nb-crew', '4');
  set('fd-nb-from', f); set('fd-nb-to', t);
  fdAddSave('tublamu');
  const nb = (_fdPlan.boats || [])[0] || {};
  const inReg = (BOATS || []).some(x => x && x.id === nb.id);

  /* 2 · ตั้งช่วงเช่าให้เรือเช่าที่มีในทะเบียนอยู่แล้ว */
  const chr = (BOATS || []).find(x => x && !x.retired && x.ownership === 'charter');
  let chrIn = null, chrOut = null;
  if (chr) {
    fdAvailOn(chr.id); fdSetAvail(chr.id, 'from', f); fdSetAvail(chr.id, 'to', t);
    const p = fdPierOf(chr, f);
    chrIn  = fdBoatsAt(p, f).some(x => x.id === chr.id);
    chrOut = fdBoatsAt(p, fdAddDays(t, 1)).some(x => x.id === chr.id);
  }
  return {
    f, t, nb: nb.name, inReg,
    inWin:  names(f).indexOf('เรือเช่าทดสอบ') >= 0,
    before: names(fdAddDays(f, -1)).indexOf('เรือเช่าทดสอบ') >= 0,
    after:  names(fdAddDays(t, 1)).indexOf('เรือเช่าทดสอบ') >= 0,
    seatIn: seats(f) - seat0, seatOut: seats(fdAddDays(t, 1)) - seats(fdAddDays(t, 1)),
    seatsAfter: seats(fdAddDays(t, 1)), seat0,
    chr: chr && chr.name, chrIn, chrOut
  };
});
{
  const bad3f = [];
  if (!R3f.inWin)  bad3f.push('เรือที่เพิ่มเองไม่โผล่ในช่วงเช่า');
  if (R3f.before || R3f.after) bad3f.push('เรือที่เพิ่มเองโผล่นอกช่วงเช่าด้วย');
  if (R3f.inReg)   bad3f.push('เรือที่เพิ่มเองหลุดเข้าไปอยู่ในทะเบียน BOATS จริง');
  if (R3f.seatIn !== 48) bad3f.push('ที่นั่งในช่วงเพิ่มขึ้น ' + R3f.seatIn + ' · ควรเป็น 48');
  if (R3f.seatsAfter !== R3f.seat0) bad3f.push('นอกช่วงที่นั่งไม่กลับเท่าเดิม');
  if (R3f.chr) {
    if (!R3f.chrIn)  bad3f.push(R3f.chr + ' หายจากกระดานทั้งที่อยู่ในช่วงเช่า');
    if (R3f.chrOut)  bad3f.push(R3f.chr + ' ยังโผล่นอกช่วงเช่า');
  }
  if (bad3f.length) fail('เรือเช่าบางวัน · ' + bad3f.join(' · '));
  else ok('เรือเช่าบางวันจัดการได้สองทาง · เพิ่ม "' + R3f.nb + '" 48 ที่ เช่า ' + R3f.f + '→' + R3f.t
      + ' (โผล่เฉพาะในช่วง ไม่เข้าทะเบียนจริง) · ตั้งช่วงเช่าให้ ' + R3f.chr + ' แล้วนอกช่วงหายจากกระดาน');
}
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
/* ══ 3g · เรือในอู่ต้องโยกมาวางบนกระดานได้ ═════════════
   กระดานนี้คือการสมมติ "ถ้าซ่อมเสร็จทัน ลำนี้จะไปอยู่ท่าไหน"
   กันไม่ให้ย้าย = วางแผนไม่ได้ · แต่ป้ายซ่อมต้องคาอยู่ และต้องขึ้นรายการที่ต้องไปเร่ง */
const R3g = await page.evaluate(() => {
  _fdPlan = { pier: [], drop: [], trip: {}, avail: {}, boats: [] }; fdPlanSave();
  fdSetScope('month'); _fdWinIx = 0; fdSetOwn('all'); flRenderDeployment();
  const W = fdWindows();
  const inShop = fdBoatsAt('shop', W[0].from);
  if (!inShop.length) return { skip: 'ชุดนี้ไม่มีเรืออยู่อู่' };
  const b = inShop[0];
  _fdSel = b.id; fdMove('tublamu');
  const w = document.getElementById('fl-deploy-wrap');
  let col = '';
  [].slice.call(w.querySelectorAll('.fd-col')).forEach(c => {
    if ([].slice.call(c.querySelectorAll('.fd-boat .bn')).some(x => x.textContent.trim() === b.name))
      col = (c.dataset.pier || '');
  });
  const card = [].slice.call(w.querySelectorAll('.fd-boat'))
    .find(c => ((c.querySelector('.bn') || {}).textContent || '').trim() === b.name);
  const chase = [].slice.call(w.querySelectorAll('.fd-chase .ci'))
    .find(x => x.textContent.indexOf(b.name) >= 0);
  return {
    name: b.name, col, pier: fdPierOf(b, W[0].from),
    realPier: getBoatCurrentPier(b, W[0].from),
    keepsFlag: !!(card && card.querySelector('.fd-flag.bad')),
    inChase: !!chase,
    chaseMoved: !!(chase && chase.classList.contains('moved')),
    chaseN: w.querySelectorAll('.fd-chase .ci').length
  };
});
if (R3g.skip) console.log('  ! ' + R3g.skip + ' · ข้ามข้อ 3g');
else if (R3g.pier !== 'tublamu' || R3g.col !== 'tublamu')
  fail('โยกเรือออกจากอู่ไม่ได้ · ' + R3g.name + ' ยังอยู่ ' + R3g.pier + ' คอลัมน์ ' + R3g.col);
else if (R3g.realPier === 'tublamu') fail('โยกแล้วข้อมูลจริงขยับด้วย · ต้องเป็นร่างเท่านั้น');
else if (!R3g.keepsFlag) fail('โยกออกจากอู่แล้วป้ายงานซ่อมหาย · ต้องติดอยู่เพื่อให้รู้ว่าต้องเร่ง');
else if (!R3g.inChase) fail(R3g.name + ' ไม่ขึ้นในรายการเรือที่ต้องเร่งซ่อม');
else if (!R3g.chaseMoved) fail(R3g.name + ' ขึ้นในรายการแต่ไม่ติดป้ายว่าย้ายมาในแผน');
else ok('โยก ' + R3g.name + ' ออกจากอู่มา Tub Lamu ได้ · ป้ายซ่อมยังติด · '
      + 'ขึ้นรายการต้องเร่งซ่อม (' + R3g.chaseN + ' ลำ) พร้อมป้าย ย้ายมาในแผน');

/* ══ 3h · ที่พักเรือ ══════════════════════════════
   กระดานเปล่าไว้พักเรือที่ยังไม่ตัดสิน · เรือที่พักไว้ต้องไม่ถูกนับเป็นที่นั่งของท่าไหน */
const R3h = await page.evaluate(() => {
  const W = fdWindows(), d = W[0].from;
  const seatsAt = p => fdBoatsAt(p, d).filter(x => fdCanRun(x, d)).reduce((s, x) => s + (x.cap || 0), 0);
  const pick = FD_PIERS.map(p => ({ p, list: fdBoatsAt(p, d).filter(x => fdCanRun(x, d)) }))
                       .find(x => x.list.length);
  if (!pick) return { skip: 'ไม่มีเรือพร้อมใช้ให้ย้าย' };
  const b = pick.list[0], before = seatsAt(pick.p);
  const w = document.getElementById('fl-deploy-wrap');
  const tray = !!w.querySelector('.fd-hold[data-pier="hold"]');
  _fdSel = b.id; fdMove('hold');
  const after = seatsAt(pick.p);
  const inTray = [].slice.call(document.querySelectorAll('#fl-deploy-wrap .fd-hold .hc'))
    .some(x => x.textContent.indexOf(b.name) >= 0);
  const anyPier = FD_PIERS.some(p => fdBoatsAt(p, d).some(x => x.id === b.id));
  return { tray, name: b.name, pier: pick.p, cap: b.cap || 0, before, after, inTray, anyPier,
           dropZone: !!w.querySelector('.fd-hold[ondrop]') };
});
if (R3h.skip) console.log('  ! ' + R3h.skip + ' · ข้ามข้อ 3h');
else if (!R3h.tray)     fail('ไม่มีที่พักเรือบนกระดาน');
else if (!R3h.dropZone) fail('ที่พักเรือรับของที่ลากมาไม่ได้');
else if (!R3h.inTray)   fail(R3h.name + ' ไม่ไปโผล่ที่ที่พักเรือ');
else if (R3h.anyPier)   fail(R3h.name + ' พักอยู่แต่ยังนับอยู่ในท่าด้วย');
else if (R3h.before - R3h.after !== R3h.cap)
  fail('พักเรือแล้วที่นั่งของ ' + R3h.pier + ' ลด ' + (R3h.before - R3h.after) + ' · ควรลด ' + R3h.cap);
else ok('ที่พักเรือใช้งานได้ · พัก ' + R3h.name + ' จาก ' + R3h.pier
      + ' → ที่นั่งท่านั้นลด ' + R3h.cap + ' และไม่ไปนับที่ท่าอื่น');

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
   หน้านี้ไม่เขียน TRIPS เลย · ทุกอย่างเป็นร่างบนกระดานนี้เท่านั้น */
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

  /* 3 · ถอดออกจากร่าง · ต้องหายจากกระดาน แต่ TRIPS จริงต้องเหมือนเดิมทั้งขาหน้าหลัง */
  fdUnassign(future, b.id);
  const offBoard = !fdTripsOn(future)[b.id];
  const tripSame = JSON.stringify((TRIPS || {})[future] || {}) === snap;
  return { future, boat: b.name, route: r.name, draftOnly, onBoard, offBoard, tripSame };
});
if (R6.skip) console.log('  ! ' + R6.skip + ' · ข้ามข้อ 6');
else if (!R6.draftOnly) fail('ใส่เรือในปฏิทินแล้ว TRIPS จริงขยับทันที · ต้องเป็นร่างก่อน');
else if (!R6.onBoard)   fail('ใส่เรือแล้วกระดานไม่เห็นร่างนั้น · ' + R6.boat + ' ' + R6.future);
else if (!R6.offBoard)  fail('ถอดเรือแล้วกระดานยังเห็นอยู่ · ' + R6.boat + ' ' + R6.future);
else if (!R6.tripSame)  fail('ใส่/ถอดเรือในปฏิทินไปแตะ TRIPS จริงเข้าแล้ว');
else ok('ตารางเดินเรือในปฏิทินเป็นร่างล้วน · ' + R6.boat + ' → ' + R6.route + ' ' + R6.future
      + ' · ใส่ก็ร่าง ถอดก็ร่าง · TRIPS จริงไม่ขยับ');
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
