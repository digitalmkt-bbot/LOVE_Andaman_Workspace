// §chEdit · แก้ไขรายละเอียดเรือเช่าได้ · และคลิกเรือแล้วรายการต้องไม่เด้งกลับขึ้นบน
//
// ที่มา (2026-09-30) · ผู้ใช้แจ้งสองเรื่องพร้อมกันจากหน้า Boat Status
//   "เพิ่มให้สามารถแก้ไขรายละเอียดเรือเช่า ได้หน่อย"
//   "และดูเรื่องการเด้ง พอกดแล้วเด้งบน"
//
// เรื่องแรก · กล่องเรือเช่ามีแต่ปุ่มเพิ่ม ไม่มีทางแก้
//   ของจริงที่เจอมาแล้ว · LKC777 ใส่ประเภทเป็น Catamaran ไว้ แล้วเลือกลงใบจองไม่ได้
//   ทางออกตอนนั้นคือไปเพิ่มประเภท Catamaran เข้าระบบ ทั้งที่ควรแก้ที่ตัวเรือ
//   ปุ่ม ✎ ข้างชื่อในแผงขวาก็กดแล้วเงียบ · startEditName สั่ง element ของแผงเก่า (#bdp)
//   ที่ renderBoats ซ่อนแล้วย้ายไปท้าย body · input ที่สั่งให้โผล่ จึงโผล่ในที่ที่ไม่มีใครเห็น
//
// เรื่องที่สอง · วัดได้ตรง ๆ · เลื่อนรายการลงไป 601px แล้วคลิกแถวล่างสุด
//   แถวนั้นตกจาก y=1077 ไป y=1676 คือหลุดออกนอกจอ ทั้งที่เพิ่งกดมันไปหมาด ๆ
//   selectBoat เรียก renderBoats ซึ่งเขียนทับ innerHTML ทั้ง #bs-pink-wrap
//   แผงรายการจึงเป็น element ใหม่ scrollTop = 0 เสมอ · เรือเช่าโดนหนักสุดเพราะอยู่ท้ายรายการ
//
// ⚠ เทสสร้างเรือเช่าของตัวเองผ่าน BOATS แล้วเก็บกวาดทิ้ง
//    ไม่พึ่งว่าชุดข้อมูลจะมีเรือเช่าที่มีหลายช่วงหรือมีที่ตั้งตั้งเอง
//
// เทสนี้กันสิบห้าอย่าง
//   1  แถวเรือเช่ามีปุ่มแก้ไข · แถวเรือบริษัทไม่มี (ของเรือบริษัทอยู่ที่แผงขวา)
//   2  กดปุ่มแก้บนแถว ต้องไม่เปลี่ยนเรือที่เลือกอยู่
//   3  กล่องเปิดมาพร้อมค่าเดิมครบ · ชื่อ ประเภท ที่นั่ง ท่า
//   4  เรือเช่า · บล็อกช่วงวันเช่าขึ้นพร้อมค่าของช่วงที่ถูกหยิบมา
//   5  หยิบช่วงถูกใบ · ช่วงที่คลุมวันนี้มาก่อน ถ้าไม่มีเอาช่วงถัดไปที่ใกล้ที่สุด
//   6  บอกให้ชัดว่ากำลังแก้ช่วงไหน และลำนี้มีกี่ช่วง
//   7  บันทึกแล้วประเภทกับที่นั่งเปลี่ยนจริง (ตรงกับเคส LKC777)
//   8  ช่วงวันเปลี่ยนเฉพาะใบที่แก้ · ใบอื่นไม่ขยับ
//   9  ที่ตั้งที่คนตั้งเองไว้ ไม่ถูกเขียนทับตอนเปลี่ยนท่า
//   10 ช่วงที่ซ้อนกับใบอื่นต้องเตือนพร้อมบอกว่าชนใบไหน · กดยกเลิกแล้วไม่บันทึกอะไรเลย
//   11 เรือบริษัท · ปุ่ม ✎ ในแผงขวาเปิดกล่องได้จริง และไม่มีบล็อกช่วงเช่า
//   12 เรือบริษัท · บันทึกแล้วชื่อกับที่นั่งเปลี่ยน · log สถานะไม่ถูกแตะ
//   13 ปุ่มเพิ่มเรือเช่ายังทำงานเหมือนเดิม · ไม่ได้พังไปกับโหมดแก้ไข
//   14 คลิกเรือแล้วรายการไม่เด้ง · แถวที่กดอยู่ที่เดิมบนจอ (อาการที่ผู้ใช้แจ้ง)
//   15 ไม่มี error บนหน้า

import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
const dialogs = [];
let dialogAnswer = 'dismiss';
page.on('dialog', d => { dialogs.push(d.message()); (dialogAnswer === 'accept' ? d.accept() : d.dismiss()); });
await goView(page, 'fl-boatstatus', 900);

/* ══ 0 · สร้างเรือเช่าของเทสเอง ═══════════════════════════════════════ */
const R0 = await page.evaluate(() => {
  for (const f of ['openBoatEdit','saveCharterBoat','openCharterModal','chPickPeriod','renderBoats','getBoat'])
    if (typeof window[f] !== 'function') return { err: 'ยังไม่มีฟังก์ชัน ' + f };
  const d = n => { const x = new Date(TODAY_STR + 'T00:00:00'); x.setDate(x.getDate() + n);
                   return x.toISOString().slice(0, 10); };
  /* A · ช่วงหนึ่งคลุมวันนี้ (มีที่ตั้งตั้งเองไว้) และอีกช่วงอยู่ข้างหน้า
     ⚠ เรียงให้ช่วงข้างหน้าอยู่ "ก่อน" ในลิสต์ โดยตั้งใจ
     ถ้าเรียงตามเวลา การหยิบ "ช่วงที่คลุมวันนี้" กับการหยิบ "ใบแรกในลิสต์"
     จะให้คำตอบเดียวกัน · เทสข้อ 5 ก็จะผ่านทั้งที่โค้ดหยิบมั่ว */
  const A = { id:'b-tce-a', name:'T-CE A', type:'Catamaran', pier:'panwa', cap:34, ownership:'charter',
    log:[{ id:'sl-tce-a2', s:'available', from:d(20), to:d(40), loc:'Visit Panwa', note:'รอบสอง' },
         { id:'sl-tce-a1', s:'available', from:d(-3), to:d(3), loc:'อู่พังงา · ซ่อมเสร็จจอดไว้', note:'รอบแรก' }] };
  /* B · วันนี้ไม่อยู่ในช่วงไหนเลย · มีทั้งช่วงที่ผ่านมาแล้วและช่วงข้างหน้า
     ต้องมีทั้งสองข้าง ไม่งั้น "ช่วงถัดไปที่ใกล้ที่สุด" กับ "ช่วงล่าสุดที่ผ่านมาแล้ว"
     จะได้ใบเดียวกัน และเทสข้อ 5 ก็วัดอะไรไม่ได้ · ช่วงเก่าวางไว้ก่อนในลิสต์ด้วย
     และต้องมีช่วงข้างหน้า "สองช่วง" · ไม่งั้น "ช่วงถัดไปที่ใกล้ที่สุด"
     กับ "ช่วงที่จบทีหลังสุด" ก็ยังได้ใบเดียวกันอยู่ดี */
  const B = { id:'b-tce-b', name:'T-CE B', type:'Speedboat', pier:'tublamu', cap:20, ownership:'charter',
    log:[{ id:'sl-tce-b0', s:'available', from:d(-40), to:d(-30), loc:'Tub Lamu Pier', note:'รอบที่แล้ว' },
         { id:'sl-tce-b2', s:'available', from:d(25), to:d(30), loc:'Tub Lamu Pier', note:'รอบไกล' },
         { id:'sl-tce-b1', s:'available', from:d(10), to:d(15), loc:'Tub Lamu Pier', note:'' }] };
  BOATS.push(A, B);
  boatPier = 'all'; boatSt = 'all'; boatLocType = 'all';
  selBoatId = null; renderBoats();
  const co = BOATS.filter(b => b.ownership !== 'charter' && !b.retired)[0];
  return { today: TODAY_STR, a: { ...A, log: undefined }, aFrom: d(-3), aTo: d(3), a2From: d(20), a2To: d(40),
           bFrom: d(10), bTo: d(15), coId: co && co.id, coName: co && co.name, coCap: co && co.cap,
           nBoats: BOATS.length };
});
if (R0.err) { fail(R0.err); console.log('\n✗ 1 ข้อไม่ผ่าน'); await close(); process.exit(1); }
ok('สร้างเรือเช่าของเทสเอง · A มี 2 ช่วง (ช่วงแรกคลุมวันนี้ · ที่ตั้งตั้งเองไว้) · B มีแต่ช่วงข้างหน้า');

/* ══ 1 · 2 · ปุ่มแก้ไขบนแถว ══════════════════════════════════════════ */
{
  const R = await page.evaluate(coId => {
    const q = id => document.querySelector('[data-bid="' + id + '"]');
    const pen = id => { const r = q(id); return r ? r.querySelector('button[onclick*="openBoatEdit"]') : null; };
    const out = { aPen: !!pen('b-tce-a'), bPen: !!pen('b-tce-b'), coPen: !!pen(coId), rowFound: !!q('b-tce-a') };
    selBoatId = coId; renderBoats();
    out.selBefore = selBoatId;
    const p = pen('b-tce-a'); if (p) p.click();
    out.selAfter = selBoatId;
    out.modalOpen = getComputedStyle(document.getElementById('charter-modal')).display !== 'none';
    return out;
  }, R0.coId);
  if (!R.rowFound) fail('ไม่เจอแถวเรือเช่าที่เทสสร้าง · ตัวกรองอาจซ่อนไว้');
  else if (!R.aPen || !R.bPen) fail('แถวเรือเช่าไม่มีปุ่มแก้ไข · ผู้ใช้ยังแก้ไม่ได้เหมือนเดิม');
  else if (R.coPen) fail('แถวเรือบริษัทก็มีปุ่มแก้ไขด้วย · ตั้งใจให้แก้ที่แผงขวาทางเดียว จะได้ไม่มีสองที่');
  else ok('แถวเรือเช่ามีปุ่มแก้ไขครบทั้งสองลำ · แถวเรือบริษัทไม่มี');

  if (!R.modalOpen) fail('กดปุ่มแก้บนแถวแล้วกล่องไม่เปิด');
  else if (R.selAfter !== R.selBefore)
    fail('กดปุ่มแก้บนแถวแล้วเรือที่เลือกอยู่เปลี่ยนไปด้วย · ' + R.selBefore + ' → ' + R.selAfter
         + ' (แผงขวาจะกระโดดไปลำอื่นระหว่างที่กำลังแก้)');
  else ok('กดปุ่มแก้บนแถวแล้วกล่องเปิด · เรือที่เลือกอยู่ไม่เปลี่ยน');
}

/* ══ 3 · 4 · 5 · 6 · ค่าที่กล่องเปิดมา ═══════════════════════════════ */
{
  const R = await page.evaluate(() => {
    openBoatEdit('b-tce-a');
    const v = id => document.getElementById(id).value;
    const A = { title: document.getElementById('ch-title').textContent,
      name: v('ch-name'), type: v('ch-type'), cap: v('ch-cap'), pier: v('ch-pier'),
      from: v('ch-from'), to: v('ch-to'), note: v('ch-note'),
      period: getComputedStyle(document.getElementById('ch-period')).display !== 'none',
      hint: document.getElementById('ch-hint').textContent,
      hintShown: getComputedStyle(document.getElementById('ch-hint')).display !== 'none' };
    closeModal('charter-modal');
    openBoatEdit('b-tce-b');
    const B = { from: v('ch-from'), to: v('ch-to'), hint: document.getElementById('ch-hint').textContent };
    closeModal('charter-modal');
    return { A, B };
  });
  if (R.A.name !== 'T-CE A' || R.A.type !== 'Catamaran' || R.A.cap !== '34' || R.A.pier !== 'panwa')
    fail('กล่องไม่ได้โหลดค่าเดิมมาครบ · ได้ ' + JSON.stringify({ n: R.A.name, t: R.A.type, c: R.A.cap, p: R.A.pier })
         + ' · คนแก้จะเผลอบันทึกทับด้วยค่าตั้งต้น');
  else ok('กล่องโหลดค่าเดิมครบ · ' + R.A.name + ' · ' + R.A.type + ' · ' + R.A.cap + ' ที่นั่ง · ท่า ' + R.A.pier);

  if (!R.A.period) fail('เรือเช่าแต่บล็อกช่วงวันเช่าไม่ขึ้น');
  else if (R.A.from !== R0.aFrom || R.A.to !== R0.aTo || R.A.note !== 'รอบแรก')
    fail('บล็อกช่วงวันเช่าขึ้นแต่ค่าไม่ตรง · ควรได้ ' + R0.aFrom + ' → ' + R0.aTo
         + ' (รอบแรก) แต่ได้ ' + R.A.from + ' → ' + R.A.to + ' (' + R.A.note + ')');
  else ok('บล็อกช่วงวันเช่าขึ้นพร้อมค่าของช่วงที่คลุมวันนี้ · ' + R.A.from + ' → ' + R.A.to);

  if (R.B.from !== R0.bFrom || R.B.to !== R0.bTo)
    fail('วันนี้ไม่อยู่ในช่วงไหนเลย ควรหยิบช่วงถัดไปที่ใกล้ที่สุด (' + R0.bFrom + ') แต่ได้ ' + R.B.from);
  else ok('วันนี้ไม่อยู่ในช่วงไหน · หยิบช่วงถัดไปที่ใกล้ที่สุดมาให้แก้ · ' + R.B.from + ' → ' + R.B.to);

  const sayWhich = /คลุมวันนี้/.test(R.A.hint), sayN = /2 ช่วง/.test(R.A.hint);
  const sayNext = /ช่วงถัดไป/.test(R.B.hint);
  if (!R.A.hintShown) fail('ไม่มีคำอธิบายว่ากำลังแก้ช่วงไหน · ลำที่มีหลายช่วงจะแก้ผิดใบโดยไม่รู้ตัว');
  else if (!sayWhich || !sayN || !sayNext)
    fail('คำอธิบายไม่ครบ · ' + (sayWhich ? '' : 'ไม่บอกว่าแก้ช่วงที่คลุมวันนี้ ')
         + (sayN ? '' : 'ไม่บอกว่ามีกี่ช่วง ') + (sayNext ? '' : 'ไม่บอกตอนหยิบช่วงถัดไป'));
  else ok('บอกชัดว่ากำลังแก้ช่วงไหนและลำนี้มีกี่ช่วง');
}

/* ══ 7 · 8 · 9 · บันทึกแล้วเปลี่ยนจริง ═══════════════════════════════ */
{
  const R = await page.evaluate(() => {
    openBoatEdit('b-tce-a');
    document.getElementById('ch-type').value = 'Speedboat';     // เคส LKC777
    document.getElementById('ch-cap').value = '40';
    document.getElementById('ch-pier').value = 'tublamu';       // เปลี่ยนท่า
    document.getElementById('ch-note').value = 'แก้แล้ว';
    saveCharterBoat();
    const b = getBoat('b-tce-a');
    const e1 = (b.log || []).find(x => x.id === 'sl-tce-a1');
    const e2 = (b.log || []).find(x => x.id === 'sl-tce-a2');
    return { type: b.type, cap: b.cap, pier: b.pier, name: b.name,
             e1: e1 && { from: e1.from, to: e1.to, note: e1.note, loc: e1.loc },
             e2: e2 && { from: e2.from, to: e2.to, note: e2.note, loc: e2.loc },
             nLog: (b.log || []).length,
             closed: getComputedStyle(document.getElementById('charter-modal')).display === 'none' };
  });
  if (R.type !== 'Speedboat' || R.cap !== 40 || R.pier !== 'tublamu')
    fail('บันทึกแล้วข้อมูลเรือไม่เปลี่ยน · ได้ ' + R.type + ' · ' + R.cap + ' ที่นั่ง · ท่า ' + R.pier
         + ' (เคส LKC777 คือประเภทผิดแล้วเลือกลงใบจองไม่ได้ · ถ้าแก้ไม่ได้ก็เท่าเดิม)');
  else if (!R.closed) fail('บันทึกแล้วกล่องไม่ปิด');
  else ok('บันทึกแล้วประเภท ที่นั่ง และท่าเปลี่ยนจริง · Catamaran → Speedboat · 34 → 40 ที่นั่ง');

  if (!R.e1 || !R.e2) fail('ช่วงเช่าหายไปหลังบันทึก · เหลือ ' + R.nLog + ' ช่วง');
  else if (R.e1.note !== 'แก้แล้ว')
    fail('หมายเหตุของช่วงที่แก้ไม่เปลี่ยน · ได้ "' + R.e1.note + '"');
  else if (R.e2.note !== 'รอบสอง' || R.e2.from !== R0.a2From || R.e2.to !== R0.a2To)
    fail('แก้ช่วงหนึ่งแล้วไปโดนอีกช่วงด้วย · ช่วงสองกลายเป็น ' + R.e2.from + ' → ' + R.e2.to
         + ' (' + R.e2.note + ')');
  else ok('แก้เฉพาะช่วงที่เลือก · ช่วงอื่นไม่ขยับ · ยังมี ' + R.nLog + ' ช่วงครบ');

  if (R.e1 && R.e1.loc !== 'อู่พังงา · ซ่อมเสร็จจอดไว้')
    fail('ที่ตั้งที่คนตั้งเองไว้ถูกเขียนทับตอนเปลี่ยนท่า · กลายเป็น "' + R.e1.loc + '"');
  else if (R.e2 && R.e2.loc !== 'Visit Panwa')
    fail('ที่ตั้งของช่วงที่ไม่ได้แก้ ถูกแตะด้วย · กลายเป็น "' + R.e2.loc + '"');
  else ok('ที่ตั้งที่คนตั้งเองไว้ไม่ถูกเขียนทับตอนเปลี่ยนท่า');
}

/* ══ 10 · ช่วงซ้อนกัน ════════════════════════════════════════════════ */
{
  dialogs.length = 0; dialogAnswer = 'dismiss';
  const R = await page.evaluate(a2 => {
    openBoatEdit('b-tce-a');
    const before = JSON.stringify(getBoat('b-tce-a').log);
    document.getElementById('ch-from').value = a2.from;      // ทับช่วงที่สองเป๊ะ ๆ
    document.getElementById('ch-to').value = a2.to;
    saveCharterBoat();
    const unchanged = JSON.stringify(getBoat('b-tce-a').log) === before;
    const open = getComputedStyle(document.getElementById('charter-modal')).display !== 'none';
    closeModal('charter-modal');
    return { unchanged, open };
  }, { from: R0.a2From, to: R0.a2To });
  const warned = dialogs.some(m => /overlap/i.test(m));
  const named  = dialogs.some(m => m.includes(R0.a2From));
  if (!warned) fail('ตั้งช่วงทับช่วงอื่นของลำเดียวกันได้เงียบ ๆ · ตัวอ่านสถานะเอาใบแรกที่เจอ ใบที่ซ้อนจะหายไปเฉย ๆ');
  else if (!named) fail('เตือนแล้วแต่ไม่บอกว่าไปชนใบไหน · คนอ่านไม่รู้จะไปแก้ที่ไหน · ' + dialogs[0]);
  else if (!R.unchanged) fail('กดยกเลิกที่กล่องเตือนแล้วแต่ยังบันทึกไปแล้ว');
  else if (!R.open) fail('กดยกเลิกที่กล่องเตือนแล้วกล่องแก้ไขปิดไปด้วย · ที่กรอกไว้หายหมด');
  else ok('ช่วงที่ซ้อนกันเตือนพร้อมบอกว่าชนใบไหน · กดยกเลิกแล้วไม่บันทึกอะไร และกล่องยังเปิดอยู่');
}

/* ══ 11 · 12 · เรือบริษัท ════════════════════════════════════════════ */
{
  const R = await page.evaluate(coId => {
    selectBoat(coId);
    const pen = document.querySelector('#bs-detail-mount button[onclick*="openBoatEdit"]');
    const out = { pen: !!pen };
    if (!pen) return out;
    const b = getBoat(coId);
    const logBefore = JSON.stringify(b.log || []);
    pen.click();
    out.title = document.getElementById('ch-title').textContent;
    out.period = getComputedStyle(document.getElementById('ch-period')).display !== 'none';
    out.name = document.getElementById('ch-name').value;
    document.getElementById('ch-name').value = 'T-CE renamed';
    document.getElementById('ch-cap').value = '77';
    saveCharterBoat();
    const b2 = getBoat(coId);
    out.after = { name: b2.name, cap: b2.cap, own: b2.ownership || '',
                  logSame: JSON.stringify(b2.log || []) === logBefore };
    return out;
  }, R0.coId);
  if (!R.pen) fail('แผงขวาไม่มีปุ่มแก้ไข · ปุ่ม ✎ ของเดิมสั่งแผงที่ถูกซ่อน กดแล้วไม่มีอะไรเกิดขึ้น');
  else if (R.period) fail('เรือบริษัทแต่ขึ้นบล็อกช่วงวันเช่าด้วย · เรือบริษัทไม่ได้เช่ามา');
  else if (R.name !== R0.coName) fail('กล่องไม่ได้โหลดชื่อเรือบริษัทมา · ได้ "' + R.name + '"');
  else ok('ปุ่ม ✎ ในแผงขวาเปิดกล่องได้จริง · "' + R.title + '" · ไม่มีบล็อกช่วงเช่า');

  if (R.after && (R.after.name !== 'T-CE renamed' || R.after.cap !== 77))
    fail('บันทึกเรือบริษัทแล้วไม่เปลี่ยน · ได้ "' + R.after.name + '" · ' + R.after.cap + ' ที่นั่ง');
  else if (R.after && R.after.own === 'charter')
    fail('แก้เรือบริษัทแล้วกลายเป็นเรือเช่า · หลุดออกจาก Company Asset ทั้งลำ');
  else if (R.after && !R.after.logSame)
    fail('แก้ข้อมูลเรือบริษัทแล้วไปแตะ log สถานะด้วย');
  else ok('เรือบริษัท · ชื่อกับที่นั่งเปลี่ยนจริง · ไม่กลายเป็นเรือเช่า · log สถานะไม่ถูกแตะ');
  await page.evaluate(([id, n, c]) => { const b = getBoat(id); b.name = n; b.cap = c; }, [R0.coId, R0.coName, R0.coCap]);
}

/* ══ 13 · ปุ่มเพิ่มยังทำงาน ══════════════════════════════════════════ */
{
  const R = await page.evaluate(() => {
    /* เปิดกล่องแก้แล้วกดปิดทิ้งโดยไม่บันทึก แล้วค่อยไปกดเพิ่ม
       เป็นลำดับที่คนทำจริง และเป็นทางที่โหมดแก้จะค้างไปทับลำเดิมได้ */
    openBoatEdit('b-tce-a');
    closeModal('charter-modal');
    const aBefore = JSON.stringify(getBoat('b-tce-a'));
    openCharterModal();
    const out = { title: document.getElementById('ch-title').textContent,
                  name: document.getElementById('ch-name').value,
                  period: getComputedStyle(document.getElementById('ch-period')).display !== 'none' };
    document.getElementById('ch-name').value = 'T-CE new';
    document.getElementById('ch-cap').value = '12';
    document.getElementById('ch-type').value = 'Big Boat';
    const n = BOATS.length;
    saveCharterBoat();
    const made = BOATS.find(b => b.name === 'T-CE new');
    out.added = BOATS.length === n + 1;
    out.aUntouched = JSON.stringify(getBoat('b-tce-a')) === aBefore;
    out.made = made && { own: made.ownership, type: made.type, cap: made.cap, nLog: (made.log || []).length,
                         from: (made.log || [])[0] && made.log[0].from };
    return out;
  });
  if (R.name !== '') fail('กดเพิ่มหลังจากเคยกดแก้ · ฟอร์มยังค้างค่าของลำเดิมไว้ · "' + R.name + '"');
  else if (R.title !== 'เพิ่มเรือเช่า') fail('กดเพิ่มแล้วหัวกล่องยังเป็น "' + R.title + '"');
  else if (!R.added || !R.made)
    fail('เปิดกล่องแก้ทิ้งไว้แล้วไปกดเพิ่ม · ไม่ได้เรือใหม่'
         + (R.aUntouched ? '' : ' · ไปทับลำที่เพิ่งเปิดแก้ค้างไว้แทน'));
  else if (!R.aUntouched) fail('กดเพิ่มแล้วลำที่เคยเปิดแก้ค้างไว้ถูกแก้ตามไปด้วย');
  else if (R.made.own !== 'charter' || R.made.type !== 'Big Boat' || R.made.cap !== 12 || R.made.nLog !== 1)
    fail('เรือเช่าที่เพิ่งเพิ่มข้อมูลไม่ตรง · ' + JSON.stringify(R.made));
  else ok('ปุ่มเพิ่มเรือเช่ายังทำงานเหมือนเดิม · ฟอร์มถูกล้าง · ได้เรือใหม่พร้อมช่วงแรก');
}

/* ══ 14 · ไม่เด้ง ════════════════════════════════════════════════════ */
{
  const R = await page.evaluate(() => {
    const panel = document.getElementById('bs-list-panel');
    if (!panel) return { err: 'ไม่เจอแผงรายการ · id หาย' };
    panel.scrollTop = panel.scrollHeight;
    const rows = [...panel.querySelectorAll('[data-bid]')];
    const last = rows[rows.length - 1];
    if (!last) return { err: 'ไม่มีแถวเรือในรายการ' };
    const bid = last.dataset.bid;
    const before = { top: panel.scrollTop, y: Math.round(last.getBoundingClientRect().top) };
    last.click();
    const p2 = document.getElementById('bs-list-panel');
    const r2 = p2 && p2.querySelector('[data-bid="' + bid + '"]');
    return { before, fresh: p2 !== panel, sel: selBoatId === bid,
             after: { top: p2 ? p2.scrollTop : null, y: r2 ? Math.round(r2.getBoundingClientRect().top) : null } };
  });
  if (R.err) fail('ข้อ 14 · ' + R.err);
  else if (!(R.before.top > 40)) fail('เตรียมเคสไม่สำเร็จ · รายการสั้นเกินกว่าจะเลื่อนได้ เทสข้อนี้จึงวัดของว่าง');
  else if (!R.sel) fail('คลิกแถวแล้วไม่ได้เลือกเรือลำนั้น');
  else if (R.after.y === null) fail('คลิกแล้วแถวนั้นหายไปจากรายการ');
  else if (Math.abs(R.after.y - R.before.y) > 8)
    fail('คลิกเรือแล้วรายการเด้ง · แถวที่กดย้ายจาก y=' + R.before.y + ' ไป y=' + R.after.y
         + ' (เลื่อนไว้ ' + R.before.top + ' กลายเป็น ' + R.after.top + ')');
  else ok('คลิกเรือแล้วรายการไม่เด้ง · เลื่อนไว้ ' + R.before.top + 'px แถวที่กดอยู่ที่ y=' + R.after.y + ' เท่าเดิม');
}

/* ══ 15 ══════════════════════════════════════════════════════════════ */
await page.evaluate(() => {
  BOATS = BOATS.filter(b => !/^b-tce-/.test(b.id || '') && !/^T-CE /.test(b.name || ''));
  selBoatId = null; renderBoats(); save('config');
});
if (errors.length) fail('มี error บนหน้า · ' + errors.slice(0, 3).join(' | '));
else ok('ไม่มี error บนหน้า');

await close();
console.log(bad ? '\n✗ ' + bad + ' ข้อไม่ผ่าน' : '\n✓ ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
