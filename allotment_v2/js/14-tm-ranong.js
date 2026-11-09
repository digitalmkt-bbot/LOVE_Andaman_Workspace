/* ══ §tmDoc (2026-11-04) · Pier Office › Ranong › เอกสาร ตม. ═══════════════════════════════════
   owner: "แต่ละลำต้องออกเอกสารหน้าตาแบบนี้" (ไฟล์ ชุดเอกสาร ตม. TRI-STAR.xlsx) · "ข้อมูลเรือและลูกเรือ แยกไปใน Pier Office ของ Ranong"
   ส่วน 1 · ข้อมูลเรือ (ชื่อบนเอกสาร · สัญชาติ · ทะเบียน · ระวาง · ผู้ควบคุม · ลูกเรือ · ท่า · ตัวแทน) ลำละชุด · กรอกครั้งเดียว
          เก็บเป็น JSON string ใน laBlob().tm_boats → ขึ้นเซิร์ฟเวอร์ทาง app_meta (smerge) เหมือน rc_status_colors · ไม่ต้องแก้ schema
   ส่วน 2 · ออกเอกสารรายวัน · ทุกลำที่วิ่งเส้นทางท่าระนองวันนั้น · ดาวน์โหลด Excel ต่อลำ
          ใช้ไฟล์ต้นฉบับของทีมเป็นแม่แบบ (assets/tm_ranong_template.xlsx) · ExcelJS โหลดจาก cdnjs ตอนกดครั้งแรก · สไตล์/ผสานช่อง/สูตรคงเดิม
          ระบบเติมแค่ข้อมูล · รายชื่อผู้โดยสารจาก §tmPax (By trip / Insurance) · แผ่นเพิ่ม "ข้อมูลประกอบ" ท้ายชุด (ชื่อไทย · เลขหลังบัตร · วันเกิด · Remark) */
var _tmDate=(typeof bkV2LocalYMD==='function')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
var _tmPier='ranong', _tmOpen={};
var TM_DEF={ nat:'พม่า', natEn:'Myanmar', reg:'Myanmar', port:'ท่าเทียบเรือแกรนด์อันดามัน - เกาะสอง', embark:'ท่าเรือแกรนด์อันดามัน', dest:'เกาะสอง - พม่า',
             agent:'บริษัท เลิฟ ไอแลนด์ จำกัด', writeAt:'ท่าเรือแกรนด์อันดามัน', from:'เกาะสอง-พม่า', position:'ท่าเรือแกรนด์อันดามัน' };
function tmE(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function tmBoatsRead(){ var v; try{ v=laBlob().tm_boats; }catch(_){ return {}; } if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(_){ v=null; } } return (v&&typeof v==='object')?v:{}; }
function tmBoatsWrite(m){ try{ var d=laBlob(); d.tm_boats=JSON.stringify(m||{}); laBlobSave(); }catch(e){ console.warn('[tmDoc] save failed', e); } }
function tmBoatRec(bid){ var m=tmBoatsRead(), b=(typeof getBoat==='function')?getBoat(bid):null;
  var r=Object.assign({ name:(b&&b.name)||bid, nat:TM_DEF.nat, reg:TM_DEF.reg, master:'', gross:'', net:'', port:TM_DEF.port, position:TM_DEF.position, agent:TM_DEF.agent, embark:TM_DEF.embark, dest:TM_DEF.dest, crew:[] }, m[bid]||{});
  if(!Array.isArray(r.crew)) r.crew=[]; return r; }
/* §tmTwoCol · ลำที่เลือกทางขวา + โหมด base (ชุดประจำ) | day (เฉพาะวันที่ _tmDate) */
var _tmSel='', _tmMode='base';
function tmDayGet(bid, ds){ var r=tmBoatRec(bid), D=(r.day&&typeof r.day==='object')?r.day:{}; var x=D[ds]; return (x&&typeof x==='object')?Object.assign({master:'',crew:[]},x,{crew:Array.isArray(x.crew)?x.crew:[]}):null; }
/* ชุดที่ใช้ออกเอกสารวันนั้น · มีชุดเฉพาะวันใช้ชุดนั้น ไม่มีใช้ชุดประจำ */
function tmCrewOf(bid, ds){ var r=tmBoatRec(bid), d=ds?tmDayGet(bid,ds):null; return d?{master:d.master, crew:d.crew, day:true}:{master:r.master, crew:r.crew, day:false}; }
function tmWho(){ return (typeof laBy==='function')?laBy():''; }
/* แก้ชุดที่กำลังเปิดอยู่ · fn(T) แก้ {master, crew} ของชุดนั้น */
function tmEdit(bid, fn){
  var m=tmBoatsRead(), r=Object.assign({}, tmBoatRec(bid)); r.crew=r.crew.slice();
  if(_tmMode==='day'){
    var D=Object.assign({}, (r.day&&typeof r.day==='object')?r.day:{}), cur=D[_tmDate];
    var T=cur?Object.assign({}, cur):{master:r.master, crew:r.crew.map(function(c){ return Object.assign({}, c); })};
    T.crew=(Array.isArray(T.crew)?T.crew:[]).slice(); fn(T); T.by=tmWho(); T.at=new Date().toISOString(); D[_tmDate]=T;
    /* เก็บแค่ 120 วันย้อนหลัง · ของเก่ากว่านั้นไม่มีใครออกเอกสารซ้ำแล้ว */
    var cut=new Date(Date.now()-120*864e5).toISOString().slice(0,10); Object.keys(D).forEach(function(k){ if(k<cut) delete D[k]; });
    r.day=D;
  } else { fn(r); r.by=tmWho(); r.at=new Date().toISOString(); }
  m[bid]=r; tmBoatsWrite(m);
}
function tmPick(bid, mode){ _tmSel=bid; if(mode) _tmMode=mode; renderPierTm(); }
function tmDayStart(bid){ _tmSel=bid; _tmMode='day'; tmEdit(bid, function(){}); renderPierTm(); }
function tmDayClear(bid){ if(!confirm('ยกเลิกลูกเรือเฉพาะวันนี้ แล้วกลับไปใช้ชุดประจำ?')) return;
  var m=tmBoatsRead(), r=Object.assign({}, tmBoatRec(bid)), D=Object.assign({}, r.day||{}); delete D[_tmDate]; r.day=D; m[bid]=r; tmBoatsWrite(m); renderPierTm(); }
/* จากข้อ 1 · กดป้ายลูกเรือของลำ → เปิดลำนั้นทางขวาในแท็บเฉพาะวัน */
function tmGoDay(bid){ _tmSel=bid; _tmMode='day'; renderPierTm(); setTimeout(function(){ var el=document.querySelector('.tm-2c'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }, 30); }
function tmBoatSet(bid, f, v){ v=String(v||'').trim();
  if(f==='master'){ tmEdit(bid, function(T){ T.master=v; }); return; }
  var m=tmBoatsRead(); var r=Object.assign({}, tmBoatRec(bid)); r[f]=v; r.by=tmWho(); r.at=new Date().toISOString(); m[bid]=r; tmBoatsWrite(m); }
function tmCrewSet(bid, i, f, v){ tmEdit(bid, function(T){ T.crew[i]=Object.assign({}, T.crew[i]||{}); T.crew[i][f]=String(v||'').trim(); }); }
function tmCrewAdd(bid){ tmEdit(bid, function(T){ T.crew=T.crew.concat([{name:'', rank:T.crew.length?'Crew':'Captain', nat:TM_DEF.natEn, doc:''}]); }); renderPierTm(); }
function tmCrewDel(bid, i){ if(!confirm('Remove this crew member?')) return; tmEdit(bid, function(T){ T.crew=T.crew.filter(function(_,k){ return k!==i; }); }); renderPierTm(); }
function tmSetDate(ds){ if(!ds) return; _tmDate=ds; renderPierTm(); }
function tmShiftDate(n){ var d=new Date(_tmDate+'T12:00:00'); d.setDate(d.getDate()+n); tmSetDate(d.toISOString().slice(0,10)); }
/* ใบจองของท่าระนองในวันนั้น · แยกตามลำ */
function tmDayBoats(ds){
  var by={}, order=[];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(!b || ['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    (b.trips||[]).forEach(function(t){
      if(!t || t.date!==ds || !tmIsRanongRoute(t.routeId)) return;
      var O=(typeof bkOpsRead==='function')?bkOpsRead(b,ds):(b.ops||{});
      var bid=O.boatId||t.charterBoatId||'';
      var k=bid||'__none';
      if(!by[k]){ by[k]={bid:bid, routeId:t.routeId, bks:[], pax:0, ok:0, n:0}; order.push(k); }
      by[k].bks.push(b);
      var st=tmBkStatus(b); by[k].n+=st.n; by[k].ok+=st.ok;
      by[k].pax+=(typeof bkV2PaxAllTot==='function')?bkV2PaxAllTot(t.pax||{}):0;
    });
  });
  return order.map(function(k){ return by[k]; });
}
/* ลำที่ควรมีข้อมูล ตม. · เรือในกองที่ท่าระนอง + ลำที่เคยจัดบนเส้นทางระนอง ±45 วัน + ลำที่เคยกรอกไว้ */
function tmBoatList(){
  var ids={}, out=[];
  (typeof BOATS!=='undefined'?BOATS:[]).forEach(function(b){ if(b && (b.pier==='ranong' || b.homePier==='ranong')) ids[b.id]=1; });
  var t0=new Date();
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){ (b&&b.trips||[]).forEach(function(t){
    if(!t||!t.date||!tmIsRanongRoute(t.routeId)) return;
    var dd=Math.abs((new Date(t.date+'T12:00:00')-t0)/864e5); if(dd>45) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,t.date):(b.ops||{}); var bid=O.boatId||t.charterBoatId; if(bid) ids[bid]=1; }); });
  Object.keys(tmBoatsRead()).forEach(function(k){ ids[k]=1; });
  Object.keys(ids).forEach(function(id){ out.push({ id:id, boat:(typeof getBoat==='function')?getBoat(id):null }); });
  out.sort(function(a,b){ return String((a.boat&&a.boat.name)||a.id).localeCompare(String((b.boat&&b.boat.name)||b.id)); });
  return out;
}
function renderPierTm(pier){
  if(pier) _tmPier=pier;
  var host=document.getElementById('pt-host-'+_tmPier); if(!host) return;
  var e=tmE, ro=(typeof poCanEdit==='function')?!poCanEdit():false;
  var inp=function(bid,f,v,ph,w){ return '<label style="display:flex;flex-direction:column;gap:3px;font-size:10.5px;font-weight:700;color:#5B6472;'+(w?('width:'+w+'px'):'flex:1 1 160px')+';min-width:0">'+e(ph)
    +'<input value="'+e(v)+'"'+(ro?' disabled':'')+' onchange="tmBoatSet(\''+e(bid)+'\',\''+f+'\',this.value)" style="border:1px solid #D9DDE4;border-radius:7px;padding:6px 8px;font-family:inherit;font-size:12.5px;font-weight:500;color:#14233F;min-width:0"></label>'; };
  /* §tmTwoCol (2026-11-04) · owner: "ข้อ 2 ขอทำเป็น 2 คอลัมน์ คลิกแล้วรายละเอียดขึ้นขวา · บางวันข้อมูลคนเรือเปลี่ยน จะแก้ยังไง"
     ซ้าย = รายชื่อลำ · ขวา = รายละเอียดของลำที่เลือก · แท็บ "ชุดประจำ" | "เฉพาะวันที่ …" (วันที่เดียวกับข้อ 1)
     ชุดเฉพาะวัน = ผู้ควบคุมเรือ + ลูกเรือของวันนั้นวันเดียว (tm_boats[ลำ].day[วันที่]) · เอกสารวันนั้นใช้ชุดนี้ วันอื่นยังใช้ชุดประจำ */
  var dLbl=(function(){ try{ return new Date(_tmDate+'T12:00:00').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }catch(_){ return _tmDate; } })();
  var L=tmBoatList();
  if(L.length && !L.some(function(x){ return x.id===_tmSel; })) _tmSel=L[0].id;
  var dShort=(function(){ try{ return new Date(_tmDate+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'}); }catch(_){ return _tmDate; } })();
  var crewGrid='display:grid;grid-template-columns:28px minmax(0,1.4fr) 110px 110px minmax(0,1fr) 28px;gap:6px;align-items:center';
  var listHtml=L.map(function(x){
    var r=tmBoatRec(x.id), nm=(x.boat&&x.boat.name)||x.id, on=x.id===_tmSel, dy=tmDayGet(x.id,_tmDate);
    var done=!!(r.master && r.crew.length && r.crew.every(function(c){ return c.name; }));
    return '<button type="button" onclick="tmPick(\''+e(x.id)+'\')" style="width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px 12px;border:0;border-left:3px solid '+(on?'#1B2A55':'transparent')+';border-bottom:1px solid #EEECE6;background:'+(on?'#EEF1F8':'#fff')+';font-family:inherit;text-align:left;cursor:pointer">'
      +'<b style="font-size:13px;color:#14233F">'+e(nm)+'</b>'
      +'<span style="display:flex;gap:5px;flex-wrap:wrap">'
        +'<span style="font-size:10.5px;font-weight:700;border-radius:20px;padding:1px 8px;'+(done?'background:#E6F6F2;color:#0F766E':'background:#FEF6E7;color:#7A4A00')+'">'+(done?('ครบ · '+r.crew.length+' คน'):'ยังไม่ครบ')+'</span>'
        +(dy?'<span style="font-size:10.5px;font-weight:700;border-radius:20px;padding:1px 8px;background:#F1ECFB;color:#5B289A">เปลี่ยน '+e(dShort)+'</span>':'')
      +'</span></button>'; }).join('');
  var detail='';
  if(_tmSel){
    var x0=L.filter(function(x){ return x.id===_tmSel; })[0], bid=_tmSel, r=tmBoatRec(bid), nm=(x0&&x0.boat&&x0.boat.name)||bid;
    var dy=tmDayGet(bid,_tmDate), day=(_tmMode==='day'), C=day?(dy||null):{master:r.master, crew:r.crew};
    var tab=function(k,lbl){ var a=(_tmMode===k); return '<button type="button" onclick="tmPick(\''+e(bid)+'\',\''+k+'\')" style="border:0;border-bottom:2px solid '+(a?'#1B2A55':'transparent')+';background:transparent;padding:8px 4px;margin-right:14px;font-family:inherit;font-size:12.5px;font-weight:'+(a?800:600)+';color:'+(a?'#14233F':'#5B6472')+';cursor:pointer">'+lbl+'</button>'; };
    var crewRows=function(list){ return (list||[]).map(function(c,i){ return '<div style="'+crewGrid+'">'
        +'<span style="font-size:11.5px;color:#8A9099;text-align:center">'+(i+1)+'</span>'
        +'<input value="'+e(c.name)+'" placeholder="Mr.U Sein Din"'+(ro?' disabled':'')+' onchange="tmCrewSet(\''+e(bid)+'\','+i+',\'name\',this.value)" style="border:1px solid #D9DDE4;border-radius:7px;padding:5px 8px;font-family:inherit;font-size:12.5px;min-width:0">'
        +'<input value="'+e(c.rank)+'" placeholder="Captain / Crew"'+(ro?' disabled':'')+' onchange="tmCrewSet(\''+e(bid)+'\','+i+',\'rank\',this.value)" style="border:1px solid #D9DDE4;border-radius:7px;padding:5px 8px;font-family:inherit;font-size:12.5px;min-width:0">'
        +'<input value="'+e(c.nat)+'" placeholder="Myanmar"'+(ro?' disabled':'')+' onchange="tmCrewSet(\''+e(bid)+'\','+i+',\'nat\',this.value)" style="border:1px solid #D9DDE4;border-radius:7px;padding:5px 8px;font-family:inherit;font-size:12.5px;min-width:0">'
        +'<input value="'+e(c.doc)+'" placeholder="เลขหนังสือเดินทางลูกเรือ"'+(ro?' disabled':'')+' onchange="tmCrewSet(\''+e(bid)+'\','+i+',\'doc\',this.value)" style="border:1px solid #D9DDE4;border-radius:7px;padding:5px 8px;font-family:\'DM Mono\',monospace;font-size:12px;min-width:0">'
        +(ro?'<span></span>':'<button type="button" onclick="tmCrewDel(\''+e(bid)+'\','+i+')" aria-label="ลบ" style="border:0;background:transparent;color:#B42318;cursor:pointer;font-size:14px">&times;</button>')+'</div>'; }).join(''); };
    var crewBox=function(T){ return '<div><div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><b style="font-size:12px;color:#14233F">ลูกเรือ (ตม.4/1 · ตม.36)</b><span style="font-size:11px;color:#5B6472">คนแรกคือผู้ควบคุมเรือ · ลำดับตามใบ</span>'
        +(ro?'':'<button type="button" onclick="tmCrewAdd(\''+e(bid)+'\')" style="margin-left:auto;border:1px solid #D0D5DD;background:#fff;border-radius:7px;padding:4px 10px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">+ เพิ่มลูกเรือ</button>')+'</div>'
        +'<div style="'+crewGrid+';font-size:10.5px;font-weight:700;color:#5B6472;margin-bottom:4px"><span></span><span>ชื่อ-สกุล</span><span>ตำแหน่ง</span><span>สัญชาติ</span><span>หนังสือเดินทางลูกเรือ</span><span></span></div>'
        +'<div style="display:flex;flex-direction:column;gap:5px">'+(crewRows(T.crew)||'<span style="font-size:12px;color:#8A9099">ยังไม่มีลูกเรือ</span>')+'</div></div>'; };
    var body;
    if(!day){
      body='<div style="display:flex;gap:8px;flex-wrap:wrap">'+inp(bid,'name',r.name,'ชื่อเรือบนเอกสาร',200)+inp(bid,'nat',r.nat,'สัญชาติเรือ (ไทย)',120)+inp(bid,'reg',r.reg,'ทะเบียนเรือ (ท่า · วันที่ · เลขที่)')+inp(bid,'gross',r.gross,'ระวางทั้งลำ',90)+inp(bid,'net',r.net,'ระวางบรรทุก',90)+'</div>'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap">'+inp(bid,'master',r.master,'ชื่อผู้ควบคุมเรือ',220)+inp(bid,'port',r.port,'ท่าเรือเดินทางผ่านเข้าออก')+inp(bid,'position',r.position,'ตำแหน่งเรือในท่า')+'</div>'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap">'+inp(bid,'embark',r.embark,'ท่าที่ผู้โดยสารลงเรือ')+inp(bid,'dest',r.dest,'ท่าที่ผู้โดยสารขึ้นจากเรือ')+inp(bid,'agent',r.agent,'ตัวแทนเรือ')+'</div>'
        +crewBox(C)
        +'<div style="font-size:11.5px;color:#5B6472;background:#F7F7F4;border-radius:8px;padding:8px 10px">ชุดประจำใช้ทุกวัน · ถ้าบางวันคนขับหรือลูกเรือเปลี่ยน ไปที่แท็บ <b>เฉพาะ '+e(dShort)+'</b> (เลือกวันที่ที่ข้อ 1) · ไม่ต้องแก้ชุดประจำ</div>';
    } else if(!dy){
      body='<div style="padding:18px;border:1px dashed #CFC2E6;border-radius:10px;background:#FBF9FE;font-size:12.5px;color:#3B2A63;line-height:1.7">'
        +'วันที่ <b>'+e(dLbl)+'</b> ลำนี้ยังใช้ <b>ชุดประจำ</b> (ผู้ควบคุม '+e(r.master||'—')+' · ลูกเรือ '+r.crew.length+' คน)'
        +(ro?'':'<div style="margin-top:10px"><button type="button" onclick="tmDayStart(\''+e(bid)+'\')" style="border:0;background:#5B289A;color:#fff;border-radius:8px;padding:8px 14px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">เปลี่ยนลูกเรือเฉพาะวันนี้</button>'
        +'<span style="font-size:11.5px;color:#6B5A8A;margin-left:10px">คัดลอกชุดประจำมาให้แก้ · วันอื่นไม่เปลี่ยน</span></div>')+'</div>';
    } else {
      body='<div style="font-size:12px;color:#3B2A63;background:#F1ECFB;border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
          +'<span>เอกสาร ตม. วันที่ <b>'+e(dLbl)+'</b> ใช้ชุดนี้แทนชุดประจำ · วันอื่นยังเป็นชุดประจำ'+(dy.by?(' · แก้โดย '+e(dy.by)):'')+'</span>'
          +(ro?'':'<button type="button" onclick="tmDayClear(\''+e(bid)+'\')" style="margin-left:auto;border:1px solid #CFC2E6;background:#fff;color:#5B289A;border-radius:7px;padding:4px 10px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">ยกเลิก · กลับไปใช้ชุดประจำ</button>')+'</div>'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap">'+inp(bid,'master',dy.master,'ชื่อผู้ควบคุมเรือ (วันนี้)',260)+'</div>'
        +crewBox(dy);
    }
    detail='<div style="padding:12px 16px 0;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><b style="font-size:15px">'+e(nm)+'</b>'
        +(r.name&&r.name!==nm?'<span style="font-size:12px;color:#5B6472">บนเอกสาร: '+e(r.name)+'</span>':'')
        +(r.at?'<span style="margin-left:auto;font-size:11px;color:#8A9099">ชุดประจำแก้ล่าสุด '+e(r.by||'')+' · '+e(String(r.at).slice(0,10))+'</span>':'')+'</div>'
      +'<div style="padding:0 16px;border-bottom:1px solid #EEECE6">'+tab('base','ชุดประจำ (ใช้ทุกวัน)')+tab('day','เฉพาะ '+e(dShort)+(dy?' ●':''))+'</div>'
      +'<div style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:10px">'+body+'</div>';
  }
  var boatsHtml=L.length
    ?('<div class="tm-2c" style="display:grid;grid-template-columns:260px minmax(0,1fr);background:#fff;border:1px solid #E7E5DD;border-radius:12px;overflow:hidden;align-items:start">'
      +'<div style="border-right:1px solid #EEECE6;max-height:70vh;overflow:auto">'+listHtml+'</div><div style="min-width:0">'+detail+'</div></div>'
      +'<style>@media(max-width:760px){.tm-2c{grid-template-columns:minmax(0,1fr)!important}.tm-2c>div:first-child{border-right:0!important;border-bottom:1px solid #EEECE6;max-height:220px!important}}</style>')
    :'<div style="padding:18px;text-align:center;color:#8A9099;font-size:12.5px">ยังไม่มีเรือที่วิ่งเส้นทางท่าระนอง · จัดเรือในใบจองก่อน รายชื่อลำจะขึ้นที่นี่</div>';
  var D=tmDayBoats(_tmDate);
  var dayHtml=D.length?D.map(function(g){
    var nm=g.bid?(((typeof getBoat==='function')&&getBoat(g.bid))||{}).name||g.bid:'(ยังไม่จัดเรือ)';
    var rec=g.bid?tmCrewOf(g.bid,_tmDate):null, crewOk=!!(rec&&rec.master&&rec.crew.length);
    var rn=(((typeof getRoute==='function')&&getRoute(g.routeId))||{}).name||g.routeId;
    return '<div style="display:grid;grid-template-columns:minmax(140px,1fr) minmax(160px,1.2fr) 90px 150px 150px 290px;gap:10px;align-items:center;padding:10px 14px;border-top:1px solid #EEECE6;font-size:12.5px">'
      +'<b style="color:#14233F">'+e(nm)+'</b><span style="color:#5B6472">'+e(rn)+' · '+g.bks.length+' ใบ</span><span><b>'+g.pax+'</b> คน</span>'
      +'<span style="font-size:11.5px;font-weight:700;border-radius:20px;padding:2px 9px;justify-self:start;'+(g.ok===g.n&&g.n?'background:#E6F6F2;color:#0F766E':'background:#FEF6E7;color:#7A4A00')+'">&#129706; ผู้โดยสาร '+g.ok+'/'+g.n+'</span>'
      +(g.bid?('<button type="button" onclick="tmGoDay(\''+e(g.bid)+'\')" title="ดู / เปลี่ยนลูกเรือของลำนี้เฉพาะวันนี้" style="border:0;font-family:inherit;cursor:pointer;font-size:11.5px;font-weight:700;border-radius:20px;padding:2px 9px;justify-self:start;'
          +(rec.day?'background:#F1ECFB;color:#5B289A':(crewOk?'background:#E6F6F2;color:#0F766E':'background:#FEF6E7;color:#7A4A00'))+'">'
          +(rec.day?('ลูกเรือวันนี้ (เปลี่ยน) '+rec.crew.length+' คน'):(crewOk?('ลูกเรือ '+rec.crew.length+' คน'):'ยังไม่มีข้อมูลเรือ'))+' &rsaquo;</button>'):'<span>—</span>')
      +(g.bid?'<span style="display:inline-flex;gap:6px;justify-self:start;flex-wrap:wrap"><button type="button" onclick="tmPreview(\''+e(g.bid)+'\',\''+e(_tmDate)+'\')" style="border:1px solid #1B2A55;background:#fff;color:#1B2A55;border-radius:8px;padding:6px 11px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">&#128065; พรีวิว</button><button type="button" onclick="tmExport(\''+e(g.bid)+'\',\''+e(_tmDate)+'\')" style="border:0;background:#1B2A55;color:#fff;border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">&#128229; ดาวน์โหลด Excel ชุด ตม.</button></span>':'<span style="font-size:11.5px;color:#B42318">จัดเรือก่อนถึงออกเอกสารได้</span>')+'</div>'; }).join('')
    :'<div style="padding:18px;text-align:center;color:#8A9099;font-size:12.5px">วันนี้ไม่มีใบจองเส้นทางท่าระนอง</div>';
  var dLbl=(function(){ try{ return new Date(_tmDate+'T12:00:00').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }catch(_){ return _tmDate; } })();
  host.innerHTML='<div style="font-family:\'IBM Plex Sans Thai\',\'DM Sans\',sans-serif;color:#14233F;padding:16px 18px;max-width:1240px">'
    +'<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px"><b style="font-size:18px">&#129706; เอกสาร ตม. · ทะเลพม่า</b><span style="font-size:12.5px;color:#5B6472">Ranong · ชุดเอกสารตรวจคนเข้าเมืองต่อลำ (ตม.2/1 · 3/1 · 4/1 · 36 · 33 · บัญชีจำนวน · คำสั่งเจ้าหน้าที่)</span></div>'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:22px;height:22px;border-radius:50%;background:#1B2A55;color:#fff;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">1</span><b style="font-size:14px">ออกเอกสารรายวัน</b>'
      +'<span style="margin-left:auto;display:inline-flex;align-items:center;gap:4px"><button type="button" onclick="tmShiftDate(-1)" style="border:1px solid #D0D5DD;background:#fff;border-radius:7px;width:28px;height:28px;cursor:pointer">&lsaquo;</button>'
      +'<button type="button" onclick="laDatePop(\'tmSetDate\',_tmDate,event)" style="border:1px solid #D0D5DD;background:#fff;border-radius:7px;padding:4px 12px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">'+e(dLbl)+'</button>'
      +'<button type="button" onclick="tmShiftDate(1)" style="border:1px solid #D0D5DD;background:#fff;border-radius:7px;width:28px;height:28px;cursor:pointer">&rsaquo;</button>'
      +'<button type="button" onclick="tmSetDate((typeof bkV2LocalYMD===\'function\')?bkV2LocalYMD(new Date()):new Date().toISOString().slice(0,10))" style="border:1px solid #D0D5DD;background:#fff;border-radius:7px;padding:4px 10px;font-family:inherit;font-size:12px;cursor:pointer">วันนี้</button></span></div>'
    +'<div style="background:#fff;border:1px solid #E7E5DD;border-radius:12px;overflow:hidden;margin-bottom:18px"><div style="display:grid;grid-template-columns:minmax(140px,1fr) minmax(160px,1.2fr) 90px 150px 150px 290px;gap:10px;padding:7px 14px;font-size:10.5px;font-weight:700;color:#5B6472"><span>เรือ</span><span>เส้นทาง</span><span>ผู้โดยสาร</span><span>ข้อมูล ตม.</span><span>ข้อมูลเรือ</span><span></span></div>'+dayHtml+'</div>'
    +'<div style="font-size:11.5px;color:#5B6472;margin:-10px 0 18px">ผู้โดยสารที่ข้อมูลยังไม่ครบ ยังออกเอกสารได้ (ช่องว่าง) · กรอกที่ By trip date (กางแถวใบจอง) หรือหน้า Insurance</div>'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:22px;height:22px;border-radius:50%;background:#1B2A55;color:#fff;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">2</span><b style="font-size:14px">ข้อมูลเรือและลูกเรือ</b><span style="font-size:12px;color:#5B6472">คลิกชื่อเรือทางซ้าย รายละเอียดขึ้นทางขวา · ชุดประจำใช้ทุกวัน · วันไหนลูกเรือเปลี่ยน ใช้แท็บ "เฉพาะวันที่"</span></div>'
    +boatsHtml+'</div>';
}
/* ── Excel ───────────────────────────────────────────────────────────────── */
var TM_TEMPLATE_URL='assets/tm_ranong_template.xlsx';   /* §tmPaxPg · แม่แบบ v4 = ไฟล์ที่ทีมแก้แล้วบันทึกจาก Excel (ล้างข้อมูลออก) · v2/v3 สร้างด้วยการคัดลอกแผ่น Excel ต้องซ่อมไฟล์และทิ้งข้อมูลแผ่นบัญชีคนโดยสาร */
function tmLoadExcelJS(){
  if(window.ExcelJS) return Promise.resolve();
  return new Promise(function(res,rej){ var s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'; s.onload=res; s.onerror=function(){ rej(new Error('ExcelJS load failed')); }; document.head.appendChild(s); });
}
var TM_MONTH_TH=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
function tmGender(nm){ var s=String(nm||'').trim().toLowerCase(); if(/^(mrs|ms|miss|นาง|นางสาว|น\.ส\.)/.test(s)) return 'f'; if(/^(mr|นาย|mstr|master)/.test(s)) return 'm'; return ''; }
function tmNatLabel(p){ var c=String(p.natCode||'').toUpperCase(); if(!c||c==='TH'||c==='THA') return 'THAI'; try{ if(typeof insNatLabel==='function'){ var l=String(insNatLabel(c)||'').split('·')[0].trim(); if(l) return l.toUpperCase(); } }catch(_){} return c; }
function tmClean(s){ return String(s||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim(); }
/* รายชื่อผู้โดยสารของลำนั้นวันนั้น · ตามใบจอง · lead ก่อน */
function tmPaxOfBoat(bid, ds){
  var out=[]; tmDayBoats(ds).filter(function(g){ return g.bid===bid; }).forEach(function(g){
    g.bks.forEach(function(b){ tmPaxList(b).forEach(function(p){ if(!p.lead && !p.pad && !(p.name||'').trim()) return;   /* §tmPax3 · แถวว่างที่เติมให้ครบจำนวนคนก็ออกเอกสาร */
      /* §tmPax2 · ชื่อไทยในใบจอง → คอลัมน์ไทย (ไม่ไปโผล่ช่องอังกฤษ) · ชื่ออังกฤษ → คอลัมน์อังกฤษ · ค่าที่กรอกในช่องชนะ */
      var en=tmClean((typeof tmEnDef==='function')?tmEnDef(b.id,p):(tmGet(b.id,p.key,'enName')||p.name||''));
      var th=tmClean((typeof tmThDef==='function')?tmThDef(b.id,p):tmGet(b.id,p.key,'thName'));
      var dob=(typeof tmDobNorm==='function')?tmDobNorm(tmGet(b.id,p.key,'dob')):tmGet(b.id,p.key,'dob');
      var _nc=String((typeof tmNatDef==='function')?tmNatDef(b.id,p,b):(p.natCode||'TH')).toUpperCase();
      out.push({ b:b, p:p, name:en, th:th, id:tmGet(b.id,p.key,'idNo'), laser:tmGet(b.id,p.key,'idLaser'), dob:dob, remark:tmGet(b.id,p.key,'remark'),
                 nat:tmNatLabel({natCode:_nc}), natCode:_nc,   /* §tmPax4 · สัญชาติจากช่องกรอก (ค่าตั้งต้น = ใบจอง) */ g:tmGender(en||p.name), vc:b.voucherRef||b.code||b.id }); }); }); });
  return out;
}
/* §tmPrev (2026-11-09) · owner: "เพิ่มให้พรีวิวด้วย"
   ใช้แม่แบบ + tmFill ชุดเดียวกับไฟล์ดาวน์โหลด แล้ววาดแต่ละแผ่นเป็นตาราง HTML (ความกว้างคอลัมน์ ความสูงแถว
   เซลล์ผสาน เส้นขอบ ตัวหนา จัดวาง) · สูตรที่อ้างข้ามแผ่น (=แผ่น!A1, =A1, SUM(A1:A9)) คำนวณให้เห็นค่าจริง
   ฟอนต์ไทยเก่า (Angsana/Browallia) ไม่มีในเบราว์เซอร์ส่วนใหญ่ · ย่อขนาดลงให้ใกล้ของจริง */
function tmBuildWb(bid, ds){
  return tmLoadExcelJS().then(function(){ return fetch(TM_TEMPLATE_URL+'?v=4').then(function(r){ if(!r.ok) throw new Error('template '+r.status); return r.arrayBuffer(); }); })
    .then(function(buf){ var wb=new ExcelJS.Workbook(); return wb.xlsx.load(buf); })
    .then(function(wb){ tmFill(wb, bid, ds); return wb; });
}
var _tmPv=null;
function tmPreview(bid, ds){
  var btn=(typeof event!=='undefined'&&event&&event.currentTarget)||null; if(btn){ btn.disabled=true; btn.textContent='กำลังเปิด…'; }
  var done=function(){ if(btn){ btn.disabled=false; btn.innerHTML='&#128065; พรีวิว'; } };
  tmBuildWb(bid, ds).then(function(wb){ done(); _tmPv={wb:wb, bid:bid, ds:ds, sheet:''};
    var pick=wb.worksheets.filter(function(w){ return /^บัญชีคนโดยสาร\s*$/.test(w.name); })[0]||wb.worksheets[0];
    _tmPv.sheet=pick.name; tmPvRender(); })
  .catch(function(err){ done(); alert('Could not build the preview: '+(err&&err.message||err)); });
}
function tmPvClose(){ var o=document.getElementById('tm-pv'); if(o) o.remove(); _tmPv=null; document.removeEventListener('keydown', tmPvKey); }
function tmPvKey(ev){ if(ev.key==='Escape') tmPvClose(); }
function tmPvTab(i){ if(!_tmPv) return; var w=_tmPv.wb.worksheets[+i]; if(w){ _tmPv.sheet=w.name; tmPvRender(); } }
function tmPvVal(wb, ws, addr, depth){
  depth=depth||0; if(depth>8) return '';
  var c=ws.getCell(addr), v=c.value;
  if(v==null) return '';
  if(v instanceof Date) return v;
  if(typeof v==='object'){
    if(v.richText) return v.richText.map(function(t){ return t.text; }).join('');
    if(v.formula!=null || v.sharedFormula!=null){
      var f=String(v.formula||'').replace(/^=/,'').trim(), m;
      if((m=f.match(/^'?(.+?)'?!\$?([A-Z]+)\$?(\d+)$/))){ var w2=wb.getWorksheet(m[1])||wb.getWorksheet(m[1]+' ')||wb.getWorksheet(m[1].trim()); return w2?tmPvVal(wb,w2,m[2]+m[3],depth+1):''; }
      if((m=f.match(/^\$?([A-Z]+)\$?(\d+)$/))) return tmPvVal(wb,ws,m[1]+m[2],depth+1);
      if((m=f.match(/^SUM\(\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)\)$/i))){
        var sum=0, c0=ws.getColumn(m[1]).number, c1=ws.getColumn(m[3]).number;
        for(var r=+m[2]; r<=+m[4]; r++) for(var cc=c0; cc<=c1; cc++){ var x=tmPvVal(wb,ws,ws.getRow(r).getCell(cc).address,depth+1); if(typeof x==='number') sum+=x; else if(x!==''&&!isNaN(+x)) sum+=+x; }
        return sum;
      }
      return (v.result!=null && typeof v.result!=='object')?v.result:'';
    }
    if(v.text!=null) return v.text;
    if(v.error) return v.error;
    return '';
  }
  return v;
}
function tmPvTxt(x){
  if(x instanceof Date){ var M=['January','February','March','April','May','June','July','August','September','October','November','December'];
    return x.getUTCDate()+' '+M[x.getUTCMonth()]+' '+x.getUTCFullYear(); }
  return String(x==null?'':x);
}
function tmPvSheetHtml(wb, ws){
  var e=tmE, maxR=0, maxC=0, R0=Math.min(ws.rowCount||0, 140);
  for(var r=1;r<=R0;r++){ var row=ws.getRow(r); row.eachCell({includeEmpty:false}, function(c, cn){ var v=c.value; if(v!=null && v!=='' ){ if(r>maxR) maxR=r; if(cn>maxC) maxC=cn; } }); }
  var CN=Math.max(1, Math.min(Math.max(maxC, (ws.columnCount||0)>16?maxC:(ws.columnCount||maxC)), 20)); maxR=Math.min(maxR+1, R0||1);
  var merges=((ws.model&&ws.model.merges)||[]), skip={}, span={};
  merges.forEach(function(rg){ var p=String(rg).split(':'); if(p.length<2) return; var a=ws.getCell(p[0]), b=ws.getCell(p[1]);
    var r0=a.row, c0=a.col, r1=b.row, c1=b.col; span[r0+','+c0]={rs:r1-r0+1, cs:c1-c0+1};
    for(var r=r0;r<=r1;r++) for(var c=c0;c<=c1;c++) if(r!==r0||c!==c0) skip[r+','+c]=1; });
  var cols='', tw=0;
  for(var c=1;c<=CN;c++){ var w=(ws.getColumn(c).width||9)*7+5; tw+=w; cols+='<col style="width:'+Math.round(w)+'px">'; }
  var bd=function(s){ if(!s||!s.style) return 'none'; var w=/medium|thick|double/.test(s.style)?2:1; var col=(s.color&&s.color.argb)?('#'+String(s.color.argb).slice(-6)):'#222'; return w+'px '+(s.style==='dashed'||s.style==='dotted'?s.style:(s.style==='double'?'double':'solid'))+' '+col; };
  var body='';
  for(var r=1;r<=maxR;r++){ var row=ws.getRow(r), h=Math.max(4, Math.round((row.height||15)*1.333));
    body+='<tr style="height:'+h+'px">';
    for(var c=1;c<=CN;c++){ var k=r+','+c; if(skip[k]) continue;
      var cell=row.getCell(c), sp=span[k], st='', f=cell.font||{}, al=cell.alignment||{}, b=cell.border||{}, fl=cell.fill;
      var fn=String(f.name||''), sz=+f.size||11, thai=/angsana|browallia|cordia|eucrosia/i.test(fn);
      st+='font-size:'+(thai?(sz*0.78):sz).toFixed(1)+'pt;';
      if(f.bold) st+='font-weight:700;'; if(f.italic) st+='font-style:italic;'; if(f.underline) st+='text-decoration:underline;';
      if(f.color&&f.color.argb&&String(f.color.argb).length>=6) st+='color:#'+String(f.color.argb).slice(-6)+';';
      if(al.horizontal) st+='text-align:'+(al.horizontal==='centerContinuous'?'center':al.horizontal)+';';
      st+='vertical-align:'+(al.vertical==='top'?'top':(al.vertical==='middle'||al.vertical==='center'?'middle':'bottom'))+';';
      st+='white-space:'+(al.wrapText?'pre-wrap':'pre')+';';
      st+='border-top:'+bd(b.top)+';border-bottom:'+bd(b.bottom)+';border-left:'+bd(b.left)+';border-right:'+bd(b.right)+';';
      if(fl&&fl.type==='pattern'&&fl.pattern==='solid'&&fl.fgColor&&fl.fgColor.argb) st+='background:#'+String(fl.fgColor.argb).slice(-6)+';';
      var tx=tmPvTxt(tmPvVal(wb, ws, cell.address));
      if(typeof tmPvVal(wb, ws, cell.address)==='number' && !al.horizontal) st+='text-align:right;';
      body+='<td'+(sp?(' rowspan="'+sp.rs+'" colspan="'+sp.cs+'"'):'')+' style="'+st+'">'+e(tx)+'</td>';
    }
    body+='</tr>';
  }
  return {html:'<table style="border-collapse:collapse;table-layout:fixed;width:'+Math.round(tw)+'px;font-family:Tahoma,\'Sarabun\',\'IBM Plex Sans Thai\',sans-serif;color:#000;background:#fff"><colgroup>'+cols+'</colgroup><tbody>'+body+'</tbody></table>', w:tw};
}
function tmPvRender(){
  if(!_tmPv) return; var e=tmE, wb=_tmPv.wb, ws=wb.getWorksheet(_tmPv.sheet)||wb.worksheets[0];
  var o=document.getElementById('tm-pv');
  if(!o){ o=document.createElement('div'); o.id='tm-pv'; document.body.appendChild(o); document.addEventListener('keydown', tmPvKey); }
  var S=tmPvSheetHtml(wb, ws), nm=tmBoatRec(_tmPv.bid).name||_tmPv.bid;
  var dl=(function(){ try{ return new Date(_tmPv.ds+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); }catch(_){ return _tmPv.ds; } })();
  var tabs=wb.worksheets.map(function(w,i){ var on=w.name===ws.name;
    return '<button type="button" onclick="tmPvTab('+i+')" style="border:0;border-bottom:2px solid '+(on?'#1B2A55':'transparent')+';background:none;padding:8px 10px;font-family:inherit;font-size:12px;font-weight:'+(on?'700':'500')+';color:'+(on?'#14233F':'#5B6472')+';cursor:pointer;white-space:nowrap">'+e(w.name.trim())+'</button>'; }).join('');
  var avail=Math.min(window.innerWidth-80, 1100), z=Math.min(1, (avail-40)/Math.max(1,S.w));
  o.innerHTML='<div onclick="if(event.target===this)tmPvClose()" style="position:fixed;inset:0;background:rgba(20,35,63,.55);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:\'IBM Plex Sans Thai\',\'DM Sans\',sans-serif">'
    +'<div style="background:#F4F3EF;border-radius:14px;width:'+avail+'px;max-width:96vw;height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
    +'<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff;border-bottom:1px solid #E7E5DD">'
      +'<b style="font-size:14px;color:#14233F">&#128065; พรีวิวชุด ตม. · '+e(nm)+' · '+e(dl)+'</b>'
      +'<span style="font-size:11.5px;color:#5B6472">ตามที่จะออกเป็นไฟล์ Excel · ฟอนต์อาจต่างจาก Excel เล็กน้อย</span>'
      +'<button type="button" onclick="tmExport(\''+e(_tmPv.bid)+'\',\''+e(_tmPv.ds)+'\')" style="margin-left:auto;border:0;background:#1B2A55;color:#fff;border-radius:8px;padding:7px 12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">&#128229; ดาวน์โหลด Excel</button>'
      +'<button type="button" onclick="tmPvClose()" title="ปิด (Esc)" style="border:1px solid #D0D5DD;background:#fff;border-radius:8px;width:32px;height:32px;font-size:16px;cursor:pointer">&times;</button></div>'
    +'<div style="display:flex;gap:2px;padding:0 10px;background:#fff;border-bottom:1px solid #E7E5DD;overflow-x:auto">'+tabs+'</div>'
    +'<div style="flex:1;overflow:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start">'
      +'<div style="background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.12);padding:24px;zoom:'+z.toFixed(3)+'">'+S.html+'</div></div>'
    +'</div></div>';
}
function tmExport(bid, ds){
  var btn=event&&event.currentTarget; if(btn){ btn.disabled=true; btn.textContent='กำลังสร้าง…'; }
  var done=function(){ if(btn){ btn.disabled=false; btn.innerHTML='&#128229; ดาวน์โหลด Excel ชุด ตม.'; } };
  tmLoadExcelJS().then(function(){ return fetch(TM_TEMPLATE_URL+'?v=4').then(function(r){ if(!r.ok) throw new Error('template '+r.status); return r.arrayBuffer(); }); })
  .then(function(buf){ var wb=new ExcelJS.Workbook(); return wb.xlsx.load(buf); })
  .then(function(wb){ tmFill(wb, bid, ds); tmNoFitToPage(wb); return wb.xlsx.writeBuffer(); })
  .then(function(out){ var nm=(tmBoatRec(bid).name||bid).replace(/[\\/:*?"<>|]/g,'-');
    var blob=new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ตม-'+nm+'-'+ds+'.xlsx'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    done(); })
  .catch(function(err){ done(); alert('Could not build the document: '+(err&&err.message||err)); });
}
/* §tmFitBug (2026-11-09) · ExcelJS 4.4 เขียน <sheetPr> เป็น pageSetUpPr ก่อน outlinePr (ผิดลำดับ schema)
   Excel เปิดแล้วขึ้น [Repaired] และทิ้งเนื้อหาแผ่นนั้น (owner: บัญชีคนโดยสารว่างทั้งแผ่น)
   LibreOffice ไม่ฟ้อง · ทุกแผ่นที่ตั้ง fit to page → เปลี่ยนเป็นย่อตาม % แทน ExcelJS จะไม่เขียน pageSetUpPr */
function tmNoFitToPage(wb){
  try{ wb.eachSheet(function(ws){ var p=ws.pageSetup||{}; if(p.fitToPage){ p.fitToPage=false; if(!(+p.scale>0 && +p.scale<100)) p.scale=66; delete p.fitToWidth; delete p.fitToHeight; } }); }catch(_){ }
}
function tmFill(wb, bid, ds){
  var R=Object.assign({}, tmBoatRec(bid)), P=tmPaxOfBoat(bid, ds);
  /* §tmTwoCol · วันที่มีชุดเฉพาะวัน ใช้ผู้ควบคุม+ลูกเรือชุดนั้น */
  var CW=tmCrewOf(bid, ds); R.master=CW.master; var crew=(CW.crew||[]).filter(function(c){ return c.name; });
  var d=new Date(ds+'T12:00:00'), dd=d.getDate(), mi=d.getMonth(), be=d.getFullYear()+543;
  var set=function(ws, addr, v){ if(!ws) return; var c=ws.getCell(addr); c.value=(v===undefined?null:v); };
  var clr=function(ws, r0, r1, cols){ if(!ws) return; for(var r=r0;r<=r1;r++) cols.forEach(function(c){ ws.getCell(c+r).value=null; }); };
  /* ตม.2/1 */
  var s1=wb.getWorksheet('รายการเกี่ยวกับพาหนะ');
  set(s1,'K4',TM_DEF.writeAt); set(s1,'I7',dd); set(s1,'K7',TM_MONTH_TH[mi]); set(s1,'M7',be);
  set(s1,'B20',R.name); set(s1,'I20',R.port); set(s1,'B23',new Date(Date.UTC(be, mi, dd)));   /* UTC · ExcelJS เขียนเป็น UTC ถ้าใช้เวลาเครื่องจะถอยไปวันก่อน */ set(s1,'I23',R.nat);
  set(s1,'B26',R.master); set(s1,'B29',R.reg); set(s1,'G29',R.agent); set(s1,'B32',R.gross?+R.gross||R.gross:null); set(s1,'I32',R.net?+R.net||R.net:null); set(s1,'B35',R.position);
  set(s1,'A54',crew.length+' คน'); set(s1,'D54',' '+P.length+' คน');
  /* §tmPaxPg (2026-11-09) · owner ส่งไฟล์ที่แก้แล้ว "ข้อมูลที่ Export ควรออกมาแบบนี้"
     ตม.3/1 · 2 หน้า หน้าละ 25 แถว (1-25 · 26-50) รูปแบบเดียวกันทั้งคู่ คอลัมน์ A-F (แม่แบบใหม่)
     · เลขบัตรแบบขีด 3-1006-02866-47-6 · ชาวต่างชาติ (เลขบัตรว่าง/ศูนย์) ใช้เลขพาสปอร์ต
     · ช่องท่าลงเรือ/ขึ้นจากเรือเว้นว่าง (เดิมใส่แถวแรกแล้วตามด้วย ") */
  var pages=[ {ws:wb.getWorksheet('บัญชีคนโดยสาร')||wb.getWorksheet('บัญชีคนโดยสาร '), r0:16, n:25, base:1, idx:'A', nm:'B', nat:'C', id:'D', em:'E', dis:'F'},
              {ws:wb.getWorksheet('บัญชีคนโดยสาร (2)'), r0:16, n:25, base:26, idx:'A', nm:'B', nat:'C', id:'D', em:'E', dis:'F'} ];
  var docNo=function(x){ var d=String(x.id||'').replace(/\D/g,''); if(d.length===13 && !/^0+$/.test(d)) return tmIdFmt(d); return x.laser||(d&&!/^0+$/.test(d)?x.id:null); };
  if(P.length>50) try{ console.warn('[tmDoc] '+P.length+' passengers · the form holds 50 · extra rows not printed'); }catch(_){}
  var k=0;
  pages.forEach(function(pg, pi){
    if(!pg.ws) return;
    set(pg.ws,'B10',R.name);   /* แม่แบบเป็นสูตรอ้าง ตม.33!F18 ซึ่งอ้างต่ออีกชั้น · บางโปรแกรมเปิดแล้วขึ้น #NAME? */
    for(var r=0;r<pg.n;r++){ var row=pg.r0+r, x=P[k];
      set(pg.ws,pg.idx+row,pg.base+r);   /* เลขลำดับพิมพ์ไว้ทุกแถว เหมือนไฟล์ที่ทีมใช้ */
      if(x){ k++; set(pg.ws,pg.nm+row,x.name); set(pg.ws,pg.nat+row,x.nat); set(pg.ws,pg.id+row,docNo(x)); }
      else { set(pg.ws,pg.nm+row,null); set(pg.ws,pg.nat+row,null); set(pg.ws,pg.id+row,null); }
      set(pg.ws,pg.em+row,null); set(pg.ws,pg.dis+row,null);
    }
    try{ set(pg.ws,'D13',R.nat); }catch(_){}
  });
  /* ตม.4/1 ลูกเรือ */
  var s4=wb.getWorksheet('บัญชีคนประจำพาหนะ');
  if(s4){ set(s4,'B12',R.nat==='พม่า'?'Myanmar':R.nat); set(s4,'D12',R.embark);
    for(var r=0;r<25;r++){ var row=15+r, c=crew[r]; set(s4,'A'+row,r+1);
      set(s4,'B'+row,c?c.name:null); set(s4,'C'+row,c?c.rank:null); set(s4,'D'+row,c?c.nat:null); set(s4,'F'+row,c?c.doc:null); } }
  /* ตม.36 · ชื่อลูกเรือเป็นสูตรอ้าง ตม.4/1 อยู่แล้ว */
  /* ตม.33 */
  var s33=wb.getWorksheet('ตม.33'); if(s33){ set(s33,'M6',TM_DEF.writeAt); set(s33,'C22',TM_DEF.from); }
  /* บัญชีแสดงจำนวน */
  var sN=wb.getWorksheet('บัญชีแสดงจำนวนคนโดยสาร ')||wb.getWorksheet('บัญชีแสดงจำนวนคนโดยสาร');
  if(sN){ var nat={}, ord=[]; P.forEach(function(x){ var key=x.nat; if(!nat[key]){ nat[key]={m:0,f:0}; ord.push(key); } if(x.g==='f') nat[key].f++; else nat[key].m++; });
    for(var r=9;r<=20;r++){ set(sN,'A'+r,null); set(sN,'B'+r,null); set(sN,'C'+r,null); set(sN,'D'+r,null); set(sN,'E'+r,null); }
    ord.slice(0,12).forEach(function(key,i){ var r=9+i; set(sN,'A'+r,key.charAt(0)+key.slice(1).toLowerCase()); set(sN,'B'+r,nat[key].m); set(sN,'C'+r,nat[key].f); set(sN,'D'+r,nat[key].m+nat[key].f); set(sN,'E'+r,i===0?'Temporary\nBoarder':null); });
    var cm=0, cf=0; crew.forEach(function(c){ if(tmGender(c.name)==='f') cf++; else cm++; });
    set(sN,'G9',R.nat==='พม่า'?'Myanmar':R.nat); set(sN,'H9',cm); set(sN,'I9',cf); set(sN,'J9',cm+cf); }
  /* แผ่นเพิ่ม · ข้อมูลประกอบ (ชื่อไทย · เลขหลังบัตร · วันเกิด · Remark) */
  var sx=wb.getWorksheet('ข้อมูลประกอบ'); if(sx) wb.removeWorksheet(sx.id);
  sx=wb.addWorksheet('ข้อมูลประกอบ');
  sx.columns=[{width:6},{width:14},{width:32},{width:32},{width:20},{width:18},{width:14},{width:12},{width:28}];
  sx.addRow(['ข้อมูลประกอบผู้โดยสาร · '+R.name+' · '+dd+' '+TM_MONTH_TH[mi]+' '+be]).font={bold:true,size:14};
  sx.addRow([]);
  var hdr=sx.addRow(['#','Voucher','ชื่อ-สกุล ไทย','ชื่อ-สกุล อังกฤษ','เลขบัตรประชาชน','เลขหลังบัตร','วันเกิด','สัญชาติ','Remark']); hdr.font={bold:true};
  hdr.eachCell(function(c){ c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEEF1F6'}}; c.border={bottom:{style:'thin'}}; });
  P.forEach(function(x,i){ sx.addRow([i+1, x.vc, x.th, x.name, x.id?tmIdFmt(x.id):'', x.laser, x.dob, x.nat, x.remark]); });
  sx.addRow([]); sx.addRow(['ลูกเรือ']).font={bold:true};
  crew.forEach(function(c,i){ sx.addRow([i+1,'',c.name,'',c.doc,'','',c.nat,c.rank]); });
  return wb;
}
