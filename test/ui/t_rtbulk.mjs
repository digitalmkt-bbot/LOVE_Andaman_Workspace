// §rtExpBulk · ตั้งตารางฤดูกาลทีเดียวหลายเจ้า จากตัวถัดไปที่สัญญาระบุไว้แล้ว
//
// ที่มา · เรทฤดูต่ำหมดพร้อมกันเป็นร้อยเจ้า และหลายเจ้าระบุ "ตัวถัดไป" ไว้ในสัญญาแล้ว
//   ข้อมูลครบ เหลือแค่งานกรอกซ้ำ · ตัวนี้ตั้งตารางให้ ไม่ใช่เปลี่ยนเรทให้
//
// ⚠ ข้อที่กล่องนี้สัญญากับคนกดคือ "ราคาก่อนวันแบ่งไม่ขยับสักบาท"
//   ข้อ 3 ข้างล่างคือข้อที่พิสูจน์ประโยคนั้น · ถ้าข้อนั้นพัง ห้ามปล่อยของ
//   (ตอนทำรอบแรกมันพังจริง · วันแบ่งของบางกลุ่มถอยไปเป็น 16 พ.ค. ซึ่งเป็นอดีต)
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const warn = m => console.log('  ! ' + m);

const { page, errors, close } = await open({ blob: process.env.LAD });

/* ── 1 · แผนต้องสมเหตุสมผลก่อนเอาไปใช้ ─────────────────────────────────── */
const P = await page.evaluate(() => {
  const out = { plans: [], today: TODAY_STR };
  rtExpScan().forEach(x => {
    const p = rtExpBulkPlan(x.rt.id);
    if (!p) return;
    out.plans.push({ rt: x.rt.id, name: (x.rt.name||'').trim(), total: p.total,
      groups: p.groups.map(g => ({ split: g.split, n: g.ags.length,
                                   nextActive: g.nextRt.active !== false })) });
  });
  out.total = out.plans.reduce((s,p) => s + p.total, 0);
  return out;
});
console.log('Bulk season · ' + P.today);
if (!P.total){ fail('ไม่มีแผนให้ตรวจเลย · subset นี้ทดสอบข้อนี้ไม่ได้'); }
else ok('มีแผน ' + P.total + ' เอเย่นต์ · ' + P.plans.filter(p=>p.total).length + ' ชุดเรท');

const past = [], off = [];
P.plans.forEach(p => p.groups.forEach(g => {
  if (g.split <= P.today) past.push(p.name + ' → ' + g.split);
  if (!g.nextActive) off.push(p.name);
}));
if (past.length)
  fail('วันแบ่งเป็นอดีต ' + past.length + ' กลุ่ม · ' + past[0]
     + ' — กดแล้วราคาวันนี้จะขยับทันที');
else ok('ทุกวันแบ่งอยู่ในอนาคต');
if (off.length) fail('มีกลุ่มชี้ไปเรทที่ปิดใช้งานแล้ว · ' + off[0]);
else ok('ไม่มีกลุ่มไหนชี้ไปเรทที่ปิดใช้งาน');

/* ── 1b · เคสอันตรายที่สุด · เรทตัวถัดไปที่ validFrom ย้อนไปอยู่ในอดีต ──────
   ของจริงมีเรทแบบนี้ (Russian Standard Tier 1 · เริ่ม 16 พ.ค. ทั้งที่เป็น "ตัวถัดไป" ของเรทที่หมด 14 ต.ค.)
   ตอนนี้มันถูกกันด้วยธง active=false อยู่ · ซึ่งแปลว่าถ้าวันไหนมีคนเปิดใช้งานกลับมา
   ด่านที่เหลือคือกติกาวันแบ่งล้วน ๆ · เทสจึงเปิดมันกลับมาเองแล้ววัด
   ถ้าหลุด = กดปุ่มแล้วราคาของวันนี้ขยับทันที ซึ่งตรงข้ามกับที่กล่องเขียนไว้ */
const DANGER = await page.evaluate(() => {
  /* ต้องเลือก "ตัวที่มีเอเย่นต์ระบุเป็นตัวถัดไปจริง" · ไม่ใช่เรทปิดตัวไหนก็ได้
     เลือกมั่ว = เปิดแล้วไม่มีผลกับแผนเลย แล้วเทสจะผ่านแบบไม่ได้ตรวจอะไร */
  const named = {};
  rtExpScan().forEach(x => x.agents.forEach(a => {
    const nx = rtExpNextOf(a.id); if (nx) named[nx] = (named[nx]||0) + 1; }));
  const victim = (SB_RATE_TYPES||[]).filter(r => r.active === false && named[r.id]
                   && r.validFrom && r.validFrom < TODAY_STR)[0];
  if (!victim) return { skipped:true };
  victim.active = true;                               // เปิดใช้งานชั่วคราว
  const splits = [];
  rtExpScan().forEach(x => { const p = rtExpBulkPlan(x.rt.id);
    if (p) p.groups.forEach(g => splits.push({ split:g.split, next:g.nextRt.id, n:g.ags.length })); });
  victim.active = false;                              // คืนสภาพ
  return { skipped:false, name:victim.name, vf:victim.validFrom,
           past: splits.filter(x => x.split <= TODAY_STR), n: splits.length };
});
if (DANGER.skipped) warn('subset \u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e23\u0e17\u0e17\u0e35\u0e48 validFrom \u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e2d\u0e14\u0e35\u0e15 \u00b7 \u0e02\u0e49\u0e32\u0e21\u0e40\u0e04\u0e2a\u0e19\u0e35\u0e49');
else if (DANGER.past.length)
  fail('\u0e40\u0e1b\u0e34\u0e14 "' + DANGER.name + '" (\u0e40\u0e23\u0e34\u0e48\u0e21 ' + DANGER.vf + ') \u0e01\u0e25\u0e31\u0e1a\u0e21\u0e32\u0e41\u0e25\u0e49\u0e27\u0e21\u0e35\u0e27\u0e31\u0e19\u0e41\u0e1a\u0e48\u0e07\u0e40\u0e1b\u0e47\u0e19\u0e2d\u0e14\u0e35\u0e15 '
     + DANGER.past.length + ' \u0e01\u0e25\u0e38\u0e48\u0e21 \u00b7 \u0e01\u0e14\u0e41\u0e25\u0e49\u0e27\u0e23\u0e32\u0e04\u0e32\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e02\u0e22\u0e31\u0e1a');
else ok('\u0e40\u0e23\u0e17\u0e15\u0e31\u0e27\u0e16\u0e31\u0e14\u0e44\u0e1b\u0e17\u0e35\u0e48 validFrom \u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e2d\u0e14\u0e35\u0e15 \u00b7 \u0e27\u0e31\u0e19\u0e41\u0e1a\u0e48\u0e07\u0e22\u0e31\u0e07\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e2d\u0e19\u0e32\u0e04\u0e15\u0e17\u0e38\u0e01\u0e01\u0e25\u0e38\u0e48\u0e21 ('
     + DANGER.n + ')');

const PANEL0 = await page.evaluate(() => rtExpScan().reduce((s,x) => s + x.agents.length, 0));

/* ── 2 · เก็บราคา "ก่อน" ของทุกเจ้าที่จะโดนตั้ง ──────────────────────────── */
const SNAP = await page.evaluate(() => {
  const ids = [];
  rtExpScan().forEach(x => { const p = rtExpBulkPlan(x.rt.id);
    if (p) p.groups.forEach(g => g.ags.forEach(a => ids.push({ id:a.id, split:g.split }))); });
  const probe = (aid, date) => {
    const r = laMainRtFor(aid, date); return r ? r.id : null;
  };
  // วันก่อนวันแบ่ง · วันนี้ · และวันก่อนหน้านั้นอีกเดือน
  return ids.map(x => {
    const dayBefore = (function(d){ const p=d.split('-');
      const t=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])); t.setUTCDate(t.getUTCDate()-1);
      return t.toISOString().slice(0,10); })(x.split);
    return { id:x.id, split:x.split, dayBefore,
             before: { today: probe(x.id, TODAY_STR), dayBefore: probe(x.id, dayBefore) },
             onSplit: probe(x.id, x.split) };
  });
});

/* ── 3 · กดตั้งจริงทุกชุด แล้วราคาก่อนวันแบ่งห้ามขยับ ──────────────────── */
const R = await page.evaluate(() => {
  const rts = rtExpScan().map(x => x.rt.id);
  let n = 0;
  rts.forEach(id => { const p = rtExpBulkPlan(id); if (!p || !p.total) return;
    _rtExpBulkRt = id; rtExpBulkApply(); n += p.total; });
  return { applied: n };
});
const AFTER = await page.evaluate(snap => snap.map(x => {
  const probe = (aid, date) => { const r = laMainRtFor(aid, date); return r ? r.id : null; };
  return { id:x.id, today: probe(x.id, TODAY_STR), dayBefore: probe(x.id, x.dayBefore),
           onSplit: probe(x.id, x.split) };
}), SNAP);

const movedToday = SNAP.filter((x,i) => AFTER[i].today !== x.before.today);
const movedBefore = SNAP.filter((x,i) => AFTER[i].dayBefore !== x.before.dayBefore);
if (movedToday.length)
  fail('ราคาของวันนี้ขยับ ' + movedToday.length + ' เจ้า · '
     + 'กล่องนี้สัญญาไว้ว่าก่อนวันแบ่งไม่ขยับสักบาท');
else ok('ราคาวันนี้ไม่ขยับสักเจ้า (' + SNAP.length + ' เจ้า)');
if (movedBefore.length)
  fail('ราคาวันก่อนวันแบ่งขยับ ' + movedBefore.length + ' เจ้า');
else ok('ราคาวันก่อนวันแบ่งไม่ขยับสักเจ้า');

const switched = SNAP.filter((x,i) => AFTER[i].onSplit !== x.before.dayBefore);
if (switched.length !== SNAP.length)
  fail('ตั้งแล้วแต่วันแบ่งยังไม่สลับ ' + (SNAP.length - switched.length) + ' เจ้า');
else ok('ทุกเจ้าสลับเรทตั้งแต่วันแบ่ง · ' + SNAP.length + ' เจ้า');
if (R.applied !== SNAP.length) warn('จำนวนที่ตั้ง ' + R.applied + ' ไม่เท่าแผน ' + SNAP.length);

/* ── 4 · กดซ้ำต้องไม่ทำอะไรเพิ่ม · และไม่ทับของที่ตั้งเอง ───────────────── */
const twice = await page.evaluate(() => {
  const before = (SB_AGENTS||[]).filter(a => laSeasonsOf(a).length).length;
  rtExpScan().forEach(x => { const p = rtExpBulkPlan(x.rt.id);
    if (p && p.total) { _rtExpBulkRt = x.rt.id; rtExpBulkApply(); } });
  return { before, after: (SB_AGENTS||[]).filter(a => laSeasonsOf(a).length).length,
           stillPlanned: rtExpScan().reduce((s,x) => { const p = rtExpBulkPlan(x.rt.id);
             return s + (p ? p.total : 0); }, 0) };
});
if (twice.after !== twice.before) fail('กดซ้ำแล้วจำนวนเปลี่ยน · ' + twice.before + ' → ' + twice.after);
else ok('กดซ้ำไม่เพิ่มอะไร · ' + twice.after + ' เจ้าเท่าเดิม');
if (twice.stillPlanned) fail('ตั้งไปแล้วแต่แผนยังเหลือ ' + twice.stillPlanned + ' · ไม่ idempotent');
else ok('ตั้งครบแล้วแผนว่าง · ไม่มีอะไรค้าง');

/* ── 5 · แผงเตือนต้องเบาลงตามจำนวนที่ตั้งไป ───────────────────────────── */
/* ต้องลดลง "เท่าจำนวนที่ตั้งไป" เป๊ะ · ลดน้อยกว่านั้นแปลว่าตัวกรองของแผงตกหล่นบางเจ้า
   (รอบแรกเป็นแบบนั้นจริง · เกณฑ์ใช้ from > validTo ซึ่งพลาดกลุ่มที่ฤดูใหม่เริ่มวันเดียวกับวันหมด) */
const panel = await page.evaluate(() => rtExpScan().reduce((s,x) => s + x.agents.length, 0));
const want = PANEL0 - SNAP.length;
if (panel !== want)
  fail('แผงเตือนควรเหลือ ' + want + ' (' + PANEL0 + ' − ' + SNAP.length
     + ') แต่เหลือ ' + panel + ' · ตัวกรองของแผงตกหล่นบางเจ้า');
else ok('แผงเตือน ' + PANEL0 + ' → ' + panel + ' · ลดเท่าจำนวนที่ตั้งไปเป๊ะ');

/* ── 6 · ตารางที่ตั้งให้ต้องไม่มีข้อทัก ─────────────────────────────────── */
const issues = await page.evaluate(() => {
  const bad = [];
  (SB_AGENTS||[]).forEach(a => { if(!laSeasonsOf(a).length) return;
    const is = laSeasonIssues(a); if (is.length) bad.push(a.code + ': ' + is[0]); });
  return bad;
});
if (issues.length) fail('ตารางที่ตั้งให้มีข้อทัก ' + issues.length + ' เจ้า · ' + issues[0]);
else ok('ตารางที่ตั้งให้ผ่านตัวตรวจทุกเจ้า');

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
