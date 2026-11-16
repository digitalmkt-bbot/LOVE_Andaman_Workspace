/* ══ §chEdit · เพิ่มและแก้ไขเรือ ในหน้า Boat Status ═══════════════════════════════
   เดิมกล่องนี้มีแต่ "เพิ่ม" · เรือเช่าที่กรอกผิดตั้งแต่แรกแก้ไม่ได้เลยสักช่อง
   เจอจริง · LKC777 ใส่ประเภทเป็น Catamaran ไว้ แล้วเลือกลงใบจองไม่ได้
   ทางแก้ตอนนั้นคือไปเพิ่มประเภท Catamaran เข้าไปในระบบ ทั้งที่ควรแก้ที่ตัวเรือ

   ปุ่ม ✎ ข้างชื่อเรือในแผงขวาก็กดแล้วเงียบมานาน · startEditName/Cap/Type
   ไปสั่ง element ของแผงเก่า (#bdp) ซึ่ง renderBoats ซ่อนแล้วย้ายไปไว้ท้าย body
   input ที่มันสั่งให้โผล่จึงโผล่ในที่ที่ไม่มีใครมองเห็น · ตอนนี้ชี้มาที่กล่องนี้แทน

   กล่องเดียวสองหน้าที่
     เพิ่ม   · openCharterModal()        → เรือเช่าใหม่ พร้อมช่วงเช่าช่วงแรก
     แก้ไข   · openBoatEdit(boatId)      → ชื่อ ประเภท ที่นั่ง ท่า (+ ช่วงเช่า ถ้าเป็นเรือเช่า)
   เรือบริษัทไม่มีบล็อกช่วงเช่า · สถานะของเรือบริษัทแก้ที่ไทม์ไลน์ด้านขวาเหมือนเดิม
   ═══════════════════════════════════════════════════════════════════════════════ */
var _chEditId = '';                       // '' = โหมดเพิ่ม · มีค่า = กำลังแก้ลำนั้น
var _chEditLogId = '';                    // ช่วงเช่าที่กล่องนี้กำลังแก้อยู่ · '' = สร้างช่วงใหม่

const CH_PIER_LOC = { tublamu:'Tub Lamu Pier', panwa:'Visit Panwa', ranong:'Ranong Pier' };

/* ช่วงเช่าที่ควรเอาขึ้นมาให้แก้ · ไล่จากที่คนถามถึงบ่อยที่สุด
   ช่วงที่คลุมวันนี้ → ช่วงถัดไปที่ใกล้ที่สุด → ช่วงล่าสุดที่ผ่านมาแล้ว
   ไม่มีสักช่วง = คืน null แล้วให้กล่องสร้างช่วงใหม่ให้ */
function chPickPeriod(b){
  const L = (b && Array.isArray(b.log)) ? b.log.filter(e=>e&&e.from) : [];
  if(!L.length) return null;
  const now = (typeof TODAY_STR!=='undefined') ? TODAY_STR : new Date().toISOString().slice(0,10);
  const cur = L.find(e=>e.from<=now && (!e.to||e.to>=now));
  if(cur) return cur;
  const next = L.filter(e=>e.from>now).sort((a,b2)=>a.from.localeCompare(b2.from))[0];
  if(next) return next;
  return L.slice().sort((a,b2)=>String(b2.to||b2.from).localeCompare(String(a.to||a.from)))[0] || null;
}

function chSetPierPill(val){
  document.getElementById('ch-pier').value = val;
  document.querySelectorAll('#ch-pier-pills .loc-pill').forEach(p=>{
    p.classList.toggle('on', /tublamu/.test(p.getAttribute('onclick'))?val==='tublamu'
      : /panwa/.test(p.getAttribute('onclick'))?val==='panwa'
      : /ranong/.test(p.getAttribute('onclick'))?val==='ranong' : false);
  });
}

function chSyncDates(){
  const fromInp=document.getElementById('ch-from'), toInp=document.getElementById('ch-to');
  fromInp.onchange=()=>{ if(!toInp.value||toInp.value<fromInp.value) toInp.value=fromInp.value; };
}

function openCharterModal(){
  _chEditId=''; _chEditLogId='';
  document.getElementById('ch-edit-id').value='';
  document.getElementById('ch-title').textContent='เพิ่มเรือเช่า';
  document.getElementById('ch-sub').textContent='เพิ่มเพื่อ Availability เท่านั้น — ไม่แสดงใน Company Asset';
  document.getElementById('ch-hint').style.display='none';
  document.getElementById('ch-period').style.display='';
  ['ch-name','ch-note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ch-cap').value='40';
  document.getElementById('ch-type').value='Speedboat';
  document.getElementById('ch-from').value=TODAY_STR;
  document.getElementById('ch-to').value=TODAY_STR;
  chSetPierPill('tublamu');
  if(typeof chCapSummary==='function') chCapSummary(null);   /* §capHist2 · เพิ่มเรือเช่าใหม่ ไม่มีช่วงที่นั่ง */
  openModal('charter-modal');
  chSyncDates();
}

/* แก้ไขเรือที่มีอยู่ · ใช้ได้ทั้งเรือเช่าและเรือบริษัท */
function openBoatEdit(id){
  const b=(typeof getBoat==='function')?getBoat(id):null;
  if(!b){ alert('Boat not found'); return; }
  const isCharter = b.ownership==='charter';
  _chEditId=b.id;
  document.getElementById('ch-edit-id').value=b.id;
  document.getElementById('ch-title').textContent = isCharter?'แก้ไขเรือเช่า':'แก้ไขข้อมูลเรือ';
  document.getElementById('ch-sub').textContent   = isCharter
    ? 'แก้ได้ทั้งข้อมูลเรือและช่วงวันที่เช่า'
    : 'ชื่อ ประเภท ที่นั่ง และท่าประจำ — สถานะแก้ที่ไทม์ไลน์ด้านขวา';
  document.getElementById('ch-name').value=b.name||'';
  document.getElementById('ch-type').value=b.type||'Speedboat';
  document.getElementById('ch-cap').value=b.cap||0;
  chSetPierPill(b.pier||'tublamu');

  const period=document.getElementById('ch-period');
  const hint=document.getElementById('ch-hint');
  if(!isCharter){
    _chEditLogId='';
    period.style.display='none';
    hint.style.display='none';
  } else {
    period.style.display='';
    const p=chPickPeriod(b);
    _chEditLogId=p?(p.id||''):'';
    document.getElementById('ch-from').value=p?(p.from||''):TODAY_STR;
    document.getElementById('ch-to').value=p?(p.to||''):TODAY_STR;
    document.getElementById('ch-note').value=p?(p.note||''):'';
    /* บอกให้ชัดว่ากำลังแก้ช่วงไหน · เรือเช่าหลายลำมีหลายช่วง
       ถ้าไม่บอก คนแก้จะนึกว่าแก้ทั้งลำ แล้วงงว่าทำไมช่วงอื่นไม่เปลี่ยน */
    const n=(b.log||[]).filter(e=>e&&e.from).length;
    const now=(typeof TODAY_STR!=='undefined')?TODAY_STR:'';
    let which='';
    if(!p) which='ลำนี้ยังไม่มีช่วงเช่าเลย · บันทึกแล้วจะสร้างช่วงแรกให้';
    else if(p.from<=now&&(!p.to||p.to>=now)) which='กำลังแก้ช่วงที่คลุมวันนี้';
    else if(p.from>now) which='วันนี้ไม่อยู่ในช่วงเช่าไหนเลย · กำลังแก้ช่วงถัดไปที่ใกล้ที่สุด';
    else which='วันนี้ไม่อยู่ในช่วงเช่าไหนเลย · กำลังแก้ช่วงล่าสุดที่ผ่านมาแล้ว';
    hint.innerHTML = which + (n>1?(' · ลำนี้มี '+n+' ช่วง'):'')
      + '<br>ช่วงอื่นเพิ่มหรือแก้ได้ที่ปฏิทินและรายการสถานะในแผงด้านขวา';
    hint.style.display='';
  }
  if(typeof chCapSummary==='function') chCapSummary(b);   /* §capHist2 · สรุป + ปุ่มเปิดหน้าต่างจัดการที่นั่ง (ตัวจัดการอยู่ Company Asset) */
  openModal('charter-modal');
  chSyncDates();
}

function chSelPier(val,el){
  document.getElementById('ch-pier').value=val;
  document.querySelectorAll('#ch-pier-pills .loc-pill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
}

function saveCharterBoat(){
  const name=document.getElementById('ch-name').value.trim();if(!name){alert('กรุณาระบุชื่อเรือ');return;}
  const pier=document.getElementById('ch-pier').value;
  const type=document.getElementById('ch-type').value;
  const cap=parseInt(document.getElementById('ch-cap').value)||0;
  if(!(cap>0)){alert('กรุณาระบุจำนวนที่นั่ง');return;}

  /* ── โหมดแก้ไข ─────────────────────────────────────────────────────── */
  if(_chEditId){
    const b=(typeof getBoat==='function')?getBoat(_chEditId):null;
    if(!b){alert('Boat not found');return;}
    if(typeof chCapPreSave==='function' && !chCapPreSave()) return;   /* §capHist · ตรวจช่วงที่นั่งก่อนแก้อะไร */
    const isCharter=b.ownership==='charter';
    if(isCharter){
      const from=document.getElementById('ch-from').value;
      const to=document.getElementById('ch-to').value;
      if(!from){alert('กรุณาระบุวันที่เริ่ม');return;}
      if(!to){alert('กรุณาระบุวันที่สิ้นสุด');return;}
      if(to<from){alert('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม');return;}
      const note=document.getElementById('ch-note').value.trim();
      b.log=Array.isArray(b.log)?b.log:[];
      /* §chEdit · ช่วงเช่าซ้อนกันเองไม่มีความหมาย · ลำหนึ่งวันหนึ่งเช่าอยู่หรือไม่เช่า
         และตัวอ่านสถานะใช้ find() ตัวแรกที่เจอชนะ · ช่วงที่ซ้อนอยู่ข้างหลังจึงเงียบหายไปเฉย ๆ
         เตือนพร้อมบอกว่าไปชนใบไหน แล้วให้คนตัดสิน · ยืดก่อนค่อยไปตัดอีกใบก็เป็นลำดับที่ใช้จริง */
      const clash=b.log.filter(x=>x&&x.from&&x.id!==_chEditLogId)
                       .filter(x=>x.from<=to&&(!x.to||x.to>=from));
      if(clash.length){
        const lines=clash.slice(0,3).map(x=>x.from+' - '+(x.to||'open')).join(', ');
        if(!confirm('This range overlaps another charter period on this boat ('+lines+').\n'
                   +'Overlapping periods hide each other - only the first one is read.\n\nSave anyway?')) return;
      }
      let e=_chEditLogId?b.log.find(x=>x&&x.id===_chEditLogId):null;
      let _chNew=false; if(!e){ e={id:'sl'+Date.now(),s:'available'}; b.log.push(e); _chNew=true; }
      /* ที่ตั้งของช่วงนั้น · เขียนทับเฉพาะตอนที่มันยังเป็นค่าที่ระบบเติมให้จากท่าเดิม
         ถ้ามีคนไปตั้งที่ตั้งละเอียดไว้เอง (อู่ ท่าอื่น จังหวัดอื่น) อย่าไปลบของเขา */
      const oldAuto=CH_PIER_LOC[b.pier]||b.pier;
      if(!e.loc||e.loc===oldAuto) e.loc=CH_PIER_LOC[pier]||pier;
      e.from=from; e.to=to; e.note=note;
      if(typeof flAudMark==='function') flAudMark([e.id], _chNew?'c':'u');   /* §flAud */
    }
    if(typeof flAudMark==='function') flAudMark([b.id],'u');
    b.name=name; b.type=type; b.cap=cap; b.pier=pier;
    if(typeof chCapApply==='function') chCapApply(b);   /* §capHist · ช่วงที่นั่ง + ที่นั่งตามทะเบียน */
    closeModal('charter-modal');
    _chEditId=''; _chEditLogId='';
    if(typeof renderBoats==='function') renderBoats();
    save('config');
    return;
  }

  /* ── โหมดเพิ่ม ─────────────────────────────────────────────────────── */
  const from=document.getElementById('ch-from').value;
  const to=document.getElementById('ch-to').value;
  if(!from){alert('กรุณาระบุวันที่เริ่ม');return;}
  if(!to){alert('กรุณาระบุวันที่สิ้นสุด');return;}
  if(to<from){alert('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม');return;}
  const note=document.getElementById('ch-note').value.trim();
  BOATS.push({
    id:'b'+Date.now(),
    name,
    type,
    pier,
    cap,
    ownership:'charter',
    log:[{id:'sl'+Date.now(),s:'available',from,to,loc:CH_PIER_LOC[pier]||pier,note}]
  });
  { const _nb=BOATS[BOATS.length-1]; if(typeof flAudMark==='function') flAudMark([_nb.id, _nb.log[0].id],'c'); }   /* §flAud · ใครกด + เรือเช่า */
  closeModal('charter-modal');renderBoats();save('config');
}

/* ══ §capHist (2026-11-14) · ส่วน "ที่นั่งตามช่วงวันที่" ในหน้าต่างแก้ไขเรือ
   แก้ในร่าง _chCapDraft ก่อน · กดบันทึกของหน้าต่างค่อยเขียนลง boat.capHist + licensePax แล้ว save('config')
   ช่วงถาวร = ไม่ใส่วันจบ (ใช้ไปจนมีช่วงใหม่) · ช่วงชั่วคราว = มีวันจบ ครบแล้วกลับไปค่าก่อนหน้าเอง
   ตัวเลือกช่วงที่ใช้ในแต่ละวัน = boatCapHistPick (08-app.js) · server ใช้กติกาเดียวกัน (migration 048) ══ */
var _chCapDraft=null, _chCapBoatId='';
function chCapE(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function chCapD(ds){ var x=/^(\d{4})-(\d{2})-(\d{2})/.exec(ds||''); if(!x) return '—';
  return (+x[3])+' '+['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][+x[2]-1]+' '+x[1]; }
function chCapToday(){ return (typeof TODAY_STR!=='undefined'&&TODAY_STR)||new Date().toISOString().slice(0,10); }
function chCapPick(date){ return (typeof boatCapHistPick==='function')?boatCapHistPick(_chCapDraft||[],date):null; }
function chCapBaseVal(){ var el=document.getElementById('capm-base'); return parseInt(el&&el.value,10)||0; }
function chCapLicVal(){ var el=document.getElementById('ch-lic'); return parseInt(el&&el.value,10)||0; }
/* §capHist2 · หน้าต่างจัดการที่นั่งของเรือ (เปิดจาก Company Asset › Boats · หรือปุ่มในหน้าต่างแก้ไขเรือของ Boat Status)
   แก้ในร่าง · กดบันทึกของหน้าต่างนี้ = เขียน cap ตั้งต้น + capHist + licensePax แล้ว save('config') */
function capMgrOpen(boatId){
  var b=(typeof getBoat==='function')?getBoat(boatId):null; if(!b){ alert('Boat not found'); return; }
  var old=document.getElementById('capm-ov'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='capm-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(10,18,48,.56);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto';
  ov.innerHTML='<div style="background:#fff;border-radius:16px;width:min(640px,100%);box-shadow:0 24px 70px rgba(2,10,30,.45);font-family:\'DM Sans\',\'IBM Plex Sans Thai\',sans-serif;color:#0F1B3D">'
    +'<div style="padding:18px 22px 6px;display:flex;align-items:flex-start;gap:12px"><div style="flex:1"><div style="font-size:10.5px;font-weight:700;letter-spacing:.08em;color:#8A8F9C">COMPANY ASSET · BOAT</div>'
      +'<div style="font-size:19px;font-weight:800">💺 ที่นั่ง · '+chCapE(b.name||b.id)+'</div><div style="font-size:12px;color:#6B7385;margin-top:2px">'+chCapE(b.type||'')+' · ตั้งที่นั่งตามช่วงวันที่ · วันที่ผ่านมาแล้วไม่เปลี่ยนตาม</div></div>'
      +'<button type="button" onclick="capMgrClose()" style="border:1px solid #E4E1D9;background:#fff;border-radius:50%;width:34px;height:34px;font-size:18px;cursor:pointer;line-height:1">×</button></div>'
    +'<div style="padding:8px 22px 4px"><label style="font-size:11px;font-weight:600;color:#6B7385">ที่นั่งตั้งต้น (Capacity) · ใช้กับวันที่ไม่มีช่วงไหนคลุม</label>'
      +'<div style="display:flex;align-items:center;gap:10px;margin-top:4px"><input id="capm-base" type="number" min="1" value="'+(+b.cap||0)+'" style="width:110px;border:1px solid #E4E1D9;border-radius:9px;padding:8px 11px;font-size:18px;font-weight:800;font-family:\'DM Mono\',monospace;background:#FBFAF7">'
      +'<span style="font-size:11px;color:#A0570A">แก้ค่านี้ = มีผลทุกวันที่ไม่มีช่วง รวมวันที่ผ่านมา · ถ้าเปลี่ยนจริงให้เพิ่มเป็นช่วงด้านล่างแทน</span></div></div>'
    +'<div id="capm-host" style="padding:6px 22px 0"></div>'
    +'<div style="padding:12px 22px 18px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #F0EDE6"><button type="button" onclick="capMgrClose()" style="border:1px solid #E4E1D9;background:#fff;color:#5F5E5A;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>'
      +'<button type="button" onclick="capMgrSave()" style="border:none;background:#0F1B3D;color:#fff;border-radius:10px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">บันทึก</button></div>'
    +'</div>';
  ov.addEventListener('mousedown',function(e){ if(e.target===ov) capMgrClose(); });
  document.body.appendChild(ov);
  _chCapBoatId=b.id;
  _chCapDraft=JSON.parse(JSON.stringify(Array.isArray(b.capHist)?b.capHist:[]));
  document.getElementById('capm-host').dataset.lic=String(+b.licensePax||'');
  document.getElementById('capm-base').oninput=function(){ if(_chCapDraft) chCapRender(); };
  chCapRender();
}
function capMgrClose(){ var ov=document.getElementById('capm-ov'); if(ov) ov.remove(); _chCapDraft=null; _chCapBoatId=''; }
function capMgrSave(){
  var b=(typeof getBoat==='function')?getBoat(_chCapBoatId):null; if(!b){ capMgrClose(); return; }
  var base=chCapBaseVal(); if(!(base>0)){ alert('ใส่ที่นั่งตั้งต้นก่อนครับ'); return; }
  if(!chCapPreSave()) return;
  if(base!==(+b.cap||0) && !confirm('เปลี่ยนที่นั่งตั้งต้นจาก '+(+b.cap||0)+' เป็น '+base+'\n\nค่านี้มีผลกับทุกวันที่ไม่มีช่วงคลุม รวมวันที่ผ่านมาแล้ว\nถ้าตั้งใจเปลี่ยนตั้งแต่วันหนึ่งเป็นต้นไป ให้ยกเลิกแล้วเพิ่มเป็นช่วงแทน\n\nยืนยันเปลี่ยนค่าตั้งต้น?')) return;
  b.cap=base;
  chCapApply(b);
  if(typeof flAudMark==='function') flAudMark([b.id],'u');
  capMgrClose();
  if(typeof save==='function') save('config');
  try{ if(typeof flRenderAsset==='function') flRenderAsset(); }catch(_){}
  try{ if(typeof renderBoats==='function') renderBoats(); }catch(_){}
}
/* บรรทัดสรุปใต้ช่อง Capacity ในหน้าต่างแก้ไขเรือ (Boat Status) */
function chCapSummary(b){
  var host=document.getElementById('ch-caphist'); if(!host) return;
  _chCapDraft=null;
  if(!b){ host.innerHTML=''; host.style.display='none'; return; }
  var today=chCapToday(), H=Array.isArray(b.capHist)?b.capHist:[];
  var now=(typeof boatCapHistPick==='function')?boatCapHistPick(H,today):null;
  var fut=H.filter(function(h){ return h&&h.from>today; }).sort(function(a,z){ return a.from<z.from?-1:1; })[0];
  host.style.display='';
  host.innerHTML='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#F6FAFE;border:1px solid #CFE0EF;border-radius:10px;padding:8px 12px;margin:-4px 0 12px;font-size:12px;color:#33405A">'
    +'<span>💺 ขายวันนี้ <b style="font-family:\'DM Mono\',monospace">'+(now?(+now.cap):(+b.cap||0))+'</b>'+(now?(' <span style="color:#6B7385">ตามช่วง '+chCapE(now.reason||'')+'</span>'):'')
    +(fut?(' · ถัดไป <b style="font-family:\'DM Mono\',monospace;color:#0C447C">'+(+fut.cap)+'</b> ตั้งแต่ '+chCapD(fut.from)):'')
    +(b.licensePax?(' · ทะเบียน '+(+b.licensePax)):'')+'</span>'
    +'<button type="button" onclick="closeModal(\'charter-modal\');capMgrOpen(\''+chCapE(b.id)+'\')" style="margin-left:auto;border:1px solid #CFE0EF;background:#fff;color:#185FA5;border-radius:8px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">จัดการช่วงที่นั่ง ›</button></div>';
}
function chCapRender(){
  var host=document.getElementById('capm-host'); if(!host||!_chCapDraft) return;
  var keep={}; ['chc-from','chc-to','chc-cap','chc-reason','chc-note','ch-lic'].forEach(function(id){ var el=document.getElementById(id); if(el) keep[id]=el.value; });
  var today=chCapToday(), base=chCapBaseVal();
  var hNow=chCapPick(today), capNow=hNow?(+hNow.cap):base;
  var fut=_chCapDraft.filter(function(h){ return h&&h.from>today; }).sort(function(a,b){ return a.from<b.from?-1:1; })[0];
  var lic=(keep['ch-lic']!=null)?keep['ch-lic']:(host.dataset.lic||'');
  var kpi=function(t,v,s,c){ return '<div style="flex:1;min-width:120px;background:#fff;border:1px solid #E1EAF3;border-radius:10px;padding:8px 11px"><div style="font-size:10px;color:#6B7385;font-weight:700">'+t+'</div><div style="font-size:22px;font-weight:800;font-family:\'DM Mono\',monospace;line-height:1.2;'+(c||'')+'">'+v+'</div><div style="font-size:10px;color:#8A8F99">'+s+'</div></div>'; };
  var rows=_chCapDraft.map(function(h,i){ return {h:h,i:i}; }).sort(function(a,b){ return a.h.from<b.h.from?1:(a.h.from>b.h.from?-1:0); });
  var rowHtml=rows.map(function(x){ var h=x.h, act=(hNow===h), tmp=!!h.to, past=(h.to&&h.to<today);
      var tag=act?'<span style="background:#DDF1EA;color:#0B5A43">ใช้อยู่</span>':(h.from>today?'<span style="background:#E6F1FB;color:#0C447C">ถัดไป</span>':(past?'<span style="background:#EEF0F4;color:#8A8F99">จบแล้ว</span>':''));
      return '<div style="display:grid;grid-template-columns:132px 46px 1fr 22px;gap:8px;align-items:start;padding:8px 10px;border-top:1px solid #EEF2F7;'+(tmp?'background:#FDF6F4;':'')+'">'
        +'<div style="font-family:\'DM Mono\',monospace;font-size:11.5px;line-height:1.5">'+chCapD(h.from)+(h.to?(' –<br>'+chCapD(h.to)):' →')
          +'<div style="margin-top:2px">'+(tag?tag.replace('<span style="','<span style="font-family:inherit;font-size:9.5px;font-weight:700;border-radius:4px;padding:1px 6px;'):'')+(tmp?' <span style="font-size:9.5px;font-weight:700;border-radius:4px;padding:1px 6px;background:#FBE1DC;color:#A32D2D">ชั่วคราว</span>':'')+'</div></div>'
        +'<div style="font-family:\'DM Mono\',monospace;font-weight:800;font-size:15px;text-align:center;'+(tmp?'color:#A32D2D':'')+'">'+(+h.cap)+'</div>'
        +'<div style="font-size:12px;line-height:1.45"><b>'+chCapE(h.reason||'—')+'</b>'+(h.note?('<div style="font-size:11px;color:#6B7385">Note: '+chCapE(h.note)+'</div>'):'')
          +'<div style="font-size:10px;color:#9AA1AE">'+chCapE(h.by||'')+(h.at?(' · '+chCapE(String(h.at).slice(0,10))):'')+'</div></div>'
        +'<button type="button" onclick="chCapDel('+x.i+')" title="ลบช่วงนี้" style="border:none;background:transparent;color:#B0B6C2;font-size:16px;cursor:pointer;line-height:1">×</button></div>'; }).join('');
  var inp='border:1px solid #E4E1D9;border-radius:8px;padding:7px 9px;font-size:12.5px;background:#FBFAF7;width:100%;box-sizing:border-box;font-family:inherit';
  var lb='font-size:10.5px;font-weight:600;color:#6B7385;display:block;margin-bottom:3px';
  host.innerHTML='<div style="border:1.5px solid #CFE0EF;background:#F6FAFE;border-radius:12px;padding:12px 14px;margin:4px 0 12px">'
    +'<div style="font-size:13px;font-weight:800;margin-bottom:8px">💺 ที่นั่งตามช่วงวันที่ <span style="font-size:10.5px;font-weight:500;color:#6B7385">วันก่อนช่วงยังใช้ค่าเดิม · ตัวเลขย้อนหลังไม่เปลี่ยน</span></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
      +kpi('ที่นั่งขาย · วันนี้', capNow, hNow?('ตามช่วง '+chCapE(hNow.reason||'')):'ค่าตั้งต้น (Capacity ด้านบน)')
      +kpi(fut?('ตั้งแต่ '+chCapD(fut.from)):'ช่วงถัดไป', fut?(+fut.cap):'—', fut?((+fut.cap-capNow>=0?'+':'')+(+fut.cap-capNow)+' จากวันนี้'):'ยังไม่มี', fut?'color:#0C447C':'color:#B0B6C2')
      +'<div style="flex:1;min-width:120px;background:#fff;border:1px solid #E1EAF3;border-radius:10px;padding:8px 11px"><div style="font-size:10px;color:#6B7385;font-weight:700">ตามทะเบียน (เพดาน)</div>'
        +'<input id="ch-lic" type="number" min="0" value="'+chCapE(lic)+'" placeholder="—" style="width:80px;border:1px solid #E4E1D9;border-radius:7px;padding:3px 7px;font-size:18px;font-weight:800;font-family:\'DM Mono\',monospace;margin:2px 0"><div style="font-size:10px;color:#8A8F99">ขายเกินนี้ไม่ได้</div></div>'
    +'</div>'
    +'<div style="background:#fff;border:1px solid #E1EAF3;border-radius:10px;overflow:hidden">'
      +'<div style="display:grid;grid-template-columns:132px 46px 1fr 22px;gap:8px;padding:6px 10px;background:#FAFBFD;font-size:10px;font-weight:700;color:#8A8F99;text-transform:uppercase;letter-spacing:.04em"><span>ช่วงวันที่</span><span style="text-align:center">ที่นั่ง</span><span>เหตุผล · Note</span><span></span></div>'
      +rowHtml
      +'<div style="display:grid;grid-template-columns:132px 46px 1fr 22px;gap:8px;padding:8px 10px;border-top:1px solid #EEF2F7;color:#6B7385;font-size:12px"><span style="font-size:11px">ค่าตั้งต้น'+(!hNow?' <span style="font-size:9.5px;font-weight:700;border-radius:4px;padding:1px 6px;background:#DDF1EA;color:#0B5A43">ใช้อยู่</span>':'')+'</span><span style="font-family:\'DM Mono\',monospace;font-weight:800;font-size:15px;text-align:center">'+base+'</span><span style="font-size:11px">วันที่ไม่มีช่วงไหนคลุม · แก้ที่ช่อง Capacity ด้านบน (มีผลทุกวันที่ไม่มีช่วง รวมวันที่ผ่านมา)</span><span></span></div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 76px;gap:8px;margin-top:10px">'
      +'<div><label style="'+lb+'">ตั้งแต่วันที่ *</label><input id="chc-from" type="date" style="'+inp+'" value="'+chCapE(keep['chc-from']||'')+'"></div>'
      +'<div><label style="'+lb+'">ถึงวันที่ <span style="font-weight:500;color:#A6AAB3">· ว่าง = ไม่มีกำหนด</span></label><input id="chc-to" type="date" style="'+inp+'" value="'+chCapE(keep['chc-to']||'')+'"></div>'
      +'<div><label style="'+lb+'">ที่นั่ง *</label><input id="chc-cap" type="number" min="1" style="'+inp+';text-align:center" value="'+chCapE(keep['chc-cap']||'')+'"></div>'
      +'<div style="grid-column:1/3"><label style="'+lb+'">เหตุผล *</label><input id="chc-reason" type="text" placeholder="เช่น เสริมเก้าอี้ 4 ตัว · ถอดเก้าอี้ส่งซ่อม" style="'+inp+'" value="'+chCapE(keep['chc-reason']||'')+'"></div>'
      +'<div style="display:flex;align-items:flex-end"><button type="button" onclick="chCapAdd()" style="width:100%;white-space:nowrap;border:1px solid #CFE0EF;background:#fff;color:#185FA5;border-radius:8px;padding:8px 6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ เพิ่มช่วง</button></div>'
      +'<div style="grid-column:1/4"><label style="'+lb+'">Note</label><textarea id="chc-note" rows="2" placeholder="รายละเอียดเพิ่ม · เลขใบตรวจ · นัดอู่ · ใครอนุมัติ" style="'+inp+';resize:vertical">'+chCapE(keep['chc-note']||'')+'</textarea></div>'
    +'</div>'
    +'<div style="margin-top:9px;font-size:11px;color:#7A4300;background:#FBEBD3;border-radius:8px;padding:7px 10px;line-height:1.55">ไม่ใส่วันจบ = ใช้ไปเรื่อยๆ จนมีช่วงใหม่ · ใส่วันจบ = ครบแล้วกลับไปค่าก่อนหน้าเอง · ช่วงที่ซ้อนกัน ช่วงชั่วคราวชนะ<br>กด <b>+ เพิ่มช่วง</b> แล้วกด <b>บันทึก</b> ด้านล่างจึงจะบันทึกจริง · ปรับเฉพาะวันที่ Boat Operation / By trip ยังใช้ได้และอยู่เหนือช่วง</div>'
    +'</div>';
}
function chCapReadForm(strict){
  var g=function(id){ var el=document.getElementById(id); return el?String(el.value||'').trim():''; };
  var f={from:g('chc-from'), to:g('chc-to'), cap:parseInt(g('chc-cap'),10)||0, reason:g('chc-reason'), note:g('chc-note')};
  var any=!!(f.from||f.to||f.cap||f.reason||f.note);
  if(!any) return {empty:true};
  var lic=chCapLicVal();
  if(!f.from) return {err:'ใส่วันที่เริ่มของช่วงก่อนครับ'};
  if(f.to && f.to<f.from) return {err:'วันจบต้องไม่ก่อนวันเริ่ม'};
  if(!(f.cap>0)) return {err:'ใส่จำนวนที่นั่งของช่วงนี้ก่อนครับ'};
  if(lic>0 && f.cap>lic) return {err:'ที่นั่ง '+f.cap+' เกินที่นั่งตามทะเบียน ('+lic+') · ถ้าทะเบียนเปลี่ยนแล้ว แก้ช่อง "ตามทะเบียน" ก่อน'};
  if(!f.reason) return {err:'ใส่เหตุผลด้วยครับ · จะได้รู้ทีหลังว่าทำไมที่นั่งเปลี่ยน'};
  return {row:f};
}
function chCapAdd(){
  var r=chCapReadForm(true);
  if(r.empty){ alert('กรอกช่วงที่จะเพิ่มก่อนครับ'); return false; }
  if(r.err){ alert(r.err); return false; }
  var f=r.row, today=chCapToday();
  if(f.from<today && !confirm('ช่วงนี้เริ่มก่อนวันนี้ ('+chCapD(f.from)+')\n\nที่ว่าง / Fill % / จุดคุ้มทุนของวันที่ผ่านมาในช่วงนี้จะเปลี่ยนตาม\nยืนยันใส่ย้อนหลัง?')) return false;
  var by=((typeof laBy==='function')&&laBy())||((typeof ME!=='undefined'&&ME&&(ME.name||ME.username)))||'—';
  _chCapDraft.push({id:'ch'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), from:f.from, to:f.to||null, cap:f.cap, reason:f.reason, note:f.note||'', by:by, at:new Date().toISOString()});
  ['chc-from','chc-to','chc-cap','chc-reason','chc-note'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  chCapRender(); return true;
}
function chCapDel(i){
  var h=_chCapDraft&&_chCapDraft[i]; if(!h) return;
  var today=chCapToday();
  var msg=(h.from<today)?('ลบช่วง '+chCapD(h.from)+(h.to?(' – '+chCapD(h.to)):' →')+' ('+h.cap+' ที่นั่ง)?\n\nช่วงนี้มีผลกับวันที่ผ่านมาแล้ว · ลบแล้วตัวเลขย้อนหลังของวันเหล่านั้นจะกลับไปใช้ค่าก่อนหน้า'):('ลบช่วง '+chCapD(h.from)+' ('+h.cap+' ที่นั่ง)?');
  if(!confirm(msg)) return;
  _chCapDraft.splice(i,1); chCapRender();
}
/* เรียกจาก saveCharterBoat ก่อนแก้อะไร · ช่วงที่กรอกค้างไว้แต่ยังไม่กด + ให้เพิ่มให้เลย (กันลืม) · false = หยุดบันทึก */
function chCapPreSave(){
  if(!_chCapDraft) return true;
  var r=chCapReadForm(true);
  if(r.err){ alert('ช่วงที่นั่งที่กรอกไว้ยังไม่ครบ: '+r.err); return false; }
  if(r.row){ if(!chCapAdd()) return false; }
  var lic=chCapLicVal(), base=chCapBaseVal();
  if(lic>0 && base>lic && !confirm('Capacity '+base+' มากกว่าที่นั่งตามทะเบียน ('+lic+') · ระบบจะขายได้แค่ '+lic+'\nบันทึกต่อ?')) return false;
  return true;
}
function chCapApply(b){
  if(!_chCapDraft || !b || b.id!==_chCapBoatId) return;
  b.capHist=_chCapDraft.slice();
  var lic=chCapLicVal(); if(lic>0) b.licensePax=lic;
  _chCapDraft=null;
}

/* ══ §bmRedesign (2026-11-14) · หน้าต่าง Edit เรือ (Company Asset) · แถบลัด + การ์ดที่นั่ง ══ */
function bmGo(id){ var el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }
function bmSeatCheck(){
  var w=document.getElementById('fm-boat-capwarn'); if(!w) return;
  var cap=parseInt((document.getElementById('fm-boat-cap')||{}).value,10)||0, lic=parseInt((document.getElementById('fm-boat-licensepax')||{}).value,10)||0;
  if(lic>0 && cap>lic){ w.style.display='block'; w.textContent='ที่นั่งขาย '+cap+' มากกว่าผู้โดยสารตามใบอนุญาต '+lic+' · ระบบจะขายได้แค่ '+lic+' ที่นั่ง'; }
  else { w.style.display='none'; w.textContent=''; }
}
function bmCapSummary(b){
  var host=document.getElementById('fm-boat-capsum'); if(!host) return;
  var lp=document.getElementById('fm-boat-licensepax');
  if(lp && !lp._bmHook){ lp._bmHook=1; lp.addEventListener('input',bmSeatCheck); }
  if(!b){ host.innerHTML='<div>เรือใหม่ · บันทึกเรือก่อน แล้วค่อยตั้งช่วงที่นั่ง (ถ้ามี) ที่ Company Asset › 💺 ที่นั่ง</div>'; bmSeatCheck(); return; }
  var today=chCapToday(), H=Array.isArray(b.capHist)?b.capHist:[];
  var now=(typeof boatCapHistPick==='function')?boatCapHistPick(H,today):null;
  var fut=H.filter(function(h){ return h&&h.from>today; }).sort(function(a,z){ return a.from<z.from?-1:1; })[0];
  host.innerHTML='<div>💺 ขายวันนี้ <b style="font-family:\'DM Mono\',monospace;font-size:15px">'+(now?(+now.cap):(+b.cap||0))+'</b>'
      +(now?(' <span style="color:#6B7385">ตามช่วง '+chCapE(now.reason||'')+'</span>'):' <span style="color:#6B7385">= ตั้งต้น</span>')+'</div>'
    +'<div>'+(fut?('ถัดไป <b style="font-family:\'DM Mono\',monospace;color:#0C447C">'+(+fut.cap)+'</b> ตั้งแต่ '+chCapD(fut.from)+(fut.reason?(' · '+chCapE(fut.reason)):'')):'<span style="color:#8A8F9C">ยังไม่มีช่วงถัดไป</span>')
      +' · ทั้งหมด '+H.length+' ช่วง</div>'
    +'<button type="button" onclick="closeModal(\'boat-modal\');window._editBoatId=null;capMgrOpen(\''+chCapE(b.id)+'\')" title="สิ่งที่แก้ในหน้าต่างนี้แต่ยังไม่บันทึกจะไม่ถูกเก็บ">จัดการช่วงที่นั่ง ›</button>';
  bmSeatCheck();
}
