// §flBoard · บอร์ดงานเรือบนหัว Fleet Dashboard
//
// ที่มา (2026-09-22) · "งานเยอะจนไม่รู้จะตามอะไรก่อน"
//   ของจริง · ใบซ่อมเปิดค้าง 36 ใบ · 28 ใบอายุเกิน 90 วัน · 20 ใบไม่มีใครบันทึกอะไรเกิน 60 วัน
//   แต่ทุกใบสถานะ inprogress เหมือนกันหมด · และเรือบริษัทจอดอยู่ 9 จาก 15 ลำ
//   แถบตัวเลขเดิมบนหัวหน้าตอบได้แค่ "มีเท่าไหร่" จึงถูกแทนด้วยบอร์ดที่ตอบว่า "ต้องทำอะไรต่อ"
//
// เทสนี้กันห้าอย่าง
//   1 ใบที่ยังเปิดต้องขึ้นบอร์ดครบ ไม่หาย ไม่ซ้ำ
//   2 เลนต้องคิดถูกตามกติกา · เทียบกับตัวคิดอิสระของเทสเอง ไม่ใช่เรียก flBoardLane
//   3 กดการ์ดแล้วบันทึกได้จริง · ลงใบจริงและลง localStorage
//   4 ลากข้ามเลนแล้วอยู่ที่เดิมหลังวาดใหม่ (เขียนลงใบ ไม่ใช่จำไว้บนหน้าจอ)
//   5 พักไว้แล้วหลุดจากบอร์ดและจากตัวนับ
//   6 กรุ๊ปตามเรือ · ใบอยู่ใต้หัวของลำตัวเอง · เรียงลำที่กั้นนานสุดก่อน · ยุบ/สลับใบเดี่ยวได้
//   7 งานย่อย · ติ๊กหนึ่งขั้นต้องลง progressLog จริง ความเงียบรีเซ็ต และลง localStorage
//
// ⚠ ต้องเปิดผ่าน nav() จริง · บอร์ดวาดจาก flRenderDashboard
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, errors, close } = await open({ blob: process.env.LAD, width: 1950, height: 1000 });
page.on('dialog', d => d.accept());
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="fl-dashboard"]'); if (el) nav(el); });
await page.waitForTimeout(1600);

/* ตัวคิดอิสระของเทส · เขียนจากข้อมูลดิบเอง ไม่เรียกฟังก์ชันของหน้า
   ถ้าเทสไปเรียก flBoardLane() สองฝั่งจะตรงกันเสมอแม้กติกาจะเพี้ยน — จับอะไรไม่ได้เลย */
const MINE = `(function(){
  var WAIT=/รอ|สั่ง|อะไหล่|คาน|ผู้รับเหมา|อนุมัติ|เคลม|ประกัน|memo|order|quote/i;
  function days(d){ if(!d) return 0;
    var A=String(d).slice(0,10).split('-'), B=TODAY_STR.split('-');
    return Math.round((Date.UTC(+B[0],+B[1]-1,+B[2])-Date.UTC(+A[0],+A[1]-1,+A[2]))/86400000); }
  var out={jobs:[], down:{}, money:0, silent:0, noOwner:0};
  (FL_MAINT||[]).forEach(function(m){
    if(!m || m.status==='done' || m.parked) return;
    var last=String(m.startDate||'');
    (m.progressLog||[]).forEach(function(e){ var x=String((e&&e.date)||''); if(x>last) last=x; });
    var sil=Math.max(0, days(last));
    var b=(typeof getBoat==='function')?getBoat(m.boatId):null;
    var st=b?((getCurStatus(b,TODAY_STR)||{}).s||''):'';
    var blocks=(st==='fixing'||st==='unavailable');
    var L=(m.progressLog||[]);
    var txt=L.length?String(L[L.length-1].text||''):'';
    var lane = m.boardLane ? m.boardLane
             : !blocks ? 'close'
             : sil<=30 ? 'doing'
             : (txt && WAIT.test(txt)) ? 'wait'
             : 'decide';
    if(blocks){ if(m.boatId) out.down[m.boatId]=1;
      out.money += (typeof flMaintCalcCost==='function')?(flMaintCalcCost(m.id)||0):(m.cost||0); }
    if(sil>60) out.silent++;
    if(!String(m.owner||'').trim()) out.noOwner++;
    out.jobs.push({id:m.id, no:m.no, lane:lane, sil:sil, blocks:blocks});
  });
  out.nDown=Object.keys(out.down).length;
  out.money=Math.round(out.money);
  return out;
})()`;

/* ══ 1 · ใบขึ้นบอร์ดครบ ไม่หาย ไม่ซ้ำ ═══════════════════════════════════ */
const A = await page.evaluate(`(function(){
  var mine=${MINE};
  var cards=[].slice.call(document.querySelectorAll('#fl-board .kd')).map(function(c){ return c.getAttribute('data-mj'); });
  var seen={}, dup=0;
  cards.forEach(function(id){ if(seen[id]) dup++; seen[id]=1; });
  var missing=mine.jobs.filter(function(j){ return !seen[j.id]; }).map(function(j){ return j.no; });
  var extra=cards.filter(function(id){ return !mine.jobs.some(function(j){ return j.id===id; }); });
  return { board:!!document.getElementById('fl-board'), nMine:mine.jobs.length, nCards:cards.length,
           dup:dup, missing:missing.slice(0,5), extra:extra.slice(0,5) };
})()`);
if (!A.board) fail('ไม่มีบอร์ดบนหน้า Fleet Dashboard');
else if (A.dup) fail('มีใบขึ้นบอร์ดซ้ำ ' + A.dup + ' ใบ');
else if (A.missing.length) fail('ใบที่ยังเปิดแต่ไม่ขึ้นบอร์ด · ' + A.missing.join(', '));
else if (A.extra.length) fail('มีการ์ดที่ไม่ตรงกับใบไหนเลย ' + A.extra.length + ' ใบ');
else ok('ใบที่ยังเปิด ' + A.nMine + ' ใบ ขึ้นบอร์ดครบ ไม่ซ้ำ');

/* ══ 2 · เลนต้องตรงกับตัวคิดอิสระ ═══════════════════════════════════════ */
const B = await page.evaluate(`(function(){
  var mine=${MINE}, wrong=[];
  mine.jobs.forEach(function(j){
    var el=document.querySelector('#fl-board .kd[data-mj="'+j.id+'"]');
    if(!el) return;
    var lane=el.closest('.lane').getAttribute('data-lane');
    if(lane!==j.lane) wrong.push(j.no+' อยู่เลน '+lane+' แต่ควรเป็น '+j.lane);
  });
  var byLane={};
  [].slice.call(document.querySelectorAll('#fl-board .lane')).forEach(function(l){
    byLane[l.getAttribute('data-lane')]=l.querySelectorAll('.kd').length; });
  var headCount={};
  [].slice.call(document.querySelectorAll('#fl-board .lane')).forEach(function(l){
    headCount[l.getAttribute('data-lane')]=+l.querySelector('.lh .c').textContent; });
  return { wrong:wrong.slice(0,4), nWrong:wrong.length, byLane:byLane, headCount:headCount };
})()`);
if (B.nWrong) fail(B.nWrong + ' ใบอยู่ผิดเลน · ' + B.wrong.join(' | '));
else ok('ทุกใบอยู่ถูกเลนตามกติกา · ' + Object.keys(B.byLane).map(k => k + ' ' + B.byLane[k]).join(' · '));
const headBad = Object.keys(B.byLane).filter(k => B.byLane[k] !== B.headCount[k]);
if (headBad.length) fail('ตัวเลขบนหัวเลนไม่ตรงกับจำนวนการ์ด · ' + headBad.join(', '));
else ok('ตัวเลขบนหัวเลนตรงกับจำนวนการ์ดทุกเลน');

/* ══ 2b · ตัวเลขบนหัวบอร์ด ═════════════════════════════════════════════ */
const C = await page.evaluate(`(function(){
  var mine=${MINE};
  var v=[].slice.call(document.querySelectorAll('#fl-board .nm b')).map(function(e){ return e.textContent.trim(); });
  return { shown:v, mine:{down:mine.nDown, jobs:mine.jobs.length, money:mine.money, silent:mine.silent, noOwner:mine.noOwner} };
})()`);
/* ช่องแรกเขียนเป็น "9 / 15" · ต้องอ่านเลขตัวแรกตัวเดียว ไม่ใช่ถอดอักขระที่ไม่ใช่เลขออกทั้งหมด
   (ถอดทั้งหมดจะได้ 915 แล้วเทสจะฟ้องผิดทุกครั้ง) */
const num1 = s => Number((String(s).match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, '')) || 0;
const num = s => Number(String(s).replace(/[^0-9]/g, '')) || 0;
if (num1(C.shown[0]) !== C.mine.down) fail('หัวบอร์ดบอกเรือจอด "' + C.shown[0] + '" แต่นับเองได้ ' + C.mine.down);
else if (num(C.shown[1]) !== C.mine.money) fail('หัวบอร์ดบอกเงิน "' + C.shown[1] + '" แต่นับเองได้ ' + C.mine.money);
else if (num(C.shown[2]) !== C.mine.jobs) fail('หัวบอร์ดบอกใบที่เปิด "' + C.shown[2] + '" แต่นับเองได้ ' + C.mine.jobs);
else if (num(C.shown[3]) !== C.mine.silent) fail('หัวบอร์ดบอกใบเงียบ "' + C.shown[3] + '" แต่นับเองได้ ' + C.mine.silent);
else ok('ตัวเลขบนหัวบอร์ดตรงกับตัวนับอิสระทุกตัว · ' + C.shown.slice(0, 4).join(' / '));

/* ══ 3 · กดการ์ดแล้วบันทึกได้จริง และลง localStorage ════════════════════ */
const D = await page.evaluate(() => {
  const c = document.querySelector('#fl-board .lane[data-lane="decide"] .kd') || document.querySelector('#fl-board .kd');
  const id = c.getAttribute('data-mj');
  /* กดการ์ด = กางงานย่อย · กล่องสั่งงานอยู่หลังปุ่ม "สั่งงาน" ในแผงที่กางออกมา */
  c.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  const subsOpen = !!document.querySelector('#fl-board .kd[data-mj="' + id + '"] .subs');
  document.querySelector('#fl-board .kd[data-mj="' + id + '"] .kacts button')
    .dispatchEvent(new MouseEvent('click', {bubbles:true}));
  const popOn = subsOpen && !!(document.getElementById('fl-board-pop') || {}).classList?.contains('on');
  const m0 = FL_MAINT.find(x => x.id === id);
  const nLog0 = (m0.progressLog || []).length, sil0 = flBoardSilent(m0);
  document.getElementById('fl-bd-own').value  = 'ช่างหัวหน้า';
  document.getElementById('fl-bd-due').value  = '2026-09-30';
  document.getElementById('fl-bd-note').value = 'คุยกับอู่แล้ว นัดเข้าอาทิตย์หน้า';
  flBoardSaveCard();
  const m1 = FL_MAINT.find(x => x.id === id);
  const ls = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  const kept = (ls.fleet_maintenance || []).find(x => x.id === id) || {};
  return { id, no:m1.no, popOn, owner:m1.owner, due:m1.dueDate,
           logAdded:(m1.progressLog || []).length - nLog0, sil0, sil1:flBoardSilent(m1),
           keptOwner:kept.owner, keptDue:kept.dueDate,
           keptLog:((kept.progressLog || []).slice(-1)[0] || {}).text || '' };
});
if (!D.popOn) fail('กดการ์ดแล้วงานย่อยไม่กาง หรือปุ่มสั่งงานไม่เปิดกล่อง');
else if (D.owner !== 'ช่างหัวหน้า' || D.due !== '2026-09-30') fail('บันทึกผู้รับผิดชอบ/วันตอบไม่ติด');
else if (D.logAdded !== 1) fail('บันทึกความคืบหน้าไม่ได้ลงใบ · เพิ่มมา ' + D.logAdded + ' บรรทัด');
else if (D.sil1 !== 0) fail('บันทึกแล้วความเงียบไม่รีเซ็ต · ยังเป็น ' + D.sil1 + ' วัน');
else if (D.keptOwner !== 'ช่างหัวหน้า' || D.keptDue !== '2026-09-30' || !/นัดเข้าอาทิตย์หน้า/.test(D.keptLog))
  fail('บันทึกแล้วไม่ลง localStorage · รีเฟรชแล้วหาย');
else ok(D.no + ' · บันทึกลงใบและลงเครื่องจริง · เงียบ ' + D.sil0 + ' → 0 วัน');

/* ══ 4 · ลากข้ามเลนแล้วต้องอยู่ที่เดิมหลังวาดใหม่ ══════════════════════ */
const E = await page.evaluate(() => {
  const c = document.querySelector('#fl-board .lane[data-lane="decide"] .kd');
  if (!c) return { skip:true };
  const id = c.getAttribute('data-mj');
  _flBoardDrag = id;
  flBoardDrop({preventDefault(){}, dataTransfer:null}, document.querySelector('#fl-board .lane[data-lane="wait"]'));
  const afterDrop = (document.querySelector('#fl-board .kd[data-mj="' + id + '"]') || {}).closest
    ? document.querySelector('#fl-board .kd[data-mj="' + id + '"]').closest('.lane').getAttribute('data-lane') : '';
  flBoardRefresh();   /* วาดใหม่ · ถ้าจำไว้แค่บนหน้าจอ ตรงนี้จะเด้งกลับ */
  const afterRedraw = (document.querySelector('#fl-board .kd[data-mj="' + id + '"]') || {}).closest
    ? document.querySelector('#fl-board .kd[data-mj="' + id + '"]').closest('.lane').getAttribute('data-lane') : '';
  const ls = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  const kept = (ls.fleet_maintenance || []).find(x => x.id === id) || {};
  const m = FL_MAINT.find(x => x.id === id);
  return { skip:false, no:m.no, afterDrop, afterRedraw, kept:kept.boardLane,
           logged:/ย้ายไปเลน/.test(((m.progressLog || []).slice(-1)[0] || {}).text || '') };
});
if (E.skip) console.log('  ! ไม่มีใบในเลนต้องตัดสินใจให้ลาก · ข้ามข้อนี้');
else if (E.afterDrop !== 'wait') fail('ลากแล้วการ์ดไม่ย้ายเลน · ได้ ' + E.afterDrop);
else if (E.afterRedraw !== 'wait') fail('วาดใหม่แล้วการ์ดเด้งกลับ · ลากแล้วไม่ได้เขียนลงใบ');
else if (E.kept !== 'wait') fail('เลนที่ลากไม่ลง localStorage · รีเฟรชแล้วหาย');
else if (!E.logged) fail('ลากแล้วไม่ได้บันทึกว่าใครย้ายเมื่อไหร่');
else ok(E.no + ' · ลากข้ามเลนแล้วอยู่ที่เดิมหลังวาดใหม่ และมีบันทึกไว้');

/* ══ 5 · พักไว้แล้วหลุดจากบอร์ดและจากตัวนับ ════════════════════════════ */
const F = await page.evaluate(() => {
  const before = flBoardScan();
  const c = document.querySelector('#fl-board .kd');
  const id = c.getAttribute('data-mj');
  c.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  document.querySelector('#fl-board .kd[data-mj="' + id + '"] .kacts button')
    .dispatchEvent(new MouseEvent('click', {bubbles:true}));   /* ปุ่มสั่งงาน · ตั้ง _flBoardPopId */
  flBoardPark();
  const m = FL_MAINT.find(x => x.id === id);
  const ls = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  const kept = (ls.fleet_maintenance || []).find(x => x.id === id) || {};
  return { no:m.no, parked:m.parked, keptParked:kept.parked,
           onBoard:!!document.querySelector('#fl-board .kd[data-mj="' + id + '"]'),
           before:before.jobs, after:flBoardScan().jobs, parkedCount:flBoardScan().parked };
});
if (!F.parked) fail('กดพักไว้แล้วไม่ได้ทำเครื่องหมายอะไรบนใบ');
else if (F.onBoard) fail('พักไว้แล้วการ์ดยังอยู่บนบอร์ด');
else if (F.after !== F.before - 1) fail('พักไว้แล้วตัวนับใบที่เปิดไม่ลด · ' + F.before + ' → ' + F.after);
else if (F.keptParked !== F.parked) fail('พักไว้แล้วไม่ลง localStorage');
else ok(F.no + ' · พักไว้แล้วหลุดจากบอร์ดและตัวนับ · ใบที่เปิด ' + F.before + ' → ' + F.after);

/* ══ 6 · กรุ๊ปตามเรือ ═══════════════════════════════════════════════════
   ตัวเรียงกรุ๊ปเขียนเองในเทส ไม่เรียก flBoardGrpOrder · ถ้าเรียกก็ตรงกันเสมอแม้กติกาเพี้ยน */
const G = await page.evaluate(() => {
  function days(d){ if(!d) return 0;
    var A=String(d).slice(0,10).split('-'), B=TODAY_STR.split('-');
    return Math.round((Date.UTC(+B[0],+B[1]-1,+B[2])-Date.UTC(+A[0],+A[1]-1,+A[2]))/86400000); }
  function blocks(m){ var b=getBoat(m.boatId); if(!b) return false;
    var s=(getCurStatus(b,TODAY_STR)||{}).s||''; return s==='fixing'||s==='unavailable'; }
  var wrongBoat=[], wrongCnt=[], wrongOrder=[], lanes=0, groups=0;
  [].slice.call(document.querySelectorAll('#fl-board .lane')).forEach(function(l){
    lanes++;
    var gs=[].slice.call(l.querySelectorAll('.grp'));
    groups+=gs.length;
    /* ก ใบในกรุ๊ปต้องเป็นของลำนั้นจริง · และเลขบนหัวกรุ๊ปต้องเท่าจำนวนการ์ด */
    gs.forEach(function(g){
      var bid=g.getAttribute('data-gb');
      var kd=[].slice.call(g.querySelectorAll('.kd'));
      kd.forEach(function(c){
        var m=FL_MAINT.find(function(x){ return x.id===c.getAttribute('data-mj'); });
        if(m && (m.boatId||'—')!==bid) wrongBoat.push((m.no||'')+' อยู่ใต้ '+bid);
      });
      var shown=parseInt((g.querySelector('.gh .cnt')||{}).textContent||'0',10);
      if(shown!==kd.length) wrongCnt.push(bid+' บอก '+shown+' แต่มี '+kd.length);
    });
    /* ข ลำดับกรุ๊ปในเลน · กั้นเรืออยู่ก่อน → กั้นมานานกว่าก่อน → ใบเยอะกว่าก่อน */
    var by={};
    [].slice.call(l.querySelectorAll('.kd')).forEach(function(c){
      var m=FL_MAINT.find(function(x){ return x.id===c.getAttribute('data-mj'); });
      if(m) (by[m.boatId||'—']=by[m.boatId||'—']||[]).push(m); });
    var want=Object.keys(by).sort(function(a,b){
      var ab=by[a].some(blocks)?1:0, bb=by[b].some(blocks)?1:0;
      if(ab!==bb) return bb-ab;
      var ad=0, bd=0;
      by[a].forEach(function(m){ if(blocks(m)){ var n=days(m.startDate||''); if(n>ad) ad=n; } });
      by[b].forEach(function(m){ if(blocks(m)){ var n=days(m.startDate||''); if(n>bd) bd=n; } });
      if(ad!==bd) return bd-ad;
      return by[b].length-by[a].length; });
    var got=gs.map(function(g){ return g.getAttribute('data-gb'); });
    if(got.join('|')!==want.join('|'))
      wrongOrder.push(l.getAttribute('data-lane')+' · ได้ '+got.join(',')+' ควรเป็น '+want.join(','));
  });
  /* ค ยุบกรุ๊ปแล้วการ์ดต้องหาย แต่ใบยังนับอยู่ · กางกลับแล้วต้องกลับมา */
  var g0=document.querySelector('#fl-board .grp');
  var lane0=g0.closest('.lane').getAttribute('data-lane'), bid0=g0.getAttribute('data-gb');
  var n0=g0.querySelectorAll('.kd').length;
  flBoardGrpToggle(null, lane0+':'+bid0);
  var g1=document.querySelector('#fl-board .lane[data-lane="'+lane0+'"] .grp[data-gb="'+bid0+'"]');
  var shutOk=g1.classList.contains('closed')
    && getComputedStyle(g1.querySelector('.gb')).display==='none'
    && parseInt(g1.querySelector('.gh .cnt').textContent,10)===n0;
  flBoardGrpToggle(null, lane0+':'+bid0);
  var reopened=document.querySelector('#fl-board .lane[data-lane="'+lane0+'"] .grp[data-gb="'+bid0+'"] .kd .tt');
  /* ง สลับเป็นใบเดี่ยว · กรุ๊ปหาย แต่จำนวนการ์ดเท่าเดิม */
  var kdGrouped=document.querySelectorAll('#fl-board .kd').length;
  flBoardSetGroup(0);
  var flat={ grp:document.querySelectorAll('#fl-board .grp').length,
             kd:document.querySelectorAll('#fl-board .kd').length,
             pref:localStorage.getItem('la_flbgrp') };
  flBoardSetGroup(1);
  return { lanes:lanes, groups:groups, wrongBoat:wrongBoat.slice(0,4), wrongCnt:wrongCnt.slice(0,4),
           wrongOrder:wrongOrder.slice(0,3), shutOk:shutOk, reopened:!!reopened,
           kdGrouped:kdGrouped, flat:flat };
});
if (G.wrongBoat.length) fail('มีใบอยู่ใต้หัวกรุ๊ปของเรือลำอื่น · ' + G.wrongBoat.join(' | '));
else ok('ทุกใบอยู่ใต้หัวกรุ๊ปของลำตัวเอง · ' + G.groups + ' กรุ๊ปใน ' + G.lanes + ' เลน');
if (G.wrongCnt.length) fail('เลขบนหัวกรุ๊ปไม่ตรงกับจำนวนการ์ด · ' + G.wrongCnt.join(' | '));
else ok('เลขบนหัวกรุ๊ปตรงกับจำนวนการ์ดทุกกรุ๊ป');
if (G.wrongOrder.length) fail('ลำดับกรุ๊ปในเลนไม่ตรงกติกา · ' + G.wrongOrder.join(' | '));
else ok('ลำดับกรุ๊ปตรงกติกาทุกเลน · กั้นเรืออยู่ก่อน แล้วกั้นนานกว่าก่อน');
if (!G.shutOk) fail('ยุบกรุ๊ปแล้วการ์ดไม่หาย หรือเลขบนหัวหายไปด้วย');
else if (!G.reopened) fail('กางกรุ๊ปกลับแล้วการ์ดไม่กลับมา');
else ok('ยุบกรุ๊ปแล้วการ์ดหาย เลขยังอยู่ · กางกลับแล้วการ์ดกลับมาครบ');
if (G.flat.grp) fail('สลับเป็นใบเดี่ยวแล้วยังมีกรุ๊ปเหลือ ' + G.flat.grp + ' กรุ๊ป');
else if (G.flat.kd !== G.kdGrouped) fail('สลับเป็นใบเดี่ยวแล้วจำนวนการ์ดเปลี่ยน · ' + G.kdGrouped + ' → ' + G.flat.kd);
else if (G.flat.pref !== '0') fail('สลับแล้วไม่ได้จำไว้ · รีเฟรชแล้วเด้งกลับ');
else ok('สลับเป็นใบเดี่ยวได้ · การ์ดครบ ' + G.flat.kd + ' ใบ และจำไว้ในเครื่อง');

/* ══ 6b · ลากทั้งกรุ๊ป · ทุกใบของลำนั้นย้ายพร้อมกันและมีบันทึกใบต่อใบ ════ */
const H = await page.evaluate(() => {
  /* หาลำที่มีใบเปิดตั้งแต่ 2 ใบขึ้นไป · ลากทั้งกรุ๊ปถึงจะมีความหมาย */
  var by={};
  flBoardJobs().forEach(function(m){ (by[m.boatId]=by[m.boatId]||[]).push(m); });
  var bid=Object.keys(by).filter(function(k){ return by[k].length>1; })
    .sort(function(a,b){ return by[b].length-by[a].length; })[0];
  if(!bid) return { skip:true };
  var ids=by[bid].map(function(m){ return m.id; });
  var nLog0={}; by[bid].forEach(function(m){ nLog0[m.id]=(m.progressLog||[]).length; });
  _flBoardGrpDrag=bid; _flBoardDrag='';
  flBoardDrop({preventDefault(){}, dataTransfer:null}, document.querySelector('#fl-board .lane[data-lane="close"]'));
  flBoardRefresh();
  var stillWrong=ids.filter(function(id){
    var el=document.querySelector('#fl-board .kd[data-mj="'+id+'"]');
    return !el || el.closest('.lane').getAttribute('data-lane')!=='close'; });
  var ls=JSON.parse(localStorage.getItem(LS_KEY)||'{}');
  var notKept=ids.filter(function(id){
    var k=(ls.fleet_maintenance||[]).find(function(x){ return x.id===id; })||{};
    return k.boardLane!=='close'; });
  var noLog=ids.filter(function(id){
    var m=FL_MAINT.find(function(x){ return x.id===id; });
    return (m.progressLog||[]).length !== nLog0[id]+1
        || !/ยกทั้งลำ/.test(((m.progressLog||[]).slice(-1)[0]||{}).text||''); });
  var b=getBoat(bid);
  return { skip:false, boat:(b&&b.name)||bid, n:ids.length,
           stillWrong:stillWrong.length, notKept:notKept.length, noLog:noLog.length };
});
if (H.skip) console.log('  ! ไม่มีลำไหนมีใบเปิดเกินหนึ่งใบ · ข้ามข้อลากทั้งกรุ๊ป');
else if (H.stillWrong) fail('ลากทั้งกรุ๊ปแล้ว ' + H.stillWrong + ' ใบไม่ย้ายตาม');
else if (H.notKept) fail('ลากทั้งกรุ๊ปแล้ว ' + H.notKept + ' ใบไม่ลง localStorage');
else if (H.noLog) fail('ลากทั้งกรุ๊ปแล้ว ' + H.noLog + ' ใบไม่มีบันทึกของตัวเอง');
else ok(H.boat + ' · ลากทั้งกรุ๊ป ' + H.n + ' ใบย้ายพร้อมกัน ลงเครื่อง และมีบันทึกใบต่อใบ');

/* ══ 7 · งานย่อย ════════════════════════════════════════════════════════
   หัวใจคือ "ติ๊กหนึ่งขั้น = บันทึกความคืบหน้าหนึ่งครั้ง" · ความเงียบต้องรีเซ็ตเอง
   โดยที่บอร์ดไม่ได้เก็บตัวนับของตัวเอง (อ่าน progressLog ที่เดียว) */
const I = await page.evaluate(() => {
  /* เลือกใบที่เงียบนานที่สุด · จะได้เห็นชัดว่าความเงียบตกลงจริง */
  var m = flBoardJobs().slice().sort(function(a,b){ return flBoardSilent(b)-flBoardSilent(a); })[0];
  var id = m.id, no = m.no, sil0 = flBoardSilent(m);
  var lane0 = flBoardLane(m);
  document.querySelector('#fl-board .kd[data-mj="'+id+'"]')
    .dispatchEvent(new MouseEvent('click', {bubbles:true}));
  var subsShown = !!document.querySelector('#fl-board .kd[data-mj="'+id+'"] .subs');
  /* จำลองว่ามีคนลากใบนี้ไปแช่ไว้ที่ "รออะไหล่" · ติ๊กแล้วต้องหลุดออกมาเอง
     ถ้าไม่ตั้งไว้ ใบจะเด้งเป็น doing อยู่ดีเพราะความเงียบรีเซ็ต · ข้อนี้จะไม่ได้กันอะไรเลย */
  m.boardLane='wait'; var laneForced=flBoardLane(m);
  flBoardSubSplit(null, id);
  var tpl = (m.subs||[]).length;
  var splitAgain = (flBoardSubSplit(null, id), (FL_MAINT.find(x=>x.id===id).subs||[]).length);
  /* ตั้งหลักนับบรรทัดหลังแตกแม่แบบ · การแตกเองก็ลงบันทึกหนึ่งบรรทัด
     จากนี้ไปทุกบรรทัดที่เพิ่มต้องมาจากการติ๊กเท่านั้น */
  var nLog0 = (FL_MAINT.find(x=>x.id===id).progressLog||[]).length;
  /* ติ๊กขั้นแรก · เก็บตัวเลขทันที · m1 เป็นตัวอ้างถึงใบจริง อ่านตอน return จะกลายเป็นสถานะสุดท้าย */
  flBoardSubTick(null, id, 0, true);
  var m1 = FL_MAINT.find(x=>x.id===id);
  var d1 = (m1.subs||[]).filter(s=>s.d).length;
  var logAdd1 = (m1.progressLog||[]).length - nLog0;
  var sil1 = flBoardSilent(m1), lane1 = flBoardLane(m1);
  var by1 = ((m1.subs||[])[0]||{}).by || '', at1 = ((m1.subs||[])[0]||{}).at || '';
  var boxes = document.querySelectorAll('#fl-board .kd[data-mj="'+id+'"] .subs .sub input');
  var tagAfter1 = [].slice.call(document.querySelectorAll('#fl-board .kd[data-mj="'+id+'"] .tg'))
    .map(e=>e.textContent).filter(t=>/ขั้นตอน/.test(t))[0]||'';
  var bar1 = (document.querySelector('#fl-board .kd[data-mj="'+id+'"] .bar i')||{}).style||{};
  var ls1 = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
  var kept1 = (ls1.fleet_maintenance||[]).find(x=>x.id===id)||{};
  /* ติ๊กจนครบ */
  for(var i=1;i<tpl;i++) flBoardSubTick(null, id, i, true);
  var m2 = FL_MAINT.find(x=>x.id===id);
  var dAll = (m2.subs||[]).filter(s=>s.d).length;
  var closeBtn = [].slice.call(document.querySelectorAll('#fl-board .kd[data-mj="'+id+'"] .kacts button')).slice(-1)[0];
  var closeLabel = (closeBtn||{}).textContent||'';
  /* ติ๊กกลับออก · ต้องลดลงและลง log อีกบรรทัด */
  flBoardSubTick(null, id, 0, false);
  var m3 = FL_MAINT.find(x=>x.id===id);
  return { no:no, sil0:sil0, lane0:lane0, subsShown:subsShown, tpl:tpl, splitAgain:splitAgain,
           d1:d1, logAdd1:logAdd1, sil1:sil1, lane1:lane1, laneForced:laneForced, boxes:boxes.length,
           tagAfter1:tagAfter1, barW:String(bar1.width||''),
           keptSub:((kept1.subs||[])[0]||{}).d, keptLog:((kept1.progressLog||[]).slice(-1)[0]||{}).text||'',
           by1:by1, at1:at1, dAll:dAll, closeLabel:closeLabel,
           dBack:(m3.subs||[]).filter(s=>s.d).length,
           logAddAll:(m3.progressLog||[]).length-nLog0 };
});
if (!I.subsShown) fail('กดการ์ดแล้วรายการงานย่อยไม่กาง');
else if (I.tpl < 4) fail('แตกจากแม่แบบแล้วได้แค่ ' + I.tpl + ' ขั้น');
else if (I.splitAgain !== I.tpl) fail('แตกแม่แบบซ้ำแล้วขั้นตอนโดนเติมซ้ำ · ' + I.tpl + ' → ' + I.splitAgain);
else ok(I.no + ' · แตกจากแม่แบบได้ ' + I.tpl + ' ขั้น · กดซ้ำไม่เพิ่มซ้ำ');
if (I.boxes !== I.tpl) fail('ช่องติ๊กบนหน้าจอ ' + I.boxes + ' ช่อง แต่มี ' + I.tpl + ' ขั้นตอน');
else if (I.d1 !== 1) fail('ติ๊กขั้นแรกแล้วไม่ติด');
else if (I.logAdd1 !== 1) fail('ติ๊กหนึ่งขั้นต้องลง progressLog หนึ่งบรรทัด · ได้ ' + I.logAdd1);
else if (I.sil1 !== 0) fail('ติ๊กแล้วความเงียบไม่รีเซ็ต · ' + I.sil0 + ' → ' + I.sil1 + ' วัน');
else if (!/1\/+/.test(I.tagAfter1)) fail('ป้ายบนการ์ดไม่ขึ้น 1/' + I.tpl + ' · ได้ "' + I.tagAfter1 + '"');
else if (I.barW !== Math.round(1 / I.tpl * 100) + '%') fail('แถบความคืบหน้าไม่ตรง · ได้ ' + I.barW);
else ok(I.no + ' · ติ๊กหนึ่งขั้น = บันทึกหนึ่งบรรทัด · เงียบ ' + I.sil0 + ' → 0 วัน · แถบ ' + I.barW);
if (I.keptSub !== 1 || !/ขั้นตอน 1\//.test(I.keptLog)) fail('ติ๊กแล้วไม่ลง localStorage · รีเฟรชแล้วหาย');
else if (!I.at1) fail('ติ๊กแล้วไม่ได้บันทึกวันที่ติ๊ก');
else ok('ขั้นที่ติ๊กและบรรทัดบันทึกลงเครื่องจริง · ลงวันที่ ' + I.at1 + (I.by1 ? (' โดย ' + I.by1) : ''));
if (I.laneForced !== 'wait') fail('ตั้งใบให้ค้างที่เลนรออะไหล่ไม่ได้ · ข้อนี้ไม่ได้ทดสอบอะไร');
else if (I.lane1 !== 'doing') fail('ใบที่ถูกลากแช่ไว้ที่รออะไหล่ ติ๊กแล้วไม่หลุดออกมา · ยังเป็น ' + I.lane1);
else ok('ใบที่ถูกลากแช่ไว้ที่รออะไหล่ · ติ๊กหนึ่งขั้นแล้วหลุดไปเลนกำลังทำเอง');
if (I.dAll !== I.tpl) fail('ติ๊กครบทุกขั้นแล้วนับได้ ' + I.dAll + ' จาก ' + I.tpl);
else if (!/ครบแล้ว/.test(I.closeLabel)) fail('ครบทุกขั้นแล้วปุ่มไม่ชวนปิดใบ · ได้ "' + I.closeLabel.trim() + '"');
else ok('ติ๊กครบ ' + I.tpl + '/' + I.tpl + ' แล้วปุ่มเปลี่ยนเป็น "' + I.closeLabel.trim() + '"');
if (I.dBack !== I.tpl - 1) fail('ติ๊กกลับออกแล้วไม่ลด · ยังเป็น ' + I.dBack);
else if (I.logAddAll !== I.tpl + 1) fail('บันทึกไม่ครบทุกครั้งที่ติ๊ก · ได้ ' + I.logAddAll + ' ควรเป็น ' + (I.tpl + 1));
else ok('ติ๊กกลับออกได้ · ทุกครั้งที่ติ๊กลงบันทึกครบ ' + I.logAddAll + ' บรรทัด');

/* ══ 8 · จอแคบ · ต้องไม่ล้นแนวนอน ══════════════════════════════════════ */
for (const w of [1440, 900, 390]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(350);
  const G = await page.evaluate(() => ({
    ovf: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    board: !!document.getElementById('fl-board')
  }));
  if (!G.board) fail(w + 'px · บอร์ดหายไป');
  else if (G.ovf > 2) fail(w + 'px · ล้นแนวนอน ' + G.ovf + 'px');
  else ok(w + 'px · บอร์ดอยู่ครบ ไม่ล้นแนวนอน');
}

const NOISE = /Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/;
const real = errors.filter(x => !NOISE.test(x));
if (real.length) { bad += real.length; real.forEach(x => console.log('  ✗ ' + x)); }
console.log('พัง ' + bad);
await close();
process.exit(bad ? 1 : 0);
