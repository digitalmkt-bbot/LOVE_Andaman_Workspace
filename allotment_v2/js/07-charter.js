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
      if(!e){ e={id:'sl'+Date.now(),s:'available'}; b.log.push(e); }
      /* ที่ตั้งของช่วงนั้น · เขียนทับเฉพาะตอนที่มันยังเป็นค่าที่ระบบเติมให้จากท่าเดิม
         ถ้ามีคนไปตั้งที่ตั้งละเอียดไว้เอง (อู่ ท่าอื่น จังหวัดอื่น) อย่าไปลบของเขา */
      const oldAuto=CH_PIER_LOC[b.pier]||b.pier;
      if(!e.loc||e.loc===oldAuto) e.loc=CH_PIER_LOC[pier]||pier;
      e.from=from; e.to=to; e.note=note;
    }
    b.name=name; b.type=type; b.cap=cap; b.pier=pier;
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
  closeModal('charter-modal');renderBoats();save('config');
}
