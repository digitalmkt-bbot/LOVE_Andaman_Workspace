
// ── Engine Assign / Unassign ──
let _assignBoatId=null, _replaceEngId=null;

function flOpenAssignEngModal(boatId, replaceEngId){
  _assignBoatId=boatId;
  _replaceEngId=replaceEngId;
  const b=getBoat(boatId);
  const replaceEng=replaceEngId?flGetEng(replaceEngId):null;

  document.getElementById('fl-assign-eng-title').textContent=replaceEng?'เปลี่ยนเครื่องยนต์':'Assign เครื่องยนต์';
  document.getElementById('fl-assign-eng-sub').textContent=b?b.name:'';

  // available engines: unassigned or spare or current replace
  const available=FL_ENGINES.filter(e=>{
    if(replaceEngId&&e.id===replaceEngId) return true;
    if(e.boatId&&e.boatId!==boatId) return false;
    return true;
  });

  const sel=document.getElementById('fl-assign-eng-sel');
  sel.innerHTML='<option value="">— เลือกเครื่องยนต์ —</option>'+available.map(e=>{
    const isCurrent=e.id===replaceEngId;
    const loc=e.boatId===boatId?`(ติดอยู่: ${e.pos})`:e.spareLocation?`(${e.spareLocation})`:'(ยังไม่ติด)';
    return`<option value="${e.id}"${isCurrent?' selected':''}>${e.brand} ${e.model} · ${e.serial} ${loc}</option>`;
  }).join('');

  // position dropdown based on boat's engineCount setting
  const currentEngs=FL_ENGINES.filter(e=>e.boatId===boatId);
  const engineCount=b.engineCount||currentEngs.length||4;
  const positions=getEngPositions(engineCount);
  const posSel=document.getElementById('fl-assign-eng-pos');
  posSel.innerHTML=positions.map(p=>`<option value="${p}">${p}</option>`).join('');
  if(replaceEng) posSel.value=replaceEng.pos;

  document.getElementById('fl-assign-eng-info').style.display='none';
  flUpdateAssignEngInfo();
  openModal('fl-modal-assign-eng');
}

function flUpdateAssignEngInfo(){
  const engId=document.getElementById('fl-assign-eng-sel').value;
  const infoEl=document.getElementById('fl-assign-eng-info');
  if(!engId){infoEl.style.display='none';return;}
  const e=flGetEng(engId);if(!e){infoEl.style.display='none';return;}
  const curH=flEngHours(e.id);
  const next=e.serviceInterval?Math.ceil(curH/e.serviceInterval)*e.serviceInterval:null;
  const left=next?+(next-curH).toFixed(1):null;
  const gb=FL_GEARBOXES.find(g=>g.engineId===e.id);
  infoEl.style.display='flex';
  infoEl.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
      <div style="font-size:11px;color:var(--ink-soft)">ยี่ห้อ/รุ่น <span style="color:var(--ink);font-weight:500">${e.brand} ${e.model}</span></div>
      <div style="font-size:11px;color:var(--ink-soft)">Serial <span style="font-family:'DM Mono',monospace;color:var(--ink);font-weight:500">${e.serial}</span></div>
      <div style="font-size:11px;color:var(--ink-soft)">กำลัง <span style="color:var(--ink);font-weight:500">${e.hp||'—'} HP</span></div>
      <div style="font-size:11px;color:var(--ink-soft)">Hours <span style="font-family:'DM Mono',monospace;color:${left!=null&&left<30?'var(--amber)':'var(--ink)'};font-weight:500">${curH.toLocaleString()} h${left!=null&&left<30?` ⚠️`:''}</span></div>
      <div style="font-size:11px;color:var(--ink-soft)">สถานะ ${flStatusPill(e.status)}</div>
      ${gb?`<div style="font-size:11px;color:var(--ink-soft)">เกียร์ <span style="color:var(--ink);font-weight:500">${gb.serial}</span></div>`:''}
    </div>`;
}

function flSaveAssignEng(){
  const engId=document.getElementById('fl-assign-eng-sel').value;
  const pos=document.getElementById('fl-assign-eng-pos').value;
  if(!engId){alert('กรุณาเลือกเครื่องยนต์');return;}
  const eng=flGetEng(engId);if(!eng)return;
  const targetBoat=getBoat(_assignBoatId);

  // ── Check: position conflict ──
  // ถ้าตำแหน่งนี้มีเครื่องอื่นอยู่แล้ว ต้องถอดออกก่อน
  console.log('[DEBUG flSaveAssignEng] engId:', engId, 'pos:', JSON.stringify(pos), '_assignBoatId:', _assignBoatId, '_replaceEngId:', _replaceEngId);
  if(pos){
    const allOnBoat = FL_ENGINES.filter(e => e.boatId === _assignBoatId);
    console.log('[DEBUG] All engines on boat:', allOnBoat.map(e=>({id:e.id, serial:e.serial, pos:JSON.stringify(e.pos)})));
    const occupied = FL_ENGINES.find(e => 
      e.boatId === _assignBoatId && 
      e.pos === pos && 
      e.id !== engId &&
      e.id !== _replaceEngId  // ถ้ากด Replace อยู่ ไม่ต้อง check ตัวที่จะถูกแทน
    );
    console.log('[DEBUG] occupied found:', occupied ? {id:occupied.id, serial:occupied.serial, pos:occupied.pos} : 'NONE');
    if(occupied){
      const confirmMsg = `⚠️ ตำแหน่ง "${pos}" ของเรือ ${targetBoat?.name || '?'} มีเครื่อง ${occupied.serial || occupied.model || '?'} อยู่แล้ว\n\nต้องการถอดเครื่องเดิมออก (เป็น Spare) แล้ว assign เครื่องใหม่แทนที่หรือไม่?`;
      if(!confirm(confirmMsg)) return;
      // Auto-unassign the occupied engine
      if(!occupied.log) occupied.log = [];
      occupied.log.push({
        date: TODAY_STR, 
        type: 'unassign', 
        desc: `ถอดออกจาก ${targetBoat?.name || '?'} (${occupied.pos}) → Spare · ถูกแทนที่โดย ${eng.serial || eng.model || '?'}`, 
        hours: flEngHours(occupied.id)
      });
      occupied.boatId = null;
      occupied.pos = '';
      occupied.status = 'spare';
      occupied.spareLocation = 'คลังกลาง';
    }
  }

  // unassign replaced engine + log
  if(_replaceEngId&&_replaceEngId!==engId){
    const old=flGetEng(_replaceEngId);
    if(old){
      if(!old.log) old.log=[];
      old.log.push({date:TODAY_STR,type:'unassign',desc:`ถอดออกจาก ${getBoat(old.boatId)?.name||'?'} (${old.pos}) → Spare`,hours:flEngHours(old.id)});
      old.boatId=null;old.pos='';old.status='spare';old.spareLocation='คลังกลาง';
    }
  }

  // log + assign new engine
  if(!eng.log) eng.log=[];
  const prevLoc=eng.boatId?`${getBoat(eng.boatId)?.name||'?'} (${eng.pos})`:(eng.spareLocation||'Spare');
  eng.log.push({date:TODAY_STR,type:'assign',desc:`ย้ายไป ${targetBoat?targetBoat.name:'?'} · ${pos} (จาก ${prevLoc})`,hours:flEngHours(engId)});
  eng.boatId=_assignBoatId;
  eng.pos=pos;
  if(eng.status==='spare') eng.status='ready';
  eng.spareLocation=null;

  flSave();
  closeModal('fl-modal-assign-eng');
  flRenderBoatList();
  flSelBoat(_assignBoatId);
}

// ── Edit Boat Modal ──
function flOpenEditBoatModal(bid){
  const b=getBoat(bid);if(!b)return;
  fmBoatSt=0;
  fmBoatDocs=[...(b.docs||[])];
  const setVal=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v!=null?v:'';};
  setVal('fm-boat-name',b.name);setVal('fm-boat-nameth',b.nameTh);setVal('fm-boat-brand',b.brand);setVal('fm-boat-model',b.model);
  setVal('fm-boat-reg',b.reg);setVal('fm-boat-callsign',b.callsign);setVal('fm-boat-imo',b.imo);
  setVal('fm-boat-year',b.year);setVal('fm-boat-port',b.homeportCity);
  setVal('fm-boat-cap',b.cap||40);setVal('fm-boat-licensepax',b.licensePax);setVal('fm-boat-crew',b.crew);
  setVal('fm-boat-fishcrew',b.fishcrew);setVal('fm-boat-totalcap',b.totalcap);
  setVal('fm-boat-gt',b.gt);setVal('fm-boat-nt',b.nt);setVal('fm-boat-dwt',b.dwt);
  setVal('fm-boat-loa',b.loa);setVal('fm-boat-beam',b.beam);setVal('fm-boat-depth',b.depth);
  setVal('fm-boat-draft',b.draft);setVal('fm-boat-lbp',b.lbp);setVal('fm-boat-bhp',b.bhp);
  setVal('fm-boat-owner',b.owner);setVal('fm-boat-homeport',b.homeport);
  setVal('fm-boat-owneraddr',b.ownerAddr);setVal('fm-boat-note',b.note);
  if(b.type) document.getElementById('fm-boat-type').value=b.type;
  if(b.use) document.getElementById('fm-boat-use').value=b.use;
  if(b.material) document.getElementById('fm-boat-material').value=b.material;
  if(b.engineCount) document.getElementById('fm-boat-engcount').value=b.engineCount;
  // pier pills
  const bPier=b.pier||'tublamu';
  document.getElementById('fm-boat-pier').value=bPier;
  document.querySelectorAll('#fm-boat-pier-pills .loc-pill').forEach(el=>{
    el.classList.toggle('on',
      (bPier==='tublamu'&&el.textContent.includes('Tub'))||
      (bPier==='panwa'&&el.textContent.includes('Panwa'))||
      (bPier==='ranong'&&el.textContent.includes('Ranong'))
    );
  });
  // status
  const st=getCurStatus(b,TODAY_STR);
  fmBoatSt={available:0,fixing:1,unavailable:2}[st.s]||0;
  fmBoatOwn=(b.ownership==='charter')?1:0; fmRenderBoatOwn(fmBoatOwn);
  fmRenderBoatSt(fmBoatSt);
  fmRenderDocs();
  document.getElementById('boat-modal-title').textContent='แก้ไขข้อมูลเรือ';
  window._editBoatId=bid;
  openModal('boat-modal');
}

// saveBoat handles both add and edit modes via window._editBoatId (defined above)

// ── DOCUMENTS TAB ──
let flDocFilter='all';
let flDocView='matrix';

const FL_DOC_TYPES=[
  {id:'lic',    label:'ใบอนุญาต\nใช้เรือ',   group:'เจ้าท่า',    groupSep:false, grpCls:'govt'},
  {id:'inspect',label:'ใบตรวจ\nสภาพเรือ',  group:'เจ้าท่า',    groupSep:false, grpCls:'govt'},
  {id:'ins',    label:'ประกันภัย\nเรือ',     group:'ประกันภัย',  groupSep:true,  grpCls:'ins'},
  {id:'similan',label:'สิมิลัน',            group:'เข้าพื้นที่', groupSep:true,  grpCls:'park'},
  {id:'surin',  label:'สุรินทร์',            group:'เข้าพื้นที่', groupSep:false, grpCls:'park'},
  {id:'pp',     label:'พีพี',               group:'เข้าพื้นที่', groupSep:false, grpCls:'park'},
  {id:'phangnga',label:'อ่าวพังงา',         group:'เข้าพื้นที่', groupSep:false, grpCls:'park'},
  {id:'tarn',   label:'ธารโบกขรณี',         group:'เข้าพื้นที่', groupSep:false, grpCls:'park'},
];

// map doc name keywords → doc type id
function flGuessDocType(docName){
  const n=docName.toLowerCase();
  if(n.includes('ใบอนุญาต')&&!n.includes('สิมิลัน')&&!n.includes('สุรินทร์')&&!n.includes('พีพี')&&!n.includes('พังงา')&&!n.includes('ธาร')) return 'lic';
  if(n.includes('ตรวจสภาพ')||n.includes('ตรวจเรือ')||n.includes('ใบสำคัญ')) return 'inspect';
  if(n.includes('ประกัน')) return 'ins';
  if(n.includes('สิมิลัน')||n.includes('similan')) return 'similan';
  if(n.includes('สุรินทร์')||n.includes('surin')) return 'surin';
  if(n.includes('พีพี')||n.includes('phi phi')||n.includes('phiphi')) return 'pp';
  if(n.includes('พังงา')||n.includes('phang nga')) return 'phangnga';
  if(n.includes('ธาร')||n.includes('โบก')) return 'tarn';
  return null;
}

/* §pjDocSrc · ใบไหนคือใบปัจจุบัน · กติกานี้ต้องมีที่เดียวในทั้งไฟล์
   ต่ออายุแล้วระบบเก็บใบเก่าไว้เป็นประวัติ · ใครหยิบผิดใบก็รายงานผิดทันที */
function flDocBetter(existing, doc){
  if(!existing) return true;
  if(doc.renewStatus==='processing') return true;                      // ที่กำลังยื่นอยู่ สำคัญกว่าเสมอ
  if(existing.renewStatus==='done' && doc.renewStatus!=='done') return true;
  if(!existing.exp && doc.exp) return true;                            // มีวันที่ ดีกว่าไม่มี
  if(doc.exp && existing.exp && doc.exp>existing.exp) return true;     // ใบที่หมดทีหลัง คือใบใหม่กว่า
  return false;
}
/* ใบปัจจุบันของเรือลำนี้ ประเภทนี้ · typeId ตาม FL_DOC_TYPES */
function flDocCurrent(boat, typeId){
  var best=null;
  ((boat&&boat.docs)||[]).forEach(function(doc){
    var id=flGuessDocType(String(doc.name||''))||('other_'+doc.name);
    if(id!==typeId) return;
    if(flDocBetter(best,doc)) best=doc;
  });
  return best;
}
function flDocStatus(doc){
  const expStr=typeof doc==='string'?doc:doc?.exp;
  const renewStatus=typeof doc==='object'?doc?.renewStatus:null;
  if(renewStatus==='processing') return 'processing';
  if(renewStatus==='renewed') return 'processing'; // legacy
  if(!expStr) return 'na';
  const today=new Date(TODAY_STR);
  const exp=new Date(expStr);
  const days=Math.ceil((exp-today)/86400000);
  if(days<0) return 'exp';
  if(days<30) return 'warn30';
  if(days<90) return 'warn90';
  return 'ok';
}

function flSetDocView(v,el){
  flDocView=v;
  document.querySelectorAll('#fl-ap-docs .fl-doc-view-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const mx=document.getElementById('fl-docs-matrix');
  const ls=document.getElementById('fl-docs-list');
  if(v==='matrix'){
    mx.style.display='block';
    ls.style.display='none';
  } else {
    mx.style.display='none';
    ls.style.cssText='display:flex;flex-direction:column;gap:6px;flex:1';
  }
  flRenderDocsList();
}
function flSetDocFilter(f,el){
  flDocFilter=f;
  flRenderDocsList();
}

// ════════ Safety Equipment · Phase 3.1 matrix+detail view ════════
let flSafetyStFilter='all', flSelSafetyId=null;
// Selection context for detail panel: mode = 'cell' | 'boat' | 'category' | null
let _flSafetySelMode=null, _flSafetySelBoat=null, _flSafetySelCat=null;
// kept for legacy refs (some old code may still set these — they're unused now)
let flSafetyBoatFilter='all', flSafetyCatFilter='all';

// Status helper · derive worst of expiry/PM as a single derived status
function _flSafetyStatus(item){
  const dim={ink3:'#999'};
  const today=new Date(TODAY_STR);
  const checks=[];
  if(item.expiryDate){ const d=new Date(item.expiryDate); checks.push({type:'expiry', date:item.expiryDate, days:Math.floor((d-today)/86400000)}); }
  if(item.nextPM){ const d=new Date(item.nextPM); checks.push({type:'pm', date:item.nextPM, days:Math.floor((d-today)/86400000)}); }
  const min = checks.reduce((m,c)=>!m||c.days<m.days?c:m, null);
  if(item.status==='replaced') return {label:'REPLACED', color:'#5F5E5A', bg:'#F1EFE8', days:null};
  if(item.status==='missing')  return {label:'MISSING',  color:'#A32D2D', bg:'#FCEBEB', days:null};
  if(!min) return {label:'OK · no PM', color:'#0F6E56', bg:'#E1F5EE', days:null};
  if(min.days<0)   return {label:'EXPIRED',           color:'#A32D2D', bg:'#FCEBEB', days:min.days, type:min.type};
  if(min.days<=30) return {label:`DUE · ${min.days}d`, color:'#854F0B', bg:'#FFF5EB', days:min.days, type:min.type};
  if(min.days<=90) return {label:`SOON · ${min.days}d`,color:'#854F0B', bg:'#FFFAF5', days:min.days, type:min.type};
  return {label:'OK', color:'#0F6E56', bg:'#E1F5EE', days:min.days, type:min.type};
}

function flRenderSafetyList(){
  const wrap=document.getElementById('fl-safety-pink-wrap');
  if(!wrap)return;
  const dim={bg:'#F4F2EE',ink:'#1A1A1A',ink2:'#666',ink3:'#999',ink4:'#bbb',line:'rgba(0,0,0,.04)'};
  const SVG_PINK={accent:'#E03B7E',soft:'#FCE5EC',text:'#9F1B4F'};

  const all=FL_SAFETY;
  const companyBoats=BOATS.filter(b=>!b.retired && b.ownership!=='charter');
  const categories=Object.entries(FL_SAFETY_CATEGORIES);
  const totalItems=all.length;
  const expiredCnt=all.filter(i=>_flSafetyStatus(i).label==='EXPIRED').length;
  const dueSoonCnt=all.filter(i=>{const s=_flSafetyStatus(i);return s.days!=null && s.days>=0 && s.days<=90;}).length;
  const regulatoryCats=Object.values(FL_SAFETY_CATEGORIES).filter(c=>c.regulatory).length;

  // ── Header bar ──
  const headerBar=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:6px">
      <div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid ${dim.line};border-radius:20px;padding:3px 12px 3px 3px"><div style="width:24px;height:24px;border-radius:50%;background:#0F6E56;color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">SF</div><span style="font-size:12px;font-weight:500">Safety · ${totalItems}</span></div>
      <div style="width:32px;height:32px;border-radius:50%;background:${dim.ink};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">S</div>
    </div>
    <button onclick="flOpenAddSafetyModal()" style="background:#0F6E56;color:#fff;border:none;border-radius:20px;padding:7px 16px;font-size:11px;font-weight:600;cursor:pointer">+ Add Safety Item</button>
  </div>`;

  // ── KPI strip ──
  const kpiStrip=`<div style="display:grid;grid-template-columns:1.6fr 1fr 0.9fr 0.9fr 0.9fr;gap:8px;margin-bottom:14px;align-items:stretch">
    <div style="grid-column:1;align-self:end;padding-bottom:6px">
      <div style="font-size:13px;font-weight:500;color:${dim.ink4};margin-bottom:2px">Safety Equipment</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:42px;font-weight:700;letter-spacing:-1.5px;line-height:1">${totalItems}</span>
        <span style="font-size:18px;color:${dim.ink3};font-weight:500">items</span>
        <span style="display:inline-flex;align-items:center;background:${SVG_PINK.accent};color:white;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600">${all.reduce((s,i)=>s+(i.qty||0),0)} qty</span>
      </div>
      <div style="font-size:11px;color:${dim.ink3}">${companyBoats.length} boats · ${categories.length} categories · ${regulatoryCats} regulatory</div>
    </div>
    <div style="grid-column:2;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dim.line}">
      <div style="font-size:10px;color:${dim.ink3}">Total qty</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2;font-family:'DM Mono',monospace">${all.reduce((s,i)=>s+(i.qty||0),0).toLocaleString()}</span><span style="font-size:11px;color:${dim.ink3};font-weight:500">units</span></div>
      <div style="font-size:11px;color:${dim.ink2};margin-top:6px">${(all.reduce((s,i)=>s+(i.qty||0),0)/Math.max(companyBoats.length,1)).toFixed(0)} per boat avg</div>
    </div>
    <div style="grid-column:3;background:white;border-radius:14px;padding:11px 13px;border:2px solid ${expiredCnt>0?'#A32D2D':SVG_PINK.accent}">
      <div style="font-size:10px;color:${dim.ink3}">Expired</div>
      <div style="display:flex;align-items:baseline;gap:4px;margin-top:2px"><span style="background:${expiredCnt>0?'#A32D2D':SVG_PINK.accent};color:white;padding:2px 9px;border-radius:14px;font-size:14px;font-weight:700">${expiredCnt}</span><span style="font-size:11px;color:${dim.ink3};margin-left:2px">items</span></div>
      <div style="font-size:11px;color:${expiredCnt>0?'#A32D2D':SVG_PINK.text};margin-top:7px;font-weight:600">overdue</div>
    </div>
    <div style="grid-column:4;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dueSoonCnt>0?'#F0C8B0':dim.line}">
      <div style="font-size:10px;color:${dim.ink3}">Due in 90d</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2;color:${dueSoonCnt>0?'#854F0B':dim.ink};font-family:'DM Mono',monospace">${dueSoonCnt}</span><span style="font-size:11px;color:${dim.ink3};font-weight:500">items</span></div>
      <div style="font-size:11px;color:${dueSoonCnt>0?'#854F0B':dim.ink3};margin-top:6px;font-weight:600">need attention</div>
    </div>
    <div style="grid-column:5;background:${dim.ink};color:white;border-radius:14px;padding:11px 13px">
      <div style="font-size:10px;color:#aaa">Categories</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2">${categories.length}</span><span style="font-size:11px;color:#aaa;font-weight:500">types</span></div>
      <div style="font-size:11px;color:#aaa;margin-top:6px">${regulatoryCats} required by กรมเจ้าท่า</div>
    </div>
  </div>`;

  // ── Build matrix table ──
  const PIER_LBL={tublamu:'Tub Lamu',panwa:'Visit Panwa',ranong:'Ranong'};
  // Shared boat-avatar helpers (same as Boats tab)
  const _boatPalette=['#185FA5','#534AB7','#1D9E75','#BA7517','#A32D2D','#0F6E56','#7F77DD','#D85A30','#993556','#185FA5'];
  const _boatAvatarColor=(b)=>{if(typeof getBoatColor==='function'){const _g=getBoatColor(b.id);if(_g&&_g.text&&_g.text!=='#666')return _g.text;}const i=companyBoats.findIndex(x=>x.id===b.id);return _boatPalette[i%_boatPalette.length>=0?(i%_boatPalette.length):0];};
  const _boatInitials=(name)=>{const w=name.split(/\s+/);if(w.length>=2)return (w[0][0]+w[1][0]).toUpperCase();if(name.length>=2&&/\d/.test(name))return (name.match(/[A-Z]/g)?.[0]||name[0])+name.slice(-1);return name.slice(0,2).toUpperCase();};
  const _statusStyle={available:{bg:'#1D9E75',color:'white',label:'AVAILABLE'},fixing:{bg:'#FAEEDA',color:'#854F0B',label:'FIXING'},unavailable:{bg:'#FCEBEB',color:'#A32D2D',label:'UNAVAIL'}};
  // Column headers
  let colHeaders='';
  categories.forEach(([catKey, catMeta])=>{
    const isSelCat = _flSafetySelMode==='category' && _flSafetySelCat===catKey;
    const isCellCat = _flSafetySelMode==='cell' && _flSafetySelCat===catKey;
    const hbg = isSelCat ? catMeta.color+'18' : (isCellCat ? '#FFF6F0' : '#fafaf8');
    colHeaders += `<th onclick="flSafetySelCat('${catKey}')" title="Click to view all boats with ${catMeta.label}" style="padding:6px 4px;text-align:center;background:${hbg};border-bottom:1.5px solid rgba(0,0,0,.06);border-left:0.5px solid ${dim.line};font-size:8.5px;color:${catMeta.color};text-transform:uppercase;letter-spacing:.04em;font-weight:700;cursor:pointer;min-width:60px;transition:background .12s">
      <div>${catMeta.label.length>8?catMeta.label.slice(0,7)+'…':catMeta.label}</div>
      ${catMeta.regulatory?`<div style="font-size:7px;color:#A32D2D;margin-top:1px;letter-spacing:0">REQ</div>`:''}
    </th>`;
  });

  // Body rows
  let bodyRows='';
  companyBoats.forEach(b=>{
    const isSelBoat = (_flSafetySelMode==='boat' && _flSafetySelBoat===b.id);
    const isCellBoat = (_flSafetySelMode==='cell' && _flSafetySelBoat===b.id);
    const rowBg = isSelBoat ? '#FFF6F0' : 'transparent';
    const boatLblBg = isSelBoat ? '#FFE6D9' : (isCellBoat?'#FFF6F0':'#fafaf8');
    const boatLblColor = isSelBoat ? '#C75A33' : dim.ink;
    const _ac=_boatAvatarColor(b);
    const _ini=_boatInitials(b.name);
    const _cur=getCurStatus(b,TODAY_STR);
    const _ss=_statusStyle[_cur.s||'available']||_statusStyle.available;
    let row = `<tr style="background:${rowBg};border-top:0.5px solid ${dim.line}">
      <td onclick="flSafetySelBoat('${b.id}')" title="Click to view all safety items on ${b.name}" style="padding:8px 10px;background:${boatLblBg};border-right:1px solid ${dim.line};position:sticky;left:0;z-index:2;cursor:pointer;transition:background .12s;min-width:180px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:50%;background:${_ac};color:white;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${_ini}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span style="font-size:11.5px;font-weight:600;color:${boatLblColor};line-height:1.2">${b.name}</span><span style="background:${_ss.bg};color:${_ss.color};padding:1px 5px;border-radius:5px;font-size:7.5px;font-weight:700;letter-spacing:.04em">${_ss.label}</span></div>
            <div style="font-size:9px;color:${dim.ink3};margin-top:1px">${b.type||'—'}${b.cap?' · '+b.cap+' PAX':''} · ${PIER_LBL[b.pier]||'?'}</div>
          </div>
        </div>
      </td>`;
    categories.forEach(([catKey, catMeta])=>{
      // Exclude items that have been REPLACED — they're historical only · not "currently on boat"
      const cellItems = FL_SAFETY.filter(s=>s.boatId===b.id && s.category===catKey && (s.status||'active') !== 'replaced');
      const isSelCell = _flSafetySelMode==='cell' && _flSafetySelBoat===b.id && _flSafetySelCat===catKey;
      if(cellItems.length===0){
        row += `<td onclick="flSafetySelCell('${b.id}','${catKey}')" title="No ${catMeta.label} on ${b.name} · click to add" style="text-align:center;padding:6px 4px;color:#ddd;font-size:11px;font-family:'DM Mono',monospace;border-left:0.5px solid ${dim.line};cursor:pointer;${isSelCell?'outline:1.5px solid #C75A33;outline-offset:-1.5px;background:#FFF6F0;':''}">—</td>`;
        return;
      }
      const totalQty = cellItems.reduce((s,it)=>s+(it.qty||0),0);
      // Pick worst-status
      let worst = null;
      cellItems.forEach(it=>{ const s=_flSafetyStatus(it); if(!worst || (s.days!=null && (worst.days==null||s.days<worst.days))) worst=s; });
      const isExpired = worst && worst.label==='EXPIRED';
      const isDue = worst && worst.days!=null && worst.days>=0 && worst.days<=90;
      // Apply status filter highlight: if filter is set and cell doesn't match, dim it
      let dimCell = false;
      if(flSafetyStFilter==='expired' && !isExpired) dimCell=true;
      else if(flSafetyStFilter==='due' && !isDue) dimCell=true;
      else if(flSafetyStFilter==='ok' && (isExpired||isDue)) dimCell=true;
      const cellBg = isExpired?'#FCEBEB':(isDue?'#FFF5EB':'#fff');
      const cellColor = isExpired?'#A32D2D':(isDue?'#854F0B':dim.ink);
      const tipParts = cellItems.map(it=>{const s=_flSafetyStatus(it);return `${it.name} · qty ${it.qty||1} · ${s.label}`;});
      row += `<td onclick="flSafetySelCell('${b.id}','${catKey}')" title="${tipParts.join(' | ').replace(/"/g,'&quot;')}" style="text-align:center;padding:6px 4px;font-size:11px;font-weight:700;color:${cellColor};background:${cellBg};border-left:0.5px solid ${dim.line};font-family:'DM Mono',monospace;cursor:pointer;${dimCell?'opacity:.35;':''}${isSelCell?'outline:1.5px solid #C75A33;outline-offset:-1.5px;':''}">${totalQty}</td>`;
    });
    row += '</tr>';
    bodyRows += row;
  });

  // ── Filter bar (Status only — boat/category selection via matrix interaction) ──
  const stBtn=(val,label)=>`<button onclick="flSetSafetyStFilter('${val}')" style="background:${flSafetyStFilter===val?dim.ink:'transparent'};color:${flSafetyStFilter===val?'white':dim.ink2};border:none;border-radius:14px;padding:5px 14px;font-size:11px;font-weight:${flSafetyStFilter===val?600:500};cursor:pointer">${label}</button>`;
  const filterBar=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap">
    <span style="font-size:10px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-right:4px">Highlight</span>
    <div style="display:flex;gap:4px;background:white;border:1px solid ${dim.line};border-radius:18px;padding:2px">${stBtn('all','All')}${stBtn('expired',`Expired ${expiredCnt?'· '+expiredCnt:''}`)}${stBtn('due',`Due 90d ${dueSoonCnt?'· '+dueSoonCnt:''}`)}${stBtn('ok','OK')}</div>
    <span style="margin-left:auto;font-size:10.5px;color:${dim.ink3}">Click <strong style="color:${dim.ink}">cell</strong> = view items · <strong style="color:${dim.ink}">boat name</strong> = all on that boat · <strong style="color:${dim.ink}">category header</strong> = all in that category</span>
  </div>`;

  // Matrix panel
  const matrixPanel = `<div style="background:white;border-radius:14px;padding:10px;border:1px solid ${dim.line};overflow-x:auto">
    <table style="border-collapse:collapse;width:100%;font-size:10px">
      <thead><tr>
        <th onclick="flSafetyClearSel()" title="Click to clear selection" style="padding:6px 10px;background:#fafaf8;border-bottom:1.5px solid rgba(0,0,0,.06);border-right:1px solid ${dim.line};text-align:left;font-size:9px;color:${dim.ink3};font-weight:700;text-transform:uppercase;letter-spacing:.05em;position:sticky;left:0;z-index:3;min-width:180px;cursor:pointer">Boat</th>
        ${colHeaders}
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div style="display:flex;align-items:center;gap:10px;font-size:9.5px;color:${dim.ink3};margin-top:8px;padding:0 4px">
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#FCEBEB;border:0.5px solid ${dim.line};border-radius:2px"></span>Expired</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#FFF5EB;border:0.5px solid ${dim.line};border-radius:2px"></span>Due ≤90d</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#fff;border:0.5px solid ${dim.line};border-radius:2px"></span>OK</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:#fff;border:0.5px solid ${dim.line};border-radius:2px;color:#ddd;font-size:7px;text-align:center;line-height:9px;font-family:'DM Mono'">—</span>None (click to add)</span>
    </div>
  </div>`;

  const detailPanel=`<div id="fl-safety-detail-mount" style="background:white;border-radius:14px;border:1px solid ${dim.line};overflow:hidden;min-height:480px"></div>`;

  wrap.innerHTML=`${headerBar}${kpiStrip}${filterBar}<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;align-items:start">${matrixPanel}${detailPanel}</div>`;

  flRenderSafetyDetailPink();
}

// Matrix selection handlers
function flSafetySelCell(boatId, catKey){
  _flSafetySelMode='cell'; _flSafetySelBoat=boatId; _flSafetySelCat=catKey;
  flSelSafetyId=null;
  flRenderSafetyList();
}
function flSafetySelBoat(boatId){
  _flSafetySelMode='boat'; _flSafetySelBoat=boatId; _flSafetySelCat=null;
  flSelSafetyId=null;
  flRenderSafetyList();
}
function flSafetySelCat(catKey){
  _flSafetySelMode='category'; _flSafetySelCat=catKey; _flSafetySelBoat=null;
  flSelSafetyId=null;
  flRenderSafetyList();
}
function flSafetyClearSel(){
  _flSafetySelMode=null; _flSafetySelBoat=null; _flSafetySelCat=null;
  flSelSafetyId=null;
  flRenderSafetyList();
}

function flSetSafetyStFilter(v){flSafetyStFilter=v;flRenderSafetyList();}

function flSelSafety(id){
  flSelSafetyId=id;
  flRenderSafetyList();
  setTimeout(()=>{
    const el=document.querySelector(`[onclick*="flSelSafety('${id}')"]`);
    if(el) el.scrollIntoView({block:'nearest', behavior:'instant'});
  }, 0);
}

function flRenderSafetyDetailPink(){
  const mount=document.getElementById('fl-safety-detail-mount');
  if(!mount)return;
  const dim={bg:'#F4F2EE',ink:'#1A1A1A',ink2:'#666',ink3:'#999',ink4:'#bbb',line:'rgba(0,0,0,.04)'};
  const SVG_PINK={accent:'#E03B7E',soft:'#FCE5EC',text:'#9F1B4F'};

  // ── Empty state · no selection ──
  if(!_flSafetySelMode){
    mount.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:480px;padding:40px;color:${dim.ink3};gap:10px;text-align:center">
      <div style="font-size:28px;opacity:.25;letter-spacing:.1em">SAFETY</div>
      <div style="font-size:13px;color:${dim.ink2};font-weight:500">Select a cell, boat, or category</div>
      <div style="font-size:11px;color:${dim.ink3};max-width:280px;line-height:1.55">Click any cell in the matrix to view items · Click a boat name (left col) to see all items on that boat · Click a category header (top row) to see all boats with that category</div>
    </div>`;
    return;
  }

  // Collect items based on selection mode · split into active vs replaced (history)
  let allItems=[], scopeLabel='', scopeSubLabel='', scopeColor=dim.ink, scopeBg='#fafaf8';
  const b = _flSafetySelBoat ? getBoat(_flSafetySelBoat) : null;
  const catMeta = _flSafetySelCat ? FL_SAFETY_CATEGORIES[_flSafetySelCat] : null;
  if(_flSafetySelMode==='cell'){
    allItems = FL_SAFETY.filter(s=>s.boatId===_flSafetySelBoat && s.category===_flSafetySelCat);
    scopeLabel = `${b?b.name:'?'} · ${catMeta?catMeta.label:'?'}`;
    scopeColor = catMeta ? catMeta.color : dim.ink;
    scopeBg = catMeta ? catMeta.color+'12' : '#fafaf8';
  } else if(_flSafetySelMode==='boat'){
    allItems = FL_SAFETY.filter(s=>s.boatId===_flSafetySelBoat);
    scopeLabel = b?b.name:'?';
    scopeColor = '#C75A33';
    scopeBg = '#FFF6F0';
  } else if(_flSafetySelMode==='category'){
    allItems = FL_SAFETY.filter(s=>s.category===_flSafetySelCat);
    scopeLabel = catMeta?catMeta.label:'?';
    scopeColor = catMeta ? catMeta.color : dim.ink;
    scopeBg = catMeta ? catMeta.color+'12' : '#fafaf8';
  }
  // Split — active (status !== 'replaced') shown in main list, replaced in History section
  const items = allItems.filter(s => (s.status||'active') !== 'replaced');
  const replacedItems = allItems.filter(s => (s.status||'active') === 'replaced');
  // Build scope sub-label (use filtered active count, mention replaced if any)
  if(_flSafetySelMode==='cell'){
    scopeSubLabel = `${items.length} item${items.length!==1?'s':''} on this boat in this category${replacedItems.length?` · ${replacedItems.length} replaced in history`:''}`;
  } else if(_flSafetySelMode==='boat'){
    scopeSubLabel = `All safety items on this boat · ${items.length} active · ${items.reduce((s,i)=>s+(i.qty||0),0)} qty${replacedItems.length?` · ${replacedItems.length} replaced`:''}`;
  } else if(_flSafetySelMode==='category'){
    scopeSubLabel = `${catMeta?catMeta.th:''} · ${items.length} items across ${new Set(items.map(i=>i.boatId)).size} boats · ${catMeta&&catMeta.regulatory?'Required by กรมเจ้าท่า':'Recommended'}${replacedItems.length?` · ${replacedItems.length} replaced`:''}`;
  }

  // Sort items by status urgency (expired first, then due soon, then ok)
  items.sort((a,z)=>{const sa=_flSafetyStatus(a).days, sz=_flSafetyStatus(z).days; return (sa==null?9999:sa)-(sz==null?9999:sz);});
  // Sort replaced items by replace date (newest first)
  replacedItems.sort((a,z)=>{
    const da = (a.log||[]).filter(l=>l.type==='replace').slice(-1)[0]?.date || '';
    const dz = (z.log||[]).filter(l=>l.type==='replace').slice(-1)[0]?.date || '';
    return dz.localeCompare(da);
  });

  // Header strip
  const headerStrip=`<div style="padding:14px 18px;border-bottom:1px solid rgba(0,0,0,.06);background:${scopeBg}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="min-width:0;flex:1">
        <div style="font-size:9px;color:${scopeColor};text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:3px">${_flSafetySelMode==='cell'?'CELL':_flSafetySelMode==='boat'?'BOAT':'CATEGORY'} · ${items.length} item${items.length!==1?'s':''}</div>
        <div style="font-size:16px;font-weight:700;color:${dim.ink};line-height:1.15">${scopeLabel}</div>
        <div style="font-size:10.5px;color:${dim.ink2};margin-top:3px">${scopeSubLabel}</div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        ${_flSafetySelMode==='cell'?`<button onclick="flOpenAddSafetyModal()" style="background:#0F6E56;color:#fff;border:none;border-radius:18px;padding:5px 12px;font-size:10.5px;font-weight:600;cursor:pointer">+ Add here</button>`:''}
        <button onclick="flSafetyClearSel()" style="background:transparent;border:1px solid ${dim.line};color:${dim.ink2};border-radius:18px;padding:5px 11px;font-size:10.5px;font-weight:500;cursor:pointer">Clear</button>
      </div>
    </div>
  </div>`;

  // Body
  let bodyHtml = '';
  if(items.length===0){
    bodyHtml = `<div style="padding:30px;text-align:center;color:${dim.ink3};font-size:12px">
      <div style="font-size:11.5px;margin-bottom:10px">No safety items in this scope</div>
      ${_flSafetySelMode==='cell'?`<button onclick="flOpenAddSafetyModal()" style="background:#0F6E56;color:#fff;border:none;border-radius:18px;padding:7px 14px;font-size:11px;font-weight:600;cursor:pointer">+ Add ${catMeta?catMeta.label:'item'} on ${b?b.name:'this boat'}</button>`:''}
    </div>`;
  } else {
    // If exactly 1 item — show full detail card · else show stacked list of compact cards
    const fmt=s=>s||'—';
    if(items.length===1 && _flSafetySelMode==='cell'){
      // Full single-item detail
      const it = items[0];
      const meta = FL_SAFETY_CATEGORIES[it.category] || {label:it.category,th:'',color:dim.ink2,regulatory:false};
      const st = _flSafetyStatus(it);
      bodyHtml = `<div style="padding:14px 16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div style="background:${dim.bg};border-radius:10px;padding:10px 12px">
            <div style="font-size:9.5px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">Brand / Model</div>
            <div style="font-size:13px;font-weight:700;margin-top:2px;color:${dim.ink}">${fmt(it.brand)}</div>
            <div style="font-size:10px;color:${dim.ink2}">${fmt(it.model)}</div>
          </div>
          <div style="background:${dim.bg};border-radius:10px;padding:10px 12px">
            <div style="font-size:9.5px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">Install date</div>
            <div style="font-size:13px;font-weight:700;margin-top:2px;color:${dim.ink};font-family:'DM Mono',monospace">${fmt(it.installDate)}</div>
            <div style="font-size:10px;color:${dim.ink2}">${it.installDate?_safetyAge(it.installDate):''}</div>
          </div>
          <div style="background:${st.label==='EXPIRED'?'#FCEBEB':(st.days!=null&&st.days<=90?'#FFF5EB':dim.bg)};border-radius:10px;padding:10px 12px">
            <div style="font-size:9.5px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">Expiry / Next PM</div>
            <div style="font-size:13px;font-weight:700;margin-top:2px;color:${st.label==='EXPIRED'?'#A32D2D':(st.days!=null&&st.days<=90?'#854F0B':dim.ink)};font-family:'DM Mono',monospace">${fmt(it.expiryDate||it.nextPM)}</div>
            <div style="font-size:10px;color:${st.color};font-weight:600">${st.days==null?'—':(st.days<0?Math.abs(st.days)+' days overdue':st.days+' days left')}</div>
          </div>
          <div style="background:${dim.bg};border-radius:10px;padding:10px 12px">
            <div style="font-size:9.5px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em">Last inspection</div>
            <div style="font-size:13px;font-weight:700;margin-top:2px;color:${dim.ink};font-family:'DM Mono',monospace">${fmt(it.lastInspect)}</div>
            <div style="font-size:10px;color:${dim.ink2}">${it.lastInspect?_safetyAge(it.lastInspect)+' ago':''}</div>
          </div>
        </div>
        <div style="background:#fafaf8;border-radius:10px;padding:11px 14px;border:1px solid ${dim.line};margin-bottom:12px">
          <div style="font-size:9.5px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">Specifications</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 10px;font-size:11px">
            <div><span style="color:${dim.ink3}">Serial</span> <strong style="font-family:'DM Mono',monospace">${fmt(it.serial)}</strong></div>
            <div><span style="color:${dim.ink3}">Qty</span> <strong style="font-family:'DM Mono',monospace">${it.qty||1}</strong></div>
            <div><span style="color:${dim.ink3}">Status</span> <strong style="text-transform:capitalize">${it.status||'active'}</strong></div>
            <div><span style="color:${dim.ink3}">SF#</span> <strong style="font-family:'DM Mono',monospace">${it.id||'—'}</strong></div>
            <div style="grid-column:1/-1"><span style="color:${dim.ink3}">Location</span> <strong>${fmt(it.location)}</strong></div>
            ${it.note?`<div style="grid-column:1/-1;margin-top:4px"><span style="color:${dim.ink3}">Note:</span> <em style="color:${dim.ink2}">${it.note}</em></div>`:''}
          </div>
          <div style="display:flex;gap:5px;margin-top:10px;padding-top:8px;border-top:0.5px solid ${dim.line};flex-wrap:wrap">
            <button onclick="flOpenAddSafetyModal('${it.id}')" style="background:${dim.ink};color:#fff;border:none;border-radius:14px;padding:5px 12px;font-size:10.5px;font-weight:600;cursor:pointer">Edit</button>
            ${(it.status||'active') !== 'replaced' ? `<button onclick="swapDocOpen('${it.id}')" title="Replace this item · auto-create INC + MJ + Safety update" style="background:#A8773B;color:#fff;border:none;border-radius:14px;padding:5px 12px;font-size:10.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              Replace
            </button>` : ''}
            <button onclick="flSafetyDelete('${it.id}')" style="background:transparent;color:#A32D2D;border:1px solid #f0c8c5;border-radius:14px;padding:5px 12px;font-size:10.5px;font-weight:600;cursor:pointer">Delete</button>
          </div>
        </div>
        ${_flBuildInspectionSection(it, dim, meta, st)}
        ${(it.log&&it.log.length)?`<div style="margin-top:10px;background:#fafaf8;border-radius:10px;padding:11px 14px;border:1px solid ${dim.line}">
          <div style="font-size:9.5px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">Edit history · ${it.log.length}</div>
          ${it.log.slice().reverse().map(l=>`<div style="display:flex;gap:8px;padding:5px 0;border-top:0.5px solid ${dim.line};font-size:10.5px">
            <span style="font-family:'DM Mono',monospace;color:${dim.ink3};font-weight:600;min-width:80px">${l.date||'—'}</span>
            <span style="background:#fff;color:${dim.ink2};padding:1px 6px;border-radius:4px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border:1px solid ${dim.line};height:fit-content;flex-shrink:0">${l.type||'note'}</span>
            <span style="flex:1;color:${dim.ink}">${l.desc||l.text||'—'}</span>
          </div>`).join('')}
        </div>`:''}
      </div>`;
    } else {
      // List of items (boat mode, category mode, or cell with multiple items)
      const groupBy = (_flSafetySelMode==='boat') ? 'category' : (_flSafetySelMode==='category' ? 'boat' : null);
      let listHtml = '';
      if(groupBy){
        const groups = {};
        items.forEach(it=>{ const k = groupBy==='category' ? it.category : it.boatId; if(!groups[k]) groups[k]=[]; groups[k].push(it); });
        Object.keys(groups).forEach(k=>{
          let groupHdr;
          if(groupBy==='category'){
            const m = FL_SAFETY_CATEGORIES[k] || {label:k, color:dim.ink2};
            groupHdr = `<div style="display:flex;align-items:center;gap:6px;margin:10px 0 5px;padding:0 4px 5px;border-bottom:1px solid rgba(0,0,0,.06)">
              <span style="font-size:10.5px;font-weight:700;color:${m.color}">${m.label}</span>
              <span style="background:${m.color}15;color:${m.color};padding:1px 7px;border-radius:8px;font-size:9.5px;font-weight:600">${groups[k].length}</span>
              ${m.regulatory?`<span style="background:#FCEBEB;color:#A32D2D;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">REQ</span>`:''}
            </div>`;
          } else {
            const bb = getBoat(k);
            groupHdr = `<div style="display:flex;align-items:center;gap:6px;margin:10px 0 5px;padding:0 4px 5px;border-bottom:1px solid rgba(0,0,0,.06)">
              <span style="font-size:10.5px;font-weight:700;color:${dim.ink}">${bb?bb.name:k}</span>
              <span style="font-size:9.5px;color:${dim.ink3};font-family:'DM Mono',monospace">${groups[k].length} items</span>
            </div>`;
          }
          listHtml += groupHdr;
          groups[k].forEach(it=>{ listHtml += _flSafetyMiniRow(it, dim); });
        });
      } else {
        items.forEach(it=>{ listHtml += _flSafetyMiniRow(it, dim); });
      }
      bodyHtml = `<div style="padding:8px 14px 14px;max-height:calc(100vh - 460px);overflow-y:auto">${listHtml}</div>`;
    }
  }

  // ─── Replaced history section (Phase 3.3) ───
  // Items with status='replaced' aren't counted in matrix · shown here as historical reference
  let historyHtml = '';
  if(replacedItems && replacedItems.length){
    const fmtH = s => s || '—';
    const fmtDate = s => s || '—';
    const rows = replacedItems.map(it => {
      const replaceLog = (it.log||[]).filter(l => l.type === 'replace').slice(-1)[0];
      const replaceDate = replaceLog ? replaceLog.date : '—';
      const replaceDesc = replaceLog ? (replaceLog.desc||replaceLog.text||'') : '';
      const b2 = getBoat(it.boatId);
      return `<div style="display:flex;align-items:center;gap:11px;padding:10px 0;border-top:0.5px solid ${dim.line};opacity:.72">
        <div style="width:28px;height:28px;border-radius:50%;background:${dim.line2};color:${dim.ink2};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">↻</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11.5px;font-weight:600;color:${dim.ink};display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${fmtH(it.name)}
            <span style="background:${dim.line};color:${dim.ink2};padding:1px 7px;border-radius:5px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">REPLACED</span>
            ${_flSafetySelMode!=='cell'&&b2?`<span style="font-size:9.5px;color:${dim.ink3};font-family:'DM Mono',monospace">${b2.name}</span>`:''}
          </div>
          <div style="font-size:10px;color:${dim.ink2};margin-top:2px;line-height:1.4">SN ${fmtH(it.serial)} · installed ${fmtDate(it.installDate)} · replaced ${fmtDate(replaceDate)}</div>
          ${replaceDesc?`<div style="font-size:9.5px;color:${dim.ink3};margin-top:2px;font-style:italic">${replaceDesc}</div>`:''}
        </div>
        <button onclick="flSafetyDelete('${it.id}')" title="Remove from history permanently" style="background:transparent;border:none;color:#A32D2D;cursor:pointer;font-size:11px;padding:4px 8px;border-radius:6px;flex-shrink:0;opacity:.5" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.5'">✕</button>
      </div>`;
    }).join('');
    historyHtml = `
      <div style="margin:14px 14px 0;background:#fafaf8;border:1px solid ${dim.line};border-radius:10px;overflow:hidden">
        <div onclick="(function(el){var b=el.nextElementSibling;var c=el.querySelector('.h-caret');if(b.style.display==='none'){b.style.display='block';c.textContent='▾';}else{b.style.display='none';c.textContent='▸';}})(this)" style="padding:9px 14px;background:#fff;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${dim.line}">
          <span class="h-caret" style="font-size:11px;color:${dim.ink3}">▾</span>
          <span style="font-size:10.5px;font-weight:700;color:${dim.ink2};letter-spacing:.05em;text-transform:uppercase">Replaced History</span>
          <span style="background:${dim.line};color:${dim.ink2};padding:1px 8px;border-radius:6px;font-size:9.5px;font-weight:700;font-family:'DM Mono',monospace">${replacedItems.length}</span>
          <span style="font-size:10px;color:${dim.ink3};font-style:italic;margin-left:auto">ไม่นับใน matrix · เก็บไว้เป็นประวัติ</span>
        </div>
        <div style="padding:2px 14px 12px">${rows}</div>
      </div>
    `;
  }

  mount.innerHTML = headerStrip + bodyHtml + historyHtml;
}

// Inspection history section (shown in single-item detail view)
function _flBuildInspectionSection(it, dim, meta, st){
  const inspections = (it.inspections||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const cadMonths = meta.pmMonths || Math.round((meta.pmYears||1)*12);
  const cadLbl = cadMonths === 1 ? '1 month' : (cadMonths < 12 ? `${cadMonths} months` : (cadMonths === 12 ? '1 year' : `${(cadMonths/12).toFixed(1)} years`));
  // Header strip with cadence + last + next + status
  const today = new Date(TODAY_STR);
  let nextDueLbl = 'Not scheduled', nextDueColor = dim.ink3, nextDueBg = '#fafaf8';
  if(it.nextPM){
    const d = new Date(it.nextPM);
    const days = Math.floor((d - today)/86400000);
    if(days < 0){ nextDueLbl = `OVERDUE · ${Math.abs(days)}d ago`; nextDueColor = '#A32D2D'; nextDueBg = '#FCEBEB'; }
    else if(days <= 30){ nextDueLbl = `DUE · ${days}d left`; nextDueColor = '#854F0B'; nextDueBg = '#FFF5EB'; }
    else if(days <= 90){ nextDueLbl = `SOON · ${days}d left`; nextDueColor = '#854F0B'; nextDueBg = '#FFFAF5'; }
    else { nextDueLbl = `OK · ${days}d left`; nextDueColor = '#0F6E56'; nextDueBg = '#E1F5EE'; }
  }
  const headerStrip = `<div style="background:${nextDueBg};border-radius:8px;padding:9px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <span style="background:#fff;color:${nextDueColor};font-size:9px;padding:2px 7px;border-radius:5px;font-weight:700;letter-spacing:.04em">${nextDueLbl}</span>
    <span style="font-size:11px;color:${dim.ink2}">Cadence <strong style="color:${dim.ink}">every ${cadLbl}</strong></span>
    <span style="font-size:10.5px;color:${dim.ink3};font-family:'DM Mono',monospace">Last: ${it.lastInspect||'—'} · Next: ${it.nextPM||'—'}</span>
  </div>`;

  // Inspection entries
  let entriesHtml = '';
  if(inspections.length === 0){
    entriesHtml = `<div style="padding:14px;text-align:center;color:${dim.ink3};font-size:11px;font-style:italic;border:1px dashed ${dim.line};border-radius:8px">No inspections logged yet · click "+ Log Inspection" below to add the first one</div>`;
  } else {
    entriesHtml = inspections.map(insp => {
      const rmeta = INSP_RESULT_STYLE[insp.result] || INSP_RESULT_STYLE.observation;
      return `<div style="background:${rmeta.bg};border:1px solid ${rmeta.border};border-radius:7px;padding:8px 12px;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:${rmeta.color}">${insp.date||'—'}</span>
          <span style="background:#fff;color:${rmeta.color};font-size:9px;padding:2px 7px;border-radius:5px;font-weight:700;letter-spacing:.03em">${rmeta.icon} ${rmeta.label}</span>
          ${insp.inspector?`<span style="font-size:11px;color:${dim.ink2}">${insp.inspector}</span>`:''}
          ${rmeta.countsAsCheck && insp.nextDue ? `<span style="margin-left:auto;font-size:10px;color:${dim.ink3};font-family:'DM Mono',monospace">next: ${insp.nextDue}</span>` : ''}
          <div style="display:flex;gap:3px;${rmeta.countsAsCheck && insp.nextDue ? '' : 'margin-left:auto'}">
            <button onclick="flOpenLogInspectionModal('${it.id}','${insp.id}')" title="Edit" style="background:transparent;border:1px solid ${dim.line};color:${dim.ink2};border-radius:4px;padding:2px 6px;font-size:9.5px;cursor:pointer">✎</button>
            <button onclick="flDeleteInspection('${it.id}','${insp.id}')" title="Delete" style="background:transparent;border:1px solid #f0c8c5;color:#A32D2D;border-radius:4px;padding:2px 6px;font-size:9.5px;cursor:pointer">✕</button>
          </div>
        </div>
        ${insp.findings?`<div style="font-size:11px;color:${dim.ink};margin-top:4px;line-height:1.5">${insp.findings}</div>`:''}
      </div>`;
    }).join('');
  }

  return `<div style="margin-top:14px;background:#fafaf8;border-radius:10px;padding:11px 14px;border:1px solid ${dim.line}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:9.5px;color:${dim.ink3};text-transform:uppercase;letter-spacing:.05em;font-weight:700">Inspections · ${inspections.length}</div>
      <button onclick="flOpenLogInspectionModal('${it.id}')" style="background:#BA7517;color:#fff;border:none;border-radius:6px;padding:5px 11px;font-size:10.5px;font-weight:600;cursor:pointer;font-family:inherit">+ Log Inspection</button>
    </div>
    ${headerStrip}
    ${entriesHtml}
  </div>`;
}

// Compact item row for multi-item detail panel
function _flSafetyMiniRow(it, dim){
  const SVG_PINK={soft:'#FCE5EC',text:'#9F1B4F'};
  const meta = FL_SAFETY_CATEGORIES[it.category] || {label:it.category, color:dim.ink2};
  const st = _flSafetyStatus(it);
  const b = getBoat(it.boatId);
  const rowBg = st.label==='EXPIRED'?'#FBEDED':(st.days!=null&&st.days<=90?'#FBF5E8':'#fff');
  return `<div style="display:flex;align-items:center;gap:9px;padding:8px 9px;border:0.5px solid ${dim.line};border-radius:7px;margin-bottom:5px;background:${rowBg}">
    <span style="background:${meta.color}15;color:${meta.color};padding:2px 7px;border-radius:5px;font-size:9px;font-weight:700;flex-shrink:0;white-space:nowrap">${meta.label}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:11.5px;font-weight:600;color:${dim.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.name}</div>
      <div style="font-size:9.5px;color:${dim.ink3};margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b?b.name+' · ':''}${it.location||''}${it.serial?' · '+it.serial:''}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:10px;color:${dim.ink2};font-family:'DM Mono',monospace">qty ${it.qty||1}</div>
      <div style="font-size:9.5px;color:${dim.ink3};font-family:'DM Mono',monospace;margin-top:1px">${it.expiryDate||it.nextPM||'—'}</div>
    </div>
    <span style="background:${st.bg};color:${st.color};padding:2px 7px;border-radius:5px;font-size:9px;font-weight:700;letter-spacing:.03em;flex-shrink:0">${st.label}</span>
    <div style="display:flex;gap:3px;flex-shrink:0">
      <button onclick="flOpenAddSafetyModal('${it.id}')" title="Edit" style="background:transparent;border:1px solid ${dim.line};color:${dim.ink2};border-radius:5px;padding:3px 7px;font-size:9.5px;cursor:pointer">✎</button>
      <button onclick="flSafetyDelete('${it.id}')" title="Delete" style="background:transparent;border:1px solid #f0c8c5;color:#A32D2D;border-radius:5px;padding:3px 7px;font-size:9.5px;cursor:pointer">✕</button>
    </div>
  </div>`;
}

// Helper: human-readable age (days/months/years)
function _safetyAge(dateStr){
  if(!dateStr) return '';
  const d=new Date(dateStr); const now=new Date(TODAY_STR);
  const days=Math.floor((now-d)/86400000);
  if(days<30) return days+' days';
  const mo=Math.floor(days/30);
  if(mo<12) return mo+' mo';
  const yr=(days/365).toFixed(1);
  return yr+' yr';
}

function flSafetyDelete(id){
  const it=FL_SAFETY.find(x=>x.id===id);
  if(!it) return;
  if(!confirm(`Delete "${it.name}"?\nThis cannot be undone.`)) return;
  FL_SAFETY=FL_SAFETY.filter(x=>x.id!==id);
  flSave();
  flSelSafetyId=null;
  flRenderSafetyList();
}

// ════════ Replace Safety Equipment Wizard · Phase 1: shell + state + step nav ════════
let _swapDoc = null;

const SWAP_REASONS = [
  {id:'broken',    label:'🔧 Broken',       severity:'high',   color:'#A32D2D'},
  {id:'expired',   label:'⏱ Expired',       severity:'medium', color:'#854F0B'},
  {id:'upgrade',   label:'⬆ Upgrade',       severity:'low',    color:'#0F6E56'},
  {id:'scheduled', label:'📅 Scheduled PM', severity:'low',    color:'#185FA5'},
  {id:'lost',      label:'⚠ Lost / Missing', severity:'high',  color:'#A32D2D'}
];

function swapDocOpen(itemId){
  const it = FL_SAFETY.find(x => x.id === itemId);
  if(!it){ alert('Item not found'); return; }
  // Default search keyword = safety category label (e.g., "Bilge pump") · user can change
  const cat0 = FL_SAFETY_CATEGORIES[it.category];
  const defaultQuery = cat0 ? cat0.label : (it.name||'').split(/[\s·]/)[0];
  _swapDoc = {
    itemId,
    step: 1,
    reason: 'broken',
    description: '',
    date: (new Date()).toISOString().slice(0,10),
    source: 'inventory',        // 'inventory' | 'buy'
    invQuery: defaultQuery,     // free-text search · user controls what to filter
    newInventoryId: null,
    newSerial: '',
    newBrand: it.brand || '',
    newModel: it.model || '',
    newPrice: 0,
    supplier: '',
    installDate: (new Date()).toISOString().slice(0,10),
    installer: '',
    newLabour: 0     // user-entered labour cost · added to MJ total
  };
  document.getElementById('swap-modal').style.display = 'flex';
  swapDocRender();
}

function swapDocClose(){
  document.getElementById('swap-modal').style.display = 'none';
  _swapDoc = null;
}

function swapDocSetStep(n){
  if(!_swapDoc) return;
  if(n < 1 || n > 3) return;
  _swapDoc.step = n;
  swapDocRender();
}

function swapDocSet(key, val){
  if(!_swapDoc) return;
  _swapDoc[key] = val;
  swapDocRender();
}

// Update inventory search query · only re-render the list (preserves input focus)
function swapDocSetQuery(val){
  if(!_swapDoc) return;
  _swapDoc.invQuery = val;
  const host = document.getElementById('swap-inv-list');
  if(host){
    const it = FL_SAFETY.find(x => x.id === _swapDoc.itemId);
    const b  = it ? getBoat(it.boatId) : null;
    const cat = it ? (FL_SAFETY_CATEGORIES[it.category] || {label:it.category}) : {label:''};
    host.innerHTML = _swapDocBuildInvList(it, cat);
  }
  // Also update count badge
  const countEl = document.getElementById('swap-inv-count');
  if(countEl){
    const q = (_swapDoc.invQuery||'').toLowerCase().trim();
    const n = q ? (FL_INVENTORY||[]).filter(x =>
      (x.name||'').toLowerCase().includes(q) ||
      (x.partNo||'').toLowerCase().includes(q) ||
      (x.supplier||'').toLowerCase().includes(q)
    ).length : (FL_INVENTORY||[]).length;
    countEl.textContent = `${n} match${n===1?'':'es'}`;
  }
}

// ─── Step body renderers ───
function _swapDocRenderStep(it, b, cat){
  if(_swapDoc.step === 1) return _swapDocStep1(it, b, cat);
  if(_swapDoc.step === 2) return _swapDocStep2(it, b, cat);
  if(_swapDoc.step === 3) return _swapDocStep3(it, b, cat);
  return '';
}

function _swapDocStep1(it, b, cat){
  const sel = _swapDoc.reason;
  const reasonChips = SWAP_REASONS.map(r => {
    const on = r.id === sel;
    return `<button onclick="swapDocSet('reason','${r.id}')" type="button" style="background:${on?'#A8773B':'#fff'};color:${on?'#fff':'#5F5E5A'};border:1px solid ${on?'#A8773B':'#E0DED8'};border-radius:14px;padding:6px 14px;font-size:11px;font-weight:${on?'700':'600'};cursor:pointer;font-family:inherit">${r.label}</button>`;
  }).join('');
  const sevObj = SWAP_REASONS.find(r => r.id === sel) || SWAP_REASONS[0];
  const sevBg = sevObj.severity === 'high' ? '#FDECEA' : sevObj.severity === 'medium' ? '#FFF5EB' : '#E1F5EE';
  const sevFg = sevObj.severity === 'high' ? '#A32D2D' : sevObj.severity === 'medium' ? '#854F0B' : '#0F6E56';
  // Auto-generate next IDs (preview only · saved on confirm)
  const nextIncId = `INC-${String((FL_INCIDENTS||[]).length + 1).padStart(3,'0')}`;
  return `
    <div style="font-size:9.5px;font-weight:700;color:#A8773B;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Step 1 · Reason for replacement</div>

    <div style="font-size:10.5px;color:#5F5E5A;margin-bottom:6px">Reason</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${reasonChips}</div>

    <div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Description (จะใส่ใน INC + MJ)</div>
    <textarea onchange="swapDocSet('description', this.value)" rows="3" placeholder="อธิบายปัญหา · เช่น 'ปั๊มไม่ทำงาน · มอเตอร์ค้าง · พบจาก inspection ประจำเดือน'" style="width:100%;padding:10px 12px;font-size:11.5px;font-family:Manrope,system-ui,sans-serif;border:1px solid #E0DED8;border-radius:6px;background:#fff;color:#0F1419;line-height:1.5;outline:none;resize:vertical">${_swapDoc.description||''}</textarea>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
      <div>
        <div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Date discovered</div>
        <input type="date" value="${_swapDoc.date||''}" onchange="swapDocSet('date', this.value)" style="width:100%;height:32px;font-size:11.5px;font-family:Manrope,system-ui,sans-serif;font-variant-numeric:tabular-nums;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff">
      </div>
      <div>
        <div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Severity (auto → INC priority)</div>
        <span style="display:inline-flex;align-items:center;height:32px;padding:0 16px;background:${sevBg};color:${sevFg};border-radius:16px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${sevObj.severity}</span>
      </div>
    </div>

    <!-- Will-create banner -->
    <div style="margin-top:18px;background:#FFF7E8;border:1px solid #A8773B33;border-radius:8px;padding:11px 14px">
      <div style="font-size:10.5px;font-weight:700;color:#A8773B;letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px">📋 Will create</div>
      <div style="font-size:11px;color:#5F5E5A;line-height:1.55"><strong style="color:#0F1419">${nextIncId}</strong> · ${cat.label} (${b?b.name:'?'}) · ${sevObj.severity} priority · auto-link to MJ + Safety update</div>
    </div>
  `;
}

// Build the filtered inventory list HTML · used by Step 2 + live search
function _swapDocBuildInvList(it, cat){
  const q = (_swapDoc.invQuery||'').toLowerCase().trim();
  const all = (FL_INVENTORY||[]);
  const matches = q
    ? all.filter(x =>
        (x.name||'').toLowerCase().includes(q) ||
        (x.partNo||'').toLowerCase().includes(q) ||
        (x.supplier||'').toLowerCase().includes(q) ||
        (x.category||'').toLowerCase().includes(q))
    : all;
  if(matches.length === 0){
    return `<div style="background:#FFF5EB;border:1px solid #F5C896;border-radius:8px;padding:16px;text-align:center">
      <div style="font-size:11.5px;color:#854F0B;font-weight:600;margin-bottom:4px">⚠ ไม่พบ inventory ตรงกับ "${q}"</div>
      <div style="font-size:10.5px;color:#7a7770">ลบคำค้นเพื่อดูทั้งหมด · หรือสลับไป "Buy new" เพื่อสั่งซื้อ</div>
    </div>`;
  }
  // Show top 8 (scroll for more in container)
  const visible = matches.slice(0, 8);
  return visible.map(m => {
    const isSel = _swapDoc.newInventoryId === m.id;
    const catTag = m.category ? `<span style="background:#F5F4EE;color:#5F5E5A;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;letter-spacing:.04em;text-transform:uppercase;margin-left:6px">${m.category}</span>` : '';
    return `<div onclick="swapDocSet('newInventoryId','${m.id}')" style="background:${isSel?'#F4FBF7':'#fff'};border:${isSel?'2px':'1px'} solid ${isSel?'#0F6E56':'#E0DED8'};border-radius:10px;padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <div style="width:36px;height:36px;border-radius:50%;background:${isSel?'#0F6E56':'#9b9590'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">📦</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:700;color:#0F1419;display:flex;align-items:center;flex-wrap:wrap">${m.name}${catTag}</div>
        <div style="font-size:10px;color:#5F5E5A;font-variant-numeric:tabular-nums;margin-top:1px">SKU ${m.partNo||'—'} · ${m.supplier||'?'} · ${m.location||'?'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:11px;font-weight:700;color:${m.qty>0?'#0F6E56':'#A32D2D'};font-variant-numeric:tabular-nums">${m.qty} in stock</div>
        <div style="font-size:10px;color:#5F5E5A;font-variant-numeric:tabular-nums">฿${(m.cost||0).toLocaleString()}</div>
      </div>
      ${isSel ? '<div style="width:22px;height:22px;border-radius:50%;background:#0F6E56;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">✓</div>' : ''}
    </div>`;
  }).join('') + (matches.length > visible.length ? `<div style="text-align:center;font-size:10.5px;color:#7a7770;padding:8px 0;font-style:italic">+ ${matches.length - visible.length} more · พิมพ์ค้นเพิ่มเติมเพื่อกรอง</div>` : '');
}

function _swapDocStep2(it, b, cat){
  const src = _swapDoc.source;

  const sourceToggle = `
    <div style="display:inline-flex;background:#F5F4EE;border-radius:19px;padding:3px;gap:2px;margin-bottom:14px">
      <button onclick="swapDocSet('source','inventory')" type="button" style="background:${src==='inventory'?'#A8773B':'transparent'};color:${src==='inventory'?'#fff':'#9b9590'};border:none;border-radius:16px;padding:6px 18px;font-size:11.5px;font-weight:${src==='inventory'?'700':'600'};cursor:pointer;font-family:inherit">📦 Use from Inventory</button>
      <button onclick="swapDocSet('source','buy')" type="button" style="background:${src==='buy'?'#A8773B':'transparent'};color:${src==='buy'?'#fff':'#9b9590'};border:none;border-radius:16px;padding:6px 18px;font-size:11.5px;font-weight:${src==='buy'?'700':'600'};cursor:pointer;font-family:inherit">🛒 Buy new (creates MO)</button>
    </div>
  `;

  let sourceBody = '';
  if(src === 'inventory'){
    const q = (_swapDoc.invQuery||'').toLowerCase().trim();
    const totalMatches = q ? (FL_INVENTORY||[]).filter(x =>
      (x.name||'').toLowerCase().includes(q) ||
      (x.partNo||'').toLowerCase().includes(q) ||
      (x.supplier||'').toLowerCase().includes(q) ||
      (x.category||'').toLowerCase().includes(q)
    ).length : (FL_INVENTORY||[]).length;
    sourceBody = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="position:relative;flex:1">
          <input type="text" value="${(_swapDoc.invQuery||'').replace(/"/g,'&quot;')}"
            oninput="swapDocSetQuery(this.value)"
            placeholder="ค้นหา · ชื่อ / SKU / supplier / category"
            style="width:100%;padding:9px 12px 9px 34px;font-size:12px;font-family:Manrope,system-ui,sans-serif;border:1px solid #E0DED8;border-radius:8px;background:#fff;outline:none">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:13px;color:#9b9590">🔍</span>
          ${_swapDoc.invQuery ? `<button onclick="swapDocSetQuery('')" type="button" title="Clear" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#9b9590;font-size:15px;cursor:pointer;padding:2px 6px;font-family:inherit">×</button>` : ''}
        </div>
        <span id="swap-inv-count" style="font-size:10.5px;color:#7a7770;font-variant-numeric:tabular-nums;font-weight:600">${totalMatches} match${totalMatches===1?'':'es'}</span>
      </div>
      <div id="swap-inv-list" style="max-height:280px;overflow-y:auto;padding-right:4px">${_swapDocBuildInvList(it, cat)}</div>
      <div style="margin-top:8px;font-size:10px;color:#9b9590;font-style:italic;line-height:1.5">⌗ Tip · กรอง category ที่เกี่ยวข้อง: ${(function(){
        const cats = [...new Set((FL_INVENTORY||[]).map(x => x.category).filter(Boolean))];
        return cats.slice(0,6).map(c => `<button onclick="swapDocSetQuery('${c.replace(/'/g,'')}')" type="button" style="background:#F5F4EE;color:#5F5E5A;border:none;border-radius:6px;padding:2px 9px;font-size:10px;font-weight:600;cursor:pointer;margin:0 2px;font-family:inherit">${c}</button>`).join('');
      })()}</div>
    `;
  } else {
    sourceBody = `
      <div style="background:#FFF5EB;border:1px solid #F5C896;border-radius:8px;padding:12px 14px;margin-bottom:14px">
        <div style="font-size:10.5px;color:#854F0B;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">🛒 Will create Memo Order</div>
        <div style="font-size:10.5px;color:#5F5E5A">ระบบจะสร้าง MO ใหม่ + เพิ่ม item ใน inventory · status: ordered → ต้องไป receive ในหน้า Memo ตามปกติ</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Brand</div><input type="text" value="${_swapDoc.newBrand||''}" onchange="swapDocSet('newBrand', this.value)" placeholder="เช่น Rule" style="width:100%;height:32px;font-size:11.5px;font-family:inherit;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff"></div>
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Model</div><input type="text" value="${_swapDoc.newModel||''}" onchange="swapDocSet('newModel', this.value)" placeholder="เช่น 1500 GPH" style="width:100%;height:32px;font-size:11.5px;font-family:inherit;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff"></div>
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Supplier</div><input type="text" value="${_swapDoc.supplier||''}" onchange="swapDocSet('supplier', this.value)" placeholder="เช่น Megazip" style="width:100%;height:32px;font-size:11.5px;font-family:inherit;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff"></div>
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Unit price (THB)</div><input type="number" value="${_swapDoc.newPrice||0}" onchange="swapDocSet('newPrice', +this.value||0)" min="0" style="width:100%;height:32px;font-size:11.5px;font-variant-numeric:tabular-nums;text-align:right;font-family:inherit;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff"></div>
      </div>
    `;
  }

  // Auto-compute next PM from category
  const months = (cat && cat.pmMonths) ? cat.pmMonths : 1;
  let nextPMStr = '—';
  if(_swapDoc.installDate){
    try { const d=new Date(_swapDoc.installDate); d.setMonth(d.getMonth()+months); nextPMStr = d.toISOString().slice(0,10); } catch(e){}
  }

  return `
    <div style="font-size:9.5px;font-weight:700;color:#A8773B;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Step 2 · Source of new item</div>
    ${sourceToggle}
    ${sourceBody}

    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #E0DED8">
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr 1.2fr 1fr;gap:10px">
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">New serial</div><input type="text" value="${_swapDoc.newSerial||''}" onchange="swapDocSet('newSerial', this.value)" placeholder="เช่น BP-002" style="width:100%;height:32px;font-size:11.5px;font-variant-numeric:tabular-nums;font-family:inherit;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff"></div>
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Install date</div><input type="date" value="${_swapDoc.installDate||''}" onchange="swapDocSet('installDate', this.value)" style="width:100%;height:32px;font-size:11.5px;font-variant-numeric:tabular-nums;font-family:inherit;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff"></div>
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Next PM <span style="font-size:9px;color:#9b9590">${months}mo</span></div><div style="height:32px;display:flex;align-items:center;padding:0 8px;font-size:11px;font-variant-numeric:tabular-nums;color:#9b9590;background:#F5F4EE;border:1px solid #E0DED8;border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nextPMStr}</div></div>
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Installer</div><input type="text" value="${_swapDoc.installer||''}" onchange="swapDocSet('installer', this.value)" placeholder="ช่างคนติดตั้ง" style="width:100%;height:32px;font-size:11.5px;font-family:inherit;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff"></div>
        <div><div style="font-size:10.5px;color:#5F5E5A;margin-bottom:4px">Labour cost <span style="font-size:9px;color:#9b9590">THB</span></div><input type="number" value="${_swapDoc.newLabour||0}" onchange="swapDocSet('newLabour', +this.value||0)" min="0" placeholder="0" style="width:100%;height:32px;font-size:11.5px;font-variant-numeric:tabular-nums;text-align:right;font-family:inherit;border:1px solid #E0DED8;border-radius:5px;padding:2px 8px;background:#fff"></div>
      </div>
    </div>
  `;
}

function _swapDocStep3(it, b, cat){
  const fmtN = (n) => (n||0).toLocaleString();
  const reasonObj = SWAP_REASONS.find(r => r.id === _swapDoc.reason) || SWAP_REASONS[0];
  const nextInc = `INC-${String((FL_INCIDENTS||[]).length + 1).padStart(3,'0')}`;
  const nextMo  = `MO-${String((FL_MEMOS||[]).length + 1).padStart(3,'0')}`;
  const nextMj  = `MJ-${String((FL_MAINT||[]).length + 1).padStart(3,'0')}`;
  // Get selected inventory item (if applicable)
  const invItem = _swapDoc.source === 'inventory' && _swapDoc.newInventoryId
    ? (FL_INVENTORY||[]).find(x => x.id === _swapDoc.newInventoryId)
    : null;
  const partsCost = _swapDoc.source === 'inventory'
    ? (invItem ? (invItem.cost||0) : 0)
    : (_swapDoc.newPrice || 0);
  const laborCost = _swapDoc.newLabour || 0;
  const total = partsCost + laborCost;

  const card = (color, bg, kicker, idLabel, line1, line2) => `
    <div style="background:${bg};border:1px solid ${color}33;border-radius:10px;padding:12px 14px;flex:1;min-width:160px">
      <div style="font-size:9px;font-weight:700;color:${color};letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">${kicker}</div>
      <div style="font-size:13px;font-weight:700;color:${color}">${idLabel}</div>
      <div style="font-size:10.5px;color:#5F5E5A;margin-top:3px">${line1}</div>
      ${line2 ? `<div style="font-size:9.5px;color:#7a7770;margin-top:2px">${line2}</div>` : ''}
    </div>`;

  const skipCard = `
    <div style="background:#FFF5EB;border:1px dashed #9b9590;border-radius:10px;padding:12px 14px;flex:1;min-width:160px;opacity:.7">
      <div style="font-size:9px;font-weight:700;color:#854F0B;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">🛒 Memo Order</div>
      <div style="font-size:13px;font-weight:700;color:#854F0B">(skipped)</div>
      <div style="font-size:10.5px;color:#5F5E5A;margin-top:3px">Using inventory</div>
      <div style="font-size:9.5px;color:#7a7770;margin-top:2px">— no order needed —</div>
    </div>`;

  const arrow = '<div style="display:flex;align-items:center;color:#A8773B;font-size:16px;font-weight:700">→</div>';

  return `
    <div style="font-size:9.5px;font-weight:700;color:#A8773B;letter-spacing:.06em;text-transform:uppercase;margin-bottom:12px">Step 3 · Preview · 5 records will be created/updated</div>

    <!-- Record chain -->
    <div style="display:flex;gap:6px;align-items:stretch;flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px">
      ${card('#A32D2D','#FDECEA','📋 Incident', nextInc, `${cat.label} · ${reasonObj.severity}`, 'Status: open')}
      ${arrow}
      ${_swapDoc.source === 'buy'
        ? card('#854F0B','#FFF5EB','🛒 Memo Order', nextMo, `${_swapDoc.newBrand||'?'} · ${_swapDoc.newModel||'?'}`, `฿${fmtN(_swapDoc.newPrice)} · ${_swapDoc.supplier||'?'}`)
        : skipCard}
      ${arrow}
      ${card('#185FA5','#F4F8FB','🔧 Maintenance', nextMj, `Replace ${cat.label}`, 'Status: done · auto-closed')}
      ${arrow}
      ${card('#0F6E56','#F4FBF7','📦 Inventory',
        _swapDoc.source === 'inventory' && invItem ? `−1 ${invItem.partNo||invItem.name.slice(0,16)}` : 'auto-add new',
        _swapDoc.source === 'inventory' && invItem ? `Stock: ${invItem.qty} → ${invItem.qty-1}` : 'after MO receive',
        `฿${fmtN(partsCost)} → MJ cost`)}
      ${arrow}
      ${card('#A8773B','#FFF7E8','🛟 Safety', `${it.serial||'?'} ✗`, `→ ${_swapDoc.newSerial||'NEW'} ✓`, '+ log entry')}
    </div>

    <!-- Initial inspection card -->
    <div style="display:flex;justify-content:center;margin-top:4px;color:#A8773B;font-size:16px;font-weight:700">↓</div>
    <div style="background:#FFF7E8;border:1px solid #A8773B66;border-radius:10px;padding:11px 16px;max-width:380px;margin:6px auto 0">
      <div style="font-size:9px;font-weight:700;color:#A8773B;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">🔍 Initial Inspection</div>
      <div style="font-size:11.5px;color:#5F5E5A">Result: <strong style="color:#0F6E56">PASS</strong> · Initial commissioning test</div>
      <div style="font-size:10px;color:#7a7770;margin-top:2px">Next PM: ${(function(){
        const months = (cat && cat.pmMonths) ? cat.pmMonths : 1;
        if(_swapDoc.installDate){
          try { const d=new Date(_swapDoc.installDate); d.setMonth(d.getMonth()+months); return d.toISOString().slice(0,10) + ' (' + months + ' mo auto)'; } catch(e){}
        }
        return '—';
      })()}</div>
    </div>

    <!-- Total cost -->
    <div style="margin-top:18px;padding:12px 16px;background:#1A2B43;color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:10px;color:#A3B7D6;letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin-bottom:2px">Total cost · MJ entry</div>
        <div style="font-size:10.5px;color:#A3B7D6">parts ฿${fmtN(partsCost)}${laborCost>0?` + labour ฿${fmtN(laborCost)}`:' (no labour cost)'}</div>
      </div>
      <div style="font-size:22px;font-weight:700;font-variant-numeric:tabular-nums">฿${fmtN(total)}</div>
    </div>
    <div style="margin-top:10px;font-size:10.5px;color:#5F5E5A;font-style:italic">⌗ ทุก record link ถึงกัน · เปิด ${nextInc} จะเห็นลิงก์ไป ${nextMj} · เปิด ${nextMj} จะเห็นลิงก์ Inventory withdraw + Safety update</div>
  `;
}

// ─── Execute · create all records on Confirm ───
function swapDocExecute(){
  if(!_swapDoc) return;
  const it = FL_SAFETY.find(x => x.id === _swapDoc.itemId);
  if(!it){ alert('Safety item not found'); return; }
  const b   = getBoat(it.boatId);
  const cat = FL_SAFETY_CATEGORIES[it.category] || {label:it.category, color:'#9b9590', pmMonths:1};
  const reasonObj = SWAP_REASONS.find(r => r.id === _swapDoc.reason) || SWAP_REASONS[0];

  // Validate based on source
  if(_swapDoc.source === 'inventory'){
    if(!_swapDoc.newInventoryId){ alert('Please pick an inventory item or switch to "Buy new"'); return; }
    const invItem = FL_INVENTORY.find(x => x.id === _swapDoc.newInventoryId);
    if(!invItem){ alert('Inventory item not found'); return; }
    if((invItem.qty||0) < 1){
      if(!confirm(`⚠ "${invItem.name}" has 0 in stock · Proceed anyway and create negative balance?`)) return;
    }
  } else {
    if(!_swapDoc.newBrand && !_swapDoc.newModel){ alert('Please fill brand or model for new purchase'); return; }
  }
  if(!_swapDoc.newSerial){
    if(!confirm('No serial number entered · Proceed without serial?')) return;
  }

  // Next IDs (3-digit padded)
  const nextNo = (arr, prefix) => `${prefix}-${String((arr||[]).length + 1).padStart(3,'0')}`;
  const incNo = nextNo(FL_INCIDENTS, 'INC');
  const mjNo  = nextNo(FL_MAINT,     'MJ');
  const moNo  = _swapDoc.source === 'buy' ? nextNo(FL_MEMOS, 'MO') : null;
  const today = _swapDoc.date || (new Date()).toISOString().slice(0,10);
  const installDate = _swapDoc.installDate || today;

  // Compute next PM from cat.pmMonths (default 1)
  const months = (cat && cat.pmMonths) ? cat.pmMonths : 1;
  let nextPM = '';
  try { const d = new Date(installDate); d.setMonth(d.getMonth() + months); nextPM = d.toISOString().slice(0,10); } catch(e){}

  // ─── 1. Create INCIDENT ───
  const incObj = {
    id: 'inc_' + Date.now(),
    no: incNo,
    boatId: it.boatId,
    date: today, time: '',
    title: `เปลี่ยน ${cat.label} · ${reasonObj.label.replace(/^[^\s]+\s/,'')}`,
    detail: _swapDoc.description || `${reasonObj.label} · ${cat.label} (${it.name||''})`,
    remark: `Safety item: ${it.name||cat.label} · SN ${it.serial||'—'}`,
    damagedAssets: [
      { type: 'safety', id: it.id, label: `${cat.label} · ${it.name||''}${it.serial?` · SN ${it.serial}`:''}` }
    ],
    priority: reasonObj.severity === 'high' ? 5 : reasonObj.severity === 'medium' ? 3 : 2,
    severity: reasonObj.severity === 'high' ? 'critical' : reasonObj.severity,
    type: 'incident',
    status: 'resolved',     // Replace flow finishes immediately → mark resolved
    maintId: null,          // set below after MJ created
    progressLog: [
      { date: today, text: `เปิด Incident จาก Replace wizard · ${reasonObj.label} · ${cat.label}`, by: 'ระบบ' },
      { date: today, text: `+ สร้าง Job ${mjNo} · เปลี่ยน ${cat.label}`, by: 'ระบบ' },
      ...(moNo ? [{ date: today, text: `📋 สร้าง Memo ${moNo} · สั่งซื้อของใหม่`, by: 'ระบบ' }] : [{ date: today, text: `📦 เบิกจาก Inventory`, by: 'ระบบ' }]),
      { date: today, text: `✓ ติดตั้งของใหม่เสร็จ · SN ${_swapDoc.newSerial||'—'} · ปิด Incident`, by: 'ระบบ' }
    ]
  };
  FL_INCIDENTS.push(incObj);

  // ─── 2. Create MEMO (if buy mode) + register new inventory item ───
  let newInvId = null;
  if(_swapDoc.source === 'buy'){
    // Create a new inventory entry too so MO links to it
    newInvId = 'i_' + Date.now();
    const newInvItem = {
      id: newInvId,
      name: `${_swapDoc.newBrand} ${_swapDoc.newModel}`.trim() || cat.label,
      partNo: '',
      category: 'safety',
      supplier: _swapDoc.supplier || '',
      location: b ? `คลัง ${b.pier==='panwa'?'Visit Panwa':'Tub Lamu'}` : '',
      unit: 'ชิ้น',
      qty: 0,
      minQty: 0,
      cost: _swapDoc.newPrice || 0,
      note: `Auto-created via Replace wizard (${incNo})`,
      history: [
        { date: today, type: 'create', desc: `+ สร้างจาก Replace wizard · ${incNo}`, by: 'ระบบ' }
      ]
    };
    FL_INVENTORY.push(newInvItem);

    const moObj = {
      id: 'mo_' + Date.now(),
      no: moNo,
      title: `สั่งซื้อ ${cat.label} · ${_swapDoc.newBrand||''} ${_swapDoc.newModel||''}`.trim(),
      boatId: it.boatId,
      memoType: 'parts',
      proposer: '', from: 'ท่าเรือภูเก็ต', to: 'กรรมการผู้จัดการ', cc: 'ผู้จัดการแผนกบัญชี',
      createdDate: today,
      status: 'pending_approval', currentStep: 1,
      vatEnabled: true, vatRate: 7,
      refNote: `Replace ${cat.label} via ${incNo} (${mjNo})`,
      items: [
        {
          name: `${_swapDoc.newBrand} ${_swapDoc.newModel}`.trim() || cat.label,
          qty: 1, price: _swapDoc.newPrice||0,
          category: 'safety', partNo: '',
          invId: newInvId, unit: 'ชิ้น', fromInventory: true
        }
      ]
    };
    FL_MEMOS.push(moObj);
  }

  // ─── 3. Create MAINTENANCE JOB ───
  const mjObj = {
    id: 'mj_' + Date.now(),
    no: mjNo,
    boatId: it.boatId,
    type: 'corrective',
    title: `เปลี่ยน ${cat.label}${it.location?' · '+it.location:''}`,
    detail: `Replace ${cat.label} via wizard · old SN ${it.serial||'—'} → new SN ${_swapDoc.newSerial||'—'}${_swapDoc.description?' · '+_swapDoc.description:''}`,
    location: it.location || '',
    status: 'done',
    startDate: today,
    endDate: installDate,
    cost: (_swapDoc.source === 'inventory'
      ? ((FL_INVENTORY.find(x => x.id === _swapDoc.newInventoryId)||{}).cost || 0)
      : (_swapDoc.newPrice || 0)) + (_swapDoc.newLabour || 0),
    incidentId: incObj.id,
    assets: [
      { type: 'safety', id: it.id, label: `${cat.label} · ${it.name||''}` }
    ],
    progressLog: [
      { date: today, text: `+ เปิด Job ${mjNo} จาก ${incNo} · เปลี่ยน ${cat.label}`, by: 'ระบบ' },
      ...(moNo
        ? [{ date: today, text: `📋 สร้าง Memo ${moNo} · สั่งซื้อ ${_swapDoc.newBrand||''} ${_swapDoc.newModel||''}`.trim(), by: 'ระบบ' }]
        : [{ date: today, text: `📦 เบิก ${(FL_INVENTORY.find(x => x.id === _swapDoc.newInventoryId)||{}).name||'parts'} จาก Inventory`, by: 'ระบบ' }]),
      { date: installDate, text: `✓ ติดตั้งเสร็จ · ${_swapDoc.installer ? 'โดย '+_swapDoc.installer : 'self-install'} · ปิดงาน`, by: 'ระบบ' }
    ],
    setFixing: false
  };
  FL_MAINT.push(mjObj);

  // back-link INC.maintId
  incObj.maintId = mjObj.id;

  // ─── 4. Update INVENTORY (if used from stock) ───
  // FIX 2026-05-29: must use invRemoveAt() (manages stocks[] · totalQty · legacy qty)
  // Previous bug: did inv.qty -= 1 directly · bypassed stocks[] → display showed stale count
  // Also: history qty must be POSITIVE · formatter prepends "-" based on type
  if(_swapDoc.source === 'inventory'){
    const inv = FL_INVENTORY.find(x => x.id === _swapDoc.newInventoryId);
    if(inv){
      // Pick warehouse · prefer boat's home pier · fallback to first stock with qty
      const prefLoc = b ? `คลัง ${b.pier==='panwa'?'Visit Panwa':'Tub Lamu'}` : null;
      let pickLoc = null;
      if(Array.isArray(inv.stocks) && inv.stocks.length){
        const pref = prefLoc ? inv.stocks.find(s => s.location === prefLoc && (s.qty||0) >= 1) : null;
        if(pref){ pickLoc = pref.location; }
        else {
          const anyAvail = inv.stocks.find(s => (s.qty||0) >= 1);
          pickLoc = anyAvail ? anyAvail.location : inv.stocks[0].location;
        }
      }
      if(pickLoc && typeof invRemoveAt === 'function'){
        invRemoveAt(inv, pickLoc, 1);   // syncs stocks[] · totalQty · qty automatically
      } else {
        // Last-resort legacy fallback (item missing stocks[])
        inv.qty = Math.max(0, (inv.qty||0) - 1);
      }
      if(!inv.history) inv.history = [];
      inv.history.push({
        date: today, type: 'withdraw', qty: 1, location: pickLoc || '',
        desc: `Replace ${cat.label} on ${b?b.name:'?'} · ${mjNo}`, by: 'ระบบ'
      });
    }
  }

  // ─── 5. Mark old SAFETY item as replaced + log ───
  it.status = 'replaced';
  if(!it.log) it.log = [];
  it.log.push({
    date: today, type: 'replace',
    desc: `Replaced via ${mjNo} (${incNo}) · reason: ${reasonObj.label.replace(/^[^\s]+\s/,'')} · new SN ${_swapDoc.newSerial||'—'}`
  });

  // ─── 6. Create new SAFETY entry ───
  const newSafetyId = 'sf_' + Date.now();
  const newSafetyItem = {
    id: newSafetyId,
    boatId: it.boatId,
    category: it.category,
    name: it.name,
    brand: _swapDoc.source === 'buy' ? (_swapDoc.newBrand || it.brand) : it.brand,
    model: _swapDoc.source === 'buy' ? (_swapDoc.newModel || it.model) : it.model,
    serial: _swapDoc.newSerial || '',
    qty: it.qty || 1,
    installDate,
    expiryDate: it.expiryDate || null,
    nextPM,
    lastInspect: installDate,    // initial commissioning counts as first inspection
    status: 'active',
    location: it.location || '',
    note: it.note ? `${it.note} · replaces ${it.serial||'old item'}` : `Replaces ${it.serial||'old item'}`,
    log: [
      { date: installDate, type: 'install', desc: `+ ติดตั้งใหม่จาก ${mjNo} · replaces SN ${it.serial||'—'}${_swapDoc.installer?' · by '+_swapDoc.installer:''}` }
    ],
    inspections: [
      {
        id: 'insp_' + Date.now(),
        date: installDate,
        result: 'pass',
        note: 'Initial commissioning test · functional check ok',
        by: _swapDoc.installer || 'ระบบ'
      }
    ]
  };
  FL_SAFETY.push(newSafetyItem);

  // ─── 7. Persist + close + toast + refresh ───
  flSave();
  swapDocClose();
  // Tiny toast
  ctDocShowToast(`✓ Replace complete · ${incNo} + ${mjNo}${moNo?' + '+moNo:''} · Safety updated`);
  // Refresh safety detail to show the new item
  flSelSafetyId = newSafetyId;
  if(typeof flRenderSafetyList === 'function') flRenderSafetyList();
}

function swapDocRender(){
  if(!_swapDoc) return;
  const it = FL_SAFETY.find(x => x.id === _swapDoc.itemId);
  if(!it) return;
  const b  = getBoat(it.boatId);
  const cat = FL_SAFETY_CATEGORIES[it.category] || {label:it.category, color:'#9b9590'};

  // Header
  document.getElementById('swap-ttl').textContent = `Replace · ${it.name}`;
  document.getElementById('swap-sub').textContent =
    `${b ? b.name : '?'} · ${cat.label} · SN ${it.serial||'—'} · 3 step · ระบบจะสร้าง record ที่เกี่ยวข้องให้`;

  // Stepper bar
  const steps = [
    {n:1, label:'Reason'},
    {n:2, label:'New item'},
    {n:3, label:'Preview & confirm'}
  ];
  const stepperHtml = `<div style="display:flex;align-items:center;gap:0;font-family:Manrope,system-ui,sans-serif">
    ${steps.map((s, i) => {
      const active = _swapDoc.step >= s.n;
      const isCurrent = _swapDoc.step === s.n;
      const dot = `<div style="width:26px;height:26px;border-radius:50%;background:${active?'#A8773B':'#fff'};border:${active?'none':'1.5px solid #9b9590'};color:${active?'#fff':'#9b9590'};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${s.n}</div>`;
      const label = `<span style="font-size:12px;font-weight:${isCurrent?'700':'600'};color:${active?'#0F1419':'#9b9590'};margin:0 10px">${s.label}</span>`;
      const connector = i < steps.length - 1
        ? `<div style="flex:1;height:2px;background:${_swapDoc.step > s.n ? '#A8773B' : '#E0DED8'};min-width:30px"></div>`
        : '';
      return `${dot}${label}${connector}`;
    }).join('')}
  </div>`;
  document.getElementById('swap-stepper').innerHTML = stepperHtml;

  // Body — real forms per step
  const body = document.getElementById('swap-body');
  body.innerHTML = _swapDocRenderStep(it, b, cat);

  // Footer
  const footer = document.getElementById('swap-footer');
  footer.innerHTML = `
    <span style="font-size:11px;color:#9b9590;margin-right:auto">Step ${_swapDoc.step} / 3</span>
    ${_swapDoc.step > 1 ? `<button class="btn btn-ghost" onclick="swapDocSetStep(${_swapDoc.step-1})">← Back</button>` : ''}
    <button class="btn btn-ghost" onclick="swapDocClose()">Cancel</button>
    ${_swapDoc.step < 3
      ? `<button class="btn btn-primary" onclick="swapDocSetStep(${_swapDoc.step+1})" style="background:#1A2B43">Next →</button>`
      : `<button class="btn btn-primary" onclick="swapDocExecute()" style="background:#A8773B">✓ Confirm · Execute</button>`}
  `;
}

// ════════ Inspection module (Phase 3.2) ════════
let _flInspItemId=null, _flInspResult='pass', _flEditingInspId=null;

const INSP_RESULT_STYLE={
  pass:        {bg:'#E1F5EE', color:'#0F6E56', border:'#9FE1CB', label:'PASS',        icon:'🟢', countsAsCheck:true},
  needs_work:  {bg:'#FFF5EB', color:'#854F0B', border:'#F0C8B0', label:'NEEDS WORK',  icon:'🟡', countsAsCheck:true},
  fail:        {bg:'#FCEBEB', color:'#A32D2D', border:'#f0c8c5', label:'FAIL',        icon:'🔴', countsAsCheck:false},
  observation: {bg:'#F1EFE8', color:'#5F5E5A', border:'#D3D1C7', label:'OBSERVATION', icon:'⚪', countsAsCheck:false}
};

function flSetInspResult(r, el){
  _flInspResult = r;
  document.querySelectorAll('#fl-insp-result-row button').forEach(b=>{
    const isOn = b.dataset.r === r;
    const meta = INSP_RESULT_STYLE[b.dataset.r];
    b.style.background = isOn ? meta.bg : '#fff';
    b.style.borderColor = isOn ? meta.border : 'var(--border)';
    b.style.fontWeight = isOn ? '700' : '600';
  });
}

function flOpenLogInspectionModal(itemId, editInspId){
  const it = FL_SAFETY.find(x=>x.id===itemId);
  if(!it){ alert('Safety item not found'); return; }
  _flInspItemId = itemId;
  _flEditingInspId = editInspId || null;
  const editing = editInspId ? (it.inspections||[]).find(i=>i.id===editInspId) : null;
  const meta = FL_SAFETY_CATEGORIES[it.category] || {label:it.category, pmMonths:1, pmYears:1/12};
  const cadMonths = meta.pmMonths || Math.round((meta.pmYears||1)*12);
  // Title + sub
  document.getElementById('fl-insp-modal-title').textContent = editing ? 'Edit inspection' : 'Log Inspection';
  document.getElementById('fl-insp-modal-sub').textContent = editing ? 'Update inspection record' : 'Record an inspection check';
  // Banner
  const b = getBoat(it.boatId);
  document.getElementById('fl-insp-item-banner').innerHTML = `<strong>${it.name}</strong> · ${b?b.name:'?'}${it.location?' · '+it.location:''} · qty ${it.qty||1}`;
  // Fill fields
  const today = TODAY_STR;
  const inspDate = editing?.date || today;
  document.getElementById('fl-insp-date').value = inspDate;
  document.getElementById('fl-insp-inspector').value = editing?.inspector || '';
  document.getElementById('fl-insp-findings').value = editing?.findings || '';
  // Result: default 'pass' for new, or editing.result
  const initialResult = editing?.result || 'pass';
  _flInspResult = initialResult;
  setTimeout(()=>{
    const btn = document.querySelector(`#fl-insp-result-row button[data-r="${initialResult}"]`);
    if(btn) flSetInspResult(initialResult, btn);
  }, 30);
  // Next due: editing OR auto-calc from cadence (in months)
  let nextDue = editing?.nextDue;
  if(!nextDue){
    const d = new Date(inspDate); d.setMonth(d.getMonth() + cadMonths);
    nextDue = d.toISOString().slice(0,10);
  }
  document.getElementById('fl-insp-nextdue').value = nextDue;
  const cadLbl = cadMonths === 1 ? '1 month' : (cadMonths < 12 ? `${cadMonths} months` : (cadMonths === 12 ? '1 year' : `${(cadMonths/12).toFixed(1)} years`));
  document.getElementById('fl-insp-cadence-hint').textContent = `Cadence for "${meta.label}": every ${cadLbl}`;
  // Auto-recalc next due when inspection date changes (only for new entries)
  if(!editing){
    document.getElementById('fl-insp-date').onchange = function(){
      const d = new Date(this.value); d.setMonth(d.getMonth() + cadMonths);
      document.getElementById('fl-insp-nextdue').value = d.toISOString().slice(0,10);
    };
  }
  openModal('fl-modal-insp');
}

function flSaveInspection(){
  const itemId = _flInspItemId;
  if(!itemId){ closeModal('fl-modal-insp'); return; }
  const it = FL_SAFETY.find(x=>x.id===itemId);
  if(!it){ closeModal('fl-modal-insp'); return; }
  const date = document.getElementById('fl-insp-date').value;
  const inspector = document.getElementById('fl-insp-inspector').value.trim();
  const findings = document.getElementById('fl-insp-findings').value.trim();
  const nextDue = document.getElementById('fl-insp-nextdue').value;
  const result = _flInspResult || 'pass';
  if(!date){ alert('Please enter inspection date'); return; }
  const rmeta = INSP_RESULT_STYLE[result];

  if(!it.inspections) it.inspections = [];

  if(_flEditingInspId){
    // Edit existing
    const existing = it.inspections.find(i=>i.id===_flEditingInspId);
    if(existing){
      Object.assign(existing, {date, inspector, findings, nextDue, result});
    }
    _flEditingInspId = null;
  } else {
    // New entry
    const insp = {
      id: 'insp_'+Date.now(),
      date, inspector, result, findings, nextDue,
      createdAt: TODAY_STR
    };
    it.inspections.push(insp);
    // Log into item's main history log
    if(!it.log) it.log = [];
    it.log.push({date, type:'inspect', desc:`Inspection · ${rmeta.label}${inspector?' by '+inspector:''}${findings?' · '+findings.slice(0,60)+(findings.length>60?'…':''):''}`});
  }

  // Recompute lastInspect/nextPM from inspections (use latest counted check)
  const counted = (it.inspections||[]).filter(i=>INSP_RESULT_STYLE[i.result]?.countsAsCheck);
  if(counted.length){
    counted.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    it.lastInspect = counted[0].date;
    it.nextPM = counted[0].nextDue;
  }

  flSave();
  closeModal('fl-modal-insp');
  flRenderSafetyList();
}

function flDeleteInspection(itemId, inspId){
  const it = FL_SAFETY.find(x=>x.id===itemId);
  if(!it || !it.inspections) return;
  const insp = it.inspections.find(i=>i.id===inspId);
  if(!insp) return;
  if(!confirm(`Delete this inspection record (${insp.date} · ${INSP_RESULT_STYLE[insp.result]?.label || insp.result})?`)) return;
  it.inspections = it.inspections.filter(i=>i.id!==inspId);
  // Recompute lastInspect/nextPM
  const counted = it.inspections.filter(i=>INSP_RESULT_STYLE[i.result]?.countsAsCheck);
  if(counted.length){
    counted.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    it.lastInspect = counted[0].date;
    it.nextPM = counted[0].nextDue;
  } else {
    it.lastInspect = null;
    it.nextPM = null;
  }
  flSave();
  flRenderSafetyList();
}

let _flEditingSafetyId=null;
function flOpenAddSafetyModal(id){
  _flEditingSafetyId = id || null;
  const editing = id ? FL_SAFETY.find(x=>x.id===id) : null;
  // Title
  const titleEl=document.getElementById('fl-safety-modal-title');
  if(titleEl) titleEl.textContent = editing ? `Edit Safety Item · ${editing.name||''}` : 'Add Safety Item';
  // Boat dropdown
  const boatSel=document.getElementById('fl-sf-boat');
  boatSel.innerHTML='<option value="">— Select boat —</option>'+
    BOATS.filter(b=>!b.retired && b.ownership!=='charter')
      .map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
  // Category dropdown
  const catSel=document.getElementById('fl-sf-category');
  catSel.innerHTML='<option value="">— Select category —</option>'+
    Object.entries(FL_SAFETY_CATEGORIES)
      .map(([k,v])=>`<option value="${k}">${v.label}${v.regulatory?' · required':''}</option>`).join('');
  // Fill values
  if(editing){
    boatSel.value=editing.boatId||'';
    catSel.value=editing.category||'';
    document.getElementById('fl-sf-name').value=editing.name||'';
    document.getElementById('fl-sf-brand').value=editing.brand||'';
    document.getElementById('fl-sf-model').value=editing.model||'';
    document.getElementById('fl-sf-serial').value=editing.serial||'';
    document.getElementById('fl-sf-qty').value=editing.qty||1;
    document.getElementById('fl-sf-install').value=editing.installDate||'';
    document.getElementById('fl-sf-expiry').value=editing.expiryDate||'';
    document.getElementById('fl-sf-lastinspect').value=editing.lastInspect||'';
    document.getElementById('fl-sf-nextpm').value=editing.nextPM||'';
    document.getElementById('fl-sf-status').value=editing.status||'active';
    document.getElementById('fl-sf-location').value=editing.location||'';
    document.getElementById('fl-sf-note').value=editing.note||'';
  } else {
    // Defaults for new entry — pre-fill from matrix selection context if available
    boatSel.value = _flSafetySelBoat || '';
    catSel.value  = _flSafetySelCat || '';
    document.getElementById('fl-sf-name').value='';
    document.getElementById('fl-sf-brand').value='';
    document.getElementById('fl-sf-model').value='';
    document.getElementById('fl-sf-serial').value='';
    document.getElementById('fl-sf-qty').value=1;
    document.getElementById('fl-sf-install').value=TODAY_STR;
    document.getElementById('fl-sf-expiry').value='';
    document.getElementById('fl-sf-lastinspect').value=TODAY_STR;
    document.getElementById('fl-sf-nextpm').value='';
    document.getElementById('fl-sf-status').value='active';
    document.getElementById('fl-sf-location').value='';
    document.getElementById('fl-sf-note').value='';
  }
  openModal('fl-modal-safety');
  setTimeout(()=>document.getElementById('fl-sf-name').focus(), 50);
}

function flSaveSafety(){
  const boatId=document.getElementById('fl-sf-boat').value;
  const category=document.getElementById('fl-sf-category').value;
  const name=document.getElementById('fl-sf-name').value.trim();
  if(!boatId){ alert('Please select a boat'); return; }
  if(!category){ alert('Please select a category'); return; }
  if(!name){ alert('Please enter a name'); return; }
  const fields = {
    boatId, category, name,
    brand: document.getElementById('fl-sf-brand').value.trim(),
    model: document.getElementById('fl-sf-model').value.trim(),
    serial: document.getElementById('fl-sf-serial').value.trim(),
    qty: parseInt(document.getElementById('fl-sf-qty').value)||1,
    installDate: document.getElementById('fl-sf-install').value || '',
    expiryDate: document.getElementById('fl-sf-expiry').value || null,
    lastInspect: document.getElementById('fl-sf-lastinspect').value || '',
    nextPM: document.getElementById('fl-sf-nextpm').value || '',
    status: document.getElementById('fl-sf-status').value || 'active',
    location: document.getElementById('fl-sf-location').value.trim(),
    note: document.getElementById('fl-sf-note').value.trim()
  };
  if(_flEditingSafetyId){
    const existing=FL_SAFETY.find(x=>x.id===_flEditingSafetyId);
    if(existing){
      // Compute diff for log
      const changes=[];
      Object.keys(fields).forEach(k=>{ if(String(existing[k]||'')!==String(fields[k]||'')) changes.push(k); });
      Object.assign(existing, fields);
      if(!existing.log) existing.log=[];
      existing.log.push({date:TODAY_STR, type:'edit', desc:`Edited fields: ${changes.join(', ')||'(no change)'}`});
    }
    _flEditingSafetyId=null;
  } else {
    // Create new — generate id
    const _maxNum = FL_SAFETY.reduce((m,x)=>{const n=parseInt(String(x.id||'').replace(/^sf/,''))||0; return n>m?n:m;}, 0);
    const id = 'sf'+String(_maxNum+1).padStart(4,'0');
    const newItem = {id, ...fields, log:[{date:TODAY_STR, type:'add', desc:'Added via Safety tab'}]};
    FL_SAFETY.push(newItem);
    flSelSafetyId = id;
  }
  flSave();
  closeModal('fl-modal-safety');
  flRenderSafetyList();
}

function flRenderDocsList(){
  const wrap=document.getElementById('fl-docs-pink-wrap');
  if(!wrap)return;
  const dim={bg:'#F4F2EE',ink:'#1A1A1A',ink2:'#666',ink3:'#999',ink4:'#bbb',ink5:'#ccc',line:'rgba(0,0,0,.04)'};
  const SVG_PINK={accent:'#E03B7E',soft:'#FCE5EC',text:'#9F1B4F'};

  const MONTHS=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const fmtD=s=>{if(!s)return'—';const d=new Date(s);return`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()+543}`;};
  const fmtShort=s=>{if(!s)return'—';const d=new Date(s);return`${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()+543).slice(2)}`;};

  // Filter to company boats (charter has no docs typically)
  const companyBoats=BOATS.filter(b=>b.ownership!=='charter'&&!b.retired);

  // Build boat → typeId → entry map
  const boatDocMap={};
  companyBoats.forEach(b=>{
    boatDocMap[b.id]={};
    (b.docs||[]).forEach(doc=>{
      const typeId=flGuessDocType(doc.name)||'other_'+doc.name;
      const existing=boatDocMap[b.id][typeId];
      if(flDocBetter(existing,doc)){   // §pjDocSrc · กติกาเดียวกับใบงานเรือ
        boatDocMap[b.id][typeId]={exp:doc.exp,renewStatus:doc.renewStatus,status:flDocStatus(doc),name:doc.name};
      }
    });
  });

  // Stats
  let cntOk=0,cntWarn90=0,cntWarn30=0,cntExp=0,cntProc=0,cntNa=0;
  let totalDocs=0;
  const groupIssues={};
  FL_DOC_TYPES.forEach(t=>{groupIssues[t.group]={ok:0,issues:0};});
  const expBoats=new Set();
  companyBoats.forEach(b=>{
    FL_DOC_TYPES.forEach(t=>{
      const entry=boatDocMap[b.id]?.[t.id];
      if(entry){
        totalDocs++;
        if(entry.status==='ok'){cntOk++;groupIssues[t.group].ok++;}
        else if(entry.status==='warn90')cntWarn90++;
        else if(entry.status==='warn30'){cntWarn30++;groupIssues[t.group].issues++;}
        else if(entry.status==='exp'){cntExp++;expBoats.add(b.id);groupIssues[t.group].issues++;}
        else if(entry.status==='processing'||entry.status==='renewed')cntProc++;
      } else cntNa++;
    });
  });
  const validPct=totalDocs?Math.round((cntOk+cntWarn90)/totalDocs*100):100;

  // Group counts for header pills
  const groupCounts={};
  FL_DOC_TYPES.forEach(t=>{
    if(!groupCounts[t.group])groupCounts[t.group]=0;
  });
  companyBoats.forEach(b=>{
    FL_DOC_TYPES.forEach(t=>{
      if(boatDocMap[b.id]?.[t.id])groupCounts[t.group]++;
    });
  });

  // Update tab badge
  const tabBtn=document.getElementById('fl-tab-docs-btn');
  const alertCount=cntExp+cntWarn30;
  if(tabBtn) tabBtn.innerHTML=`Documents${alertCount>0?` <span style="background:#A32D2D;color:#fff;font-size:9px;padding:1px 5px;border-radius:10px;font-weight:600">${alertCount}</span>`:''}`;

  // Header bar
  const groupColors={'เจ้าท่า':'#0F6E56','ประกันภัย':'#185FA5','เข้าพื้นที่':'#534AB7'};
  const groupAbbr={'เจ้าท่า':'DT','ประกันภัย':'IN','เข้าพื้นที่':'PK'};
  const groupLabel={'เจ้าท่า':'เจ้าท่า','ประกันภัย':'ประกัน','เข้าพื้นที่':'อุทยาน'};
  const groupPills=Object.keys(groupCounts).map(g=>{
    const c=groupColors[g]||'#666';
    return`<div style="display:flex;align-items:center;gap:6px;background:white;border:1px solid ${dim.line};border-radius:20px;padding:3px 12px 3px 3px"><div style="width:24px;height:24px;border-radius:50%;background:${c};color:white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${groupAbbr[g]||g.slice(0,2).toUpperCase()}</div><span style="font-size:12px;font-weight:500">${groupLabel[g]||g} · ${groupCounts[g]||0}</span></div>`;
  }).join('');

  const headerBar=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:6px">
      ${groupPills}
      <div style="width:32px;height:32px;border-radius:50%;background:${dim.ink};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">D</div>
    </div>
  </div>`;

  // KPI strip
  const groupBreakdownHtml=Object.keys(groupCounts).map(g=>{
    const issues=groupIssues[g]?.issues||0;
    return`<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;color:#aaa">${groupLabel[g]||g}</span><span style="font-size:11px;font-weight:600;color:${issues>0?'#FF8FA8':'white'}">${issues>0?issues+' issues':'all valid'}</span></div>`;
  }).join('');

  const kpiStrip=`<div style="display:grid;grid-template-columns:1.6fr 0.85fr 0.85fr 0.85fr 1fr;gap:8px;margin-bottom:14px;align-items:stretch">
    <div style="grid-column:1;align-self:end;padding-bottom:6px">
      <div style="font-size:13px;font-weight:500;color:${dim.ink4};margin-bottom:2px">Documents Compliance</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:42px;font-weight:700;letter-spacing:-1.5px;line-height:1">${validPct}%</span>
        <span style="font-size:18px;color:${dim.ink3};font-weight:500">valid</span>
        <span style="display:inline-flex;align-items:center;background:#1D9E75;color:white;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600">▴ ${cntOk+cntWarn90} ok</span>
        ${cntExp?`<span style="display:inline-flex;align-items:center;background:${SVG_PINK.soft};color:${SVG_PINK.text};padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600">${cntExp} expired</span>`:''}
      </div>
      <div style="font-size:11px;color:${dim.ink3}">${totalDocs} documents across ${companyBoats.length} boats · ${FL_DOC_TYPES.length} doc types</div>
    </div>

    <div style="grid-column:2;background:white;border-radius:14px;padding:11px 13px;border:2px solid ${cntExp?'#A32D2D':dim.line}">
      <div style="font-size:10px;color:${dim.ink3}">Expired</div>
      <div style="display:flex;align-items:baseline;gap:4px;margin-top:2px"><span style="background:#A32D2D;color:white;padding:2px 9px;border-radius:14px;font-size:14px;font-weight:700">${cntExp}</span><span style="font-size:11px;color:${dim.ink3};margin-left:2px">docs</span></div>
      <div style="font-size:11px;color:#A32D2D;margin-top:7px;font-weight:600">${expBoats.size} boats affected</div>
    </div>

    <div style="grid-column:3;background:white;border-radius:14px;padding:11px 13px;border:2px solid ${cntWarn30?'#BA7517':dim.line}">
      <div style="font-size:10px;color:${dim.ink3}">&lt;30 days</div>
      <div style="display:flex;align-items:baseline;gap:4px;margin-top:2px"><span style="background:#BA7517;color:white;padding:2px 9px;border-radius:14px;font-size:14px;font-weight:700">${cntWarn30}</span><span style="font-size:11px;color:${dim.ink3};margin-left:2px">docs</span></div>
      <div style="font-size:11px;color:#854F0B;margin-top:7px;font-weight:600">renew this month</div>
    </div>

    <div style="grid-column:4;background:white;border-radius:14px;padding:11px 13px;border:1px solid ${dim.line}">
      <div style="font-size:10px;color:${dim.ink3}">Processing</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin-top:2px"><span style="font-size:18px;font-weight:700;line-height:1.2;color:#185FA5">${cntProc}</span><span style="font-size:11px;color:${dim.ink3};font-weight:500">in progress</span></div>
      <div style="font-size:11px;color:#185FA5;margin-top:6px;font-weight:600">↻ being renewed</div>
    </div>

    <div style="grid-column:5;background:${dim.ink};color:white;border-radius:14px;padding:11px 13px">
      <div style="font-size:10px;color:#aaa">By group</div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">${groupBreakdownHtml}</div>
    </div>
  </div>`;

  // Filter bar
  const fBtn=(val,label,color)=>{
    const isOn=flDocFilter===val;
    return`<button onclick="flSetDocFilter('${val}',null)" style="background:${isOn?dim.ink:'transparent'};color:${isOn?'white':(color||dim.ink2)};border:none;border-radius:14px;padding:5px 12px;font-size:11px;font-weight:${isOn?600:500};cursor:pointer">${label}</button>`;
  };
  const filterBar=`<div style="display:flex;gap:6px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
    <span style="font-size:11px;color:${dim.ink3};margin-right:6px;font-weight:500">filter</span>
    <div style="background:white;border:1px solid ${dim.line};border-radius:24px;padding:2px;display:flex;flex-wrap:wrap">
      ${fBtn('all','All')}
      ${fBtn('expired','Expired','#A32D2D')}
      ${fBtn('warn30','<30 days','#854F0B')}
      ${fBtn('warn90','30–90 days','#666')}
      ${fBtn('renewed','↻ Processing','#185FA5')}
      ${fBtn('ok','Valid','#0F6E56')}
    </div>
    <div style="margin-left:auto;display:flex;align-items:center;gap:14px;font-size:10px;color:${dim.ink2};flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#E1F5EE;border:1px solid #0F6E56"></span>Valid</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#FAEEDA;border:1px solid #BA7517"></span>&lt;90 days</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#FCEBEB;border:1px solid #A32D2D"></span>Expired</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:#E6F1FB;border:1px solid #185FA5"></span>↻ Renewing</span>
    </div>
  </div>`;

  // Filter boats
  const filteredBoats=flDocFilter==='all'?companyBoats:companyBoats.filter(b=>{
    return (b.docs||[]).some(doc=>{
      const st=flDocStatus(doc);
      if(flDocFilter==='ok')return st==='ok';
      if(flDocFilter==='expired')return st==='exp';
      if(flDocFilter==='renewed')return st==='processing'||st==='renewed';
      return st===flDocFilter;
    });
  });

  // Build matrix table
  const groups=[...new Set(FL_DOC_TYPES.map(t=>t.group))];
  const groupBgColors={'เจ้าท่า':'#E1F5EE','ประกันภัย':'#E6F1FB','เข้าพื้นที่':'#EEEAFC'};

  // boat avatar
  const palette=['#185FA5','#534AB7','#1D9E75','#BA7517','#A32D2D','#0F6E56','#7F77DD','#D85A30','#993556'];
  const boatColor=(b,i)=>palette[i%palette.length];
  const boatInit=(name)=>{
    const w=name.split(/\s+/);
    if(w.length>=2)return (w[0][0]+w[1][0]).toUpperCase();
    if(name.length>=2&&/\d/.test(name))return (name.match(/[A-Z]/g)?.[0]||name[0])+name.slice(-1);
    return name.slice(0,2).toUpperCase();
  };

  let tableHtml=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:separate;border-spacing:0;font-size:10px">`;
  // Group header row
  tableHtml+=`<thead><tr style="background:#FBFAF7"><th rowspan="2" style="padding:8px 12px;text-align:left;font-weight:600;color:${dim.ink2};text-transform:uppercase;letter-spacing:.05em;font-size:10px;border-bottom:1px solid rgba(0,0,0,.06);position:sticky;left:0;background:#FBFAF7;z-index:2;border-right:1px solid rgba(0,0,0,.06);min-width:140px">Boat</th>`;
  groups.forEach((g,gi)=>{
    const cols=FL_DOC_TYPES.filter(t=>t.group===g);
    const c=groupColors[g]||'#666';
    const bg=groupBgColors[g]||'#FBFAF7';
    tableHtml+=`<th colspan="${cols.length}" style="padding:6px 8px;text-align:center;font-weight:600;color:${c};background:${bg};text-transform:uppercase;letter-spacing:.05em;font-size:10px;${gi>0?'border-left:2px solid white':''}">${groupLabel[g]||g}</th>`;
  });
  tableHtml+=`</tr><tr style="background:#FBFAF7">`;
  // Doc type header row
  FL_DOC_TYPES.forEach((t,i)=>{
    const isFirstInGroup=i===0||FL_DOC_TYPES[i-1].group!==t.group;
    tableHtml+=`<th style="padding:6px 8px;text-align:center;font-weight:500;color:${dim.ink2};border-bottom:1px solid rgba(0,0,0,.06);min-width:78px;${isFirstInGroup&&i>0?'border-left:2px solid white':''}">${t.label.replace('\n','<br>')}</th>`;
  });
  tableHtml+=`</tr></thead><tbody>`;

  // Rows
  if(filteredBoats.length===0){
    tableHtml+=`<tr><td colspan="${1+FL_DOC_TYPES.length}" style="padding:30px;text-align:center;color:${dim.ink3};font-size:11px">No boats match filter</td></tr>`;
  } else {
    filteredBoats.forEach((b,bi)=>{
      const stCur=getCurStatus(b,TODAY_STR);
      const dotColor=stCur.s==='available'?'#1D9E75':stCur.s==='fixing'?'#BA7517':'#A32D2D';
      const rowBg=stCur.s==='fixing'?'background:rgba(186,117,23,.04)':stCur.s==='unavailable'?'background:rgba(163,45,45,.04)':'';
      const stickyBg=stCur.s==='fixing'?'rgba(186,117,23,.04)':stCur.s==='unavailable'?'rgba(163,45,45,.04)':'white';
      const ac=boatColor(b,bi);
      const init=boatInit(b.name);
      const PIER_LBL={tublamu:'Tub Lamu',panwa:'Visit Panwa',ranong:'Ranong'};
      tableHtml+=`<tr style="${rowBg}"><td style="padding:8px 12px;border-left:3px solid ${dotColor};border-bottom:0.5px solid rgba(0,0,0,.04);position:sticky;left:0;background:${stickyBg};z-index:1;border-right:1px solid rgba(0,0,0,.06)">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:24px;height:24px;border-radius:50%;background:${ac};color:white;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700">${init}</div>
          <div><div style="font-size:11px;font-weight:600">${b.name}</div><div style="font-size:9px;color:${dim.ink3}">${PIER_LBL[b.pier]||b.pier||''}</div></div>
        </div>
      </td>`;
      FL_DOC_TYPES.forEach((t,i)=>{
        const isFirstInGroup=i===0||FL_DOC_TYPES[i-1].group!==t.group;
        const sepStyle=isFirstInGroup&&i>0?'border-left:2px solid #FBFAF7;':'';
        const entry=boatDocMap[b.id]?.[t.id];
        if(entry){
          const st=entry.status;
          const isProc=st==='processing'||st==='renewed';
          let chipBg,chipColor;
          if(isProc){chipBg='#E6F1FB';chipColor='#185FA5';}
          else if(st==='ok'){chipBg='#E1F5EE';chipColor='#0F6E56';}
          else if(st==='warn90'){chipBg='#FAEEDA';chipColor='#854F0B';}
          else if(st==='warn30'){chipBg='#FAEEDA';chipColor='#854F0B';}
          else if(st==='exp'){chipBg='#FCEBEB';chipColor='#A32D2D';}
          else {chipBg='#F4F2EE';chipColor='#999';}
          let chipHtml;
          if(isProc){
            const expTxt=entry.exp?fmtShort(entry.exp):'—';
            chipHtml=`<span style="background:${chipBg};color:${chipColor};padding:3px 6px;border-radius:6px;font-size:9px;font-weight:600;cursor:pointer;display:inline-flex;flex-direction:column;align-items:center;line-height:1.3" onclick="depOpen('${b.id}','${entry.name.replace(/'/g,'\\\'')}','${st}','${entry.exp||''}',this,event)">
              <span>↻ Renew</span>
              <span style="font-size:8px;font-family:'DM Mono',monospace;color:#A32D2D">${expTxt}</span>
            </span>`;
          } else {
            const mainTxt=st==='na'?'—':fmtShort(entry.exp);
            chipHtml=`<span style="background:${chipBg};color:${chipColor};padding:3px 7px;border-radius:6px;font-family:'DM Mono',monospace;font-weight:600;font-size:10px;cursor:pointer;display:inline-block" onclick="depOpen('${b.id}','${entry.name.replace(/'/g,'\\\'')}','${st}','${entry.exp||''}',this,event)">${mainTxt}</span>`;
          }
          tableHtml+=`<td style="padding:5px 8px;text-align:center;border-bottom:0.5px solid rgba(0,0,0,.04);${sepStyle}">${chipHtml}</td>`;
        } else {
          const docNameMap={'lic':'ใบอนุญาตใช้เรือ','inspect':'ใบสำคัญรับรองการตรวจเรือ','ins':'ประกันภัยเรือ','similan':'ใบอนุญาต สิมิลัน','surin':'ใบอนุญาต สุรินทร์','pp':'ใบอนุญาต พีพี','phangnga':'ใบอนุญาต อ่าวพังงา','tarn':'ใบอนุญาต ธารโบกขรณี'};
          const docName=docNameMap[t.id]||t.label.replace('\n',' ');
          tableHtml+=`<td style="padding:5px 8px;text-align:center;border-bottom:0.5px solid rgba(0,0,0,.04);${sepStyle}"><span style="background:#F4F2EE;color:#999;padding:3px 7px;border-radius:6px;font-family:'DM Mono',monospace;font-weight:500;font-size:10px;cursor:pointer;display:inline-block" title="No document — click to add" onclick="depOpen('${b.id}','${docName}','na','',this,event)">—</span></td>`;
        }
      });
      tableHtml+=`</tr>`;
    });
  }
  tableHtml+=`</tbody></table></div>`;

  const matrixPanel=`<div style="background:white;border-radius:14px;border:1px solid ${dim.line};overflow:hidden">${tableHtml}</div>`;

  wrap.innerHTML=`${headerBar}${kpiStrip}${filterBar}${matrixPanel}`;
}

function flUnassignEng(engId, boatId){
  if(!confirm('ถอดเครื่องยนต์นี้ออกจากเรือ?')) return;
  const eng=flGetEng(engId);if(!eng)return;
  eng.boatId=null;
  eng.pos='';
  eng.status='spare';
  eng.spareLocation='คลังกลาง';
  flSave();
  flSelBoat(boatId);
}
