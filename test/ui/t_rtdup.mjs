// §rtDupCode + §rtImpCode · โค้ดเรทซ้ำ และการจับคู่เรทตอนนำเข้า Agent
//
// ที่มา (2026-09-18) · ถูกขอให้ตรวจว่า "สร้าง Rate Type แล้วทับกันไหม"
//   ตัวสร้างไม่ทับ — id มาจาก LA_UID และ rtSaveDraft มีเกราะกันชนอีกชั้น (ข้อ 1 ของเทสนี้)
//   แต่ของจริงมีเรท 5 ชุดใช้โค้ด RT-NANA เหมือนกัน สร้างวันเดียวกันตอนที่โค้ดยังพิมพ์เอง
//   ราคาต่างกันถึง 900 บาท/คน และ 101 เอเย่นต์ผูกอยู่กับกลุ่มนั้น
//
//   ที่อันตรายคือ การนำเข้า Agent จาก Excel จับคู่เรท "ด้วยโค้ด" แล้วหยิบตัวแรกที่เจอ
//   ลำดับใน SB_RATE_TYPES มาจากลำดับแถวใน Postgres ซึ่งไม่การันตี
//   ไฟล์เดิม นำเข้าคนละวัน จึงได้คนละเรทได้ โดยไม่มีอะไรฟ้อง
//
// เทสนี้กันสามอย่าง
//   1 สร้างเรทซ้อนกันต้องไม่มีตัวไหนหาย และ id/โค้ดต้องไม่ซ้ำ
//   2 โค้ดซ้ำต้องถูกตรวจเจอ และปุ่มแก้ต้องแก้เฉพาะช่องโค้ด (ห้ามแตะ id · ราคา · การผูกเอเย่นต์)
//   3 นำเข้าที่ระบุโค้ดกำกวม ต้องไม่ผูกเรทให้ และต้องขึ้นเตือนในพรีวิว
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1440, height: 1000 });
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="rate-types"]'); if (el) nav(el); });
await page.waitForTimeout(1000);

/* ══ 1 · สร้างซ้อนกันสามชุด · ไม่มีตัวไหนหาย ═════════════════════════════ */
const A = await page.evaluate(() => {
  const before = SB_RATE_TYPES.length;
  const beforeIds = SB_RATE_TYPES.map(r => r.id);
  const mk = name => { rtOpenNew(); _rtDraft.name = name; _rtDraft.routes = ['r10'];
    _rtDraft.seatRates = {r10:{PK:{'adult-fr':1000}}}; const id = _rtDraft.id; rtSaveDraft(); return _rtSelected || id; };
  const ids = ['ZZ Probe One','ZZ Probe Two','ZZ Probe One'].map(mk);   /* ตัวที่ 1 กับ 3 ชื่อซ้ำกันตั้งใจ */
  const found = ids.map(i => SB_RATE_TYPES.find(x => x.id === i));
  const codes = ids.map((i, k) => (found[k] || {}).code || '');
  return {
    before, after: SB_RATE_TYPES.length,
    survived: beforeIds.every(i => SB_RATE_TYPES.some(x => x.id === i)),
    allSaved: found.every(Boolean),
    uniqueIds: new Set(ids).size === 3,
    uniqueCodes: new Set(codes.map(c => c.toUpperCase())).size === 3,
    codes
  };
});
if (A.after !== A.before + 3) fail('สร้าง 3 ชุดแล้วจำนวนเปลี่ยนจาก ' + A.before + ' เป็น ' + A.after);
else ok('สร้าง 3 ชุด · ' + A.before + ' → ' + A.after);
if (!A.survived) fail('เรทที่มีอยู่เดิมหายไปหลังสร้างใหม่');
else ok('เรทเดิมอยู่ครบทุกตัว');
if (!A.allSaved || !A.uniqueIds) fail('id ซ้ำกันหรือมีตัวที่บันทึกไม่ติด');
else ok('id ไม่ซ้ำ · บันทึกครบทั้ง 3');
if (!A.uniqueCodes) fail('ชื่อซ้ำกันแล้วได้โค้ดซ้ำด้วย · ' + A.codes.join(' / '));
else ok('ชื่อซ้ำแต่โค้ดแยกกันได้ · ' + A.codes.join(' / '));

/* ══ 2 · ตรวจโค้ดซ้ำ + ปุ่มแก้ ═══════════════════════════════════════════ */
const B = await page.evaluate(() => {
  /* ปลูกเคสโค้ดซ้ำเองสองตัว แล้ววัดว่าเครื่องมือเห็นและแก้ได้จริง
     ไม่พึ่ง RT-NANA ในข้อมูลจริง เพราะวันหนึ่งมันจะถูกแก้ไปแล้ว */
  const A1 = SB_RATE_TYPES.find(r => /ZZ Probe One/.test(r.name || ''));
  const A2 = SB_RATE_TYPES.find(r => /ZZ Probe Two/.test(r.name || ''));
  A2.code = A1.code;                                    // ทำให้ซ้ำ
  /* ผูกเอเย่นต์ให้ตัวแรกมากกว่า → ตัวแรกควรเป็นตัวที่เก็บโค้ดเดิมไว้ */
  const ag = SB_AGENTS.slice(0, 3);
  ag.forEach(a => { a._rtBak = a.rateTypeId; a.rateTypeId = A1.id; });

  const G0 = rtDupCodeScan();
  const seen = G0.some(g => g.code === String(A1.code).toUpperCase() && g.list.length === 2);
  const priceBefore = JSON.stringify(A2.seatRates);
  const idBefore = A2.id, codeBefore = A2.code;

  rtDupCodeFix();

  const G1 = rtDupCodeScan();
  const out = {
    seen, groupsAfter: G1.length,
    keeperKeptCode: A1.code === codeBefore,
    otherRenamed: A2.code !== codeBefore,
    idUntouched: A2.id === idBefore,
    priceUntouched: JSON.stringify(A2.seatRates) === priceBefore,
    bindingsUntouched: ag.every(a => a.rateTypeId === A1.id),
    newCode: A2.code
  };
  ag.forEach(a => { a.rateTypeId = a._rtBak; delete a._rtBak; });
  return out;
});
if (!B.seen) fail('ตรวจไม่เจอกลุ่มโค้ดซ้ำที่ปลูกไว้');
else ok('ตรวจเจอกลุ่มโค้ดซ้ำ');
if (B.groupsAfter) fail('กดแก้แล้วยังเหลือโค้ดซ้ำอีก ' + B.groupsAfter + ' กลุ่ม');
else ok('กดแก้แล้วไม่เหลือโค้ดซ้ำ');
if (!B.keeperKeptCode) fail('ตัวที่มีเอเย่นต์ผูกมากกว่าถูกเปลี่ยนโค้ด · ควรเก็บโค้ดเดิมไว้');
else if (!B.otherRenamed) fail('อีกตัวไม่ได้เปลี่ยนโค้ด');
else ok('ตัวที่คนใช้มากกว่าเก็บโค้ดเดิม · อีกตัวได้ ' + B.newCode);
if (!B.idUntouched || !B.priceUntouched || !B.bindingsUntouched)
  fail('ปุ่มแก้ไปแตะของที่ห้ามแตะ · id=' + B.idUntouched + ' ราคา=' + B.priceUntouched + ' การผูก=' + B.bindingsUntouched);
else ok('ไม่แตะ id · ไม่แตะราคา · ไม่ย้ายเอเย่นต์');

/* ══ 3 · นำเข้า Agent · โค้ดกำกวมต้องไม่ผูกให้ ═══════════════════════════ */
const C = await page.evaluate(() => {
  const A1 = SB_RATE_TYPES.find(r => /ZZ Probe One/.test(r.name || ''));
  const A2 = SB_RATE_TYPES.find(r => /ZZ Probe Two/.test(r.name || ''));
  const dupCode = 'ZZDUPE';
  A1.code = dupCode; A2.code = dupCode;                 // ปลูกโค้ดซ้ำอีกรอบ เฉพาะข้อนี้

  const note1 = {}, r1 = _agImpRate(dupCode, note1);            // กำกวม
  /* ใช้ชื่อของ A2 · ชื่อของ A1 ถูกตั้งซ้ำไว้ตั้งแต่ข้อ 1 (ตั้งใจ) จึงกำกวมด้วยตัวมันเอง */
  const note2 = {}, r2 = _agImpRate(A2.name, note2);            // ชื่อตรงตัวเดียว
  const note3 = {}, r3 = _agImpRate(A1.id, note3);              // id ตรงตัว
  const note4 = {}, r4 = _agImpRate('ไม่มีเรทนี้จริง ๆ', note4); // ไม่ตรงอะไรเลย

  /* เดินผ่าน _agImpRow เหมือนตอนอ่านไฟล์จริง · โค้ดกำกวมต้องไม่ลง src */
  const noteRow = {};
  const src = _agImpRow({name:'ZZ Import Probe', rateType:dupCode}, noteRow);

  A1.code = 'ZZPROBE-A'; A2.code = 'ZZPROBE-B';        // คืนค่า
  return {
    ambiguousBlocked: r1 === '',
    ambiguousFlagged: !!(note1.rateAmb && note1.rateAmb.names.length === 2),
    byName: r2 === A2.id, byId: r3 === A1.id,
    unknownBlocked: r4 === '' && !!note4.rateAmb && note4.rateAmb.names.length === 0,
    rowNotBound: src.rateTypeId === undefined,
    rowFlagged: !!noteRow.rateAmb
  };
});
if (!C.ambiguousBlocked) fail('โค้ดที่ตรงสองชุด ยังผูกเรทให้ · นี่คือตัวที่ผูกผิดแบบเงียบ ๆ');
else ok('โค้ดกำกวม · ไม่ผูกเรทให้');
if (!C.ambiguousFlagged) fail('โค้ดกำกวมแล้วไม่ได้บอกว่าตรงกับชุดไหนบ้าง');
else ok('บอกได้ว่าตรงกับ 2 ชุด');
if (!C.byId || !C.byName) fail('จับคู่ด้วย id หรือชื่อที่ตรงตัวเดียวไม่ได้ · id=' + C.byId + ' name=' + C.byName);
else ok('จับคู่ด้วย id และชื่อที่ตรงตัวเดียวได้ปกติ');
if (!C.unknownBlocked) fail('ค่าที่ไม่ตรงเรทไหนเลย ไม่ได้ถูกทำเครื่องหมายไว้');
else ok('ค่าที่ไม่ตรงเรทไหนเลย · ทำเครื่องหมายไว้ให้เห็น');
if (!C.rowNotBound) fail('แถวนำเข้ายังได้ rateTypeId ทั้งที่โค้ดกำกวม');
else if (!C.rowFlagged) fail('แถวนำเข้าไม่ได้ติดธงเตือนไว้ · พรีวิวจะไม่ขึ้นอะไรเลย');
else ok('แถวนำเข้า · ไม่ผูกเรท และติดธงเตือนไว้');

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
