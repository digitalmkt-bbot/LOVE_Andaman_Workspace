/* ════════════════════════════════════════════════════════════════════════
   §opsDashProg (2026-10-20) · FE-9 · Dashboard "Programmes" card (§dashProg, _dashProgHtml in 04-data-core.js) on the server's by-trip answer
   ────────────────────────────────────────────────────────────────────────
   Legacy summed A/C/I/F per programme from SB_BOOKINGS for one date; here only the ranges some screen loaded are held, so most dates showed 0.
   The card's body below is legacy's (copied from 04-data-core.js, only the block that counted bookings is replaced): the heads and the
   booking count come from GET /operations/by-trip?date= (marine page and land page: laOpsByTripFor), the seats from getAllotment and the
   locks from bookingV2LockedTotal (50-ops-availability.js / 30-ops-locks.js answer any date and redraw the dashboard when they land).
   dashCalSetView / dashProgOpen / dashProgShift / dashProgSetPier / dashProgTog are client UI state and stay legacy's.
   Pending-approval bookings are out of the heads (the server's pax leaves them out), as on the By-trip page; legacy counted them.
   Classic script · after 72-ops-by-trip.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window._dashProgHtml;
  if(typeof orig !== 'function') return;

  function progHtml(dx,F){
    var esc=function(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    var date=window._dashProgDate||window._dashDate||TODAY_STR, pierF=window._dashProgPier||'all', famFilter=window._dashCalFam||'';
    var allRoutes=(typeof ROUTES!=='undefined'?ROUTES:[]);
    var famOf=function(rid){ return (typeof bookingV2RouteFamily==='function')?bookingV2RouteFamily(rid):null; };
    var fams={}; allRoutes.forEach(function(r){ var f=famOf(r.id); if(f&&!fams[f.id]) fams[f.id]=f.name; });
    var inF=function(r){ if(!r) return false; if(famFilter && ((famOf(r.id)||{}).id!==famFilter)) return false; if(pierF!=='all' && (r.pier||'')!==pierF) return false; return true; };
    var PT=function(px,k){ return (typeof bookingV2PaxTot==='function')?(+bookingV2PaxTot(px||{},k)||0):0; };
    /* §dashProgSrv · the heads by type of each programme are the server's: GET /operations/by-trip for the day, marine page and land page
       (routes[].pax {ad, chd, inf, foc}, routes[].bookings). A miss asks once and the card is drawn again when the answer lands (laOpsByTripOnLoad).
       A booking waiting for approval is not in the server's pax; legacy counted it here. The browser's SB_BOOKINGS is not read. */
    var BD={}, BS={}, dayBk=0, dayBd={ad:0,chd:0,inf:0,foc:0};
    [false,true].forEach(function(land){
      var ans=(typeof window.laOpsByTripFor==='function')?window.laOpsByTripFor(date,land):null;
      ((ans&&ans.routes)||[]).forEach(function(R){
        var r=allRoutes.find(function(x){ return x.id===R.route_id; }); if(!inF(r)) return;
        var o=BD[R.route_id]||(BD[R.route_id]={ad:0,chd:0,inf:0,foc:0});
        ['ad','chd','inf','foc'].forEach(function(k){ var v=+((R.pax||{})[k])||0; o[k]+=v; dayBd[k]+=v; });
        dayBk+=(+R.bookings||0); BS[R.route_id]=(BS[R.route_id]||0)+(+R.seat_pax||0);   /* seats booked, for a programme with no allotment */
      });
    });
    var paxOf=function(o){ return o?(o.ad+o.chd+o.inf+o.foc):0; };
    var bdHtml=function(o){ o=o||{}; var ks=[['ad','A'],['chd','C'],['inf','I'],['foc','F']].filter(function(x){ return (+o[x[0]]||0)>0; });
      return ks.map(function(x){ return '<span class="q'+(x[0]==='foc'?' f':'')+'">'+(+o[x[0]])+'<s>'+x[1]+'</s></span>'; }).join(''); };
    var lkHtml=function(n){ return n>0?('<span class="dp-lk" title="'+laT('ล็อก')+' '+n+'">'+_DP_LOCK+'<b>'+n+'</b></span>'):''; };
    var frHtml=function(cap,av,bk){ if(!(cap>0)) return '<span class="dp-fr none">'+(bk>0?laT('ไม่จำกัด'):'&mdash;')+'</span>';
      return av<=0?'<span class="dp-fr full">'+laT('เต็ม')+'</span>':('<span class="dp-fr'+(av/cap<0.2?' low':'')+'">'+laT('ว่าง')+' '+av+'</span>'); };
    var pierAb=function(p){ return p==='tublamu'?'TL':p==='panwa'?'VP':p==='ranong'?'RN':(p||''); };
    var subOf=function(r,f){ var x=String(r.name||r.id).replace((f&&f.name)||'','').replace(/^[\s·\-]*by[\s·\-]*/i,'').replace(/^[\s·\-]+/,'').trim();
      return x||((typeof bookingV2RouteShort==='function'&&bookingV2RouteShort(r.id))||r.name||r.id); };
    /* รอบที่ขึ้นกระดาน: เปิดวันนั้นและมีที่นั่ง/คนจอง/ล็อก · หรือปิดแต่ยังมีคนจองค้าง */
    var G={}, tFree=0, tCap=0, tBkd=0;
    allRoutes.forEach(function(r){
      if(!inF(r)) return;
      var open=(typeof bookingV2IsRouteOpenOn!=='function')||bookingV2IsRouteOpenOn(r.id,date);
      var wx=(typeof bookingV2IsWeatherClosed==='function')&&bookingV2IsWeatherClosed(r.id,date);
      var al=(typeof getAllotment==='function')?getAllotment(r.id,date):null, has=!!(al&&al.hasAllotment);
      var bk=has?(al.seatsConsumed||0):(BS[r.id]||0);
      var cap=has?(al.availableCapacity||0):0, av=has?Math.max(0,al.seatsAvailable||0):0;
      var lk=(typeof bookingV2LockedTotal==='function')?(+bookingV2LockedTotal(r.id,date)||0):0;
      var px=paxOf(BD[r.id]);
      if(open && !wx && has){ tCap+=cap; tFree+=av; tBkd+=(al.seatsConsumed||0); }   /* = dayAgg ของปฏิทิน */
      var run=open && !wx;
      if(!(run && (cap>0||bk>0||lk>0||px>0)) && !(px>0)) return;
      var f=famOf(r.id)||{id:'_',name:laT('อื่น ๆ'),color:'#8b909c'};
      var g=G[f.id]||(G[f.id]={f:f,rs:[],pax:0,bd:{ad:0,chd:0,inf:0,foc:0},bk:0,lk:0,cap:0,av:0,capN:0,run:0});
      g.rs.push({r:r,run:run,wx:wx,bk:bk,cap:cap,av:av,lk:lk,has:has,bd:BD[r.id],dep:((r.times||[])[0]||'')});
      g.pax+=px; ['ad','chd','inf','foc'].forEach(function(k){ g.bd[k]+=((BD[r.id]||{})[k]||0); });
      if(run){ g.run++; g.bk+=bk; g.lk+=lk; if(has){ g.cap+=cap; g.av+=av; g.capN++; } }
    });
    var FAM=(typeof _BKV2_FAMILIES!=='undefined')?_BKV2_FAMILIES:[];
    var fi=function(id){ var i=FAM.findIndex(function(x){ return x.id===id; }); return i<0?999:i; };
    var list=Object.keys(G).map(function(k){ return G[k]; }).sort(function(a,b){ return fi(a.f.id)-fi(b.f.id); });
    var O=window._dashProgOpen||{};
    var body=list.map(function(g){
      var col=g.f.color||'#8b909c', fid=g.f.id, open=Object.prototype.hasOwnProperty.call(O,fid)?!!O[fid]:(g.rs.length>1);
      (window._dashProgCur||(window._dashProgCur={}))[fid]=open;
      var rs=g.rs.slice().sort(function(a,b){ return String(a.dep).localeCompare(String(b.dep)) || ((typeof laRouteOrdCmp==='function')?laRouteOrdCmp(a.r.id,b.r.id):0); });
      var tot=g.bk+g.lk;
      var h='<div class="dp-fm" style="--c:'+col+'">'
        +'<div class="dp-r dp-h" onclick="dashProgTog(\''+esc(fid)+'\')" title="'+(open?laT('พับ'):laT('กางดูรอบ'))+'">'
          +'<span class="ar">'+(open?'&#9662;':'&#9656;')+'</span>'
          +'<span class="nm"><i></i>'+esc(g.f.name)+'</span>'
          +'<span class="px"><b>'+g.pax+'</b> pax</span>'
          +'<span class="bd">'+bdHtml(g.bd)+'</span>'
          +'<span class="lkc">'+lkHtml(g.lk)+'</span>'
          +'<span class="tt">'+(g.capN?('Total <b>'+tot+'</b>/'+g.cap):(tot?('<b>'+tot+'</b> booked'):''))+'</span>'
          +'<span class="frc">'+(g.capN?frHtml(g.cap,g.av,tot):'')+'</span>'
          +'<span class="rn">'+g.run+' running'+(g.rs.length-g.run>0?(' &middot; '+(g.rs.length-g.run)+' off'):'')+'</span>'
        +'</div>';
      if(open) h+=rs.map(function(x){
        var tm=esc(x.dep)+(x.r.pier?(' &middot; '+pierAb(x.r.pier)):'');
        if(!x.run) return '<div class="dp-r dp-v off"><span class="ar"></span><span class="nm">'+esc(subOf(x.r,g.f))+'</span><span class="tm">'+tm+'</span>'
          +'<span class="bd">'+bdHtml(x.bd)+'</span><span class="lkc"></span><span class="tt">'+paxOf(x.bd)+' pax</span>'
          +'<span class="frc"><span class="dp-fr off">'+(x.wx?laT('ยกเลิก (อากาศ)'):laT('ไม่วิ่ง'))+'</span></span><span class="rn"></span></div>';
        return '<div class="dp-r dp-v" onclick="if(typeof bookingV2OpenFiltered===\'function\')bookingV2OpenFiltered(\''+esc(x.r.id)+'\',\''+date+'\')" title="'+laT('เปิดหน้า By trip ของรอบนี้')+'">'
          +'<span class="ar"></span><span class="nm">'+esc(subOf(x.r,g.f))+'</span><span class="tm">'+tm+'</span>'
          +'<span class="bd">'+bdHtml(x.bd)+'</span><span class="lkc">'+lkHtml(x.lk)+'</span>'
          +'<span class="tt">'+(x.has?('<b>'+x.bk+'</b>/'+x.cap):('<b>'+x.bk+'</b> booked'))+'</span>'
          +'<span class="frc">'+frHtml(x.has?x.cap:0,x.av,x.bk)+'</span><span class="rn"></span></div>'; }).join('');
      return h+'</div>';
    }).join('') || '<div class="dp-none">'+laT('ไม่มีโปรแกรมในวันนี้')+'</div>';
    var chip=function(id,label){ var on=(famFilter===id); return '<span'+(on?' class="on"':'')+' onclick="dashCalSetFam(\''+id+'\')">'+label+'</span>'; };
    var chips=chip('','All'); Object.keys(fams).forEach(function(fid){ chips+=chip(fid,fams[fid]); });
    var pb=function(v,l){ return '<span'+(pierF===v?' class="on"':'')+' onclick="dashProgSetPier(\''+v+'\')">'+l+'</span>'; };
    var d=new Date(date+'T12:00:00'), dl=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    var dayPax=paxOf(dayBd), isT=(date===TODAY_STR);
    return '<div class="dv-cal dv-prog" style="'+F+'">'
      +'<div class="dv-ct"><span class="big">Seats available</span>'
        +'<span class="dv-calnav"><span class="dv-calarw" onclick="dashProgShift(-1)">&#8249;</span>'
          +'<b>'+esc(dl)+(isT?' &middot; <span style="color:#0B6B47">'+laT('วันนี้')+'</span>':'')+'</b>'
          +'<span class="dv-calarw" onclick="dashProgShift(1)">&#8250;</span></span>'
        +_dashCalSeg('prog')
        +'<span class="sp"></span>'
        +'<span class="dv-cnt">'+laT('ที่ว่าง / ความจุ')+'</span>'
      +'</div>'
      +'<div class="dv-chips">'+chips+'</div>'
      +'<div class="dp-top"><span class="dp-pier">'+pb('all','All')+pb('panwa','Panwa')+pb('tublamu','Tub Lamu')+pb('ranong','Ranong')+'</span>'
        +(isT?'':'<span class="dp-today" onclick="window._dashProgDate=TODAY_STR;renderDash()">'+laT('วันนี้')+'</span>')
        +'<span class="dp-sum"><b>'+dayBk+'</b> booking &middot; <b>'+dayPax+'</b> pax<i>'+dayBd.ad+'A &middot; '+dayBd.chd+'C &middot; '+dayBd.inf+'I &middot; '+dayBd.foc+'F</i></span></div>'
      +'<div class="dp-body">'+body+'</div>'
      +'<div class="dv-calft">'
        +'<span class="t">'+esc(dl)+' &middot; <span style="color:#1B6AA6;background:#E4EFFA;border-radius:5px;padding:1px 7px;font-family:\'DM Mono\',ui-monospace,monospace" title="'+laT('ที่นั่งที่ใช้ไป · ตัวเดียวกับปฏิทิน')+'">'+tBkd+' pax</span></span>'
        +'<span class="r"><b>'+tFree+'</b> / '+tCap+' '+laT('ที่นั่งว่าง')+'</span>'
        +'<button onclick="bookingV2OpenFiltered(\'\',\''+date+'\')">'+(isT?laT('เปิดวันนี้'):(laT('เปิด')+' '+esc(dl)))+'</button>'
      +'</div>'
    +'</div>';
  }

  window._dashProgHtml = function(dx, F){
    if(!O.enabled()) return orig.apply(this, arguments);
    return progHtml(dx, F);
  };
  /* an answer for the date on the card: draw the dashboard again (72-ops-by-trip.js calls this when a day's figures change) */
  if(typeof window.laOpsByTripOnLoad === 'function'){
    window.laOpsByTripOnLoad(function(date){
      try{
        if(!O.enabled() || (O.activeView && O.activeView()) !== 'dashboard') return;
        if(typeof _dashCalView === 'function' && _dashCalView() !== 'prog') return;
        if((window._dashProgDate || window._dashDate || window.TODAY_STR) !== date) return;
        if(O.busy && O.busy()) return;
        if(typeof window.renderDash === 'function') window.renderDash();
      }catch(_){}
    });
  }
})();
