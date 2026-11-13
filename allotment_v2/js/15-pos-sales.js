/* ══ §posSales (2026-11-11) · ยอดขายร้านค้า (POS) แยกรายลำ ═══════════════════════════════
   owner: "อัพเดทรายการขายจาก POS เข้าฐานข้อมูล · ให้ User แยกรายการขายรายลำ · ภูเก็ต/ทับละมุแยกกัน
           เพื่อวิเคราะห์ ลำไหนขายดี · ลค สัญชาติอะไร ซื้ออะไร · ไกด์บนเรือมีผลต่อการขายไหม"
   POS (GPOS) ออกรายงานได้แค่ "สรุปตามสินค้า" (ชื่อสินค้า · ช่องทาง · ยอดขายสุทธิ · จำนวน · กำไร · อัตรากำไร)
   ไม่มีวันที่ ไม่มีสาขา ไม่มีเลขบิล → คนขายเลือกวัน + อัปโหลดในหน้าของท่าตัวเอง แล้วแยกจำนวนลงลำเอง (ไม่เดา)

   เก็บ · ctWrite('pos_sales_YYYYMM') = { 'pier|YYYY-MM-DD': {f,at,by,items:[{n,q,net,pf,a:{boatId:{q,nat}}}]} }
     แยกก้อนรายเดือน กัน blob โต · smerge ของเซิร์ฟเวอร์รวมราย sub-key → สองท่าบันทึกพร้อมกันไม่ทับกัน
     a['_x'] = ไม่ใช่ลูกค้าเรือ (walk-in / พนักงาน) · nat = สัญชาติผู้ซื้อ (ไม่บังคับ)
   ไม่แตะข้อมูลเดิมใด ๆ · อ่าน TRIPS / SB_BOOKINGS / ใบสั่งงานไกด์ อย่างเดียว
   §pslProd (2026-11-13) · หน้าบันทึกรายวันแบบใหม่ + แท็บทะเบียนสินค้า (รูป · ชื่อที่ใช้แสดง · ประเภท) · ดูหัวบล็อกด้านล่าง */
var _psl={ pier:'panwa', date:(typeof TODAY_STR!=='undefined'?TODAY_STR:''), tab:'day', mon:'', q:'', only:false, rq:'', rcat:'', rnoimg:false };
var PSL_X='_x';
function pslE(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function pslB(n){ return '฿'+Math.round(+n||0).toLocaleString(); }
function pslNum(v){ if(typeof v==='number') return v; var n=parseFloat(String(v==null?'':v).replace(/[,฿%\s]/g,'')); return isFinite(n)?n:0; }
function pslKey(date){ return 'pos_sales_'+String(date||'').slice(0,7).replace('-',''); }
function pslMap(date){ var m=(typeof ctRead==='function')?ctRead(pslKey(date)):null; return (m&&typeof m==='object'&&!Array.isArray(m))?m:{}; }
function pslDay(pier,date){ return pslMap(date)[pier+'|'+date]||null; }
function pslCanEdit(){ try{ return (typeof poCanEdit==='function')?!!poCanEdit():true; }catch(_){ return true; } }
function pslSaveDay(pier,date,rec){
  if(!pslCanEdit()){ alert('บัญชีนี้ดูได้อย่างเดียว'); return false; }
  var m=pslMap(date); if(rec) m[pier+'|'+date]=rec; else delete m[pier+'|'+date];
  if(typeof ctWrite==='function') ctWrite(pslKey(date), m);
  return true;
}
function pslPierName(p){ return p==='panwa'?'Phuket · Visit Panwa':(p==='tublamu'?'Tub Lamu':p); }
function pslNatName(c){ var n=''; try{ n=(typeof pkTkNatName==='function')?pkTkNatName(c):''; }catch(_){ } return n||c; }
/* เรือที่ออกจากท่านี้วันนั้น · ตามท่าของเส้นทาง · ไม่นับเรือกู้ (ลูกค้านับอยู่กับลำที่เสีย) */
function pslBoats(pier,date){
  var T=(typeof TRIPS!=='undefined'&&TRIPS[date])||{}, out=[];
  Object.keys(T).forEach(function(bid){
    var t=T[bid]||{}; if(!t.route || t.type==='rescue') return;
    var r=(typeof getRoute==='function')?getRoute(t.route):null; if(!r || r.pier!==pier) return;
    var px=(typeof pxPax==='function')?pxPax(date,bid):{tot:0}; if(!px.tot) return;
    var b=(typeof getBoat==='function')?getBoat(bid):null;
    out.push({id:bid, name:(b&&b.name)||bid, pax:px.tot, route:r.name||t.route, rid:t.route});
  });
  return out.sort(function(a,b){ return a.name.localeCompare(b.name); });
}
/* สัญชาติของลูกค้าบนลำ · ตามสัญชาติ lead ของใบจอง × คนที่ขึ้นเรือจริง */
function pslBoatNats(date,bid){
  var o={};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(function(b){
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    var t=(typeof ckTripOn==='function')?ckTripOn(b,date):null; if(!t) return;
    var O=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
    if((O.boatId||t.charterBoatId)!==bid) return;
    var n=(typeof ckBookedPax==='function')?ckBookedPax(t):0; if(typeof pckOnBoard==='function') n=pckOnBoard(b,date,n);
    if(!n) return;
    var k=String(b.leadNationality||'').toUpperCase()||'?'; o[k]=(o[k]||0)+n;
  });
  return Object.keys(o).map(function(k){ return {c:k,n:o[k]}; }).sort(function(a,b){ return b.n-a.n; });
}
function pslBoatGuides(date,bid){
  try{ var F=(typeof pjGuidesFull==='function')?pjGuidesFull(date,bid):[];
    if(!F.length){ var so=((typeof TRIPS!=='undefined'&&TRIPS[date])||{})[bid]||{}; if(so.swap&&so.swap.to) F=pjGuidesFull(date,so.swap.to)||[]; }
    return F.filter(function(g){ return g.role==='guide'||g.role==='trainee'; }).map(function(g){ return g.name; });
  }catch(_){ return []; }
}
/* §pslAv (2026-11-11) · owner "ดีไซน์ของชื่อเรือ ใช้ของในหน้า Boat Status" · วงกลมสีประจำเรือ + ตัวย่อ แล้วชื่อเรือตัวหนา */
function pslAvatar(bid,name,sz){
  var b=(typeof getBoat==='function')?getBoat(bid):null, c='';
  try{ if(typeof getBoatColor==='function'){ var gc=getBoatColor(bid); if(gc&&gc.text&&gc.text!=='#666') c=gc.fill||gc.text; } }catch(_){ }
  try{ if(!c && b && typeof flBoatAvatarColor==='function') c=flBoatAvatarColor(b); }catch(_){ }
  var ini='?'; try{ ini=(typeof flBoatInitials==='function')?flBoatInitials(name||''):String(name||'?').slice(0,2).toUpperCase(); }catch(_){ }
  sz=sz||32;
  return '<span class="av" title="'+pslE(name)+'" style="width:'+sz+'px;height:'+sz+'px;background:'+(c||'#999')+';font-size:'+Math.round(sz*0.34)+'px">'+pslE(ini)+'</span>';
}
function pslBoatTag(bid,name,sz){ return '<span class="bt">'+pslAvatar(bid,name,sz)+'<b>'+pslE(name)+'</b></span>'; }
function pslAllocSum(it){ var s=0, a=it.a||{}; Object.keys(a).forEach(function(k){ s+=(+a[k].q||0); }); return s; }

/* ── อ่านไฟล์ POS ── */
function pslParseRows(rows){
  var hi=-1, C={};
  for(var i=0;i<Math.min(rows.length,15)&&hi<0;i++){
    var R=rows[i].map(function(x){ return String(x||'').trim(); });
    var cn=R.findIndex(function(x){ return /ชื่อสินค้า|product/i.test(x); });
    if(cn<0) continue;
    hi=i; C.n=cn;
    C.q=R.findIndex(function(x){ return /^จำนวน|qty|quantity/i.test(x); });
    C.net=R.findIndex(function(x){ return /ยอดขายสุทธิ|net/i.test(x); });
    C.pf=R.findIndex(function(x){ return /^กำไร|^profit/i.test(x); });
  }
  if(hi<0 || C.q<0 || C.net<0) return null;
  var M={}, ord=[];
  rows.slice(hi+1).forEach(function(R){
    var n=String(R[C.n]||'').replace(/\s+/g,' ').trim(); if(!n || /^รวม|^total/i.test(n)) return;
    var q=pslNum(R[C.q]); if(!(q>0)) return;
    if(!M[n]){ M[n]={n:n,q:0,net:0,pf:0,a:{}}; ord.push(n); }
    M[n].q+=q; M[n].net+=pslNum(R[C.net]); M[n].pf+=(C.pf>=0?pslNum(R[C.pf]):0);
  });
  return ord.map(function(n){ var x=M[n]; x.net=Math.round(x.net*100)/100; x.pf=Math.round(x.pf*100)/100; return x; });
}
function pslPick(inp){
  var f=inp.files&&inp.files[0]; inp.value=''; if(!f) return;
  if(typeof XLSX==='undefined'){ alert('ตัวอ่านไฟล์ Excel ยังไม่พร้อม ลองโหลดหน้าใหม่'); return; }
  var rd=new FileReader();
  rd.onload=function(ev){
    var rows; try{ var wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'}); rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''}); }
    catch(e){ alert('อ่านไฟล์ไม่ได้: '+((e&&e.message)||e)); return; }
    var items=pslParseRows(rows);
    if(!items){ alert('ไฟล์นี้ไม่ใช่รายงานยอดขายตามสินค้าของ POS\nต้องมีคอลัมน์: ชื่อสินค้า · จำนวน · ยอดขายสุทธิ'); return; }
    if(!items.length){ alert('ไม่พบรายการขายในไฟล์'); return; }
    var pier=_psl.pier, date=_psl.date, old=pslDay(pier,date);
    if(old && old.items && old.items.length){
      if(!confirm('วันที่ '+date+' มีรายการอยู่แล้ว '+old.items.length+' รายการ\n\nอัปโหลดทับ? · รายการที่ชื่อสินค้าตรงกันจะคงการแยกลำเดิมไว้ (เท่าที่จำนวนใหม่พอ)')) return;
      var OM={}; old.items.forEach(function(it){ OM[it.n]=it; });
      items.forEach(function(x){ var o=OM[x.n]; if(!o||!o.a) return; var left=x.q;
        Object.keys(o.a).forEach(function(k){ var q=Math.min(+o.a[k].q||0,left); if(q>0){ x.a[k]={q:q,nat:o.a[k].nat||''}; left-=q; } }); });
    }
    var rec={ f:f.name, at:new Date().toISOString(), by:(typeof laBy==='function'?laBy():''), items:items };
    if(pslSaveDay(pier,date,rec)) renderPosSales(pier);
  };
  rd.readAsArrayBuffer(f);
}
function pslDelDay(){
  var r=pslDay(_psl.pier,_psl.date); if(!r) return;
  if(!confirm('ลบรายการขายของวันที่ '+_psl.date+' ('+pslPierName(_psl.pier)+') ทั้งหมด รวมการแยกลำ?\n\nลบแล้วเอาคืนไม่ได้ ต้องอัปโหลดไฟล์ใหม่')) return;
  if(pslSaveDay(_psl.pier,_psl.date,null)) renderPosSales(_psl.pier);
}
function pslSetDate(d){ if(d){ _psl.date=d; renderPosSales(_psl.pier); } }
function pslShift(n){ var d=new Date(_psl.date+'T00:00:00'); d.setDate(d.getDate()+n); var p=function(x){ return String(x).padStart(2,'0'); }; pslSetDate(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())); }
function pslTab(t){ _psl.tab=t; renderPosSales(_psl.pier); }
function pslMon(n){
  var m=_psl.mon||_psl.date.slice(0,7);
  if(n==='all'){ _psl.mon='all'; }
  else { if(m==='all') m=_psl.date.slice(0,7); var d=new Date(+m.slice(0,4), +m.slice(5,7)-1+n, 1); _psl.mon=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  renderPosSales(_psl.pier);
}
/* แก้จำนวน/สัญชาติของช่องหนึ่ง · จำนวนรวมของสินค้าเกินยอดขายไม่ได้ */
function pslSet(i,bid,el,kind){
  var rec=pslDay(_psl.pier,_psl.date); if(!rec||!rec.items[i]) return;
  var it=rec.items[i]; it.a=it.a||{};
  var cur=it.a[bid]||{q:0,nat:''};
  if(kind==='nat'){ cur.nat=el.value||''; }
  else{
    var q=Math.max(0,Math.floor(pslNum(el.value)));
    var other=pslAllocSum(it)-(+cur.q||0), max=Math.max(0,it.q-other);
    if(q>max){ q=max; _psl.flash='"'+it.n.slice(0,40)+'" ขายได้ '+it.q+' ชิ้น · ช่องนี้ใส่ได้ไม่เกิน '+max; }
    cur.q=q;
  }
  if(cur.q>0) it.a[bid]=cur; else delete it.a[bid];
  if(!pslSaveDay(_psl.pier,_psl.date,rec)) return;
  /* วาดใหม่หลัง focus ย้ายเสร็จ แล้วคืน focus ให้ช่องที่กำลังจะพิมพ์ต่อ */
  setTimeout(function(){ var ae=document.activeElement, k=ae&&ae.getAttribute?ae.getAttribute('data-k'):null;
    var w=document.querySelector('.psl .wrap'), st=w?w.scrollTop:0, sl=w?w.scrollLeft:0;
    renderPosSales(_psl.pier);
    w=document.querySelector('.psl .wrap'); if(w){ w.scrollTop=st; w.scrollLeft=sl; }
    if(k){ var n=document.querySelector('.psl [data-k="'+k+'"]'); if(n){ n.focus(); if(n.select) try{ n.select(); }catch(_){ } } } },0);
}
/* ใส่ที่เหลือทั้งหมดลงช่องนี้ · ดับเบิลคลิก */
function pslFill(i,bid){
  if(!pslCanEdit()) return;
  var rec=pslDay(_psl.pier,_psl.date); if(!rec||!rec.items[i]) return; var it=rec.items[i]; it.a=it.a||{};
  var left=it.q-pslAllocSum(it); if(left<=0) return;
  var cur=it.a[bid]||{q:0,nat:''}; cur.q=(+cur.q||0)+left; it.a[bid]=cur;
  if(!pslSaveDay(_psl.pier,_psl.date,rec)) return;
  var w=document.querySelector('.psl .wrap'), st=w?w.scrollTop:0, sl=w?w.scrollLeft:0;
  renderPosSales(_psl.pier);
  w=document.querySelector('.psl .wrap'); if(w){ w.scrollTop=st; w.scrollLeft=sl; }
}

function pslCss(){
  if(document.getElementById('psl-css')) return;
  var s=document.createElement('style'); s.id='psl-css';
  s.textContent='.psl{padding:18px 22px 60px;color:#16223F;font-size:13px}'
  +'.psl h2{font-size:20px;font-weight:700;margin:0}.psl .sub{color:#6B7591;font-size:12px}'
  +'.psl .bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}'
  +'.psl .seg{display:inline-flex;background:#EEF1F6;border-radius:10px;padding:3px}.psl .seg button{border:0;background:transparent;padding:6px 14px;border-radius:8px;font:600 12.5px inherit;font-family:inherit;color:#5B6580;cursor:pointer}.psl .seg button.on{background:#fff;color:#16223F;box-shadow:0 1px 3px rgba(0,0,0,.1)}'
  +'.psl .btn{border:1px solid #D5DBE7;background:#fff;border-radius:9px;padding:7px 13px;font:600 12.5px inherit;font-family:inherit;color:#16223F;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.psl .btn.pri{background:#1683C7;border-color:#1683C7;color:#fff}.psl .btn.del{color:#B42B26;border-color:#F1C4C1}'
  +'.psl .dt{display:inline-flex;align-items:center;gap:4px}.psl .dt input{border:1px solid #D5DBE7;border-radius:9px;padding:6px 9px;font:600 13px inherit;font-family:inherit}'
  +'.psl .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}'
  +'.psl .tile{background:#fff;border:1px solid #E1E6EF;border-radius:12px;padding:11px 14px;min-width:0}.psl .tile .l{font-size:11px;color:#6B7591;font-weight:600}.psl .tile .v{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}.psl .tile .s{font-size:11px;color:#6B7591}'
  +'.psl .pb{height:6px;background:#E8ECF3;border-radius:3px;overflow:hidden;margin-top:5px}.psl .pb i{display:block;height:100%;background:#0E7C6B}'
  +'.psl .wrap{background:#fff;border:1px solid #E1E6EF;border-radius:12px;overflow:auto;max-height:calc(100vh - 300px)}'
  +'.psl table{border-collapse:separate;border-spacing:0;width:100%;font-variant-numeric:tabular-nums}'
  +'.psl th{font-size:11px;font-weight:700;color:#4B5675;padding:8px 8px;border-bottom:1px solid #E1E6EF;text-align:center;vertical-align:bottom;white-space:nowrap;background:#F5F7FB}'
  +'.psl .wrap th{position:sticky;top:0;z-index:2}'
  +'.psl th.l,.psl td.l{text-align:left}'
  +'.psl .wrap th:first-child,.psl .wrap td:first-child{position:sticky;left:0;z-index:1;background:#fff;min-width:230px;max-width:320px;border-right:1px solid #E1E6EF}.psl .wrap th:first-child{z-index:3;background:#F5F7FB}'
  +'.psl td{padding:6px 8px;border-bottom:1px solid #EEF1F6;text-align:center;vertical-align:middle}'
  +'.psl td.nm{font-weight:600;font-size:12.5px;line-height:1.3}.psl td.r{text-align:right}'
  +'.psl .bh{display:flex;flex-direction:column;align-items:center;gap:1px}.psl .bh b{font-size:12.5px;color:#16223F}.psl .bh>span:not(.bt){font-weight:500;font-size:10px;color:#6B7591;max-width:130px;overflow:hidden;text-overflow:ellipsis}'
  +'.psl input.q{width:46px;text-align:center;border:1px solid #D5DBE7;border-radius:7px;padding:5px 2px;font:700 13px inherit;font-family:inherit;background:#fff}.psl input.q.has{background:#E2F4F0;border-color:#0E7C6B;color:#0A5C4F}.psl input.q:disabled{background:#F5F7FB;color:#9AA3B8}'
  +'.psl select.nat{display:block;margin:3px auto 0;width:62px;font-size:10px;border:1px solid #D5DBE7;border-radius:6px;padding:1px;background:#fff;color:#4B5675}.psl select.nat.off{visibility:hidden}'
  +'.psl .left{font-weight:700;color:#B45309}.psl .left.ok{color:#0E7C6B}'
  +'.psl .wrap tfoot td{position:sticky;bottom:0;background:#F5F7FB;font-weight:700;border-top:1px solid #E1E6EF;z-index:1}.psl .wrap tfoot td:first-child{background:#F5F7FB;z-index:2}'
  +'.psl .empty{background:#fff;border:1.5px dashed #C9D1E0;border-radius:14px;padding:34px 24px;text-align:center;color:#4B5675;line-height:1.8}'
  +'.psl .flash{background:#FDF1DD;color:#9A5B00;border-radius:9px;padding:8px 12px;margin-bottom:10px;font-weight:600}'
  +'.psl .card{background:#fff;border:1px solid #E1E6EF;border-radius:12px;margin-bottom:14px;overflow:hidden}.psl .card h3{font-size:14px;margin:0;padding:11px 14px;border-bottom:1px solid #E1E6EF;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.psl .card h3 small{font-weight:500;color:#6B7591;font-size:11.5px}'
  +'.psl .card .ov{overflow-x:auto}'
  +'.psl .av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:700;flex:none;letter-spacing:.02em}.psl .bt{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}.psl .bt b{font-size:13px;font-weight:600;color:#16223F}'
  +'.psl .bh>span.rt{font-size:10.5px;font-weight:600;color:#1683C7;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +'.psl .hb{display:inline-block;height:8px;border-radius:4px;background:#1683C7;vertical-align:middle;margin-right:6px}'
  +'.psl .note{font-size:11.5px;color:#6B7591;padding:8px 14px}'
  /* §pslProd · หน้าบันทึกรายวันแบบใหม่ + ทะเบียนสินค้า */
  +'.psl .bar.top{gap:12px}'
  +'.psl .kp{display:flex;gap:20px;align-items:center;margin-left:6px}.psl .kp>div{display:flex;flex-direction:column;line-height:1.25}.psl .kp i{font-style:normal;font-size:10.5px;color:#6B7591;font-weight:600}.psl .kp b{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}.psl .kp small{font-size:11px;color:#6B7591;font-weight:500}'
  +'.psl .prog{flex:1 1 170px;max-width:300px;min-width:150px}.psl .prog .l{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#4B5675}.psl .prog .pb{height:8px;border-radius:5px;margin-top:4px}'
  +'.psl input.sr{border:1px solid #D5DBE7;border-radius:9px;padding:7px 11px;font-size:12.5px;font-weight:500;font-family:inherit;width:170px;background:#fff;color:#16223F}'
  +'.psl .btn{font-size:12.5px;font-weight:600}.psl select.btn{padding-right:8px}'
  +'.psl .btn.only{color:#8A5A12;background:#FFF6E0;border-color:#EBD3A3}.psl .btn.only.on{background:#8A5A12;border-color:#8A5A12;color:#fff}'
  +'.psl .wrap.day{max-height:calc(100vh - 235px)}.psl .wrap.day td{padding:5px 6px}'
  +'.psl .wrap tr.cat td,.psl .wrap tr.cat td:first-child{text-align:left;background:#F5F7FB;padding:5px 12px;font-size:11px;color:#4B5675;border-bottom:1px solid #E1E6EF;border-right:0;max-width:none}'
  +'.psl tr.cat b{font-weight:700;margin-right:8px}.psl tr.cat span{color:#9AA3B8}'
  +'.psl .pw{display:flex;align-items:center;gap:10px;min-width:0}.psl .pm{min-width:0;display:flex;flex-direction:column;line-height:1.3}.psl .pm b{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.psl .pm i{font-style:normal;font-size:10.5px;color:#6B7591;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.psl .pt{flex:none;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;font-weight:700;color:rgba(22,34,63,.45)}.psl .pt img{width:100%;height:100%;object-fit:cover;display:block}.psl .pt.ck{cursor:pointer}'
  +'.psl .wrap.day input.q{width:44px;height:28px;padding:0;border-style:dashed;border-radius:8px;box-sizing:border-box;font-size:13px;font-weight:700}.psl .wrap.day input.q.has{border-style:solid;border-width:1.5px}.psl .wrap.day input.q:focus{outline:2px solid #1683C7;outline-offset:1px;border-style:solid}'
  +'.psl .wrap.day select.nat{margin-top:2px}'
  +'.psl .st{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap}.psl .st.ok{background:#E1F3EA;color:#0F6E56}.psl .st.lf{background:#FCEBDD;color:#B4541A}'
  +'.psl .bh.v2>span.qc{font-weight:800;font-size:10px;max-width:none;border-radius:999px;padding:1px 9px;margin-top:3px}'
  +'.psl .wrap.day th{padding:8px 4px}.psl .bh.v2>span.rt{max-width:112px}.psl .bh.v2>span:not(.bt):not(.qc){max-width:112px;white-space:nowrap}'
  +'.psl .wrap.day th:last-child,.psl .wrap.day tbody td:last-child,.psl .wrap.day tfoot td:last-child{position:sticky;right:0;box-shadow:-1px 0 0 #E1E6EF;min-width:76px}.psl .wrap.day tbody td:last-child{background:#fff}.psl .wrap.day th:last-child{z-index:3}'
  +'.psl tr.nores td,.psl .wrap tr.nores td:first-child{padding:22px;color:#6B7591;text-align:center;max-width:none;border-right:0}'
  +'.psl .rg{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}'
  +'.psl .pc{background:#fff;border:1px solid #E1E6EF;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;cursor:pointer;min-width:0}.psl .pc:hover{box-shadow:0 4px 14px rgba(22,34,63,.1)}'
  +'.psl .pc .ph{height:140px;display:flex;align-items:center;justify-content:center}.psl .pc .ph img{width:100%;height:100%;object-fit:cover;display:block}'
  +'.psl .add{font-size:12px;font-weight:700;color:#4B5675;border:1.5px dashed rgba(22,34,63,.3);border-radius:10px;padding:8px 13px;background:rgba(255,255,255,.6)}.psl .noi,.psl-md .noi{font-size:12px;color:rgba(22,34,63,.45);font-weight:600}'
  +'.psl .pc>b{font-size:12.5px;font-weight:600;padding:10px 12px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.psl .pc>i{font-style:normal;font-size:11px;color:#6B7591;padding:2px 12px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.psl .pf{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px 11px}.psl .pf span{font-weight:700;font-variant-numeric:tabular-nums}.psl .pf em{font-style:normal;font-size:10.5px;color:#0E7C6B;font-weight:700;white-space:nowrap}'
  +'.psl-md{position:fixed;inset:0;z-index:99980;background:rgba(15,25,45,.45);display:flex;align-items:center;justify-content:center;padding:20px}'
  +'.psl-md .bx{background:#fff;border-radius:16px;overflow:hidden;display:flex;width:min(760px,100%);max-height:90vh;color:#16223F;font-size:13px}'
  +'.psl-md .im{flex:0 0 46%;min-height:320px;display:flex;align-items:center;justify-content:center}.psl-md .im img{width:100%;height:100%;max-height:90vh;object-fit:contain;display:block}'
  +'.psl-md .fm{flex:1;padding:20px 22px;display:flex;flex-direction:column;gap:6px;min-width:0}'
  +'.psl-md .ttl{font-size:16px;font-weight:700;margin-bottom:6px}.psl-md .fm>label{font-size:11px;font-weight:700;color:#6B7591;margin-top:6px}'
  +'.psl-md .fm>input{border:1px solid #D5DBE7;border-radius:9px;padding:8px 10px;font-size:13px;font-weight:500;font-family:inherit;color:#16223F}'
  +'.psl-md .mt{font-size:11.5px;color:#6B7591;line-height:1.6;margin-top:8px}'
  +'.psl-md .ac{display:flex;gap:8px;align-items:center;margin-top:auto;padding-top:14px;flex-wrap:wrap}'
  +'.psl-md .btn{border:1px solid #D5DBE7;background:#fff;border-radius:9px;padding:7px 13px;font-size:12.5px;font-weight:600;font-family:inherit;color:#16223F;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.psl-md .btn.pri{background:#1683C7;border-color:#1683C7;color:#fff}.psl-md .btn.del{color:#B42B26;border-color:#F1C4C1}'
  +'@media(max-width:640px){.psl-md .bx{flex-direction:column;overflow:auto}.psl-md .im{flex:none;min-height:220px}}';
  document.head.appendChild(s);
}

/* ══ §pslProd (2026-11-13) · ทะเบียนสินค้า + รูปสินค้า · และหน้าบันทึกรายวันแบบใหม่ ══════════════
   owner: "ปรับดีไซน์หน้านี้หน่อย และเราจะทำทะเบียนรายการของ ให้สามารถเพิ่มรูปสินค้าได้"
   ตกลงกันไว้: ไซส์ของสินค้าเดียวกันรวมเป็นใบเดียว (รูปเดียว) · ประเภทให้ระบบเดาจากชื่อใน POS แล้วแก้เองได้ · ช่องในทะเบียน = รูป · ชื่อที่ใช้แสดง · ประเภท

   สินค้าไม่ต้องคีย์เข้าทะเบียน · ระบบรวบรวมจากไฟล์ POS ที่เคยอัปโหลดทุกวัน ทุกท่า
   ชื่อใน POS หน้าตาแบบ  "Beach Shoe.Phuket TOTO..Multi-Color.40-41 00594-40-41"  = ประเภท.ยี่ห้อ.รุ่น.สี.ไซส์ รหัส
     → ตัดท่อนสุดท้าย (ไซส์+รหัส) ออก ที่เหลือคือ "สินค้า" หนึ่งใบ · ชื่อที่ไม่มีจุดแบบนี้ = หนึ่งชื่อหนึ่งใบ
   เก็บ · ctWrite('pos_products') = { famKey: {nm, cat, img:{id,url}, at, by} }  เฉพาะใบที่มีคนแก้ · smerge ราย sub-key เหมือน pos_sales
   รูป · ไฟล์จริงอยู่ตาราง attachments (POST /api/attach · ท่อเดียวกับสลิป/รูปโปรเจกต์) · blob เก็บแค่ ref · ย่อเหลือ 900px ก่อนส่ง
   ทะเบียนใช้ร่วมกันทุกท่า */
var _pslFamC={};
function pslFam(n){
  n=String(n||'').replace(/\s+/g,' ').trim();
  var c=_pslFamC[n]; if(c) return c;
  var parts=n.split('.'), o;
  if(parts.length>=4){
    var head=parts.slice(0,-1).map(function(x){ return x.trim(); }), v=parts[parts.length-1].trim();
    var m=/^(.+?)\s+(\S*\d\S*)-\1$/.exec(v); if(m) v=m[1]+' · '+m[2];
    o={key:head.join('.').toLowerCase(), cat:head[0]||'อื่น ๆ', name:head.filter(Boolean).join(' · '), v:v};
  } else {
    o={key:n.toLowerCase(), cat:(/waterproof\s*bag/i.test(n)?'Waterproof Bag':(n.split(/[ .]/)[0]||'อื่น ๆ')), name:n, v:''};
  }
  return (_pslFamC[n]=o);
}
function pslProdMap(){ var m=(typeof ctRead==='function')?ctRead('pos_products'):null; return (m&&typeof m==='object'&&!Array.isArray(m))?m:{}; }
/* ข้อมูลที่ใช้แสดงของสินค้าหนึ่งชื่อ · ของที่แก้ในทะเบียนทับของที่เดา */
function pslProdOf(n, PM){
  var f=pslFam(n), r=(PM||pslProdMap())[f.key]||{};
  return { key:f.key, name:r.nm||f.name, cat:r.cat||f.cat, v:f.v, img:(r.img&&r.img.url)?r.img.url:'' };
}
function pslProdSave(key, patch){
  if(!pslCanEdit()){ alert('บัญชีนี้ดูได้อย่างเดียว'); return false; }
  var m=pslProdMap(), cur=m[key]||{};
  Object.keys(patch).forEach(function(k){ if(patch[k]===null||patch[k]==='') delete cur[k]; else cur[k]=patch[k]; });
  cur.at=new Date().toISOString(); cur.by=(typeof laBy==='function'?laBy():'');
  m[key]=cur;
  if(typeof ctWrite==='function') ctWrite('pos_products', m);
  return true;
}
/* กล่องรูปเล็ก · ไม่มีรูป = ตัวอักษรแรกของประเภทบนพื้นสีประจำประเภท */
function pslCatColor(cat){ var s=String(cat||''), h=0; for(var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return ['#F3E3C8','#D6E8F5','#DDEFE3','#F5DCE6','#E3E1F2','#F7EFD2','#DCEFF0','#F1E0D6'][h%8]; }
function pslThumb(P, sz, click){
  sz=sz||34;
  var st='width:'+sz+'px;height:'+sz+'px;'+(P.img?'':'background:'+pslCatColor(P.cat)+';font-size:'+Math.round(sz*0.4)+'px');
  return '<span class="pt'+(click?' ck':'')+'" style="'+st+'"'+(click?' onclick="pslProdOpen(\''+pslE(encodeURIComponent(P.key))+'\')" title="ดูรูป / แก้ในทะเบียนสินค้า"':'')+'>'
    +(P.img?'<img src="'+pslE(P.img)+'" loading="lazy" alt="">':pslE(String(P.cat||'?').trim().slice(0,1).toUpperCase()))+'</span>';
}
/* สีประจำเรือ (ชุดเดียวกับวงกลมชื่อเรือ) · ใช้ระบายช่องที่ใส่จำนวนแล้ว */
function pslBoatColor(bid){
  var b=(typeof getBoat==='function')?getBoat(bid):null, c='';
  try{ if(typeof getBoatColor==='function'){ var gc=getBoatColor(bid); if(gc&&gc.text&&gc.text!=='#666') c=gc.fill||gc.text; } }catch(_){ }
  try{ if(!c && b && typeof flBoatAvatarColor==='function') c=flBoatAvatarColor(b); }catch(_){ }
  return /^#[0-9a-f]{6}$/i.test(c||'')?c:'#0E7C6B';
}
function pslTint(hex,a){ var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16); return 'rgba('+r+','+g+','+b+','+a+')'; }
/* ตัวอักษรบนพื้นขาว · สีเรือที่อ่อนเกินทำให้เข้มขึ้น */
function pslInk(hex){ var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16), n=0;
  while((0.2126*r+0.7152*g+0.0722*b)/255>0.45 && n<12){ r=Math.round(r*0.88); g=Math.round(g*0.88); b=Math.round(b*0.88); n++; }
  return 'rgb('+r+','+g+','+b+')'; }

/* ── ค้นหา / เฉพาะที่ยังไม่แยก · ซ่อนแถวใน DOM ไม่วาดใหม่ (ช่องค้นหาไม่เสีย focus) ── */
function pslFilter(){
  var root=document.querySelector('#psl-host-'+_psl.pier+' .psl'); if(!root) return;
  var q=String(_psl.q||'').trim().toLowerCase(), only=!!_psl.only, n=0;
  var rows=root.querySelectorAll('tr[data-s]');
  for(var i=0;i<rows.length;i++){ var r=rows[i];
    var ok=(!q || r.getAttribute('data-s').indexOf(q)>=0) && (!only || r.getAttribute('data-left')!=='0');
    r.style.display=ok?'':'none'; if(ok) n++; }
  var cats=root.querySelectorAll('tr.cat');
  for(var j=0;j<cats.length;j++){ var c=cats[j], x=c.nextElementSibling, any=false;
    while(x && !x.classList.contains('cat')){ if(x.style.display!=='none'){ any=true; break; } x=x.nextElementSibling; }
    c.style.display=any?'':'none'; }
  var em=root.querySelector('.nores'); if(em) em.style.display=n?'none':'';
}
function pslSearch(v){ _psl.q=v; pslFilter(); }
function pslOnly(){ _psl.only=!_psl.only; var b=document.querySelector('#psl-host-'+_psl.pier+' .psl .btn.only'); if(b) b.classList.toggle('on',!!_psl.only); pslFilter(); }

function renderPosSales(pier){
  if(pier) _psl.pier=pier;
  var host=document.getElementById('psl-host-'+_psl.pier); if(!host) return;
  pslCss();
  if(!_psl.date) _psl.date=(typeof TODAY_STR!=='undefined'?TODAY_STR:new Date().toISOString().slice(0,10));
  var ro=!pslCanEdit(), e=pslE, t=_psl.tab;
  var tb=function(k,l){ return '<button class="'+(t===k?'on':'')+'" onclick="pslTab(\''+k+'\')">'+l+'</button>'; };
  var h='<div class="psl"><div class="bar"><div style="margin-right:auto"><h2>ยอดขายร้านค้า · '+e(pslPierName(_psl.pier))+'</h2></div>'
    +'<div class="seg">'+tb('day','บันทึกรายวัน')+tb('an','วิเคราะห์')+tb('reg','ทะเบียนสินค้า')+'</div></div>';
  h+=(t==='an')?pslAnHtml():(t==='reg')?pslRegHtml(ro):pslDayHtml(ro);
  host.innerHTML=h+'</div>';
  _psl.flash='';
  if(t==='day') pslFilter();
}
function pslDayHtml(ro){
  var e=pslE, pier=_psl.pier, date=_psl.date, rec=pslDay(pier,date), boats=pslBoats(pier,date);
  var up=ro?'':'<label class="btn pri">&#11014; '+(rec?'อัปโหลดไฟล์ใหม่':'อัปโหลดไฟล์ POS')+'<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="pslPick(this)"></label>';
  var dnav='<div class="dt"><button class="btn" onclick="pslShift(-1)">&#8249;</button><input type="date" id="psl-date-'+e(pier)+'" value="'+e(date)+'" onchange="pslSetDate(this.value)"><button class="btn" onclick="pslShift(1)">&#8250;</button></div>';
  if(!rec){
    return '<div class="bar">'+dnav+'<span class="sub">เรือออกจากท่านี้ '+boats.length+' ลำ</span><span style="margin-left:auto"></span>'+up+'</div>'
      +(_psl.flash?'<div class="flash">&#9888; '+e(_psl.flash)+'</div>':'')
      +'<div class="empty"><b style="font-size:15px;color:#16223F">ยังไม่มีรายการขายของวันที่ '+e(date)+'</b><br>'
      +'1 · ที่เครื่อง POS ออกรายงาน <b>ยอดขายตามสินค้า</b> ของวันนี้ (วันเดียว) เป็นไฟล์ Excel<br>'
      +'2 · เลือกวันที่ด้านบนให้ตรงกับวันที่ขาย แล้วกด <b>อัปโหลดไฟล์ POS</b><br>'
      +'3 · ใส่จำนวนชิ้นที่ขายให้ลูกค้าแต่ละลำ<br><span class="sub">ไฟล์จาก POS ไม่มีวันที่และสาขา ระบบจึงใช้วันที่ที่เลือกและท่าของหน้านี้</span></div>';
  }
  var items=rec.items||[], cols=boats.slice();
  /* ลำที่เคยแยกไว้แต่วันนี้ไม่อยู่ในรายการแล้ว (ย้ายลำ/ยกเลิกทีหลัง) · ยังต้องเห็น */
  var seen={}; cols.forEach(function(b){ seen[b.id]=1; });
  items.forEach(function(it){ Object.keys(it.a||{}).forEach(function(k){ if(k!==PSL_X && !seen[k]){ seen[k]=1; var bb=(typeof getBoat==='function')?getBoat(k):null; cols.push({id:k,name:(bb&&bb.name)||k,pax:0,route:'ไม่ได้ออกจากท่านี้แล้ว',gone:1}); } }); });
  var tq=0,tn=0,tp=0,ta=0, colAmt={}, colQ={}, nLeft=0;
  items.forEach(function(it){ tq+=it.q; tn+=it.net; tp+=it.pf; var u=it.q?it.net/it.q:0, s=0;
    Object.keys(it.a||{}).forEach(function(k){ var q=+it.a[k].q||0; s+=q; ta+=q; colQ[k]=(colQ[k]||0)+q; colAmt[k]=(colAmt[k]||0)+q*u; });
    if(it.q-s>0) nLeft++; });
  var pct=tq?Math.round(ta/tq*100):0;
  /* แถบบน · วันที่ · ตัวเลขหลัก · ความคืบหน้า · ค้นหา · ปุ่ม */
  var h='<div class="bar top">'+dnav
    +'<div class="kp"><div><i>ยอดขายสุทธิ</i><b>'+pslB(tn)+'</b></div><div><i>กำไร</i><b>'+pslB(tp)+' <small>'+(tn?Math.round(tp/tn*100):0)+'%</small></b></div>'
    +'<div><i>สินค้า</i><b>'+items.length+' <small>รายการ · '+tq+' ชิ้น</small></b></div></div>'
    +'<div class="prog" title="ไฟล์ '+e(rec.f||'—')+' · '+e(rec.by||'')+' · '+e(String(rec.at||'').slice(0,10))+'"><div class="l"><span>แยกแล้ว '+ta+' / '+tq+' ชิ้น</span><span>'+pct+'%</span></div><div class="pb"><i style="width:'+pct+'%"></i></div></div>'
    +'<span style="margin-left:auto"></span>'
    +'<input class="sr" type="search" placeholder="ค้นหาสินค้า" value="'+e(_psl.q||'')+'" oninput="pslSearch(this.value)">'
    +'<button class="btn only'+(_psl.only?' on':'')+'" onclick="pslOnly()" title="แสดงเฉพาะสินค้าที่ยังแยกไม่ครบ">ยังไม่แยก · '+nLeft+'</button>'
    +up+((!ro)?'<button class="btn del" onclick="pslDelDay()" title="ลบรายการขายของวันนี้ทั้งหมด">ลบของวันนี้</button>':'')+'</div>';
  if(_psl.flash) h+='<div class="flash">&#9888; '+e(_psl.flash)+'</div>';
  if(!cols.length) h+='<div class="flash">วันที่ '+e(date)+' ไม่มีเรือออกจากท่านี้ในระบบ · ตรวจว่าเลือกวันที่ถูกไหม</div>';
  var natOf={}, colC={}; cols.forEach(function(b){ natOf[b.id]=b.gone?[]:pslBoatNats(date,b.id); colC[b.id]=pslBoatColor(b.id); });
  colC[PSL_X]='#8A5A12';
  var chip=function(id){ var c=colC[id], q=colQ[id]||0; return '<span class="qc" style="color:'+pslInk(c)+';background:'+pslTint(c,q?0.13:0.06)+'">'+q+' ชิ้น</span>'; };
  h+='<div class="wrap day"><table><thead><tr><th class="l">สินค้า</th><th>ขาย</th><th class="r">ยอดสุทธิ</th>';
  cols.forEach(function(b){ var N=natOf[b.id], tot=0; N.forEach(function(x){ tot+=x.n; });
    var mix=N.slice(0,2).map(function(x){ return x.c+' '+Math.round(x.n/(tot||1)*100)+'%'; }).join(' · ');
    var g=b.gone?[]:pslBoatGuides(date,b.id);
    h+='<th><div class="bh v2"><span class="bt">'+pslAvatar(b.id,b.name,26)+'</span><b>'+e(b.name)+'</b>'+(b.gone?'':'<span class="rt" title="'+e(b.route)+'">'+e(b.route)+'</span>')
      +'<span title="'+e(b.route)+'">'+(b.gone?e(b.route):(b.pax+' คน'+(mix?' · '+e(mix):'')))+'</span>'+(g.length?'<span title="'+e(g.join(', '))+'">'+e(g.join(', '))+'</span>':'')+chip(b.id)+'</div></th>'; });
  h+='<th><div class="bh v2"><b>ไม่ใช่ลูกค้าเรือ</b><span>walk-in / พนักงาน</span>'+chip(PSL_X)+'</div></th><th>สถานะ</th></tr></thead><tbody>';
  /* จัดกลุ่มตามประเภท · ลำดับกลุ่ม = ลำดับที่เจอในไฟล์ · i = ลำดับเดิมในไฟล์ (ตัวบันทึกอ้างเลขนี้) */
  var PM=pslProdMap(), G={}, ord=[];
  items.forEach(function(it,i){ var P=pslProdOf(it.n,PM); if(!G[P.cat]){ G[P.cat]=[]; ord.push(P.cat); } G[P.cat].push({it:it,i:i,P:P}); });
  var ncol=cols.length+5;
  ord.forEach(function(cat){
    h+='<tr class="cat"><td colspan="'+ncol+'"><b>'+e(cat)+'</b><span>'+G[cat].length+' รายการ</span></td></tr>';
    G[cat].forEach(function(x){ var it=x.it, i=x.i, P=x.P;
      var left=it.q-pslAllocSum(it), a=it.a||{};
      h+='<tr data-s="'+e((it.n+' '+P.name+' '+P.cat).toLowerCase())+'" data-left="'+left+'"><td class="l pn"><div class="pw">'+pslThumb(P,34,true)
        +'<div class="pm" title="'+e(it.n)+'"><b>'+e(P.name)+'</b>'+(P.v?'<i>'+e(P.v)+'</i>':'')+'</div></div></td><td><b>'+it.q+'</b></td><td class="r">'+pslB(it.net)+'</td>';
      cols.concat([{id:PSL_X}]).forEach(function(b){
        var c=a[b.id]||{q:0,nat:''}, N=natOf[b.id]||[], bc=colC[b.id];
        var opts='<option value="">สัญชาติ</option>'+N.map(function(y){ return '<option value="'+e(y.c)+'"'+(c.nat===y.c?' selected':'')+'>'+e(y.c)+'</option>'; }).join('')
          +((c.nat&&c.nat!=='OTH'&&!N.some(function(y){ return y.c===c.nat; }))?'<option selected value="'+e(c.nat)+'">'+e(c.nat)+'</option>':'')+'<option value="OTH"'+(c.nat==='OTH'?' selected':'')+'>อื่น ๆ</option>';
        h+='<td ondblclick="pslFill('+i+',\''+b.id+'\')" title="ดับเบิลคลิก = ใส่ที่เหลือทั้งหมด"><input class="q'+(c.q?' has':'')+'"'+(c.q?' style="border-color:'+bc+';background:'+pslTint(bc,0.1)+';color:'+pslInk(bc)+'"':'')
          +' data-k="'+i+'|'+b.id+'" type="text" inputmode="numeric" value="'+(c.q||'')+'" '+(ro?'disabled':'')+' onchange="pslSet('+i+',\''+b.id+'\',this,\'q\')" onfocus="this.select()">'
          +((b.id===PSL_X||!c.q)?'':'<select class="nat" '+(ro?'disabled':'')+' title="สัญชาติผู้ซื้อ (ไม่บังคับ)" onchange="pslSet('+i+',\''+b.id+'\',this,\'nat\')">'+opts+'</select>')+'</td>';
      });
      h+='<td>'+(left===0?'<span class="st ok">&#10003; ครบ</span>':'<span class="st lf">เหลือ '+left+'</span>')+'</td></tr>';
    });
  });
  h+='<tr class="nores" style="display:none"><td colspan="'+ncol+'">ไม่พบสินค้าที่ตรงกับตัวกรอง</td></tr>';
  h+='</tbody><tfoot><tr><td class="l">ยอดต่อลำ</td><td>'+tq+'</td><td class="r">'+pslB(tn)+'</td>';
  cols.forEach(function(b){ var am=colAmt[b.id]||0; h+='<td>'+(am?pslB(am):'—')+(b.pax&&am?'<div style="font-weight:500;font-size:10.5px;color:#6B7591">'+pslB(am/b.pax)+'/คน</div>':'')+'</td>'; });
  h+='<td>'+(colAmt[PSL_X]?pslB(colAmt[PSL_X]):'—')+'</td><td>'+(tq-ta===0?'<span class="st ok">&#10003; ครบ</span>':'<span class="st lf">เหลือ '+(tq-ta)+'</span>')+'</td></tr></tfoot></table></div>'
    +'<div class="note">ใส่จำนวนชิ้นในช่องของลำที่ซื้อ · ดับเบิลคลิกช่อง = ใส่ที่เหลือทั้งหมด · ใส่แล้วเลือกสัญชาติผู้ซื้อใต้ช่องได้ (ไม่บังคับ) · คลิกรูปเพื่อเพิ่ม/ดูรูปสินค้า · บันทึกอัตโนมัติทุกครั้งที่แก้</div>';
  return h;
}

/* ── ทะเบียนสินค้า ── */
function pslRegData(){
  var blob={}; try{ blob=(typeof laBlob==='function')?laBlob():{}; }catch(_){ }
  var PM=pslProdMap(), M={}, cut=''; try{ var d=new Date(); d.setDate(d.getDate()-30); cut=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }catch(_){ }
  Object.keys(blob).filter(function(k){ return /^pos_sales_\d{6}$/.test(k); }).forEach(function(k){
    var m=(typeof ctRead==='function')?ctRead(k):null; if(!m) return;
    Object.keys(m).forEach(function(dk){ var date=dk.split('|')[1]||'', rec=m[dk]; if(!rec||!rec.items) return;
      rec.items.forEach(function(it){ var P=pslProdOf(it.n,PM);
        var x=M[P.key]=M[P.key]||{key:P.key,name:P.name,cat:P.cat,img:P.img,vars:{},q:0,q30:0,last:'',price:0};
        if(P.v) x.vars[P.v]=1; x.q+=it.q; if(date>=cut) x.q30+=it.q;
        if(date>=x.last && it.q){ x.last=date; x.price=it.net/it.q; } }); }); });
  return Object.keys(M).map(function(k){ M[k].nv=Object.keys(M[k].vars).length; return M[k]; })
    .sort(function(a,b){ return (b.q30-a.q30)||(b.q-a.q)||a.name.localeCompare(b.name); });
}
function pslRegSet(k,v){ _psl['r'+k]=v; renderPosSales(_psl.pier); if(k==='q'){ var i=document.getElementById('psl-rq'); if(i){ i.focus(); try{ i.setSelectionRange(i.value.length,i.value.length); }catch(_){ } } } }
function pslRegHtml(ro){
  var e=pslE, L=pslRegData(), q=String(_psl.rq||'').trim().toLowerCase(), cat=_psl.rcat||'', noimg=!!_psl.rnoimg;
  var cats={}; L.forEach(function(x){ cats[x.cat]=(cats[x.cat]||0)+1; });
  var nImg=L.filter(function(x){ return x.img; }).length;
  var S=L.filter(function(x){ return (!q || (x.name+' '+x.key+' '+x.cat).toLowerCase().indexOf(q)>=0) && (!cat || x.cat===cat) && (!noimg || !x.img); });
  var h='<div class="bar top"><input class="sr" id="psl-rq" style="width:240px" type="search" placeholder="ค้นหาชื่อ / รหัส" value="'+e(_psl.rq||'')+'" onchange="pslRegSet(\'q\',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()">'
    +'<select class="btn" onchange="pslRegSet(\'cat\',this.value)"><option value="">ประเภท: ทั้งหมด</option>'+Object.keys(cats).sort().map(function(c){ return '<option value="'+e(c)+'"'+(cat===c?' selected':'')+'>'+e(c)+' ('+cats[c]+')</option>'; }).join('')+'</select>'
    +'<button class="btn only'+(noimg?' on':'')+'" onclick="pslRegSet(\'noimg\','+(noimg?'false':'true')+')">ยังไม่มีรูป · '+(L.length-nImg)+'</button>'
    +'<span style="margin-left:auto" class="sub">'+L.length+' สินค้า · มีรูปแล้ว '+nImg+'</span></div>';
  if(!L.length) return h+'<div class="empty">ยังไม่มีสินค้าในทะเบียน · สินค้าจะเข้ามาเองเมื่ออัปโหลดไฟล์ POS ในแท็บ “บันทึกรายวัน”</div>';
  if(!S.length) return h+'<div class="empty">ไม่พบสินค้าที่ตรงกับตัวกรอง</div>';
  h+='<div class="rg">';
  S.forEach(function(x){ var ek=e(encodeURIComponent(x.key));
    h+='<div class="pc" onclick="pslProdOpen(\''+ek+'\')"><div class="ph" style="background:'+pslCatColor(x.cat)+'">'
      +(x.img?'<img src="'+e(x.img)+'" loading="lazy" alt="">':(ro?'<span class="noi">ไม่มีรูป</span>':'<span class="add">&#65291; เพิ่มรูป</span>'))+'</div>'
      +'<b title="'+e(x.name)+'">'+e(x.name)+'</b><i>'+e(x.cat)+(x.nv>1?' · '+x.nv+' ไซส์/แบบ':'')+'</i>'
      +'<div class="pf"><span>'+(x.price?pslB(x.price):'—')+'</span><em>ขาย 30 วัน · '+x.q30+' ชิ้น</em></div></div>'; });
  return h+'</div><div class="note">สินค้าเข้าทะเบียนเองจากไฟล์ POS · ไซส์ของสินค้าเดียวกันรวมเป็นใบเดียว · คลิกใบเพื่อเพิ่มรูป แก้ชื่อที่ใช้แสดง หรือเปลี่ยนประเภท · ทะเบียนใช้ร่วมกันทุกท่า · ราคา = ยอดสุทธิต่อชิ้นของวันที่ขายล่าสุด</div>';
}
/* กล่องแก้สินค้า · class la-modal = ตัวดึงข้อมูลใหม่จะไม่วาดหน้าทับระหว่างเปิดอยู่ */
function pslProdClose(){ var m=document.getElementById('psl-prod-modal'); if(m) m.remove(); }
function pslProdOpen(ek){
  var key=decodeURIComponent(ek), x=pslRegData().filter(function(y){ return y.key===key; })[0]; if(!x) return;
  var e=pslE, ro=!pslCanEdit(), cats={}; pslRegData().forEach(function(y){ cats[y.cat]=1; });
  pslProdClose();
  var m=document.createElement('div'); m.id='psl-prod-modal'; m.className='la-modal psl-md';
  m.onclick=function(ev){ if(ev.target===m) pslProdClose(); };
  m.innerHTML='<div class="bx"><div class="im" style="background:'+pslCatColor(x.cat)+'">'+(x.img?'<img src="'+e(x.img)+'" alt="">':'<span class="noi">ยังไม่มีรูป</span>')+'</div>'
    +'<div class="fm"><div class="ttl">ทะเบียนสินค้า</div>'
    +'<label>ชื่อที่ใช้แสดง</label><input id="psl-pn" value="'+e(x.name)+'" '+(ro?'disabled':'')+'>'
    +'<label>ประเภท</label><input id="psl-pc" list="psl-pcl" value="'+e(x.cat)+'" '+(ro?'disabled':'')+'><datalist id="psl-pcl">'+Object.keys(cats).sort().map(function(c){ return '<option value="'+e(c)+'">'; }).join('')+'</datalist>'
    +'<div class="mt">'+(x.nv?('ไซส์/แบบ: '+e(Object.keys(x.vars).slice(0,8).join(' , '))+(x.nv>8?' …':'')+'<br>'):'')+'ราคาล่าสุด '+(x.price?pslB(x.price):'—')+' · ขายรวม '+x.q+' ชิ้น · 30 วัน '+x.q30+' ชิ้น</div>'
    +(ro?'':'<div class="ac"><label class="btn pri">&#128247; '+(x.img?'เปลี่ยนรูป':'เพิ่มรูป')+'<input type="file" accept="image/*" style="display:none" onchange="pslProdImg(\''+e(ek)+'\',this)"></label>'
      +(x.img?'<button class="btn del" onclick="pslProdImgDel(\''+e(ek)+'\')">ลบรูป</button>':'')
      +'<span style="margin-left:auto"></span><button class="btn" onclick="pslProdClose()">ปิด</button><button class="btn pri" onclick="pslProdSaveForm(\''+e(ek)+'\')">บันทึก</button></div>')
    +(ro?'<div class="ac"><span style="margin-left:auto"></span><button class="btn" onclick="pslProdClose()">ปิด</button></div>':'')
    +'</div></div>';
  document.body.appendChild(m);
}
function pslProdSaveForm(ek){
  var key=decodeURIComponent(ek), f=null; Object.keys(_pslFamC).some(function(n){ if(_pslFamC[n].key===key){ f=_pslFamC[n]; return true; } return false; });
  var nm=String((document.getElementById('psl-pn')||{}).value||'').trim(), cat=String((document.getElementById('psl-pc')||{}).value||'').trim();
  /* ตรงกับที่ระบบเดาอยู่แล้ว = ไม่ต้องเก็บ · ถ้าวันหลังปรับตัวเดาจะได้ตามไปเอง */
  if(!pslProdSave(key, { nm:(f&&nm===f.name)?'':nm, cat:(f&&cat===f.cat)?'':cat })) return;
  pslProdClose(); renderPosSales(_psl.pier);
}
function pslProdImg(ek, inp){
  var key=decodeURIComponent(ek), file=inp.files&&inp.files[0]; inp.value=''; if(!file) return;
  if(!/^image\//.test(file.type||'')){ alert('เลือกไฟล์รูปภาพ'); return; }
  var old=(pslProdMap()[key]||{}).img;
  var post=function(blob, mime){
    if(blob && blob.size>6*1024*1024){ alert('รูปใหญ่เกิน 6MB · ย่อรูปก่อน'); return; }
    var fr=new FileReader();
    fr.onload=function(){
      var b64=String(fr.result).split(',')[1]||'';
      fetch('/api/attach',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({bookingId:'pos_product', filename:(file.name||'product').replace(/\.[^.]+$/,'')+'.jpg', mime:mime||'image/jpeg', dataB64:b64})})
        .then(function(r){ return r.json(); })
        .then(function(j){ if(!j || j.error || !j.id){ alert('อัปโหลดรูปไม่สำเร็จ: '+((j&&j.error)||'ไม่ทราบสาเหตุ')); return; }
          if(!pslProdSave(key,{ img:{ id:j.id, url:'/api/attach/'+encodeURIComponent(j.id) } })) return;
          if(old && old.id && old.id!==j.id) fetch('/api/attach/'+encodeURIComponent(old.id),{method:'DELETE'}).catch(function(){});
          renderPosSales(_psl.pier); pslProdOpen(ek); })
        .catch(function(er){ alert('อัปโหลดรูปไม่สำเร็จ: '+((er&&er.message)||er)); });
    };
    fr.onerror=function(){ alert('อ่านไฟล์รูปไม่ได้'); };
    fr.readAsDataURL(blob);
  };
  if(typeof _bkV2DownscaleImage==='function') _bkV2DownscaleImage(file, 900, function(b,mm){ if(b) post(b,mm); else post(file,file.type); });
  else post(file,file.type);
}
function pslProdImgDel(ek){
  var key=decodeURIComponent(ek), old=(pslProdMap()[key]||{}).img; if(!old) return;
  if(!confirm('ลบรูปของสินค้านี้?')) return;
  if(!pslProdSave(key,{img:null})) return;
  if(old.id) fetch('/api/attach/'+encodeURIComponent(old.id),{method:'DELETE'}).catch(function(){});
  renderPosSales(_psl.pier); pslProdOpen(ek);
}

/* ── วิเคราะห์ ── */
function pslAnData(pier, mon){
  var blob={}; try{ blob=(typeof laBlob==='function')?laBlob():{}; }catch(_){ }
  var keys=Object.keys(blob).filter(function(k){ return /^pos_sales_\d{6}$/.test(k) && (mon==='all' || k==='pos_sales_'+mon.replace('-','')); });
  var A={days:0, net:0, pf:0, qty:0, alloc:0, allocAmt:0, xAmt:0, boat:{}, guide:{}, nat:{}, dom:{}, prod:{}, route:{}, br:{}, pax:0};
  keys.forEach(function(k){ var m=(typeof ctRead==='function')?ctRead(k):null; if(!m) return;
    Object.keys(m).forEach(function(dk){ var sp=dk.split('|'); if(sp[0]!==pier) return; var date=sp[1], rec=m[dk]; if(!rec||!rec.items) return;
      A.days++;
      var boats=pslBoats(pier,date), dayAmt={}, dayQ={}, dayIt={};
      rec.items.forEach(function(it){ A.net+=it.net; A.pf+=it.pf; A.qty+=it.q; var u=it.q?it.net/it.q:0;
        var P=A.prod[it.n]=A.prod[it.n]||{q:0,amt:0,by:{}}; P.q+=it.q; P.amt+=it.net;
        Object.keys(it.a||{}).forEach(function(bid){ var c=it.a[bid], q=+c.q||0, am=q*u; if(!q) return;
          A.alloc+=q; A.allocAmt+=am;
          if(bid===PSL_X){ A.xAmt+=am; return; }
          dayAmt[bid]=(dayAmt[bid]||0)+am; dayQ[bid]=(dayQ[bid]||0)+q; (dayIt[bid]=dayIt[bid]||{})[it.n]=((dayIt[bid]||{})[it.n]||0)+q; P.by[bid]=(P.by[bid]||0)+q;
          var B=A.boat[bid]=A.boat[bid]||{days:0,pax:0,amt:0,q:0,items:{}}; B.amt+=am; B.q+=q; B.items[it.n]=(B.items[it.n]||0)+q;
          var nk=c.nat||'-'; var N=A.nat[nk]=A.nat[nk]||{q:0,amt:0,items:{}}; N.q+=q; N.amt+=am; N.items[it.n]=(N.items[it.n]||0)+q;
        }); });
      boats.forEach(function(b){ var B=A.boat[b.id]=A.boat[b.id]||{days:0,pax:0,amt:0,q:0,items:{}}; B.days++; B.pax+=b.pax; A.pax+=b.pax;
        var am=dayAmt[b.id]||0;
        /* §pslRoute · โปรแกรม (เส้นทาง) ของเที่ยวนั้น · ลำเดียววิ่งหลายโปรแกรมในเดือนได้ จึงเก็บแยกทั้งสองทาง */
        B.rt=B.rt||{}; B.rt[b.route]=(B.rt[b.route]||0)+1;
        var RR=A.route[b.rid]=A.route[b.rid]||{name:b.route,trips:0,pax:0,amt:0,q:0,items:{},boats:{}};
        RR.trips++; RR.pax+=b.pax; RR.amt+=am; RR.q+=(dayQ[b.id]||0); RR.boats[b.id]=(RR.boats[b.id]||0)+1;
        Object.keys(dayIt[b.id]||{}).forEach(function(n){ RR.items[n]=(RR.items[n]||0)+dayIt[b.id][n]; });
        /* §pslBR (2026-11-11) · owner "ยอดต้องแยกกันไหม" · แถวลำ = ลำ × โปรแกรม
           ลำเดียวกันวิ่งคนละโปรแกรม ลูกค้าคนละกลุ่ม ยอดต่อหัวรวมกันแล้วเทียบกับลำอื่นไม่ได้ */
        var BR=A.br[b.id+'|'+b.rid]=A.br[b.id+'|'+b.rid]||{bid:b.id,route:b.route,days:0,pax:0,amt:0,q:0,items:{}};
        BR.days++; BR.pax+=b.pax; BR.amt+=am; BR.q+=(dayQ[b.id]||0);
        Object.keys(dayIt[b.id]||{}).forEach(function(n){ BR.items[n]=(BR.items[n]||0)+dayIt[b.id][n]; });
        pslBoatGuides(date,b.id).forEach(function(g){ var G=A.guide[g]=A.guide[g]||{trips:0,pax:0,amt:0}; G.trips++; G.pax+=b.pax; G.amt+=am; });
        var N=pslBoatNats(date,b.id), tot=0; N.forEach(function(x){ tot+=x.n; });
        var dk2=(N[0] && N[0].n/(tot||1)>=0.5)?N[0].c:'ผสม'; var D=A.dom[dk2]=A.dom[dk2]||{trips:0,pax:0,amt:0}; D.trips++; D.pax+=b.pax; D.amt+=am;
      });
    }); });
  return A;
}
function pslTop(o,n){ return Object.keys(o).sort(function(a,b){ return o[b]-o[a]; }).slice(0,n||1); }
function pslAnHtml(){
  var e=pslE, pier=_psl.pier, mon=_psl.mon||_psl.date.slice(0,7); _psl.mon=mon;
  var A=pslAnData(pier,mon);
  var h='<div class="bar"><div class="dt"><button class="btn" onclick="pslMon(-1)">&#8249;</button><b style="min-width:90px;text-align:center">'+(mon==='all'?'ทุกเดือน':e(mon))+'</b><button class="btn" onclick="pslMon(1)">&#8250;</button></div>'
    +'<button class="btn" onclick="pslMon(\'all\')">ทุกเดือน</button><span class="sub">'+A.days+' วันที่มีข้อมูล</span></div>';
  if(!A.days) return h+'<div class="empty">ยังไม่มีข้อมูลยอดขายของช่วงนี้ · อัปโหลดไฟล์ POS ในแท็บ “บันทึกรายวัน” ก่อน</div>';
  var boatAmt=A.allocAmt-A.xAmt, avg=A.pax?boatAmt/A.pax:0, pct=A.qty?Math.round(A.alloc/A.qty*100):0;
  h+='<div class="tiles"><div class="tile"><div class="l">ยอดขายสุทธิ</div><div class="v">'+pslB(A.net)+'</div><div class="s">กำไร '+pslB(A.pf)+'</div></div>'
    +'<div class="tile"><div class="l">ขายให้ลูกค้าเรือ</div><div class="v">'+pslB(boatAmt)+'</div><div class="s">ไม่ใช่ลูกค้าเรือ '+pslB(A.xAmt)+'</div></div>'
    +'<div class="tile"><div class="l">เฉลี่ยต่อหัวลูกค้าเรือ</div><div class="v">'+pslB(avg)+'</div><div class="s">ลูกค้า '+A.pax.toLocaleString()+' คน</div></div>'
    +'<div class="tile"><div class="l">แยกลำแล้ว</div><div class="v">'+pct+'%</div><div class="pb"><i style="width:'+pct+'%"></i></div></div></div>';
  if(pct<80) h+='<div class="flash">แยกลำแล้ว '+pct+'% ของชิ้นที่ขาย · ตัวเลขรายลำและรายไกด์ด้านล่างยังต่ำกว่าจริง จนกว่าจะแยกครบ</div>';
  var bar=function(v,mx){ return '<i class="hb" style="width:'+Math.max(2,Math.round((mx?v/mx:0)*70))+'px"></i>'; };
  /* §pslRoute · โปรแกรม */
  var rk=Object.keys(A.route).sort(function(a,b){ var x=A.route[a], y=A.route[b]; return (y.pax?y.amt/y.pax:0)-(x.pax?x.amt/x.pax:0); });
  var mxR=0; rk.forEach(function(k){ var x=A.route[k]; mxR=Math.max(mxR,x.pax?x.amt/x.pax:0); });
  h+='<div class="card"><h3>โปรแกรมไหนขายดี <small>ลูกค้าแต่ละโปรแกรมซื้อเฉลี่ยคนละเท่าไร · เรียงตามยอดต่อหัว</small></h3><div class="ov"><table><thead><tr><th class="l">โปรแกรม</th><th>เที่ยว</th><th>ลูกค้า</th><th>ยอดขาย</th><th>ชิ้น</th><th class="l">ยอด/หัว</th><th class="l">สินค้าขายดี</th><th class="l">เรือ</th></tr></thead><tbody>';
  rk.forEach(function(k){ var x=A.route[k], pp=x.pax?x.amt/x.pax:0;
    h+='<tr><td class="l nm">'+e(x.name)+'</td><td>'+x.trips+'</td><td>'+x.pax+'</td><td class="r">'+pslB(x.amt)+'</td><td>'+x.q+'</td><td class="l">'+bar(pp,mxR)+'<b>'+pslB(pp)+'</b></td>'
      +'<td class="l" style="font-size:11.5px">'+e(pslTop(x.items,2).map(function(n){ return n.slice(0,34)+' ×'+x.items[n]; }).join(' · ')||'—')+'</td>'
      +'<td class="l" style="font-size:11.5px;white-space:nowrap">'+pslTop(x.boats,9).map(function(id){ var b=(typeof getBoat==='function')?getBoat(id):null; return pslAvatar(id,(b&&b.name)||id,20); }).join(' ')+'</td></tr>'; });
  h+='</tbody></table></div></div>';
  /* ลำ × โปรแกรม · §pslBR */
  var bk=Object.keys(A.br).sort(function(a,b){ var x=A.br[a], y=A.br[b]; return (y.pax?y.amt/y.pax:0)-(x.pax?x.amt/x.pax:0); });
  var mxB=0; bk.forEach(function(k){ var x=A.br[k]; mxB=Math.max(mxB,x.pax?x.amt/x.pax:0); });
  var nRt={}; bk.forEach(function(k){ var id=A.br[k].bid; nRt[id]=(nRt[id]||0)+1; });
  h+='<div class="card"><h3>ลำไหนขายดี <small>1 แถว = ลำ × โปรแกรม · ลำที่วิ่งหลายโปรแกรมแยกแถว · เรียงตามยอดต่อหัว · นับทุกเที่ยวที่ออกในวันที่มีข้อมูล แม้ไม่มียอดขาย</small></h3><div class="ov"><table><thead><tr><th class="l">เรือ</th><th class="l">โปรแกรม</th><th>เที่ยว</th><th>ลูกค้า</th><th>ยอดขาย</th><th>ชิ้น</th><th class="l">ยอด/หัว</th><th class="l">สินค้าขายดี</th></tr></thead><tbody>';
  bk.forEach(function(k){ var x=A.br[k], b=(typeof getBoat==='function')?getBoat(x.bid):null, pp=x.pax?x.amt/x.pax:0;
    h+='<tr><td class="l nm">'+pslBoatTag(x.bid,(b&&b.name)||x.bid,28)+(nRt[x.bid]>1?' <span style="font-size:10.5px;font-weight:500;color:#6B7591">'+nRt[x.bid]+' โปรแกรม</span>':'')+'</td><td class="l" style="font-size:12px">'+e(x.route)+'</td><td>'+x.days+'</td><td>'+x.pax+'</td><td class="r">'+pslB(x.amt)+'</td><td>'+x.q+'</td><td class="l">'+bar(pp,mxB)+'<b>'+pslB(pp)+'</b></td><td class="l" style="font-size:11.5px">'+e(pslTop(x.items,2).map(function(n){ return n.slice(0,34)+' ×'+x.items[n]; }).join(' · ')||'—')+'</td></tr>'; });
  h+='</tbody></table></div></div>';
  /* ไกด์ */
  var gk=Object.keys(A.guide).sort(function(a,b){ var x=A.guide[a], y=A.guide[b]; return (y.pax?y.amt/y.pax:0)-(x.pax?x.amt/x.pax:0); });
  h+='<div class="card"><h3>ไกด์บนเรือกับยอดขาย <small>ยอดของลำนับให้ไกด์ทุกคนบนลำนั้น · เฉลี่ยท่า '+pslB(avg)+'/หัว</small></h3>';
  if(!gk.length) h+='<div class="note">ยังไม่มีใบสั่งงานไกด์ของเที่ยวในช่วงนี้</div>';
  else{ var mxG=0; gk.forEach(function(k){ var x=A.guide[k]; mxG=Math.max(mxG,x.pax?x.amt/x.pax:0); });
    h+='<div class="ov"><table><thead><tr><th class="l">ไกด์</th><th>เที่ยว</th><th>ลูกค้า</th><th>ยอดขายของลำ</th><th class="l">ยอด/หัว</th><th>เทียบเฉลี่ย</th></tr></thead><tbody>';
    gk.forEach(function(k){ var x=A.guide[k], pp=x.pax?x.amt/x.pax:0, d=avg?Math.round((pp/avg-1)*100):0;
      h+='<tr><td class="l nm">'+e(k)+(x.trips<5?' <span style="font-weight:500;color:#9A5B00;font-size:10.5px">ข้อมูลน้อย</span>':'')+'</td><td>'+x.trips+'</td><td>'+x.pax+'</td><td class="r">'+pslB(x.amt)+'</td><td class="l">'+bar(pp,mxG)+'<b>'+pslB(pp)+'</b></td><td style="font-weight:700;color:'+(d>=0?'#0E7C6B':'#B42B26')+'">'+(d>=0?'+':'')+d+'%</td></tr>'; });
    h+='</tbody></table></div><div class="note">ไกด์มักประจำเส้นทางและกลุ่มสัญชาติเดิม ยอดที่ต่างกันอาจมาจากเส้นทางหรือลูกค้า ไม่ใช่ตัวไกด์ · ต่ำกว่า 5 เที่ยวยังสรุปไม่ได้</div>'; }
  h+='</div>';
  /* สัญชาติผู้ซื้อ */
  var nk=Object.keys(A.nat).sort(function(a,b){ return A.nat[b].amt-A.nat[a].amt; });
  h+='<div class="card"><h3>สัญชาติผู้ซื้อ ซื้ออะไร <small>จากช่องสัญชาติที่คนขายเลือกตอนแยกลำ</small></h3><div class="ov"><table><thead><tr><th class="l">สัญชาติ</th><th>ชิ้น</th><th>ยอดขาย</th><th class="l">สินค้าที่ซื้อมากสุด</th></tr></thead><tbody>';
  nk.forEach(function(k){ var x=A.nat[k];
    h+='<tr><td class="l nm">'+(k==='-'?'<span style="color:#6B7591">ไม่ได้ระบุ</span>':(k==='OTH'?'อื่น ๆ':e(k+' · '+pslNatName(k))))+'</td><td>'+x.q+'</td><td class="r">'+pslB(x.amt)+'</td><td class="l" style="font-size:11.5px">'+e(pslTop(x.items,3).map(function(n){ return n.slice(0,34)+' ×'+x.items[n]; }).join(' · '))+'</td></tr>'; });
  h+='</tbody></table></div></div>';
  /* สัญชาติหลักของลำ */
  var dk=Object.keys(A.dom).sort(function(a,b){ var x=A.dom[a], y=A.dom[b]; return (y.pax?y.amt/y.pax:0)-(x.pax?x.amt/x.pax:0); });
  h+='<div class="card"><h3>ยอดต่อหัว ตามสัญชาติหลักของลำ <small>ลำที่ลูกค้าเกินครึ่งเป็นสัญชาติเดียว · ที่เหลือ = ผสม</small></h3><div class="ov"><table><thead><tr><th class="l">สัญชาติหลัก</th><th>เที่ยว</th><th>ลูกค้า</th><th>ยอดขาย</th><th class="l">ยอด/หัว</th></tr></thead><tbody>';
  var mxD=0; dk.forEach(function(k){ var x=A.dom[k]; mxD=Math.max(mxD,x.pax?x.amt/x.pax:0); });
  dk.forEach(function(k){ var x=A.dom[k], pp=x.pax?x.amt/x.pax:0;
    h+='<tr><td class="l nm">'+e(k==='ผสม'?k:(k+' · '+pslNatName(k)))+'</td><td>'+x.trips+'</td><td>'+x.pax+'</td><td class="r">'+pslB(x.amt)+'</td><td class="l">'+bar(pp,mxD)+'<b>'+pslB(pp)+'</b></td></tr>'; });
  h+='</tbody></table></div></div>';
  /* สินค้า */
  var pk=Object.keys(A.prod).sort(function(a,b){ return A.prod[b].amt-A.prod[a].amt; }).slice(0,20);
  h+='<div class="card"><h3>สินค้าขายดี 20 อันดับ</h3><div class="ov"><table><thead><tr><th class="l">สินค้า</th><th>ชิ้น</th><th>ยอดขาย</th><th class="l">ลำที่ซื้อมากสุด</th></tr></thead><tbody>';
  pk.forEach(function(n){ var x=A.prod[n];
    var _P=pslProdOf(n);
    h+='<tr><td class="l nm"><div class="pw">'+pslThumb(_P,30,true)+'<div class="pm" title="'+e(n)+'"><b>'+e(_P.name)+'</b>'+(_P.v?'<i>'+e(_P.v)+'</i>':'')+'</div></div></td><td>'+x.q+'</td><td class="r">'+pslB(x.amt)+'</td><td class="l" style="font-size:11.5px">'+e(pslTop(x.by,2).map(function(k){ var b=(typeof getBoat==='function')?getBoat(k):null; return ((b&&b.name)||k)+' ×'+x.by[k]; }).join(' · ')||'—')+'</td></tr>'; });
  h+='</tbody></table></div></div>';
  return h;
}
