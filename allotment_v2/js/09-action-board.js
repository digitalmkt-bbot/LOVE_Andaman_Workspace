/* ════════════════════════════════════════════════════════════════════════════
   §abBoard · หน้า Action Board  (เมนู Overview › Action Board)

   หน้านี้ไม่ใช่รายงาน · เป็น "รายการที่ต้องลงมือวันนี้"
   ทุกบล็อกตอบคำถามเดียวกัน: ตอนนี้ควรโทรหาใคร / ควรตัดสินใจอะไร

   บน    = ตาราง เส้นทาง × 7/14 วัน · ที่ว่างกองอยู่เส้นทางไหน วันไหน
   ล่าง  = 3 คอลัมน์ · ที่นั่งที่มีเส้นตาย | เอเย่นต์ที่ต้องตาม | เอเย่นต์ที่ต้องเช็ค

   ตัวเลขทุกตัวใช้ของกลางที่หน้าอื่นใช้อยู่แล้ว ไม่คำนวณเองซ้ำ:
     getAllotment(routeId,ds) · TRIPS · SB_BOOKINGS · SB_AGENTS · SB_SALES
   ═══════════════════════════════════════════════════════════════════════════ */

window._abSales = '';    // '' = ทุกเซลส์
window._abPier  = '';    // '' = ทุกท่า · ตัวกรองของตารางที่นั่ง
/* §abBy · แท่งในช่องนับเป็นของใคร · 'sales' = เซลส์ผู้ดูแล · 'agent' = เอเย่นต์
   ตั้งต้นเป็นเซลส์ เพราะคำถามประจำวันคือ "ลูกค้าของเซลส์คนไหน"
   ส่วนรายเอเย่นต์เป็นการเจาะลงอีกชั้น กดสลับได้ */
window._abBy    = 'sales';
window._abDays  = 7;     // ตารางกลาง · 7 หรือ 14 วัน

function _abEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* §abEN · หน้านี้ใช้ภาษาอังกฤษทั้งหน้า (คนละอย่างกับหน้าอื่นในแอปที่เป็นไทย)
   วันที่/เดือนจึงต้องเป็นอังกฤษด้วย ไม่งั้นจะปนกันครึ่ง ๆ */
const _AB_MON  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const _AB_MONL = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
const _AB_DOW  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function _abDate(ds){ return new Date(ds+'T12:00:00'); }
function _abDow(ds){ return _AB_DOW[_abDate(ds).getDay()]; }
function _abDayLbl(ds){ var d=_abDate(ds); return d.getDate()+' '+_AB_MON[d.getMonth()]; }
function _abMonFull(ym){ return _AB_MONL[(+ym.slice(5,7))-1]+' '+ym.slice(0,4); }
function _abMonShift(ym,k){ var y=+ym.slice(0,4), m=+ym.slice(5,7);
  var d=new Date(y,m-1+k,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function _abMonLbl(ym){ return _AB_MON[(+ym.slice(5,7))-1]; }
function _abDaysBetween(a,b){ return Math.round((_abDate(b)-_abDate(a))/86400000); }
function _abMoney(n){
  n=Math.round(+n||0);
  if(n>=1000000) return '฿'+(n/1000000).toFixed(n>=10000000?0:1)+'M';
  if(n>=1000)    return '฿'+Math.round(n/1000)+'k';
  return '฿'+n;
}
/* สีเดียวกับปฏิทินที่นั่งในหน้า Dashboard · ขายได้มาก = เขียว · ว่างเยอะ = แดง
   คนที่สลับสองหน้านี้จะได้อ่านสีแบบเดียวกัน ไม่ต้องจำสองชุด */
function _abFillCol(p){
  if(p>=95) return ['#BCE595','#1F4D2C'];
  if(p>=80) return ['#CFE9AC','#1F4D2C'];
  if(p>=60) return ['#E8F5D8','#3B6D11'];
  if(p>=40) return ['#FAF0C8','#8A6A0B'];
  if(p>=20) return ['#FBE1C6','#B4600F'];
  return              ['#FBE9E9','#A32D2D'];
}

function _abSalesList(){ return (typeof SB_SALES!=='undefined' && Array.isArray(SB_SALES)) ? SB_SALES : []; }
function _abAgentMap(){
  var m={}; ((typeof SB_AGENTS!=='undefined'&&Array.isArray(SB_AGENTS))?SB_AGENTS:[]).forEach(function(a){ m[a.id]=a; });
  return m;
}
function _abSalesOf(ag){ return (ag && ag.sales) || ''; }
/* §abAgPill · "สีเอเย่นต์คาดชื่อเอเย่นต์เลย เป็นเหมือนในหน้า By trip date"
   หน้า By trip date วาดชื่อเอเย่นต์เป็นบล็อกสีทึบ + ตัวหนังสือสีตัดกัน (.ck-agblk)
   ทำแบบเดียวกันที่นี่ · ใช้ bkV2AgentColor + bkV2ContrastInk ตัวเดียวกันเป๊ะ
   จุดกลม (.ab-adot) เดิมเล็กเกินไป และสีอ่อน ๆ อย่าง #fff838 แทบมองไม่เห็นบนพื้นขาว */
function _abAgPill(aid,name){
  var t=_abEsc(name||'');
  if(!aid) return '<b class="ab-apill none">'+t+'</b>';
  var c=(typeof bkV2AgentColor==='function')?bkV2AgentColor(aid):'#8a857d';
  var ink=(typeof bkV2ContrastInk==='function')?bkV2ContrastInk(c):'#fff';
  return '<b class="ab-apill" style="background:'+c+';color:'+ink+'" title="'+t+'">'+t+'</b>';
}
function _abSalesChip(sid){
  var s=_abSalesList().find(function(x){return x.id===sid;});
  if(!s) return '';
  return '<i class="ab-sdot" style="background:'+(s.color||'#8a857d')+'"></i>'+_abEsc(s.code||s.name||sid);
}
function _abRoute(rid){
  return (typeof ROUTES!=='undefined' && Array.isArray(ROUTES))
    ? ROUTES.find(function(x){ return x.id===rid; }) : null;
}
function _abRouteName(rid){ var r=_abRoute(rid); return (r&&r.name)||rid; }
function _abRouteCol(rid){ var r=_abRoute(rid); return (r&&r.color)||'#b6b1a8'; }
/* §abPier · เส้นทางที่ไม่ได้ตั้งท่า (โปรแกรมบก/รถรับส่ง) ตกถัง 'other'
   ใช้ถังเดียวกับที่หน้า Calendar ใช้อยู่ (CAL_PIERS) จะได้ไม่มีสองมาตรฐาน */
const _AB_PIERS = ['tublamu','panwa','ranong','other'];
function _abPierOf(rid){ var r=_abRoute(rid); return (r && r.pier) ? r.pier : 'other'; }
function _abPierLbl(k){
  if(k==='other') return 'Other';
  return (typeof PIER_LABELS!=='undefined' && PIER_LABELS[k]) ? PIER_LABELS[k] : k;
}

/* §abAgent · สีประจำเอเย่นต์สำหรับแท่งในช่อง
   ไม่มีฟิลด์สีในข้อมูลเอเย่นต์ · จะสุ่มจาก id ก็ได้ แต่สีจะกระโดดไปมาทุกครั้ง
   ที่มีเอเย่นต์ใหม่เข้ามา → ไล่สีตามอันดับยอดรวมในช่วงที่ดูอยู่แทน
   เจ้าใหญ่สุดได้สีเด่นสุดเสมอ และคงที่ตลอดทั้งตาราง
   เกินอันดับ 8 ยุบเป็นเทาก้อนเดียว · ตาคนแยกสีในแท่ง 120px ได้ราว 8 สีเป็นอย่างมาก */
const _AB_AG_PAL = ['#185FA5','#1D9E75','#E08A00','#A32D2D','#6C5CE7','#00708A','#B5651D','#D6336C'];
const _AB_AG_ETC = '#A8A29A';

/* ══ ฝั่งที่นั่ง ═══════════════════════════════════════════════════════════
   สแกนครั้งเดียว 14 วัน แล้วใช้ผลร่วมกันทั้งตารางบนและการ์ดเตือนล่าง
   (getAllotment วิ่งทั้ง SB_BOOKINGS ทุกครั้ง · เรียกซ้ำสองรอบเปลืองเปล่า ๆ)

   หนึ่งช่อง = เส้นทาง × วัน ไม่ใช่ลำเรือ · ที่นั่งเป็นกองเดียวกันทั้งเส้นทาง
   วันไหนใช้ 2 ลำก็ขายรวมกัน · แยกรายลำจะได้ตัวเลขที่ไม่มีอยู่จริง

   สถานะช่อง · ช่องว่างเปล่าแบบเดิมกำกวมมาก (ไม่มีเรือ? เหมาไปแล้ว? ยกเลิก?)
   จึงแยกให้ชัด:
     open    = ขายอยู่ · มีตัวเลข
     charter = เหมาทั้งลำ ไม่มีที่นั่งขาย — ไม่ใช่ "ไม่มีทริป" และไม่ใช่ที่ว่าง
     wx      = ยกเลิกเพราะอากาศ
     (ไม่มี) = ไม่ได้ลงเรือ หรือปิดฤดูกาล */
/* §abTop20 · กี่รายต่อการ์ด · เดิม 10 · "จำนวน Agent ขึ้นเป็น 20 เจ้าเลย ให้ Scroll เอา"
   .ab-list เลื่อนในตัวเองอยู่แล้ว จึงไม่กระทบความสูงการ์ด */
const _AB_AG_TOP   = 20;
const _AB_SCAN_DAYS = 14;
function _abScan(){
  var dates=[], cell={}, seen={}, order=[];
  for(var i=0;i<_AB_SCAN_DAYS;i++){
    var ds=dStr(i); dates.push(ds);
    var ops=(typeof TRIPS!=='undefined' && TRIPS[ds]) || {};
    var byR={};
    Object.keys(ops).forEach(function(bid){
      var op=ops[bid]; if(!op || !op.route) return;
      var b=(typeof BOATS!=='undefined')?BOATS.find(function(x){return x.id===bid;}):null; if(!b) return;
      (byR[op.route]=byR[op.route]||[]).push(b.name||bid);
    });
    (function(dsx,dx){
      Object.keys(byR).forEach(function(rid){
        if(typeof bkV2IsRouteOpenOn==='function' && !bkV2IsRouteOpenOn(rid,dsx)) return;
        var c={ rid:rid, ds:dsx, d:dx, boats:byR[rid], state:'open',
                cap:0, sold:0, lock:0, free:0, fill:0 };
        if(typeof bkV2IsWeatherClosed==='function' && bkV2IsWeatherClosed(rid,dsx)){
          c.state='wx';
        } else {
          var al=(typeof getAllotment==='function')?getAllotment(rid,dsx):null;
          if(!al || !al.hasAllotment) return;
          if(al.availableCapacity<=0){ c.state='charter'; }
          else {
            c.cap=al.availableCapacity;      c.sold=al.seatsConsumed||0;
            c.lock=al.lockedSeats||0;        c.free=al.seatsAvailable||0;
            c.fill=al.fillPct||0;
          }
        }
        cell[rid+'|'+dsx]=c;
        if(!seen[rid]){ seen[rid]=1; order.push(rid); }
      });
    })(ds,i);
  }
  /* เรียงแถวตามลำดับเส้นทางในระบบ ไม่ใช่ลำดับที่บังเอิญเจอก่อน
     ไม่งั้นแถวจะสลับที่ทุกวันที่ตารางเรือเปลี่ยน */
  var all=(typeof ROUTES!=='undefined'&&Array.isArray(ROUTES))?ROUTES.map(function(r){return r.id;}):[];
  order.sort(function(a,b){ var ia=all.indexOf(a), ib=all.indexOf(b);
    return (ia<0?999:ia)-(ib<0?999:ib); });
  return { dates:dates, cell:cell, rids:order, split:_abAgentSplit(dates) };
}
/* แยกยอดขายในแต่ละช่องออกเป็นรายเอเย่นต์
   ต้องเดินตามกติกาเดียวกับ getSeatsConsumed เป๊ะ ๆ (สถานะ · pendHold · charter ·
   หัก no-show) ไม่งั้นผลรวมของแท่งจะไม่เท่ากับเลข "ขาย N" ที่อยู่ในช่องเดียวกัน
   ซึ่งเป็นบั๊กแบบที่คนใช้จับได้ทันทีและเลิกเชื่อทั้งตาราง */
function _abAgentSplit(dates){
  var want={}; dates.forEach(function(d){ want[d]=1; });
  var out={};
  function add(rid,ds,aid,p){
    if(p<=0) return; var k=rid+'|'+ds;
    var m=out[k]||(out[k]={}); m[aid]=(m[aid]||0)+p;
  }
  ((typeof SB_BOOKINGS!=='undefined'&&Array.isArray(SB_BOOKINGS))?SB_BOOKINGS:[]).forEach(function(bk){
    var st=bk.status||'';
    if(st==='cancelled'||st==='rejected'||st==='cancelled_weather') return;
    if(typeof bkPendHoldsSeat==='function' && !bkPendHoldsSeat(bk)) return;
    var aid=bk.agentId||'_';
    if(bk.schemaVer===2 && Array.isArray(bk.trips)){
      bk.trips.forEach(function(t){
        if(!t || !want[t.date]) return;
        if(t.bookingMode==='charter') return;
        var p=(typeof getTripPaxTotal==='function')?getTripPaxTotal(t):0;
        if(typeof ckLostByType==='function'){
          var L=ckLostByType(bk,t.date); if(L && L.total>0) p=Math.max(0,p-L.total);
        }
        add(t.routeId,t.date,aid,p);
      });
    } else if(bk.programId && want[bk.travelDate]){
      var q=bk.pax||{};
      add(bk.programId,bk.travelDate,aid,(q.adult||0)+(q.child||0)+(q.infant||0));
    }
  });
  return out;
}
function _abOpenCells(SC){
  var out=[];
  SC.rids.forEach(function(rid){ SC.dates.forEach(function(ds){
    var c=SC.cell[rid+'|'+ds]; if(c && c.state==='open') out.push(c);
  }); });
  return out;
}

/* ══ ฝั่งเอเย่นต์ ═══════════════════════════════════════════════════════════
   เก็บสองแกนเสมอ เพราะสองคำถามคนละเรื่องกัน:
     จองเข้า (createdAt) = "ตอนนี้ยังส่งงานอยู่ไหม"  → ใช้จับคนหาย
     เดินทาง (trips.date) = "เดือนนี้จะมีคนมาเท่าไหร่" → ใช้วางแผนเรือ
   เทียบเดือนที่แล้วใช้ "ช่วงวันเดียวกัน" (1–วันนี้) ไม่เทียบกับเดือนเต็ม
   ไม่งั้นต้นเดือนทุกเจ้าจะดูเหมือนยอดตกหมด ทั้งที่ยังไม่ถึงสิ้นเดือน */
function _abAgentStats(){
  var cur=TODAY_STR.slice(0,7), dayN=+TODAY_STR.slice(8,10), prev=_abMonShift(cur,-1);
  var back3=[_abMonShift(cur,-3),_abMonShift(cur,-2),_abMonShift(cur,-1)];
  var M={};
  function rec(id){ return M[id] || (M[id]={ id:id,
    inCur:0, inPrev:0, inPrevFull:0, tvCur:0, tvPrev:0,
    revCur:0, revPrev:0, bkCur:0, bkPrev:0, cxCur:0, cxPrev:0,
    lastIn:'', byMon:{} }); }
  ((typeof SB_BOOKINGS!=='undefined'&&Array.isArray(SB_BOOKINGS))?SB_BOOKINGS:[]).forEach(function(bk){
    var aid=bk.agentId; if(!aid) return;
    var st=bk.status||'';
    var dead=(st==='cancelled'||st==='rejected'||st==='cancelled_weather');
    var pax=0; (bk.trips||[]).forEach(function(t){ pax+=(typeof getTripPaxTotal==='function')?getTripPaxTotal(t):0; });
    var rev=((bk.priceBreakdown||{}).total)||bk.total||0;
    var r=rec(aid);
    var ca=(bk.createdAt||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ca)) ca=(/^\d{4}-\d{2}-\d{2}$/.test(bk.bookingDate||''))?bk.bookingDate:'';
    if(ca){
      var cm=ca.slice(0,7), cd=+ca.slice(8,10);
      if(!dead){
        r.byMon[cm]=(r.byMon[cm]||0)+pax;
        if(!r.lastIn || ca>r.lastIn) r.lastIn=ca;
      }
      if(cm===cur){ r.bkCur++; if(dead) r.cxCur++; else { r.inCur+=pax; r.revCur+=rev; } }
      else if(cm===prev){
        if(!dead) r.inPrevFull+=pax;
        if(cd<=dayN){ r.bkPrev++; if(dead) r.cxPrev++; else { r.inPrev+=pax; r.revPrev+=rev; } }
      }
    }
    if(!dead) (bk.trips||[]).forEach(function(t){
      var td=t.date||''; if(!/^\d{4}-\d{2}-\d{2}$/.test(td)) return;
      var tp=(typeof getTripPaxTotal==='function')?getTripPaxTotal(t):0;
      if(td.slice(0,7)===cur) r.tvCur+=tp; else if(td.slice(0,7)===prev) r.tvPrev+=tp;
    });
  });
  return { M:M, cur:cur, prev:prev, dayN:dayN, back3:back3 };
}
function _abAgentRows(S){
  var AM=_abAgentMap(), sel=window._abSales||'';
  var out=[];
  Object.keys(S.M).forEach(function(id){
    var ag=AM[id]; if(!ag) return;
    if(sel && _abSalesOf(ag)!==sel) return;
    var r=S.M[id];
    r.name=ag.name||ag.code||id; r.sales=_abSalesOf(ag); r.market=ag.market||'';
    out.push(r);
  });
  return out;
}

/* ── ชิ้นส่วนหน้าตา ────────────────────────────────────────────────────────── */
function _abBar(pct,col){
  var p=Math.max(0,Math.min(100,Math.round(pct)));
  return '<span class="ab-bar"><i style="width:'+p+'%;background:'+col+'"></i></span>';
}
function _abDelta(now,before){
  if(!before){ return now>0 ? '<b class="ab-up">new</b>' : '<b class="ab-flat">—</b>'; }
  var d=Math.round((now-before)/before*100);
  if(d>=5)  return '<b class="ab-up">▲ '+d+'%</b>';
  if(d<=-5) return '<b class="ab-dn">▼ '+Math.abs(d)+'%</b>';
  return '<b class="ab-flat">≈ '+(d>0?'+':'')+d+'%</b>';
}
function _abEmpty(msg){ return '<div class="ab-empty">'+_abEsc(msg)+'</div>'; }
function _abCard(cls,title,cnt,note,body){
  return '<div class="ab-c '+cls+'">'
    +'<div class="ab-ct"><span class="big">'+title+'</span>'
      +(cnt!=null?'<span class="cnt">'+cnt+'</span>':'')
      +(note?'<span class="nt">'+note+'</span>':'')
    +'</div><div class="ab-lw"><div class="ab-list">'+body+'</div></div></div>';
}

/* ══════════════════════════════════════════════════════════════════════════
   CSS · ยืมโทเคนจากหน้า Dashboard ทั้งหมด (พื้น navy · การ์ดขาวมุม 12 ·
   ตัวเลข DM Mono) เพื่อให้สองหน้าอยู่ในภาษาเดียวกัน
   ══════════════════════════════════════════════════════════════════════════ */
const AB_CSS=`<style>
  #ab-wrap *{box-sizing:border-box}
  /* หน้าเดียวจบเหมือน Dashboard แต่ไม่ฮาร์ดโค้ดความสูงหัว
     (หัวที่นี่ 2 บรรทัด และสูงขึ้นอีกถ้าชิปเซลส์ขึ้นบรรทัดใหม่) → ให้ flex แบ่งเอง */
  /* §ciColour · พื้นหน้านี้เป็น --ci-cyan · หน้าเดียวในแอปที่ใช้สีแบรนด์เต็มผืน
     กติกาที่ตามมาจากคอนทราสต์ที่วัดได้ (ขาวบน cyan = 2.27:1 อ่านไม่ออก):
       ตัวหนังสือใด ๆ ที่วางบนพื้น cyan ตรง ๆ ต้องเป็น ci-navy (7.9:1)
       ของที่เคยเป็นขาว/ฟ้าอ่อนบนพื้น navy จึงต้องย้ายไปอยู่ในแถบ navy แทน */
  .ab-fr{position:relative;isolation:isolate;background:var(--ci-cyan,#00BCDF);
    height:calc(100dvh - var(--topbar, 44px));overflow:hidden;
    display:flex;flex-direction:column;gap:11px;
    padding:13px 13px 15px;font-family:'DM Sans',Manrope,-apple-system,system-ui,sans-serif}
  .ab-fr::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(62% 48% at 8% 2%,   rgba(255,255,255,.42), transparent 64%),
      radial-gradient(54% 44% at 96% 8%,  rgba(255,255,255,.26), transparent 62%),
      radial-gradient(58% 50% at 82% 98%, rgba(0,15,76,.26),     transparent 66%),
      radial-gradient(52% 44% at 14% 96%, rgba(0,15,76,.18),     transparent 64%);
    filter:blur(22px)}
  .ab-fr>*{position:relative;z-index:1}

  /* ── แถบหัว · padding ขวา 96px = ที่ของปุ่ม ⋯ ที่สกินลอยไว้มุมขวาบน ── */
  .ab-hd{flex:none;padding:7px 96px 9px 10px;border-radius:14px;
    background:linear-gradient(160deg, var(--ci-navy,#000F4C), #00093A);
    box-shadow:0 10px 28px rgba(0,15,76,.34), inset 0 1px 0 rgba(255,255,255,.16)}
  .ab-hdtop{position:relative;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  /* §abTitle · ชื่อหน้าอยู่กึ่งกลางแบบเดียวกับ .dv-brand ของ Dashboard
     absolute จึงไม่กินที่ในแถว · ชิปซ้าย/ขวายังจัดตัวเองได้เหมือนเดิม
     แต่ absolute ก็ไม่รู้ว่าชิปยาวถึงไหน (ปัญหาเดียวกับที่ .dv-brand เคยทับชิป)
     จึงมีจุดตัดด้านล่าง: จอที่แคบเกินไปให้กลับไปอยู่ซ้ายในแถวตามเดิม */
  .ab-ttl{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
    font-size:15px;font-weight:800;letter-spacing:.20em;color:#fff;white-space:nowrap;
    pointer-events:none;z-index:2}
  .ab-seg{margin-right:auto}
  .ab-sub{font-size:10px;font-weight:600;color:#A8BAD8;letter-spacing:.02em}
  .ab-seg{display:flex;gap:5px;flex-wrap:wrap}
  .ab-seg b{font-size:10.5px;font-weight:700;color:#C9D6EC;background:rgba(255,255,255,.09);
    border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px 10px;cursor:pointer;
    display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
  .ab-seg b:hover{background:rgba(255,255,255,.18)}
  .ab-seg b.on{background:#fff;color:#16265C;border-color:#fff}
  .ab-sdot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
  /* วัดที่ 1440 · ก้อนตัวเลขขวากิน 50% เหลือชื่อ ~120px · ถ้าบล็อกเป็น inline-block
     + nowrap จะโดนตัด 32 จาก 37 ชื่อ · ใช้ display:inline แทน แถบสีจึงคาดตามบรรทัด
     ที่ข้อความห่อไป (box-decoration-break:clone ทำให้มุมมนทั้งสองชิ้น) */
  .ab-apill{display:inline;padding:1px 7px;border-radius:6px;
    font-weight:700;font-size:11.5px;
    -webkit-box-decoration-break:clone;box-decoration-break:clone;
    box-shadow:0 1px 2px rgba(0,0,0,.10)}
  .ab-apill.none{background:#EDEBE4;color:#5A5A52;box-shadow:none}
  .ab-kpi{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}
  .ab-chip{font-size:11px;font-weight:600;color:#D6E2F5;background:rgba(255,255,255,.10);
    border:1px solid rgba(255,255,255,.20);border-radius:999px;padding:4px 11px;white-space:nowrap}
  .ab-chip b{font-family:'DM Mono',ui-monospace,monospace;font-weight:800;
    color:var(--ci-cyan,#00BCDF);font-size:12.5px}
  .ab-chip.warn{background:rgba(232,74,63,.24);border-color:rgba(255,150,140,.42);color:#FFC9C3}
  .ab-chip.warn b{color:#FFD9D4}
  .ab-chip.ok{background:rgba(29,158,117,.24);border-color:rgba(123,227,184,.36);color:#9DF0CB}
  .ab-chip.ok b{color:#CFFBE6}

  /* ── การ์ดมาตรฐาน ── */
  .ab-c{background:#fff;border:1px solid rgba(0,15,76,.10);border-radius:12px;
    box-shadow:0 8px 24px rgba(0,15,76,.20);padding:12px 13px 11px;
    display:flex;flex-direction:column;min-height:0}
  .ab-ct{display:flex;align-items:center;gap:8px;padding-bottom:9px;margin-bottom:6px;
    border-bottom:1px solid #EFEBE5;flex-wrap:wrap}
  .ab-ct .big{font-size:13px;font-weight:800;color:var(--ci-navy,#000F4C)}
  .ab-ct .cnt{font-family:'DM Mono',ui-monospace,monospace;font-size:11px;font-weight:800;
    background:#F2F0EC;color:#5A5A52;border-radius:999px;padding:2px 8px}
  .ab-ct .nt{margin-left:auto;font-size:9.5px;font-weight:600;color:#a8a29a;text-align:right;
    min-width:0;flex:0 1 auto;overflow:hidden}
  .ab-c.risk .ab-ct .big{color:#A32D2D} .ab-c.risk .ab-ct .cnt{background:#FCEBEB;color:#A32D2D}
  .ab-c.near .ab-ct .big{color:#0F6E56} .ab-c.near .ab-ct .cnt{background:#E6F5EC;color:#0F6E56}
  .ab-c.lost .ab-ct .big{color:#A32D2D} .ab-c.lost .ab-ct .cnt{background:#FCEBEB;color:#A32D2D}
  .ab-c.cxl  .ab-ct .big{color:#8A4A00} .ab-c.cxl  .ab-ct .cnt{background:#FBEEDC;color:#8A4A00}
/* §abSB · "ตัว scroll ใหญ่มาก ต้องทำให้เล็กที่สุด"
   กฎเหมารวมทั้งหน้า · อะไรที่เลื่อนได้แล้วยังไม่ได้ตั้งสกอลล์บาร์ไว้จะได้ไม่หลุด
   เป็นสกอลล์บาร์ระบบ (macOS โหมด "แสดงตลอด" กว้าง ~15px) */
  #view-actionboard *{scrollbar-width:thin;scrollbar-color:#DAD5CC transparent}
  #view-actionboard *::-webkit-scrollbar{width:4px;height:4px}
  #view-actionboard *::-webkit-scrollbar-thumb{background:#DAD5CC;border-radius:3px}
  #view-actionboard *::-webkit-scrollbar-track{background:transparent}
  #view-actionboard *::-webkit-scrollbar-corner{background:transparent}
  .ab-list{overflow-y:auto;min-height:0;flex:1 1 auto;
    scrollbar-width:thin;scrollbar-color:#DAD5CC transparent}
  .ab-list::-webkit-scrollbar{width:4px}
  .ab-list::-webkit-scrollbar-thumb{background:#DAD5CC;border-radius:3px}
  .ab-list::-webkit-scrollbar-track{background:transparent}
  /* แถวที่โดนตัดครึ่งจะดูเหมือนข้อมูลขาด · จางที่ขอบล่างให้รู้ว่าเลื่อนดูต่อได้ */
  .ab-lw{position:relative;min-height:0;flex:1 1 auto;display:flex;flex-direction:column}
  .ab-lw::after{content:'';position:absolute;left:0;right:0;bottom:0;height:22px;pointer-events:none;
    background:linear-gradient(180deg, rgba(255,255,255,0), #fff)}
  .ab-empty{padding:16px 4px;text-align:center;font-size:11px;color:#b6b1a8;font-weight:600}

  /* ══ ตารางบน · เส้นทาง × วัน ══════════════════════════════════════════
     การ์ดนี้เป็นพระเอกของหน้า จึงกินความกว้างเต็ม ไม่ยัดลงคอลัมน์
     (วัดแล้ว: อยู่ในคอลัมน์กลางกว้าง 428px ช่องจะเหลือ 17px ต่อวัน อ่านไม่ออก
      เต็มความกว้าง 1147px ได้ช่องละ 67px ที่ 14 วัน · 134px ที่ 7 วัน)
     สูงตามเนื้อแต่ไม่เกิน 46% ของจอ · เกินแล้วเลื่อนในตัวเอง
     (ตอนนี้กันยายนเดิน 3 เส้นทาง · ไฮซีซันเดิน 10 เส้นทาง แถวจะเยอะกว่านี้มาก) */
  .ab-mtx{flex:0 0 auto;max-height:46%}
  .ab-mwrap{overflow:auto;min-height:0;flex:1 1 auto;
    scrollbar-width:thin;scrollbar-color:#DAD5CC transparent}
  .ab-mwrap::-webkit-scrollbar{width:4px;height:4px}
  .ab-mwrap::-webkit-scrollbar-thumb{background:#DAD5CC;border-radius:3px}
  .ab-mwrap::-webkit-scrollbar-track{background:transparent}
  .ab-mg{display:grid;gap:3px;min-width:0;align-items:stretch}
  .ab-mh{text-align:center;font-size:8.5px;font-weight:800;color:#a8a29a;line-height:1.15;
    padding-bottom:3px;align-self:end}
  .ab-mmon{font-size:9px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;
    color:#8a857d;background:#F7F5F2;border-radius:6px;padding:3px 8px;text-align:center;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
  .ab-mh u{display:block;text-decoration:none;font-size:8px}
  .ab-mh b{font-family:'DM Mono',ui-monospace,monospace;font-size:11px;color:#7a736c}
  .ab-mh.now u,.ab-mh.now b{color:#15382B}
  .ab-mh.wknd u,.ab-mh.wknd b{color:#B4600F}
  .ab-mn{display:flex;align-items:center;gap:6px;min-width:0;padding-right:4px}
  .ab-mn i{width:8px;height:8px;border-radius:2px;flex:none}
  .ab-mn span{font-size:10.5px;font-weight:700;color:#2c2c2a;line-height:1.25;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .ab-mc{border-radius:6px;border:1px solid rgba(0,0,0,.05);cursor:pointer;
    display:flex;flex-direction:column;justify-content:center;overflow:hidden;
    font-family:'DM Mono',ui-monospace,monospace;font-weight:800}
  .ab-mc:hover{outline:2px solid #15382B;outline-offset:-2px}
  .ab-mc.off{background:#FAFAF8;border-color:#F2F0EC;cursor:default}
  .ab-mc.off:hover{outline:0}
  .ab-mc.chtr{background:#F2EAFB;border-color:#E0D2F2;color:#5B289A}
  .ab-mc.wx{background:#F7E7E7;border-color:#EFD6D6;color:#A32D2D}
/* §abBar14 · โหมด 14 วัน · เดิมซ่อนแท่งสีทิ้ง (.mbar{display:none}) เหลือแต่ตัวเลข
     ผลคือกด "14 days" แล้วเหมือนไม่มีอะไรเปลี่ยน และสีประจำเอเย่นต์หายไปทั้งแถบ
     ช่องกว้าง 63px (1440) / 97px (1920) · ใส่แท่ง 3px ได้สบาย
     ตัดเฉพาะ .sub (ข้อความ "sold N · held N") ที่ยัดไม่ลงจริง ๆ */
  .ab-mg.d14 .ab-mc{height:36px;font-size:11px;padding:3px 4px;gap:3px;
    justify-content:center;text-align:center}
  .ab-mg.d14 .ab-mc .sub{display:none}
  .ab-mg.d14 .ab-mc .v em{display:none}
  .ab-mg.d14 .ab-mc .mbar{height:3px;border-radius:2px;background:rgba(0,0,0,.08);
    overflow:hidden;display:flex}
  .ab-mg.d14 .ab-mc .mbar i{display:block;height:100%}
  /* โหมด 7 วัน · ช่องกว้างเท่าตัว ใส่ของที่ตัดสินใจได้จริงลงไป
     ว่าง/ความจุ · แถบ fill · ขายไปแล้วกี่ที่ · ล็อกค้างอยู่กี่ที่
     "ล็อก" คือที่ที่เอเย่นต์กันไว้แต่ยังไม่ออกบุคกิ้ง — ไม่ใช่ที่ขายได้
     และไม่ใช่ที่ว่าง · เป็นตัวที่ต้องโทรตามมากที่สุดในตาราง */
  .ab-mg.d7 .ab-mc{height:48px;padding:4px 7px;gap:3px;justify-content:center}
  .ab-mg.d7 .ab-mc .v{font-size:16px;line-height:1;display:flex;align-items:baseline;gap:2px}
  .ab-mg.d7 .ab-mc .v em{font-style:normal;font-size:9px;font-weight:700;opacity:.70}
  .ab-mg.d7 .ab-mc .mbar{height:3px;border-radius:2px;background:rgba(0,0,0,.08);overflow:hidden}
  .ab-mg.d7 .ab-mc .mbar i{display:block;height:100%;border-radius:2px}
  .ab-mg.d7 .ab-mc .sub{font-family:'DM Sans',sans-serif;font-size:8.5px;font-weight:700;
    opacity:.80;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ab-mg.d7 .ab-mc .lk{color:var(--ci-cyan-ink,#00708A);font-weight:800;opacity:1}
  .ab-mtot{text-align:right;font-family:'DM Mono',ui-monospace,monospace;font-size:11.5px;
    font-weight:800;color:#5A5A52;align-self:center;padding-left:2px}
  .ab-mfoot{font-size:8.5px;font-weight:700;color:#8a857d;text-align:center;align-self:start;
    line-height:1.2;padding-top:5px}
  .ab-mfoot b{display:block;font-family:'DM Mono',ui-monospace,monospace;font-size:11.5px;color:#3a3a36}
  /* §abBy · ยอดแยกตามเซลส์ของวันนั้น · ชิปเล็กเรียงต่อกัน ไม่ใช้ tooltip
     เพราะเป็นของที่ต้องกวาดตาเทียบข้ามวัน · tooltip ต้องชี้ทีละช่องซึ่งเทียบไม่ได้ */
  .ab-usp{display:flex;flex-wrap:wrap;gap:2px 5px;justify-content:center;margin-top:4px}
  .ab-usp em{font-style:normal;font-size:8.5px;font-weight:700;color:#5A5A52;
    display:inline-flex;align-items:center;gap:3px;white-space:nowrap;
    font-family:'DM Mono',ui-monospace,monospace}
  .ab-usp i{width:6px;height:6px;border-radius:2px;display:inline-block;flex:none}
  .ab-mlbl{font-size:9px;font-weight:800;color:#a8a29a;letter-spacing:.04em;align-self:start;
    padding-top:5px;line-height:1.3}
  .ab-mlbl u{display:block;text-decoration:none;font-size:8px;font-weight:700;color:#c4bfb6;
    letter-spacing:0;margin-top:2px}
  .ab-mlg{display:flex;gap:11px;flex-wrap:wrap;align-items:center;margin-top:8px;
    font-size:9px;font-weight:600;color:#8a857d}
  .ab-mlg i{width:9px;height:9px;border-radius:2px;display:inline-block;margin-right:4px;
    vertical-align:-1px;border:1px solid rgba(0,0,0,.08)}
  .ab-msum{font-weight:800;color:#3a3a36;font-size:9.5px;padding-right:4px;
    border-right:1px solid #EFEBE5;margin-right:2px}
  .ab-tg{display:flex;border-radius:999px;overflow:hidden;border:1px solid rgba(0,0,0,.10);background:#F7F5F2}
  .ab-tg b{font-size:10px;font-weight:700;padding:4px 11px;color:#7a736c;cursor:pointer}
  .ab-tg b.on{background:var(--ci-navy,#000F4C);color:#fff}
  /* ชิปท่าเรือ · วางไว้ในหัวการ์ดตาราง ไม่ใช่หัวหน้า เพราะกรองเฉพาะฝั่งที่นั่ง
     (ตัวกรองเซลส์บนหัวหน้ากรองเฉพาะฝั่งเอเย่นต์ · แยกที่อยู่กันไว้จะได้ไม่สับสนว่าอะไรกรองอะไร) */
  .ab-pier{display:flex;gap:5px;flex-wrap:wrap}
  .ab-pier b{font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;cursor:pointer;
    border:1px solid #E4E0D8;color:#6b675f;background:#fff;white-space:nowrap}
  .ab-pier b:hover{background:#F4F2EE}
  .ab-pier b.on{background:var(--ci-navy,#000F4C);color:#fff;border-color:var(--ci-navy,#000F4C)}
  .ab-pier b i{font-family:'DM Mono',ui-monospace,monospace;font-style:normal;opacity:.62;margin-left:4px}

  /* §abAgentBar · แท่งในช่องแยกเป็นรายเอเย่นต์
     ความยาวทั้งแท่ง = fill% เหมือนเดิม · ข้างในซอยตามสัดส่วน pax ของแต่ละเจ้า
     ได้สองคำตอบในที่เดียว: เต็มแค่ไหน และใครเป็นคนเติม */
  .ab-mg.d7 .ab-mc .mbar{height:6px;border-radius:3px;background:rgba(0,0,0,.08);overflow:hidden;
    display:flex;gap:0}
  .ab-mg.d7 .ab-mc .mbar i{display:block;height:100%;border-radius:0}
  .ab-mg.d7 .ab-mc .mbar i:first-child{border-radius:3px 0 0 3px}
  .ab-mg.d7 .ab-mc .mbar i:last-child{border-radius:0 3px 3px 0}
  .ab-aglg{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:6px;
    padding-top:7px;border-top:1px solid #F5F2ED;font-size:9px;font-weight:600;color:#8a857d}
  .ab-aglg span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
  .ab-aglg i{width:9px;height:9px;border-radius:2px;display:inline-block;flex:none}
  .ab-aglg b{color:#3a3a36;font-weight:700}
  .ab-aglg em{font-style:normal;font-family:'DM Mono',ui-monospace,monospace;color:#b6b1a8}

  /* ── กริดล่าง · ซ้าย 1 คอลัมน์ซ้อน 3 ใบ · ขวา 3 คอลัมน์ตั้ง ใบละคอลัมน์ ──
     ซ้าย = เรื่องที่ต้องรีบ · สามใบนี้ปกติมีไม่กี่แถว ซ้อนกันลงมาได้
     ขวา = อันดับเอเย่นต์ · แต่ละใบมี 10 ราย ถ้าซ้อนกันจะเหลือใบละ 3 แถว
           ตั้งเป็นคอลัมน์ยาวแทน ได้ความสูงเต็มพื้นที่ เห็นได้ใบละ 7–9 ราย */
  .ab-grid{display:grid;
    grid-template-columns:minmax(0,1.18fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);
    gap:11px;align-items:stretch;flex:1 1 auto;min-height:0;overflow:hidden}
  .ab-col{display:flex;flex-direction:column;gap:11px;min-width:0;min-height:0;
    overflow-y:auto;overscroll-behavior:contain;
    scrollbar-width:thin;scrollbar-color:rgba(0,15,76,.34) transparent}
  .ab-col::-webkit-scrollbar{width:4px}
  .ab-col::-webkit-scrollbar-thumb{background:rgba(0,15,76,.30);border-radius:3px}
  .ab-col::-webkit-scrollbar-track{background:transparent}
  .ab-col>*{flex:1 1 0;min-height:112px}
  /* ใบทางซ้ายสูงตามเนื้อ · ปล่อยให้ "วันเสี่ยง" (แถวเยอะสุด) กินที่ที่เหลือ
     ถ้าแบ่งเท่ากันหมด ใบที่ว่าง (ยกเลิกพุ่ง 0 ราย) จะกินที่ไปหนึ่งในสามเปล่า ๆ */
  .ab-col:first-child>*{flex:0 1 auto}
  .ab-col:first-child>.risk{flex:1 1 auto}

  /* ── แถวเตือนเรื่องที่นั่ง ── */
  .ab-tr{display:flex;align-items:center;gap:9px;padding:7px 4px;border-bottom:1px solid #F5F2ED;cursor:pointer}
  .ab-tr:last-child{border-bottom:0}
  .ab-tr:hover{background:#FBFAF8}
  .ab-day{flex:none;width:42px;text-align:center;border-radius:8px;padding:4px 2px;
    background:#F4F2EE;border:1px solid #EAE6DF}
  .ab-day u{display:block;text-decoration:none;font-size:8.5px;font-weight:800;color:#a8a29a;
    letter-spacing:.04em;line-height:1.1}
  .ab-day b{display:block;font-family:'DM Mono',ui-monospace,monospace;font-size:15px;
    font-weight:800;color:#3a3a36;line-height:1.15}
  .ab-tr.now .ab-day{background:#15382B;border-color:#15382B}
  .ab-tr.now .ab-day u{color:#9DC4B2} .ab-tr.now .ab-day b{color:#fff}
  .ab-tb{flex:1;min-width:0}
  .ab-tb .rt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    font-size:11.5px;font-weight:700;color:#2c2c2a;line-height:1.28}
  .ab-rdot{width:7px;height:7px;border-radius:2px;display:inline-block;margin-right:5px;
    vertical-align:1px;flex:none}
  .ab-tb .bt{display:block;font-size:9.5px;font-weight:600;color:#9b9088;margin-top:1px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ab-bar{display:block;height:5px;border-radius:3px;background:#F1EEE9;overflow:hidden;margin-top:4px}
  .ab-bar i{display:block;height:100%;border-radius:3px}
  .ab-tn{flex:none;text-align:right;min-width:72px}
  .ab-tn b{display:block;font-family:'DM Mono',ui-monospace,monospace;font-size:16px;
    font-weight:800;line-height:1.1}
  .ab-tn i{display:block;font-style:normal;font-size:9.5px;font-weight:700;color:#8a857d;margin-top:2px;
    white-space:nowrap}
  .ab-gap{font-family:'DM Mono',ui-monospace,monospace;font-weight:800;border-radius:6px;
    padding:1px 6px;font-size:10.5px}

  /* ── แถวเอเย่นต์ ── */
  .ab-ar{display:flex;align-items:center;gap:9px;padding:7px 4px;border-bottom:1px solid #F5F2ED;cursor:pointer}
  .ab-ar:last-child{border-bottom:0}
  .ab-ar:hover{background:#FBFAF8}
  .ab-rk{flex:none;width:17px;text-align:center;font-family:'DM Mono',ui-monospace,monospace;
    font-size:11px;font-weight:800;color:#c4bfb6}
  /* คอลัมน์ขวากว้าง ~1060px ที่ 1920 · ถ้าบังคับชื่อกับเมตาเป็นคนละบรรทัดเสมอ
     จะได้แถวสูง 2 บรรทัดที่มีที่ว่างกลางแถวเปล่า ๆ ครึ่งแถว และเห็นได้แค่ 3 ราย
     ให้ wrap ตัดสินเอง: กว้างพอก็อยู่บรรทัดเดียว (เห็น 5–6 ราย) แคบก็ตกลงมาเอง
     ไม่ต้องมี breakpoint เพราะความกว้างคอลัมน์เปลี่ยนตามตัวกรองได้ด้วย */
  .ab-ab{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:1px 9px}
  .ab-ab .nm{flex:0 1 auto;min-width:0;line-height:1.75;display:block;overflow-wrap:anywhere}
  .ab-ab .mt{flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:5px;
    font-size:9.5px;font-weight:600;color:#9b9088;white-space:nowrap;overflow:hidden}
  /* ชื่อเจ้าของยาว ๆ ("Staff / Welfare (internal)") ล้นได้แม้จอกว้าง · ให้จบด้วย … ไม่ใช่หายเฉย ๆ */
  .ab-ab .mt>span{min-width:0;overflow:hidden;text-overflow:ellipsis}
  /* วัดแล้วความสูงแถวถูกกำหนดโดยก้อนตัวเลขขวา (ค่า 16px + เดลต้า 9.5px = 34px)
     ไม่ใช่ตัวหนังสือซ้าย · พอคอลัมน์กว้าง 1035px แล้วยังบังคับให้ซ้อนกันสองชั้น
     แถวจะสูง 49px เห็นได้แค่ 3 ราย · ให้อยู่บรรทัดเดียวกันเมื่อมีที่ (แถวเหลือ ~32px
     เห็น 5 ราย) และ wrap กลับไปซ้อนกันเองเมื่อคอลัมน์แคบ */
  .ab-an{flex:none;text-align:right;min-width:74px;
    display:flex;flex-wrap:wrap;align-items:baseline;justify-content:flex-end;gap:1px 8px}
  .ab-an .v{font-family:'DM Mono',ui-monospace,monospace;font-size:16px;
    font-weight:800;color:#3a3a36;line-height:1.15}
  .ab-an .d{font-size:9.5px;font-weight:700;white-space:nowrap}
  .ab-up{color:#0F6E56} .ab-dn{color:#A32D2D} .ab-flat{color:#a8a29a}

  /* §abRow · วัดที่ 1440 · 4 คอลัมน์ได้คอลัมน์ละ 267px
     หักอันดับ 17 + ตัวเลข/เดลต้า ~120 เหลือชื่อ 122px → ตัดเป็น "Clu…" "Aqu…"
     แคบกว่า 1700 จึงให้ชื่อกินบรรทัดเต็ม แล้วเมตาตกลงมาบรรทัดล่างตามเดิม
     กว้างกว่านั้นค่อยปล่อยให้อยู่บรรทัดเดียว (เห็นได้ครบ 10 ราย) */
  @media (max-width:1699px){
    /* §abRowNarrow · วัดจริงที่ 1440 · แถวกว้าง 239px · อันดับ 17 + ก้อนตัวเลข 102 + ช่องไฟ 18
       เหลือชื่อ 94px แต่ชื่อที่ยาวที่สุดต้องการ 145px ("Staff / Welfare (internal)")
       แถบสีจึงหักเป็นสองบรรทัด แถวสูง 85px เห็นได้แค่ 3 ราย
       แก้: ให้ชื่อ+เมตากินความกว้างแถวทั้งแถว (ได้ 196px > 145px พอทุกชื่อ)
            แล้วดันก้อนตัวเลขลงบรรทัดล่าง ชิดขวา เรียงในบรรทัดเดียว */
    .ab-ar{flex-wrap:wrap;row-gap:1px}
    .ab-ab{flex:1 1 calc(100% - 26px)}
    .ab-ab .nm{flex:1 1 100%;line-height:1.7}
    /* §abMeta · ข้อความอังกฤษยาวกว่าไทยที่เคยใช้ ("NK last sent 29 Jul · quiet 44 days")
       nowrap+hidden จึงตัดหายกลางคำโดยไม่มี … บอก · ให้ห่อลงบรรทัดถัดไปแทน */
    .ab-ab .mt{flex:1 1 100%;flex-wrap:wrap;white-space:normal;overflow:visible}
    .ab-ab .mt>span{min-width:0;line-height:1.3}
    .ab-an{flex:1 1 100%;max-width:none;flex-wrap:nowrap;justify-content:flex-end;
      align-items:baseline;gap:8px}
    .ab-an .v{flex:none;font-size:14px}
    .ab-an .d{flex:none;white-space:nowrap}
  }

  /* ── จอเล็ก ── */
  /* §abTitle · วัดระยะทับจริงตอนชื่ออยู่กึ่งกลาง (ชิปซ้ายจบที่ x=828 คงที่ทุกความกว้าง):
       1366 ทับซ้าย 137px · 1440 ทับ 100 · 1512 ทับ 64 · 1680 พ้น 20 · 1920 พ้น 140
     1680 พ้นแบบเฉียดฉิว จึงตัดที่ 1760 ให้มีระยะหายใจ ~60px
     แคบกว่านั้นชื่อกลับไปอยู่ซ้ายในแถว — ดีกว่าปล่อยให้ทับชิปจนอ่านไม่ออกทั้งคู่
     (ต่างจาก .dv-brand ของ Dashboard ที่ซ่อนไปเลย · ที่นี่ชื่อคือชื่อหน้า ซ่อนไม่ได้) */
  @media (max-width:1759px){
    .ab-ttl{position:static;transform:none;pointer-events:auto}
    .ab-seg{margin-right:0}
    .ab-kpi{margin-left:auto}
  }
  @media (max-width:1365px){
    .ab-fr{height:auto;min-height:calc(100dvh - var(--topbar, 44px));overflow:visible;display:block}
    .ab-fr>*{margin-bottom:9px}
    .ab-mtx{max-height:none}
    .ab-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);height:auto;overflow:visible}
    .ab-col:first-child>*{flex:0 0 auto}
    .ab-col{overflow-y:visible}
    .ab-col>*{flex:0 0 auto}
    .ab-list{max-height:400px}
    /* ตารางแคบกว่าที่ต้องการ · ให้ปัดแนวนอนแทนการบีบช่องจนอ่านไม่ออก */
    .ab-mwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
    .ab-mg{min-width:860px}
  }
  @media (max-width:820px){
    .ab-grid{grid-template-columns:minmax(0,1fr);gap:10px}
    .ab-kpi{margin-left:0;width:100%;flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start}
    .ab-kpi::-webkit-scrollbar{display:none}
    .ab-chip{flex:none}
    .ab-seg{flex-wrap:nowrap;overflow-x:auto;width:100%}
    .ab-seg::-webkit-scrollbar{display:none}
    .ab-seg b{flex:none;min-height:32px}
    .ab-list{max-height:340px}
  }
</style>`;

/* ── ตัวกรอง ─────────────────────────────────────────────────────────────── */
window.abSetSales=function(id){ window._abSales=(window._abSales===id)?'':(id||''); abRender(); };
window.abSetDays =function(n){ window._abDays=(+n===14?14:7); abRender(); };
window.abSetPier =function(k){ window._abPier=(window._abPier===k)?'':(k||''); abRender(); };
window.abSetBy   =function(k){ window._abBy=(k==='agent'?'agent':'sales'); abRender(); };
window.abGoTrip  =function(rid,ds){ if(typeof bkV2OpenFiltered==='function') bkV2OpenFiltered(rid||'',ds); };
window.abGoAgents=function(){ var el=document.querySelector('[data-view=agents]');
  if(el && typeof nav==='function') nav(el); };

/* ══════════════════════════════════════════════════════════════════════════ */
function abRender(){
  var wrap=document.getElementById('ab-wrap'); if(!wrap) return;

  var SC=_abScan();
  var OPEN=_abOpenCells(SC);
  var S=_abAgentStats();
  var A=_abAgentRows(S);
  var N=(window._abDays===14?14:7);
  var DATES=SC.dates.slice(0,N);

  /* ── ตารางบน ── */
  var dayTot={}, rowTot={};
  DATES.forEach(function(ds){ dayTot[ds]={cap:0,sold:0,lock:0,free:0}; });
  SC.rids.forEach(function(rid){ rowTot[rid]={cap:0,sold:0,free:0}; });
  DATES.forEach(function(ds){ SC.rids.forEach(function(rid){
    var c=SC.cell[rid+'|'+ds]; if(!c || c.state!=='open') return;
    dayTot[ds].cap+=c.cap; dayTot[ds].sold+=c.sold; dayTot[ds].lock+=c.lock; dayTot[ds].free+=c.free;
    rowTot[rid].cap+=c.cap; rowTot[rid].sold+=c.sold; rowTot[rid].free+=c.free;
  }); });
  // แถวที่ไม่มีอะไรเลยในช่วงที่เลือก ไม่ต้องกินที่ · แล้วค่อยกรองท่า
  var RIDS_ALL=SC.rids.filter(function(rid){
    return DATES.some(function(ds){ return !!SC.cell[rid+'|'+ds]; }); });
  var PIER=window._abPier||'';
  var RIDS=PIER? RIDS_ALL.filter(function(rid){ return _abPierOf(rid)===PIER; }) : RIDS_ALL;
  // จำนวนเส้นทางต่อท่า · เอาไปโชว์บนชิป จะได้รู้ว่ากดแล้วจะเหลืออะไร ก่อนกด
  var pierN={}; RIDS_ALL.forEach(function(rid){ var k=_abPierOf(rid); pierN[k]=(pierN[k]||0)+1; });

  /* §abBy · ยุบยอดรายเอเย่นต์ขึ้นเป็น "หน่วย" ที่กำลังดูอยู่ (เซลส์ หรือ เอเย่นต์)
     ใช้ชุดเดียวกันทั้งแท่งในช่อง · แถวรวม/วัน · และคำอธิบายสี จะได้ไม่มีทางขัดกันเอง */
  var BY=(window._abBy==='agent')?'agent':'sales';
  var AM0=_abAgentMap();
  function _unitOf(aid){
    if(BY==='agent') return aid;
    var g=AM0[aid]; return (g && g.sales) ? g.sales : '_';
  }
  /* เอเย่นต์บางรายผูกกับ sales id ที่ไม่มีอยู่ในทีมแล้ว (เซลส์ลาออก/ถูกลบ)
     โชว์ id ดิบจะยาวและอ่านไม่รู้เรื่อง · ย่อเป็น ?? ในชิป แต่เก็บ id ไว้ในชื่อเต็ม
     จะได้ตามแก้ข้อมูลได้ ไม่ใช่กลบหายไปเฉย ๆ */
  function _unitName(k){
    if(k==='_') return (BY==='agent')?'No agent':'No sales owner';
    if(BY==='agent'){ var g=AM0[k]; return (g&&(g.name||g.code))||k; }
    var s=_abSalesList().find(function(x){ return x.id===k; });
    return (s&&(s.name||s.code))||('Deleted sales \u00b7 '+k);
  }
  function _unitCode(k){
    if(k==='_') return '—';
    if(BY==='agent'){ var g=AM0[k]; return (g&&(g.code||g.name))||k; }
    var s=_abSalesList().find(function(x){ return x.id===k; });
    return (s&&(s.code||s.name))||'??';
  }
  /* ยุบ split รายเอเย่นต์ → รายหน่วย · ทำครั้งเดียวแล้วใช้ซ้ำ */
  var unit={}, uTot={}, uDay={};
  DATES.forEach(function(ds){ uDay[ds]={}; });
  RIDS.forEach(function(rid){ DATES.forEach(function(ds){
    var m=SC.split[rid+'|'+ds]; if(!m) return;
    var o=unit[rid+'|'+ds]={};
    Object.keys(m).forEach(function(a){
      var k=_unitOf(a);
      o[k]=(o[k]||0)+m[a]; uTot[k]=(uTot[k]||0)+m[a]; uDay[ds][k]=(uDay[ds][k]||0)+m[a];
    });
  }); });
  /* สีไล่ตามอันดับยอดรวมในช่วงที่ดูอยู่ · เจ้าใหญ่สุดได้สีเด่นสุดเสมอ
     โหมดเซลส์ใช้สีประจำตัวจาก SB_SALES ไปเลย เพราะชิปกรองบนหัวหน้าใช้สีชุดนี้อยู่แล้ว
     สลับไปมาสองที่แล้วสีตรงกัน ไม่ต้องจำใหม่ */
  var uRank=Object.keys(uTot).sort(function(a,b){ return uTot[b]-uTot[a]; });
  var uCol={};
  if(BY==='sales'){
    var taken={};
    uRank.forEach(function(k){
      var s=_abSalesList().find(function(x){ return x.id===k; });
      if(s&&s.color){ uCol[k]=s.color; taken[String(s.color).toLowerCase()]=1; }
    });
    /* §abSalesCol · เซลส์ที่ถูกลบไม่มีสีประจำตัว · เดิมหยิบจานสีตามอันดับ จึงไปชนสีเซลส์จริง
       (วัดที่โหมด 14 วัน: s904791 ได้สีเดียวกับ Khun Tee ทั้งในแท่งและคำอธิบายสี)
       เปลี่ยนเป็นหยิบสีที่ยังไม่มีใครใช้ · ชนได้ก็ต่อเมื่อจานสีหมดจริง ๆ */
    var pi=0;
    uRank.forEach(function(k){
      if(k==='_' || uCol[k]) return;
      while(pi<_AB_AG_PAL.length && taken[_AB_AG_PAL[pi].toLowerCase()]) pi++;
      uCol[k]=_AB_AG_PAL[pi%_AB_AG_PAL.length]; taken[uCol[k].toLowerCase()]=1; pi++;
    });
    uCol['_']=_AB_AG_ETC;
  } else {
    /* §abAgCol · ใช้สีประจำเอเย่นต์ตัวเดียวกับหน้า By trip date (bkV2AgentColor)
       ซึ่งอ่าน agent.color ที่ตั้งเองไว้ก่อน ถ้าไม่มีค่อย hash เป็นสีคงที่
       เดิมผมแจกสีตามอันดับยอด ทำให้เอเย่นต์เดียวกันคนละสีกับหน้าอื่น */
    uRank.slice(0,_AB_AG_PAL.length).forEach(function(k,i){
      uCol[k]=(k!=='_' && typeof bkV2AgentColor==='function') ? bkV2AgentColor(k) : _AB_AG_PAL[i];
    });
    uCol['_']=_AB_AG_ETC;
  }
  var uShown={}; (BY==='sales'?uRank:uRank.slice(0,_AB_AG_PAL.length)).forEach(function(k){ uShown[k]=1; });

  var gcols=(N===7?176:152)+'px repeat('+N+',minmax(0,1fr)) 44px';

  /* §abMonth · แถบเดือนพาดบนหัววัน · ยาวเท่ากับจำนวนวันของเดือนนั้นในช่วงที่ดู
     หัววันมีแต่เลข (11 12 13…) พอช่วง 7/14 วันคร่อมสิ้นเดือนจะอ่านไม่ออกว่า
     "1" คือวันที่ 1 ของเดือนถัดไป หรือย้อนกลับ · แถบนี้ตอบตรงนั้น */
  var mMon='<div class="ab-mlbl"></div>', _mg=[];
  DATES.forEach(function(ds){
    var k=ds.slice(0,7);
    if(_mg.length && _mg[_mg.length-1].k===k) _mg[_mg.length-1].n++;
    else _mg.push({k:k,n:1});
  });
  _mg.forEach(function(g){
    mMon+='<div class="ab-mmon" style="grid-column:span '+g.n+'">'+_abEsc(_abMonFull(g.k))+'</div>';
  });
  mMon+='<div class="ab-mmon"></div>';

  var mHead='<div class="ab-mlbl">Route</div>';
  DATES.forEach(function(ds){
    var wd=_abDate(ds).getDay(), wknd=(wd===0||wd===6);
    mHead+='<div class="ab-mh'+(ds===TODAY_STR?' now':(wknd?' wknd':''))+'">'
      +'<u>'+_abDow(ds)+'</u><b>'+_abDate(ds).getDate()+'</b></div>';
  });
  mHead+='<div class="ab-mh"><u>&nbsp;</u><b>Total</b></div>';

  function mCell(rid,ds){
    var c=SC.cell[rid+'|'+ds];
    var go=' onclick="abGoTrip(\''+rid+'\',\''+ds+'\')"';
    if(!c) return '<div class="ab-mc off"></div>';
    if(c.state==='charter') return '<div class="ab-mc chtr" title="'+_abDayLbl(ds)+' \u00b7 whole-boat charter"'+go+'>'
      +(N===7?'<span class="sub" style="text-align:center">Charter</span>':'CHTR')+'</div>';
    if(c.state==='wx') return '<div class="ab-mc wx" title="'+_abDayLbl(ds)+' \u00b7 cancelled (weather)"'+go+'>&#9928;</div>';
    var col=_abFillCol(c.fill);
    /* แท่ง · ยาวเท่า fill% เหมือนเดิม แต่ซอยเป็นรายเอเย่นต์
       ที่ล็อกไม่มีเจ้าของบุคกิ้ง (ยังไม่ออกใบ) จึงเป็นก้อนลายทางท้ายแท่ง
       ไม่ยัดรวมกับใครสักคน ไม่งั้นจะอ่านว่าเจ้านั้นขายได้ทั้งที่ยังไม่ได้ขาย */
    var mp=unit[rid+'|'+ds]||{};
    var mk=Object.keys(mp).sort(function(a,b){ return mp[b]-mp[a]; });
    var segs='', tipAg='';
    if(c.cap>0){
      mk.forEach(function(a){
        var w=mp[a]/c.cap*100; if(w<=0) return;
        segs+='<i style="width:'+w+'%;background:'+(uShown[a]?uCol[a]:_AB_AG_ETC)+'"></i>';
      });
      if(c.lock>0) segs+='<i style="width:'+(c.lock/c.cap*100)+'%;background:repeating-linear-gradient('
        +'45deg,#9FB8D8,#9FB8D8 2px,#D7E3F2 2px,#D7E3F2 4px)"></i>';
      tipAg=mk.slice(0,8).map(function(a){ return _unitName(a)+' '+mp[a]; }).join(' · ');
    }
    if(!segs) segs='<i style="width:'+Math.max(2,c.fill)+'%;background:'+col[1]+'"></i>';
    var tip=_abDayLbl(ds)+' \u00b7 sold '+c.sold+(c.lock?(' \u00b7 held '+c.lock):'')
      +' \u00b7 free '+c.free+' / '+c.cap+' ('+c.fill+'%)'+(tipAg?('\n'+tipAg):'');
    return '<div class="ab-mc" style="background:'+col[0]+';color:'+col[1]+'" title="'+_abEsc(tip)+'"'+go+'>'
      +'<span class="v">'+c.free+'<em>/'+c.cap+'</em></span>'
      +'<span class="mbar">'+segs+'</span>'
      +'<span class="sub">sold '+c.sold+(c.lock?(' \u00b7 <span class="lk">held '+c.lock+'</span>'):'')
        +' \u00b7 '+c.fill+'%</span>'
    +'</div>';
  }

  var mRows='';
  RIDS.forEach(function(rid){
    mRows+='<div class="ab-mn"><i style="background:'+_abRouteCol(rid)+'"></i>'
      +'<span>'+_abEsc(_abRouteName(rid))+'</span></div>';
    DATES.forEach(function(ds){ mRows+=mCell(rid,ds); });
    mRows+='<div class="ab-mtot">'+rowTot[rid].free+'</div>';
  });
  /* แถวล่าง · รวมรายวัน · ตอบ "วันไหนแย่ที่สุดทั้งวัน" โดยไม่ต้องบวกเอง
     เส้นทางเดียวว่าง 40 อาจไม่เท่าไหร่ แต่ถ้าทั้งวันว่าง 150 คือคนละเรื่อง */
  /* §abBy · แถวรวม/วัน ต้องตอบด้วยว่า "วันนั้นเป็นลูกค้าของเซลส์คนไหน กี่คน"
     ใส่เป็นตัวเลขจริงไม่ใช่ tooltip เพราะเป็นของที่ต้องกวาดตาเทียบข้ามวัน
     ถ้าอยู่ใน tooltip ต้องชี้ทีละช่องซึ่งเทียบไม่ได้ */
  var fRow='<div class="ab-mlbl">Daily total<u>'+(BY==='sales'?'by sales':'by agent')+'</u></div>';
  DATES.forEach(function(ds){
    var t=dayTot[ds], p=t.cap>0?Math.round((t.sold+t.lock)/t.cap*100):-1;
    var dm=uDay[ds]||{};
    var dk=Object.keys(dm).sort(function(a,b){ return dm[b]-dm[a]; });
    var split='';
    if(N===7 && dk.length){
      split='<span class="ab-usp">'+dk.slice(0,6).map(function(k){
        return '<em title="'+_abEsc(_unitName(k))+'"><i style="background:'
          +(uShown[k]?uCol[k]:_AB_AG_ETC)+'"></i>'+_abEsc(_unitCode(k))+' '+dm[k]+'</em>';
      }).join('')+'</span>';
    }
    fRow+='<div class="ab-mfoot">'+(p<0?'<b>—</b>':('<b>'+t.free+'</b>'+p+'%'+split))+'</div>';
  });
  var gCap=0,gSold=0,gLock=0,gFree=0;
  DATES.forEach(function(ds){ gCap+=dayTot[ds].cap; gSold+=dayTot[ds].sold;
    gLock+=dayTot[ds].lock; gFree+=dayTot[ds].free; });
  var gFill=gCap>0?Math.round((gSold+gLock)/gCap*100):0;
  fRow+='<div class="ab-mfoot"><b>'+gFree+'</b></div>';

  /* คำอธิบายสีเอเย่นต์ · เรียงตามยอดรวม ซึ่งเป็นลำดับเดียวกับที่ใช้แจกสี
     จึงอ่านคู่กับแท่งได้ตรง ๆ · §abBar14 ทำให้ 14 วันมีแท่งแล้ว จึงต้องมีคำอธิบายด้วย */
  var agLegend='';
  if(uRank.length){
    var shown=uRank.filter(function(k){ return uShown[k]; });
    var etc=uRank.filter(function(k){ return !uShown[k]; })
                 .reduce(function(x,k){ return x+uTot[k]; },0);
    agLegend='<div class="ab-aglg">'
      +shown.map(function(k){ return '<span><i style="background:'+uCol[k]+'"></i>'
        +'<b>'+_abEsc(_unitName(k))+'</b><em>'+uTot[k]+'</em></span>'; }).join('')
      +(etc>0?('<span><i style="background:'+_AB_AG_ETC+'"></i>Other<em>'+etc+'</em></span>'):'')
      +(gLock>0?('<span><i style="background:repeating-linear-gradient(45deg,#9FB8D8,#9FB8D8 2px,#D7E3F2 2px,#D7E3F2 4px)"></i>Held<em>'+gLock+'</em></span>'):'')
      +'</div>';
  }


  var pierChips='<b class="'+(!PIER?'on':'')+'" onclick="abSetPier(\'\')">All piers</b>';
  _AB_PIERS.forEach(function(k){
    if(!pierN[k]) return;
    pierChips+='<b class="'+(PIER===k?'on':'')+'" onclick="abSetPier(\''+k+'\')">'
      +_abEsc(_abPierLbl(k))+'<i>'+pierN[k]+'</i></b>';
  });
  var mtx='<div class="ab-c ab-mtx">'
    +'<div class="ab-ct"><span class="big">Seats free · route \u00d7 '+N+' days</span>'
      +'<span class="cnt">fill '+gFill+'%</span>'
      +'<span class="ab-tg">'
        +'<b class="'+(N===7?'on':'')+'" onclick="abSetDays(7)">7 days</b>'
        +'<b class="'+(N===14?'on':'')+'" onclick="abSetDays(14)">14 days</b></span>'
      +'<span class="ab-tg">'
        +'<b class="'+(BY==='sales'?'on':'')+'" onclick="abSetBy(\'sales\')">By sales</b>'
        +'<b class="'+(BY==='agent'?'on':'')+'" onclick="abSetBy(\'agent\')">By agent</b></span>'
      +'<span class="ab-pier">'+pierChips+'</span>'
    +'</div>'
    +'<div class="ab-mwrap"><div class="ab-mg d'+N+'" style="grid-template-columns:'+gcols+'">'
      +mMon+mHead+mRows+fRow+'</div></div>'
    +'<div class="ab-mlg">'
      +'<b class="ab-msum">Sold '+gSold+(gLock?(' \u00b7 Held '+gLock):'')
        +' \u00b7 Free '+gFree+' / '+gCap+' seats</b>'
      +'<span><i style="background:#CFE9AC"></i>Selling well</span>'
      +'<span><i style="background:#FAF0C8"></i>Moderate</span>'
      +'<span><i style="background:#FBE9E9"></i>Many free</span>'
      +'<span><i style="background:#F2EAFB"></i>Charter</span>'
      +'<span><i style="background:#F7E7E7"></i>Cancelled (weather)</span>'
      +'<span><i style="background:#FAFAF8"></i>No trip</span>'
      +'<span style="margin-left:auto">Big number = seats free \u00b7 click a cell to open By trip date</span>'
    +'</div>'
    +agLegend
  +'</div>';

  /* ── การ์ดเตือนเรื่องที่นั่ง ── */
  /* §abRisk5 · "At risk ต้องน้อยกว่า 5 วันเลย" · เดิม d<=3 (วันนี้ + อีก 3 วัน)
     เปลี่ยนเป็น d<5 = วันนี้ถึงอีก 4 วัน · ครอบสุดสัปดาห์ถัดไปพอดี มีเวลาโทรตามจริง */
  var risk=OPEN.filter(function(c){ return c.d<5 && c.fill<40; })
               .sort(function(a,b){ return a.d-b.d || a.fill-b.fill; });
  var near=OPEN.filter(function(c){ return c.free>0 && c.free<=5; })
               .sort(function(a,b){ return a.free-b.free || a.d-b.d; });
  var free14=OPEN.reduce(function(s,c){ return s+c.free; },0);

  function tripRow(t){
    var c=_abFillCol(t.fill);
    var gapBg=(t.free<=5)?'#E6F5EC':'#FCEBEB', gapFg=(t.free<=5)?'#0F6E56':'#A32D2D';
    return '<div class="ab-tr'+(t.d===0?' now':'')+'" onclick="abGoTrip(\''+t.rid+'\',\''+t.ds+'\')">'
      +'<span class="ab-day"><u>'+_abDow(t.ds)+'</u><b>'+_abDate(t.ds).getDate()+'</b></span>'
      +'<span class="ab-tb"><span class="rt">'
        +'<i class="ab-rdot" style="background:'+_abRouteCol(t.rid)+'"></i>'+_abEsc(_abRouteName(t.rid))+'</span>'
        +'<span class="bt">'+_abEsc(t.boats.join(' \u00b7 '))
          +(t.d===0?' \u00b7 today':(t.d===1?' \u00b7 tomorrow':' \u00b7 in '+t.d+' days'))+'</span>'
        +_abBar(t.fill,c[1])+'</span>'
      +'<span class="ab-tn"><b style="color:'+c[1]+'">'+t.fill+'%</b>'
        +'<i><span class="ab-gap" style="background:'+gapBg+';color:'+gapFg+'">'
        +(t.free<=5?('short '+t.free):('free '+t.free))+'</span> / '+t.cap+'</i></span>'
    +'</div>';
  }

  var cRisk=_abCard('risk','At risk', risk.length, 'Departs in &lt; 5 days \u00b7 fill &lt; 40%',
      risk.length? risk.map(tripRow).join('') : _abEmpty('No trip at risk in the next 3 days'));
  var cNear=_abCard('near','Almost full', near.length, '\u2264 5 seats left',
      near.length? near.map(tripRow).join('') : _abEmpty('No trip close to full yet'));

  /* ── เอเย่นต์ ── */
  function agRow(r,rank,val,valCol,sub,right){
    return '<div class="ab-ar" onclick="abGoAgents()">'
      +(rank!=null?'<span class="ab-rk">'+rank+'</span>':'')
      /* §abAgDot · "สีประจำ Agent ไม่ขึ้น" · เดิมสีประจำเอเย่นต์โผล่เฉพาะแท่งในตาราง
         และต้องกด "By agent" ก่อน · ในการ์ดอันดับมีแต่จุดสีของ "เซลส์ผู้ดูแล" (.ab-sdot)
         ซึ่งอ่านผิดได้ว่าเป็นสีเอเย่นต์ · ใส่จุดสีเอเย่นต์ไว้หน้าชื่อทุกใบ
         ใช้ bkV2AgentColor ตัวเดียวกับหน้า By trip date จึงตรงกันทุกหน้า */
      +'<span class="ab-ab"><span class="nm">'+_abAgPill(r.id,r.name)+'</span>'
        +'<span class="mt">'+(r.sales?_abSalesChip(r.sales):'')+(sub?('<span>'+sub+'</span>'):'')+'</span></span>'
      +'<span class="ab-an"><span class="v"'+(valCol?(' style="color:'+valCol+'"'):'')+'>'+val+'</span>'
        +'<span class="d">'+(right||'')+'</span></span>'
    +'</div>';
  }

  var top=A.filter(function(r){ return r.inCur>0; })
           .sort(function(a,b){ return b.inCur-a.inCur; }).slice(0,_AB_AG_TOP);
  var cTop=_abCard('','Top senders this month', top.length,
    'Booked in 1\u2013'+S.dayN+' '+_abMonLbl(S.cur)+' \u00b7 vs same days in '+_abMonLbl(S.prev),
    top.length? top.map(function(r,i){
      return agRow(r,i+1,r.inCur,null,
        r.bkCur+' bkgs \u00b7 '+_abMoney(r.revCur)+' \u00b7 '+r.tvCur+' trav',
        _abDelta(r.inCur,r.inPrev)+' <span class="ab-flat">('+r.inPrev+')</span>');
    }).join('') : _abEmpty('No bookings created this month yet'));

  /* ฐานคือเดือนที่ดีที่สุดใน 3 เดือนหลัง ไม่ใช่แค่เดือนที่แล้ว
     เพราะบางเจ้าหายไปตั้งแต่ 2 เดือนก่อน เทียบเดือนเดียวจะมองไม่เห็น */
  var lost=A.map(function(r){
      var base=0, bm='';
      S.back3.forEach(function(m){ if((r.byMon[m]||0)>base){ base=r.byMon[m]||0; bm=m; } });
      r._base=base; r._baseM=bm;
      r._gone=r.lastIn?_abDaysBetween(r.lastIn,TODAY_STR):999;
      return r;
    })
    .filter(function(r){ return r._base>=10 && r.inCur===0 && r._gone>=21; })
    .sort(function(a,b){ return b._base-a._base; }).slice(0,_AB_AG_TOP);
  var cLost=_abCard('lost','Was big \u00b7 now gone', lost.length,
    'Nothing booked this month \u00b7 quiet \u2265 21 days',
    lost.length? lost.map(function(r,i){
      return agRow(r,i+1,'−'+r._base,'#A32D2D',
        'last '+_abDayLbl(r.lastIn)+' \u00b7 quiet '+r._gone+'d',
        '<span class="ab-dn">peak '+r._base+'</span> <span class="ab-flat">('+_abMonLbl(r._baseM)+')</span>');
    }).join('') : _abEmpty('No agent has gone quiet'));

  var steady=A.map(function(r){
      var v=S.back3.map(function(m){ return r.byMon[m]||0; });
      var mean=(v[0]+v[1]+v[2])/3;
      var sd=Math.sqrt(v.reduce(function(s,x){ return s+(x-mean)*(x-mean); },0)/3);
      r._mean=mean; r._cv=mean>0?Math.round(sd/mean*100):999;
      r._all=v.every(function(x){ return x>0; });
      return r;
    })
    .filter(function(r){ return r._all && r.inCur>0 && r._mean>=8 && r._cv<=45; })
    .sort(function(a,b){ return b._mean-a._mean; }).slice(0,_AB_AG_TOP);
  var cSteady=_abCard('','Steady senders', steady.length,
    'Every month '+_abMonLbl(S.back3[0])+'\u2013'+_abMonLbl(S.back3[2])+' and still sending',
    steady.length? steady.map(function(r,i){
      return agRow(r,i+1,Math.round(r._mean),'#0F6E56',
        S.back3.map(function(m){ return (r.byMon[m]||0); }).join(' \u00b7 ')+' pax',
        '<span class="ab-flat">var \u00b1'+r._cv+'%</span> \u00b7 this month '+r.inCur);
    }).join('') : _abEmpty('No agent meets the criteria'));

  var cxl=A.map(function(r){
      r._rc=r.bkCur>0?(r.cxCur/r.bkCur):0;
      r._rp=r.bkPrev>0?(r.cxPrev/r.bkPrev):0;
      return r;
    })
    .filter(function(r){ return r.bkCur>=5 && r.cxCur>=2 && r._rc>=0.20 && (r._rc-r._rp)>=0.08; })
    .sort(function(a,b){ return (b._rc-b._rp)-(a._rc-a._rp); }).slice(0,_AB_AG_TOP);
  var cCxl=_abCard('cxl','Cancellation spike', cxl.length,
    '\u2265 5 bkgs this month \u00b7 \u2265 2 cancelled \u00b7 \u2265 8 pts above last month',
    cxl.length? cxl.map(function(r,i){
      return agRow(r,i+1,Math.round(r._rc*100)+'%','#8A4A00',
        r.cxCur+' of '+r.bkCur+' cancelled',
        '<span class="ab-flat">'+_abMonLbl(S.prev)+' '+Math.round(r._rp*100)+'%</span>');
    }).join('') : _abEmpty('No abnormal cancellation rate'));

  /* ── หัว ── */
  var segs='<b class="'+(!window._abSales?'on':'')+'" onclick="abSetSales(\'\')">All sales</b>';
  _abSalesList().forEach(function(s){
    segs+='<b class="'+(window._abSales===s.id?'on':'')+'" onclick="abSetSales(\''+s.id+'\')">'
      +'<i class="ab-sdot" style="background:'+(s.color||'#8a857d')+'"></i>'+_abEsc(s.name||s.code||s.id)+'</b>';
  });

  var kpi=''
    +'<span class="ab-chip'+(gFill>=70?' ok':'')+'">Fill '+N+'d <b>'+gFill+'%</b></span>'
    +'<span class="ab-chip">Free 14d <b>'+free14+'</b></span>'
    +(gLock?('<span class="ab-chip">Held <b>'+gLock+'</b></span>'):'')
    +'<span class="ab-chip'+(near.length?' ok':'')+'">Almost full <b>'+near.length+'</b></span>'
    +'<span class="ab-chip'+(risk.length?' warn':'')+'">At risk <b>'+risk.length+'</b></span>'
    +'<span class="ab-chip'+(lost.length?' warn':'')+'">Agents gone <b>'+lost.length+'</b></span>';

  wrap.innerHTML=AB_CSS
    +'<div class="ab-fr">'
      +'<div class="ab-hd"><div class="ab-hdtop">'
        +'<span class="ab-ttl">ACTION BOARD</span>'
        +'<span class="ab-seg">'+segs+'</span>'
        +'<span class="ab-kpi">'+kpi+'</span>'
      +'</div>'
      +'<div class="ab-sub" style="margin-top:5px">Seats = today \u2192 next 14 days (sales filter does not apply) \u00b7 '
        +'Agents = booked 1\u2013'+S.dayN+' '+_abMonLbl(S.cur)+' vs '+_abMonLbl(S.prev)+' same days</div>'
      +'</div>'
      +mtx
      +'<div class="ab-grid">'
        +'<div class="ab-col">'+cRisk+cNear+cCxl+'</div>'
        +'<div class="ab-col">'+cTop+'</div>'
        +'<div class="ab-col">'+cSteady+'</div>'
        +'<div class="ab-col">'+cLost+'</div>'
      +'</div>'
    +'</div>';
}
window.abRender=abRender;
