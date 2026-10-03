// §rtExpiry · แผงเตือน "เรทกำลังจะหมดอายุ" ต้องนับจากสิ่งที่ระบบใช้คิดเงินจริง
//
// ที่มา · validTo ของ Rate Type ไม่ได้กั้นการคิดเงิน (ตั้งใจ ดู §promoMx) พอถึงวันหมด
// ระบบยังคิดราคาชุดเดิมต่อโดยไม่บอกอะไร · แผงนี้ทำหน้าที่บอกอย่างเดียว ไม่แตะการคิดเงิน
//
// ⚠ กับดักของชุดข้อมูล · การผูก Agent→Rate Type ถูกเก็บสองที่
//   sb_agents[].rateTypeId  และ  sb_agents_rate_bindings (sidecar)
//   ตอนโหลด sidecar เขียนทับเสมอ · subset ที่ตัด sidecar ทิ้งจะให้ตัวเลขคนละชุดกับของจริง
//   เทสนี้จึงเช็คก่อนว่าสองที่ตรงกันไหม แล้วยืนยันว่าแผงอ่านฝั่งที่ระบบใช้จริง
import { open } from './_harness.mjs';
import fs from 'node:fs';

const BLOB = process.env.LAD;
let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };
const warn = m => console.log('  ! ' + m);

const { page, errors, close } = await open({ blob: BLOB, width: 1500, height: 1200 });
await page.click('.nav-item[data-view="rate-types"]');
await page.waitForTimeout(1000);

const R = await page.evaluate(() => {
  const o = {};
  o.today = TODAY_STR;
  o.fnOk = ['rtExpScan','rtExpRowFor','rtExpForAgent','rtExpDaysTo','rtExpNextOf','rtExpRender']
             .every(f => typeof window[f] === 'function');
  // ตัวนับของแผง
  const rows = rtExpScan();
  o.rows = rows.map(x => ({ id:x.rt.id, name:(x.rt.name||'').trim(), to:x.to, days:x.days,
                            ag:x.agents.length, blocked:Object.keys(x.blocked).length }));
  o.agents = rows.reduce((a,x) => a + x.agents.length, 0);
  // นับซ้ำจาก SB_AGENTS ตรง ๆ · ต้องได้เท่ากันเป๊ะ ไม่งั้นแผงอ่านคนละชุดกับที่ผูกไว้จริง
  let raw = 0;
  (SB_AGENTS||[]).forEach(a => {
    const rt = getRateType(a.rateTypeId); if(!rt || rt.active === false) return;
    const d = rtExpDaysTo(rt.validTo || ''); if(d === null || d > 60) return;
    raw++;
  });
  o.raw = raw;
  // วันหมดอายุห้ามกั้นการคิดเงิน · เรทที่หมดแล้วต้องยังให้ราคาอยู่
  const past = (SB_RATE_TYPES||[]).filter(r => r.validTo && rtExpDaysTo(r.validTo) < 0
                                            && r.seatRates && Object.keys(r.seatRates).length);
  o.pastN = past.length;
  o.pastStillPrices = past.filter(r => {
    const rid = Object.keys(r.seatRates)[0], z = r.seatRates[rid];
    return Object.keys(z||{}).some(k => (z[k]||{})['adult-fr'] > 0);
  }).length;
  // ลำดับ · ใกล้หมดที่สุดต้องมาก่อน
  o.sorted = o.rows.every((x,i) => i===0 || o.rows[i-1].days <= x.days);
  /* เรทที่หมดอายุไปแล้วต้องยังถูกเตือน · ไม่ใช่หายไปจากแผงเพราะ "เลยมาแล้ว"
     ชุดข้อมูลอาจไม่มีเคสนี้ จึงยิงเข้า rtExpRowFor ตรง ๆ ด้วยเรทสมมติที่หมดไปแล้ว
     (ไม่แตะ SB_RATE_TYPES · rtExpRowFor อ่าน id ไปหาเอเย่นต์เท่านั้น) */
  const withAg = (SB_RATE_TYPES||[]).filter(r => rtExpAgentsOn(r.id).length)[0];
  o.pastRow = withAg
    ? !!rtExpRowFor({ id:withAg.id, name:'(past)', active:true, validTo:'2026-01-01', seatRates:{} })
    : null;
  // DOM
  /* §rtAdmin · แผงเต็มย้ายไปหน้า Rate Type Management แล้ว
     หน้า Rate Types เหลือแถบบรรทัดเดียว · ข้อความเต็มจึงต้องอ่านจากหน้าใหม่ */
  let host = document.getElementById('rta-exp');
  if (host && !host.innerHTML && typeof rtExpRender === 'function') rtExpRender('rta-exp');
  host = document.getElementById('rta-exp');
  o.dom = host ? host.innerHTML.length : -1;
  o.domTxt = host ? host.innerText : '';
  // แถวเดียวของเอเย่นต์ · ต้องพูดวันเดียวกับแผง
  const a13 = (SB_AGENTS||[]).filter(a => a.id === 'a13')[0] || null;
  o.a13 = a13 ? (function(){ const X = rtExpForAgent(a13);
    return X ? { to:X.to, days:X.days, blocked:X.blocked.length, next:X.next } : null; })() : null;
  const r13 = rows.filter(x => a13 && x.rt.id === a13.rateTypeId)[0];
  o.a13panel = r13 ? { to:r13.to, days:r13.days } : null;
  return o;
});

console.log('Rate expiry · ' + R.today);

if (!R.fnOk) fail('ฟังก์ชัน §rtExpiry ไม่ครบ');
else ok('ฟังก์ชัน §rtExpiry ครบ');

/* ── ชุดข้อมูลต้องมีของให้ตรวจ ───────────────────────────────────────────── */
if (!R.rows.length) fail('ไม่มีเรทใกล้หมดอายุเลย · subset นี้ตรวจอะไรไม่ได้ (ต้องมี sb_rate_types + sb_agents + sb_agents_rate_bindings)');
else ok('เจอเรทใกล้หมด ' + R.rows.length + ' ชุด · ' + R.agents + ' เอเย่นต์');

/* ── แผงต้องนับจากชุดเดียวกับที่ผูกไว้จริง ──────────────────────────────── */
if (R.agents !== R.raw)
  fail('แผงนับได้ ' + R.agents + ' แต่นับจาก SB_AGENTS ตรง ๆ ได้ ' + R.raw + ' · อ่านคนละชุดกัน');
else ok('แผงนับตรงกับ SB_AGENTS · ' + R.agents + ' เอเย่นต์');

/* ── sidecar ต้องเป็นตัวที่ชนะ ─────────────────────────────────────────── */
if (BLOB && fs.existsSync(BLOB)) {
  const raw = JSON.parse(fs.readFileSync(BLOB, 'utf8'));
  const side = raw.sb_agents_rate_bindings;
  if (!Array.isArray(side)) warn('subset นี้ไม่มี sb_agents_rate_bindings · ข้อนี้ข้าม');
  else {
    const map = {}; side.forEach(b => map[b.id] = b.rateTypeId || '');
    const inPage = await page.evaluate(() => SB_AGENTS.map(a => [a.id, a.rateTypeId || '']));
    const wrong = inPage.filter(([id, rt]) => map.hasOwnProperty(id) && map[id] !== rt);
    if (wrong.length) fail('sidecar ไม่ได้เขียนทับ ' + wrong.length + ' เอเย่นต์ · แผงจะนับจากค่าเก่า');
    else ok('sidecar sb_agents_rate_bindings เขียนทับครบ · แผงอ่านการผูกที่ระบบใช้จริง');
  }
}

/* ── หมดอายุแล้วต้องยังคิดราคาได้ · แผงนี้ห้ามกลายเป็นประตูกั้น ────────── */
if (R.pastN && R.pastStillPrices !== R.pastN)
  fail('เรทที่หมดอายุแล้ว ' + R.pastN + ' ชุด แต่ให้ราคาได้ ' + R.pastStillPrices + ' · วันหมดอายุกลายเป็นประตูกั้น');
else ok('เรทที่หมดอายุแล้วยังให้ราคาได้ตามเดิม (' + R.pastN + ' ชุด) · แผงเตือนอย่างเดียว');

/* ── ลำดับและการวาด ──────────────────────────────────────────────────── */
if (R.pastRow === false)
  fail('\u0e40\u0e23\u0e17\u0e17\u0e35\u0e48\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27\u0e2b\u0e32\u0e22\u0e08\u0e32\u0e01\u0e41\u0e1c\u0e07 \u00b7 \u0e01\u0e25\u0e32\u0e22\u0e40\u0e1b\u0e47\u0e19\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e25\u0e48\u0e27\u0e07\u0e2b\u0e19\u0e49\u0e32\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e40\u0e14\u0e35\u0e22\u0e27 \u2014 \u0e17\u0e35\u0e48\u0e2b\u0e21\u0e14\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27\u0e04\u0e37\u0e2d\u0e40\u0e04\u0e2a\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e14\u0e31\u0e07\u0e17\u0e35\u0e48\u0e2a\u0e38\u0e14');
else if (R.pastRow === null) warn('subset \u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e2d\u0e40\u0e22\u0e48\u0e19\u0e15\u0e4c\u0e1c\u0e39\u0e01\u0e40\u0e23\u0e17\u0e44\u0e27\u0e49\u0e40\u0e25\u0e22 \u00b7 \u0e02\u0e49\u0e32\u0e21\u0e02\u0e49\u0e2d\u0e40\u0e23\u0e17\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38');
else ok('\u0e40\u0e23\u0e17\u0e17\u0e35\u0e48\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38\u0e44\u0e1b\u0e41\u0e25\u0e49\u0e27\u0e22\u0e31\u0e07\u0e04\u0e07\u0e2d\u0e22\u0e39\u0e48\u0e1a\u0e19\u0e41\u0e1c\u0e07');

if (!R.sorted) fail('แถวไม่ได้เรียงตามความใกล้หมด');
else ok('เรียงใกล้หมดก่อน · อันแรกอีก ' + R.rows[0].days + ' วัน');

if (R.dom <= 0) fail('แผงไม่ถูกวาดลงหน้า Rate Type Management (#rta-exp ว่าง)');
else ok('แผงวาดลงหน้า Rate Type Management แล้ว');

if (R.domTxt.indexOf(String(R.agents)) < 0)
  fail('หัวแผงไม่ขึ้นจำนวนเอเย่นต์ ' + R.agents);
else ok('หัวแผงขึ้น ' + R.rows.length + ' ชุด · ' + R.agents + ' เอเย่นต์');

if (R.domTxt.indexOf('ไม่ได้กั้นการคิดเงิน') < 0)
  fail('แผงไม่ได้บอกว่าวันหมดอายุไม่ได้กั้นการคิดเงิน — จุดที่คนเข้าใจผิดมาตลอด');
else ok('แผงบอกชัดว่าวันหมดไม่ได้กั้นการคิดเงิน');

/* ── §rtAdmin · แผงเต็มอยู่หน้าของตัวเอง · หน้า Rate Types เหลือบรรทัดเดียว ────
   หน้า Rate Types มีไว้ทำเรท · แผงเตือนเคยสูงเป็นร้อย px ดันรายการเรทตกจอ
   ข้อนี้กันไม่ให้มันไหลกลับมา */
const L = await page.evaluate(async () => {
  const o = {};
  const band = document.getElementById('rt-expiry');
  o.banner = band ? Math.round(band.getBoundingClientRect().height) : -1;
  o.bannerLinks = !!(band && /rate-admin|rtAdminGo/.test(band.innerHTML));
  const navEl = document.querySelector('.nav-item[data-view="rate-admin"]');
  o.hasNav = !!navEl;
  if (navEl) nav(navEl);
  await new Promise(r => setTimeout(r, 400));
  const v = document.getElementById('view-rate-admin');
  o.viewActive = !!(v && v.classList.contains('active'));
  o.how = (document.getElementById('rta-how') || {}).innerHTML ? 1 : 0;
  const exp = document.getElementById('rta-exp');
  o.fullRows = exp ? (exp.innerText.match(/เอเย่นต์/g) || []).length : 0;
  return o;
});
if (!L.hasNav) fail('\u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e21\u0e19\u0e39 Rate Type Management');
else if (!L.viewActive) fail('\u0e01\u0e14\u0e40\u0e21\u0e19\u0e39\u0e41\u0e25\u0e49\u0e27\u0e2b\u0e19\u0e49\u0e32\u0e44\u0e21\u0e48\u0e40\u0e1b\u0e34\u0e14');
else ok('\u0e21\u0e35\u0e2b\u0e19\u0e49\u0e32 Rate Type Management \u0e41\u0e22\u0e01\u0e2d\u0e2d\u0e01\u0e21\u0e32\u0e41\u0e25\u0e49\u0e27');
if (!L.how) fail('\u0e2b\u0e19\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e31\u0e49\u0e19\u0e15\u0e2d\u0e19\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49');
else ok('\u0e2b\u0e19\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48\u0e21\u0e35\u0e02\u0e31\u0e49\u0e19\u0e15\u0e2d\u0e19\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e1a\u0e19\u0e2b\u0e19\u0e49\u0e32');
if (!L.fullRows) fail('\u0e41\u0e1c\u0e07\u0e40\u0e15\u0e47\u0e21\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e22\u0e49\u0e32\u0e22\u0e21\u0e32\u0e2b\u0e19\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48');
else ok('\u0e41\u0e1c\u0e07\u0e40\u0e15\u0e47\u0e21\u0e2d\u0e22\u0e39\u0e48\u0e2b\u0e19\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48 \u00b7 ' + L.fullRows + ' \u0e41\u0e16\u0e27');
if (L.banner < 0) fail('\u0e2b\u0e19\u0e49\u0e32 Rate Types \u0e44\u0e21\u0e48\u0e21\u0e35\u0e17\u0e35\u0e48\u0e27\u0e32\u0e07\u0e41\u0e16\u0e1a');
else if (L.banner > 80)
  fail('\u0e41\u0e16\u0e1a\u0e1a\u0e19\u0e2b\u0e19\u0e49\u0e32 Rate Types \u0e2a\u0e39\u0e07 ' + L.banner + 'px \u00b7 \u0e04\u0e27\u0e23\u0e40\u0e1b\u0e47\u0e19\u0e1a\u0e23\u0e23\u0e17\u0e31\u0e14\u0e40\u0e14\u0e35\u0e22\u0e27 \u0e44\u0e21\u0e48\u0e43\u0e0a\u0e48\u0e41\u0e1c\u0e07\u0e40\u0e15\u0e47\u0e21');
else ok('\u0e2b\u0e19\u0e49\u0e32 Rate Types \u0e40\u0e2b\u0e25\u0e37\u0e2d\u0e41\u0e16\u0e1a\u0e2a\u0e39\u0e07 ' + L.banner + 'px');
if (!L.bannerLinks) fail('\u0e41\u0e16\u0e1a\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e1e\u0e32\u0e44\u0e1b\u0e2b\u0e19\u0e49\u0e32\u0e23\u0e27\u0e21');
else ok('\u0e41\u0e16\u0e1a\u0e01\u0e14\u0e41\u0e25\u0e49\u0e27\u0e44\u0e1b\u0e2b\u0e19\u0e49\u0e32\u0e23\u0e27\u0e21\u0e44\u0e14\u0e49');

/* ── ที่ว่างเหนือตารางราคาในหน้า Agent ────────────────────────────────────
   วัดจากของที่หน้าวาดจริง (agTabPrices) ไม่ใช่เรียกฟังก์ชันแถบตรง ๆ
   ไม่งั้นถ้าวันไหนมีคนถอดแถบออกแล้วเอากล่องใหญ่กลับมาเสียบ เทสจะไม่รู้เรื่อง
   หน้านี้ชื่อ Pricing Matrix · ตารางราคาต้องอยู่ในระยะที่เลื่อนถึงได้ไว */
const ST = await page.evaluate(ag => {
  const a = (SB_AGENTS||[]).filter(x => x.id === ag)[0];
  if (!a) return null;
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-9999px;top:0;width:1100px';
  box.innerHTML = agTabPrices(a);
  document.body.appendChild(box);
  const top = box.getBoundingClientRect().top;
  const seat = [...box.querySelectorAll('*')]
    .filter(n => /Seat rates/.test(n.textContent || '') && n.children.length < 6)[0];
  const toSeat = seat ? Math.round(seat.getBoundingClientRect().top - top) : -1;
  const usesStrip = /agSwitchTab\('ratemgmt'/.test(box.innerHTML);
  box.remove();
  return { toSeat, usesStrip };
}, 'a13');
if (!ST) warn('subset \u0e19\u0e35\u0e49\u0e44\u0e21\u0e48\u0e21\u0e35 a13 \u00b7 \u0e02\u0e49\u0e32\u0e21\u0e02\u0e49\u0e2d\u0e19\u0e35\u0e49');
else if (ST.toSeat < 0) fail('\u0e2b\u0e32\u0e2b\u0e31\u0e27\u0e15\u0e32\u0e23\u0e32\u0e07 Seat rates \u0e44\u0e21\u0e48\u0e40\u0e08\u0e2d');
else if (ST.toSeat > 680)
  fail('\u0e01\u0e27\u0e48\u0e32\u0e08\u0e30\u0e16\u0e36\u0e07\u0e15\u0e32\u0e23\u0e32\u0e07\u0e23\u0e32\u0e04\u0e32\u0e15\u0e49\u0e2d\u0e07\u0e1c\u0e48\u0e32\u0e19 ' + ST.toSeat + 'px \u00b7 \u0e02\u0e2d\u0e07\u0e02\u0e49\u0e32\u0e07\u0e1a\u0e19\u0e01\u0e34\u0e19\u0e17\u0e35\u0e48\u0e40\u0e01\u0e34\u0e19\u0e44\u0e1b');
else ok('\u0e15\u0e32\u0e23\u0e32\u0e07\u0e23\u0e32\u0e04\u0e32\u0e40\u0e23\u0e34\u0e48\u0e21\u0e17\u0e35\u0e48 ' + ST.toSeat + 'px \u0e08\u0e32\u0e01\u0e2b\u0e31\u0e27\u0e2b\u0e19\u0e49\u0e32');
if (ST && !ST.usesStrip) fail('Pricing Matrix ไม่มีบรรทัดชี้ไปแท็บ Rate Type');
else if (ST) ok('Pricing Matrix มีบรรทัดชี้ไปแท็บ Rate Type');

/* ── §rtTab · งานจัดการเรทอยู่ที่แท็บ Rate Type · ไม่ใช่ที่ Pricing Matrix ──
   ตัวแก้ตารางฤดูกาลต้องอยู่ในแท็บ และอยู่ในหน้าเลย (ไม่ใช่ป๊อปอัป บังของที่กำลังตัดสินใจ)
   และของเดิมแบบป๊อปอัปต้องถูกถอดออกจริง · มีตัวแก้สองตัวสำหรับของชิ้นเดียว
   คือทางที่สองตัวจะค่อย ๆ ต่างกันจนพูดคนละเรื่อง */
const TB = await page.evaluate(ag => {
  const a = (SB_AGENTS||[]).filter(x => x.id === ag)[0];
  if (!a) return null;
  rtmInit(a.id);
  const empty = agTabRate(a);
  rtmFillFromContract();
  const filled = agTabRate(a);
  const draft = (_rtmDraft||[]).length;
  const mx = agTabPrices(a);
  rtmInit(a.id);                                        // คืนสภาพ ไม่ทิ้งร่างค้าง
  return {
    tabExists: typeof agTabRate === 'function',
    inlineEditor: /rtmSet\(/.test(filled),
    saveBtn: /rtmSave\(/.test(filled),
    suggestBtn: /rtmFillFromContract\(/.test(empty),
    preview: filled.indexOf('วันไหนใช้ชุดไหน') >= 0,
    draft,
    mxLeftovers: /rtmSet\(|rtmSave\(|rtSeasonOpen/.test(mx),
    deadGone: (typeof window.rtSeasonOpen === 'undefined'
            && typeof window.rtAgentRateStrip === 'undefined')
  };
}, 'a13');
if (!TB) warn('subset นี้ไม่มี a13 · ข้ามข้อแท็บ');
else {
  if (!TB.tabExists) fail('ไม่มีแท็บ Rate Type');
  else ok('มีแท็บ Rate Type ของเอเย่นต์');
  if (!TB.inlineEditor || !TB.saveBtn) fail('ตัวแก้ตารางไม่ได้อยู่ในแท็บ');
  else ok('ตัวแก้ตารางอยู่ในหน้า · ไม่ต้องเปิดป๊อปอัป');
  if (!TB.suggestBtn) fail('ไม่มีปุ่ม เติมจากสัญญา ทั้งที่สัญญาระบุตัวถัดไปไว้');
  else ok('มีปุ่มเติมจากสัญญา');
  if (TB.draft !== 2) fail('กดเติมจากสัญญาแล้วได้ ' + TB.draft + ' ช่วง · ควรได้ 2');
  else ok('กดเติมจากสัญญา → ได้ 2 ช่วงทันที');
  if (!TB.preview) fail('แท็บไม่มีส่วนสรุป วันไหนใช้ชุดไหน');
  else ok('แท็บสรุปให้ด้วยว่าวันไหนใช้ชุดไหน');
  if (TB.mxLeftovers) fail('Pricing Matrix ยังมีของให้ตั้งหลงเหลือ');
  else ok('Pricing Matrix ไม่มีของให้ตั้งหลงเหลือแล้ว');
  if (!TB.deadGone) fail('ตัวแก้แบบป๊อปอัปยังอยู่ · มีตัวแก้สองตัวสำหรับของชิ้นเดียว');
  else ok('ตัวแก้แบบป๊อปอัปถูกถอดออกแล้ว · เหลือตัวแก้ตัวเดียว');
}

/* ── สองที่ต้องพูดเลขเดียวกัน ────────────────────────────────────────── */
if (R.a13 && R.a13panel) {
  if (R.a13.to !== R.a13panel.to || R.a13.days !== R.a13panel.days)
    fail('แถวของ SAYAMA ใน Pricing Matrix (' + R.a13.to + '/' + R.a13.days
       + ') ไม่ตรงกับแผง (' + R.a13panel.to + '/' + R.a13panel.days + ')');
  else ok('SAYAMA · แถวใน Pricing Matrix กับแผงพูดตรงกัน · หมด ' + R.a13.to + ' · อีก ' + R.a13.days + ' วัน');
  if (!R.a13.blocked) warn('SAYAMA ไม่มีโปรแกรมที่จะจองไม่ได้ใน subset นี้');
  else ok('SAYAMA · โปรแกรมที่จะจองไม่ได้ ' + R.a13.blocked + ' รายการ');
  if (!R.a13.next) warn('SAYAMA · สัญญาไม่ได้ระบุตัวถัดไปใน subset นี้');
  else ok('SAYAMA · สัญญาระบุตัวถัดไปไว้แล้ว');
} else warn('subset นี้ไม่มี SAYAMA (a13) · ข้ามข้อเทียบสองที่');

if (errors.length) { bad += errors.length; errors.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
