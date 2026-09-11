/* ════════════════════════════════════════════════════════════════════════════
   §saAlert · หน้า Sales Alert  (เมนู Overview › Sales Alert)

   หน้านี้ไม่ใช่รายงาน · เป็น "รายการที่ต้องลงมือวันนี้"
   ทุกบล็อกจึงตอบคำถามเดียวกันเสมอ: ตอนนี้ควรโทรหาใคร / ควรตัดสินใจอะไร

   ฝั่งซ้าย  = ที่นั่ง · เรื่องที่มีเส้นตาย (วันออกเรือ)
   ฝั่งกลาง  = fill rate 14 วันข้างหน้า · ภาพรวมว่าที่ว่างกองอยู่ตรงไหน
   ฝั่งขวา   = เอเย่นต์ · ใครส่งเยอะ ใครหาย ใครนิ่ง ใครยกเลิกผิดปกติ

   ที่มาของตัวเลขทุกตัวใช้ของกลางที่หน้าอื่นใช้อยู่แล้ว ไม่คำนวณเองซ้ำ:
     getAllotment(routeId,ds) · TRIPS · SB_BOOKINGS · SB_AGENTS · SB_SALES
   ═══════════════════════════════════════════════════════════════════════════ */

window._saSales    = '';    // '' = ทุกเซลส์
window._saFillDays = 14;
window._saTab      = 'all'; // ตัวกรองแถวเรือในคอลัมน์กลาง

function _saEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

const _SA_TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const _SA_TH_DOW = ['อา','จ','อ','พ','พฤ','ศ','ส'];

function _saDate(ds){ return new Date(ds+'T12:00:00'); }
function _saDow(ds){ return _SA_TH_DOW[_saDate(ds).getDay()]; }
function _saDayLbl(ds){ var d=_saDate(ds); return d.getDate()+' '+_SA_TH_MON[d.getMonth()]; }
function _saMonShift(ym,k){ var y=+ym.slice(0,4), m=+ym.slice(5,7);
  var d=new Date(y,m-1+k,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function _saMonLbl(ym){ return _SA_TH_MON[(+ym.slice(5,7))-1]; }
function _saDaysBetween(a,b){ return Math.round((_saDate(b)-_saDate(a))/86400000); }
function _saMoney(n){
  n=Math.round(+n||0);
  if(n>=1000000) return '฿'+(n/1000000).toFixed(n>=10000000?0:1)+'M';
  if(n>=1000)    return '฿'+Math.round(n/1000)+'k';
  return '฿'+n;
}
/* สีเดียวกับปฏิทินที่นั่งในหน้า Dashboard · ขายได้มาก = เขียว · ว่างเยอะ = แดง
   คนที่สลับสองหน้านี้จะได้อ่านสีแบบเดียวกัน ไม่ต้องจำสองชุด */
function _saFillCol(p){
  if(p>=95) return ['#BCE595','#1F4D2C'];
  if(p>=80) return ['#CFE9AC','#1F4D2C'];
  if(p>=60) return ['#E8F5D8','#3B6D11'];
  if(p>=40) return ['#FAF0C8','#8A6A0B'];
  if(p>=20) return ['#FBE1C6','#B4600F'];
  return              ['#FBE9E9','#A32D2D'];
}

/* ── เซลส์ผู้ดูแล ─────────────────────────────────────────────────────────── */
function _saSalesList(){ return (typeof SB_SALES!=='undefined' && Array.isArray(SB_SALES)) ? SB_SALES : []; }
function _saAgentMap(){
  var m={}; ((typeof SB_AGENTS!=='undefined'&&Array.isArray(SB_AGENTS))?SB_AGENTS:[]).forEach(function(a){ m[a.id]=a; });
  return m;
}
function _saSalesOf(ag){ return (ag && ag.sales) || ''; }
function _saSalesChip(sid){
  var s=_saSalesList().find(function(x){return x.id===sid;});
  if(!s) return '';
  return '<i class="sa-sdot" style="background:'+(s.color||'#8a857d')+'"></i>'+_saEsc(s.code||s.name||sid);
}

/* ══ ฝั่งที่นั่ง ═══════════════════════════════════════════════════════════ */
/* หนึ่งแถว = หนึ่ง "ทริปที่ออกจริง" (เส้นทาง × วัน) ไม่ใช่หนึ่งลำเรือ
   เพราะที่นั่งเป็นกองเดียวกันทั้งเส้นทาง · วันไหนใช้ 2 ลำก็ขายรวมกัน
   แยกเป็นรายลำแล้วจะได้ตัวเลขที่ไม่มีอยู่จริง จึงเขียนชื่อลำไว้ในแถวแทน */
function _saTrips(days){
  var out=[];
  for(var i=0;i<days;i++){
    var ds=dStr(i);
    var ops=(typeof TRIPS!=='undefined' && TRIPS[ds]) || {};
    var byR={};
    Object.keys(ops).forEach(function(bid){
      var op=ops[bid]; if(!op || !op.route) return;
      var b=(typeof BOATS!=='undefined')?BOATS.find(function(x){return x.id===bid;}):null; if(!b) return;
      (byR[op.route]=byR[op.route]||[]).push(b.name||bid);
    });
    Object.keys(byR).forEach(function(rid){
      if(typeof bkV2IsRouteOpenOn==='function' && !bkV2IsRouteOpenOn(rid,ds)) return;
      if(typeof bkV2IsWeatherClosed==='function' && bkV2IsWeatherClosed(rid,ds)) return;
      var al=(typeof getAllotment==='function')?getAllotment(rid,ds):null;
      if(!al || !al.hasAllotment) return;
      if(al.availableCapacity<=0) return;      // เหมาลำทั้งลำ ไม่มีที่นั่งให้ขาย ไม่ต้องเตือน
      var r=(typeof ROUTES!=='undefined')?ROUTES.find(function(x){return x.id===rid;}):null;
      out.push({ ds:ds, d:i, rid:rid, name:(r&&r.name)||rid, col:(r&&r.color)||'', boats:byR[rid],
        cap:al.availableCapacity, used:al.seatsConsumed+(al.lockedSeats||0),
        free:al.seatsAvailable, fill:al.fillPct });
    });
  }
  return out;
}

/* ══ ฝั่งเอเย่นต์ ═══════════════════════════════════════════════════════════
   เก็บสองแกนเสมอ เพราะสองคำถามคนละเรื่องกัน:
     จองเข้า (createdAt) = "ตอนนี้ยังส่งงานอยู่ไหม"  → ใช้จับคนหาย
     เดินทาง (trips.date) = "เดือนนี้จะมีคนมาเท่าไหร่" → ใช้วางแผนเรือ
   เทียบเดือนที่แล้วใช้ "ช่วงวันเดียวกัน" (1–วันนี้) ไม่เทียบกับเดือนเต็ม
   ไม่งั้นต้นเดือนทุกเจ้าจะดูเหมือนยอดตกหมด ทั้งที่ยังไม่ถึงสิ้นเดือน */
function _saAgentStats(){
  var cur=TODAY_STR.slice(0,7), dayN=+TODAY_STR.slice(8,10), prev=_saMonShift(cur,-1);
  var back3=[_saMonShift(cur,-3),_saMonShift(cur,-2),_saMonShift(cur,-1)];
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

/* กรองตามเซลส์ที่เลือกอยู่ · คืนเป็น array พร้อมชื่อ/เซลส์ติดมาด้วย */
function _saAgentRows(S){
  var AM=_saAgentMap(), sel=window._saSales||'';
  var out=[];
  Object.keys(S.M).forEach(function(id){
    var ag=AM[id]; if(!ag) return;
    if(sel && _saSalesOf(ag)!==sel) return;
    var r=S.M[id];
    r.name=ag.name||ag.code||id; r.sales=_saSalesOf(ag); r.market=ag.market||'';
    out.push(r);
  });
  return out;
}

/* ── ชิ้นส่วนหน้าตา ────────────────────────────────────────────────────────── */
function _saBar(pct,col){
  var p=Math.max(0,Math.min(100,Math.round(pct)));
  return '<span class="sa-bar"><i style="width:'+p+'%;background:'+col+'"></i></span>';
}
function _saDelta(now,before){
  if(!before){ return now>0 ? '<b class="sa-up">ใหม่</b>' : '<b class="sa-flat">—</b>'; }
  var d=Math.round((now-before)/before*100);
  if(d>=5)  return '<b class="sa-up">▲ '+d+'%</b>';
  if(d<=-5) return '<b class="sa-dn">▼ '+Math.abs(d)+'%</b>';
  return '<b class="sa-flat">≈ '+(d>0?'+':'')+d+'%</b>';
}
function _saEmpty(msg){ return '<div class="sa-empty">'+_saEsc(msg)+'</div>'; }
function _saCard(cls,title,cnt,note,body){
  return '<div class="sa-c '+cls+'">'
    +'<div class="sa-ct"><span class="big">'+title+'</span>'
      +(cnt!=null?'<span class="cnt">'+cnt+'</span>':'')
      +(note?'<span class="nt">'+note+'</span>':'')
    +'</div><div class="sa-lw"><div class="sa-list">'+body+'</div></div></div>';
}

/* ══════════════════════════════════════════════════════════════════════════
   CSS · ยืมโทเคนจากหน้า Dashboard ทั้งหมด (พื้น navy · การ์ดขาวมุม 12 ·
   ตัวเลข DM Mono) เพื่อให้สองหน้าอยู่ในภาษาเดียวกัน
   ══════════════════════════════════════════════════════════════════════════ */
const SA_CSS=`<style>
  #sa-wrap *{box-sizing:border-box}
  /* §saAlert · หน้าเดียวจบเหมือน Dashboard แต่ไม่ฮาร์ดโค้ดความสูงหัว
     (หัวที่นี่มี 2 บรรทัด และจะสูงขึ้นอีกถ้าชิปเซลส์ขึ้นบรรทัดใหม่)
     ให้ flex แบ่งความสูงเอง · กริดกินที่เหลือทั้งหมดไม่ว่าหัวจะสูงเท่าไหร่ */
  .sa-fr{position:relative;isolation:isolate;background:#16265C;
    height:calc(100dvh - var(--topbar, 44px));overflow:hidden;
    display:flex;flex-direction:column;
    padding:8px 8px 12px;font-family:'DM Sans',Manrope,-apple-system,system-ui,sans-serif}
  .sa-fr::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(56% 42% at 10% 6%,  rgba(232,74,63,.34),  transparent 62%),
      radial-gradient(46% 40% at 90% 6%,  rgba(186,117,23,.30), transparent 62%),
      radial-gradient(52% 46% at 80% 94%, rgba(15,110,86,.34),  transparent 64%),
      radial-gradient(50% 42% at 20% 96%, rgba(24,95,165,.40),  transparent 62%);
    filter:blur(20px) saturate(120%)}
  .sa-fr>*{position:relative;z-index:1}

  /* ── แถบหัว ── */
  /* padding ขวา 96px = ที่ของปุ่ม ⋯ / เมนู ที่สกินลอยไว้มุมขวาบน (เท่ากับ .dv-hd) */
  .sa-hd{flex:none;position:relative;z-index:30;padding:7px 96px 9px 10px;margin-bottom:9px;border-radius:14px;
    background:linear-gradient(160deg, rgba(22,38,92,.82), rgba(12,24,62,.74));
    -webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%);
    box-shadow:0 8px 26px rgba(2,10,30,.34), inset 0 1px 0 rgba(255,255,255,.18)}
  .sa-hdtop{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .sa-ttl{font-size:15px;font-weight:800;letter-spacing:.20em;color:#fff;white-space:nowrap}
  .sa-sub{font-size:10px;font-weight:600;color:#A8BAD8;letter-spacing:.02em}
  .sa-seg{display:flex;gap:5px;flex-wrap:wrap}
  .sa-seg b{font-size:10.5px;font-weight:700;color:#C9D6EC;background:rgba(255,255,255,.09);
    border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px 10px;cursor:pointer;
    display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
  .sa-seg b:hover{background:rgba(255,255,255,.18)}
  .sa-seg b.on{background:#fff;color:#16265C;border-color:#fff}
  .sa-sdot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
  .sa-kpi{margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}
  .sa-chip{font-size:11px;font-weight:600;color:#D6E2F5;background:rgba(255,255,255,.10);
    border:1px solid rgba(255,255,255,.20);border-radius:999px;padding:4px 11px;white-space:nowrap}
  .sa-chip b{font-family:'DM Mono',ui-monospace,monospace;font-weight:800;color:#fff;font-size:12.5px}
  .sa-chip.warn{background:rgba(232,74,63,.24);border-color:rgba(255,150,140,.42);color:#FFC9C3}
  .sa-chip.warn b{color:#FFD9D4}
  .sa-chip.ok{background:rgba(29,158,117,.24);border-color:rgba(123,227,184,.36);color:#9DF0CB}
  .sa-chip.ok b{color:#CFFBE6}

  /* ── กริด · หน้าเดียวจบ คอลัมน์ยาวเลื่อนในตัวเอง (กติกาเดียวกับ Dashboard) ── */
  .sa-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.42fr) minmax(0,1.38fr);
    gap:9px;align-items:stretch;flex:1 1 auto;min-height:0;overflow:hidden}
  .sa-col{display:flex;flex-direction:column;gap:9px;min-width:0;min-height:0;
    overflow-y:auto;overscroll-behavior:contain;
    scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.34) transparent}
  .sa-col::-webkit-scrollbar{width:6px}
  .sa-col::-webkit-scrollbar-thumb{background:rgba(255,255,255,.30);border-radius:4px}
  .sa-col::-webkit-scrollbar-track{background:transparent}
  /* การ์ดในคอลัมน์แบ่งความสูงกันเอง แล้วรายการเลื่อนในการ์ด
     ถ้าปล่อยให้การ์ดสูงตามเนื้อ คอลัมน์เอเย่นต์ (4 ใบ) จะเลื่อนยาวเกือบ 1000px
     ซึ่งขัดกับเหตุผลที่ทำหน้านี้ — ต้องกวาดตาเห็นทุกใบพร้อมกัน */
  .sa-col>*{flex:0 1 auto;min-height:104px}

  /* ── การ์ด ── */
  .sa-c{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:12px;
    box-shadow:0 6px 22px rgba(2,10,30,.10);padding:12px 13px 11px;
    display:flex;flex-direction:column;min-height:0}
  .sa-ct{display:flex;align-items:center;gap:8px;padding-bottom:9px;margin-bottom:6px;
    border-bottom:1px solid #EFEBE5;flex-wrap:wrap}
  .sa-ct .big{font-size:13px;font-weight:800;color:#12518F}
  .sa-ct .cnt{font-family:'DM Mono',ui-monospace,monospace;font-size:11px;font-weight:800;
    background:#F2F0EC;color:#5A5A52;border-radius:999px;padding:2px 8px}
  .sa-ct .nt{margin-left:auto;font-size:9.5px;font-weight:600;color:#a8a29a;text-align:right}
  .sa-c.risk .sa-ct .big{color:#A32D2D} .sa-c.risk .sa-ct .cnt{background:#FCEBEB;color:#A32D2D}
  .sa-c.near .sa-ct .big{color:#0F6E56} .sa-c.near .sa-ct .cnt{background:#E6F5EC;color:#0F6E56}
  .sa-c.lost .sa-ct .big{color:#A32D2D} .sa-c.lost .sa-ct .cnt{background:#FCEBEB;color:#A32D2D}
  .sa-c.cxl  .sa-ct .big{color:#8A4A00} .sa-c.cxl  .sa-ct .cnt{background:#FBEEDC;color:#8A4A00}
  .sa-list{overflow-y:auto;min-height:0;flex:1 1 auto;
    scrollbar-width:thin;scrollbar-color:#DAD5CC transparent}
  .sa-list::-webkit-scrollbar{width:7px}
  .sa-list::-webkit-scrollbar-thumb{background:#DAD5CC;border-radius:4px}
  .sa-list::-webkit-scrollbar-track{background:transparent}
  .sa-lw{position:relative;min-height:0;flex:1 1 auto;display:flex;flex-direction:column}
  .sa-lw::after{content:'';position:absolute;left:0;right:0;bottom:0;height:22px;pointer-events:none;
    background:linear-gradient(180deg, rgba(255,255,255,0), #fff)}
  .sa-empty{padding:16px 4px;text-align:center;font-size:11px;color:#b6b1a8;font-weight:600}

  /* ── แถวเรือ/ทริป ── */
  .sa-tr{display:flex;align-items:center;gap:9px;padding:7px 4px;border-bottom:1px solid #F5F2ED;cursor:pointer}
  .sa-tr:last-child{border-bottom:0}
  .sa-tr:hover{background:#FBFAF8}
  .sa-day{flex:none;width:42px;text-align:center;border-radius:8px;padding:4px 2px;
    background:#F4F2EE;border:1px solid #EAE6DF}
  .sa-day u{display:block;text-decoration:none;font-size:8.5px;font-weight:800;color:#a8a29a;
    letter-spacing:.04em;line-height:1.1}
  .sa-day b{display:block;font-family:'DM Mono',ui-monospace,monospace;font-size:15px;
    font-weight:800;color:#3a3a36;line-height:1.15}
  .sa-tr.now .sa-day{background:#15382B;border-color:#15382B}
  .sa-tr.now .sa-day u{color:#9DC4B2} .sa-tr.now .sa-day b{color:#fff}
  .sa-tb{flex:1;min-width:0}
  .sa-tb .rt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    font-size:11.5px;font-weight:700;color:#2c2c2a;line-height:1.28}
  .sa-rdot{width:7px;height:7px;border-radius:2px;display:inline-block;margin-right:5px;
    vertical-align:1px;flex:none}
  .sa-tb .bt{display:block;font-size:9.5px;font-weight:600;color:#9b9088;margin-top:1px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sa-bar{display:block;height:5px;border-radius:3px;background:#F1EEE9;overflow:hidden;margin-top:4px}
  .sa-bar i{display:block;height:100%;border-radius:3px}
  .sa-tn{flex:none;text-align:right;min-width:72px}
  .sa-tn b{display:block;font-family:'DM Mono',ui-monospace,monospace;font-size:16px;
    font-weight:800;line-height:1.1}
  .sa-tn i{display:block;font-style:normal;font-size:9.5px;font-weight:700;color:#8a857d;margin-top:2px;
    white-space:nowrap}
  .sa-gap{font-family:'DM Mono',ui-monospace,monospace;font-weight:800;border-radius:6px;
    padding:1px 6px;font-size:10.5px}

  /* ── แถบ 14 วัน ── */
  .sa-strip{display:flex;gap:3px;align-items:flex-end;height:52px;margin:2px 0 9px}
  .sa-sd{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
    height:100%;cursor:pointer;border-radius:5px;padding-bottom:1px}
  .sa-sd:hover{background:#FBFAF8}
  .sa-sd .rail{width:80%;height:36px;border-radius:4px;background:#F4F6F4;
    box-shadow:inset 0 0 0 1px #ECEFEC;display:flex;align-items:flex-end;overflow:hidden}
  .sa-sd .bx{width:100%;border-radius:3px}
  .sa-sd .lb{font-family:'DM Mono',ui-monospace,monospace;font-size:8px;font-weight:700;
    color:#b6b1a8;margin-top:3px;line-height:1}
  .sa-sd.now .lb{color:#15382B;font-weight:800}

  /* ── แถวเอเย่นต์ ── */
  .sa-ar{display:flex;align-items:center;gap:9px;padding:7px 4px;border-bottom:1px solid #F5F2ED;cursor:pointer}
  .sa-ar:last-child{border-bottom:0}
  .sa-ar:hover{background:#FBFAF8}
  .sa-rk{flex:none;width:17px;text-align:center;font-family:'DM Mono',ui-monospace,monospace;
    font-size:11px;font-weight:800;color:#c4bfb6}
  .sa-ab{flex:1;min-width:0}
  .sa-ab .nm{display:block;font-size:11.5px;font-weight:700;color:#2c2c2a;line-height:1.3;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sa-ab .mt{display:flex;align-items:center;gap:5px;font-size:9.5px;font-weight:600;color:#9b9088;margin-top:2px}
  .sa-an{flex:none;text-align:right;min-width:74px}
  .sa-an .v{display:block;font-family:'DM Mono',ui-monospace,monospace;font-size:16px;
    font-weight:800;color:#3a3a36;line-height:1.1}
  .sa-an .d{display:block;font-size:9.5px;font-weight:700;margin-top:2px;white-space:nowrap}
  .sa-up{color:#0F6E56} .sa-dn{color:#A32D2D} .sa-flat{color:#a8a29a}
  .sa-ab .mt .sa-sdot{margin-right:1px}
  .sa-tag{font-size:8.5px;font-weight:800;letter-spacing:.04em;border-radius:4px;padding:1px 5px;
    background:#F2F0EC;color:#7a736c;text-transform:uppercase}

  /* ── จอเล็ก ── */
  @media (max-width:1365px){
    .sa-fr{height:auto;min-height:calc(100dvh - var(--topbar, 44px));overflow:visible;display:block}
    .sa-hd{position:sticky;top:0}
    .sa-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);height:auto;overflow:visible}
    .sa-col{overflow-y:visible}
    .sa-col>*{flex:0 0 auto}
    .sa-col:nth-child(3){grid-column:1/-1;flex-direction:row;flex-wrap:wrap}
    .sa-col:nth-child(3)>*{flex:1 1 340px}
    .sa-list{max-height:420px}
  }
  @media (max-width:820px){
    .sa-grid{grid-template-columns:minmax(0,1fr);gap:10px}
    .sa-col:nth-child(3){flex-direction:column;flex-wrap:nowrap}
    .sa-col:nth-child(3)>*{flex:0 0 auto}
    .sa-kpi{margin-left:0;width:100%;flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start}
    .sa-kpi::-webkit-scrollbar{display:none}
    .sa-chip{flex:none}
    .sa-seg{flex-wrap:nowrap;overflow-x:auto;width:100%}
    .sa-seg::-webkit-scrollbar{display:none}
    .sa-seg b{flex:none;min-height:32px}
    .sa-list{max-height:360px}
  }
</style>`;

/* ── ตัวกรอง ─────────────────────────────────────────────────────────────── */
window.saSetSales=function(id){ window._saSales=(window._saSales===id)?'':(id||''); saRender(); };
window.saGoTrip=function(rid,ds){ if(typeof bkV2OpenFiltered==='function') bkV2OpenFiltered(rid||'',ds); };
window.saGoAgents=function(){ var el=document.querySelector('[data-view=agents]');
  if(el && typeof nav==='function') nav(el); };

/* ══════════════════════════════════════════════════════════════════════════ */
function saRender(){
  var wrap=document.getElementById('sa-wrap'); if(!wrap) return;

  var TR=_saTrips(window._saFillDays||14);
  var S=_saAgentStats();
  var A=_saAgentRows(S);

  /* ── ที่นั่ง ── */
  var risk=TR.filter(function(t){ return t.d<=3 && t.fill<40; })
             .sort(function(a,b){ return a.d-b.d || a.fill-b.fill; });
  var near=TR.filter(function(t){ return t.free>0 && t.free<=5; })
             .sort(function(a,b){ return a.free-b.free || a.d-b.d; });
  var freeTot=TR.reduce(function(s,t){ return s+t.free; },0);
  var capTot =TR.reduce(function(s,t){ return s+t.cap;  },0);
  var usedTot=TR.reduce(function(s,t){ return s+t.used; },0);
  var fillTot=capTot>0?Math.round(usedTot/capTot*100):0;

  function tripRow(t){
    var c=_saFillCol(t.fill);
    var gapBg=(t.free<=5)?'#E6F5EC':'#FCEBEB', gapFg=(t.free<=5)?'#0F6E56':'#A32D2D';
    return '<div class="sa-tr'+(t.d===0?' now':'')+'" onclick="saGoTrip(\''+t.rid+'\',\''+t.ds+'\')">'
      +'<span class="sa-day"><u>'+_saDow(t.ds)+'</u><b>'+_saDate(t.ds).getDate()+'</b></span>'
      +'<span class="sa-tb"><span class="rt">'
        +'<i class="sa-rdot" style="background:'+(t.col||'#b6b1a8')+'"></i>'+_saEsc(t.name)+'</span>'
        +'<span class="bt">'+_saEsc(t.boats.join(' · '))+(t.d===0?' · วันนี้':(t.d===1?' · พรุ่งนี้':' · อีก '+t.d+' วัน'))+'</span>'
        +_saBar(t.fill,c[1])+'</span>'
      +'<span class="sa-tn"><b style="color:'+c[1]+'">'+t.fill+'%</b>'
        +'<i><span class="sa-gap" style="background:'+gapBg+';color:'+gapFg+'">'
        +(t.free<=5?('ขาด '+t.free):('ว่าง '+t.free))+'</span> / '+t.cap+'</i></span>'
    +'</div>';
  }

  /* แถบ 14 วัน · ให้เห็นก่อนเลื่อนอ่านรายบรรทัดว่าที่ว่างกองอยู่วันไหน */
  var byDay={};
  TR.forEach(function(t){ var k=t.ds; (byDay[k]=byDay[k]||{cap:0,used:0,ds:k,d:t.d}); byDay[k].cap+=t.cap; byDay[k].used+=t.used; });
  var strip='';
  for(var i=0;i<(window._saFillDays||14);i++){
    var ds=dStr(i), a=byDay[ds];
    var p=(a&&a.cap>0)?Math.round(a.used/a.cap*100):-1;
    var col=(p<0)?['#F5F5F2','#b9beb6']:_saFillCol(p);
    var h=(p<0)?0:Math.max(3,Math.round(p/100*36));
    strip+='<div class="sa-sd'+(i===0?' now':'')+'" title="'+_saDayLbl(ds)+(p<0?' · ไม่มีทริป':' · fill '+p+'%')+'"'
      +(p<0?'':' onclick="saGoTrip(\'\',\''+ds+'\')"')+'>'
      +'<span class="rail"><i class="bx" style="height:'+h+'px;background:'+col[0]+'"></i></span>'
      +'<span class="lb">'+_saDate(ds).getDate()+'</span></div>';
  }

  var colSeat=
    _saCard('risk','วันเสี่ยง', risk.length, 'ออกใน 3 วัน · fill &lt; 40%',
      risk.length? risk.map(tripRow).join('') : _saEmpty('ไม่มีทริปที่เสี่ยงใน 3 วันนี้'))
   +_saCard('near','ขาดอีกนิดเดียวเต็ม', near.length, 'เหลือ ≤ 5 ที่',
      near.length? near.map(tripRow).join('') : _saEmpty('ยังไม่มีทริปที่ใกล้เต็ม'));

  var colFill=
    '<div class="sa-c" style="flex:1 1 auto">'
     +'<div class="sa-ct"><span class="big">Fill rate · 14 วันข้างหน้า</span>'
       +'<span class="cnt">'+fillTot+'%</span>'
       +'<span class="nt">ขายแล้ว '+usedTot+' / '+capTot+' ที่ · ว่าง '+freeTot+'</span></div>'
     +'<div class="sa-strip">'+strip+'</div>'
     +'<div class="sa-lw"><div class="sa-list">'+(TR.length
        ? TR.slice().sort(function(a,b){ return a.d-b.d || b.free-a.free; }).map(tripRow).join('')
        : _saEmpty('ยังไม่มีเรือลงตารางใน 14 วันข้างหน้า'))+'</div></div>'
    +'</div>';

  /* ── เอเย่นต์ ── */
  function agRow(r,rank,val,valCol,sub,right){
    return '<div class="sa-ar" onclick="saGoAgents()">'
      +(rank!=null?'<span class="sa-rk">'+rank+'</span>':'')
      +'<span class="sa-ab"><span class="nm">'+_saEsc(r.name)+'</span>'
        +'<span class="mt">'+(r.sales?_saSalesChip(r.sales):'')+(sub?('<span>'+sub+'</span>'):'')+'</span></span>'
      +'<span class="sa-an"><span class="v"'+(valCol?(' style="color:'+valCol+'"'):'')+'>'+val+'</span>'
        +'<span class="d">'+(right||'')+'</span></span>'
    +'</div>';
  }

  // 1 · ส่งเยอะ
  var top=A.filter(function(r){ return r.inCur>0; })
           .sort(function(a,b){ return b.inCur-a.inCur; }).slice(0,10);
  var cTop=_saCard('','Top ส่งเยอะเดือนนี้', top.length,
    'จองเข้า 1–'+S.dayN+' '+_saMonLbl(S.cur)+' · เทียบ '+_saMonLbl(S.prev)+' ช่วงเดียวกัน',
    top.length? top.map(function(r,i){
      return agRow(r,i+1,r.inCur,null,
        r.bkCur+' ใบ · '+_saMoney(r.revCur)+' · เดินทาง '+r.tvCur,
        _saDelta(r.inCur,r.inPrev)+' <span class="sa-flat">('+r.inPrev+')</span>');
    }).join('') : _saEmpty('เดือนนี้ยังไม่มี booking เข้า'));

  // 2 · หายไป · ฐานคือเดือนที่ดีที่สุดใน 3 เดือนหลัง ไม่ใช่แค่เดือนที่แล้ว
  //     เพราะบางเจ้าหายไปตั้งแต่ 2 เดือนก่อน เทียบเดือนเดียวจะมองไม่เห็น
  var lost=A.map(function(r){
      var base=0, bm='';
      S.back3.forEach(function(m){ if((r.byMon[m]||0)>base){ base=r.byMon[m]||0; bm=m; } });
      r._base=base; r._baseM=bm;
      r._gone=r.lastIn?_saDaysBetween(r.lastIn,TODAY_STR):999;
      return r;
    })
    .filter(function(r){ return r._base>=10 && r.inCur===0 && r._gone>=21; })
    .sort(function(a,b){ return b._base-a._base; }).slice(0,10);
  var cLost=_saCard('lost','เคยส่งเยอะ · ตอนนี้หาย', lost.length,
    'ไม่มี booking เข้าเลยเดือนนี้ · หยุดไป ≥ 21 วัน',
    lost.length? lost.map(function(r,i){
      return agRow(r,i+1,'−'+r._base,'#A32D2D',
        'ส่งล่าสุด '+_saDayLbl(r.lastIn)+' · หยุดไป '+r._gone+' วัน',
        '<span class="sa-dn">เคยได้ '+r._base+'</span> <span class="sa-flat">('+_saMonLbl(r._baseM)+')</span>');
    }).join('') : _saEmpty('ยังไม่มีเอเย่นต์ที่หายไป'));

  // 3 · ส่งสม่ำเสมอ · ต้องมีทุกเดือนใน 3 เดือนหลัง และเดือนนี้ยังส่งอยู่
  var steady=A.map(function(r){
      var v=S.back3.map(function(m){ return r.byMon[m]||0; });
      var mean=(v[0]+v[1]+v[2])/3;
      var sd=Math.sqrt(v.reduce(function(s,x){ return s+(x-mean)*(x-mean); },0)/3);
      r._mean=mean; r._cv=mean>0?Math.round(sd/mean*100):999;
      r._all=v.every(function(x){ return x>0; });
      return r;
    })
    .filter(function(r){ return r._all && r.inCur>0 && r._mean>=8 && r._cv<=45; })
    .sort(function(a,b){ return b._mean-a._mean; }).slice(0,10);
  var cSteady=_saCard('','ส่งสม่ำเสมอ', steady.length,
    'มีทุกเดือน '+_saMonLbl(S.back3[0])+'–'+_saMonLbl(S.back3[2])+' และเดือนนี้ยังส่ง',
    steady.length? steady.map(function(r,i){
      return agRow(r,i+1,Math.round(r._mean),'#0F6E56',
        S.back3.map(function(m){ return (r.byMon[m]||0); }).join(' · ')+' pax',
        '<span class="sa-flat">ผันผวน ±'+r._cv+'%</span> · เดือนนี้ '+r.inCur);
    }).join('') : _saEmpty('ยังไม่มีเอเย่นต์ที่เข้าเกณฑ์'));

  // 4 · ยกเลิกพุ่ง
  var cxl=A.map(function(r){
      r._rc=r.bkCur>0?(r.cxCur/r.bkCur):0;
      r._rp=r.bkPrev>0?(r.cxPrev/r.bkPrev):0;
      return r;
    })
    .filter(function(r){ return r.bkCur>=5 && r.cxCur>=2 && r._rc>=0.20 && (r._rc-r._rp)>=0.08; })
    .sort(function(a,b){ return (b._rc-b._rp)-(a._rc-a._rp); }).slice(0,8);
  var cCxl=_saCard('cxl','ยกเลิกพุ่ง', cxl.length, 'เดือนนี้ ≥ 5 ใบ · ยกเลิก ≥ 2 · สูงกว่าเดือนที่แล้ว ≥ 8 จุด',
    cxl.length? cxl.map(function(r,i){
      return agRow(r,i+1,Math.round(r._rc*100)+'%','#8A4A00',
        'ยกเลิก '+r.cxCur+' จาก '+r.bkCur+' ใบ',
        '<span class="sa-flat">'+_saMonLbl(S.prev)+' '+Math.round(r._rp*100)+'%</span>');
    }).join('') : _saEmpty('ไม่มีเอเย่นต์ที่ยกเลิกผิดปกติ'));

  /* ── หัว ── */
  var segs='<b class="'+(!window._saSales?'on':'')+'" onclick="saSetSales(\'\')">ทุกเซลส์</b>';
  _saSalesList().forEach(function(s){
    segs+='<b class="'+(window._saSales===s.id?'on':'')+'" onclick="saSetSales(\''+s.id+'\')">'
      +'<i class="sa-sdot" style="background:'+(s.color||'#8a857d')+'"></i>'+_saEsc(s.name||s.code||s.id)+'</b>';
  });

  var kpi=''
    +'<span class="sa-chip'+(fillTot>=70?' ok':'')+'">fill 14 วัน <b>'+fillTot+'%</b></span>'
    +'<span class="sa-chip">ที่ว่าง <b>'+freeTot+'</b></span>'
    +'<span class="sa-chip'+(near.length?' ok':'')+'">ใกล้เต็ม <b>'+near.length+'</b></span>'
    +'<span class="sa-chip'+(risk.length?' warn':'')+'">วันเสี่ยง <b>'+risk.length+'</b></span>'
    +'<span class="sa-chip'+(lost.length?' warn':'')+'">เอเย่นต์หาย <b>'+lost.length+'</b></span>';

  wrap.innerHTML=SA_CSS
    +'<div class="sa-fr">'
      +'<div class="sa-hd"><div class="sa-hdtop">'
        +'<span class="sa-ttl">SALES ALERT</span>'
        +'<span class="sa-seg">'+segs+'</span>'
        +'<span class="sa-kpi">'+kpi+'</span>'
      +'</div>'
      +'<div class="sa-sub" style="margin-top:5px">ที่นั่ง = 14 วันข้างหน้า (ตัวกรองเซลส์ไม่มีผล) · '
        +'เอเย่นต์ = จองเข้า 1–'+S.dayN+' '+_saMonLbl(S.cur)+' เทียบ '+_saMonLbl(S.prev)+' ช่วงวันเดียวกัน</div>'
      +'</div>'
      +'<div class="sa-grid">'
        +'<div class="sa-col">'+colSeat+'</div>'
        +'<div class="sa-col">'+colFill+'</div>'
        +'<div class="sa-col">'+cTop+cLost+cSteady+cCxl+'</div>'
      +'</div>'
    +'</div>';
}
window.saRender=saRender;
