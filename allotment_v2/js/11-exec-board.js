/* ═══════════════════════════════════════════════════════════════════════
   §execBoard (2026-10-17) · Executive Board  (เมนู Overview › Executive Board)

   owner: "งานใหม่ สร้างที่ Overview · เป็นเหมือน Board แบบ Executive สำหรับผู้บริหาร"
          → รอบสอง "เน้นเรื่องฝั่งรายได้ และมี Live booking ของวันถัดไปด้วย"
          → รอบสาม "ขอดูที่เป็นวันนี้" (มุมมองวันนี้ แยกจากมุมมองเดือน/ไตรมาส/ปี)

   หน้านี้ใช้ดูอย่างเดียว · ไม่เขียนอะไรลง store · ไม่มีช่องกรอก
   ตัวเลขทุกตัวใช้ของกลางที่หน้าอื่นใช้อยู่แล้ว ไม่คิดสูตรเองซ้ำ:
     รายได้ต่อทริป      tsTripAmount(b,t)        (Travel Summary · Trip P&L ใช้ตัวเดียวกัน)
     มูลค่าทั้งใบ        laBkMoney(b)             (ยอดขายตามวันจอง · ยอดยกเลิก)
     เวลาที่ใบเข้าระบบ   _dashBkTs / _dashBkDay   (createdAt เป็นแค่วันที่ ใช้หาชั่วโมงไม่ได้)
     คนที่เดินทางจริง    tsRows(date)             (ใบที่ยกเลิกถูกตัดออกในตัว)
     ขาด/ยกเลิกหน้างาน   ckLostByType(b,date)
     ที่นั่ง             getAllotment(rid,date)
     B2C / ตลาด         laIsB2C(b) · drMarket(b)
     เซลส์ผู้ดูแล         pfmSalesName(b)
     ลูกหนี้             SB_INVOICES + acctInvoiceBalance · วงเงิน agCreditState

   ⚠ ยังไม่มีในระบบ จึงไม่แสดง (ไม่เดาตัวเลขขึ้นมาเอง):
     เป้ารายได้เป็นเงิน (ที่มีคือเป้า pax ของเซลส์) · เวลาออกเรือจริง (มีแต่เวลาตามโปรแกรม)
   ⚠ "Live" = วาดใหม่ทุก 60 วินาทีจากข้อมูลในเครื่อง ซึ่งระบบ sync กับ server ให้อยู่แล้ว
     และวาดเฉพาะตอนหน้านี้เปิดอยู่ · ตำแหน่งเลื่อนหน้าไม่เด้ง
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var EB = window._eb = window._eb || { per:'today', pier:'', tab:'rev', sp:'week', off:0 };   /* §execSales · tab/sp/off */
  var CXL = ['cancelled','rejected','cancelled_weather'];
  var NOT_SALE = ['quote','draft'];

  function E(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function ymd(d){ return (typeof bkV2LocalYMD==='function') ? bkV2LocalYMD(d) : d.toISOString().slice(0,10); }
  function dt(ds){ return new Date(ds+'T12:00:00'); }
  function addDays(ds,n){ var d=dt(ds); d.setDate(d.getDate()+n); return ymd(d); }
  function addYears(ds,n){ var d=dt(ds); d.setFullYear(d.getFullYear()+n); return ymd(d); }
  function today(){ return ymd(new Date()); }
  function num(n){ return Math.round(+n||0).toLocaleString('en-US'); }
  function baht(n){ n=+n||0; var a=Math.abs(n), s=n<0?'−':'';
    if(a>=1e6) return s+'฿'+(a/1e6).toFixed(a>=1e7?1:2)+'M';
    if(a>=1e4) return s+'฿'+Math.round(a/1e3)+'K';
    return s+'฿'+num(a); }
  function pct(a,b){ return b>0 ? Math.round(a*100/b) : 0; }
  function chg(cur, base){
    if(!(base>0)) return '<span class="eb-mut">—</span>';
    var p=(cur-base)*100/base;
    if(Math.abs(p)<0.5) return '<span class="eb-mut">±0%</span>';
    return '<span class="'+(p>0?'eb-up':'eb-dn')+'">'+(p>0?'▲ ':'▼ ')+Math.abs(p).toFixed(Math.abs(p)<10?1:0)+'%</span>';
  }
  var TH_DOW=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  function thD(ds){ var d=dt(ds), M=(typeof laMonAbbrTH==='function')?laMonAbbrTH():null; return d.getDate()+' '+(M?M[d.getMonth()]:(d.getMonth()+1)); }   /* ชื่อเดือนไทยมีที่เดียวทั้งระบบ (§i18n ข้อ 14) */
  function thDow(ds){ return TH_DOW[dt(ds).getDay()]; }
  function hhmm(ts){ var d=new Date(ts); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

  /* ── อ่านข้อมูล ─────────────────────────────────────────────────────── */
  function route(id){ try{ return (typeof getRoute==='function' && getRoute(id)) || null; }catch(_){ return null; } }
  function fam(rid){ try{ return (typeof bkV2RouteFamily==='function' && bkV2RouteFamily(rid)) || null; }catch(_){ return null; } }
  function famIdx(f){ try{ var i=(_BKV2_FAMILIES||[]).findIndex(function(x){ return x.id===(f&&f.id); }); return i<0?999:i; }catch(_){ return 999; } }
  function pierOk(r){ return !EB.pier || ((r&&r.pier)||'')===EB.pier; }
  function pax(t){ return (typeof bkV2PaxAllTot==='function') ? bkV2PaxAllTot((t&&t.pax)||{}) : 0; }
  function paxK(t,k){ return (typeof bkV2PaxTot==='function') ? bkV2PaxTot((t&&t.pax)||{},k) : 0; }
  function amt(b,t){ try{ return +tsTripAmount(b,t)||0; }catch(_){ return 0; } }
  function money(b){ try{ return +laBkMoney(b)||0; }catch(_){ return 0; } }
  function isSale(b){ return b && NOT_SALE.indexOf(b.status)<0 && !(typeof laIsInternalFree==='function' && laIsInternalFree(b)); }
  function isLive(b){ return isSale(b) && CXL.indexOf(b.status)<0; }
  function bkTs(b){ try{ return _dashBkTs(b); }catch(_){ return 0; } }
  function bkDay(b){ try{ return _dashBkDay(b); }catch(_){ return ''; } }
  function hasTime(b){ return (b.history||[]).some(function(h){ return h && h.tag==='Created' && h.at; }); }
  function cxlDay(b){ var a=(b.cancellation&&b.cancellation.at)||b.cancelledAt||''; return a ? ymd(new Date(a)) : ''; }
  function agentName(b){
    if(typeof laIsB2C==='function' && laIsB2C(b)){
      var ch=(typeof laB2CChannel==='function')?laB2CChannel(b):''; return 'Online direct (B2C)'+(ch?' · '+ch:''); }
    var a=(typeof sbGetAgent==='function')?sbGetAgent(b.agentId):null; return (a&&a.name)||b.agentId||'—';
  }
  function agentKey(b){ return (typeof laIsB2C==='function' && laIsB2C(b)) ? '__b2c' : (b.agentId||'__none'); }
  function chan(b){
    if(typeof laIsB2C==='function' && laIsB2C(b)) return 'b2c';
    var m=(typeof drMarket==='function')?(drMarket(b)||{}):{};
    if(['hpk','hkl','cpk','ckl','walkin'].indexOf(m.id)>=0) return 'ctr';
    return 'b2b';
  }
  var CHAN_LBL={b2b:'B2B เอเย่นต์', b2c:'B2C ออนไลน์', ctr:'เคาน์เตอร์ / walk-in'};
  function natOf(b){ var c=''; try{ c=(typeof mdBkCode==='function')?mdBkCode(b):''; }catch(_){} c=c||b.leadNationality||'';
    var l=''; try{ l=(c && typeof insNatLabel==='function')?insNatLabel(c):''; }catch(_){} return {code:c||'?', name:l||c||'ไม่ระบุ'}; }
  function paxTxt(t){ var o=[]; [['ad','A'],['chd','C'],['inf','I'],['foc','F']].forEach(function(k){ var n=paxK(t,k[0]); if(n) o.push(n+k[1]); }); return o.join(' ')||'0'; }
  function famColor(rid){ var f=fam(rid); var r=route(rid); return (f&&f.color)||(r&&r.color)||'#8b909c'; }

  /* ทุกทริปของใบที่ยังไม่ยกเลิก ภายใต้ตัวกรองท่า · fn(b,t,r) */
  function eachTrip(from, to, fn, withCxl){
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b || !(withCxl ? isSale(b) : isLive(b))) return;
      (b.trips||[]).forEach(function(t){
        if(!t || !t.date || t.date<from || t.date>to) return;
        var r=route(t.routeId); if(!pierOk(r)) return;
        fn(b,t,r);
      });
    });
  }
  function agg(from, to){
    var o={rev:0, pax:0, byFam:{}, byAg:{}, byChan:{b2b:0,b2c:0,ctr:0}, byNat:{}, byDay:{}};
    eachTrip(from, to, function(b,t,r){
      var a=amt(b,t), p=pax(t), f=fam(t.routeId)||{id:'_', name:(r&&r.name)||t.routeId, color:'#8b909c'};
      o.rev+=a; o.pax+=p;
      var F=o.byFam[f.id]=o.byFam[f.id]||{f:f, rev:0, pax:0}; F.rev+=a; F.pax+=p;
      var k=agentKey(b), A=o.byAg[k]=o.byAg[k]||{k:k, name:agentName(b), agentId:b.agentId, rev:0, pax:0, n:0};
      A.rev+=a; A.pax+=p; A.n++;
      o.byChan[chan(b)]+=a;
      var N=natOf(b), NN=o.byNat[N.code]=o.byNat[N.code]||{name:N.name, rev:0}; NN.rev+=a;
      o.byDay[t.date]=(o.byDay[t.date]||0)+a;
    });
    return o;
  }
  /* ยอดขายตามวันจอง (ใบที่เข้าระบบในช่วง) · มูลค่าทั้งใบ */
  function salesIn(from, to){
    var o={val:0, n:0, pax:0, list:[]};
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!isSale(b) || CXL.indexOf(b.status)>=0) return;
      var d=bkDay(b); if(!d || d<from || d>to) return;
      var ts=(b.trips||[]).filter(function(t){ return t && pierOk(route(t.routeId)); }); if(!ts.length) return;
      o.val+=money(b); o.n++; ts.forEach(function(t){ o.pax+=pax(t); }); o.list.push(b);
    });
    return o;
  }
  function cxlIn(from, to){
    var o={val:0, n:0, pax:0};
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b || CXL.indexOf(b.status)<0) return;
      var d=cxlDay(b); if(!d || d<from || d>to) return;
      var ts=(b.trips||[]).filter(function(t){ return t && pierOk(route(t.routeId)); }); if(!ts.length) return;
      o.val+=money(b); o.n++; ts.forEach(function(t){ o.pax+=pax(t); });
    });
    return o;
  }
  /* ลูกหนี้ · ทั้งบริษัท (ใบแจ้งหนี้ไม่ได้แยกท่า) */
  function arState(){
    var o={tot:0, cur:0, b30:0, b60:0, b90:0, over:0, byAg:{}}, now=new Date();
    (typeof SB_INVOICES!=='undefined'?SB_INVOICES:[]).forEach(function(i){
      if(!i || i.status==='void') return;
      var bal=0; try{ bal=acctInvoiceBalance(i); }catch(_){} if(!(bal>0)) return;
      var due=i.dueAt?new Date(i.dueAt):now, days=Math.floor((now-due)/86400000);
      o.tot+=bal; if(days<=0) o.cur+=bal; else { o.over+=bal; if(days<=30) o.b30+=bal; else if(days<=60) o.b60+=bal; else o.b90+=bal; }
      o.byAg[i.agentId]=(o.byAg[i.agentId]||0)+bal;
    });
    return o;
  }
  function overLimit(){
    var out=[];
    (typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).forEach(function(a){
      try{ var s=agCreditState(a.id); if(s && s.limit>0 && s.used>s.limit) out.push({name:a.name, pct:Math.round(s.used*100/s.limit)}); }catch(_){}
    });
    return out.sort(function(x,y){ return y.pct-x.pct; });
  }
  function paymentsOn(ds){
    var v=0, n=0, ag={};
    (typeof SB_PAYMENTS!=='undefined'?SB_PAYMENTS:[]).forEach(function(p){
      if(!p || String(p.date||'').slice(0,10)!==ds) return;
      var a=+p.amount||0; if(p.type==='refund') a=-Math.abs(a); v+=a; n++; if(p.agentId) ag[p.agentId]=1;
    });
    return {v:v, n:n, ag:Object.keys(ag).length};
  }
  function pierCashOn(ds){
    var v=0;
    (SB_BOOKINGS||[]).forEach(function(b){
      (b.pierPayments||[]).forEach(function(p){ if(p && String(p.date||'').slice(0,10)===ds) v+=(+p.amount||0); });
    });
    return v;
  }
  /* ขาด / ยกเลิกหน้างาน / อากาศ ในช่วง (เฉพาะวันที่ผ่านมาแล้ว) */
  function leakage(from, to){
    var o={ns:0, cx:0, nsV:0, cxV:0, wx:0, wxV:0, disc:0, foc:0};
    var end = to<today() ? to : today();
    eachTrip(from, end, function(b,t){
      var L=null; try{ L=ckLostByType(b,t.date); }catch(_){}
      if(!L) return; var bk=pax(t)||1, a=amt(b,t);
      if(L.ns){ o.ns+=L.ns; o.nsV+=a*L.ns/bk; }
      if(L.cxl){ o.cx+=L.cxl; o.cxV+=a*L.cxl/bk; }
    });
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b || b.status!=='cancelled_weather') return;
      (b.trips||[]).forEach(function(t){ if(t && t.date>=from && t.date<=to && pierOk(route(t.routeId))){ o.wx+=pax(t); o.wxV+=amt(b,t); } });
    });
    /* ส่วนลด · นับต่อใบครั้งเดียว ตามทริปแรกของใบ */
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!isLive(b)) return;
      var ds=(b.trips||[]).map(function(t){ return t&&t.date; }).filter(Boolean).sort();
      if(!ds.length || ds[0]<from || ds[0]>to) return;
      var t0=(b.trips||[]).find(function(t){ return t && t.date===ds[0]; }); if(!pierOk(route(t0&&t0.routeId))) return;
      var pb=b.priceBreakdown||{};
      o.foc+=Math.abs(+pb.focDiscount||0); o.disc+=Math.abs(+pb.discount||0);
    });
    return o;
  }
  /* ทริปที่วิ่งในวันหนึ่ง (มีเรือใน TRIPS หรือมีใบจอง) */
  function routesOn(ds){
    var ids={};
    try{ Object.keys((typeof TRIPS!=='undefined'&&TRIPS[ds])||{}).forEach(function(bid){ var op=TRIPS[ds][bid]; if(op&&op.route) ids[op.route]=1; }); }catch(_){}
    eachTrip(ds, ds, function(b,t){ if(t.routeId) ids[t.routeId]=1; });
    return Object.keys(ids).filter(function(rid){ var r=route(rid); return r && pierOk(r); })
      .sort(function(a,b){ var fa=famIdx(fam(a)), fb=famIdx(fam(b)); if(fa!==fb) return fa-fb;
        var ta=((route(a)||{}).times||[])[0]||'', tb=((route(b)||{}).times||[])[0]||''; return String(ta).localeCompare(String(tb)); });
  }
  function alOf(rid, ds){ try{ return getAllotment(rid, ds)||null; }catch(_){ return null; } }
  function rName(rid){ var r=route(rid)||{}, f=fam(rid); var n=r.name||rid;
    if(f && f.name && n.indexOf(f.name)===0){ var s=n.slice(f.name.length).replace(/^\s*(by|·|-|—)\s*/i,'').trim(); return {f:f.name, v:s||''}; }
    return {f:(f&&f.name)||n, v:(f&&f.name)?n:''}; }

  /* ── ช่วงเวลา ──────────────────────────────────────────────────────── */
  function range(){
    var t=today(), y=+t.slice(0,4), m=+t.slice(5,7);
    if(EB.per==='month') return {from:t.slice(0,8)+'01', to:ymd(new Date(y,m,0)), lbl:'เดือนนี้'};
    if(EB.per==='quarter'){ var q=Math.floor((m-1)/3); return {from:ymd(new Date(y,q*3,1)), to:ymd(new Date(y,q*3+3,0)), lbl:'ไตรมาสนี้'}; }
    if(EB.per==='year') return {from:y+'-01-01', to:y+'-12-31', lbl:'ปีนี้'};
    return {from:t, to:t, lbl:'วันนี้'};
  }

  /* ── ชิ้นส่วนหน้าจอ ───────────────────────────────────────────────── */
  function kpi(l, v, d, cls, bar){
    return '<div class="eb-card eb-k'+(cls?' '+cls:'')+'"><div class="l">'+l+'</div><div class="v">'+v+'</div><div class="d">'+(d||'')+'</div>'
      +(bar!=null?'<div class="bar"><i style="width:'+Math.max(0,Math.min(100,bar))+'%"></i></div>':'')+'</div>';
  }
  function src(t){ return '<span class="eb-src">'+t+'</span>'; }
  function hbar(rows, fmt){
    var mx=Math.max.apply(null,[1].concat(rows.map(function(r){ return r.v; })));
    return '<div class="eb-rows">'+rows.map(function(r){
      return '<div class="rw" title="'+E(r.l+' · '+fmt(r.v))+'"><span class="lb">'+E(r.l)+'</span><span class="mini"><i style="width:'+Math.round(r.v*100/mx)+'%'+(r.c?';background:'+r.c:'')+'"></i></span><span class="vv">'+fmt(r.v)+(r.x||'')+'</span></div>';
    }).join('')+'</div>';
  }
  function chanCard(byChan, title){
    var tot=byChan.b2b+byChan.b2c+byChan.ctr;
    var seg=[['b2b','var(--eb-s5)'],['b2c','var(--eb-s3)'],['ctr','var(--eb-s1)']];
    return '<div style="font-size:11.5px;color:var(--eb-ink2);font-weight:600">'+title+'</div>'
      +'<div class="eb-hstack">'+(tot>0?seg.map(function(s){ var p=byChan[s[0]]*100/tot; return p>0?'<i title="'+E(CHAN_LBL[s[0]]+' '+baht(byChan[s[0]]))+'" style="width:'+p+'%;background:'+s[1]+'"></i>':''; }).join(''):'<i style="width:100%;background:#EDF0F4"></i>')+'</div>'
      +'<div class="eb-foot" style="margin:0 0 10px">'+seg.map(function(s){ return CHAN_LBL[s[0]]+' <b>'+pct(byChan[s[0]],tot)+'%</b>'; }).join(' · ')+'</div>';
  }
  function liveTag(){ return '<span class="eb-live"><i></i>LIVE · '+hhmm(Date.now())+'</span>'; }

  /* พรุ่งนี้ · ตารางรายรอบ + ใบล่าสุด */
  function tomorrowData(){
    var t0=today(), tm=addDays(t0,1), rows=[], tot={pax:0, cap:0, rev:0, add:0, addV:0, addN:0, pend:0, pendN:0, pendV:0, free:0}, feed=[];
    routesOn(tm).forEach(function(rid){
      var r={rid:rid, pax:0, rev:0, add:0, pend:0}, al=alOf(rid, tm);
      eachTrip(tm, tm, function(b,t){ if(t.routeId!==rid) return;
        var p=pax(t), a=amt(b,t); r.pax+=p; r.rev+=a;
        if(bkDay(b)===t0){ r.add+=p; tot.addV+=a; tot.addN++; }
        if(b.status==='pending_approval'){ r.pend+=p; tot.pendN++; tot.pendV+=a; }
        feed.push({b:b, t:t, ts:bkTs(b)});
      });
      r.cap = al && al.hasAllotment ? (+al.availableCapacity||0) : 0;
      r.free = al && al.hasAllotment ? Math.max(0, +al.seatsAvailable||0) : null;
      r.dep = ((route(rid)||{}).times||[])[0]||'';
      tot.pax+=r.pax; tot.cap+=r.cap; tot.rev+=r.rev; tot.add+=r.add; tot.pend+=r.pend; if(r.free) tot.free+=r.free;
      rows.push(r);
    });
    feed.sort(function(x,y){ return y.ts-x.ts; });
    return {ds:tm, rows:rows, tot:tot, feed:feed};
  }
  function capCell(p, cap, add){
    if(!(cap>0)) return '<span class="eb-mut">'+num(p)+' · ไม่จำกัด</span>';
    var a=Math.max(0,p-add);
    return '<div class="eb-cap"><span class="t"><i style="width:'+Math.min(100,a*100/cap)+'%;background:var(--eb-s4)"></i><i style="width:'+Math.max(0,Math.min(100-a*100/cap,add*100/cap))+'%;background:#16A34A"></i></span><span class="n">'+num(p)+'/'+num(cap)+'</span></div>';
  }
  function feedHtml(list, opt){
    opt=opt||{}; var t0=today();
    if(!list.length) return '<div class="eb-none">ยังไม่มีใบจอง</div>';
    return '<ul class="eb-feed">'+list.slice(0, opt.n||7).map(function(x){
      var b=x.b, t=x.t, r=rName(t.routeId), d=bkDay(b)===t0, pend=b.status==='pending_approval';
      var when = (d && hasTime(b)) ? hhmm(x.ts) : thD(bkDay(b)||t0);
      var tag = pend ? '<span style="color:var(--eb-warn)">รออนุมัติ</span>'
        : opt.trav ? (t.date===addDays(t0,1)?'พรุ่งนี้':(t.date===t0?'วันนี้':('เดินทาง '+thD(t.date))))
        : (d?'<span class="eb-up">ใหม่วันนี้</span>':'');
      return '<li class="'+(d?'new':'')+'"><span class="t">'+E(when)+'</span><span class="w"><b>'+E(agentName(b))+'</b><span>'
        +(opt.trav?E(thD(t.date))+' · ':'')+E(r.f+(r.v?' · '+r.v:''))+' · '+E(paxTxt(t))+'</span></span><span class="a">'+baht(amt(b,t))+'<span>'+tag+'</span></span></li>';
    }).join('')+'</ul>';
  }
  function tomorrowCard(full){
    var T=tomorrowData(), tt=T.tot, lf=pct(tt.pax, tt.cap);
    var head='<h2>พรุ่งนี้ · '+E(thDow(T.ds))+' '+E(thD(T.ds))+' '+liveTag()+src('ที่มา: Booking (By trip)')+'</h2>';
    var tiles='<div class="eb-tm">'
      +'<div><div class="l">ผู้โดยสาร</div><div class="v">'+num(tt.pax)+(tt.cap?'<small>/ '+num(tt.cap)+' ที่</small>':'')+'</div><div class="d">'+(tt.cap?'Load factor '+lf+'%':'—')+'</div></div>'
      +'<div><div class="l">รายได้พรุ่งนี้</div><div class="v">'+baht(tt.rev)+'</div><div class="d">'+num(T.rows.length)+' รอบ</div></div>'
      +'<div><div class="l">จองเพิ่มวันนี้</div><div class="v" style="color:var(--eb-good)">+'+num(tt.add)+'<small>pax</small></div><div class="d">+'+baht(tt.addV)+' · '+num(tt.addN)+' ใบ</div></div>'
      +(full
        ? '<div><div class="l">รออนุมัติ</div><div class="v" style="color:'+(tt.pend?'var(--eb-warn)':'inherit')+'">'+num(tt.pend)+'<small>pax</small></div><div class="d">'+num(tt.pendN)+' ใบ · '+baht(tt.pendV)+'</div></div>'
        : '<div><div class="l">ยังขายได้</div><div class="v">'+(tt.cap?num(tt.free)+'<small>ที่</small>':'—')+'</div><div class="d">'+E(T.rows.filter(function(r){ return r.free>0; }).sort(function(a,b){ return b.free-a.free; }).slice(0,3).map(function(r){ return rName(r.rid).f+' '+r.free; }).join(' · ')||'—')+'</div></div>')
      +'</div>';
    if(!full) return '<div class="eb-card" id="eb-tmw">'+head+tiles+'</div>';
    var tbl='<table class="eb-tbl"><thead><tr><th>โปรแกรม · รอบ</th><th>เวลา</th><th>ที่นั่ง</th><th>ว่าง</th><th>รายได้</th><th>วันนี้ +</th></tr></thead><tbody>'
      +(T.rows.length?T.rows.map(function(r){ var n=rName(r.rid);
        return '<tr><td><span class="eb-dot" style="background:'+E(famColor(r.rid))+'"></span><b>'+E(n.f)+'</b>'+(n.v?' · '+E(n.v):'')+'</td><td>'+E(r.dep)+'</td><td>'+capCell(r.pax,r.cap,r.add)+'</td>'
          +'<td>'+(r.free==null?'—':(r.free<=0?'<span class="eb-st b">● เต็ม</span>':num(r.free)))+'</td><td>'+baht(r.rev)+'</td><td>'+(r.add?'<span class="eb-up">+'+num(r.add)+'</span>':'<span class="eb-mut">0</span>')+'</td></tr>'; }).join('')
        :'<tr><td colspan="6" class="eb-none">ยังไม่มีทริปพรุ่งนี้</td></tr>')
      +'</tbody></table><div class="eb-lgd"><i style="background:var(--eb-s4)"></i>จองไว้ก่อนวันนี้ <i style="background:#16A34A"></i>จองเพิ่มวันนี้</div>';
    return '<div class="eb-grid eb-r5" id="eb-tmw"><div class="eb-card">'+head+tiles+tbl+'</div>'
      +'<div class="eb-card"><h2>ใบจองล่าสุดของพรุ่งนี้ <span class="eb-tag">เรียงจากใหม่สุด</span></h2>'+feedHtml(T.feed)
      +'<div class="eb-foot">วันนี้เข้ามาสำหรับพรุ่งนี้ '+num(tt.addN)+' ใบ · +'+baht(tt.addV)+'</div></div></div>';
  }

  /* ── มุมมอง "วันนี้" ──────────────────────────────────────────────── */
  function viewToday(){
    var t0=today(), wk=addDays(t0,-7), ly=addDays(t0,-364);
    var A=agg(t0,t0), Aw=agg(wk,wk), Al=agg(ly,ly);
    var S=salesIn(t0,t0), C=cxlIn(t0,t0);
    var s7=salesIn(addDays(t0,-7), addDays(t0,-1));
    /* คนเดินทางจริงวันนี้ · ทริปรายรอบ */
    var rows=[]; try{ rows=tsRows(t0)||[]; }catch(_){ rows=[]; }
    rows=rows.filter(function(r){ return isSale(r.b) && pierOk(route(r.routeId)); });
    var booked=0, trav=0, ns=0, nsV=0, byR={};
    rows.forEach(function(r){
      booked+=r.booked; trav+=r.travelled; var lost=(+r.ns||0)+(+r.cxl||0); ns+=lost; if(r.booked>0) nsV+=(+r.amount||0)*lost/r.booked;
      var R=byR[r.routeId]=byR[r.routeId]||{rid:r.routeId, booked:0, trav:0, lost:0, rev:0, n:0, done:0};
      R.booked+=r.booked; R.trav+=r.travelled; R.lost+=lost; R.rev+=(+r.amount||0); R.n++; if(r.pierDone) R.done++;
    });
    var pay=paymentsOn(t0), cash=pierCashOn(t0);
    var ckN=rows.length, ckD=rows.filter(function(r){ return r.pierDone; }).length;
    var h='<div class="eb-grid eb-kpis">'
      + kpi('รายได้ของทริปวันนี้', baht(A.rev), chg(A.rev,Aw.rev)+' vs '+E(thDow(t0))+'ที่แล้ว · '+chg(A.rev,Al.rev)+' vs ปีก่อน')
      + kpi('ผู้โดยสารวันนี้', num(trav)+'<small>/ '+num(booked)+' จอง</small>', 'เช็คอินหน้าท่าแล้ว '+num(ckD)+'/'+num(ckN)+' ใบ · ขาด/ยกเลิกหน้างาน '+num(ns), '', ckN?pct(ckD,ckN):null)
      + kpi('ยอดขายที่เข้ามาวันนี้', baht(S.val), num(S.n)+' ใบ · '+num(S.pax)+' pax · '+chg(S.val, s7.val/7)+' vs เฉลี่ย 7 วัน')
      + kpi('ยกเลิกวันนี้', C.val?('<span style="color:var(--eb-bad)">'+baht(-C.val)+'</span>'):baht(0), num(C.n)+' ใบ · '+num(C.pax)+' pax · สุทธิ <b>'+baht(S.val-C.val)+'</b>')
      + kpi('No-show / ยกเลิกหน้างาน', num(ns)+'<small>pax</small>', ns?('มูลค่าประมาณ '+baht(nsV)):'ยังไม่มี', ns?'warn':'')
      + kpi('เงินเข้าวันนี้', baht(pay.v+cash), 'โอน/ชำระ '+num(pay.n)+' รายการ · เงินสดหน้าท่า '+baht(cash))
      + '</div>';

    /* ทริปวันนี้ */
    var rids=routesOn(t0); var trip='<table class="eb-tbl"><thead><tr><th>โปรแกรม · รอบ</th><th>เวลา</th><th>เช็คอินหน้าท่า</th><th>เดินทางจริง / จอง</th><th>ขาด</th><th>รายได้</th><th>Load factor</th></tr></thead><tbody>'
      + (rids.length?rids.map(function(rid){
          var R=byR[rid]||{booked:0,trav:0,lost:0,rev:0,n:0,done:0}, al=alOf(rid,t0), cap=al&&al.hasAllotment?(+al.availableCapacity||0):0, n=rName(rid);
          var st = !R.n ? '<span class="eb-sts">ไม่มีใบจอง</span>' : (R.done>=R.n ? '<span class="eb-sts dep">ครบ '+R.n+' ใบ</span>' : (R.done ? '<span class="eb-sts ck">'+R.done+'/'+R.n+' ใบ</span>' : '<span class="eb-sts wt">ยังไม่เช็คอิน</span>'));
          var lf=cap?pct(R.trav,cap):null;
          return '<tr><td><span class="eb-dot" style="background:'+E(famColor(rid))+'"></span><b>'+E(n.f)+'</b>'+(n.v?' · '+E(n.v):'')+'</td><td>'+E(((route(rid)||{}).times||[])[0]||'')+'</td><td>'+st+'</td>'
            +'<td><div class="eb-cap"><span class="t"><i style="width:'+(R.booked?R.trav*100/R.booked:0)+'%;background:var(--eb-s4)"></i><i style="width:'+(R.booked?R.lost*100/R.booked:0)+'%;background:#D9483B"></i></span><span class="n">'+num(R.trav)+'/'+num(R.booked)+'</span></div></td>'
            +'<td>'+(R.lost?num(R.lost):'<span class="eb-mut">0</span>')+'</td><td>'+baht(R.rev)+'</td><td>'+(lf==null?'<span class="eb-mut">—</span>':(lf<75?'<span class="eb-st w">▲ '+lf+'%</span>':lf+'%'))+'</td></tr>'; }).join('')
        : '<tr><td colspan="7" class="eb-none">วันนี้ไม่มีทริป</td></tr>')
      + '</tbody></table><div class="eb-lgd"><i style="background:var(--eb-s4)"></i>เดินทางจริง <i style="background:#D9483B"></i>ขาด / ยกเลิกหน้างาน</div>';

    /* ยอดขายตามชั่วโมง + ใบล่าสุด */
    var hrs={}, H0=7, H1=22; S.list.forEach(function(b){ if(!hasTime(b)) return; var hr=new Date(bkTs(b)).getHours(); hrs[hr]=(hrs[hr]||0)+money(b); });
    var hmx=Math.max.apply(null,[1].concat(Object.keys(hrs).map(function(k){ return hrs[k]; }))), nowH=new Date().getHours();
    var hb='<div class="eb-hb">'; for(var hh=H0; hh<=H1; hh++){ var v=hrs[hh]||0; hb+='<div title="'+String(hh).padStart(2,'0')+':00 · '+baht(v)+'"><i class="'+(hh===nowH?'now':'')+'" style="height:'+Math.round(v*100/hmx)+'%"></i></div>'; } hb+='</div><div class="eb-hax">';
    for(hh=H0; hh<=H1; hh++) hb+='<span>'+String(hh).padStart(2,'0')+'</span>'; hb+='</div>';
    var fd=[]; S.list.forEach(function(b){ (b.trips||[]).forEach(function(t){ if(t && pierOk(route(t.routeId))) fd.push({b:b,t:t,ts:bkTs(b)}); }); });
    fd.sort(function(x,y){ return y.ts-x.ts; });
    var tm=addDays(t0,1), wkE=addDays(t0,7), sTm=0, sWk=0, sFar=0;
    fd.forEach(function(x){ var a=amt(x.b,x.t); if(x.t.date<=tm) sTm+=a; else if(x.t.date<=wkE) sWk+=a; else sFar+=a; });

    /* เอเย่นต์วันนี้ */
    var ag={}; S.list.forEach(function(b){ var k=agentKey(b), A2=ag[k]=ag[k]||{name:agentName(b), sales:'', n:0, pax:0, val:0}; A2.n++; A2.val+=money(b);
      (b.trips||[]).forEach(function(t){ A2.pax+=pax(t); }); try{ var sn=pfmSalesName(b); if(sn && sn!=='—') A2.sales=sn; }catch(_){} });
    var ag7={}; s7.list.forEach(function(b){ var k=agentKey(b); ag7[k]=(ag7[k]||0)+money(b); });
    var agL=Object.keys(ag).map(function(k){ return Object.assign({k:k}, ag[k]); }).sort(function(a,b){ return b.val-a.val; }).slice(0,5);
    /* เอเย่นต์ประจำที่ยังไม่ส่งยอดวันนี้ · ส่งมาแล้ว ≥ 4 วันใน 14 วันก่อน */
    var s14=salesIn(addDays(t0,-14), addDays(t0,-1)), days={}, val14={}, nm14={};
    s14.list.forEach(function(b){ var k=agentKey(b); if(k==='__b2c') return; (days[k]=days[k]||{})[bkDay(b)]=1; val14[k]=(val14[k]||0)+money(b); nm14[k]=agentName(b); });
    var quiet=Object.keys(days).filter(function(k){ return Object.keys(days[k]).length>=4 && !ag[k]; })
      .sort(function(a,b){ return val14[b]-val14[a]; }).slice(0,3);
    /* ช่องทาง · โปรแกรม ของยอดขายวันนี้ */
    var ch={b2b:0,b2c:0,ctr:0}, pf={}; S.list.forEach(function(b){ ch[chan(b)]+=money(b); });
    fd.forEach(function(x){ var f=fam(x.t.routeId)||{id:'_',name:'อื่น ๆ'}; var P=pf[f.id]=pf[f.id]||{l:f.name, v:0, c:f.color}; P.v+=amt(x.b,x.t); });

    h+='<div class="eb-sec">Live · ทริปวันนี้ / ยอดขายที่เข้ามาวันนี้</div><div class="eb-grid eb-r5">'
      + '<div class="eb-card"><h2>ทริปวันนี้ · '+E(thDow(t0))+' '+E(thD(t0))+' '+liveTag()+src('ที่มา: เช็คอินหน้าท่า · Travel Summary')+'</h2>'+trip+'</div>'
      + '<div class="eb-card"><h2>ยอดขายวันนี้ ตามชั่วโมง <span class="eb-tag">วันจอง = วันนี้</span></h2>'+hb
      + '<h2 style="margin-top:14px">ใบจองที่เข้ามาวันนี้ <span class="eb-tag">ทุกวันเดินทาง · ใหม่สุดก่อน</span></h2>'+feedHtml(fd,{n:6,trav:true})
      + '<div class="eb-foot">ยอดขายวันนี้ตามวันเดินทาง: ถึงพรุ่งนี้ '+baht(sTm)+' · ภายใน 7 วัน '+baht(sWk)+' · ไกลกว่านั้น '+baht(sFar)+'</div></div></div>';
    h+='<div class="eb-sec">พรุ่งนี้</div>'+tomorrowCard(false);
    h+='<div class="eb-sec">ยอดขายวันนี้มาจากไหน</div><div class="eb-grid eb-r3">'
      + '<div class="eb-card"><h2>เอเย่นต์ที่ส่งยอดวันนี้ <span class="eb-tag">Top 5</span>'+src('ที่มา: Booking · Sales')+'</h2>'
      + '<table class="eb-tbl"><thead><tr><th>เอเย่นต์</th><th>ใบ</th><th>Pax</th><th>ยอดขาย</th><th>vs เฉลี่ย 7 วัน</th><th>เซลส์</th></tr></thead><tbody>'
      + (agL.length?agL.map(function(a){ return '<tr><td><b>'+E(a.name)+'</b></td><td>'+num(a.n)+'</td><td>'+num(a.pax)+'</td><td><b>'+baht(a.val)+'</b></td><td>'+chg(a.val,(ag7[a.k]||0)/7)+'</td><td>'+E(a.sales||'—')+'</td></tr>'; }).join('')
        :'<tr><td colspan="6" class="eb-none">วันนี้ยังไม่มีใบจองเข้า</td></tr>')
      + '</tbody></table><div class="eb-foot">'+(quiet.length?('เอเย่นต์ประจำที่ยังไม่ส่งยอดวันนี้: '+quiet.map(function(k){ return '<b>'+E(nm14[k])+'</b> (ปกติวันละ ~'+baht(val14[k]/Object.keys(days[k]).length)+')'; }).join(' · ')):'เอเย่นต์ประจำส่งยอดมาครบแล้ววันนี้')+'</div></div>'
      + '<div class="eb-card"><h2>ช่องทาง · โปรแกรม <span class="eb-tag">ยอดขายวันนี้</span></h2>'+chanCard(ch,'ช่องทางขาย')
      + hbar(Object.keys(pf).map(function(k){ return pf[k]; }).sort(function(a,b){ return b.v-a.v; }).slice(0,6), baht)+'</div></div>';
    return h;
  }

  /* ── มุมมอง เดือน / ไตรมาส / ปี ────────────────────────────────────── */
  function viewPeriod(){
    var t0=today(), R=range(), toD=R.to<t0?R.to:t0;
    var A=agg(R.from, toD), Al=agg(addYears(R.from,-1), addYears(toD,-1));
    var Fut=agg(addDays(t0,1)>R.from?addDays(t0,1):R.from, R.to);
    var S=salesIn(R.from, toD), Sl=salesIn(addYears(R.from,-1), addYears(toD,-1));
    var B30=agg(addDays(t0,1), addDays(t0,30)), B30l=agg(addYears(addDays(t0,1),-1), addYears(addDays(t0,30),-1));
    var AR=arState(), Lk=leakage(R.from, R.to), Lmt=overLimit();
    var rpp=A.pax?A.rev/A.pax:0, rppL=Al.pax?Al.rev/Al.pax:0;
    var h='<div class="eb-grid eb-kpis">'
      + kpi('รายได้'+R.lbl+' (วันเดินทาง)', baht(A.rev), chg(A.rev,Al.rev)+' vs ปีก่อน · '+num(A.pax)+' pax')
      + kpi('คาดการณ์สิ้น'+R.lbl.replace('นี้',''), baht(A.rev+Fut.rev), 'ได้แล้ว '+baht(A.rev)+' + จองไว้ '+baht(Fut.rev)+(R.to>t0?'':' (ครบช่วงแล้ว)'), '', (A.rev+Fut.rev)>0?pct(A.rev,A.rev+Fut.rev):null)
      + kpi('ยอดขายที่เข้ามา (วันจอง)', baht(S.val), num(S.n)+' ใบ · '+chg(S.val,Sl.val)+' vs ปีก่อน')
      + kpi('รายได้เฉลี่ยต่อหัว', '฿'+num(rpp), chg(rpp,rppL)+' vs ปีก่อน')
      + kpi('จองล่วงหน้า 30 วัน', baht(B30.rev), num(B30.pax)+' pax · '+chg(B30.rev,B30l.rev)+' vs ช่วงเดียวกันปีก่อน')
      + kpi('ลูกหนี้ค้างรับ', baht(AR.tot), AR.over>0?('<span class="eb-st b">● เกินกำหนด '+baht(AR.over)+'</span>'):'<span class="eb-st g">✓ ไม่มีเกินกำหนด</span>', AR.over>0?'bad':'')
      + '</div>';
    h+='<div class="eb-sec">Live booking · พรุ่งนี้</div>'+tomorrowCard(true);

    /* แนวโน้ม · 30 วันก่อน + 14 วันข้างหน้า */
    var T=agg(addDays(t0,-29), addDays(t0,14)), days=[], mx=1;
    for(var i=-29;i<=14;i++){ var ds=addDays(t0,i), v=T.byDay[ds]||0; days.push({ds:ds,v:v}); if(v>mx) mx=v; }
    var bars='<div class="eb-bars">'+days.map(function(x){ var we=[0,6].indexOf(dt(x.ds).getDay())>=0;
      return '<i class="'+(x.ds>t0?'f':(x.ds===t0?'t':(we?'w':'')))+'" title="'+E(thDow(x.ds)+' '+thD(x.ds))+' · '+baht(x.v)+(x.ds>t0?' (จองไว้แล้ว)':'')+'" style="height:'+Math.max(1,Math.round(x.v*100/mx))+'%"></i>'; }).join('')+'</div>'
      + '<div class="eb-axis"><span>'+E(thD(addDays(t0,-29)))+'</span><span>'+E(thD(addDays(t0,-15)))+'</span><span>วันนี้</span><span>'+E(thD(addDays(t0,14)))+'</span></div>'
      + '<div class="eb-lgd"><i style="background:var(--eb-s3)"></i>วันธรรมดา <i style="background:var(--eb-s4)"></i>เสาร์–อาทิตย์ <i class="hatch"></i>จองไว้แล้ว (ยังเพิ่มได้)</div>';
    var nat=Object.keys(A.byNat).map(function(k){ return {l:A.byNat[k].name, v:A.byNat[k].rev}; }).sort(function(a,b){ return b.v-a.v; }).slice(0,5);
    h+='<div class="eb-sec">แนวโน้มรายได้</div><div class="eb-grid eb-r2">'
      + '<div class="eb-card"><h2>รายได้รายวัน · 30 วันที่ผ่านมา + 14 วันข้างหน้า'+src('ที่มา: Booking')+'</h2>'+bars+'</div>'
      + '<div class="eb-card"><h2>ช่องทาง · ตลาด <span class="eb-tag">สัดส่วนรายได้'+E(R.lbl)+'</span></h2>'+chanCard(A.byChan,'ช่องทางขาย')
      + '<div style="font-size:11.5px;color:var(--eb-ink2);font-weight:600;margin-bottom:4px">สัญชาติ (รายได้)</div>'+(nat.length?hbar(nat,baht):'<div class="eb-none">—</div>')+'</div></div>';

    /* โปรแกรม · เอเย่นต์ */
    var fams=Object.keys(A.byFam).map(function(k){ var F=A.byFam[k], L=Al.byFam[k]; return {f:F.f, rev:F.rev, pax:F.pax, ly:L?L.rev:0}; })
      .sort(function(a,b){ return b.rev-a.rev; });
    var ags=Object.keys(A.byAg).map(function(k){ var a=A.byAg[k], L=Al.byAg[k]; return Object.assign({ly:L?L.rev:0}, a); }).sort(function(a,b){ return b.rev-a.rev; });
    var top5=ags.slice(0,5), top5v=top5.reduce(function(s,a){ return s+a.rev; },0);
    var drop=ags.filter(function(a){ return a.ly>0 && a.rev<a.ly*0.8 && a.k!=='__b2c'; }).slice(0,3);
    h+='<div class="eb-sec">รายได้ตามโปรแกรม · เอเย่นต์</div><div class="eb-grid eb-r3">'
      + '<div class="eb-card"><h2>โปรแกรม · '+E(R.lbl)+src('ที่มา: Booking · P&amp;L รายทริป')+'</h2><table class="eb-tbl"><thead><tr><th>โปรแกรม</th><th>รายได้</th><th>สัดส่วน</th><th>vs ปีก่อน</th><th>Pax</th><th>รายได้/หัว</th></tr></thead><tbody>'
      + (fams.length?fams.map(function(x){ return '<tr><td><span class="eb-dot" style="background:'+E(x.f.color||'#8b909c')+'"></span><b>'+E(x.f.name)+'</b></td><td><b>'+baht(x.rev)+'</b></td><td>'+pct(x.rev,A.rev)+'%</td><td>'+chg(x.rev,x.ly)+'</td><td>'+num(x.pax)+'</td><td>'+(x.pax?'฿'+num(x.rev/x.pax):'—')+'</td></tr>'; }).join('')
        :'<tr><td colspan="6" class="eb-none">ยังไม่มีรายได้ในช่วงนี้</td></tr>')
      + '</tbody></table></div>'
      + '<div class="eb-card"><h2>เอเย่นต์ · Top 5 ตามรายได้'+src('ที่มา: Booking · Accounting')+'</h2><table class="eb-tbl"><thead><tr><th>เอเย่นต์</th><th>รายได้</th><th>vs ปีก่อน</th><th>รายได้/หัว</th><th>ค้างชำระ</th></tr></thead><tbody>'
      + (top5.length?top5.map(function(a){ var bal=AR.byAg[a.agentId]||0, cs=null; try{ cs=a.k!=='__b2c'?agCreditState(a.agentId):null; }catch(_){}
          var over=cs&&cs.limit>0&&cs.used>cs.limit;
          return '<tr><td><b>'+E(a.name)+'</b></td><td><b>'+baht(a.rev)+'</b></td><td>'+chg(a.rev,a.ly)+'</td><td>'+(a.pax?'฿'+num(a.rev/a.pax):'—')+'</td><td>'+(a.k==='__b2c'?'—':(baht(bal)+(over?' <span class="eb-st b" title="เกินวงเงินเครดิต">● '+pct(cs.used,cs.limit)+'%</span>':'')))+'</td></tr>'; }).join('')
        :'<tr><td colspan="5" class="eb-none">—</td></tr>')
      + '</tbody></table><div class="eb-foot">Top 5 = '+pct(top5v,A.rev)+'% ของรายได้'+(drop.length?(' · ยอดตกเกิน 20% vs ปีก่อน: '+drop.map(function(a){ return E(a.name); }).join(', ')):'')+'</div></div></div>';

    /* ส่วนลด · หลุดมือ · เก็บเงิน */
    var arTot=Math.max(1,AR.tot);
    h+='<div class="eb-sec">ส่วนลด · รายได้ที่หลุดมือ · การเก็บเงิน</div><div class="eb-grid eb-r4">'
      + '<div class="eb-card"><h2>ส่วนลดที่ให้ไป <span class="eb-tag">'+E(R.lbl)+'</span>'+src('ที่มา: Booking')+'</h2>'
      + hbar([{l:'FOC',v:Lk.foc},{l:'ส่วนลด',v:Lk.disc}], baht)
      + '<div class="eb-foot">รวม '+baht(Lk.foc+Lk.disc)+' · '+(A.rev?((Lk.foc+Lk.disc)*100/(A.rev+Fut.rev||1)).toFixed(1):'0')+'% ของรายได้ทั้งช่วง</div></div>'
      + '<div class="eb-card"><h2>รายได้ที่หลุดมือ <span class="eb-tag">'+E(R.lbl)+'</span>'+src('ที่มา: เช็คอิน · Travel Summary')+'</h2><div class="eb-rows two">'
      + '<div class="rw"><span class="lb">No-show · '+num(Lk.ns)+' pax</span><span class="vv">'+baht(Lk.nsV)+'</span></div>'
      + '<div class="rw"><span class="lb">ยกเลิกหน้างาน · '+num(Lk.cx)+' pax</span><span class="vv">'+baht(Lk.cxV)+'</span></div>'
      + '<div class="rw"><span class="lb">ยกเลิกเพราะอากาศ · '+num(Lk.wx)+' pax</span><span class="vv">'+baht(Lk.wxV)+'</span></div>'
      + '</div><div class="eb-foot">มูลค่าประมาณจากราคาต่อหัวของใบนั้น · รายละเอียดค่าปรับดูที่ Travel Summary</div></div>'
      + '<div class="eb-card"><h2>การเก็บเงิน'+src('ที่มา: Accounting')+'</h2><div style="font-size:11.5px;color:var(--eb-ink2);font-weight:600">ค้างรับ '+baht(AR.tot)+' <span class="eb-mut">(ทั้งบริษัท)</span></div>'
      + '<div class="eb-hstack"><i style="width:'+(AR.cur*100/arTot)+'%;background:var(--eb-s3)"></i><i style="width:'+(AR.b30*100/arTot)+'%;background:var(--eb-s4)"></i><i style="width:'+(AR.b60*100/arTot)+'%;background:#E9A23B"></i><i style="width:'+(AR.b90*100/arTot)+'%;background:#D9483B"></i></div>'
      + '<div class="eb-rows two"><div class="rw"><span class="lb">ยังไม่ถึงกำหนด</span><span class="vv">'+baht(AR.cur)+'</span></div><div class="rw"><span class="lb">เกิน 1–30 วัน</span><span class="vv">'+baht(AR.b30)+'</span></div>'
      + '<div class="rw"><span class="lb">เกิน 31–60 วัน</span><span class="vv" style="color:var(--eb-warn)">'+baht(AR.b60)+'</span></div><div class="rw"><span class="lb">เกิน 60 วัน</span><span class="vv" style="color:var(--eb-bad)">'+baht(AR.b90)+'</span></div>'
      + '<div class="rw"><span class="lb">เกินวงเงินเครดิต</span><span class="vv">'+(Lmt.length?('<span class="eb-st b" title="'+E(Lmt.map(function(x){ return x.name+' '+x.pct+'%'; }).join(' · '))+'">● '+Lmt.length+' เอเย่นต์</span>'):'<span class="eb-st g">✓ 0</span>')+'</span></div></div></div>'
      + '</div>';
    return h;
  }

  /* ══ §execSales (2026-10-17) · แท็บ Sales Performance ═══════════════════
     owner ส่งไฟล์ "SALES PERFORMANCE 11-17 October 2026 · WEEKLY REPORT.xlsx" แล้วบอก "ดูอันนี้ แล้วเพิ่มอีกแท็บนึง"
     ไฟล์นั้นทำมือจากการเทียบยอดสะสมสองช่วง (จึงมีเลขติดลบ และเซลส์คนใหม่ "ยังไม่มีฐานให้หัก")
     แท็บนี้คิดจากใบจองตรง ๆ ตามวันที่ใบเข้าระบบ (_dashBkDay) · เปิดดูได้ทุกเมื่อ ไม่ต้องรอสิ้นสัปดาห์
     ชุดตัวเลขเดียวกับไฟล์: ตารางอันดับเซลส์ · แนวโน้ม 7 ช่วง (ต่อวัน) · MTD + Activation
       · เอเยนต์ที่ส่งยอดของแต่ละเซลส์ (★ใหม่) · Top 10 เอเยนต์ · เอเยนต์ที่เงียบไป
     นับ: ใบที่เข้าระบบในช่วงและยังไม่ยกเลิก (ไม่นับ quote / ใบภายในที่ไม่มีมูลค่า)
     เซลส์ = bk.soldBy ถ้ามี ไม่งั้นเซลส์ที่ดูแลเอเยนต์ (กติกาเดียวกับ Sales Board / Daily PFM)
     สัปดาห์ = อาทิตย์–เสาร์ (11–17 ต.ค. ในไฟล์ตรงกับแบบนี้) · ใช้ทั้งบริษัท ไม่กรองท่า */
  function sidOf(b){ return b.soldBy || (((typeof sbGetAgent==='function') && sbGetAgent(b.agentId))||{}).sales || ''; }
  function salesOf(sid){ var s=(sid && typeof sbGetSales==='function')?sbGetSales(sid):null;
    return {id:sid||'__none', name:s?(s.name||sid):'ไม่มีเซลส์ดูแล', color:s?(s.color||'#185FA5'):'#B8B3C8', none:!s}; }
  function agKey(b){ return (typeof laIsB2C==='function' && laIsB2C(b)) ? '__b2c' : (b.agentId||'__none'); }
  function weekStart(ds){ var d=dt(ds); d.setDate(d.getDate()-d.getDay()); return ymd(d); }
  function monStart(ds){ return ds.slice(0,8)+'01'; }
  function monEnd(ds){ var d=dt(ds); return ymd(new Date(d.getFullYear(), d.getMonth()+1, 0)); }
  function addMon(ds,n){ var d=dt(monStart(ds)); return ymd(new Date(d.getFullYear(), d.getMonth()+n, 1)); }
  function nDays(a,b){ return Math.round((dt(b)-dt(a))/86400000)+1; }
  function spRange(kind, off){
    var t0=today(), s, e;
    if(kind==='month'){ s=addMon(t0,off); e=monEnd(s); }
    else { s=addDays(weekStart(t0),7*off); e=addDays(s,6); }
    var to=e<t0?e:t0;
    return {from:s, end:e, to:to, days:Math.max(1,nDays(s,to)), full:e<=t0};
  }
  function spLabel(r, kind){
    if(kind==='month'){ var d=dt(r.from), M=(typeof laMonAbbrTH==='function')?laMonAbbrTH():[]; return (M[d.getMonth()]||'')+' '+d.getFullYear()+(r.full?'':' · ถึง '+thD(r.to)+' ('+r.days+' วัน)'); }
    return thD(r.from)+' – '+thD(r.end)+(r.full?'':' · ถึงวันนี้ '+r.days+' วัน');
  }
  var _spFirst=null, _spFirstAt=0;
  function agentFirstDay(){
    if(_spFirst && Date.now()-_spFirstAt<30000) return _spFirst;
    var m={}; (SB_BOOKINGS||[]).forEach(function(b){ if(!isSale(b)) return; var k=agKey(b), d=bkDay(b); if(!d || k==='__b2c') return; if(!m[k] || d<m[k]) m[k]=d; });
    _spFirst=m; _spFirstAt=Date.now(); return m;
  }
  /* ใบที่เข้าระบบในช่วง · รวมต่อเซลส์ / ต่อเอเยนต์ */
  function spAgg(from, to){
    var S={}, tot={pax:0, val:0, n:0, foc:0, ag:{}};
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!isLive(b)) return; var d=bkDay(b); if(!d || d<from || d>to) return;
      var so=salesOf(sidOf(b)), k=agKey(b), p=0, f=0, v=money(b);
      (b.trips||[]).forEach(function(t){ if(!t) return; p+=pax(t); f+=paxK(t,'foc'); });
      var X=S[so.id]=S[so.id]||{s:so, pax:0, val:0, n:0, foc:0, cx:0, cxV:0, ag:{}};
      [X, tot].forEach(function(o){ o.pax+=p; o.val+=v; o.n++; o.foc+=f;
        var A=o.ag[k]=o.ag[k]||{k:k, name:agentName(b), sid:so.id, pax:0, val:0, n:0, cx:0}; A.pax+=p; A.val+=v; A.n++; });
    });
    /* §execSalesNet (2026-10-17) · owner ตอบ "โอเคทำ" ต่อข้อเสนอให้ตรงกับวิธีคิดในไฟล์ WEEKLY REPORT
       ใบที่จองไว้ก่อนช่วงนี้ แล้วถูกยกเลิกภายในช่วงนี้ → หักออกจากยอดของช่วงนี้ (ไฟล์ขึ้นเป็นเลขติดลบ เช่น ODEON −1)
       ใบที่จองและยกเลิกในช่วงเดียวกันไม่ได้ถูกนับตั้งแต่แรก จึงไม่หักซ้ำ · จำนวนใบไม่ลด (นับเฉพาะใบที่เข้ามา) */
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b || CXL.indexOf(b.status)<0) return;
      if(typeof laIsInternalFree==='function' && laIsInternalFree(b)) return;
      var c=cxlDay(b), d=bkDay(b); if(!c || c<from || c>to || !d || d>=from) return;
      var so=salesOf(sidOf(b)), k=agKey(b), p=0, f=0, v=money(b);
      (b.trips||[]).forEach(function(t){ if(!t) return; p+=pax(t); f+=paxK(t,'foc'); });
      var X=S[so.id]=S[so.id]||{s:so, pax:0, val:0, n:0, foc:0, cx:0, cxV:0, ag:{}};
      [X, tot].forEach(function(o){ o.pax-=p; o.val-=v; o.foc-=f; o.cx=(o.cx||0)+p; o.cxV=(o.cxV||0)+v;
        var A=o.ag[k]=o.ag[k]||{k:k, name:agentName(b), sid:so.id, pax:0, val:0, n:0, cx:0}; A.pax-=p; A.val-=v; A.cx+=p; });
    });
    return {S:S, tot:tot};
  }
  function spOrder(S){ return Object.keys(S).map(function(k){ return S[k]; }).sort(function(a,b){ return (a.s.none-b.s.none) || (b.val-a.val); }); }
  function viewSales(){
    var kind=EB.sp||'week', off=+EB.off||0, R=spRange(kind, off), P=spRange(kind, off-1);
    var A=spAgg(R.from, R.to), B=spAgg(P.from, (kind==='month'?addDays(P.from,R.days-1):P.to));
    var first=agentFirstDay(), T=A.tot, Tp=B.tot, perD=function(x){ return x/R.days; };
    /* เงียบไป · สัปดาห์: ส่งในเดือนนี้ก่อนสัปดาห์นี้ (ต้นเดือน = 4 สัปดาห์ก่อนหน้า) · เดือน: ส่งเดือนก่อนแต่เดือนนี้ยังไม่ส่ง */
    var qFrom, qTo=addDays(R.from,-1), qLbl;
    if(kind==='month'){ qFrom=addMon(R.from,-1); qLbl='ส่งยอดเดือนก่อน แต่เดือนนี้ยังเงียบ'; }
    else { qFrom=monStart(R.to); if(qFrom>qTo){ qFrom=addDays(R.from,-28); qLbl='ส่งยอดใน 4 สัปดาห์ก่อน แต่สัปดาห์นี้เงียบ'; } else qLbl='ส่งยอดเดือนนี้แล้ว แต่สัปดาห์นี้เงียบ'; }
    var Q=qFrom<=qTo?spAgg(qFrom,qTo):{tot:{ag:{}}};
    var quiet=Object.keys(Q.tot.ag).filter(function(k){ return k!=='__b2c' && k!=='__none' && Q.tot.ag[k].n>0 && Q.tot.ag[k].pax>0 && !(T.ag[k] && T.ag[k].n>0); }).map(function(k){ return Q.tot.ag[k]; }).sort(function(a,b){ return b.pax-a.pax; });
    var rows=spOrder(A.S), isNew=function(k){ return k!=='__b2c' && first[k] && first[k]>=R.from && first[k]<=R.to; };
    var newN=Object.keys(T.ag).filter(isNew).length, sentN=Object.keys(T.ag).filter(function(k){ return k!=='__b2c' && k!=='__none' && T.ag[k].n>0; }).length;
    var h='<div class="eb-grid eb-kpis">'
      + kpi('Pax ที่ขายได้ (สุทธิ)', num(T.pax), (T.cx?'หักยกเลิก '+num(T.cx)+' · ':'')+perD(T.pax).toFixed(1)+' / วัน · '+chg(perD(T.pax), Tp.pax/R.days)+' vs ช่วงก่อน')
      + kpi('ยอดขาย (Value sold)', baht(T.val), baht(perD(T.val))+' / วัน · '+chg(T.val, Tp.val))
      + kpi('ใบจอง', num(T.n), (T.n?(T.pax/T.n).toFixed(2):'0')+' pax / ใบ · '+chg(T.n, Tp.n))
      + kpi('FOC', num(T.foc)+'<small>pax</small>', (T.pax?(T.foc*100/T.pax).toFixed(1):'0')+'% ของ pax'+(Tp.pax?(' · ช่วงก่อน '+(Tp.foc*100/Tp.pax).toFixed(1)+'%'):''), (T.pax && T.foc/T.pax>0.1)?'warn':'')
      + kpi('THB / Pax', '฿'+num(T.pax?T.val/T.pax:0), chg(T.pax?T.val/T.pax:0, Tp.pax?Tp.val/Tp.pax:0)+' vs ช่วงก่อน')
      + kpi('เอเยนต์ที่ส่งยอด', num(sentN), '<span class="eb-up">★ ใหม่ '+num(newN)+'</span> · เงียบไป '+num(quiet.length))
      + '</div>';

    /* ตารางอันดับเซลส์ */
    var M = kind==='month';
    var agAll=function(sid){ return (typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).filter(function(a){ return a && a.sales===sid && a.active!==false && a.status!=='inactive'; }).length; };
    var head='<tr><th>#</th><th>เซลส์</th><th>Pax</th><th>ยอดขาย</th><th>% ยอดขาย</th><th>ใบ</th><th title="Pax ของใบที่จองไว้ก่อนช่วงนี้ แล้วยกเลิกในช่วงนี้ · หักออกจาก Pax / ยอดขายแล้ว">หักยกเลิก</th><th>FOC</th><th>FOC %</th><th>THB / Pax</th><th>Pax / วัน</th><th>vs ช่วงก่อน</th><th>เอเยนต์ส่ง</th><th>★ ใหม่</th><th>เงียบไป</th>'
      +(M?'<th>เอเยนต์ทั้งหมด</th><th>Activation</th><th>Pax / เอเยนต์</th>':'<th>เอเยนต์อันดับ 1</th>')+'</tr>';
    var rank=0;
    var body=rows.map(function(x){
      var aks=Object.keys(x.ag).filter(function(k){ return k!=='__b2c' && k!=='__none' && x.ag[k].n>0; }), nNew=aks.filter(isNew).length;
      var nq=quiet.filter(function(q){ return q.sid===x.s.id; }).length;
      var topA=Object.keys(x.ag).map(function(k){ return x.ag[k]; }).sort(function(a,b){ return b.pax-a.pax; })[0];
      var pv=B.S[x.s.id], all=x.s.none?0:agAll(x.s.id);
      if(!x.s.none) rank++;
      return '<tr'+(x.s.none?' class="eb-dim"':'')+'><td>'+(x.s.none?'':rank)+'</td><td><span class="eb-dot" style="background:'+E(x.s.color)+'"></span><b>'+E(x.s.name)+'</b></td>'
        +'<td><b>'+num(x.pax)+'</b></td><td><b>'+baht(x.val)+'</b></td>'
        +'<td><div class="eb-pct"><span><i style="width:'+pct(x.val,T.val)+'%;background:'+E(x.s.color)+'"></i></span>'+pct(x.val,T.val)+'%</div></td>'
        +'<td>'+num(x.n)+'</td><td>'+(x.cx?'<span class="eb-dn">−'+num(x.cx)+'</span>':'<span class="eb-mut">0</span>')+'</td><td>'+num(x.foc)+'</td><td>'+(x.pax?(x.foc*100/x.pax>10?'<span class="eb-st w">'+(x.foc*100/x.pax).toFixed(1)+'%</span>':(x.foc*100/x.pax).toFixed(1)+'%'):'—')+'</td>'
        +'<td>฿'+num(x.pax?x.val/x.pax:0)+'</td><td>'+(x.pax/R.days).toFixed(1)+'</td><td>'+chg(x.pax/R.days, pv?pv.pax/R.days:0)+'</td>'
        +'<td>'+num(aks.length)+'</td><td>'+(nNew?'<span class="eb-up">'+nNew+'</span>':'<span class="eb-mut">0</span>')+'</td><td>'+(nq?num(nq):'<span class="eb-mut">0</span>')+'</td>'
        +(M ? '<td>'+(all||'—')+'</td><td>'+(all?pct(aks.length,all)+'%':'—')+'</td><td>'+(aks.length?(x.pax/aks.length).toFixed(1):'—')+'</td>'
            : '<td class="eb-l" title="'+E(topA?topA.name:'')+'">'+(topA?E(topA.name)+' <span class="eb-mut">'+pct(topA.pax,x.pax)+'%</span>':'—')+'</td>')
        +'</tr>';
    }).join('');
    var allTeam=M?(typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).filter(function(a){ return a && a.sales && a.active!==false && a.status!=='inactive'; }).length:0;
    var foot='<tr class="eb-tot"><td></td><td><b>รวมทั้งทีม</b></td><td><b>'+num(T.pax)+'</b></td><td><b>'+baht(T.val)+'</b></td><td>100%</td><td>'+num(T.n)+'</td><td>'+(T.cx?'<span class="eb-dn">−'+num(T.cx)+'</span>':'0')+'</td><td>'+num(T.foc)+'</td><td>'+(T.pax?(T.foc*100/T.pax).toFixed(1)+'%':'—')+'</td>'
      +'<td>฿'+num(T.pax?T.val/T.pax:0)+'</td><td>'+(T.pax/R.days).toFixed(1)+'</td><td>'+chg(T.pax, Tp.pax)+'</td><td>'+num(sentN)+'</td><td>'+num(newN)+'</td><td>'+num(quiet.length)+'</td>'
      +(M?'<td>'+num(allTeam)+'</td><td>'+(allTeam?pct(sentN,allTeam)+'%':'—')+'</td><td>'+(sentN?(T.pax/sentN).toFixed(1):'—')+'</td>':'<td></td>')+'</tr>';
    h+='<div class="eb-sec">อันดับเซลส์ · '+E(spLabel(R,kind))+'</div><div class="eb-card eb-scroll"><h2>ยอดขายตามเซลส์ <span class="eb-tag">นับตามวันที่ใบเข้าระบบ · หักใบเก่าที่ยกเลิกในช่วงนี้ · ไม่นับ quote</span>'+src('ที่มา: Booking · Sales')+'</h2>'
      +'<table class="eb-tbl eb-sp">'+'<thead>'+head+'</thead><tbody>'+(body||'<tr><td colspan="17" class="eb-none">ยังไม่มีใบจองในช่วงนี้</td></tr>')+foot+'</tbody></table>'
      +'<div class="eb-foot">vs ช่วงก่อน = Pax ต่อวันเทียบ'+(kind==='month'?'เดือนก่อน (จำนวนวันเท่ากัน)':'สัปดาห์ก่อน')+' · ★ ใหม่ = เอเยนต์ที่ส่งใบแรกในระบบภายในช่วงนี้ · เงียบไป = '+E(qLbl)+'</div></div>';

    /* แนวโน้ม 7 ช่วง · ต่อวัน */
    var per=[]; for(var i=6;i>=0;i--){ var r=spRange(kind, off-i); var a=spAgg(r.from, r.to); per.push({r:r, a:a}); }
    var sids=rows.filter(function(x){ return !x.s.none; }).map(function(x){ return x.s; });
    per.forEach(function(p){ Object.keys(p.a.S).forEach(function(k){ var so=p.a.S[k].s; if(!so.none && !sids.some(function(s){ return s.id===so.id; })) sids.push(so); }); });
    var trendTbl=function(key, fmt){
      var mx=1; per.forEach(function(p){ sids.forEach(function(s){ var v=(p.a.S[s.id]||{})[key]||0; v/=p.r.days; if(v>mx) mx=v; }); });
      var tmx=Math.max.apply(null,[1].concat(per.map(function(p){ return p.a.tot[key]/p.r.days; })));
      var line=function(name, color, vals, m){ var last=vals[vals.length-1], prev=vals[vals.length-2];
        return '<tr><td><span class="eb-dot" style="background:'+E(color)+'"></span><b>'+E(name)+'</b></td><td><div class="eb-spark">'
          + vals.map(function(v,j){ return '<i title="'+E(spLabel(per[j].r,kind))+' · '+fmt(v)+' / วัน" style="height:'+Math.max(2,Math.round(v*100/m))+'%;background:'+(j===vals.length-1?E(color):'var(--eb-s2)')+'"></i>'; }).join('')
          + '</div></td><td><b>'+fmt(last)+'</b></td><td>'+chg(last, prev)+'</td></tr>'; };
      return '<table class="eb-tbl eb-tr"><thead><tr><th>เซลส์</th><th>7 '+(kind==='month'?'เดือน':'สัปดาห์')+' (ต่อวัน)</th><th>ล่าสุด</th><th>vs ก่อนหน้า</th></tr></thead><tbody>'
        + sids.map(function(s){ return line(s.name, s.color, per.map(function(p){ return ((p.a.S[s.id]||{})[key]||0)/p.r.days; }), mx); }).join('')
        + line('ทั้งทีม', '#0F1B3D', per.map(function(p){ return p.a.tot[key]/p.r.days; }), tmx)
        + '</tbody></table>';
    };
    h+='<div class="eb-sec">แนวโน้ม 7 '+(kind==='month'?'เดือน':'สัปดาห์')+' · '+E(spLabel(per[0].r,kind).split(' · ')[0])+' ถึง '+E(spLabel(R,kind).split(' · ')[0])+'</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>Pax ต่อวัน</h2>'+trendTbl('pax', function(v){ return v.toFixed(1); })+'</div>'
      + '<div class="eb-card"><h2>ยอดขายต่อวัน</h2>'+trendTbl('val', baht)+'</div></div>';

    /* Top 10 · เงียบไป */
    var top=Object.keys(T.ag).filter(function(k){ return k!=='__none' && T.ag[k].n>0; }).map(function(k){ return T.ag[k]; }).sort(function(a,b){ return b.pax-a.pax; }).slice(0,10);
    h+='<div class="eb-sec">เอเยนต์</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>Top 10 เอเยนต์ <span class="eb-tag">'+E(spLabel(R,kind))+'</span></h2><table class="eb-tbl eb-l2"><thead><tr><th>#</th><th>เอเยนต์</th><th>เซลส์</th><th>Pax</th><th>ยอดขาย</th></tr></thead><tbody>'
      + (top.length?top.map(function(a,i){ var so=salesOf(a.sid==='__none'?'':a.sid);
          return '<tr><td>'+(i+1)+'</td><td class="eb-l"><b>'+E(a.name)+'</b>'+(isNew(a.k)?' <span class="eb-new">★ ใหม่</span>':'')+'</td><td><span class="eb-dot" style="background:'+E(so.color)+'"></span>'+E(so.name)+'</td><td><b>'+num(a.pax)+'</b></td><td>'+baht(a.val)+'</td></tr>'; }).join('')
        :'<tr><td colspan="5" class="eb-none">—</td></tr>')+'</tbody></table></div>'
      + '<div class="eb-card"><h2>เอเยนต์ที่เงียบไป <span class="eb-tag">'+E(qLbl)+' · '+num(quiet.length)+' ราย</span></h2>'
      + (quiet.length?'<div class="eb-qscroll"><table class="eb-tbl eb-l2"><thead><tr><th>#</th><th>เอเยนต์</th><th>เซลส์</th><th>Pax ช่วงก่อน</th></tr></thead><tbody>'
          + quiet.map(function(a,i){ var so=salesOf(a.sid==='__none'?'':a.sid); return '<tr><td>'+(i+1)+'</td><td class="eb-l">'+E(a.name)+'</td><td><span class="eb-dot" style="background:'+E(so.color)+'"></span>'+E(so.name)+'</td><td>'+num(a.pax)+'</td></tr>'; }).join('')
          + '</tbody></table></div>':'<div class="eb-none">ไม่มีเอเยนต์ที่เงียบไป</div>')+'</div></div>';

    /* เอเยนต์ที่ส่งยอด แยกตามเซลส์ */
    h+='<div class="eb-sec">เอเยนต์ที่ส่งยอดเข้ามา · แยกตามเซลส์</div><div class="eb-mv">'
      + rows.map(function(x, i){
          var L=Object.keys(x.ag).map(function(k){ return x.ag[k]; }).sort(function(a,b){ return b.pax-a.pax; });
          var nNew=L.filter(function(a){ return isNew(a.k); }).length, mx=Math.max.apply(null,[1].concat(L.map(function(a){ return a.pax; })));
          return '<div class="eb-card"><h2><span class="eb-dot" style="background:'+E(x.s.color)+'"></span>'+(x.s.none?'':'#'+(i+1)+' ')+E(x.s.name)+'</h2>'
            + '<div class="eb-foot" style="margin:-6px 0 8px">'+num(L.filter(function(a){ return a.n>0; }).length)+' ราย · ★ ใหม่ '+num(nNew)+' · '+num(x.pax)+' pax · '+baht(x.val)+'</div>'
            + '<div class="eb-mvl">'+L.slice(0,12).map(function(a){ return '<div class="rw" title="'+E(a.name+' · '+a.pax+' pax · '+baht(a.val)+' · '+a.n+' ใบ')+'"><span class="lb">'+E(a.name)+(isNew(a.k)?' <span class="eb-new">★</span>':'')+'</span><span class="mini"><i style="width:'+Math.max(0,Math.round(a.pax*100/mx))+'%;background:'+E(x.s.color)+'"></i></span><span class="vv"'+(a.pax<0?' style="color:var(--eb-bad)" title="ยกเลิกใบเก่า"':'')+'>'+num(a.pax)+'</span></div>'; }).join('')
            + (L.length>12?'<div class="eb-foot">+ อีก '+(L.length-12)+' ราย</div>':'')+'</div></div>';
        }).join('')+'</div>';
    return h;
  }

  /* ── วาด ───────────────────────────────────────────────────────────── */
  function seg(key, items){ return '<span class="eb-seg">'+items.map(function(it){ return '<button class="'+(EB[key]===it[0]?'on':'')+'" onclick="ebSet(\''+key+'\',\''+it[0]+'\')">'+it[1]+'</button>'; }).join('')+'</span>'; }
  function render(){
    var w=document.getElementById('eb-wrap'); if(!w) return;
    ensureCss();
    var body='';
    try{ body = EB.tab==='sales' ? viewSales() : (EB.per==='today' ? viewToday() : viewPeriod()); }
    catch(e){ console.error('[execBoard] render', e); body='<div class="eb-card eb-none">Render error · '+E(e&&e.message)+'</div>'; }
    var t0=today();
    w.innerHTML='<div class="eb">'
      + '<div class="eb-top"><h1>Executive Board<small>OVERVIEW · รายได้และยอดจอง</small></h1>'
      + seg('tab',[['rev','ภาพรวมรายได้'],['sales','Sales Performance']])
      + (EB.tab==='sales'
          ? (seg('sp',[['week','สัปดาห์'],['month','เดือน']])
             + '<span class="eb-nav"><button onclick="ebSet(\'off\','+((+EB.off||0)-1)+')" title="ช่วงก่อนหน้า">\u2039</button><b>'+E(spLabel(spRange(EB.sp||'week',+EB.off||0),EB.sp||'week'))+'</b>'
             + '<button onclick="ebSet(\'off\','+Math.min(0,(+EB.off||0)+1)+')"'+((+EB.off||0)>=0?' disabled':'')+' title="ช่วงถัดไป">\u203a</button></span>')
          : (seg('per',[['today','วันนี้'],['month','เดือนนี้'],['quarter','ไตรมาส'],['year','ปีนี้']])
             + seg('pier',[['','ทุกท่า'],['tublamu','Tub Lamu'],['panwa','Panwa'],['ranong','Ranong']])))
      + '<span class="eb-sp"></span><span class="eb-upd">'+E(thDow(t0))+' '+E(thD(t0))+' '+t0.slice(0,4)+' · อัปเดต '+hhmm(Date.now())+' · วาดใหม่ทุก 1 นาที</span></div>'
      + body + '</div>';
  }
  function keepRender(){
    var m=document.querySelector('.main'), y=m?m.scrollTop:0, wy=window.scrollY;
    render();
    try{ if(m) m.scrollTop=y; window.scrollTo(window.scrollX||0, wy); }catch(_){}
  }
  window.ebRender = render;
  window.ebSet = function(k, v){ if(k==='off') v=Math.min(0,+v||0); if(k==='sp' || k==='tab') EB.off=0; EB[k]=v; keepRender(); };
  /* Live · วาดใหม่ทุก 60 วินาที เฉพาะตอนหน้านี้เปิดอยู่และแท็บไม่ได้ถูกซ่อน */
  if(!window.__ebTick){
    window.__ebTick = setInterval(function(){
      try{ var v=document.getElementById('view-execboard'); if(!v || !v.classList.contains('active') || document.hidden) return; keepRender(); }catch(_){}
    }, 60000);
  }

  function ensureCss(){
    if(document.getElementById('eb-style')) return;
    var s=document.createElement('style'); s.id='eb-style';
    s.textContent = [
      '#eb-wrap{--eb-ink:#0F1B3D;--eb-ink2:#4A5263;--eb-mut:#8A90A0;--eb-line:#E6E9EF;--eb-blue:#1683C7;--eb-blue-d:#0E5E93;',
      '--eb-good:#0F7B4F;--eb-good-l:#E6F4EC;--eb-warn:#A35F00;--eb-warn-l:#FDF1DC;--eb-bad:#B42318;--eb-bad-l:#FDE8E6;',
      '--eb-s1:#EAF3FB;--eb-s2:#C9E2F5;--eb-s3:#8FC3EA;--eb-s4:#4C9BD6;--eb-s5:#1A6FB0;',
      'background:#EEF2F7;margin:-22px;padding:18px 20px 30px;min-height:calc(100dvh - var(--topbar, 44px));color:var(--eb-ink);font-size:13px;line-height:1.45}',
      '.eb{max-width:1440px;margin:0 auto}',
      '.eb-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
      '.eb-top h1{margin:0;font-size:22px;letter-spacing:-.01em;color:var(--eb-ink)}',
      '.eb-top h1 small{display:block;font-size:11.5px;font-weight:600;color:var(--eb-mut);letter-spacing:.02em}',
      '.eb-seg{display:inline-flex;background:#fff;border:1px solid var(--eb-line);border-radius:9px;padding:2px}',
      '.eb-seg button{font:600 12px inherit;font-family:inherit;padding:5px 11px;border-radius:7px;border:0;background:transparent;color:var(--eb-ink2);cursor:pointer}',
      '.eb-seg button.on{background:var(--eb-ink);color:#fff}',
      '.eb-sp{flex:1}.eb-upd{font-size:11.5px;color:var(--eb-mut)}',
      '.eb-grid{display:grid;gap:12px}',
      '.eb-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}',
      '.eb-r5{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}',
      '.eb-r2{grid-template-columns:minmax(0,1fr) minmax(0,1.55fr)}',
      '.eb-r3{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr)}',
      '.eb-r4{grid-template-columns:repeat(3,minmax(0,1fr))}',
      '@media(max-width:1180px){.eb-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.eb-r5,.eb-r2,.eb-r3,.eb-r4{grid-template-columns:minmax(0,1fr)}}',
      '@media(max-width:640px){.eb-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#eb-wrap{padding:12px}}',
      '.eb-card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 2px rgba(15,27,61,.05);min-width:0}',
      '.eb-k .l{font-size:11.5px;font-weight:600;color:var(--eb-ink2)}',
      '.eb-k .v{font-size:25px;font-weight:700;margin:3px 0 2px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}',
      '.eb-k .v small{font-size:12.5px;font-weight:600;color:var(--eb-mut);margin-left:4px}',
      '.eb-k .d{font-size:11.5px;color:var(--eb-mut)}',
      '.eb-k .bar{height:5px;background:#EDF0F4;border-radius:3px;margin-top:8px;overflow:hidden}',
      '.eb-k .bar i{display:block;height:100%;border-radius:3px;background:var(--eb-blue)}',
      '.eb-k.warn{box-shadow:inset 0 3px 0 #F0B44C,0 1px 2px rgba(15,27,61,.05)}',
      '.eb-k.bad{box-shadow:inset 0 3px 0 #E5534B,0 1px 2px rgba(15,27,61,.05)}',
      '.eb-up{color:var(--eb-good);font-weight:700}.eb-dn{color:var(--eb-bad);font-weight:700}.eb-mut{color:var(--eb-mut)}',
      '.eb-st{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;border-radius:6px;padding:1px 7px;white-space:nowrap}',
      '.eb-st.g{background:var(--eb-good-l);color:var(--eb-good)}.eb-st.w{background:var(--eb-warn-l);color:var(--eb-warn)}.eb-st.b{background:var(--eb-bad-l);color:var(--eb-bad)}',
      '#eb-wrap h2{font-size:13.5px;margin:0 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--eb-ink)}',
      '.eb-tag{font-size:10.5px;font-weight:600;color:var(--eb-mut)}',
      '.eb-src{margin-left:auto;font-size:10.5px;font-weight:600;color:var(--eb-blue);white-space:nowrap}',
      '.eb-sec{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--eb-mut);text-transform:uppercase;margin:18px 2px 8px}',
      '.eb-live{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;color:var(--eb-good);background:var(--eb-good-l);border-radius:7px;padding:2px 8px}',
      '.eb-live i{width:7px;height:7px;border-radius:50%;background:#16A34A;box-shadow:0 0 0 3px rgba(22,163,74,.18)}',
      '.eb-tbl{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}',
      '.eb-tbl th{font-size:10.5px;font-weight:700;color:var(--eb-mut);text-align:right;padding:0 6px 6px;white-space:nowrap}',
      '.eb-tbl th:first-child,.eb-tbl td:first-child{text-align:left;padding-left:0}',
      '.eb-tbl td{padding:6px;border-top:1px solid var(--eb-line);text-align:right;white-space:nowrap}',
      '.eb-tbl td:first-child{white-space:normal}',
      '.eb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}',
      '.eb-cap{display:flex;align-items:center;gap:8px;justify-content:flex-end}',
      '.eb-cap .t{width:90px;height:7px;background:#EDF0F4;border-radius:4px;overflow:hidden;display:flex}',
      '.eb-cap .t i{display:block;height:100%}',
      '.eb-cap .n{display:inline-block;min-width:58px;text-align:right}',
      '.eb-sts{font-size:11px;font-weight:700;border-radius:6px;padding:2px 8px;white-space:nowrap;background:#EEF0F4;color:var(--eb-ink2)}',
      '.eb-sts.dep{background:var(--eb-good-l);color:var(--eb-good)}.eb-sts.ck{background:#EAF3FB;color:var(--eb-blue-d)}.eb-sts.wt{background:var(--eb-warn-l);color:var(--eb-warn)}',
      '.eb-tm{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}',
      '.eb-tm>div{background:#F6F8FB;border-radius:10px;padding:9px 12px}',
      '.eb-tm .l{font-size:11px;font-weight:600;color:var(--eb-ink2)}',
      '.eb-tm .v{font-size:20px;font-weight:700}.eb-tm .v small{font-size:11px;color:var(--eb-mut);font-weight:600;margin-left:3px}',
      '.eb-tm .d{font-size:11px;color:var(--eb-mut)}',
      '.eb-feed{list-style:none;margin:0;padding:0}',
      '.eb-feed li{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--eb-line)}',
      '.eb-feed li:first-child{border-top:0}',
      '.eb-feed .t{font-size:11.5px;color:var(--eb-mut);font-variant-numeric:tabular-nums}',
      '.eb-feed .w b{font-weight:700}.eb-feed .w span{display:block;font-size:11.5px;color:var(--eb-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eb-feed .a{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.eb-feed .a span{display:block;font-size:11px;font-weight:600;color:var(--eb-mut)}',
      '.eb-feed li.new{background:linear-gradient(90deg,#EAF7EF,transparent 70%)}',
      '.eb-hb{display:flex;align-items:flex-end;gap:3px;height:90px;border-bottom:1px solid var(--eb-line)}',
      '.eb-hb>div{flex:1;height:100%;display:flex;align-items:flex-end}',
      '.eb-hb i{display:block;width:100%;background:var(--eb-s4);border-radius:3px 3px 0 0}.eb-hb i.now{background:var(--eb-blue-d)}',
      '.eb-hax{display:flex;gap:3px;font-size:9.5px;color:var(--eb-mut);margin-top:3px}.eb-hax span{flex:1;text-align:center}',
      '.eb-bars{display:flex;align-items:flex-end;gap:3px;height:120px;border-bottom:1px solid var(--eb-line)}',
      '.eb-bars i{flex:1;min-width:3px;background:var(--eb-s3);border-radius:3px 3px 0 0}',
      '.eb-bars i.w{background:var(--eb-s4)}.eb-bars i.t{background:var(--eb-blue-d)}',
      '.eb-bars i.f,.eb-lgd i.hatch{background:repeating-linear-gradient(135deg,var(--eb-s2) 0 4px,#fff 4px 7px);box-shadow:inset 0 0 0 1px var(--eb-s3)}',
      '.eb-axis{display:flex;justify-content:space-between;font-size:10.5px;color:var(--eb-mut);margin-top:4px}',
      '.eb-lgd{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:10.5px;color:var(--eb-mut);margin-top:8px}',
      '.eb-lgd i{width:16px;height:9px;border-radius:2px;display:inline-block}',
      '.eb-hstack{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin:6px 0 8px}.eb-hstack i{display:block;height:100%}',
      '.eb-rows .rw{display:grid;grid-template-columns:118px minmax(0,1fr) auto;gap:10px;align-items:center;padding:5px 0}',
      '.eb-rows.two .rw{grid-template-columns:minmax(0,1fr) auto}',
      '.eb-rows .lb{font-size:12px;color:var(--eb-ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eb-rows .vv{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}',
      '.eb-rows .mini{height:7px;background:#EDF0F4;border-radius:4px;overflow:hidden}.eb-rows .mini i{display:block;height:100%;border-radius:4px;background:var(--eb-blue)}',
      '.eb-foot{font-size:11px;color:var(--eb-mut);margin-top:8px}',
      '.eb-none{color:var(--eb-mut);text-align:center !important;padding:14px 0 !important}',
      /* §execSales */
      '.eb-nav{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--eb-line);border-radius:9px;padding:2px 4px}',
      '.eb-nav b{font-size:12px;font-weight:600;padding:0 4px;white-space:nowrap}',
      '.eb-nav button{border:0;background:transparent;font-size:17px;line-height:1;padding:2px 7px;border-radius:6px;cursor:pointer;color:var(--eb-ink)}',
      '.eb-nav button:disabled{opacity:.3;cursor:default}',
      '.eb-scroll{overflow-x:auto}',
      '.eb-tbl.eb-sp td,.eb-tbl.eb-sp th{padding-left:7px;padding-right:7px}',
      '.eb-tbl.eb-sp td:nth-child(2),.eb-tbl.eb-sp th:nth-child(2),.eb-tbl.eb-l2 td:nth-child(2),.eb-tbl.eb-l2 th:nth-child(2){text-align:left}',
      '.eb-tbl td.eb-l{text-align:left;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eb-tbl tr.eb-dim td{color:var(--eb-mut)}',
      '.eb-tbl tr.eb-tot td{border-top:2px solid var(--eb-ink);background:#F6F8FB}',
      '.eb-pct{display:flex;align-items:center;gap:6px;justify-content:flex-end}',
      '.eb-pct span{width:60px;height:6px;background:#EDF0F4;border-radius:3px;overflow:hidden}.eb-pct i{display:block;height:100%;border-radius:3px}',
      '.eb-r4h{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '@media(max-width:1180px){.eb-r4h{grid-template-columns:minmax(0,1fr)}}',
      '.eb-spark{display:flex;align-items:flex-end;gap:3px;height:26px;width:150px;margin-left:auto}',
      '.eb-spark i{flex:1;border-radius:2px 2px 0 0;min-height:2px}',
      '.eb-tbl.eb-tr td{padding-top:4px;padding-bottom:4px}',
      '.eb-new{font-size:10px;font-weight:700;color:#A35F00;background:#FDF1DC;border-radius:5px;padding:0 5px;margin-left:3px;white-space:nowrap}',
      '.eb-qscroll{max-height:330px;overflow:auto}',
      '.eb-mv{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}',
      '.eb-mvl .rw{display:grid;grid-template-columns:minmax(0,1fr) 60px 34px;gap:8px;align-items:center;padding:3px 0;font-size:12px}',
      '.eb-mvl .lb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--eb-ink2)}',
      '.eb-mvl .mini{height:6px;background:#EDF0F4;border-radius:3px;overflow:hidden}.eb-mvl .mini i{display:block;height:100%;border-radius:3px}',
      '.eb-mvl .vv{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
