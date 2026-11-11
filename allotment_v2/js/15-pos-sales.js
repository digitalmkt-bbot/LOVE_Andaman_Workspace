/* ══ §posSales (2026-11-11) · ยอดขายร้านค้า (POS) แยกรายลำ ═══════════════════════════════
   owner: "อัพเดทรายการขายจาก POS เข้าฐานข้อมูล · ให้ User แยกรายการขายรายลำ · ภูเก็ต/ทับละมุแยกกัน
           เพื่อวิเคราะห์ ลำไหนขายดี · ลค สัญชาติอะไร ซื้ออะไร · ไกด์บนเรือมีผลต่อการขายไหม"
   POS (GPOS) ออกรายงานได้แค่ "สรุปตามสินค้า" (ชื่อสินค้า · ช่องทาง · ยอดขายสุทธิ · จำนวน · กำไร · อัตรากำไร)
   ไม่มีวันที่ ไม่มีสาขา ไม่มีเลขบิล → คนขายเลือกวัน + อัปโหลดในหน้าของท่าตัวเอง แล้วแยกจำนวนลงลำเอง (ไม่เดา)

   เก็บ · ctWrite('pos_sales_YYYYMM') = { 'pier|YYYY-MM-DD': {f,at,by,items:[{n,q,net,pf,a:{boatId:{q,nat}}}]} }
     แยกก้อนรายเดือน กัน blob โต · smerge ของเซิร์ฟเวอร์รวมราย sub-key → สองท่าบันทึกพร้อมกันไม่ทับกัน
     a['_x'] = ไม่ใช่ลูกค้าเรือ (walk-in / พนักงาน) · nat = สัญชาติผู้ซื้อ (ไม่บังคับ)
   ไม่แตะข้อมูลเดิมใด ๆ · อ่าน TRIPS / SB_BOOKINGS / ใบสั่งงานไกด์ อย่างเดียว */
var _psl={ pier:'panwa', date:(typeof TODAY_STR!=='undefined'?TODAY_STR:''), tab:'day', mon:'' };
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
  +'.psl .bh{display:flex;flex-direction:column;align-items:center;gap:1px}.psl .bh b{font-size:12.5px;color:#16223F}.psl .bh span{font-weight:500;font-size:10px;color:#6B7591;max-width:130px;overflow:hidden;text-overflow:ellipsis}'
  +'.psl input.q{width:46px;text-align:center;border:1px solid #D5DBE7;border-radius:7px;padding:5px 2px;font:700 13px inherit;font-family:inherit;background:#fff}.psl input.q.has{background:#E2F4F0;border-color:#0E7C6B;color:#0A5C4F}.psl input.q:disabled{background:#F5F7FB;color:#9AA3B8}'
  +'.psl select.nat{display:block;margin:3px auto 0;width:62px;font-size:10px;border:1px solid #D5DBE7;border-radius:6px;padding:1px;background:#fff;color:#4B5675}.psl select.nat.off{visibility:hidden}'
  +'.psl .left{font-weight:700;color:#B45309}.psl .left.ok{color:#0E7C6B}'
  +'.psl .wrap tfoot td{position:sticky;bottom:0;background:#F5F7FB;font-weight:700;border-top:1px solid #E1E6EF;z-index:1}.psl .wrap tfoot td:first-child{background:#F5F7FB;z-index:2}'
  +'.psl .empty{background:#fff;border:1.5px dashed #C9D1E0;border-radius:14px;padding:34px 24px;text-align:center;color:#4B5675;line-height:1.8}'
  +'.psl .flash{background:#FDF1DD;color:#9A5B00;border-radius:9px;padding:8px 12px;margin-bottom:10px;font-weight:600}'
  +'.psl .card{background:#fff;border:1px solid #E1E6EF;border-radius:12px;margin-bottom:14px;overflow:hidden}.psl .card h3{font-size:14px;margin:0;padding:11px 14px;border-bottom:1px solid #E1E6EF;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.psl .card h3 small{font-weight:500;color:#6B7591;font-size:11.5px}'
  +'.psl .card .ov{overflow-x:auto}'
  +'.psl .hb{display:inline-block;height:8px;border-radius:4px;background:#1683C7;vertical-align:middle;margin-right:6px}'
  +'.psl .note{font-size:11.5px;color:#6B7591;padding:8px 14px}';
  document.head.appendChild(s);
}

function renderPosSales(pier){
  if(pier) _psl.pier=pier;
  var host=document.getElementById('psl-host-'+_psl.pier); if(!host) return;
  pslCss();
  if(!_psl.date) _psl.date=(typeof TODAY_STR!=='undefined'?TODAY_STR:new Date().toISOString().slice(0,10));
  var ro=!pslCanEdit(), e=pslE;
  var h='<div class="psl"><div class="bar"><div style="margin-right:auto"><h2>ยอดขายร้านค้า · '+e(pslPierName(_psl.pier))+'</h2>'
    +'<div class="sub">อัปโหลดรายงานยอดขายตามสินค้าจาก POS แล้วแยกว่าขายให้ลูกค้าลำไหน</div></div>'
    +'<div class="seg"><button class="'+(_psl.tab==='day'?'on':'')+'" onclick="pslTab(\'day\')">บันทึกรายวัน</button><button class="'+(_psl.tab==='an'?'on':'')+'" onclick="pslTab(\'an\')">วิเคราะห์</button></div></div>';
  h+=(_psl.tab==='an')?pslAnHtml():pslDayHtml(ro);
  host.innerHTML=h+'</div>';
  _psl.flash='';
}
function pslDayHtml(ro){
  var e=pslE, pier=_psl.pier, date=_psl.date, rec=pslDay(pier,date), boats=pslBoats(pier,date);
  var up=ro?'':'<label class="btn pri">&#11014; '+(rec?'อัปโหลดไฟล์ใหม่':'อัปโหลดไฟล์ POS')+'<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="pslPick(this)"></label>';
  var h='<div class="bar"><div class="dt"><button class="btn" onclick="pslShift(-1)">&#8249;</button><input type="date" id="psl-date-'+e(pier)+'" value="'+e(date)+'" onchange="pslSetDate(this.value)"><button class="btn" onclick="pslShift(1)">&#8250;</button></div>'
    +'<span class="sub">เรือออกจากท่านี้ '+boats.length+' ลำ</span><span style="margin-left:auto"></span>'+up
    +((rec&&!ro)?'<button class="btn del" onclick="pslDelDay()">ลบของวันนี้</button>':'')+'</div>';
  if(_psl.flash) h+='<div class="flash">&#9888; '+e(_psl.flash)+'</div>';
  if(!rec){
    return h+'<div class="empty"><b style="font-size:15px;color:#16223F">ยังไม่มีรายการขายของวันที่ '+e(date)+'</b><br>'
      +'1 · ที่เครื่อง POS ออกรายงาน <b>ยอดขายตามสินค้า</b> ของวันนี้ (วันเดียว) เป็นไฟล์ Excel<br>'
      +'2 · เลือกวันที่ด้านบนให้ตรงกับวันที่ขาย แล้วกด <b>อัปโหลดไฟล์ POS</b><br>'
      +'3 · ใส่จำนวนชิ้นที่ขายให้ลูกค้าแต่ละลำ<br><span class="sub">ไฟล์จาก POS ไม่มีวันที่และสาขา ระบบจึงใช้วันที่ที่เลือกและท่าของหน้านี้</span></div>';
  }
  var items=rec.items||[], cols=boats.slice();
  /* ลำที่เคยแยกไว้แต่วันนี้ไม่อยู่ในรายการแล้ว (ย้ายลำ/ยกเลิกทีหลัง) · ยังต้องเห็น */
  var seen={}; cols.forEach(function(b){ seen[b.id]=1; });
  items.forEach(function(it){ Object.keys(it.a||{}).forEach(function(k){ if(k!==PSL_X && !seen[k]){ seen[k]=1; var bb=(typeof getBoat==='function')?getBoat(k):null; cols.push({id:k,name:(bb&&bb.name)||k,pax:0,route:'ไม่ได้ออกจากท่านี้แล้ว',gone:1}); } }); });
  var tq=0,tn=0,tp=0,ta=0, colAmt={}, colQ={};
  items.forEach(function(it){ tq+=it.q; tn+=it.net; tp+=it.pf; var u=it.q?it.net/it.q:0;
    Object.keys(it.a||{}).forEach(function(k){ var q=+it.a[k].q||0; ta+=q; colQ[k]=(colQ[k]||0)+q; colAmt[k]=(colAmt[k]||0)+q*u; }); });
  var pct=tq?Math.round(ta/tq*100):0;
  h+='<div class="tiles">'
    +'<div class="tile"><div class="l">ยอดขายสุทธิ</div><div class="v">'+pslB(tn)+'</div><div class="s">'+items.length+' สินค้า · '+tq+' ชิ้น</div></div>'
    +'<div class="tile"><div class="l">กำไร</div><div class="v">'+pslB(tp)+'</div><div class="s">'+(tn?Math.round(tp/tn*100):0)+'% ของยอดขาย</div></div>'
    +'<div class="tile"><div class="l">แยกแล้ว</div><div class="v">'+ta+' / '+tq+' ชิ้น</div><div class="pb"><i style="width:'+pct+'%"></i></div></div>'
    +'<div class="tile"><div class="l">ไฟล์</div><div class="v" style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e(rec.f||'—')+'</div><div class="s">'+e(rec.by||'')+' · '+e(String(rec.at||'').slice(0,10))+'</div></div></div>';
  if(!cols.length) h+='<div class="flash">วันที่ '+e(date)+' ไม่มีเรือออกจากท่านี้ในระบบ · ตรวจว่าเลือกวันที่ถูกไหม</div>';
  var natOf={}; cols.forEach(function(b){ natOf[b.id]=b.gone?[]:pslBoatNats(date,b.id); });
  h+='<div class="wrap"><table><thead><tr><th class="l">สินค้า</th><th>ขาย</th><th>ยอดสุทธิ</th>';
  cols.forEach(function(b){ var N=natOf[b.id], tot=0; N.forEach(function(x){ tot+=x.n; });
    var mix=N.slice(0,2).map(function(x){ return x.c+' '+Math.round(x.n/(tot||1)*100)+'%'; }).join(' · ');
    var g=b.gone?[]:pslBoatGuides(date,b.id);
    h+='<th><div class="bh"><b>'+e(b.name)+'</b><span title="'+e(b.route)+'">'+(b.gone?e(b.route):(b.pax+' คน'+(mix?' · '+e(mix):'')))+'</span>'+(g.length?'<span title="'+e(g.join(', '))+'">'+e(g.join(', '))+'</span>':'')+'</div></th>'; });
  h+='<th><div class="bh"><b>ไม่ใช่ลูกค้าเรือ</b><span>walk-in / พนักงาน</span></div></th><th>เหลือ</th></tr></thead><tbody>';
  items.forEach(function(it,i){
    var left=it.q-pslAllocSum(it), a=it.a||{};
    h+='<tr><td class="l nm">'+e(it.n)+'</td><td><b>'+it.q+'</b></td><td class="r">'+pslB(it.net)+'</td>';
    cols.concat([{id:PSL_X}]).forEach(function(b){
      var c=a[b.id]||{q:0,nat:''}, N=natOf[b.id]||[];
      var opts='<option value="">สัญชาติ</option>'+N.map(function(x){ return '<option value="'+e(x.c)+'"'+(c.nat===x.c?' selected':'')+'>'+e(x.c)+'</option>'; }).join('')
        +((c.nat&&c.nat!=='OTH'&&!N.some(function(x){ return x.c===c.nat; }))?'<option selected value="'+e(c.nat)+'">'+e(c.nat)+'</option>':'')+'<option value="OTH"'+(c.nat==='OTH'?' selected':'')+'>อื่น ๆ</option>';
      h+='<td ondblclick="pslFill('+i+',\''+b.id+'\')" title="ดับเบิลคลิก = ใส่ที่เหลือทั้งหมด"><input class="q'+(c.q?' has':'')+'" data-k="'+i+'|'+b.id+'" type="text" inputmode="numeric" value="'+(c.q||'')+'" '+(ro?'disabled':'')+' onchange="pslSet('+i+',\''+b.id+'\',this,\'q\')" onfocus="this.select()">'
        +(b.id===PSL_X?'':'<select class="nat'+(c.q?'':' off')+'" '+(ro?'disabled':'')+' title="สัญชาติผู้ซื้อ (ไม่บังคับ)" onchange="pslSet('+i+',\''+b.id+'\',this,\'nat\')">'+opts+'</select>')+'</td>';
    });
    h+='<td class="left'+(left===0?' ok':'')+'">'+(left===0?'&#10003;':left)+'</td></tr>';
  });
  h+='</tbody><tfoot><tr><td class="l">ยอดต่อลำ</td><td>'+tq+'</td><td class="r">'+pslB(tn)+'</td>';
  cols.forEach(function(b){ var am=colAmt[b.id]||0; h+='<td>'+(am?pslB(am):'—')+'<div style="font-weight:500;font-size:10.5px;color:#6B7591">'+(colQ[b.id]||0)+' ชิ้น'+(b.pax&&am?' · '+pslB(am/b.pax)+'/คน':'')+'</div></td>'; });
  h+='<td>'+(colAmt[PSL_X]?pslB(colAmt[PSL_X]):'—')+'</td><td class="left'+(tq-ta===0?' ok':'')+'">'+(tq-ta===0?'&#10003;':(tq-ta))+'</td></tr></tfoot></table></div>'
    +'<div class="note">ใส่จำนวนชิ้นในช่องของลำที่ซื้อ · ดับเบิลคลิกช่อง = ใส่ที่เหลือทั้งหมด · เลือกสัญชาติผู้ซื้อใต้ช่องได้ (ไม่บังคับ) · บันทึกอัตโนมัติทุกครั้งที่แก้</div>';
  return h;
}

/* ── วิเคราะห์ ── */
function pslAnData(pier, mon){
  var blob={}; try{ blob=(typeof laBlob==='function')?laBlob():{}; }catch(_){ }
  var keys=Object.keys(blob).filter(function(k){ return /^pos_sales_\d{6}$/.test(k) && (mon==='all' || k==='pos_sales_'+mon.replace('-','')); });
  var A={days:0, net:0, pf:0, qty:0, alloc:0, allocAmt:0, xAmt:0, boat:{}, guide:{}, nat:{}, dom:{}, prod:{}, pax:0};
  keys.forEach(function(k){ var m=(typeof ctRead==='function')?ctRead(k):null; if(!m) return;
    Object.keys(m).forEach(function(dk){ var sp=dk.split('|'); if(sp[0]!==pier) return; var date=sp[1], rec=m[dk]; if(!rec||!rec.items) return;
      A.days++;
      var boats=pslBoats(pier,date), dayAmt={};
      rec.items.forEach(function(it){ A.net+=it.net; A.pf+=it.pf; A.qty+=it.q; var u=it.q?it.net/it.q:0;
        var P=A.prod[it.n]=A.prod[it.n]||{q:0,amt:0,by:{}}; P.q+=it.q; P.amt+=it.net;
        Object.keys(it.a||{}).forEach(function(bid){ var c=it.a[bid], q=+c.q||0, am=q*u; if(!q) return;
          A.alloc+=q; A.allocAmt+=am;
          if(bid===PSL_X){ A.xAmt+=am; return; }
          dayAmt[bid]=(dayAmt[bid]||0)+am; P.by[bid]=(P.by[bid]||0)+q;
          var B=A.boat[bid]=A.boat[bid]||{days:0,pax:0,amt:0,q:0,items:{}}; B.amt+=am; B.q+=q; B.items[it.n]=(B.items[it.n]||0)+q;
          var nk=c.nat||'-'; var N=A.nat[nk]=A.nat[nk]||{q:0,amt:0,items:{}}; N.q+=q; N.amt+=am; N.items[it.n]=(N.items[it.n]||0)+q;
        }); });
      boats.forEach(function(b){ var B=A.boat[b.id]=A.boat[b.id]||{days:0,pax:0,amt:0,q:0,items:{}}; B.days++; B.pax+=b.pax; A.pax+=b.pax;
        var am=dayAmt[b.id]||0;
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
  /* ลำ */
  var bk=Object.keys(A.boat).sort(function(a,b){ var x=A.boat[a], y=A.boat[b]; return (y.pax?y.amt/y.pax:0)-(x.pax?x.amt/x.pax:0); });
  var mxB=0; bk.forEach(function(k){ var x=A.boat[k]; mxB=Math.max(mxB,x.pax?x.amt/x.pax:0); });
  h+='<div class="card"><h3>ลำไหนขายดี <small>เรียงตามยอดต่อหัว · นับทุกเที่ยวที่ออกในวันที่มีข้อมูล แม้ไม่มียอดขาย</small></h3><div class="ov"><table><thead><tr><th class="l">เรือ</th><th>เที่ยว</th><th>ลูกค้า</th><th>ยอดขาย</th><th>ชิ้น</th><th class="l">ยอด/หัว</th><th class="l">สินค้าขายดี</th></tr></thead><tbody>';
  bk.forEach(function(k){ var x=A.boat[k], b=(typeof getBoat==='function')?getBoat(k):null, pp=x.pax?x.amt/x.pax:0;
    h+='<tr><td class="l nm">'+e((b&&b.name)||k)+'</td><td>'+x.days+'</td><td>'+x.pax+'</td><td class="r">'+pslB(x.amt)+'</td><td>'+x.q+'</td><td class="l">'+bar(pp,mxB)+'<b>'+pslB(pp)+'</b></td><td class="l" style="font-size:11.5px">'+e(pslTop(x.items,2).map(function(n){ return n.slice(0,34)+' ×'+x.items[n]; }).join(' · ')||'—')+'</td></tr>'; });
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
    h+='<tr><td class="l nm">'+e(n)+'</td><td>'+x.q+'</td><td class="r">'+pslB(x.amt)+'</td><td class="l" style="font-size:11.5px">'+e(pslTop(x.by,2).map(function(k){ var b=(typeof getBoat==='function')?getBoat(k):null; return ((b&&b.name)||k)+' ×'+x.by[k]; }).join(' · ')||'—')+'</td></tr>'; });
  h+='</tbody></table></div></div>';
  return h;
}
