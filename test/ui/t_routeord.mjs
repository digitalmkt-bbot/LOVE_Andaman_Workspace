// §routeOrd · ลำดับรายการโปรแกรมในช่องเลือกทริป
//
// ที่มา (2026-09-28) · ผู้ใช้ถามเอง · "อันนี้เรียงตามอะไร เรียงตามที่ Agent list
// วางไว้ หรือเรียงตามใน Rate type"
//
// คำตอบตอนนั้นคือ "ไม่ได้เรียงเลย" · bkV2RouteDDOpts เอา ids มาแปลงเป็นชื่อตรง ๆ
// ไม่มี .sort() สักที่ · ลำดับจึงเป็นลำดับแถวดิบใน Programs sold (ถ้า agent มีสัญญา)
// หรือลำดับใน array routes ของ Rate Type (ถ้าไม่มี) — ซึ่งแปลว่า "ใครเพิ่มทีหลังก็ไปท้าย"
//
// วัดจากข้อมูลจริง · 302 เอเยนต์จาก 799 มีลำดับ programPeriods ไม่ตรงกับลำดับโปรแกรม
// ในระบบ · คนคีย์จึงต้องกวาดตาหาทั้งรายการทุกครั้ง แทนที่จะรู้ว่าท่าไหนอยู่ช่วงไหน
//
// กติกาที่ตกลงกันไว้ (ผู้ใช้เลือกเอง)
//   เรียงท่าก่อน · ท้ายเหมือง → พันวา → ระนอง → บก/อื่น ๆ
//   ในท่าเดียวกัน เรียงตามลำดับที่ตั้งไว้ในหน้า Program Config (ช่อง sort)
//   ลำดับใน Agent List / Rate Type ไม่ถูกแตะ · เปลี่ยนแค่วิธีแสดงในช่องค้นหา
//
// เทสนี้กันสามอย่าง
//   1 ตัวที่ขึ้นในรายการ ต้องเป็นชุดเดิมเป๊ะ · การเรียงต้องไม่ทำของหายหรือเพิ่ม
//   2 ลำดับต้องตรงกับที่คิดเองจาก ROUTES ดิบ (ท่า → sort) ไม่ใช่เรียกฟังก์ชันของหน้ามาเทียบ
//   3 หน้าโปรแกรมบก (City Tour) ก็ต้องเรียงด้วยกติกาเดียวกัน

import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1700, height: 1200 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(1500);

/* คิดลำดับที่ถูกต้องขึ้นมาเอง จาก ROUTES ดิบ · ไม่เรียก laRouteOrd / laRouteOrdCmp
   ถ้าเรียกของหน้ามาเทียบ เทสจะผ่านแม้กติกาจะเพี้ยน เพราะทั้งสองข้างผิดเหมือนกัน */
const WANT_PIER = ['tublamu', 'panwa', 'ranong', 'other'];

const R = await page.evaluate((WANT_PIER) => {
  const all = (ROUTES || []).filter(r => r && r.id && r.active !== false);
  const isLand = r => (typeof laIsLandRoute === 'function') ? laIsLandRoute(r.id) : !r.pier;
  const rank = r => {
    const p = isLand(r) ? 'other' : (r.pier || 'other');
    const i = WANT_PIER.indexOf(p);
    return i < 0 ? WANT_PIER.length : i;
  };
  const wantOrder = (list) => list.slice().map((r, i) => ({ r, i })).sort((a, b) =>
      (rank(a.r) - rank(b.r))
   || (((a.r.sort == null || a.r.sort === '') ? 1e9 : Number(a.r.sort) || 0) -
       ((b.r.sort == null || b.r.sort === '') ? 1e9 : Number(b.r.sort) || 0))
   || (all.indexOf(a.r) - all.indexOf(b.r))
  ).map(x => x.r.id);

  /* เอเยนต์ที่มี Programs sold เยอะสุด · ยิ่งเยอะยิ่งเห็นการสลับชัด
     และต้องเป็นเจ้าที่ลำดับเดิมไม่ตรงกับลำดับในระบบอยู่แล้ว ไม่งั้นเรียงหรือไม่เรียงก็เหมือนกัน */
  const pos = {}; all.forEach((r, i) => { pos[r.id] = i; });
  const cands = (SB_AGENTS || []).filter(a => {
    const ids = [...new Set((a.programPeriods || []).map(p => p && p.routeId).filter(Boolean))]
      .filter(id => pos[id] != null);
    if (ids.length < 3) return false;
    const seq = ids.map(id => pos[id]);
    return seq.some((v, i) => i && v < seq[i - 1]);        /* ลำดับเดิมสลับอยู่จริง */
  }).sort((a, b) => (b.programPeriods || []).length - (a.programPeriods || []).length);

  const probe = (agentId, landMode) => {
    if (typeof _bkV2CityTourOnly !== 'undefined') _bkV2CityTourOnly = !!landMode;
    bkV2NewBooking();
    const o = (bkV2GetAgentDDOptions() || []).find(x => x.id === agentId);
    if (!o) return null;
    bkV2AgentDDPick(o.label);                               /* ทางเดียวกับที่คนคลิก */
    const got = (bkV2RouteDDOpts() || []).map(x => x.id);
    const src = bkV2BookableRoutes();
    const raw = [...new Set((src.ids || []))].filter(id => {
      const r = all.find(x => x.id === id);
      return r && isLand(r) === !!landMode;
    });
    return { got, raw, src: src.src, want: wantOrder(got.map(id => all.find(r => r.id === id)).filter(Boolean)) };
  };

  const ag = cands[0];
  const out = { nAgent: cands.length, agentId: ag && ag.id, agentCode: ag && ag.code,
                nSwapped: cands.length, marine: null, land: null };
  if (ag) out.marine = probe(ag.id, false);
  /* ฝั่งบก · หาเจ้าที่ขายโปรแกรมบกจริง ไม่งั้นรายการว่าง ตรวจไม่ได้ */
  const landAg = (SB_AGENTS || []).find(a =>
    [...new Set((a.programPeriods || []).map(p => p && p.routeId).filter(Boolean))]
      .filter(id => { const r = all.find(x => x.id === id); return r && isLand(r); }).length >= 3);
  if (landAg) { out.landAgent = landAg.id; out.land = probe(landAg.id, true); }
  if (typeof _bkV2CityTourOnly !== 'undefined') _bkV2CityTourOnly = false;
  out.nameOf = {}; all.forEach(r => { out.nameOf[r.id] = (r.pier || 'land') + ' · ' + r.name; });
  return out;
}, WANT_PIER);

const show = (R2, ids) => ids.map(id => R.nameOf[id] || id).join(' | ');

/* ══ 1 · หาเคสที่ตรวจได้ ═══════════════════════════════════════════════ */
if (!R.marine) fail('ชุดข้อมูลนี้ไม่มีเอเยนต์ที่ Programs sold สลับลำดับอยู่ · ตรวจการเรียงไม่ได้');
else ok('เจอเอเยนต์ที่ลำดับ Programs sold สลับกับลำดับโปรแกรมในระบบ ' + R.nSwapped +
        ' เจ้า · ใช้ "' + (R.agentCode || R.agentId) + '" เป็นตัวตรวจ (แหล่ง: ' + R.marine.src + ')');

/* ══ 2 · เรียงแล้วของต้องไม่หายไม่เพิ่ม ════════════════════════════════ */
if (R.marine) {
  const a = R.marine.got.slice().sort(), b = R.marine.raw.slice().sort();
  if (a.length !== b.length || a.some((x, i) => x !== b[i]))
    fail('เรียงแล้วชุดเส้นทางเปลี่ยน · ในรายการ ' + a.length + ' เส้น แต่ที่ควรได้ ' + b.length +
         ' เส้น · การเรียงห้ามทำของหายหรือเพิ่ม');
  else ok('เรียงแล้วชุดเส้นทางเท่าเดิมเป๊ะ ' + a.length + ' เส้น · ไม่มีอะไรหายหรือโผล่เกิน');
}

/* ══ 3 · ลำดับตรงกับที่คิดเอง ══════════════════════════════════════════ */
if (R.marine) {
  const got = R.marine.got, want = R.marine.want;
  if (got.join() !== want.join())
    fail('ลำดับไม่ตรงกับที่คิดเองจาก ROUTES ดิบ\n      ได้   : ' + show(R, got) +
         '\n      ควรได้: ' + show(R, want));
  else if (got.join() === R.marine.raw.join())
    fail('ลำดับเท่ากับลำดับดิบใน Programs sold พอดี · เจ้านี้สลับอยู่จริง ถ้าเรียงแล้วยังเท่าเดิม แปลว่าไม่ได้เรียง');
  else ok('เรียงท่าก่อนแล้วตามลำดับหน้า Program Config ถูกต้อง ' + got.length + ' เส้น · ' + show(R, got));
}

/* ══ 4 · ชุดที่ตั้งใจให้แยกแยะได้ ═══════════════════════════════════════
   ข้อ 3 ผ่านได้ด้วยเอเยนต์จริง แต่เอเยนต์จริงส่วนใหญ่ขายแค่สองท่า และชื่อโปรแกรม
   ของเขาบังเอิญเรียงตามตัวอักษรเท่ากับลำดับ Config พอดี → เรียงตามชื่อ หรือลืมจัดกลุ่มท่า
   ก็ได้คำตอบเท่ากัน · พิสูจน์แล้วด้วยปุ่มทำพัง ordname กับ ordnopier ที่ข้อ 3 จับไม่ได้
   ข้อนี้จึงจัดชุดขึ้นเองจากข้อมูลจริง ให้มีสองคุณสมบัติที่หักล้างทั้งสองแบบ
   แล้วคืน programPeriods เดิมให้ */
const R4 = await page.evaluate((WANT_PIER) => {
  const all = (ROUTES || []).filter(r => r && r.id && r.active !== false);
  const isLand = r => (typeof laIsLandRoute === 'function') ? laIsLandRoute(r.id) : !r.pier;
  const mar = all.filter(r => !isLand(r));
  const sv = r => (r.sort == null || r.sort === '') ? 1e9 : (Number(r.sort) || 0);
  const rk = r => { const i = WANT_PIER.indexOf(r.pier || 'other'); return i < 0 ? WANT_PIER.length : i; };

  /* (ก) คู่ในท่าเดียวกันที่ลำดับชื่อกลับด้านกับลำดับ Config */
  let pairName = null;
  for (let i = 0; i < mar.length && !pairName; i++)
    for (let j = i + 1; j < mar.length && !pairName; j++) {
      const a = mar[i], b = mar[j];
      if (a.pier === b.pier && ((sv(a) < sv(b)) !== (String(a.name) < String(b.name)))) pairName = [a, b];
    }
  /* (ข) เส้นที่ท่ามาก่อน แต่เลข Config มากกว่าเส้นของท่าที่มาทีหลัง */
  let pairPier = null;
  for (const a of mar) for (const b of mar)
    if (!pairPier && rk(a) < rk(b) && sv(a) > sv(b)) pairPier = [a, b];
  if (!pairName || !pairPier) return { skip: true, pairName: !!pairName, pairPier: !!pairPier };

  const ids = [...new Set([].concat(pairName, pairPier).map(r => r.id))];
  const pick = list => list.map(id => all.find(r => r.id === id)).filter(Boolean);
  const want = pick(ids).slice()
    .sort((a, b) => (rk(a) - rk(b)) || (sv(a) - sv(b)) || (all.indexOf(a) - all.indexOf(b)))
    .map(r => r.id);
  const byName = pick(ids).slice()
    .sort((a, b) => (rk(a) - rk(b)) || String(a.name).localeCompare(String(b.name))).map(r => r.id);
  const noPier = pick(ids).slice().sort((a, b) => sv(a) - sv(b)).map(r => r.id);
  const raw = want.slice().reverse();   /* ลำดับดิบที่ยัดให้ · ผิดทั้งสองมิติโดยตั้งใจ */

  const ag = (SB_AGENTS || []).find(a => a.active !== false && (a.programPeriods || []).length);
  if (!ag) return { skip: true, noAgent: true };
  const bakPP = ag.programPeriods, bakPg = ag.programs;
  ag.programPeriods = raw.map(id => ({ routeId: id, bookFrom: '', bookTo: '', travelFrom: '', travelTo: '' }));
  ag.programs = raw.slice();
  if (typeof _bkV2CityTourOnly !== 'undefined') _bkV2CityTourOnly = false;
  bkV2NewBooking();
  const o = (bkV2GetAgentDDOptions() || []).find(x => x.id === ag.id);
  bkV2AgentDDPick(o.label);
  const got = (bkV2RouteDDOpts() || []).map(x => x.id);
  ag.programPeriods = bakPP; ag.programs = bakPg;

  const nm = {}; all.forEach(r => { nm[r.id] = (r.pier || 'land') + ' · ' + r.name + ' [#' + sv(r) + ']'; });
  return { got, want, raw, byName, noPier, nm, agent: ag.code || ag.id };
}, WANT_PIER);

if (R4.skip)
  fail('หาชุดทดสอบที่แยกแยะได้ไม่เจอ (คู่ชื่อสลับ=' + R4.pairName + ' คู่ท่าคาบเกี่ยว=' + R4.pairPier +
       ') · ถ้าตรวจต่อก็ได้แค่คำตอบที่จริงแต่พิสูจน์อะไรไม่ได้');
else if (R4.want.join() === R4.byName.join())
  fail('ชุดทดสอบนี้แยกไม่ออกระหว่าง "ตามชื่อ" กับ "ตาม Config" · เทสนี้พิสูจน์อะไรไม่ได้');
else if (R4.want.join() === R4.noPier.join())
  fail('ชุดทดสอบนี้แยกไม่ออกว่าจัดกลุ่มท่าหรือไม่ · เทสนี้พิสูจน์อะไรไม่ได้');
else if (R4.got.join() === R4.raw.join())
  fail('ได้ลำดับเท่ากับที่ยัดใส่เข้าไป · แปลว่าไม่ได้เรียงจริง');
else if (R4.got.join() !== R4.want.join())
  fail('ชุดทดสอบเรียงผิด\n      ได้   : ' + R4.got.map(i => R4.nm[i]).join(' | ') +
       '\n      ควรได้: ' + R4.want.map(i => R4.nm[i]).join(' | '));
else ok('ชุดที่แยกแยะได้จริงผ่าน (ยืม "' + R4.agent + '" ยัด Programs sold สลับไว้) · ' +
        'เรียงตามชื่อ หรือไม่จัดกลุ่มท่า จะให้ผลต่างออกไป · ' + R4.got.map(i => R4.nm[i]).join(' | '));

/* ══ 5 · ท่าที่ยังไม่รู้จัก ต้องไปต่อท้าย ไม่ใช่หายไป ═══════════════════
   §otherPier ในโค้ดบันทึกไว้ว่าเรื่องนี้เคยเกิดมาแล้วสองรอบ · ระนองรอบหนึ่ง
   แล้วโปรแกรมบกอีกรอบ · ทั้งสองรอบท่าที่ไม่อยู่ในลิสต์ถูกทิ้งเงียบ ๆ
   ข้อมูลจริงตอนนี้ไม่มีท่าแปลก จึงต้องใส่เข้าไปเองแล้วคืนให้ ไม่งั้นข้อนี้ไม่ได้ตรวจอะไร */
const R5 = await page.evaluate(() => {
  const FAKE = 'r__test_unknown_pier__';
  const base = (ROUTES || []).find(r => r && r.pier === 'tublamu' && r.active !== false);
  if (!base) return { skip: true };
  const row = Object.assign({}, base, { id: FAKE, pier: 'zzz_not_a_real_pier', sort: -99,
                                        name: 'ทดสอบท่าที่ยังไม่รู้จัก' });
  ROUTES.push(row);
  const ag = (SB_AGENTS || []).find(a => a.active !== false && (a.programPeriods || []).length);
  const bakPP = ag.programPeriods, bakPg = ag.programs;
  const ids = [FAKE, base.id];
  ag.programPeriods = ids.map(id => ({ routeId: id, bookFrom:'', bookTo:'', travelFrom:'', travelTo:'' }));
  ag.programs = ids.slice();
  if (typeof _bkV2CityTourOnly !== 'undefined') _bkV2CityTourOnly = false;
  bkV2NewBooking();
  const o = (bkV2GetAgentDDOptions() || []).find(x => x.id === ag.id);
  bkV2AgentDDPick(o.label);
  const got = (bkV2RouteDDOpts() || []).map(x => x.id);
  ag.programPeriods = bakPP; ag.programs = bakPg;
  const i = ROUTES.indexOf(row); if (i >= 0) ROUTES.splice(i, 1);
  return { got, fake: FAKE, baseId: base.id };
});
if (R5.skip) fail('ไม่มีเส้นทางท้ายเหมืองให้ใช้เป็นตัวตั้ง · ตรวจข้อนี้ไม่ได้');
else if (R5.got.indexOf(R5.fake) < 0)
  fail('เส้นทางของท่าที่ยังไม่รู้จักหายไปจากรายการ · §otherPier เคยพลาดแบบนี้มาสองรอบแล้ว · ต้องเห็นแล้วแก้ ไม่ใช่หายเงียบ');
else if (R5.got[R5.got.length - 1] !== R5.fake)
  fail('เส้นทางของท่าที่ยังไม่รู้จักไม่ได้อยู่ท้ายรายการ · ได้ลำดับ ' + R5.got.join(' → ') +
       ' · ท่าที่ไม่รู้จักต้องไปต่อท้าย ไม่ใช่ดันขึ้นหัว');
else ok('ท่าที่ยังไม่รู้จักยังอยู่ในรายการและไปต่อท้าย ไม่หายและไม่ดันขึ้นหัว (ใส่ Config#-99 ไว้ล่อ)');

/* ══ 5b · หน้าโปรแกรมบกใช้กติกาเดียวกัน ════════════════════════════════ */
if (!R.land) ok('ชุดข้อมูลนี้ไม่มีเอเยนต์ที่ขายโปรแกรมบก ≥3 รายการ · ข้ามการตรวจฝั่งบก');
else if (R.land.got.join() !== R.land.want.join())
  fail('หน้าโปรแกรมบกเรียงไม่ตรงกับกติกาเดียวกัน · ได้ ' + R.land.got.length + ' เส้น\n      ได้   : ' +
       show(R, R.land.got) + '\n      ควรได้: ' + show(R, R.land.want));
else ok('หน้าโปรแกรมบก (City Tour) เรียงด้วยกติกาเดียวกัน ' + R.land.got.length + ' เส้น');

/* ══ 6 · หัวคั่นท่าเรือ ════════════════════════════════════════════════
   §pierHd · ชื่อท่าแล้วขีดยาวหนึ่งขีด แทนชิป TL / VP ทุกแถว
   สามเรื่องที่ต้องจริงพร้อมกัน ไม่ใช่แค่ "มีหัว"
     หัวต้องตรงกับกลุ่มที่อยู่ข้างใต้จริง · พิมพ์ค้นหาแล้วหัวที่ไม่เหลือผลต้องหายไป
     หัวต้องไม่ถูกนับเป็นตัวเลือก ไม่งั้นกดลูกศรลงแล้วไปค้างที่หัว */
const R6 = await page.evaluate(() => {
  const all = (ROUTES || []).filter(r => r && r.id && r.active !== false);
  const pos = {}; all.forEach((r, i) => { pos[r.id] = i; });
  const ag = (SB_AGENTS || []).filter(a => {
    const ids = [...new Set((a.programPeriods || []).map(p => p && p.routeId).filter(Boolean))]
      .filter(id => pos[id] != null);
    const piers = new Set(ids.map(id => all.find(r => r.id === id).pier).filter(Boolean));
    return ids.length >= 4 && piers.size >= 2;
  }).sort((a, b) => (b.programPeriods || []).length - (a.programPeriods || []).length)[0];
  if (!ag) return { skip: true };

  bkV2NewBooking();
  const o = (bkV2GetAgentDDOptions() || []).find(x => x.id === ag.id);
  bkV2AgentDDPick(o.label);

  /* กล่องของจริงอยู่ในฟอร์มที่ยังไม่ถูก mount · สร้างกล่องชื่อเดียวกันให้ตัววาดใช้ */
  let host = document.getElementById('__ddprobe');
  if (!host) { host = document.createElement('div'); host.id = '__ddprobe'; document.body.appendChild(host); }
  host.innerHTML = '<div class="bkv2-nb-dd open" id="bkv2-route-dd-0"></div>';
  const dd = () => document.getElementById('bkv2-route-dd-0');
  const read = () => {
    const kids = [].slice.call(dd().children);
    const seq = kids.map(el => el.classList.contains('bkv2-nb-dd-hd')
      ? { hd: (el.querySelector('.lb') || {}).textContent || '' }
      : { it: (el.querySelector('.bkv2-nb-dd-name') || {}).textContent || '' });
    return { seq, items: dd().querySelectorAll('.bkv2-nb-dd-item').length,
             chips: dd().querySelectorAll('.bkv2-nb-dd-mkt').length,
             lines: dd().querySelectorAll('.bkv2-nb-dd-hd .ln').length };
  };

  const lang0 = (typeof laLangGet === 'function') ? laLangGet() : 'th';
  if (typeof laLangSet === 'function') laLangSet('en');
  bkV2RouteDDRender(0, '');
  const full = read();
  const opts = (bkV2RouteDDOpts() || []).map(x => ({ id: x.id, label: x.label, pierId: x.pierId }));
  const wantHd = []; let last = null;
  opts.forEach(x => { if (x.pierId !== last) { last = x.pierId; wantHd.push(laPierName(x.pierId)); } });

  /* คำค้นที่เหลือท่าเดียว · หยิบจากคำในชื่อของท่าหลัง แล้วเช็คว่ามันไม่ไปโดนท่าแรก */
  const lastPier = opts[opts.length - 1].pierId;
  let q = null;
  for (const w of opts.filter(x => x.pierId === lastPier).map(x => x.label.split(/\s+/)).flat()) {
    const k = String(w).toLowerCase();
    if (k.length < 3) continue;
    const hit = opts.filter(x => x.label.toLowerCase().includes(k));
    if (hit.length && new Set(hit.map(x => x.pierId)).size === 1 && hit.length < opts.length) { q = k; break; }
  }
  let filt = null;
  if (q) { bkV2RouteDDRender(0, q); filt = read(); }

  if (typeof laLangSet === 'function') laLangSet('th');
  bkV2RouteDDRender(0, '');
  const thHd = read().seq.filter(x => x.hd != null).map(x => x.hd);
  if (typeof laLangSet === 'function') laLangSet(lang0);
  host.remove();

  return { agent: ag.code || ag.id, full, opts, wantHd, q, filt, thHd,
           enHd: full.seq.filter(x => x.hd != null).map(x => x.hd),
           thWant: opts.reduce((a, x) => (a.includes(x.pierId) ? a : a.concat(x.pierId)), []) };
});

if (R6.skip) fail('ไม่มีเอเยนต์ที่ขายข้ามท่า ≥2 ท่า · ตรวจหัวคั่นไม่ได้');
else {
  const seq = R6.full.seq;
  const hdOf = [], orphan = [];
  seq.forEach((x, i) => {
    if (x.hd == null) return;
    hdOf.push(x.hd);
    if (!seq[i + 1] || seq[i + 1].hd != null) orphan.push(x.hd);
  });
  if (R6.full.chips) fail('ยังมีชิป TL / VP เหลืออยู่ ' + R6.full.chips + ' อัน · แบบ A ให้หัวคั่นบอกท่าแทน ไม่ใช่บอกซ้ำทุกแถว');
  else if (R6.full.items !== R6.opts.length)
    fail('จำนวนตัวเลือกเพี้ยน · วาดออกมา ' + R6.full.items + ' แถว แต่มี ' + R6.opts.length +
         ' เส้นทาง · หัวคั่นต้องไม่ถูกนับเป็นตัวเลือก (ไม่งั้นกดลูกศรลงแล้วไปค้างที่หัว)');
  else if (R6.full.lines !== hdOf.length)
    fail('หัวคั่นมี ' + hdOf.length + ' อัน แต่ขีดยาวมี ' + R6.full.lines + ' เส้น · ต้องมีขีดหนึ่งขีดต่อหนึ่งหัว');
  else if (orphan.length) fail('มีหัวคั่นที่ไม่มีเส้นทางอยู่ข้างใต้ · ' + orphan.join(', '));
  else if (hdOf.join('|') !== R6.wantHd.join('|'))
    fail('หัวคั่นไม่ตรงกับกลุ่มจริง · ได้ ' + hdOf.join(', ') + ' · ควรได้ ' + R6.wantHd.join(', '));
  else ok('หัวคั่นถูกต้อง ' + hdOf.length + ' หัว (' + hdOf.join(' / ') + ') · ' + R6.full.items +
          ' เส้นทาง · ไม่มีชิปเหลือ · หัวไม่ถูกนับเป็นตัวเลือก · ขีดครบทุกหัว');
}

/* ══ 7 · พิมพ์ค้นหาแล้วหัวที่ไม่เหลือผลต้องหายไป ════════════════════════ */
if (R6.skip || !R6.q) fail('หาคำค้นที่เหลือท่าเดียวไม่ได้ · ตรวจข้อนี้ไม่ได้');
else {
  const seq = R6.filt.seq;
  const hd = seq.filter(x => x.hd != null).map(x => x.hd);
  const orphan = seq.filter((x, i) => x.hd != null && (!seq[i + 1] || seq[i + 1].hd != null));
  if (hd.length !== 1)
    fail('พิมพ์ "' + R6.q + '" แล้วเหลือท่าเดียว แต่ยังมีหัวคั่น ' + hd.length + ' อัน (' + hd.join(', ') +
         ') · หัวของท่าที่ไม่เหลือผลต้องหายไปด้วย');
  else if (orphan.length) fail('พิมพ์ "' + R6.q + '" แล้วมีหัวคั่นลอยที่ไม่มีอะไรอยู่ข้างใต้');
  else if (R6.filt.items >= R6.full.items)
    fail('พิมพ์ "' + R6.q + '" แล้วรายการไม่ได้ถูกกรอง (' + R6.filt.items + '/' + R6.full.items + ') · ตรวจข้อนี้ไม่ได้');
  else ok('พิมพ์ "' + R6.q + '" แล้วเหลือหัวเดียว "' + hd[0] + '" กับ ' + R6.filt.items +
          ' เส้นทาง · ไม่มีหัวลอย');
}

/* ══ 8 · ชื่อท่าตามภาษาที่เลือก ═════════════════════════════════════════ */
if (R6.skip) fail('ตรวจภาษาของชื่อท่าไม่ได้');
else if (!R6.enHd.length || !R6.thHd.length) fail('อ่านชื่อท่าไม่ได้ทั้งสองภาษา');
else if (R6.enHd.join('|') === R6.thHd.join('|'))
  fail('สลับภาษาแล้วชื่อท่าไม่เปลี่ยน · ได้ "' + R6.enHd.join(', ') + '" ทั้งสองโหมด');
else if (/[ก-ฮะ-ฺเ-๎]/.test(R6.enHd.join('')))
  fail('โหมดอังกฤษยังมีชื่อท่าเป็นไทย · ' + R6.enHd.join(', '));
else if (!/[ก-ฮะ-ฺเ-๎]/.test(R6.thHd.join('')))
  fail('โหมดไทยยังเป็นชื่ออังกฤษ · ' + R6.thHd.join(', '));
else ok('ชื่อท่าตามภาษาที่เลือก · EN "' + R6.enHd.join(' / ') + '" · TH "' + R6.thHd.join(' / ') + '"');

/* ══ 9 · ไม่มี error บนหน้า ════════════════════════════════════════════ */
if (errors.length) fail('มี error บนหน้า ' + errors.length + ' รายการ · ' + errors.slice(0, 2).join(' | '));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log('\nพัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
