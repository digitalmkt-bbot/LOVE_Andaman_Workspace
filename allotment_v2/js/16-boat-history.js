/* ══ §boatHist (2026-11-12) · ประวัติ & ค่าใช้จ่ายของเรือรายลำ ═══════════════════════════════════════
   owner "ถ้าเราอยากรู้ว่า เรือแต่ละลำ ทำอะไรไปบ้างที่ผ่านมา ค่าใช้จ่ายเท่าไหร่บ้างแล้ว เราดูจากไหน"
        → "ต้องเพิ่มค่าใช้จ่าย ตัวเรือ เครื่องยนต์ เกียร์ ใบจักร ด้วย" → "โอเคทำ"
   เดิมต้องเปิด Boat Status + Analytics + P&L รายทริป แล้วรวมเอง · หน้านี้รวมให้ในที่เดียว (อ่านอย่างเดียว ไม่บันทึกอะไร)
   ที่มาของตัวเลข (ไม่มีสูตรใหม่ · ใช้ตัวคิดเดิมทั้งหมด จะได้ตรงกับหน้าต้นทาง)
     ทริป / รายได้ / ต้นทุนทริป  = pxTrip (P&L รายทริป)
     ค่าซ่อมบำรุงแยกส่วน          = costAggregate (Fleet → Analytics · หมวด เรือ/เครื่องยนต์/เกียร์/ใบจักร/อื่น ๆ/memo ตรง)
     สถานะ / วันใช้ไม่ได้          = boat.log + boatEffStatus
     เปลี่ยนเรือกลางทาง            = TRIPS[d][boat].swap / type 'rescue' (§bopSwap)
   เปิดจากปุ่ม "ประวัติ & ค่าใช้จ่าย" บนหัวเรือ (Boat Status / Fleet) → bhOpen(boatId) */
var _bh = { id:'', per:'season', from:'', to:'', flt:'key', open:{}, data:null };
function bhEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
function bhN(n){ return Math.round(n||0).toLocaleString(); }
function bhB(n){ return '฿'+bhN(n); }
function bhSg(n){ n=Math.round(n||0); return (n<0?'−':'+')+bhN(Math.abs(n)); }
var BH_MO=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function bhD(ds){ ds=String(ds||''); if(ds.length<10) return ds; return (+ds.slice(8,10))+' '+BH_MO[+ds.slice(5,7)-1]; }
function bhDY(ds){ ds=String(ds||''); if(ds.length<10) return ds; return bhD(ds)+' '+ds.slice(2,4); }
function bhToday(){ return (typeof TODAY_STR!=='undefined' && TODAY_STR) ? TODAY_STR : new Date().toISOString().slice(0,10); }
function bhRange(){
  var t=bhToday(), y=+t.slice(0,4), m=+t.slice(5,7);
  if(_bh.per==='month') return [t.slice(0,7)+'-01', t];
  if(_bh.per==='year')  return [y+'-01-01', t];
  if(_bh.per==='custom'){ var a=_bh.from||(t.slice(0,7)+'-01'), b=_bh.to||t; return a<=b?[a,b]:[b,a]; }
  return [((m>=10)?y:(y-1))+'-10-01', t];                      /* ซีซั่น = ตั้งแต่ 1 ต.ค. */
}
function bhNextDay(ds){ var d=new Date(ds+'T12:00:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }

function bhCompute(id, from, to){
  var b=(typeof getBoat==='function')?getBoat(id):null;
  var D={ id:id, boat:b||{}, from:from, to:to, trips:[], G:{}, n:0, pax:0, rev:0, cost:0, profit:0,
          mRows:[], mCat:{}, mTot:0, mDone:0, mProc:0, units:{}, months:{}, ev:[], down:{}, downN:0, err:[] };
  var mon=function(ds){ var k=String(ds).slice(0,7); return D.months[k]||(D.months[k]={k:k,n:0,pax:0,rev:0,cost:0,maint:0}); };
  /* 1 · ทริป */
  try{
    Object.keys((typeof TRIPS!=='undefined'&&TRIPS)||{}).filter(function(d){ return d>=from && d<=to; }).sort().forEach(function(d){
      var op=TRIPS[d] && TRIPS[d][id]; if(!op) return;
      var t=null; try{ t=(typeof pxTrip==='function')?pxTrip(d,id):null; }catch(e){ D.err.push('pxTrip '+d); }
      if(op.swap){ var tb=(typeof getBoat==='function'&&getBoat(op.swap.to))||{};
        D.ev.push({ d:d, kind:'swap', tag:'เปลี่ยนเรือ', text:'เสียกลางทาง'+(op.swap.cause?(' · '+op.swap.cause):'')+(op.swap.place?(' · '+op.swap.place):'')+' · '+(tb.name||op.swap.to||'เรืออีกลำ')+' ไปรับต่อ'+(op.swap.pax?(' '+op.swap.pax+' คน'):'')+(op.swap.by?(' · บันทึกโดย '+op.swap.by):'') }); }
      if(op.type==='rescue'){ var fb=(typeof getBoat==='function'&&getBoat(op.rescueFor))||{};
        D.ev.push({ d:d, kind:'swap', tag:'เรือกู้', text:'ออกไปรับลูกค้าแทน '+(fb.name||op.rescueFor||'เรืออีกลำ')+' (เปลี่ยนเรือกลางทาง)' }); }
      if(!t || t.noSail) return;
      var rn=(t.route&&t.route.name)||t.rid||'';
      var row={ d:d, rn:rn, pax:(t.px&&t.px.tot)||0, rev:t.rev||0, cost:t.cost||0, profit:t.profit||0, rescue:!!t.rescue, fam:(t.fam&&t.fam.pax)||0 };
      D.trips.push(row); D.n++; D.pax+=row.pax; D.rev+=row.rev; D.cost+=row.cost; D.profit+=row.profit;
      var M=mon(d); M.n++; M.pax+=row.pax; M.rev+=row.rev; M.cost+=row.cost;
      (t.rows||[]).forEach(function(r){ var u=+r.use||0; if(!u) return; var g=r.g||'อื่น ๆ';
        var o=D.G[g]||(D.G[g]={g:g,tot:0,L:{}}); o.tot+=u; var l=String(r.l||'').trim()||'—'; o.L[l]=(o.L[l]||0)+u; });
      D.ev.push({ d:d, kind:'sail', tag:row.rescue?'เรือกู้':'ออกเรือ', text:rn+' · '+row.pax+' คน'+(row.fam?(' (FAM '+row.fam+')'):''), amt:row.profit, pl:true });
    });
  }catch(e){ D.err.push('trips'); }
  /* 2 · ค่าซ่อมบำรุง · ตัวคิดเดียวกับหน้า Analytics (ทุกช่วงเวลา แล้วกรองช่วงเอง) */
  try{
    var A=null, keep=null, has=false;
    try{ keep=_costTimeFilter; has=true; _costTimeFilter='all'; }catch(e){ has=false; }
    try{ A=(typeof costAggregate==='function')?costAggregate():null; }
    finally{ if(has){ try{ _costTimeFilter=keep; }catch(e){} } }
    ((A&&A.rows)||[]).forEach(function(r){
      if(r.boatId!==id) return; var dt=String(r.date||'').slice(0,10); if(!dt || dt<from || dt>to) return;
      var c=+r.cost||0, keys=(r.cats&&r.cats.length)?r.cats:['other'], share=c/keys.length;
      keys.forEach(function(k){ var o=D.mCat[k]||(D.mCat[k]={k:k,tot:0,n:0,seen:{}}); o.tot+=share; if(!o.seen[r.id]){ o.seen[r.id]=1; o.n++; } });
      D.mTot+=c; if(r.done) D.mDone+=c; else D.mProc+=c; mon(dt).maint+=c;
      var names=[];
      if(r.kind!=='memo'){ var m=((typeof FL_MAINT!=='undefined'&&FL_MAINT)||[]).find(function(x){ return x.id===r.id; });
        ((m&&m.assets)||[]).forEach(function(a,ix){ var uid=a.engId||a.gbId||a.propId; if(!uid) return; var k=keys[ix]||keys[0];
          var lb=''; try{ lb=(typeof costUnitLabel==='function')?costUnitLabel(uid,k,a):(a.label||uid); }catch(e){ lb=a.label||uid; }
          var u=D.units[uid]||(D.units[uid]={id:uid,cat:k,label:lb,cost:0,n:0}); u.cost+=share; u.n++; names.push(lb); }); }
      D.mRows.push({ id:r.id, no:r.no, title:r.title, date:dt, cost:c, cats:keys, done:!!r.done, memo:(r.kind==='memo'), units:names });
      D.ev.push({ d:dt, kind:'maint', cats:keys, tag:keys.map(function(k){ return bhCatName(k); }).join(' + '),
                  text:(r.no||'')+' '+(r.title||'')+(names.length?(' · '+names.join(', ')):'')+(r.done?'':' · ยังไม่ปิดงาน'), amt:-c, mj:(r.kind==='memo'?'':r.id) });
    });
  }catch(e){ D.err.push('maint'); }
  /* 3 · สถานะ + วันใช้ไม่ได้ */
  try{
    ((b&&b.log)||[]).forEach(function(l){ if(!l || !l.from || l.from<from || l.from>to) return;
      var nm=({available:'พร้อมใช้',fixing:'ซ่อม',unavailable:'ใช้ไม่ได้'})[l.s]||l.s||'';
      D.ev.push({ d:l.from, kind:'status', st:l.s, tag:nm, text:(l.to&&l.to!==l.from?('ถึง '+bhD(l.to)+' · '):'')+[l.loc,l.note,l.reason].filter(Boolean).join(' · ') }); });
    var t=bhToday(), end=(to<t)?to:t, d=from, guard=0;
    while(d<=end && guard++<800){
      var s='available'; try{ s=((typeof boatEffStatus==='function')?boatEffStatus(b,d):{}).s||'available'; }catch(e){}
      if(s!=='available'){ D.down[s]=(D.down[s]||0)+1; D.downN++; }
      d=bhNextDay(d);
    }
  }catch(e){ D.err.push('status'); }
  var ord={status:0,swap:1,maint:2,sail:3};
  D.ev.sort(function(a,z){ return a.d<z.d?1:(a.d>z.d?-1:(ord[a.kind]-ord[z.kind])); });
  D.net=D.profit-D.mTot;
  return D;
}
function bhCatName(k){ try{ if(typeof costCat==='function'){ var c=costCat(k); if(c&&c.t) return (k==='hull'?'ตัวเรือ':c.t); } }catch(e){} return k; }
function bhCatCol(k){ try{ if(typeof costCat==='function'){ var c=costCat(k); if(c&&c.c) return c.c; } }catch(e){} return '#9AA0A6'; }
var BH_GCOL=['#C2402F','#0F6E56','#E0B24B','#3B6DB4','#8B5CF6','#0891B2','#9AA1AD','#BE185D'];

function bhCss(){
  if(document.getElementById('bh-css')) return;
  var s=document.createElement('style'); s.id='bh-css';
  s.textContent=[
  '#bh-ov{position:fixed;inset:0;z-index:9800;background:rgba(20,26,40,.55);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:28px 18px}',
  '#bh-ov .bh{background:#fff;border-radius:16px;width:100%;max-width:1180px;color:#1B2333;font-size:13.5px;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}',
  '#bh-ov .bh-h{display:flex;align-items:flex-start;gap:12px;padding:18px 22px 14px;border-bottom:1px solid #E7E9EE;background:linear-gradient(to right,#FFF5EC,#FBEAF0 60%,#F5DDE6)}',
  '#bh-ov .bh-h h2{margin:0;font-size:22px;font-weight:800}#bh-ov .bh-h p{margin:3px 0 0;color:#6B7280;font-size:12.5px}',
  '#bh-ov .bh-x{margin-left:auto;border:0;background:#1B2333;color:#fff;border-radius:99px;width:32px;height:32px;font-size:16px;cursor:pointer;flex:none}',
  '#bh-ov .bh-b{padding:16px 22px 22px}',
  '#bh-ov .bh-per{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:14px}',
  '#bh-ov .bh-pb{padding:6px 13px;border:1px solid #E1E4EA;border-radius:99px;font-weight:600;font-size:12.5px;color:#374151;background:#fff;cursor:pointer;font-family:inherit}',
  '#bh-ov .bh-pb.on{background:#1B2333;color:#fff;border-color:#1B2333}',
  '#bh-ov .bh-per input{border:1px solid #E1E4EA;border-radius:8px;padding:5px 8px;font:inherit;font-size:12.5px}',
  '#bh-ov .bh-kp{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:18px}',
  '#bh-ov .bh-k{border:1px solid #E7E9EE;border-radius:11px;padding:10px 12px;min-width:0}',
  '#bh-ov .bh-k small{display:block;color:#6B7280;font-weight:600;font-size:11.5px}#bh-ov .bh-k b{font-size:19px;font-weight:800;white-space:nowrap}#bh-ov .bh-k span{display:block;font-size:11px;color:#6B7280;margin-top:2px}',
  '#bh-ov .bh-two{display:grid;grid-template-columns:1.05fr 1fr;gap:20px}',
  '#bh-ov h3{font-size:13.5px;margin:0 0 10px;font-weight:800}',
  '#bh-ov .bh-row{display:flex;align-items:center;gap:10px;padding:4px 0;font-size:12.5px;cursor:pointer}',
  '#bh-ov .bh-row>span:first-child{width:168px;color:#374151;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#bh-ov .bh-row>b{width:84px;text-align:right}',
  '#bh-ov .bh-bar{flex:1;height:9px;background:#F0F1F4;border-radius:9px;overflow:hidden}#bh-ov .bh-bar i{display:block;height:100%;border-radius:9px}',
  '#bh-ov .bh-sub{margin:0 0 6px 14px;padding:4px 10px;border-left:2px solid #E7E9EE;font-size:12px;color:#4B5563}#bh-ov .bh-sub div{display:flex;justify-content:space-between;padding:1px 0}',
  '#bh-ov table{border-collapse:collapse;width:100%;font-size:12.5px}',
  '#bh-ov th{font-size:10.5px;letter-spacing:.05em;color:#6B7280;text-align:right;padding:6px 7px;border-bottom:1px solid #E7E9EE;font-weight:700}',
  '#bh-ov td{padding:7px;border-bottom:1px solid #F2F3F6;text-align:right;font-weight:600;white-space:nowrap}#bh-ov th:first-child,#bh-ov td:first-child{text-align:left}',
  '#bh-ov tfoot td{font-weight:800;border-top:2px solid #E7E9EE;border-bottom:0}',
  '#bh-ov .g{color:#0F6E56}#bh-ov .r{color:#B42318}#bh-ov .mut{color:#9AA1AD}',
  '#bh-ov .bh-sec{margin-top:18px;border-top:1px solid #E7E9EE;padding-top:15px}',
  '#bh-ov .bh-stk{display:flex;height:14px;border-radius:9px;overflow:hidden;margin:2px 0 12px;background:#F0F1F4}#bh-ov .bh-stk i{display:block;height:100%}',
  '#bh-ov .bh-ct{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}',
  '#bh-ov .bh-ct .bh-k{cursor:pointer;border-top-width:4px}#bh-ov .bh-ct .bh-k.on{box-shadow:0 0 0 2px #1B2333}',
  '#bh-ov .bh-ct .u{margin-top:6px;font-size:11px;color:#374151;line-height:1.6}',
  '#bh-ov .bh-ev{display:grid;grid-template-columns:78px 132px minmax(0,1fr) 96px;gap:10px;padding:7px 0;border-bottom:1px solid #F2F3F6;align-items:center;font-size:12.5px}',
  '#bh-ov .bh-ev .d{color:#6B7280;font-weight:600}#bh-ov .bh-ev .c{text-align:right;font-weight:700}#bh-ov .bh-ev .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#bh-ov .bh-ev.lk{cursor:pointer}#bh-ov .bh-ev.lk:hover{background:#FAFBFC}',
  '#bh-ov .bh-pl{display:inline-block;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}',
  '#bh-ov .p1{background:#FDECEC;color:#A32D2D}#bh-ov .p2{background:#EFF0FC;color:#3730A3}#bh-ov .p3{background:#E7F5EC;color:#17663A}#bh-ov .p4{background:#FFF1C2;color:#8A5A00}#bh-ov .p5{background:#EEF2F7;color:#374151}',
  '#bh-ov .bh-note{margin-top:10px;font-size:11.5px;color:#6B7280;line-height:1.5}',
  '#bh-ov .bh-load{padding:70px 20px;text-align:center;color:#6B7280;font-weight:600}',
  '.bh-open{background:#fff;color:#9F1B4F;border:1px solid #F1C3D4;border-radius:20px;padding:7px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}',
  '.bh-open:hover{background:#FCE5EC}',
  '@media(max-width:900px){#bh-ov .bh-kp,#bh-ov .bh-ct{grid-template-columns:repeat(2,1fr)}#bh-ov .bh-two{grid-template-columns:1fr}#bh-ov .bh-ev{grid-template-columns:62px 96px minmax(0,1fr) 78px}#bh-ov .bh-ev .t{white-space:normal}}'
  ].join('\n');
  document.head.appendChild(s);
}
function bhBtn(id){ try{ bhCss(); }catch(e){} return '<button class="bh-open" onclick="event.stopPropagation();bhOpen(\''+bhEsc(id)+'\')" title="ทริป · รายได้ · ต้นทุน · ค่าซ่อมแยก ตัวเรือ/เครื่องยนต์/เกียร์/ใบจักร · เหตุการณ์ ของเรือลำนี้">&#128202; ประวัติ &amp; ค่าใช้จ่าย</button>'; }

function bhOpen(id){
  bhCss(); _bh.id=id; _bh.flt='key'; _bh.open={};
  var ov=document.getElementById('bh-ov');
  if(!ov){ ov=document.createElement('div'); ov.id='bh-ov'; ov.onclick=function(e){ if(e.target===ov) bhClose(); }; document.body.appendChild(ov); }
  bhLoad();
}
function bhClose(){ var ov=document.getElementById('bh-ov'); if(ov) ov.remove(); _bh.data=null; }
function bhLoad(){
  var ov=document.getElementById('bh-ov'); if(!ov) return;
  var b=(typeof getBoat==='function'&&getBoat(_bh.id))||{};
  ov.innerHTML='<div class="bh"><div class="bh-h"><div><h2>'+bhEsc(b.name||_bh.id)+'</h2><p>ประวัติ &amp; ค่าใช้จ่าย</p></div><button class="bh-x" onclick="bhClose()">&#10005;</button></div><div class="bh-load">กำลังคำนวณ…</div></div>';
  setTimeout(function(){ var r=bhRange(); try{ _bh.data=bhCompute(_bh.id, r[0], r[1]); }catch(e){ _bh.data=null; console.warn('boatHist', e); } bhRender(); }, 30);
}
function bhPer(p){ _bh.per=p; if(p==='custom'){ var r=bhRange(); _bh.from=_bh.from||r[0]; _bh.to=_bh.to||r[1]; } bhLoad(); }
function bhCust(k,v){ if(v){ _bh[k]=v; bhLoad(); } }
function bhFlt(f){ _bh.flt=(_bh.flt===f&&f!=='key')?'key':f; bhRender(); }
function bhTog(g){ _bh.open[g]=!_bh.open[g]; bhRender(); }
function bhGoMj(id){ try{ if(typeof flSelMaint!=='function') return; bhClose(); var nv=document.querySelector('[data-view=fl-maintenance]'); if(nv && typeof nav==='function') nav(nv); setTimeout(function(){ try{ flSelMaint(id); }catch(e){} },120); }catch(e){} }

function bhRender(){
  var ov=document.getElementById('bh-ov'); if(!ov) return;
  var D=_bh.data, e=bhEsc;
  if(!D){ ov.innerHTML='<div class="bh"><div class="bh-h"><div><h2>ประวัติ &amp; ค่าใช้จ่าย</h2></div><button class="bh-x" onclick="bhClose()">&#10005;</button></div><div class="bh-load">คำนวณไม่สำเร็จ · ลองปิดแล้วเปิดใหม่</div></div>'; return; }
  var b=D.boat, t=bhToday(), y=+t.slice(0,4), m=+t.slice(5,7), sy=(m>=10)?y:(y-1);
  var pier=({tublamu:'ท่าทับละมุ',panwa:'Visit Panwa',ranong:'ระนอง'})[b.pier]||b.pier||'';
  var per=function(k,l){ return '<button class="bh-pb'+(_bh.per===k?' on':'')+'" onclick="bhPer(\''+k+'\')">'+l+'</button>'; };
  var h='<div class="bh"><div class="bh-h"><div><h2>'+e(b.name||D.id)+'</h2><p>'+e([b.type, (b.cap?(b.cap+' ที่นั่ง'):''), pier].filter(Boolean).join(' · '))+' · ประวัติ &amp; ค่าใช้จ่าย '+bhDY(D.from)+' – '+bhDY(D.to)+'</p></div><button class="bh-x" onclick="bhClose()" title="ปิด">&#10005;</button></div><div class="bh-b">';
  h+='<div class="bh-per"><span class="mut" style="font-weight:600;margin-right:2px">ช่วงเวลา</span>'+per('month','เดือนนี้')+per('season','ซีซั่นนี้ (ต.ค. '+String(sy).slice(2)+' – วันนี้)')+per('year','ปีนี้')+per('custom','เลือกเอง')
    +(_bh.per==='custom'?(' <input type="date" value="'+e(D.from)+'" onchange="bhCust(\'from\',this.value)"> – <input type="date" value="'+e(D.to)+'" onchange="bhCust(\'to\',this.value)">'):'')
    +'<span style="flex:1"></span>'+((typeof XLSX!=='undefined')?'<button class="bh-pb" onclick="bhExport()">&#10515; Export Excel</button>':'')+'</div>';
  /* KPI */
  var dn=Object.keys(D.down).map(function(s){ return (({fixing:'ซ่อม',unavailable:'ใช้ไม่ได้'})[s]||s)+' '+D.down[s]; }).join(' · ');
  var nM=D.mRows.length;
  h+='<div class="bh-kp">'
    +'<div class="bh-k"><small>ออกเรือ</small><b>'+D.n+' เที่ยว</b><span>'+bhN(D.pax)+' คน'+(D.n?(' · เฉลี่ย '+(D.pax/D.n).toFixed(1)+'/เที่ยว'):'')+'</span></div>'
    +'<div class="bh-k"><small>รายได้ (ไม่รวม VAT)</small><b>'+bhB(D.rev)+'</b><span>'+(D.pax?(bhB(D.rev/D.pax)+' / คน'):'—')+'</span></div>'
    +'<div class="bh-k"><small>ต้นทุนทริป</small><b>'+bhB(D.cost)+'</b><span>'+(D.rev?(Math.round(D.cost/D.rev*100)+'% ของรายได้'):'—')+'</span></div>'
    +'<div class="bh-k"><small>ค่าซ่อมบำรุง</small><b class="'+(D.mTot?'r':'mut')+'">'+bhB(D.mTot)+'</b><span>'+nM+' รายการ'+(D.mProc?(' · ยังไม่ปิด '+bhB(D.mProc)):'')+'</span></div>'
    +'<div class="bh-k"><small>กำไรหลังหักซ่อม</small><b class="'+(D.net<0?'r':'g')+'">'+bhSg(D.net)+'</b><span>'+(D.rev?(Math.round(D.net/D.rev*100)+'% ของรายได้'):'—')+'</span></div>'
    +((b.ownership==='charter')
        ? '<div class="bh-k"><small>วันที่ใช้ไม่ได้</small><b class="mut">—</b><span>เรือเช่า · นับเฉพาะช่วงที่เช่าไม่ได้</span></div></div>'
        : ('<div class="bh-k"><small>วันที่ใช้ไม่ได้</small><b'+(D.downN?'':' class="mut"')+'>'+D.downN+' วัน</b><span>'+(dn||'พร้อมใช้ตลอดช่วง')+'</span></div></div>'));
  /* เงินไปอยู่ที่ไหน + รายเดือน */
  var GL=Object.keys(D.G).map(function(k){ return D.G[k]; }).sort(function(a,z){ return z.tot-a.tot; });
  if(D.mTot) GL.push({ g:'ซ่อมบำรุง (ใบงาน + memo)', tot:D.mTot, L:null, maint:true });
  GL.sort(function(a,z){ return z.tot-a.tot; });
  var mx=GL.length?GL[0].tot:0;
  h+='<div class="bh-two"><div><h3>เงินไปอยู่ที่ไหน</h3>'+(GL.length?GL.map(function(o,i){
      var op=!!_bh.open[o.g];
      var sub=(op&&o.L)?('<div class="bh-sub">'+Object.keys(o.L).sort(function(a,z){ return o.L[z]-o.L[a]; }).map(function(l){ return '<div><span>'+e(l)+'</span><span>'+bhB(o.L[l])+'</span></div>'; }).join('')+'</div>'):'';
      return '<div class="bh-row" onclick="'+(o.maint?'bhFlt(\'maint\')':('bhTog(\''+e(o.g).replace(/'/g,'')+'\')'))+'" title="'+(o.maint?'ดูรายการซ่อมด้านล่าง':'คลิกเพื่อดูรายการข้างใน')+'"><span>'+(o.L?(op?'&#9662; ':'&#9656; '):'')+e(o.g)+'</span><div class="bh-bar"><i style="width:'+(mx?Math.max(1,o.tot/mx*100):0)+'%;background:'+(o.maint?'#B42318':BH_GCOL[i%BH_GCOL.length])+'"></i></div><b>'+bhB(o.tot)+'</b></div>'+sub; }).join(''):'<div class="mut">ไม่มีทริปในช่วงนี้</div>')
    +'</div><div><h3>รายเดือน</h3>';
  var MK=Object.keys(D.months).sort();
  h+='<table><thead><tr><th>เดือน</th><th>เที่ยว</th><th>คน</th><th>รายได้</th><th>ต้นทุน</th><th>ซ่อม</th><th>กำไร</th></tr></thead><tbody>'
    +(MK.length?MK.map(function(k){ var M=D.months[k], p=M.rev-M.cost-M.maint;
        return '<tr><td>'+BH_MO[+k.slice(5,7)-1]+' '+k.slice(2,4)+'</td><td>'+M.n+'</td><td>'+bhN(M.pax)+'</td><td>'+bhN(M.rev)+'</td><td>'+bhN(M.cost)+'</td><td'+(M.maint?' class="r"':' class="mut"')+'>'+bhN(M.maint)+'</td><td class="'+(p<0?'r':'g')+'">'+bhSg(p)+'</td></tr>'; }).join(''):'<tr><td colspan="7" class="mut">ไม่มีข้อมูลในช่วงนี้</td></tr>')
    +'</tbody><tfoot><tr><td>รวม</td><td>'+D.n+'</td><td>'+bhN(D.pax)+'</td><td>'+bhN(D.rev)+'</td><td>'+bhN(D.cost)+'</td><td>'+bhN(D.mTot)+'</td><td class="'+(D.net<0?'r':'g')+'">'+bhSg(D.net)+'</td></tr></tfoot></table>'
    +'<div class="bh-note">ทริปมาจาก P&amp;L รายทริป (วันที่ยังไม่ปิดยอด = ตัวเลขประมาณ) · ค่าซ่อมมาจากใบงาน Maintenance + memo ที่ระบุเรือ ลงตามวันปิดงาน/วันเริ่ม · ต้นทุนทริปมี "ค่าเสื่อมเรือ" แต่ไม่มีค่าซ่อม จึงไม่นับซ้ำ</div></div></div>';
  /* ค่าซ่อมแยกส่วน */
  var CK=['hull','engine','gearbox','propeller','other','memo'];
  h+='<div class="bh-sec"><h3>ค่าซ่อมบำรุง '+bhB(D.mTot)+' · แยกตามส่วนของเรือ</h3><div class="bh-stk">'
    +CK.map(function(k){ var v=(D.mCat[k]||{}).tot||0; return (D.mTot&&v)?('<i style="width:'+(v/D.mTot*100)+'%;background:'+bhCatCol(k)+'" title="'+e(bhCatName(k))+' '+bhB(v)+'"></i>'):''; }).join('')+'</div><div class="bh-ct">'
    +CK.map(function(k){ var o=D.mCat[k]||{tot:0,n:0};
        var us=Object.keys(D.units).map(function(u){ return D.units[u]; }).filter(function(u){ return u.cat===k; }).sort(function(a,z){ return z.cost-a.cost; });
        return '<div class="bh-k'+(_bh.flt==='m:'+k?' on':'')+'" style="border-top-color:'+bhCatCol(k)+'" onclick="bhFlt(\'m:'+k+'\')" title="คลิกเพื่อดูรายการของส่วนนี้"><small>'+e(bhCatName(k))+'</small><b'+(o.tot?'':' class="mut"')+'>'+bhB(o.tot)+'</b><span>'+(o.n?(o.n+' รายการ'):'ไม่มีในช่วงนี้')+'</span>'
          +(us.length?('<div class="u">'+us.slice(0,6).map(function(u){ return e(u.label)+' '+bhB(u.cost); }).join('<br>')+'</div>'):'')+'</div>'; }).join('')
    +'</div><div class="bh-note">หมวดเดียวกับหน้า Fleet → Analytics · ใบงานที่แตะหลายส่วน เงินหารเท่ากันตามจำนวนชิ้น · แยกรายเครื่อง/เกียร์/ใบจักรเมื่อใบงานระบุชิ้นไว้ · "memo ตรง" = memo ที่ระบุเรือแต่ไม่ผูกใบงาน</div></div>';
  /* ไทม์ไลน์ */
  var F=_bh.flt, fb=function(k,l){ return '<button class="bh-pb'+(F===k?' on':'')+'" onclick="bhFlt(\''+k+'\')">'+l+'</button>'; };
  var EV=D.ev.filter(function(x){
    if(F==='all') return true; if(F==='key') return x.kind!=='sail';
    if(F==='maint') return x.kind==='maint'; if(F==='swap') return x.kind==='swap'; if(F==='status') return x.kind==='status'; if(F==='sail') return x.kind==='sail';
    if(F.indexOf('m:')===0) return x.kind==='maint' && (x.cats||[]).indexOf(F.slice(2))>=0;
    return true; });
  var cls=function(x){ return x.kind==='maint'?'p1':(x.kind==='swap'?'p2':(x.kind==='sail'?'p3':(x.st==='available'?'p5':'p4'))); };
  var LIM=200;
  h+='<div class="bh-sec"><h3>เกิดอะไรขึ้นบ้าง</h3><div class="bh-per" style="margin-bottom:8px">'+fb('key','เหตุการณ์สำคัญ')+fb('maint','ซ่อมทั้งหมด')
    +CK.slice(0,4).map(function(k){ return fb('m:'+k,'ซ่อม · '+bhCatName(k)); }).join('')+fb('swap','เปลี่ยนเรือกลางทาง')+fb('status','เปลี่ยนสถานะ')+fb('sail','ออกเรือ')+fb('all','ทั้งหมด')+'</div>'
    +(EV.length?EV.slice(0,LIM).map(function(x){
        var amt=(x.amt==null)?'<span class="mut">—</span>':('<span class="'+(x.amt<0?'r':'g')+'">'+(x.pl?bhSg(x.amt):('−'+bhN(Math.abs(x.amt))))+'</span>');
        return '<div class="bh-ev'+(x.mj?' lk':'')+'"'+(x.mj?(' onclick="bhGoMj(\''+e(x.mj)+'\')" title="เปิดใบงาน"'):'')+'><span class="d">'+bhD(x.d)+'</span><span><span class="bh-pl '+cls(x)+'">'+e(x.tag)+'</span></span><span class="t" title="'+e(x.text)+'">'+e(x.text)+'</span><span class="c">'+amt+'</span></div>'; }).join('')
      :'<div class="mut" style="padding:14px 0">ไม่มีรายการในช่วงนี้</div>')
    +(EV.length>LIM?('<div class="bh-note">แสดง '+LIM+' จาก '+EV.length+' รายการ · เลือกช่วงเวลาสั้นลงหรือ Export เพื่อดูทั้งหมด</div>'):'')
    +'<div class="bh-note">ตัวเลขท้ายแถว: ออกเรือ = กำไร/ขาดทุนของเที่ยว · ซ่อม = ค่าใช้จ่ายของใบงาน'+(D.err.length?(' · <span class="r">คำนวณบางส่วนไม่ได้: '+e(D.err.slice(0,4).join(', '))+'</span>'):'')+'</div></div>';
  h+='</div></div>';
  var sc=ov.scrollTop; ov.innerHTML=h; ov.scrollTop=sc;
}

function bhExport(){
  var D=_bh.data; if(!D || typeof XLSX==='undefined') return;
  try{
    var wb=XLSX.utils.book_new(), b=D.boat, add=function(n,a){ XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n); };
    var R=function(n){ return Math.round(n||0); };
    add('สรุป',[['เรือ',b.name||D.id],['ช่วง',D.from+' ถึง '+D.to],[],['ออกเรือ (เที่ยว)',D.n],['ผู้โดยสาร',D.pax],['รายได้ (ไม่รวม VAT)',R(D.rev)],['ต้นทุนทริป',R(D.cost)],['ค่าซ่อมบำรุง',R(D.mTot)],['กำไรหลังหักซ่อม',R(D.net)],['วันที่ใช้ไม่ได้',D.downN],[],['ค่าซ่อมแยกส่วน','บาท','รายการ']]
      .concat(['hull','engine','gearbox','propeller','other','memo'].map(function(k){ var o=D.mCat[k]||{tot:0,n:0}; return [bhCatName(k),R(o.tot),o.n]; }))
      .concat([[],['หมวดต้นทุนทริป','บาท']]).concat(Object.keys(D.G).map(function(k){ return [k,R(D.G[k].tot)]; })));
    add('รายเดือน',[['เดือน','เที่ยว','คน','รายได้','ต้นทุนทริป','ซ่อม','กำไร']].concat(Object.keys(D.months).sort().map(function(k){ var M=D.months[k]; return [k,M.n,M.pax,R(M.rev),R(M.cost),R(M.maint),R(M.rev-M.cost-M.maint)]; })));
    add('ทริป',[['วันที่','โปรแกรม','คน','FAM','รายได้','ต้นทุน','กำไร','เรือกู้']].concat(D.trips.map(function(x){ return [x.d,x.rn,x.pax,x.fam,R(x.rev),R(x.cost),R(x.profit),x.rescue?'ใช่':'']; })));
    add('ซ่อม',[['วันที่','เลขที่','รายการ','ส่วน','ชิ้น','บาท','สถานะ']].concat(D.mRows.map(function(x){ return [x.date,x.no,x.title,x.cats.map(bhCatName).join(' + '),x.units.join(', '),R(x.cost),x.done?'ปิดแล้ว':'ยังไม่ปิด']; })));
    add('เหตุการณ์',[['วันที่','ประเภท','รายละเอียด','บาท']].concat(D.ev.map(function(x){ return [x.d,x.tag,x.text,(x.amt==null?'':R(x.amt))]; })));
    XLSX.writeFile(wb, 'boat_history_'+String(b.name||D.id).replace(/[^\w฀-๿-]+/g,'_')+'_'+D.from+'_'+D.to+'.xlsx');
  }catch(e){ console.warn('boatHist export', e); if(typeof toast==='function') toast('Export ไม่สำเร็จ'); }
}
