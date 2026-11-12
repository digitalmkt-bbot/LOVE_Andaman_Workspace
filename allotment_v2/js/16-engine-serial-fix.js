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
  {k:'ver53', a:'e22', aOrig:'BBNJ-1010053', b:'emv0s57otfxl0e', bOrig:null, aNow:'BBNJ-8010033', bNow:'BBNJ-1010053',
     t:'Verona · Port ↔ Romeo · Std (เลขซ้ำ BBNJ-8010033 + เรคคอร์ดที่สร้างใหม่)',
     ask:'เลขจริงบนแผ่นป้ายของเครื่องที่ติดอยู่ Verona · Port ตอนนี้'}
  /* Aluminous2 (e33 32501F-440231 ↔ e36 32501F-440247) ยังไม่ใส่ · ใบงาน พ.ค.–ส.ค. ใช้เลขสองตัวสลับไปมา หาวันแก้เลขจากใบงานไม่ได้ · รอผลแผ่นป้าย */
];
function _efK(s){ return String(s||'').toUpperCase().replace(/[\s\-]/g,''); }
function _efE(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function _efWhere(e){ var b=e.boatId?((typeof getBoat==='function'&&getBoat(e.boatId))||{}).name:''; return (b||('ไม่ติดเรือ'+(e.spareLocation?(' · '+((typeof flParseSpareLoc==='function')?flParseSpareLoc(e.spareLocation).label:e.spareLocation)):'')))+' · '+((typeof flPosLabel==='function')?flPosLabel(e.pos):(e.pos||'')); }
function _efCanEdit(){ try{ return !(typeof window.laIsAdmin==='function') || !!window.laIsAdmin(); }catch(_){ return true; } }
/* คู่ที่ยังต้องแก้ · ข้อมูลต้องยังอยู่ในสภาพที่ถูกแก้ชื่อ */
function flEngFixPending(){
  return FL_ENG_FIX.filter(function(P){
    var A=flGetEng(P.a), B=flGetEng(P.b); if(!A||!B) return false;
    var aNow=P.aNow||P.bOrig, bNow=P.bNow||P.aOrig;
    return _efK(A.serial)===_efK(aNow) && _efK(B.serial)===_efK(bNow);
  });
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
  var done=FL_ENG_FIX.filter(function(P){ return U[P.k] && !pend.some(function(x){ return x.k===P.k; }); });
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
    +(pend.length?pend.map(card).join(''):'<div class="ef-empty">&#10003; ไม่มีคู่ที่ต้องแก้แล้ว</div>')
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
