// §pjDone + §pjWbCarry · ใบงานเรือ · "จัดไม่เสร็จ กดจัดเสร็จไม่ได้" + สีสายรัดต่อจากวันก่อน
//
// ที่มา (2026-09-23) · ปุ่ม "จัดเสร็จแล้ว" คือคำสัญญาว่าใบนี้พร้อม หน้าอื่นอ่านต่อจากตรงนี้
//   ของเดิมกดได้ตลอดแม้ใบยังว่างทั้งใบ · ปิดไปแล้วไม่มีใครกลับมาดูอีก
//   และใบวันใหม่ว่างสีสายรัดทุกวัน ทั้งที่สายรัดซื้อเป็นล็อต ใช้สีเดิมติดกันหลายวัน
//
// เทสนี้กันเก้าอย่าง
//   1 ใบว่างต้องไม่มีปุ่ม "จัดเสร็จแล้ว" ให้กด
//   2 ต้องบอกว่าขาดอะไรบ้าง ครบทุกข้อที่ขาดจริง
//   3 เติมทีละอย่างแล้วรายการต้องหดตาม
//   4 ครบแล้วปุ่มต้องกลับมา และกดแล้วล็อกจริง
//   5 เรียก pjLockSet ตรง ๆ ตอนยังไม่ครบ ต้องไม่ล็อก (ด่านชั้นสอง)
//   6 เปิดใบวันถัดไป ต้องได้สีสายรัดของลำนั้นจากวันล่าสุดมาเอง
//   7 สีที่สืบมาต้องนับว่า "เลือกแล้ว" · หายจากรายการที่ขาด
//   8 สืบมาแล้วต้องไม่เขียนลงใบวันใหม่ · ไม่งั้นใบเปล่ากลายเป็นใบที่ถูกแตะ
//     แล้วตัวกรอง "ซ่อนลำที่ยังไม่ได้วาง" จะมองไม่เห็นใบเปล่าอีกเลย
//   9 สีเป็นของ "ลำ" ไม่ใช่ของ "วัน" · ลำอื่นต้องไม่ได้สีนั้นติดไปด้วย
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1600, height: 1100 });
page.on('dialog', d => d.accept());
await page.waitForTimeout(900);

/* วันไกล ๆ ที่ยังไม่มีใครแตะ · จะได้ไม่ไปชนของจริงและไม่มีสีเก่าค้างมาก่อน */
const D1 = '2027-03-15', D2 = '2027-03-16';

const S = await page.evaluate(D => {
  const tryPier = pier => {
    const mine = (BOATS || []).filter(x => (x.pier || '') === pier);
    const rt = (ROUTES || []).find(r => (r.pier || '') === pier) || (ROUTES || [])[0];
    if (!mine.length || !rt) return null;
    TRIPS[D] = TRIPS[D] || {};
    mine.forEach(b => { if (!TRIPS[D][b.id]) TRIPS[D][b.id] = { route: rt.id, type:'normal', booked:0 }; });
    _poDate = D; _poPier = pier;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById('view-poj-' + pier);
    if (v) v.classList.add('active');
    renderPierJob(pier);
    const sw = document.querySelector('.pj-pop[id^="pjwb-"] .pj-sw[onclick]');
    const m = sw ? /pjWbSet\('([^']+)'/.exec(sw.getAttribute('onclick') || '') : null;
    if (!m) return null;
    /* ลำที่สองของท่าเดียวกัน · ใช้พิสูจน์ว่าสีไม่ข้ามลำ */
    const all = [].slice.call(document.querySelectorAll('.pj-pop[id^="pjwb-"] .pj-sw[onclick]'))
      .map(e => (/pjWbSet\('([^']+)'/.exec(e.getAttribute('onclick') || '') || [])[1])
      .filter(Boolean);
    return { bid:m[1], other:[...new Set(all)].filter(x => x !== m[1])[0] || '', pier,
             rid: rt.id, mealOnRoute: !!(rt && rt.mealVenueId) };
  };
  let got = null;
  for (const p of (PO_PIERS || []).map(x => x.k)){ got = tryPier(p); if (got) break; }
  return Object.assign({ bid:'', other:'', pier:'', rid:'', mealOnRoute:false,
    canEdit:(typeof poCanEdit === 'function') ? poCanEdit() : null }, got || {});
}, D1);

if (!S.canEdit){ console.log('  ! ผู้ใช้ชุดนี้แก้ไม่ได้ · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0'); await close(); process.exit(0); }
if (!S.bid){ console.log('  ! วันนั้นไม่มีลำที่วิ่ง · ข้ามเทสทั้งไฟล์'); console.log('\nพัง 0'); await close(); process.exit(0); }
console.log('ปลูกเคส · ' + D1 + ' ท่า ' + S.pier + ' · ลำหลัก ' + S.bid + (S.other ? (' · ลำเทียบ ' + S.other) : ''));

const safe = b => 'pjwb-' + b.replace(/[^A-Za-z0-9_-]/g, '_');

/* อ่านจาก DOM ของการ์ดลำนั้น · ไม่ถามฟังก์ชันของหน้าเอง */
const card = (b = S.bid) => page.evaluate(id => {
  const p = document.getElementById(id);
  const bc = p && p.closest('.bc');
  if (!bc) return { err:'ไม่พบการ์ด' };
  const lb = bc.querySelector('.pj-lb');
  const need = bc.querySelector('.pj-need');
  return {
    btn: lb ? lb.tagName.toLowerCase() : '',
    btnTxt: lb ? (lb.textContent || '').trim() : '',
    clickable: !!(lb && lb.tagName.toLowerCase() === 'button'),
    miss: need ? [].slice.call(need.querySelectorAll('b')).map(x => (x.textContent || '').trim()) : [],
    wbTxt: (bc.querySelector('.pj-wb') ? (bc.querySelector('.pj-wb').childNodes[1] || {}).textContent : '') || '',
    from: bc.querySelector('.pj-wbfrom') ? (bc.querySelector('.pj-wbfrom').textContent || '').trim() : ''
  };
}, safe(b));

const reRender = () => page.evaluate(() => { renderPierJob(_poPier); });
const setDate = d => page.evaluate(dd => { _poDate = dd; renderPierJob(_poPier); }, d);

/* ── ล้างใบให้ว่างจริง ────────────────────────────────────────────────── */
await page.evaluate(a => {
  pjSet(a.d, a.b, { cap:'', asst:'', crew:[], island:[], wb:'', wbc:'', mv:'-' });
  if (typeof goAsnSet === 'function') goAsnSet(a.d, a.b, { g:[], other:0 });
  renderPierJob(_poPier);
}, { d:D1, b:S.bid });
await page.waitForTimeout(400);

/* ══ 1 · ใบว่าง · ต้องไม่มีปุ่มให้กด ═══════════════════════════════════════ */
let C = await card();
if (C.err) fail(C.err);
else if (C.clickable) fail('ใบยังว่าง แต่ยังมีปุ่ม "' + C.btnTxt + '" ให้กดปิดใบได้');
else ok('ใบว่าง · ไม่มีปุ่มให้กด · ขึ้น "' + C.btnTxt + '" แทน');

/* ══ 2 · ต้องบอกว่าขาดอะไร ครบทุกข้อ ══════════════════════════════════════
   ร้านอาหารนับเป็น "ขาด" เฉพาะเมื่อไม่มีค่าเริ่มต้นจากเส้นทางและถูกล้างทิ้งแล้ว */
const WANT = ['กัปตัน', 'สีสายรัดข้อมือ', 'ไกด์', 'ร้านอาหาร'];
if (!C.err){
  const miss = C.miss;
  const lack = WANT.filter(x => miss.indexOf(x) < 0);
  const extra = miss.filter(x => WANT.indexOf(x) < 0);
  if (lack.length) fail('ไม่ได้บอกว่าขาด ' + lack.join(' · ') + ' (บอกมาแค่ ' + (miss.join(' · ') || '—') + ')');
  else if (extra.length) fail('บอกเกินมา ' + extra.join(' · '));
  else ok('บอกครบว่าขาด ' + miss.join(' · '));
}

/* ══ 3 · เติมทีละอย่าง · รายการต้องหดตาม ══════════════════════════════════ */
if (!C.err){
  /* ร้านอาหารต้องเป็นร้านที่มีอยู่จริงในทะเบียน · ตั้ง mv:'' เฉย ๆ ได้แค่ค่าเริ่มต้น
     ของเส้นทาง ซึ่งชุดข้อมูลทดสอบบางชุดไม่มี */
  const venue = await page.evaluate(() => {
    try{
      let L = (typeof mvList === 'function') ? mvList() : [];
      if (!L.length && typeof MEAL_VENUES !== 'undefined' && Array.isArray(MEAL_VENUES)){
        /* ชุดข้อมูลทดสอบบางชุดไม่มีทะเบียนร้าน · ปลูกร้านทดสอบเอง
           เหมือนที่ปลูก TRIPS · ไม่งั้นข้อนี้วัดอะไรไม่ได้เลย */
        MEAL_VENUES.push({ id:'zz_test_mv', name:'ร้านทดสอบ', active:true });
        L = mvList();
      }
      return L.length ? L[0].id : '';
    }catch(_){ return ''; }
  });
  const steps = [
    ['กัปตัน',         0],
    ['ไกด์',           1],
    ['ร้านอาหาร',      2],
    ['สีสายรัดข้อมือ', 3]
  ];
  let okAll = true, log = [];
  for (const [label, i] of steps){
    if (label === 'ร้านอาหาร' && !venue){ fail('ปลูกร้านทดสอบไม่สำเร็จ · ข้อนี้วัดไม่ได้'); okAll = false; break; }
    await page.evaluate(a => {
      if (a.i === 0) pjSet(a.d, a.b, { cap:'zz_test_cap' });
      else if (a.i === 1){ if (typeof goAsnSet === 'function') goAsnSet(a.d, a.b, { g:[], other:1 }); }
      else if (a.i === 2) pjSet(a.d, a.b, { mv:a.v });
      else pjSet(a.d, a.b, { wb:'ม่วง', wbc:'#8E2FD6' });
      renderPierJob(_poPier);
    }, { d:D1, b:S.bid, i, v:venue });
    await page.waitForTimeout(300);
    const c2 = await card();
    log.push(label + '→' + (c2.miss.length ? c2.miss.join(',') : 'ครบ'));
    if (c2.miss.indexOf(label) >= 0){ okAll = false; fail('เติม "' + label + '" แล้วยังบอกว่าขาดอยู่'); break; }
  }
  if (okAll) ok('เติมทีละอย่าง · รายการหดตามทุกครั้ง · ' + log.join(' | '));
}

/* ══ 4 · ครบแล้ว ปุ่มต้องกลับมา และกดแล้วล็อกจริง ═════════════════════════ */
if (!C.err){
  C = await card();
  if (C.miss.length) fail('เติมครบแล้วแต่ยังบอกว่าขาด ' + C.miss.join(' · '));
  else if (!C.clickable) fail('เติมครบแล้วปุ่ม "จัดเสร็จแล้ว" ยังไม่กลับมา');
  else {
    await page.evaluate(b => pjLockSet(b, 1), S.bid);
    await page.waitForTimeout(400);
    const lk = await page.evaluate(a => !!pjOf(a.d, a.b).lock, { d:D1, b:S.bid });
    if (!lk) fail('กดจัดเสร็จแล้วแต่ใบไม่ถูกล็อก');
    else ok('เติมครบ · ปุ่มกลับมา · กดแล้วล็อกจริง');
  }
}

/* ══ 5 · ด่านชั้นสอง · เรียกตรง ๆ ตอนไม่ครบ ต้องไม่ล็อก ═══════════════════
   ปุ่มบนการ์ดกันไว้แล้ว แต่ของที่เรียกจากที่อื่น (หรือปุ่มเก่าที่ค้างบนจอ) ต้องไม่ทะลุ */
if (!C.err){
  await page.evaluate(a => { pjLockSet(a.b, 0); pjSet(a.d, a.b, { cap:'' }); renderPierJob(_poPier); },
    { d:D1, b:S.bid });
  await page.waitForTimeout(350);
  await page.evaluate(b => pjLockSet(b, 1), S.bid);
  await page.waitForTimeout(350);
  const lk = await page.evaluate(a => !!pjOf(a.d, a.b).lock, { d:D1, b:S.bid });
  if (lk) fail('ขาดกัปตันอยู่ แต่เรียก pjLockSet ตรง ๆ แล้วล็อกผ่าน');
  else ok('ขาดของอยู่ · เรียก pjLockSet ตรง ๆ ก็ไม่ล็อกให้');
  await page.evaluate(a => { pjSet(a.d, a.b, { cap:'zz_test_cap' }); renderPierJob(_poPier); }, { d:D1, b:S.bid });
  await page.waitForTimeout(300);
}

/* ══ 6-9 · สีสายรัดต่อจากวันก่อน ══════════════════════════════════════════ */
{
  /* วัน D1 ตั้งสีม่วงไว้แล้วจากข้อ 3 · เปิดวัน D2 ซึ่งยังไม่มีใครแตะ */
  await page.evaluate(a => {
    TRIPS[a.d2] = TRIPS[a.d2] || {};
    (BOATS || []).filter(x => (x.pier || '') === a.pier).forEach(b => {
      if (!TRIPS[a.d2][b.id]) TRIPS[a.d2][b.id] = { route:a.rid, type:'normal', booked:0 };
    });
  }, { d2:D2, pier:S.pier, rid:S.rid });
  await setDate(D2);
  await page.waitForTimeout(500);

  const c = await card();
  if (c.err) fail(c.err);
  else if (!/ม่วง/.test(c.wbTxt)) fail('เปิดวันถัดไปแล้วไม่ได้สีของเมื่อวานมา · การ์ดขึ้น "' + c.wbTxt.trim() + '"');
  else if (!c.from) fail('ได้สีมาแต่ไม่บอกว่าต่อมาจากวันไหน · ล็อตเปลี่ยนแล้วจะไม่มีใครทันสังเกต');
  else ok('วันถัดไปได้สี "' + c.wbTxt.trim() + '" มาเอง · ป้ายบอก "' + c.from + '"');

  /* 7 · สืบมาแล้วต้องนับว่าเลือกแล้ว */
  if (!c.err){
    if (c.miss.indexOf('สีสายรัดข้อมือ') >= 0) fail('สีสืบมาแล้วแต่ยังนับว่าขาดอยู่');
    else ok('สีที่สืบมานับว่าเลือกแล้ว · ไม่ค้างอยู่ในรายการที่ขาด');
  }

  /* 8 · ต้องไม่เขียนลงใบวันใหม่ */
  const raw = await page.evaluate(a => {
    const o = (typeof pjRaw === 'function') ? pjRaw(a.d, a.b) : null;
    return { has: !!o, wb: o ? String(o.wb || '') : '', wbc: o ? String(o.wbc || '') : '' };
  }, { d:D2, b:S.bid });
  if (raw.wb || raw.wbc) fail('สืบมาแล้วดันเขียนลงใบวันใหม่ด้วย (wb="' + raw.wb + '") · ใบเปล่าจะกลายเป็นใบที่ถูกแตะ');
  else ok('สืบมาเฉย ๆ ไม่เขียนลงใบวันใหม่ · ใบเปล่ายังนับเป็นใบเปล่า');

  /* 9 · ต้องไม่ข้ามลำ */
  if (S.other){
    const c2 = await card(S.other);
    if (c2.err) console.log('  ! ไม่พบการ์ดลำเทียบ · ข้ามข้อ 9');
    else if (/ม่วง/.test(c2.wbTxt)) fail('ลำอื่นได้สีม่วงติดไปด้วย · สีต้องเป็นของลำ ไม่ใช่ของวัน');
    else ok('ลำอื่นไม่ได้สีนั้นติดไป · การ์ดขึ้น "' + (c2.wbTxt.trim() || '—') + '"');
  } else console.log('  ! ท่านี้มีลำเดียวที่วิ่ง · ข้ามข้อ 9');
}

/* ══ 10 · ลำที่ไม่ได้ออกเรือ · ปิดใบได้เหมือนเดิม ═══════════════════════════ */
{
  const r = await page.evaluate(a => {
    const all = (typeof pjAllBoats === 'function') ? pjAllBoats(a.d, _poPier) : [];
    const idle = all.filter(B => B && B._st && B._st.k !== 'run')[0];
    if (!idle) return { skip:true };
    const before = !!pjOf(a.d, idle.bid).lock;
    pjLockSet(idle.bid, 1);
    const after = !!pjOf(a.d, idle.bid).lock;
    pjLockSet(idle.bid, before ? 1 : 0);
    return { bid:idle.bid, k:idle._st.k, after };
  }, { d:D2 });
  if (r.skip) console.log('  ! วันนั้นทุกลำออกเรือหมด · ข้ามข้อ 10');
  else if (!r.after) fail('ลำที่ไม่ได้ออกเรือ (' + r.k + ') กดปิดใบไม่ได้ · ไม่ควรโดนกติกานี้');
  else ok('ลำที่ไม่ได้ออกเรือ (' + r.k + ') ปิดใบได้เหมือนเดิม');
}

/* ══ 11 · ไม่มี error บนหน้า ═══════════════════════════════════════════════ */
if (errors && errors.length) fail('มี error บนหน้า ' + errors.length + ' รายการ · ' + String(errors[0]).slice(0, 140));
else ok('ไม่มี error บนหน้าระหว่างทดสอบ');

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await close();
process.exit(bad ? 1 : 0);
