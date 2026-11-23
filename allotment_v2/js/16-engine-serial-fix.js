/* ══ §engFix (2026-11-12) · เลขเครื่องที่ถูก "แก้ชื่อ" แทนการถอด/สลับ ═══════════════════════════════
   owner: "ต้องกลับไปแก้รหัสเดิม และต้องเปลี่ยนเป็นการถอดสลับแทน" → "ช่วยเราหน่อย เรางงมาก"
   ที่มา · เครื่องสองลูกถูกสลับตำแหน่งกันจริง แต่คนบันทึกกด Edit แก้ Serial ไขว้กัน (ก.ย.–พ.ย. 2026)
     เรคคอร์ด = ประวัติ + ชั่วโมง + ใบงาน · พอแก้แค่เลข ประวัติของเครื่อง A เลยไปติดเลขของเครื่อง B
     เคส Verona·Port: มีคนสร้างเรคคอร์ดใหม่ BBNJ-1010053 ที่ Romeo·Std (9 ต.ค.) แล้วแก้เรคคอร์ดเดิมเป็น BBNJ-8010033 → เลขซ้ำ

   สิ่งที่ปุ่มทำ ต่อ 1 คู่ (A,B) · ผู้ใช้กดเอง · เห็นก่อน/หลัง · ยกเลิกได้ (เครื่องเดียวกับที่กด)
     1 แก้ Serial ของ A,B กลับเป็นเลขเดิม
     2 สลับ ลำ/ตำแหน่ง/สถานะ/ที่เก็บ ระหว่าง A กับ B  → บนหน้าจอ "เลขไหนอยู่ตำแหน่งไหน" เหมือนเดิมทุกอย่าง
     3 เกียร์ที่ผูก A ↔ B สลับ engineId  → เกียร์อยู่ตำแหน่งเดิม
     4 ของที่เกิด "หลังวันแก้เลข" ย้ายข้ามเรคคอร์ดให้ตามเครื่องจริง:
        ใบงาน/ใบแจ้ง (ดูจากเลขที่พิมพ์ในใบ) · ประวัติเครื่อง · มิเตอร์ชั่วโมงใน Daily Fleet Log · รอบเซอร์วิสล่าสุด
     5 ลงประวัติ 'rename' + 'swap' ทั้งสองลูก
   ไม่มีอะไรรันเอง · ทำเฉพาะตอนข้อมูลยังเป็นค่าที่ผิดอยู่ (เทียบ id + เลขปัจจุบัน) · แก้แล้วคู่นั้นหายจากรายการ */
var FL_ENG_FIX=[
  {k:'alu1a', a:'e1',  aOrig:'BBNJ-1011996', b:'e4',  bOrig:'BBNJ-8010519', t:'Aluminous1 · Port ↔ Std'},
  {k:'alu1b', a:'e2',  aOrig:'BBNJ-1011995', b:'e3',  bOrig:'BBNJ-8010521', t:'Aluminous1 · C.Port ↔ C.Std'},
  {k:'zeus',  a:'e26', aOrig:'BBNJ-1000049', b:'e28', bOrig:'BBNJ-8000137', t:'Zeus · Port ↔ Std'},
  {k:'romver',a:'e17', aOrig:'BBNJ-1001137', b:'e19', bOrig:'BBNJ-8000285', t:'Romeo · Port ↔ Verona · Std'},
  /* คู่ Verona·Port ↔ Romeo·Std เดิม (ver53) ถูกแทนด้วย §engFix33 ด้านล่าง · owner ยืนยันว่า BBNJ-8010033 สองเรคคอร์ดคือเครื่องลูกเดียวกัน */
  /* Aluminous2 (e33 32501F-440231 ↔ e36 32501F-440247) ยังไม่ใส่ · ใบงาน พ.ค.–ส.ค. ใช้เลขสองตัวสลับไปมา หาวันแก้เลขจากใบงานไม่ได้ · รอผลแผ่นป้าย */
];
function _efK(s){ return String(s||'').toUpperCase().replace(/[\s\-]/g,''); }
function _efE(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function _efWhere(e){ var b=e.boatId?((typeof getBoat==='function'&&getBoat(e.boatId))||{}).name:''; return (b||('ไม่ติดเรือ'+(e.spareLocation?(' · '+((typeof flParseSpareLoc==='function')?flParseSpareLoc(e.spareLocation).label:e.spareLocation)):'')))+' · '+((typeof flPosLabel==='function')?flPosLabel(e.pos):(e.pos||'')); }
function _efCanEdit(){ try{ return !(typeof window.laIsAdmin==='function') || !!window.laIsAdmin(); }catch(_){ return true; } }
/* คู่ที่ยังต้องแก้ · ข้อมูลต้องยังอยู่ในสภาพที่ถูกแก้ชื่อ */
function flEngFixPending(){
  var sp=(typeof flEngFix33Ok==='function' && flEngFix33Ok())?[FL_ENG_FIX33]:[];
  return sp.concat(FL_ENG_FIX.filter(function(P){
    var A=flGetEng(P.a), B=flGetEng(P.b); if(!A||!B) return false;
    var aNow=P.aNow||P.bOrig, bNow=P.bNow||P.aOrig;
    return _efK(A.serial)===_efK(aNow) && _efK(B.serial)===_efK(bNow);
  }));
}
/* ใบงาน/ใบแจ้งที่อ้างเครื่อง · พร้อมเลขที่พิมพ์ในใบ */
function _efRefs(id){
  var out=[];
  (FL_MAINT||[]).forEach(function(m){ (m.assets||[]).forEach(function(a,i){ if(a && a.type==='engine' && a.engId===id) out.push({kind:'mj', rec:m, i:i, a:a, date:m.startDate||'', no:m.no||''}); }); });
  (FL_INCIDENTS||[]).forEach(function(x){ (x.damagedAssets||[]).forEach(function(a,i){ if(a && a.type==='engine' && a.id===id) out.push({kind:'inc', rec:x, i:i, a:a, date:x.date||'', no:x.no||''}); }); });
  return out;
}
function _efLabelSn(a){ var l=String((a&&a.label)||''); if(!l || l==='undefined') return ''; return _efK(l.split(' · ')[0]); }
/* แผนของคู่หนึ่ง · ไม่แตะข้อมูล */
function flEngFixPlan(P, bOrigIn){
  var A=flGetEng(P.a), B=flGetEng(P.b), bOrig=P.bOrig||bOrigIn||'';
  var ra=_efRefs(P.a), rb=_efRefs(P.b);
  var mvA=ra.filter(function(r){ var s=_efLabelSn(r.a); return s && s!==_efK(P.aOrig); });           /* อยู่ที่ A แต่เป็นของเครื่องอีกลูก → ไป B */
  var mvB=rb.filter(function(r){ var s=_efLabelSn(r.a); return s && (!bOrig || s!==_efK(bOrig)); });
  if(P.bOrig===null) mvB=rb.filter(function(r){ var s=_efLabelSn(r.a); return s && s===_efK(P.aOrig); });   /* เรคคอร์ดที่สร้างใหม่ · ย้ายเฉพาะใบที่พิมพ์เลขของ A */
  var cut=''; mvA.concat(mvB).forEach(function(r){ if(r.date && (!cut || r.date<cut)) cut=r.date; });
  if(!cut) cut=(typeof TODAY_STR!=='undefined')?TODAY_STR:'';
  var daily=0;
  Object.keys(FL_DAILY||{}).forEach(function(ds){ if(ds<cut) return; var d=FL_DAILY[ds]||{};
    Object.keys(d).forEach(function(bid){ var tr=(d[bid]||{}).trips||{}; Object.keys(tr).forEach(function(tk){ var en=(tr[tk]||{}).engines; if(en && (en[P.a]!=null || en[P.b]!=null)) daily++; }); }); });
  var lg=function(e){ return (e.log||[]).filter(function(l){ return (l.date||'')>=cut; }).length; };
  return {A:A, B:B, bOrig:bOrig, cut:cut, mvA:mvA, mvB:mvB, keepA:ra.length-mvA.length, keepB:rb.length-mvB.length, daily:daily, logA:lg(A), logB:lg(B)};
}
function flEngFixApply(k){
  if(!_efCanEdit()){ alert('เฉพาะ admin แก้ได้'); return; }
  var P=FL_ENG_FIX.filter(function(x){ return x.k===k; })[0]; if(!P) return;
  if(!flEngFixPending().some(function(x){ return x.k===k; })){ alert('คู่นี้ถูกแก้ไปแล้ว หรือข้อมูลเปลี่ยนไปจากที่ตรวจไว้ · ไม่ได้ทำอะไร'); flEngFixOpen(); return; }
  var bOrig=P.bOrig;
  if(!bOrig){
    var inp=document.getElementById('ef-ask-'+k); bOrig=String((inp&&inp.value)||'').trim();
    if(!bOrig){ alert('กรอก'+P.ask+' ก่อน'); if(inp) inp.focus(); return; }
    var dup=(FL_ENGINES||[]).find(function(x){ return x.id!==P.a && x.id!==P.b && _efK(x.serial)===_efK(bOrig); });
    if(_efK(bOrig)===_efK(P.aOrig) || dup){ alert('เลข '+bOrig+' มีอยู่ในระบบแล้ว'+(dup?(' ('+_efWhere(dup)+')'):'')+' · ตรวจแผ่นป้ายอีกครั้ง'); return; }
  }
  var pl=flEngFixPlan(P,bOrig), A=pl.A, B=pl.B, cut=pl.cut, today=(typeof TODAY_STR!=='undefined')?TODAY_STR:'';
  if(P.warn && !confirm(P.t+'\n\n'+P.warn+'\n\nดูแผ่นป้ายแล้ว ยืนยันแก้คู่นี้?')) return;
  if(!confirm('แก้คู่ '+P.t+'\n\n'
    +'• '+A.serial+' → เลขเดิม '+P.aOrig+' แล้วย้ายไป '+_efWhere(B)+'\n'
    +'• '+B.serial+' → '+(P.bOrig?'เลขเดิม ':'เลขแผ่นป้าย ')+bOrig+' แล้วย้ายไป '+_efWhere(A)+'\n\n'
    +'ใบงาน/ใบแจ้งหลัง '+cut+' ย้ายตามเครื่อง '+(pl.mvA.length+pl.mvB.length)+' ใบ · มิเตอร์รายวัน '+pl.daily+' ช่อง\n\nยืนยัน?')) return;

  /* สำรองไว้ยกเลิก */
  var undo={k:k, at:new Date().toISOString(), A:JSON.parse(JSON.stringify(A)), B:JSON.parse(JSON.stringify(B)), refs:[], gb:[], daily:[]};
  /* 4a · ใบงาน/ใบแจ้ง */
  var move=function(r,to){ var f=(r.kind==='mj')?'engId':'id'; undo.refs.push({kind:r.kind, id:r.rec.id, i:r.i, f:f, was:r.a[f]}); r.a[f]=to; };
  pl.mvA.forEach(function(r){ move(r,P.b); }); pl.mvB.forEach(function(r){ move(r,P.a); });
  /* 4b · มิเตอร์รายวัน ตั้งแต่วันแก้เลข */
  Object.keys(FL_DAILY||{}).forEach(function(ds){ if(ds<cut) return; var d=FL_DAILY[ds]||{};
    Object.keys(d).forEach(function(bid){ var tr=(d[bid]||{}).trips||{}; Object.keys(tr).forEach(function(tk){ var en=(tr[tk]||{}).engines; if(!en) return;
      var hasA=(P.a in en), hasB=(P.b in en); if(!hasA && !hasB) return;
      var va=en[P.a], vb=en[P.b]; undo.daily.push({ds:ds,bid:bid,tk:tk,hasA:hasA,hasB:hasB,va:va,vb:vb});
      delete en[P.a]; delete en[P.b]; if(hasA) en[P.b]=va; if(hasB) en[P.a]=vb; }); }); });
  /* 4c · ประวัติเครื่องตั้งแต่วันแก้เลข */
  var la=(A.log||[]), lb=(B.log||[]);
  var aOld=la.filter(function(l){ return (l.date||'')<cut; }), aNew=la.filter(function(l){ return (l.date||'')>=cut; });
  var bOld=lb.filter(function(l){ return (l.date||'')<cut; }), bNew=lb.filter(function(l){ return (l.date||'')>=cut; });
  A.log=aOld.concat(bNew); B.log=bOld.concat(aNew);
  /* 4d · รอบเซอร์วิสล่าสุด · อันที่บันทึกหลังวันแก้เลขเป็นของเครื่องอีกลูก */
  var sa={h:A.lastServiceHours,d:A.lastServiceDate}, sb={h:B.lastServiceHours,d:B.lastServiceDate};
  if((sa.d||'')>=cut && (sb.d||'')>=cut){ A.lastServiceHours=sb.h; A.lastServiceDate=sb.d; B.lastServiceHours=sa.h; B.lastServiceDate=sa.d; }
  else if((sa.d||'')>=cut){ B.lastServiceHours=sa.h; B.lastServiceDate=sa.d; }
  else if((sb.d||'')>=cut){ A.lastServiceHours=sb.h; A.lastServiceDate=sb.d; }
  /* 3 · เกียร์อยู่ตำแหน่งเดิม */
  (FL_GEARBOXES||[]).forEach(function(g){ if(!g) return;
    if(g.engineId===P.a){ undo.gb.push({id:g.id,was:P.a}); g.engineId=P.b; }
    else if(g.engineId===P.b){ undo.gb.push({id:g.id,was:P.b}); g.engineId=P.a; } });
  /* 1+2 · เลขเดิม + สลับตำแหน่ง */
  var wasA=A.serial, wasB=B.serial, whereA=_efWhere(A), whereB=_efWhere(B);
  var pos=['boatId','pos','status','spareLocation'], tA={}, tB={};
  pos.forEach(function(f){ tA[f]=A[f]; tB[f]=B[f]; });
  pos.forEach(function(f){ A[f]=tB[f]; B[f]=tA[f]; });
  A.serial=P.aOrig; B.serial=bOrig;
  var by=(typeof laBy==='function')?laBy():'';
  A.log.push({date:today, type:'rename', by:by, desc:'แก้เลขกลับเป็นเลขเดิม '+wasA+' → '+P.aOrig+' · เลขถูกแก้แทนการถอด/สลับ (ราว '+cut+')'});
  A.log.push({date:cut,   type:'swap',   by:by, desc:'สลับ → '+whereB+' (กับ '+bOrig+') · บันทึกย้อนหลังแทนการแก้เลข'});
  B.log.push({date:today, type:'rename', by:by, desc:(P.bOrig?'แก้เลขกลับเป็นเลขเดิม ':'ใส่เลขตามแผ่นป้าย ')+wasB+' → '+bOrig+' · เลขถูกแก้แทนการถอด/สลับ (ราว '+cut+')'});
  B.log.push({date:cut,   type:'swap',   by:by, desc:'สลับ → '+whereA+' (กับ '+P.aOrig+') · บันทึกย้อนหลังแทนการแก้เลข'});
  if(typeof flGbBoatHeal==='function') try{ flGbBoatHeal([P.a,P.b]); }catch(_){ }
  try{ var U=JSON.parse(localStorage.getItem('la_engfix_undo')||'{}'); U[k]=undo; localStorage.setItem('la_engfix_undo', JSON.stringify(U)); }catch(_){ }
  if(typeof flSave==='function') flSave();
  flEngFixOpen();
  if(typeof flRenderAsset==='function') try{ flRenderAsset(); }catch(_){ }
}
function flEngFixUndo(k){
  if(!_efCanEdit()) return;
  var U={}; try{ U=JSON.parse(localStorage.getItem('la_engfix_undo')||'{}'); }catch(_){ }
  if(k==='ver33') return flEngFix33Undo();
  var u=U[k], P=FL_ENG_FIX.filter(function(x){ return x.k===k; })[0]; if(!u||!P){ alert('ไม่มีข้อมูลสำรองของคู่นี้ในเครื่องนี้'); return; }
  if(!confirm('ยกเลิกการแก้คู่ '+P.t+' · คืนข้อมูลกลับเป็นก่อนกดแก้?\n\n(สิ่งที่บันทึกเพิ่มกับสองลูกนี้หลังกดแก้ จะหายไปด้วย)')) return;
  var put=function(id,snap){ var i=(FL_ENGINES||[]).findIndex(function(x){ return x.id===id; }); if(i>=0) FL_ENGINES[i]=snap; };
  put(P.a,u.A); put(P.b,u.B);
  (u.refs||[]).forEach(function(r){ var L=(r.kind==='mj')?FL_MAINT:FL_INCIDENTS, rec=(L||[]).find(function(x){ return x.id===r.id; }); if(!rec) return;
    var arr=(r.kind==='mj')?rec.assets:rec.damagedAssets; if(arr && arr[r.i]) arr[r.i][r.f]=r.was; });
  (u.gb||[]).forEach(function(g){ var o=(FL_GEARBOXES||[]).find(function(x){ return x.id===g.id; }); if(o) o.engineId=g.was; });
  (u.daily||[]).forEach(function(c){ var en=((((FL_DAILY[c.ds]||{})[c.bid]||{}).trips||{})[c.tk]||{}).engines; if(!en) return;
    delete en[P.a]; delete en[P.b]; if(c.hasA) en[P.a]=c.va; if(c.hasB) en[P.b]=c.vb; });
  if(typeof flGbBoatHeal==='function') try{ flGbBoatHeal([P.a,P.b]); }catch(_){ }
  delete U[k]; try{ localStorage.setItem('la_engfix_undo', JSON.stringify(U)); }catch(_){ }
  if(typeof flSave==='function') flSave();
  flEngFixOpen();
  if(typeof flRenderAsset==='function') try{ flRenderAsset(); }catch(_){ }
}
function flEngFixClose(){ var m=document.getElementById('ef-modal'); if(m) m.remove(); }
function flEngFixOpen(){
  flEngFixClose();
  var pend=flEngFixPending(), U={}; try{ U=JSON.parse(localStorage.getItem('la_engfix_undo')||'{}'); }catch(_){ }
  var done=FL_ENG_FIX.concat([FL_ENG_FIX33]).filter(function(P){ return U[P.k] && !pend.some(function(x){ return x.k===P.k; }); });
  var e=_efE, ro=!_efCanEdit();
  var card=function(P){
    var pl=flEngFixPlan(P), A=pl.A, B=pl.B;
    var row=function(E,orig,toE,mv,keep){
      return '<tr><td><b class="sn">'+e(E.serial)+'</b><span>'+e(_efWhere(E))+'</span></td><td class="ar">&rarr;</td>'
        +'<td><b class="sn ok">'+(orig?e(orig):'<i>เลขจากแผ่นป้าย</i>')+'</b><span>'+e(_efWhere(toE))+'</span></td>'
        +'<td class="n">'+keep+' ใบอยู่กับลูกนี้ · '+mv+' ใบย้ายไปอีกลูก</td></tr>'; };
    return '<div class="ef-card"><div class="ef-h"><b>'+e(P.t)+'</b><span>เลขถูกแก้ราว '+e(pl.cut)+'</span></div>'
      +(P.warn?('<div class="ef-w">&#9888; '+e(P.warn)+'</div>'):'')
      +'<table><tr><th>ตอนนี้</th><th></th><th>หลังแก้ (เรคคอร์ดเดิม ประวัติเดิม)</th><th>ใบงาน/ใบแจ้ง</th></tr>'
      +row(A,P.aOrig,B,pl.mvA.length,pl.keepA)+row(B,P.bOrig,A,pl.mvB.length,pl.keepB)+'</table>'
      +'<div class="ef-f"><span>บนหน้าจอ เลขไหนอยู่ตำแหน่งไหนจะเหมือนเดิม · ที่เปลี่ยนคือประวัติ ชั่วโมง ('+pl.daily+' ช่องมิเตอร์) และใบงานจะตามเครื่องถูกลูก · เกียร์อยู่ตำแหน่งเดิม</span>'
      +(P.ask?('<input id="ef-ask-'+P.k+'" placeholder="'+e(P.ask)+'" '+(ro?'disabled':'')+'>'):'')
      +(ro?'':'<button class="go" onclick="flEngFixApply(\''+P.k+'\')">แก้คู่นี้</button>')+'</div></div>';
  };
  var h='<div class="ef-box"><div class="ef-top"><div><b>เลขเครื่องที่ถูกแก้ชื่อ</b><span>แก้เลขกลับเป็นเลขเดิม แล้วบันทึกเป็นการถอด/สลับ · ทำทีละคู่ · ยกเลิกได้จากเครื่องนี้</span></div><button onclick="flEngFixClose()">&#10005;</button></div><div class="ef-body">'
    +(pend.length?pend.map(function(P){ return P.k==='ver33'?flEngFix33Card(ro):card(P); }).join(''):'<div class="ef-empty">&#10003; ไม่มีคู่ที่ต้องแก้แล้ว</div>')
    +(done.length?('<div class="ef-done"><b>แก้แล้ว</b>'+done.map(function(P){ return '<div><span>&#10003; '+e(P.t)+' · '+e(String(U[P.k].at||'').slice(0,16).replace('T',' '))+'</span>'+(ro?'':'<button onclick="flEngFixUndo(\''+P.k+'\')">ยกเลิกการแก้</button>')+'</div>'; }).join('')+'</div>'):'')
    +'</div></div>';
  var m=document.createElement('div'); m.id='ef-modal'; m.innerHTML='<style>'
    +'#ef-modal{position:fixed;inset:0;z-index:9000;background:rgba(15,27,61,.45);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}'
    +'#ef-modal .ef-box{background:#F4F6FA;border-radius:16px;max-width:980px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;color:#16223F;font-size:13px}'
    +'#ef-modal .ef-top{display:flex;justify-content:space-between;gap:12px;padding:16px 20px;background:#fff;border-bottom:1px solid #E1E6EF}#ef-modal .ef-top b{font-size:17px;display:block}#ef-modal .ef-top span{color:#6B7591;font-size:12px}#ef-modal .ef-top button{border:0;background:transparent;font-size:16px;cursor:pointer;color:#6B7591}'
    +'#ef-modal .ef-body{padding:16px 20px;display:flex;flex-direction:column;gap:12px}'
    +'#ef-modal .ef-card{background:#fff;border:1px solid #E1E6EF;border-radius:12px;overflow:hidden}'
    +'#ef-modal .ef-h{display:flex;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid #EEF1F6}#ef-modal .ef-h b{font-size:14px}#ef-modal .ef-h span{color:#6B7591;font-size:11.5px}'
    +'#ef-modal .ef-w{background:#FDF1DD;color:#9A5B00;padding:8px 14px;font-weight:600;font-size:12px}'
    +'#ef-modal table{width:100%;border-collapse:collapse}#ef-modal th{font-size:10.5px;text-align:left;color:#6B7591;padding:6px 14px;background:#F8FAFC;font-weight:700}#ef-modal td{padding:8px 14px;border-top:1px solid #EEF1F6;vertical-align:top}'
    +'#ef-modal td .sn{display:block;font-family:"DM Mono",ui-monospace,monospace;font-size:13px}#ef-modal td .sn.ok{color:#0E7C6B}#ef-modal td span{font-size:11.5px;color:#6B7591}#ef-modal td.ar{color:#9AA3B8;font-size:16px;width:20px}#ef-modal td.n{font-size:11.5px;color:#4B5675}'
    +'#ef-modal .ef-f{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#F8FAFC;border-top:1px solid #EEF1F6}#ef-modal .ef-f span{flex:1;min-width:240px;font-size:11.5px;color:#6B7591;line-height:1.45}'
    +'#ef-modal .ef-f input{border:1px solid #D5DBE7;border-radius:8px;padding:7px 10px;font:600 12.5px inherit;font-family:inherit;min-width:300px}'
    +'#ef-modal .go{border:0;background:#16265C;color:#fff;border-radius:9px;padding:8px 16px;font:700 12.5px inherit;font-family:inherit;cursor:pointer}'
    +'#ef-modal .ef-empty{background:#fff;border-radius:12px;padding:26px;text-align:center;color:#0E7C6B;font-weight:700}'
    +'#ef-modal .ef-done{background:#fff;border:1px solid #E1E6EF;border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;gap:6px}#ef-modal .ef-done div{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12px;color:#0E7C6B}#ef-modal .ef-done button{border:1px solid #F1C4C1;background:#fff;color:#B42B26;border-radius:8px;padding:4px 10px;font:600 11.5px inherit;font-family:inherit;cursor:pointer}'
    +'</style>'+h;
  m.addEventListener('click',function(ev){ if(ev.target===m) flEngFixClose(); });
  document.body.appendChild(m);
}

/* ══ §engFix33 (2026-11-12) · BBNJ-8010033 สองเรคคอร์ด = เครื่องลูกเดียวกัน ═══════════════════════
   owner: "มันควรเป็นลูกเดียวกัน" · "ไม่ได้ย้ายตั้งแต่ต้น User ไปกดเปลี่ยนชื่อเอง" · Artemis·Port เป็น 8010303 · ที่คลัง Tub Lamu ไม่มีเครื่องลูกนี้
   ของจริง · ราว 10 ต.ค. เครื่อง 8010033 ออกจาก Artemis·Port ไปติด Verona·Port · Artemis·Port ใส่ 8010303 (ซ่อมเสร็จ MJ-023)
             เครื่อง 1010053 (เดิม Verona·Port) ไปอยู่ Romeo·Std
   ในระบบ · ไม่มีใครกดถอด/สลับ · เรคคอร์ด Verona·Port (e22) ถูกแก้เลข 1010053 → 8010033 · สร้างเรคคอร์ดใหม่ 1010053 ที่ Romeo·Std
            เรคคอร์ดจริงของ 8010033 (e20) ค้างที่ Artemis จน 7 พ.ย. แล้วถูกถอดไป "คลัง Tub Lamu" (ไม่มีเครื่องจริง)
   หลักฐานวัน · ใบงาน Verona ใบแรกที่พิมพ์ 8010033 = MJ-125 "เปลี่ยนอะไหล่ก่อนใช้งาน" 10 ต.ค. · MJ-148 (16 ต.ค. Artemis) เขียนลูกซ้ายเป็น 8010303
   ปุ่มทำ 3 อย่าง (ตัดที่ 10 ต.ค.):
     1 e20 (8010033 ตัวจริง ประวัติ 5,2xx ชม.) → ย้ายไป Verona·Port · รับใบงาน/ประวัติ/มิเตอร์ ของ e22 ตั้งแต่ 10 ต.ค. · ปรับชั่วโมงให้ต่อเนื่อง
     2 ของบน Artemis ที่ค้างอยู่กับ e20 ตั้งแต่ 10 ต.ค. → ย้ายให้ e5 (8010303)
     3 e22 → คืนเลข 1010053 · ย้ายไป Romeo·Std · รวมทุกอย่างของเรคคอร์ดที่สร้างใหม่ แล้วลบเรคคอร์ดใหม่ทิ้ง
   ผู้ใช้กดเอง · admin · ยกเลิกได้จากเครื่องที่กด */
var FL_ENG_FIX33={k:'ver33', t:'BBNJ-8010033 สองเรคคอร์ด = ลูกเดียวกัน (Verona · Port) + คืน BBNJ-1010053 ให้ Romeo · Std', cut:'2026-10-10',
  real:'e20', ver:'e22', dup:'emv0s57otfxl0e', art:'e5'};
function flEngFix33Ok(){
  var F=FL_ENG_FIX33, K=flGetEng(F.real), V=flGetEng(F.ver), N=flGetEng(F.dup), A=flGetEng(F.art);
  return !!(K&&V&&N&&A && _efK(K.serial)==='BBNJ8010033' && _efK(V.serial)==='BBNJ8010033' && _efK(N.serial)==='BBNJ1010053' && !K.boatId);
}
function _ef33Daily(id, fromCut){   /* [{ds,bid,tk,v}] เรียงตามวัน */
  var out=[], cut=FL_ENG_FIX33.cut;
  Object.keys(FL_DAILY||{}).forEach(function(ds){ if(fromCut===true && ds<cut) return; if(fromCut===false && ds>=cut) return; var d=FL_DAILY[ds]||{};
    Object.keys(d).forEach(function(bid){ var tr=(d[bid]||{}).trips||{}; Object.keys(tr).forEach(function(tk){ var en=(tr[tk]||{}).engines; if(en && (id in en)) out.push({ds:ds,bid:bid,tk:tk,v:en[id]}); }); }); });
  return out.sort(function(a,b){ return a.ds<b.ds?-1:(a.ds>b.ds?1:0); });
}
function flEngFix33Plan(){
  var F=FL_ENG_FIX33, cut=F.cut, K=flGetEng(F.real), V=flGetEng(F.ver), N=flGetEng(F.dup), A=flGetEng(F.art);
  var after=function(r){ return (r.date||'')>=cut; };
  var kArt=_efRefs(F.real).filter(after);                                                   /* งานบน Artemis หลังตัด → e5 */
  var vNew=_efRefs(F.ver).filter(function(r){ return after(r) && _efLabelSn(r.a)!=='BBNJ1010053'; });   /* งานบน Verona หลังตัด → e20 */
  var nAll=_efRefs(F.dup);                                                                  /* งานของเรคคอร์ดใหม่ → e22 */
  var pre=_ef33Daily(F.real,false).filter(function(x){ return +x.v>0; }), post=_ef33Daily(F.ver,true).filter(function(x){ return +x.v>0; });
  var base=+K.baseHours||0, hCut=pre.length?(base+(+pre[pre.length-1].v-(+pre[0].v))):base;
  var newBase=(pre.length&&post.length)?+(hCut-(+post[0].v-(+pre[0].v))).toFixed(1):base;
  var hNow=post.length?+(hCut+(+post[post.length-1].v-(+post[0].v))).toFixed(1):+hCut.toFixed(1);
  return {K:K,V:V,N:N,A:A,cut:cut,kArt:kArt,vNew:vNew,nAll:nAll,pre:pre,post:post,hCut:+hCut.toFixed(1),newBase:newBase,hNow:hNow,
    kDaily:_ef33Daily(F.real,true), nDaily:_ef33Daily(F.dup,null)};
}
function flEngFix33Card(ro){
  var p=flEngFix33Plan(), e=_efE, F=FL_ENG_FIX33;
  var li=function(t){ return '<tr><td colspan="4" style="line-height:1.55">'+t+'</td></tr>'; };
  return '<div class="ef-card"><div class="ef-h"><b>'+e(F.t)+'</b><span>ตัดที่ '+e(p.cut)+' (ใบงาน MJ-125 ของ Verona)</span></div>'
    +'<table><tr><th colspan="4">สิ่งที่จะเกิดขึ้น</th></tr>'
    +li('<b>1 · BBNJ-8010033 เหลือเรคคอร์ดเดียวที่ Verona · Port</b><br><span>เรคคอร์ด "'+e(_efWhere(p.K))+'" (ประวัติเดิม) ย้ายไป Verona · Port · รับงานบน Verona ตั้งแต่ '+e(p.cut)+' จำนวน '+p.vNew.length+' ใบ และมิเตอร์ '+p.post.length+' วัน · ชั่วโมงสะสมจะเป็นราว <b>'+p.hNow.toLocaleString()+' ชม.</b> (ตอนถอดจาก Artemis '+p.hCut.toLocaleString()+' + ที่วิ่งบน Verona)</span>')
    +li('<b>2 · งานบน Artemis ตั้งแต่ '+e(p.cut)+' ย้ายให้ '+e(p.A.serial)+' (Artemis · Port)</b><br><span>'+p.kArt.length+' ใบ ที่ค้างอยู่กับเรคคอร์ด 8010033 · มิเตอร์ Artemis ช่วงเดียวกัน '+p.kDaily.length+' ช่อง ('+e(p.A.serial)+' มีของตัวเองอยู่แล้ว)</span>')
    +li('<b>3 · BBNJ-1010053 เหลือเรคคอร์ดเดียวที่ Romeo · Std</b><br><span>เรคคอร์ด Verona · Port เดิมคืนเลขเป็น BBNJ-1010053 แล้วย้ายไป Romeo · Std · รวมงาน '+p.nAll.length+' ใบและมิเตอร์ '+p.nDaily.length+' ช่องของเรคคอร์ดที่สร้างใหม่ 9 ต.ค. · แล้วลบเรคคอร์ดที่สร้างใหม่</span>')
    +'</table><div class="ef-f"><span>เกียร์และใบจักรอยู่ตำแหน่งเดิม · "คลัง Tub Lamu" จะไม่มีเครื่องลูกนี้อีก · เลขซ้ำหาย</span>'
    +(ro?'':'<button class="go" onclick="flEngFix33Apply()">แก้ชุดนี้</button>')+'</div></div>';
}
function flEngFix33Apply(){
  if(!_efCanEdit()){ alert('เฉพาะ admin แก้ได้'); return; }
  if(!flEngFix33Ok()){ alert('ข้อมูลเปลี่ยนไปจากที่ตรวจไว้ · ไม่ได้ทำอะไร'); flEngFixOpen(); return; }
  var F=FL_ENG_FIX33, p=flEngFix33Plan(), K=p.K, V=p.V, N=p.N, A=p.A, cut=p.cut, today=(typeof TODAY_STR!=='undefined')?TODAY_STR:'';
  if(!confirm('แก้ชุด BBNJ-8010033 / BBNJ-1010053\n\n'
    +'1) 8010033 เหลือลูกเดียวที่ Verona · Port · ชั่วโมงราว '+p.hNow.toLocaleString()+'\n'
    +'2) งานบน Artemis ตั้งแต่ '+cut+' ('+p.kArt.length+' ใบ) ย้ายให้ '+A.serial+'\n'
    +'3) 1010053 เหลือลูกเดียวที่ Romeo · Std · ลบเรคคอร์ดที่สร้างใหม่\n\nยืนยัน?')) return;
  var undo={k:'ver33', special:1, at:new Date().toISOString(), engs:[K,V,N,A].map(function(x){ return JSON.parse(JSON.stringify(x)); }), dupIdx:(FL_ENGINES||[]).indexOf(N), refs:[], gb:[], daily:[]};
  var mv=function(r,to){ var f=(r.kind==='mj')?'engId':'id'; undo.refs.push({kind:r.kind,id:r.rec.id,i:r.i,f:f,was:r.a[f]}); r.a[f]=to; };
  var cell=function(c){ return ((((FL_DAILY[c.ds]||{})[c.bid]||{}).trips||{})[c.tk]||{}).engines; };
  var dmove=function(c,from,to){ var en=cell(c); if(!en) return; undo.daily.push({ds:c.ds,bid:c.bid,tk:c.tk,from:from,to:to,v:en[from],hadTo:(to in en),toV:en[to]}); if(to && !(to in en)) en[to]=en[from]; delete en[from]; };
  /* 2 · Artemis หลังตัด: e20 → e5 */
  p.kArt.forEach(function(r){ mv(r,F.art); });
  p.kDaily.forEach(function(c){ dmove(c,F.real,F.art); });
  var kl=(K.log||[]), kOld=kl.filter(function(l){ return (l.date||'')<cut || l.type==='remove'; }), kNew=kl.filter(function(l){ return (l.date||'')>=cut && l.type!=='remove'; });
  /* 1 · Verona หลังตัด: e22 → e20 */
  p.vNew.forEach(function(r){ mv(r,F.real); });
  _ef33Daily(F.ver,true).forEach(function(c){ dmove(c,F.ver,F.real); });
  var vl=(V.log||[]), vOld=vl.filter(function(l){ return (l.date||'')<cut; }), vNew=vl.filter(function(l){ return (l.date||'')>=cut; });
  var by=(typeof laBy==='function')?laBy():'';
  var kWas=_efWhere(K), vSvc={h:V.lastServiceHours,d:V.lastServiceDate}, vPos={boatId:V.boatId,pos:V.pos,status:V.status};
  A.log=(A.log||[]).concat(kNew);
  A.log.push({date:today,type:'note',by:by,desc:'รับใบงาน/ประวัติบน Artemis ตั้งแต่ '+cut+' ที่เคยบันทึกไว้กับเรคคอร์ด BBNJ-8010033 ('+p.kArt.length+' ใบ) · เครื่องที่ติด Artemis · Port ช่วงนั้นคือลูกนี้'});
  K.log=kOld.concat(vNew);
  K.boatId=vPos.boatId; K.pos=vPos.pos; K.status=vPos.status; K.spareLocation=null;
  if(p.pre.length&&p.post.length) K.baseHours=p.newBase;
  if((vSvc.d||'')>=cut){ K.lastServiceDate=vSvc.d; K.lastServiceHours=p.hCut; }
  K.log.push({date:cut,type:'swap',by:by,desc:'ย้ายจาก Artemis · Port → '+_efWhere(K)+' · บันทึกย้อนหลัง (เดิมไม่ได้กดถอด/สลับ · เรคคอร์ด Verona · Port ถูกแก้เลขเป็นเลขนี้แทน)'});
  K.log.push({date:today,type:'rename',by:by,desc:'รวมสองเรคคอร์ดของ BBNJ-8010033 เป็นลูกเดียว · เดิมค้างที่ "'+kWas+'" · ชั่วโมงตั้งต้นปรับให้ต่อเนื่อง ('+p.hCut+' ชม. ตอนออกจาก Artemis)'});
  /* 3 · e22 = 1010053 → Romeo·Std + รวมเรคคอร์ดที่สร้างใหม่ */
  p.nAll.forEach(function(r){ mv(r,F.ver); });
  p.nDaily.forEach(function(c){ dmove(c,F.dup,F.ver); });
  V.log=vOld.concat(N.log||[]);
  V.serial='BBNJ-1010053'; V.boatId=N.boatId; V.pos=N.pos; V.status=N.status; V.spareLocation=N.spareLocation||null;
  V.lastServiceHours=N.lastServiceHours; V.lastServiceDate=N.lastServiceDate; if(!(+V.baseHours>0) && +N.baseHours>0) V.baseHours=N.baseHours;
  V.log.push({date:cut,type:'swap',by:by,desc:'ย้ายจาก Verona · Port → '+_efWhere(V)+' · บันทึกย้อนหลัง'});
  V.log.push({date:today,type:'rename',by:by,desc:'แก้เลขกลับเป็นเลขเดิม BBNJ-8010033 → BBNJ-1010053 · รวมกับเรคคอร์ดที่ถูกสร้างซ้ำเมื่อ 9 ต.ค.'});
  /* เกียร์อยู่ตำแหน่งเดิม */
  (FL_GEARBOXES||[]).forEach(function(g){ if(!g) return;
    if(g.engineId===F.ver){ undo.gb.push({id:g.id,was:F.ver}); g.engineId=F.real; }
    else if(g.engineId===F.dup){ undo.gb.push({id:g.id,was:F.dup}); g.engineId=F.ver; } });
  FL_ENGINES=(FL_ENGINES||[]).filter(function(x){ return x.id!==F.dup; });
  if(typeof flGbBoatHeal==='function') try{ flGbBoatHeal([F.real,F.ver]); }catch(_){ }
  try{ var U=JSON.parse(localStorage.getItem('la_engfix_undo')||'{}'); U.ver33=undo; localStorage.setItem('la_engfix_undo', JSON.stringify(U)); }catch(_){ }
  if(typeof flSave==='function') flSave();
  flEngFixOpen();
  if(typeof flRenderAsset==='function') try{ flRenderAsset(); }catch(_){ }
}
function flEngFix33Undo(){
  if(!_efCanEdit()) return;
  var U={}; try{ U=JSON.parse(localStorage.getItem('la_engfix_undo')||'{}'); }catch(_){ }
  var u=U.ver33, F=FL_ENG_FIX33; if(!u){ alert('ไม่มีข้อมูลสำรองของชุดนี้ในเครื่องนี้'); return; }
  if(!confirm('ยกเลิกการแก้ชุด BBNJ-8010033 / BBNJ-1010053 · คืนข้อมูลกลับเป็นก่อนกดแก้?\n\n(สิ่งที่บันทึกเพิ่มกับเครื่อง 4 ลูกนี้หลังกดแก้ จะหายไปด้วย)')) return;
  (u.engs||[]).forEach(function(snap){ var i=(FL_ENGINES||[]).findIndex(function(x){ return x.id===snap.id; });
    if(i>=0) FL_ENGINES[i]=snap; else FL_ENGINES.splice(Math.max(0,Math.min(u.dupIdx||FL_ENGINES.length,FL_ENGINES.length)),0,snap); });
  (u.refs||[]).slice().reverse().forEach(function(r){ var L=(r.kind==='mj')?FL_MAINT:FL_INCIDENTS, rec=(L||[]).find(function(x){ return x.id===r.id; }); if(!rec) return;
    var arr=(r.kind==='mj')?rec.assets:rec.damagedAssets; if(arr && arr[r.i]) arr[r.i][r.f]=r.was; });
  (u.gb||[]).forEach(function(g){ var o=(FL_GEARBOXES||[]).find(function(x){ return x.id===g.id; }); if(o) o.engineId=g.was; });
  (u.daily||[]).slice().reverse().forEach(function(c){ var en=((((FL_DAILY[c.ds]||{})[c.bid]||{}).trips||{})[c.tk]||{}).engines; if(!en) return;
    en[c.from]=c.v; if(c.hadTo) en[c.to]=c.toV; else delete en[c.to]; });
  if(typeof flGbBoatHeal==='function') try{ flGbBoatHeal([F.real,F.ver,F.dup]); }catch(_){ }
  delete U.ver33; try{ localStorage.setItem('la_engfix_undo', JSON.stringify(U)); }catch(_){ }
  if(typeof flSave==='function') flSave();
  flEngFixOpen();
  if(typeof flRenderAsset==='function') try{ flRenderAsset(); }catch(_){ }
}

/* ══ §engBase (2026-11-12) · ชั่วโมงตั้งต้น = มิเตอร์ครั้งแรก ═══════════════════════════════════════
   owner: "ตั้งตามมิเตอร์ เพื่อจะได้รู้อายุของเครื่องยนต์จริงๆ"
   flEngHours = baseHours + (มิเตอร์ล่าสุด − มิเตอร์ครั้งแรกที่บันทึก) · ลูกที่ baseHours เป็น 0 จึงแสดงแค่ชั่วโมงที่วิ่งตั้งแต่เริ่มบันทึก
   (Aluminous1 88 ชม. ทั้งที่มิเตอร์ 5,256) · ตั้ง baseHours = มิเตอร์ครั้งแรก → ชั่วโมงสะสม = มิเตอร์ล่าสุด
   lastServiceHours อยู่ในสเกลเดิม ต้องเลื่อนตามเท่ากัน ไม่งั้นรอบเซอร์วิสจะขึ้นเกินกำหนดทันที
   ผู้ใช้กดเอง · admin · ต้องแก้เลขที่ถูกแก้ชื่อให้ครบก่อน (การแก้เลขย้ายมิเตอร์ข้ามเรคคอร์ด) · ยกเลิกได้จากเครื่องที่กด */
function flEngBaseList(){
  var out=[];
  (FL_ENGINES||[]).forEach(function(e){
    if(!e || (+e.baseHours>0)) return;
    var first=null, fd='', last=null, ld='';
    Object.keys(FL_DAILY||{}).forEach(function(ds){ var d=FL_DAILY[ds]||{};
      Object.keys(d).forEach(function(bid){ var tr=(d[bid]||{}).trips||{}; Object.keys(tr).forEach(function(tk){ var v=((tr[tk]||{}).engines||{})[e.id]; if(v==null || !(+v>0)) return;
        if(first===null || ds<fd){ fd=ds; first=+v; } if(ds>ld){ ld=ds; last=+v; } }); }); });
    if(first===null || !(first>0)) return;
    out.push({e:e, first:first, fd:fd, last:last, now:(typeof flEngHours==='function')?flEngHours(e.id):0});
  });
  return out.sort(function(a,b){ return _efWhere(a.e).localeCompare(_efWhere(b.e)); });
}
function flEngBaseApply(){
  if(!_efCanEdit()){ alert('เฉพาะ admin แก้ได้'); return; }
  if(flEngFixPending().length){ alert('แก้เลขที่ถูกแก้ชื่อให้ครบก่อน แล้วค่อยตั้งชั่วโมง'); return; }
  var L=flEngBaseList(); if(!L.length) return;
  if(!confirm('ตั้งชั่วโมงตั้งต้นของ '+L.length+' ลูก ให้เท่ามิเตอร์ครั้งแรกที่บันทึก?\n\nชั่วโมงสะสมจะเท่ากับมิเตอร์ล่าสุด · รอบเซอร์วิสเลื่อนตามให้ ระยะถึงรอบถัดไปไม่เปลี่ยน')) return;
  var by=(typeof laBy==='function')?laBy():'', today=(typeof TODAY_STR!=='undefined')?TODAY_STR:'', undo=[];
  L.forEach(function(x){ var e=x.e; undo.push({id:e.id, base:e.baseHours, svc:e.lastServiceHours});
    e.baseHours=x.first;
    if(e.lastServiceHours!=null && e.lastServiceHours!=='') e.lastServiceHours=+((+e.lastServiceHours||0)+x.first).toFixed(1);
    if(!e.log) e.log=[];
    e.log.push({date:today, type:'note', by:by, desc:'ตั้งชั่วโมงตั้งต้น = มิเตอร์ครั้งแรก '+x.first+' ('+x.fd+') · ชั่วโมงสะสม '+x.now+' → '+x.last+' · รอบเซอร์วิสเลื่อนตาม'}); });
  try{ localStorage.setItem('la_engbase_undo', JSON.stringify({at:new Date().toISOString(), rows:undo})); }catch(_){ }
  if(typeof flSave==='function') flSave();
  flEngBaseOpen();
  if(typeof flRenderAsset==='function') try{ flRenderAsset(); }catch(_){ }
}
function flEngBaseUndo(){
  if(!_efCanEdit()) return;
  var U=null; try{ U=JSON.parse(localStorage.getItem('la_engbase_undo')||'null'); }catch(_){ }
  if(!U || !U.rows){ alert('ไม่มีข้อมูลสำรองในเครื่องนี้'); return; }
  if(!confirm('ยกเลิกการตั้งชั่วโมงตามมิเตอร์ของ '+U.rows.length+' ลูก?')) return;
  U.rows.forEach(function(r){ var e=flGetEng(r.id); if(!e) return; e.baseHours=r.base; e.lastServiceHours=r.svc; if(e.log && e.log.length && /ตั้งชั่วโมงตั้งต้น = มิเตอร์ครั้งแรก/.test(e.log[e.log.length-1].desc||'')) e.log.pop(); });
  try{ localStorage.removeItem('la_engbase_undo'); }catch(_){ }
  if(typeof flSave==='function') flSave();
  flEngBaseOpen();
  if(typeof flRenderAsset==='function') try{ flRenderAsset(); }catch(_){ }
}
function flEngBaseOpen(){
  flEngFixClose();
  var L=flEngBaseList(), e=_efE, ro=!_efCanEdit(), pend=flEngFixPending().length, U=null;
  try{ U=JSON.parse(localStorage.getItem('la_engbase_undo')||'null'); }catch(_){ }
  var n=function(v){ return (Math.round(v*10)/10).toLocaleString(); };
  var h='<div class="ef-box"><div class="ef-top"><div><b>ชั่วโมงตั้งต้นเป็น 0 · ตั้งตามมิเตอร์</b><span>ชั่วโมงสะสมจะเท่ากับมิเตอร์ล่าสุดใน Daily Fleet Log · รอบเซอร์วิสเลื่อนตาม ระยะถึงรอบถัดไปไม่เปลี่ยน</span></div><button onclick="flEngFixClose()">&#10005;</button></div><div class="ef-body">'
    +(pend?'<div class="ef-card"><div class="ef-w">&#9888; ยังมีเลขที่ถูกแก้ชื่อค้างอยู่ '+pend+' ชุด · แก้ให้ครบก่อน แล้วค่อยตั้งชั่วโมง</div></div>':'')
    +(L.length?('<div class="ef-card"><table><tr><th>เครื่อง</th><th>ตำแหน่ง</th><th style="text-align:right">ชั่วโมงตอนนี้</th><th></th><th style="text-align:right">หลังตั้ง (= มิเตอร์ล่าสุด)</th><th>มิเตอร์ครั้งแรก</th></tr>'
        +L.map(function(x){ return '<tr><td><b class="sn">'+e(x.e.serial)+'</b></td><td><span>'+e(_efWhere(x.e))+'</span></td><td style="text-align:right">'+n(x.now)+'</td><td class="ar">&rarr;</td><td style="text-align:right"><b class="sn ok">'+n(x.last)+'</b></td><td class="n">'+n(x.first)+' · '+e(x.fd)+'</td></tr>'; }).join('')
        +'</table><div class="ef-f"><span>'+L.length+' ลูก · เครื่องที่เพิ่งเปลี่ยนเข้ามาจะได้ชั่วโมงตามมิเตอร์ของตำแหน่งนั้น ถ้าชั่วโมงจริงของลูกไหนต่างจากนี้ แก้ที่ Edit ของลูกนั้นได้ภายหลัง</span>'
        +((ro||pend)?'':'<button class="go" onclick="flEngBaseApply()">ตั้งทั้ง '+L.length+' ลูก</button>')+'</div></div>')
      :'<div class="ef-empty">&#10003; ไม่มีเครื่องที่ชั่วโมงตั้งต้นเป็น 0 แล้ว</div>')
    +((U&&U.rows&&!ro)?('<div class="ef-done"><div><span>&#10003; ตั้งไปแล้ว '+U.rows.length+' ลูก · '+e(String(U.at||'').slice(0,16).replace('T',' '))+'</span><button onclick="flEngBaseUndo()">ยกเลิกการตั้ง</button></div></div>'):'')
    +'</div></div>';
  flEngFixOpen();                                   /* ยืม style ของหน้าต่างแก้เลข */
  var m=document.getElementById('ef-modal'); if(!m) return;
  var st=m.querySelector('style'); m.innerHTML=(st?st.outerHTML:'')+h;
}
