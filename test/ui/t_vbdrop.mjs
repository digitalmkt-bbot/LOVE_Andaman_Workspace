// §vbDrop / §vbDropWhy / §vbSameVan · คอลัมน์จุดส่งบนใบวางบิลรถร่วม
//
// ที่มา (2026-09-22) · "ทำไมบางอันถึงไม่ขึ้น" แล้วตามด้วย "บางกรณีคือ รับ ส่ง จุดเดิมนะ"
//   คอลัมน์จุดส่งถูกเพิ่มมาเพื่อให้เห็นว่ารถวิ่งไปไหน เพราะเรตต่อคันขึ้นกับระยะทาง
//   แต่ของเดิมตัดสินสีตอนวาดด้วยการเทียบสตริงกับจุดรับของ "แถว" ซึ่งรวมหลายใบ
//   วัดจาก backup_2026-09-17 เดือน ก.ย. · ชิป 24 ตัว ม่วง 22 · เปลี่ยนจุดส่งจริงใบเดียว
//   และใบที่ติ๊ก "กลับคันเดิม" 10 leg (9 เป็นส่งจุดใหม่จริง) ขึ้น "—" ทั้งหมด
//   → ดังผิดตรงที่ไม่ได้เกิด เงียบตรงที่เกิดจริง
//
// เทสนี้กันหกอย่าง · ไล่ทุกเจ้า ทุกงวด ในโหมดใบเดียว
//   1 แถวบนจอต้องตรงกับที่คิดเองจากบุ๊กกิ้งดิบ ไม่ขาดไม่เกิน
//   2 ชื่อจุดส่งต้องตรงกับที่คิดเอง · และขึ้น "—" เฉพาะแถวที่ไม่มีขากลับจริง
//   3 จุดรับขึ้น "—" เฉพาะแถวขากลับล้วน
//   4 ม่วงเฉพาะใบที่ตั้งจุดส่งใหม่จริง · ส่งที่เดิมเป็นเทาแต่ยังขึ้นชื่อ
//   5 "กลับคันเดิม" ต้องมีจุดส่ง อยู่บนแถวขาไปของคันเดิม และไม่ขยับเงิน/คัน/คน
//   6 จอแคบต้องไม่ล้นแนวนอน และหัวตารางครบ 17 คอลัมน์
//
// ⚠ ตัวคิดของเทสเขียนจาก SB_BOOKINGS ดิบเอง ไม่เรียก vbRows/vbDropInfo/bkDropOf ของหน้า
//   ถ้าเรียก สองฝั่งจะตรงกันเสมอแม้กติกาจะเพี้ยน — จับอะไรไม่ได้เลย
//   (ยืมได้แค่ vbArea ซึ่งเป็นตารางแปลชื่อไทย ไม่ใช่กติกาที่เทสนี้กัน)
import { open } from './_harness.mjs';

let bad = 0;
const ok   = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const { page, close } = await open({ blob: process.env.LAD, width: 1800, height: 1000 });
page.on('dialog', d => d.accept());
await page.evaluate(() => { const el = document.querySelector('.nav-item[data-view="vanbill"]'); if (el) nav(el); });
await page.waitForTimeout(1400);

/* ตัวคิดอิสระ · สร้างแถวของงวดที่เปิดอยู่ จากบุ๊กกิ้งดิบล้วน ๆ */
const MINE = `(function(){
  var P=vbPeriod(), sup=_vb.sup, okv={};
  (SB_VEHICLES||[]).forEach(function(v){
    if(String((v&&v.partnerName)||'').trim()===sup && (!_vb.van || v.id===_vb.van)) okv[v.id]=1; });
  function areaNm(id){ if(!id) return '';
    var a=(typeof bkV2GetArea==='function')?bkV2GetArea(id):null; return String((a&&a.name)||'').trim(); }
  function pick(b,sp){ return (sp?areaNm(sp.pickAreaId):'') || String((b&&b.pickupArea)||'').trim(); }
  /* กติกาจุดส่ง · เขียนจากช่องที่คนกรอกเก็บไว้ ไม่เรียก bkDropOf ของหน้า */
  function drop(b,sp){
    var nm='';
    if(sp && ((sp.dropHotel||'').trim() || sp.dropAreaId)){
      nm = (sp.dropAreaId?areaNm(sp.dropAreaId):'') || String(sp.dropHotel||'').trim();
    } else if(b && b.dropoffSame===false){
      nm = (b.dropoffAreaId?areaNm(b.dropoffAreaId):'')
        || String(b.dropoffHotelName||b.dropoffArea||'').trim();
    }
    var pk=pick(b,sp);
    return { nm:(nm||pk), chg:(!!nm && nm!==pk) };
  }
  var rows={}, pend=[], sameLegs=0;
  (SB_BOOKINGS||[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    (b.trips||[]).forEach(function(t){
      var ds=t.date||''; if(ds<P.from || ds>P.to) return;
      var O=(typeof bkOpsRead==='function')?bkOpsRead(b,ds):(b.ops||{});
      var sps=(Array.isArray(O.vanSplits)&&O.vanSplits.length)?O.vanSplits:[null];
      sps.forEach(function(sp){
        var vid=sp?sp.vanId:O.vanId;
        if(vid && okv[vid]){
          var k=ds+'~'+(t.routeId||'')+'~'+vid;
          if(!rows[k]) rows[k]={picks:{}, drops:{}, ret:0, same:0, retOnly:0};
          var p=pick(b,sp); if(p) rows[k].picks[p]=1;
          var rsv=(sp && sp.returnSameVan!=null) ? !!sp.returnSameVan : !!O.returnSameVan;
          if(rsv){ var d0=drop(b,sp); rows[k].same++; sameLegs++;
                   if(d0.nm) rows[k].drops[d0.nm]=(rows[k].drops[d0.nm]||0)|(d0.chg?1:0); }
        }
        var rid=sp?sp.vanReturnId:O.vanReturnId;
        if(rid && okv[rid]){ var d=drop(b,sp);
          pend.push({k:ds+'~'+(t.routeId||'')+'~'+rid, nm:d.nm, chg:d.chg}); }
      });
    });
  });
  pend.forEach(function(x){
    var r=rows[x.k];
    if(!r) r=rows[x.k+'~R']=rows[x.k+'~R']||{picks:{}, drops:{}, ret:0, same:0, retOnly:1};
    r.ret++;
    if(x.nm) r.drops[x.nm]=(r.drops[x.nm]||0)|(x.chg?1:0);
  });
  return { rows:rows, sameLegs:sameLegs };
})()`;

/* เทียบหนึ่งงวด · คืนรายการที่ผิดกลับมาให้ฝั่ง node ตัดสิน */
const CHECK = `(function(){
  var mine=${MINE}, want={};
  Object.keys(mine.rows).forEach(function(k){
    var r=mine.rows[k];
    want[k]={ drops:Object.keys(r.drops).map(function(a){ return vbArea(a)+(r.drops[a]?'!':''); }).sort(),
              n:Object.keys(r.drops).length, retOnly:!!r.retOnly, same:r.same };
  });
  var rows=vbRows();
  var trs=[].slice.call(document.querySelectorAll('#vanbill-host .vb-t tbody tr'))
            .filter(function(tr){ return !tr.classList.contains('vb-ex') && tr.children.length>=8; });
  if(rows.length!==trs.length) return { fatal:'แถวใน vbRows '+rows.length+' แต่บนจอ '+trs.length };
  var got={};
  rows.forEach(function(r,i){
    var td=trs[i].children;
    got[r.date+'~'+r.routeId+'~'+r.vanId+(r.ret?'~R':'')]={
      drops:[].slice.call(td[3].querySelectorAll('.vb-area')).map(function(s){
              return s.textContent.trim()+(s.classList.contains('alt')?'!':''); })
             .filter(function(t){ return t!=='—'; }).sort(),
      dash:td[3].textContent.trim()==='—',
      pickDash:td[2].textContent.trim()==='—',
      sameTag:/พากลับเอง/.test(td[1].textContent),
      isRet:!!r.ret };
  });
  var miss=[], extra=[], wName=[], wColor=[], wDash=[], wPick=[], wSame=[];
  var nChg=0, nSame=0, nDash=0;
  Object.keys(want).forEach(function(k){ if(!got[k]) miss.push(k); });
  Object.keys(got).forEach(function(k){ if(!want[k]) extra.push(k); });
  Object.keys(want).forEach(function(k){
    var w=want[k], g=got[k]; if(!g) return;
    var strip=function(A){ return A.map(function(x){ return x.replace(/!$/,''); }).sort().join('|'); };
    if(strip(w.drops)!==strip(g.drops)) wName.push(k+' ได้['+g.drops+'] ควร['+w.drops+']');
    else if(w.drops.join('|')!==g.drops.join('|')) wColor.push(k+' ได้['+g.drops+'] ควร['+w.drops+']');
    if((w.n===0)!==g.dash) wDash.push(k+' จุดส่ง'+(g.dash?'เป็นขีด':'ไม่เป็นขีด')+' แต่คิดเองได้ '+w.n);
    if(w.retOnly!==g.pickDash) wPick.push(k+' จุดรับ'+(g.pickDash?'เป็นขีด':'ไม่เป็นขีด'));
    if(w.same>0){
      if(g.dash) wSame.push(k+' กลับคันเดิมแต่จุดส่งเป็นขีด');
      else if(g.isRet) wSame.push(k+' กลับคันเดิมไปสร้างแถวขากลับใหม่');
      else if(!g.sameTag) wSame.push(k+' กลับคันเดิมแต่ไม่มีป้าย');
    }
    w.drops.forEach(function(d){ /!$/.test(d)?nChg++:nSame++; });
    if(g.dash) nDash++;
  });
  return { rows:Object.keys(want).length, miss:miss, extra:extra, wName:wName, wColor:wColor,
           wDash:wDash, wPick:wPick, wSame:wSame, nChg:nChg, nSame:nSame, nDash:nDash,
           sameLegs:mine.sameLegs };
})()`;

const YMS = ['2026-06', '2026-08', '2026-09'];
const sups = await page.evaluate(() => { vbMode('one'); return vbSuppliers(); });
const T = { rows:0, miss:[], extra:[], wName:[], wColor:[], wDash:[], wPick:[], wSame:[],
            nChg:0, nSame:0, nDash:0, sameLegs:0, fatal:[], periods:0 };
for (const ym of YMS) for (const s of sups) {
  for (const p of [1, 2, 3]) {
    await page.evaluate(([yy, ss, pp]) => { _vb.ym = yy; _vb.sup = ss; _vb.per = pp; _vb.van = ''; renderVanBill(); }, [ym, s, p]);
    await page.waitForTimeout(120);
    const r = await page.evaluate(CHECK);
    if (r.fatal) { T.fatal.push(s + ' งวด ' + p + ' · ' + r.fatal); continue; }
    if (!r.rows) continue;
    T.periods++;
    T.rows += r.rows; T.nChg += r.nChg; T.nSame += r.nSame; T.nDash += r.nDash; T.sameLegs += r.sameLegs;
    ['miss','extra','wName','wColor','wDash','wPick','wSame'].forEach(k =>
      r[k].forEach(x => T[k].push(s + ' ง' + p + ' · ' + x)));
  }
}

if (T.fatal.length) fail('อ่านตารางไม่ตรงกับ vbRows · ' + T.fatal.slice(0, 2).join(' | '));
else if (!T.rows) fail('ไม่มีแถวเลยทั้งเดือน · เทสนี้ไม่ได้ทดสอบอะไร');
else if (T.miss.length || T.extra.length)
  fail('แถวไม่ตรงกับที่คิดเอง · ขาด ' + T.miss.slice(0,2).join(', ') + ' เกิน ' + T.extra.slice(0,2).join(', '));
else ok('ไล่ ' + T.periods + ' งวดของ ' + sups.length + ' เจ้า ใน ' + YMS.length + ' เดือน · ' + T.rows + ' แถว ตรงกับที่คิดเองจากบุ๊กกิ้งดิบ');

if (T.wName.length) fail('ชื่อจุดส่งไม่ตรง · ' + T.wName.slice(0, 3).join(' | '));
else ok('ชื่อจุดส่งทุกแถวตรงกับที่คิดเอง');

if (T.wDash.length) fail('ช่องจุดส่งเป็นขีดผิดแถว · ' + T.wDash.slice(0, 3).join(' | '));
else ok('จุดส่งขึ้น "—" เฉพาะแถวที่ไม่มีขากลับจริง · ' + T.nDash + ' จาก ' + T.rows + ' แถว');

if (T.wPick.length) fail('ช่องจุดรับเป็นขีดผิดแถว · ' + T.wPick.slice(0, 3).join(' | '));
else ok('จุดรับขึ้น "—" เฉพาะแถวขากลับล้วน');

if (T.wColor.length) fail('สีชิปจุดส่งผิด · ' + T.wColor.slice(0, 3).join(' | '));
else if (!T.nChg && !T.nSame) fail('ไม่มีชิปจุดส่งเลยทั้งเดือน · ข้อสีไม่ได้ทดสอบอะไร');
else if (!T.nSame) fail('ไม่มีเคส "ส่งที่เดิม" เลย · ข้อสีทดสอบได้ด้านเดียว');
else ok('สีชิปตรงเจตนาของใบ · ตั้งจุดส่งใหม่ (ม่วง) ' + T.nChg + ' · ส่งที่เดิม (เทา แต่ยังขึ้นชื่อ) ' + T.nSame);

if (!T.sameLegs) console.log('  ! ทั้งเดือนไม่มีใบที่ติ๊ก "กลับคันเดิม" · ข้อนั้นข้ามไป');
else if (T.wSame.length) fail('กลับคันเดิมยังไม่ถูก · ' + T.wSame.slice(0, 3).join(' | '));
else ok('กลับคันเดิม ' + T.sameLegs + ' ใบ · มีจุดส่ง อยู่บนแถวขาไปเดิม และติดป้ายไว้');

/* ══ กลับคันเดิมต้องไม่ขยับตัวเงินและจำนวนคัน ══════════════════════════
   ปิดธงชั่วคราวแล้ววัดใหม่ · จำนวนแถว จำนวนคน และคนที่ขายไปแล้วต้องเท่าเดิมเป๊ะ
   ต่างเมื่อไหร่ = เผลอเพิ่มเที่ยวหรือเพิ่มคนจากเที่ยวที่ขายไปแล้ว = เรียกเก็บซ้ำ */
const C = await page.evaluate(([sups, yms]) => {
  const sum = () => {
    let rows = 0, pax = 0, bkPax = 0, retPax = 0;
    yms.forEach(ym => sups.forEach(s => [1, 2, 3].forEach(p => {
      _vb.ym = ym; _vb.sup = s; _vb.per = p; _vb.van = '';
      vbRows().forEach(r => { rows++; pax += r.pax; bkPax += r.bkPax; retPax += (r.retPax || 0); });
    })));
    return { rows, pax, bkPax, retPax };
  };
  const after = sum();
  const touched = [];
  (SB_BOOKINGS || []).forEach(b => (b.trips || []).forEach(t => {
    const O = (typeof bkOpsRead === 'function') ? bkOpsRead(b, t.date || '') : (b.ops || {});
    if (!O) return;
    if (O.returnSameVan) { touched.push(O); O.returnSameVan = false; }
    (O.vanSplits || []).forEach(s => { if (s && s.returnSameVan) { touched.push(s); s.returnSameVan = false; } });
  }));
  const before = sum();
  touched.forEach(o => { o.returnSameVan = true; });
  const back = sum();
  return { before, after, back, touched: touched.length };
}, [sups, YMS]);
if (!C.touched) console.log('  ! ไม่มีธงกลับคันเดิมให้ปิด · ข้อตัวเงินข้ามไป');
else {
  const moved = ['rows', 'pax', 'bkPax', 'retPax'].filter(k => C.before[k] !== C.after[k]);
  if (moved.length) fail('กลับคันเดิมไปขยับ ' + moved.join(', ') + ' · ปิดธง '
    + JSON.stringify(C.before) + ' เปิดธง ' + JSON.stringify(C.after));
  else if (JSON.stringify(C.back) !== JSON.stringify(C.after)) fail('คืนธงกลับแล้วไม่เหมือนเดิม');
  else ok('กลับคันเดิม ' + C.touched + ' ใบ · ไม่ขยับจำนวนแถว จำนวนคน หรือคนที่ขายไปแล้ว');
}

/* ══ จอแคบ ═══════════════════════════════════════════════════════════ */
await page.evaluate(s => { _vb.ym = '2026-09'; _vb.sup = s; _vb.per = 2; _vb.van = ''; renderVanBill(); }, sups[0]);
for (const w of [1440, 1100]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(350);
  const D = await page.evaluate(() => ({
    ovf: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    head: document.querySelectorAll('#vanbill-host .vb-t thead th').length
  }));
  if (D.head !== 17) fail(w + 'px · หัวตารางมี ' + D.head + ' คอลัมน์ ควรเป็น 17');
  else if (D.ovf > 2) fail(w + 'px · ล้นแนวนอน ' + D.ovf + 'px');
  else ok(w + 'px · ตาราง 17 คอลัมน์ครบ ไม่ล้นแนวนอน');
}

console.log(bad ? ('\nพัง ' + bad) : '\nพัง 0');
await close();
process.exit(bad ? 1 : 0);
