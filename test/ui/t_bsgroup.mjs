// §bsCellTo + §chByPier · คลิกช่องวันแล้ววันจบตามมาเอง · และเรือเช่าแยกย่อยตามท่า
//
// ที่มา (2026-09-30) · ผู้ใช้แจ้งจากหน้า Boat Status
//   "ขอแก้ วัน วันที่สิ้นสุด * ให้เป็นวันที่เรากดเริ่มได้ไหม เวลา User ใช้จะใช้ง่าย"
//   "และแถบเรือที่เป็นเรือเช่า แยกย่อยท่าเรือให้ด้วยได้ไหม"
//
// เรื่องแรก · bsCellClick เรียก openAddStatusModal (ซึ่งตั้งทั้งวันเริ่มและวันจบเป็น "วันนี้")
//   แล้วเขียนทับ "แค่ช่องวันเริ่ม" ด้วยวันที่กด · วันจบค้างเป็นวันนี้
//   คลิกวันข้างหน้าทีไร ฟอร์มจึงเปิดมาแบบวันจบอยู่ก่อนวันเริ่ม กดบันทึกไม่ผ่าน
//   ของจริงจากภาพที่ผู้ใช้ส่งมา · คลิก 14 พ.ย. ได้ฟอร์ม 14/11/2026 → 30/09/2026
//   ตัวจัดให้อัตโนมัติเป็น onchange ซึ่งไม่ทำงานตอนโค้ดตั้งค่าเอง
//
// เรื่องที่สอง · เรือเช่ากองรวมกันเป็นก้อนเดียว · ตอนนี้มี 7 ลำกระจายหลายท่า
//   คนหน้าท่าจะรู้ว่าท่าตัวเองมีเรือเช่าลำไหน ต้องไล่อ่านทีละแถว
//   ใช้ตัวตัดสินท่าตัวเดียวกับเรือบริษัท (getBoatCurrentPier) คำตอบจะได้ไม่ขัดกันเอง
//
// ⚠ เทสสร้างเรือเช่าของตัวเองแล้วเก็บกวาดทิ้ง · ชุดข้อมูลจริงไม่มีลำที่ท่าเพี้ยน
//    และไม่มีลำที่ถูกย้ายท่าชั่วคราว ซึ่งเป็นสองเคสที่ต้องวัด
//
// เทสนี้กันสิบสามอย่าง
//   1  คลิกช่องวันในปฏิทิน · วันจบตามวันที่กด (อาการที่ผู้ใช้แจ้ง)
//   2  คลิกแล้วกดบันทึกผ่านเลย ไม่ติดกติกา "วันจบต้องไม่น้อยกว่าวันเริ่ม"
//   3  ปุ่มเพิ่ม Status ตรง ๆ ยังตั้งเป็นวันนี้ทั้งสองช่องเหมือนเดิม
//   4  เปิดแก้ Status เดิม · วันจบยังเป็นของเดิม ไม่ถูกทับด้วยวันเริ่ม
//   5  เรือเช่าแยกเป็นกลุ่มตามท่า · มีหัวข้อย่อยของท่าที่มีเรือ
//   6  จำนวนบนหัวข้อย่อยตรงกับจำนวนแถวที่อยู่ใต้หัวข้อนั้นจริง
//   7  เรือแต่ละลำอยู่ใต้หัวข้อท่าของตัวเอง
//   8  ท่าที่ไม่มีเรือเช่า ไม่ขึ้นหัวข้อว่าง
//   9  ลำที่ท่าไม่ตรงกับกลุ่มไหนเลย ต้องไม่หาย · ไปอยู่ใต้ "ยังไม่ระบุท่า"
//   10 ใช้ตัวตัดสินท่าตัวเดียวกับเรือบริษัท · ลำที่ถูกย้ายท่าชั่วคราวไปโผล่ที่ท่าใหม่
//   11 กรองท่าแล้ว หัวข้อย่อยเหลือเฉพาะท่านั้น
//   12 กรองจนไม่เหลือเรือเช่าเลย ยังขึ้น "ไม่ตรงกับ filter" ไม่ใช่หายทั้งก้อน
//   13 ไม่มี error บนหน้า

import { open, goView } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1800, height: 1200 });
const dialogs = [];
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
await goView(page, 'fl-boatstatus', 900);

/* ══ 0 · เรือเช่าของเทสเอง ครบทุกเคสที่ต้องวัด ═══════════════════════ */
const R0 = await page.evaluate(() => {
  for (const f of ['bsCellClick','openAddStatusModal','editStatus','saveStatus','renderBoats','getBoatCurrentPier'])
    if (typeof window[f] !== 'function') return { err: 'ยังไม่มีฟังก์ชัน ' + f };
  const d = n => { const x = new Date(TODAY_STR + 'T00:00:00'); x.setDate(x.getDate() + n);
                   return x.toISOString().slice(0, 10); };
  const mk = (id, name, pier, extra) => Object.assign({ id, name, type:'Speedboat', pier, cap:30,
    ownership:'charter',
    log:[{ id:'sl-' + id, s:'available', from:d(-2), to:d(60), loc:'', note:'' }] }, extra || {});
  const A = mk('b-tbg-a', 'T-BG tublamu', 'tublamu');
  const B = mk('b-tbg-b', 'T-BG panwa',   'panwa');
  // ท่าที่ไม่ตรงกับกลุ่มไหนเลย · ต้องไม่หายไปจากรายการ
  const C = mk('b-tbg-c', 'T-BG กระบี่',  'krabi');
  // บ้านอยู่ท่าทับละมุ แต่ถูกย้ายไปพังงาชั่วคราว · ต้องโผล่ใต้ Visit Panwa
  const D = mk('b-tbg-d', 'T-BG moved',   'tublamu',
    { assignments:[{ id:'as-tbg', type:'temp', fromPier:'tublamu', toPier:'panwa',
                     startDate:d(-5), endDate:d(20), status:'active' }] });
  BOATS.push(A, B, C, D);
  boatPier = 'all'; boatSt = 'all'; boatLocType = 'all';
  selBoatId = null; renderBoats();
  return { today: TODAY_STR, click: d(45), farTo: d(60),
           pier: { a:getBoatCurrentPier(A), b:getBoatCurrentPier(B), c:getBoatCurrentPier(C), d:getBoatCurrentPier(D) } };
});
if (R0.err) { fail(R0.err); console.log('\n✗ 1 ข้อไม่ผ่าน'); await close(); process.exit(1); }
if (R0.pier.d !== 'panwa')
  fail('เตรียมเคสไม่สำเร็จ · ลำที่ย้ายท่าชั่วคราวควรนับเป็น panwa แต่ได้ ' + R0.pier.d + ' · ข้อ 10 จะวัดของว่าง');
else if (R0.pier.c === R0.pier.a)
  fail('เตรียมเคสไม่สำเร็จ · ลำที่ท่าเพี้ยนถูกถอยไปเป็นท่าเดียวกับลำปกติ · ข้อ 9 จะวัดของว่าง');
else ok('สร้างเรือเช่าของเทสเอง 4 ลำ · ทับละมุ · พังงา · ท่าที่ไม่รู้จัก (' + R0.pier.c + ') · และลำที่ย้ายท่าชั่วคราวไปพังงา');

/* ══ 1 · 2 · 3 · 4 · วันที่ในกล่อง Status ════════════════════════════ */
{
  const R = await page.evaluate(click => {
    const out = {};
    selectBoat('b-tbg-a');
    // 1 · คลิกช่องวันในปฏิทิน
    bsCellClick(click, null);
    out.cell = { from: document.getElementById('fm-st-from').value,
                 to:   document.getElementById('fm-st-to').value };
    // 2 · บันทึกต่อได้เลย · เติมที่ตั้งให้ครบตามที่ฟอร์มบังคับ
    document.getElementById('fm-st-province').value = 'Phuket';
    if (typeof updateLocTypeOptions === 'function') updateLocTypeOptions();
    const lt = document.getElementById('fm-st-loctype');
    if (lt && lt.options.length > 1) lt.selectedIndex = 1;
    /* ไม่วัดจำนวนใบ · การบันทึกทับกลางช่วงยาวจะหั่นใบเดิมออกเป็นสองท่อนด้วย
       ที่ต้องวัดคือ "มีใบใหม่ที่ครอบวันที่กด และครอบแค่วันนั้น" */
    const idsBefore = new Set((getBoat('b-tbg-a').log || []).map(e => e.id));
    saveStatus();
    const added = (getBoat('b-tbg-a').log || []).filter(e => !idsBefore.has(e.id));
    out.saved = added.length > 0;
    out.addedAll = added.map(e => e.from + '→' + e.to);
    const fresh = added.find(e => e.from === click);
    out.savedEntry = fresh && { from: fresh.from, to: fresh.to };
    closeModal('status-modal');
    // 3 · ปุ่มเพิ่มตรง ๆ
    openAddStatusModal();
    out.plain = { from: document.getElementById('fm-st-from').value,
                  to:   document.getElementById('fm-st-to').value };
    closeModal('status-modal');
    // 4 · เปิดแก้ใบเดิมที่ช่วงยาว
    const long = (getBoat('b-tbg-a').log || []).find(e => e.id === 'sl-b-tbg-a');
    editStatus('b-tbg-a', long.id);
    out.edit = { from: document.getElementById('fm-st-from').value,
                 to:   document.getElementById('fm-st-to').value,
                 want: { from: long.from, to: long.to } };
    closeModal('status-modal');
    return out;
  }, R0.click);

  if (R.cell.from !== R0.click)
    fail('คลิกช่องวันแล้ววันเริ่มไม่ตรงกับวันที่กด · กด ' + R0.click + ' ได้ ' + R.cell.from);
  else if (R.cell.to !== R0.click)
    fail('คลิกช่องวันแล้ววันจบไม่ตามมา · ได้ ' + R.cell.from + ' → ' + R.cell.to
         + ' (วันจบอยู่ก่อนวันเริ่ม · ตรงกับภาพที่ผู้ใช้ส่งมา)');
  else ok('คลิกช่องวันในปฏิทิน · ได้ ' + R.cell.from + ' → ' + R.cell.to + ' · วันจบตามวันที่กด');

  if (!R.saved) fail('คลิกแล้วกดบันทึกไม่ผ่าน · ' + (dialogs[0] || 'ไม่รู้สาเหตุ'));
  else if (!R.savedEntry || R.savedEntry.to !== R0.click)
    fail('บันทึกผ่านแต่ใบใหม่ไม่ได้ครอบวันที่กดแค่วันเดียว · ใบที่เพิ่มมา ' + JSON.stringify(R.addedAll));
  else ok('คลิกแล้วกดบันทึกผ่านเลย · ไม่ต้องไปแก้วันจบก่อน');

  if (R.plain.from !== R0.today || R.plain.to !== R0.today)
    fail('ปุ่มเพิ่ม Status ตรง ๆ เปลี่ยนพฤติกรรมไป · ควรเป็นวันนี้ทั้งคู่ แต่ได้ '
         + R.plain.from + ' → ' + R.plain.to);
  else ok('ปุ่มเพิ่ม Status ตรง ๆ ยังตั้งเป็นวันนี้ทั้งสองช่องเหมือนเดิม');

  if (R.edit.from !== R.edit.want.from || R.edit.to !== R.edit.want.to)
    fail('เปิดแก้ใบเดิมแล้วช่วงวันเพี้ยน · ควรได้ ' + R.edit.want.from + ' → ' + R.edit.want.to
         + ' แต่ได้ ' + R.edit.from + ' → ' + R.edit.to + ' (ของยาวหลายเดือนจะถูกหั่นเหลือวันเดียว)');
  else ok('เปิดแก้ใบเดิม · ช่วงวันยังเป็นของเดิม ' + R.edit.from + ' → ' + R.edit.to);
}

/* ══ 5 · 6 · 7 · 8 · 9 · 10 · การแยกกลุ่มตามท่า ═════════════════════ */
const readGroups = () => page.evaluate(() => {
  const panel = document.getElementById('bs-list-panel');
  if (!panel) return { err: 'ไม่เจอแผงรายการ' };
  const hd = panel.querySelector('[data-chhd]');
  if (!hd) return { err: 'ไม่เจอหัวข้อเรือเช่า' };
  const groups = []; let cur = null, empty = '';
  for (let n = hd.nextElementSibling; n; n = n.nextElementSibling) {
    const p = n.getAttribute('data-chpier');
    if (p !== null) {
      cur = { pier: p, label: n.querySelector('span') ? n.querySelector('span').textContent : '',
              count: parseInt((n.textContent.match(/(\d+)\s*$/) || [])[1], 10), boats: [] };
      groups.push(cur);
    } else if (n.dataset && n.dataset.bid) {
      if (cur) cur.boats.push(n.dataset.bid);
    } else if (/ไม่ตรงกับ filter/.test(n.textContent)) empty = n.textContent.trim();
  }
  return { groups, empty };
});
{
  const R = await readGroups();
  if (R.err) fail('ข้อ 5 · ' + R.err);
  else {
    const byPier = {}; R.groups.forEach(g => { byPier[g.pier] = g; });
    const mine = { 'b-tbg-a':'tublamu', 'b-tbg-b':'panwa', 'b-tbg-c':'other', 'b-tbg-d':'panwa' };

    if (R.groups.length < 2) fail('เรือเช่ายังไม่ได้แยกกลุ่มตามท่า · เจอหัวข้อย่อย ' + R.groups.length + ' อัน');
    else ok('เรือเช่าแยกเป็น ' + R.groups.length + ' กลุ่ม · ' + R.groups.map(g => g.label + ' ' + g.count).join(' · '));

    const miscount = R.groups.filter(g => g.count !== g.boats.length);
    if (miscount.length)
      fail('จำนวนบนหัวข้อย่อยไม่ตรงกับแถวจริง · ' + miscount.map(g => g.label + ' บอก ' + g.count + ' แต่มี ' + g.boats.length).join(' · '));
    else ok('จำนวนบนหัวข้อย่อยตรงกับแถวใต้หัวข้อนั้นทุกกลุ่ม');

    const wrong = Object.keys(mine).filter(id => !(byPier[mine[id]] && byPier[mine[id]].boats.indexOf(id) >= 0));
    const missing = Object.keys(mine).filter(id => !R.groups.some(g => g.boats.indexOf(id) >= 0));
    if (missing.length) fail('เรือเช่าหายไปจากรายการหลังแยกกลุ่ม · ' + missing.join(', '));
    else if (wrong.length) fail('เรืออยู่ผิดกลุ่ม · ' + wrong.map(id => id + ' ควรอยู่ ' + mine[id]).join(' · '));
    else ok('เรือทุกลำอยู่ใต้หัวข้อท่าของตัวเอง · ครบทั้ง ' + Object.keys(mine).length + ' ลำที่เทสสร้าง');

    const blank = R.groups.filter(g => !g.boats.length);
    if (blank.length) fail('มีหัวข้อท่าที่ไม่มีเรือสักลำ · ' + blank.map(g => g.label).join(', '));
    else ok('ท่าที่ไม่มีเรือเช่าไม่ขึ้นหัวข้อว่าง');

    const other = byPier['other'];
    if (!other || other.boats.indexOf('b-tbg-c') < 0)
      fail('ลำที่ท่าไม่ตรงกับกลุ่มไหนเลยหายไปเงียบ ๆ · ไม่มีหัวข้อ "ยังไม่ระบุท่า" รองรับ');
    else if (R.groups[R.groups.length - 1].pier !== 'other')
      fail('กลุ่ม "ยังไม่ระบุท่า" ไม่ได้อยู่ท้ายสุด · อยู่ลำดับที่ ' + (R.groups.findIndex(g => g.pier === 'other') + 1));
    else ok('ลำที่ยังไม่ระบุท่าไม่หาย · อยู่ใต้หัวข้อ "' + other.label + '" ท้ายสุด');

    const pw = byPier['panwa'];
    if (!pw || pw.boats.indexOf('b-tbg-d') < 0)
      fail('ลำที่ถูกย้ายท่าชั่วคราวไม่ไปโผล่ที่ท่าใหม่ · ยังอยู่ท่าบ้านเดิม '
           + '(แผงเรือเช่าใช้คนละตัวตัดสินกับเรือบริษัท)');
    else ok('ลำที่ถูกย้ายท่าชั่วคราวโผล่ใต้ Visit Panwa · ตัวตัดสินท่าตัวเดียวกับเรือบริษัท');
  }
}

/* ══ 11 · 12 · ตัวกรอง ═══════════════════════════════════════════════ */
{
  await page.evaluate(() => { boatPier = 'panwa'; renderBoats(); });
  const R = await readGroups();
  if (R.err) fail('ข้อ 11 · ' + R.err);
  else if (R.groups.some(g => g.pier !== 'panwa'))
    fail('กรองท่าพังงาแล้วยังขึ้นหัวข้อท่าอื่น · ' + R.groups.map(g => g.label).join(', '));
  else if (!R.groups.length) fail('กรองท่าพังงาแล้วไม่เหลือกลุ่มไหนเลย ทั้งที่มีเรือเช่าที่พังงา');
  else ok('กรองท่าแล้วเหลือเฉพาะหัวข้อของท่านั้น · ' + R.groups[0].label + ' ' + R.groups[0].count);

  await page.evaluate(() => { boatPier = 'all'; boatSt = 'fixing'; renderBoats(); });
  const R2 = await readGroups();
  if (R2.err) fail('ข้อ 12 · ' + R2.err);
  else if (R2.groups.length) ok('กรองแล้วยังมีเรือเช่าเหลือ ' + R2.groups.length + ' กลุ่ม · ข้ามการวัดข้อความว่าง');
  else if (!R2.empty) fail('กรองจนไม่เหลือเรือเช่า · หัวข้อยังอยู่แต่ข้างใต้ว่างเปล่า ไม่บอกว่าเพราะตัวกรอง');
  else ok('กรองจนไม่เหลือเรือเช่า · ยังขึ้น "' + R2.empty + '" เหมือนเดิม');
  await page.evaluate(() => { boatPier = 'all'; boatSt = 'all'; renderBoats(); });
}

/* ══ 13 ══════════════════════════════════════════════════════════════ */
await page.evaluate(() => {
  BOATS = BOATS.filter(b => !/^b-tbg-/.test(b.id || ''));
  selBoatId = null; renderBoats(); save('config');
});
if (errors.length) fail('มี error บนหน้า · ' + errors.slice(0, 3).join(' | '));
else ok('ไม่มี error บนหน้า');

await close();
console.log(bad ? '\n✗ ' + bad + ' ข้อไม่ผ่าน' : '\n✓ ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
