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
   §execNoAR (2026-10-17) · owner "ตัดเรื่องยอดเงินค้างออกก่อน" · ลูกหนี้ / อายุหนี้ / ค้างชำระ / วงเงินเครดิต ไม่แสดงในหน้านี้ (ดูที่ Accounting)

   ⚠ ยังไม่มีในระบบ จึงไม่แสดง (ไม่เดาตัวเลขขึ้นมาเอง):
     เป้ารายได้เป็นเงิน (ที่มีคือเป้า pax ของเซลส์) · เวลาออกเรือจริง (มีแต่เวลาตามโปรแกรม)
   ⚠ "Live" = วาดใหม่ทุก 60 วินาทีจากข้อมูลในเครื่อง ซึ่งระบบ sync กับ server ให้อยู่แล้ว
     และวาดเฉพาะตอนหน้านี้เปิดอยู่ · ตำแหน่งเลื่อนหน้าไม่เด้ง
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var EB = window._eb = window._eb || { per:'today', pier:'', tab:'rev', sp:'week', off:0, gp:'h' };   /* §execSales · tab/sp/off · §execGap · gp */
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

  /* ══ §execPerf (2026-10-17) · owner "เวลาคลิกแถบด้านบน ช้ามาก"
     ของเดิมทุกฟังก์ชันกวาด SB_BOOKINGS ทั้งก้อนเอง · หน้า Gap กวาดเป็นสิบ ๆ รอบ (routesOn ต่อวัน · salesShare · curve)
     แล้วยังเรียก getAllotment ซ้ำช่องเดิม และ pxDay (Trip P&L ทั้งวัน) ทุกวันในช่วง
     ตอนนี้: ดัชนีจากการกวาดครั้งเดียว (ใบต่อวันเดินทาง · ต่อวันที่เข้าระบบ · ต่อวันยกเลิก) · getAllotment จำผลไว้
     · pxDay เรียกเฉพาะเที่ยวใน 7 วันข้างหน้า · ทั้งหมดผูกกับตราประทับข้อมูล (บันทึกเมื่อไหร่ · จำนวนใบ · จำนวนวันที่วางเรือ) + 20 วิ
     · คลิกแถบแล้วขึ้นข้อความรอก่อน ค่อยคำนวณในเฟรมถัดไป ปุ่มจึงตอบทันที */
  var _ix=null;
  function stamp(){ var tk=0; try{ tk=Object.keys(TRIPS||{}).length; }catch(_){} return String(window.__savedAt||0)+'|'+((SB_BOOKINGS||[]).length)+'|'+tk+'|'+((typeof SB_SEAT_LOCKS!=='undefined'&&SB_SEAT_LOCKS)?SB_SEAT_LOCKS.length:0); }
  function idx(){
    var st=stamp(), now=Date.now();
    if(_ix && _ix.st===st && now-_ix.at<20000) return _ix;
    var I={st:st, at:now, byDate:{}, dates:[], made:{}, cxl:{}, al:{}, be:{}};
    (SB_BOOKINGS||[]).forEach(function(b){
      if(!b) return;
      var sale=isSale(b), live=sale && CXL.indexOf(b.status)<0;
      if(sale){ (b.trips||[]).forEach(function(t){ if(!t||!t.date) return; var L=I.byDate[t.date]; if(!L){ L=I.byDate[t.date]=[]; I.dates.push(t.date); } L.push({b:b, t:t, live:live}); }); }
      if(live){ var d=bkDay(b); if(d){ (I.made[d]=I.made[d]||[]).push(b); } }
      if(CXL.indexOf(b.status)>=0 && sale){ var c=cxlDay(b); if(c){ (I.cxl[c]=I.cxl[c]||[]).push(b); } }
    });
    I.dates.sort();
    _ix=I; return I;
  }
  function datesIn(I, from, to){ var out=[], D=I.dates; for(var i=0;i<D.length;i++){ if(D[i]<from) continue; if(D[i]>to) break; out.push(D[i]); } return out; }
  /* ทุกทริปของใบที่ยังไม่ยกเลิก ภายใต้ตัวกรองท่า · fn(b,t,r) */
  function eachTrip(from, to, fn, withCxl){
    var I=idx();
    datesIn(I, from, to).forEach(function(ds){
      I.byDate[ds].forEach(function(x){
        if(!withCxl && !x.live) return;
        var r=route(x.t.routeId); if(!pierOk(r)) return;
        fn(x.b, x.t, r);
      });
    });
  }
  function eachMade(from, to, fn){ var I=idx(); Object.keys(I.made).forEach(function(d){ if(d<from||d>to) return; I.made[d].forEach(fn); }); }
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
    eachMade(from, to, function(b){
      var ts=(b.trips||[]).filter(function(t){ return t && pierOk(route(t.routeId)); }); if(!ts.length) return;
      o.val+=money(b); o.n++; ts.forEach(function(t){ o.pax+=pax(t); }); o.list.push(b);
    });
    return o;
  }
  function cxlIn(from, to){
    var o={val:0, n:0, pax:0}, I=idx();
    Object.keys(I.cxl).forEach(function(d){ if(d<from||d>to) return; I.cxl[d].forEach(function(b){
      var ts=(b.trips||[]).filter(function(t){ return t && pierOk(route(t.routeId)); }); if(!ts.length) return;
      o.val+=money(b); o.n++; ts.forEach(function(t){ o.pax+=pax(t); });
    }); });
    return o;
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
  function alOf(rid, ds){ var I=idx(), k=rid+'|'+ds; if(k in I.al) return I.al[k]; var v=null; try{ v=getAllotment(rid, ds)||null; }catch(_){} I.al[k]=v; return v; }
  function rName(rid){ var r=route(rid)||{}, f=fam(rid); var n=String(r.name||rid);
    if(f && f.name){ var v=n.indexOf(f.name)>=0 ? n.replace(f.name,'') : n; v=v.replace(/^\s*(by|\u00b7|-|\u2014|\/)\s*/i,'').replace(/\s*(by|\u00b7|-|\u2014|\/)\s*$/i,'').replace(/\s+/g,' ').trim(); return {f:f.name, v:v}; }
    return {f:n, v:''}; }

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
    var Lk=leakage(R.from, R.to), Cx=cxlIn(R.from, toD);
    var rpp=A.pax?A.rev/A.pax:0, rppL=Al.pax?Al.rev/Al.pax:0;
    var h='<div class="eb-grid eb-kpis">'
      + kpi('รายได้'+R.lbl+' (วันเดินทาง)', baht(A.rev), chg(A.rev,Al.rev)+' vs ปีก่อน · '+num(A.pax)+' pax')
      + kpi('คาดการณ์สิ้น'+R.lbl.replace('นี้',''), baht(A.rev+Fut.rev), 'ได้แล้ว '+baht(A.rev)+' + จองไว้ '+baht(Fut.rev)+(R.to>t0?'':' (ครบช่วงแล้ว)'), '', (A.rev+Fut.rev)>0?pct(A.rev,A.rev+Fut.rev):null)
      + kpi('ยอดขายที่เข้ามา (วันจอง)', baht(S.val), num(S.n)+' ใบ · '+chg(S.val,Sl.val)+' vs ปีก่อน')
      + kpi('รายได้เฉลี่ยต่อหัว', '฿'+num(rpp), chg(rpp,rppL)+' vs ปีก่อน')
      + kpi('จองล่วงหน้า 30 วัน', baht(B30.rev), num(B30.pax)+' pax · '+chg(B30.rev,B30l.rev)+' vs ช่วงเดียวกันปีก่อน')
      + kpi('ยกเลิก'+R.lbl+' (วันที่ยกเลิก)', Cx.val?('<span style="color:var(--eb-bad)">'+baht(-Cx.val)+'</span>'):baht(0), num(Cx.n)+' ใบ · '+num(Cx.pax)+' pax · สุทธิที่เข้ามา <b>'+baht(S.val-Cx.val)+'</b>', Cx.val>S.val*0.15?'warn':'')
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
      + '<div class="eb-card"><h2>เอเย่นต์ · Top 5 ตามรายได้'+src('ที่มา: Booking')+'</h2><table class="eb-tbl"><thead><tr><th>เอเย่นต์</th><th>รายได้</th><th>vs ปีก่อน</th><th>รายได้/หัว</th><th>Pax</th></tr></thead><tbody>'
      + (top5.length?top5.map(function(a){
          return '<tr><td><b>'+E(a.name)+'</b></td><td><b>'+baht(a.rev)+'</b></td><td>'+chg(a.rev,a.ly)+'</td><td>'+(a.pax?'฿'+num(a.rev/a.pax):'—')+'</td><td>'+num(a.pax)+'</td></tr>'; }).join('')
        :'<tr><td colspan="5" class="eb-none">—</td></tr>')
      + '</tbody></table><div class="eb-foot">Top 5 = '+pct(top5v,A.rev)+'% ของรายได้'+(drop.length?(' · ยอดตกเกิน 20% vs ปีก่อน: '+drop.map(function(a){ return E(a.name); }).join(', ')):'')+'</div></div></div>';

    /* ส่วนลด · หลุดมือ */
    h+='<div class="eb-sec">ส่วนลด · รายได้ที่หลุดมือ</div><div class="eb-grid eb-r4h">'
      + '<div class="eb-card"><h2>ส่วนลดที่ให้ไป <span class="eb-tag">'+E(R.lbl)+'</span>'+src('ที่มา: Booking')+'</h2>'
      + hbar([{l:'FOC',v:Lk.foc},{l:'ส่วนลด',v:Lk.disc}], baht)
      + '<div class="eb-foot">รวม '+baht(Lk.foc+Lk.disc)+' · '+(A.rev?((Lk.foc+Lk.disc)*100/(A.rev+Fut.rev||1)).toFixed(1):'0')+'% ของรายได้ทั้งช่วง</div></div>'
      + '<div class="eb-card"><h2>รายได้ที่หลุดมือ <span class="eb-tag">'+E(R.lbl)+'</span>'+src('ที่มา: เช็คอิน · Travel Summary')+'</h2><div class="eb-rows two">'
      + '<div class="rw"><span class="lb">No-show · '+num(Lk.ns)+' pax</span><span class="vv">'+baht(Lk.nsV)+'</span></div>'
      + '<div class="rw"><span class="lb">ยกเลิกหน้างาน · '+num(Lk.cx)+' pax</span><span class="vv">'+baht(Lk.cxV)+'</span></div>'
      + '<div class="rw"><span class="lb">ยกเลิกเพราะอากาศ · '+num(Lk.wx)+' pax</span><span class="vv">'+baht(Lk.wxV)+'</span></div>'
      + '</div><div class="eb-foot">มูลค่าประมาณจากราคาต่อหัวของใบนั้น · รายละเอียดค่าปรับดูที่ Travel Summary</div></div>'
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

  /* ══ §execGap (2026-10-17) · แท็บ Gap to Target ═════════════════════════
     owner: "เห็นภาพรวมแล้วก็จริง แต่ยังไม่สามารถแก้ pain point ยอดลูกค้าที่ไม่เต็มได้ · ต้องมีแผน Monthly Weekly Daily
             เพื่อให้ถึงเป้าที่วางเรือไว้" → ตกลงแนวแล้ว "ทำ" (แสดงอย่างเดียวก่อน · ยังไม่บันทึกการตัดสินใจ)
     หลัก: เป้า = ที่นั่งที่วางเรือ (getAllotment.availableCapacity) × LF เป้า · ดูข้างหน้า ไม่ใช่ย้อนหลัง · ช่องว่างมีเจ้าของ (เซลส์)
     เพซ: booking curve ต่อเส้นทาง วัดจากทริปที่ออกไปแล้วใน 90 วัน (สัดส่วนของ pax สุดท้ายที่จองแล้ว ณ L วันก่อนออก)
          ทริปไม่พอ (<5) ใช้ curve รวมทั้งบริษัท · ไม่มีเลย ใช้ค่าตั้งต้นจากที่วัดได้ (40% ของ pax จองภายใน 7 วัน)
     แบ่งเป้าให้เซลส์: สัดส่วน pax ของเซลส์ต่อกลุ่มเส้นทาง ในเดือนเดียวกันปีก่อน · ไม่มี → 90 วันล่าสุด
     จุดคุ้มทุนต่อเที่ยว: pxDay(date) (Trip P&L) · ผิดพลาด/ไม่มีแผนต้นทุน → ไม่แสดงกรอบแดง
     ⚠ LF เป้า 90% ทุกเส้นทาง (EB_LF_TARGET) · ยังไม่มีที่ตั้งค่าต่อเส้นทาง */
  var EB_LF_TARGET=0.90, EB_HORIZON=14;
  var CURVE_DEF=[[0,1],[1,.81],[2,.72],[3,.70],[5,.68],[7,.60],[14,.53],[21,.45],[30,.35],[60,.15],[90,.05],[120,0]];
  function curveAt(C, L){ if(L<=0) return 1; for(var i=1;i<C.length;i++){ if(L<=C[i][0]){ var a=C[i-1], b=C[i]; return a[1]+(b[1]-a[1])*(L-a[0])/(b[0]-a[0]); } } return 0; }
  var _gc=null, _gcAt=0;
  /* booking curve · {rid:{pts,n}, all:{pts,n}} */
  function curves(){
    if(_gc && Date.now()-_gcAt<60000) return _gc;
    var t0=today(), from=addDays(t0,-90), L=[0,1,2,3,5,7,14,21,30,60,90,120];
    var byR={}, all={fin:0, at:L.map(function(){ return 0; }), n:0};
    var trips={};
    var I=idx();
    datesIn(I, from, addDays(t0,-1)).forEach(function(ds){ I.byDate[ds].forEach(function(x){ if(!x.live) return; var d=bkDay(x.b); if(!d) return; var t=x.t;
        var k=t.routeId+'|'+t.date, T=trips[k]=trips[k]||{rid:t.routeId, fin:0, at:L.map(function(){ return 0; })};
        var p=pax(t), lead=nDays(d,t.date)-1; T.fin+=p; L.forEach(function(l,i){ if(lead>=l) T.at[i]+=p; }); }); });
    Object.keys(trips).forEach(function(k){ var T=trips[k]; if(T.fin<5) return;
      var R=byR[T.rid]=byR[T.rid]||{fin:0, at:L.map(function(){ return 0; }), n:0};
      R.fin+=T.fin; R.n++; all.fin+=T.fin; all.n++; L.forEach(function(l,i){ R.at[i]+=T.at[i]; all.at[i]+=T.at[i]; }); });
    var mk=function(R){ return R && R.n>=5 && R.fin>0 ? {pts:L.map(function(l,i){ return [l, R.at[i]/R.fin]; }), n:R.n} : null; };
    var out={byR:{}, all:mk(all)||{pts:CURVE_DEF, n:0}, def:!mk(all)};
    Object.keys(byR).forEach(function(r){ var c=mk(byR[r]); if(c) out.byR[r]=c; });
    _gc=out; _gcAt=Date.now(); return out;
  }
  function curveOf(rid){ var C=curves(); return C.byR[rid]||C.all; }
  /* เที่ยวหนึ่งในวันหนึ่ง */
  function tripState(rid, ds){
    var t0=today(), al=alOf(rid, ds); if(!al || !al.hasAllotment) return null;
    var cap=+al.availableCapacity||0, bk=+al.seatsConsumed||0, free=Math.max(0,+al.seatsAvailable||0), lk=+al.lockedSeats||0;
    var tgt=Math.round(cap*EB_LF_TARGET), lead=nDays(t0,ds)-1, c=curveAt(curveOf(rid).pts, lead);
    var exp=tgt*c, proj=bk+tgt*(1-c), behind=Math.max(0,Math.round(exp-bk));
    var st = (free<=3 || bk>=tgt) ? 'full' : (bk>=exp*0.9 ? 'g' : (proj>=tgt*0.8 ? 'y' : 'r'));
    return {rid:rid, ds:ds, cap:cap, bk:bk, free:free, lk:lk, tgt:tgt, lead:lead, c:c, exp:exp, proj:proj, behind:behind, st:st, gap:Math.max(0,tgt-bk)};
  }
  function beOf(rid, ds){
    if(nDays(today(),ds)-1>7) return 0;                    /* §execPerf · Trip P&L ทั้งวันแพง · คิดเฉพาะที่ต้องตัดสินใจใน 7 วัน */
    var I=idx(), k=ds+'|'+rid;
    if(!(k in I.be)){ var v=0; try{ var day=(typeof TRIPS!=='undefined'&&TRIPS[ds])||{};
      Object.keys(day).forEach(function(bid){ var op=day[bid]; if(!op||op.route!==rid) return; var x=pxTrip(ds,bid); if(x && x.be) v+=x.be; }); }catch(_){} I.be[k]=v; }
    return I.be[k];
  }
  function gapRange(){
    var t0=today();
    if(EB.gp==='month') return {from:t0, to:monEnd(t0), lbl:'เดือนนี้', mFrom:monStart(t0), mTo:monEnd(t0)};
    if(EB.gp==='next'){ var s=addMon(t0,1); return {from:s, to:monEnd(s), lbl:'เดือนหน้า', mFrom:s, mTo:monEnd(s)}; }
    return {from:t0, to:addDays(t0,EB_HORIZON-1), lbl:EB_HORIZON+' วันข้างหน้า', mFrom:monStart(t0), mTo:monEnd(t0)};
  }
  /* สัดส่วนเซลส์ต่อกลุ่มเส้นทาง · ปีก่อนเดือนเดียวกัน หรือ 90 วันล่าสุด */
  function salesShare(mFrom, mTo){
    var t0=today(), tries=[[addYears(mFrom,-1), addYears(mTo,-1)], [addDays(t0,-90), addDays(t0,-1)]], out={fam:{}, src:''};
    for(var i=0;i<tries.length;i++){
      var S={}, tot=0;
      eachTrip(tries[i][0], tries[i][1], function(b,t){ var f=(fam(t.routeId)||{}).id||t.routeId, sid=salesOf(sidOf(b)).id, p=pax(t);
        var F=S[f]=S[f]||{tot:0, by:{}}; F.tot+=p; F.by[sid]=(F.by[sid]||0)+p; tot+=p; });
      if(tot>=50){ out.fam=S; out.src=i===0?'เดือนเดียวกันปีก่อน':'90 วันล่าสุด'; return out; }
    }
    return out;
  }
  /* ══ §execAlloc (2026-10-17) · owner "ทำแบบที่คุณคำนวณให้ก่อนด้วย และผู้บริหารแก้ไขได้ · ถ้ากำหนดเป้าแล้วจะดู progress ยังไง"
     เก็บที่ blob key 'exec_alloc' เป็น JSON string → ไปอยู่ app_meta ของเซิร์ฟเวอร์เอง (แบบเดียวกับ cost_plans ของหน้าต้นทุน) ไม่ต้องแตะฐานข้อมูล
     รูป: { "2026-10": { by:{famId:{salesId:pct}}, lf:{famId:pct}, who, at } } · เดือนที่ไม่มีค่า = ใช้สัดส่วนที่คำนวณ
     แก้ได้เมื่อมีสิทธิ์แก้ส่วน sales (laCanEditArea) · เปอร์เซ็นต์ที่ไม่ครบ 100 ของเส้นทาง = "ยังไม่มอบหมาย" ไม่หายไปไหน */
  function allocAll(){ var v=null; try{ v=laBlob().exec_alloc; if(typeof v==='string') v=JSON.parse(v); }catch(_){ v=null; } return (v&&typeof v==='object')?v:{}; }
  function allocOf(ym){ var a=allocAll()[ym]; return (a&&typeof a==='object'&&a.by)?a:null; }
  function allocSave(ym, rec){
    if(typeof laGuardEdit==='function' && !laGuardEdit('sales')) return false;
    try{ var all=allocAll(); if(rec) all[ym]=rec; else delete all[ym]; var d=laBlob(); d.exec_alloc=JSON.stringify(all); laBlobSave(); return true; }catch(e){ console.warn('[execAlloc] save failed', e); return false; }
  }
  function lfOf(ym, famId){ var a=allocOf(ym); var v=a&&a.lf&&+a.lf[famId]; return (v>0&&v<=100)?v/100:EB_LF_TARGET; }
  /* สัดส่วนที่ใช้จริง · ของผู้บริหารก่อน ไม่มีค่อยคำนวณ · คืนรูปเดียวกับ salesShare */
  function shareUsed(R){
    var ym=R.mFrom.slice(0,7), A=allocOf(ym), SH=salesShare(R.mFrom, R.mTo);
    if(!A) return {fam:SH.fam, src:SH.src, calc:SH, manual:false, ym:ym};
    var fam2={}; Object.keys(A.by).forEach(function(f){ var by=A.by[f]||{}, tot=0, o={tot:100, by:{}};
      Object.keys(by).forEach(function(sid){ var v=Math.max(0,+by[sid]||0); if(v>0){ o.by[sid]=v; tot+=v; } });
      if(tot>100){ Object.keys(o.by).forEach(function(sid){ o.by[sid]=o.by[sid]*100/tot; }); tot=100; }
      if(tot<100) o.by.__none=(o.by.__none||0)+(100-tot);
      fam2[f]=o; });
    return {fam:fam2, src:'กำหนดโดย '+(A.who||'ผู้บริหาร')+' · '+(A.at?thD(String(A.at).slice(0,10)):''), calc:SH, manual:true, ym:ym, rec:A};
  }
  function canAlloc(){ try{ return (typeof laCanEditArea!=='function') || laCanEditArea('sales'); }catch(_){ return false; } }
  window.ebAllocEdit=function(on){ EB.allocEdit=!!on; if(!on) EB.draft=null; keepRender(true); };
  function toast(msg){ try{ var t=document.getElementById('eb-toast'); if(!t){ t=document.createElement('div'); t.id='eb-toast'; document.body.appendChild(t); } t.textContent=msg; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(function(){ t.style.display='none'; }, 2600); }catch(_){} }
  window.ebAllocReset=function(ym){ if(!confirm('Use the computed shares for this month? The manual allocation will be removed.')) return; if(allocSave(ym, null)){ EB.allocEdit=false; EB.draft=null; keepRender(true); toast('กลับไปใช้ค่าคำนวณของ '+ym+' แล้ว'); } };
  window.ebAllocSave=function(ym){
    var box=document.getElementById('eb-alloc'); if(!box) return;
    var rec={by:{}, lf:{}, who:(typeof laBy==='function'?laBy():'')||'', at:new Date().toISOString()};
    box.querySelectorAll('input[data-f][data-s]').forEach(function(i){ var v=+i.value||0; if(v>0){ (rec.by[i.dataset.f]=rec.by[i.dataset.f]||{})[i.dataset.s]=Math.round(v*10)/10; } });
    box.querySelectorAll('input[data-lf]').forEach(function(i){ var v=+i.value||0; if(v>0&&v<=100) rec.lf[i.dataset.lf]=Math.round(v); });
    Object.keys(rec.by).forEach(function(f){ var t=0; Object.keys(rec.by[f]).forEach(function(k){ t+=rec.by[f][k]; }); if(t>100.5){ alert('Route total is over 100% - please fix before saving.'); throw new Error('alloc>100'); } });
    if(allocSave(ym, rec)){ EB.allocEdit=false; EB.draft=null; keepRender(true); toast('บันทึกสัดส่วน '+ym+' แล้ว · กำลังส่งขึ้นระบบ'); }
    else toast('บันทึกไม่ได้ · ต้องมีสิทธิ์แก้ไขส่วน Sales');
  };
  window.ebAllocTot=function(f){ var box=document.getElementById('eb-alloc'); if(!box) return; var t=0;
    EB.draft=EB.draft||{}; box.querySelectorAll('input[data-f],input[data-lf]').forEach(function(i){ EB.draft[i.dataset.lf?('lf|'+i.dataset.lf):(i.dataset.f+'|'+i.dataset.s)]=i.value; });   /* §execAllocDraft · จำค่าที่พิมพ์ไว้ ถึงหน้าถูกวาดใหม่ก็ไม่หาย */
    box.querySelectorAll('input[data-f="'+f+'"]').forEach(function(i){ t+=(+i.value||0); });
    var el=box.querySelector('[data-tot="'+f+'"]'); if(el){ el.textContent=Math.round(t*10)/10+'%'; el.className='eb-atot '+(t>100.5?'over':(t<98.5?'under':'ok')); } };
  function allocEditor(R, SH, fT, salesList){
    var ym=R.mFrom.slice(0,7), fams=Object.keys(fT).sort(function(a,b){ return fT[b]-fT[a]; });
    var sl=salesList.filter(function(x){ return !x.none; });
    var D=EB.draft||{};
    var cur=function(f,sid){ if((f+'|'+sid) in D) return D[f+'|'+sid]; var sh=SH.fam[f]; if(!sh||!sh.tot) return 0; return Math.round((sh.by[sid]||0)*1000/sh.tot)/10; };
    var curLf=function(f){ return ('lf|'+f) in D ? D['lf|'+f] : Math.round(lfOf(ym,f)*100); };
    var h='<div class="eb-card" id="eb-alloc"><h2>กำหนดสัดส่วนเอง · '+E(ym)+' <span class="eb-tag">% ของเป้าแต่ละเส้นทางที่เซลส์แต่ละคนรับ · ช่องว่าง = ใช้ค่าที่คำนวณให้</span></h2>'
      + '<div class="eb-scroll"><table class="eb-tbl eb-al"><thead><tr><th>เส้นทาง</th><th>ที่นั่งที่วาง</th><th>LF เป้า %</th>'+sl.map(function(x){ return '<th><span class="eb-dot" style="background:'+E(x.color)+'"></span>'+E(x.name)+'</th>'; }).join('')+'<th>รวม</th></tr></thead><tbody>'
      + fams.map(function(f){ var fn=(fams.length&&(typeof _BKV2_FAMILIES!=='undefined'))?((_BKV2_FAMILIES.filter(function(x){ return x.id===f; })[0]||{}).name||f):f; var tot=0;
          var cells=sl.map(function(x){ var v=cur(f,x.id); tot+=v; return '<td><input type="number" min="0" max="100" step="1" data-f="'+E(f)+'" data-s="'+E(x.id)+'" value="'+(v||'')+'" placeholder="0" oninput="ebAllocTot(\''+E(f)+'\')"></td>'; }).join('');
          return '<tr><td class="eb-l"><b>'+E(fn)+'</b></td><td>'+num(Math.round(fT[f]/lfOf(ym,f)))+'</td><td><input type="number" min="1" max="100" step="1" data-lf="'+E(f)+'" value="'+E(curLf(f))+'" oninput="ebAllocTot(\''+E(f)+'\')"></td>'+cells+'<td><span class="eb-atot '+(tot>100.5?'over':(tot<98.5?'under':'ok'))+'" data-tot="'+E(f)+'">'+Math.round(tot*10)/10+'%</span></td></tr>'; }).join('')
      + '</tbody></table></div>'
      + '<div class="eb-foot">ค่าเริ่มต้นในช่องคือสัดส่วนที่คำนวณจาก '+E(SH.calc.src||'ยังไม่มีฐาน')+' · รวมไม่ถึง 100% = ส่วนที่ยังไม่มอบหมาย (ขึ้นในการ์ด "ยังไม่มอบหมาย") · เกิน 100% บันทึกไม่ได้</div>'
      + '<div class="eb-btns"><button class="eb-btn p" onclick="ebAllocSave(\''+E(ym)+'\')">บันทึก</button>'+(SH.manual?'<button class="eb-btn" onclick="ebAllocReset(\''+E(ym)+'\')">กลับไปใช้ค่าคำนวณ</button>':'')+'<button class="eb-btn" onclick="ebAllocEdit(false)">ยกเลิก</button></div></div>';
    return h;
  }
  function viewGap(){
    var t0=today(), R=gapRange(), SH=shareUsed(R), CV=curves(), ymG=R.mFrom.slice(0,7);
    /* เป้าเดือน / จองแล้ว · ทั้งเดือน (ที่ผ่านแล้ว = เดินทางจริงตามใบ) */
    var mT=0, mB=0, mTrips=0, past=0, fut=0;
    for(var ds=R.mFrom; ds<=R.mTo; ds=addDays(ds,1)){
      routesOn(ds).forEach(function(rid){ var al=alOf(rid,ds); if(!al||!al.hasAllotment) return;
        var cap=+al.availableCapacity||0, bk=+al.seatsConsumed||0, fid=(fam(rid)||{}).id||rid; mT+=cap*lfOf(ymG,fid); mB+=Math.min(bk,cap); mTrips++;
        if(ds<t0) past+=bk; else fut+=bk; });
    }
    mT=Math.round(mT); var daysLeft=Math.max(1,nDays(t0,R.mTo)), mGap=Math.max(0,mT-mB), need=mGap/daysLeft;
    /* เพซ · pax ที่เข้ามา 7 วันล่าสุด ต่อวัน · เทียบ 4 สัปดาห์ก่อน */
    var s7=salesIn(addDays(t0,-7),addDays(t0,-1)), s28=salesIn(addDays(t0,-35),addDays(t0,-8));
    var pace7=s7.pax/7, pace28=s28.pax/28;
    /* ตาราง เส้นทาง × วัน */
    var days=[]; for(ds=R.from; ds<=R.to; ds=addDays(ds,1)) days.push(ds);
    var rids={}; days.forEach(function(d){ routesOn(d).forEach(function(r){ var al=alOf(r,d); if(al && al.hasAllotment) rids[r]=1; }); });
    var fams={}; Object.keys(rids).forEach(function(rid){ var f=fam(rid)||{id:rid, name:(route(rid)||{}).name||rid, color:'#8b909c'}; (fams[f.id]=fams[f.id]||{f:f, rids:[]}).rids.push(rid); });
    var famL=Object.keys(fams).map(function(k){ return fams[k]; }).sort(function(a,b){ return famIdx(a.f)-famIdx(b.f); });
    var cells={}, risk=[], nRisk=0, nBe=0, gapV=0, horizonGap=0;
    famL.forEach(function(F){ days.forEach(function(d){
      var agg=null; F.rids.forEach(function(rid){ var s=tripState(rid,d); if(!s) return;
        var be=(s.st==='full'||s.st==='g')?0:beOf(rid,d), belowBe=be>0 && s.proj<be;   /* §execPerf · ตามเพซอยู่แล้ว ไม่ต้องคิดจุดคุ้มทุน */
        if(!agg) agg={cap:0,bk:0,free:0,tgt:0,exp:0,proj:0,behind:0,n:0,lead:s.lead,rids:[],worst:'full',belowBe:false,lk:0};
        agg.cap+=s.cap; agg.bk+=s.bk; agg.free+=s.free; agg.tgt+=s.tgt; agg.exp+=s.exp; agg.proj+=s.proj; agg.behind+=s.behind; agg.n++; agg.lk+=s.lk;
        agg.rids.push(Object.assign({be:be, belowBe:belowBe}, s));
        var ord={full:0,g:1,y:2,r:3}; if(ord[s.st]>ord[agg.worst]) agg.worst=s.st; if(belowBe) agg.belowBe=true;
        if(s.st==='r' || belowBe){ nRisk++; if(belowBe) nBe++; }
        if(d>=t0) horizonGap+=s.gap;
      });
      if(agg) cells[F.f.id+'|'+d]=agg;
    }); });
    var rpp=(function(){ var a=agg(addDays(t0,-30), addDays(t0,-1)); return a.pax?a.rev/a.pax:0; })();
    var h='<div class="eb-grid eb-kpis">'
      + kpi('เป้าเดือนนี้ (จากเรือที่วาง)', num(mT)+'<small>pax</small>', 'ที่นั่งที่วาง '+num(Math.round(mT/EB_LF_TARGET))+' × LF เป้า '+Math.round(EB_LF_TARGET*100)+'% · '+num(mTrips)+' เที่ยว')
      + kpi('จองแล้ว (เดินทาง + on the books)', num(mB)+'<small>'+pct(mB,mT)+'%</small>', 'เดินทางแล้ว '+num(past)+' · จองล่วงหน้า '+num(fut), '', pct(mB,mT))
      + kpi('ช่องว่างที่ต้องหา', num(mGap)+'<small>pax</small>', 'เหลือ '+daysLeft+' วัน · <b>ต้องได้วันละ '+num(Math.ceil(need))+'</b> · เพซ 7 วันล่าสุด '+pace7.toFixed(0)+'/วัน', mGap>0&&pace7<need?'warn':'')
      + kpi('เพซ vs ฐาน', chg(pace7, pace28), 'ใบที่เข้ามาต่อวัน 7 วันล่าสุด เทียบ 4 สัปดาห์ก่อน', pace28>0&&pace7<pace28*0.9?'bad':'')
      + kpi('เที่ยวที่เสี่ยงไม่เต็ม', num(nRisk)+'<small>เที่ยว</small>', 'ใน'+E(R.lbl)+' · ต่ำกว่าจุดคุ้มทุน <b>'+num(nBe)+'</b>'+(nBe?' · ต้องตัดสินใจก่อน 3 วัน':''), nRisk?'bad':'')
      + kpi('ถ้าเติมได้ครบ', '+'+baht(mGap*rpp), 'ช่องว่าง × รายได้/หัว 30 วันล่าสุด ฿'+num(rpp))
      + '</div>';
    /* ตาราง */
    var dowS=['อา','จ','อ','พ','พฤ','ศ','ส'];
    var tbl='<table class="eb-gap"><thead><tr><th></th>'+days.map(function(d){ var w=dt(d).getDay(); return '<th class="'+(w===0||w===6?'we':'')+'">'+dowS[w]+' '+dt(d).getDate()+'</th>'; }).join('')+'<th class="r">'+E(R.lbl)+'</th></tr></thead><tbody>'
      + famL.map(function(F){ var tF=0, tB=0, tFree=0;
          var cs=days.map(function(d){ var c=cells[F.f.id+'|'+d]; if(!c) return '<td class="c off">—</td>';
            tF+=c.tgt; tB+=c.bk; tFree+=c.free;
            var tip=E(F.f.name+' · '+thDow(d)+' '+thD(d))+'\n'+c.n+' เที่ยว · จอง '+c.bk+'/'+c.cap+' · ว่าง '+c.free+(c.lk?' · ล็อก '+c.lk:'')+'\nเป้า '+c.tgt+' · ควรจองแล้ว '+Math.round(c.exp)+' · คาดสุดท้าย '+Math.round(c.proj)
              + c.rids.map(function(s){ return '\n  '+rName(s.rid).v+' '+s.bk+'/'+s.cap+(s.be?' · คุ้มทุน '+s.be:''); }).join('');
            return '<td class="c '+c.worst+(c.belowBe?' bk':'')+'" title="'+tip+'">'+num(c.free)+'<small>'+(c.worst==='full'?'เต็ม':(c.behind?'−'+num(c.behind):'ok'))+'</small></td>'; }).join('');
          var curveN=(CV.byR[F.rids[0]]||{}).n;
          return '<tr><td class="rn"><span class="eb-dot" style="background:'+E(F.f.color)+'"></span>'+E(F.f.name)+'<small>'+F.rids.length+' รอบ/วัน · curve จาก '+(curveN?curveN+' เที่ยว':(CV.def?'ค่าตั้งต้น':'ทั้งบริษัท '+CV.all.n+' เที่ยว'))+'</small></td>'+cs
            +'<td class="tot">'+num(Math.max(0,tF-tB))+'<small>ว่าง '+num(tFree)+' · '+pct(tB,tF)+'% ของเป้า</small></td></tr>'; }).join('')
      + (famL.length?'':'<tr><td colspan="'+(days.length+2)+'" class="eb-none">ยังไม่ได้วางเรือในช่วงนี้</td></tr>')
      + '</tbody></table>'
      + '<div class="eb-lgd"><i style="background:#DCE9F5"></i>เต็ม / ถึงเป้า <i style="background:#E6F4EC"></i>ตามเพซ <i style="background:#FDF1DC"></i>ช้ากว่าเพซ (ตัวเลขล่าง = ขาดกี่ที่จากที่ควรจองแล้ว) <i style="background:#FDE8E6"></i>คาดว่าไม่ถึง 80% ของเป้า <i style="box-shadow:inset 0 0 0 2px #B42318;background:#fff"></i>คาดต่ำกว่าจุดคุ้มทุน'
      + '<span style="margin-left:auto">ตัวเลขบน = ที่ว่าง · เพซคิดจาก booking curve ของเส้นทางนั้น</span></div>';
    h+='<div class="eb-sec">ช่องว่าง '+E(R.lbl)+' · เส้นทาง × วัน</div><div class="eb-card eb-scroll"><h2>เส้นทาง × วัน <span class="eb-tag">ชี้เมาส์ดูรายรอบ · เป้า · ควรจองแล้ว · คาดสุดท้าย</span>'+src('ที่มา: Boat Operation · Booking')+'</h2>'+tbl+'</div>';

    /* การ์ดเซลส์ · เป้า/ช่องว่างแบ่งตามสัดส่วน */
    var fT={}, fB={};
    for(ds=R.mFrom; ds<=R.mTo; ds=addDays(ds,1)){ routesOn(ds).forEach(function(rid){ var al=alOf(rid,ds); if(!al||!al.hasAllotment) return; var f=(fam(rid)||{}).id||rid;
      fT[f]=(fT[f]||0)+(+al.availableCapacity||0)*lfOf(ymG,f); fB[f]=(fB[f]||0)+Math.min(+al.seatsConsumed||0,+al.availableCapacity||0); }); }
    var famName=function(f){ var x=(typeof _BKV2_FAMILIES!=='undefined')?_BKV2_FAMILIES.filter(function(y){ return y.id===f; })[0]:null; return (x&&x.name)||((fams[f]||{}).f||{}).name||(route(f)||{}).name||f; };
    var SL={}; var ensure=function(sid){ var so=salesOf(sid==='__none'?'':sid); if(sid==='__none' && SH.manual) so=Object.assign({}, so, {name:'ยังไม่มอบหมาย'}); return SL[sid]=SL[sid]||{s:so, tgt:0, bk:0, own:0, pace:0, ag:{}, calls:[], byF:{}, paceF:{}}; };
    /* §execAlloc · เป้า/จองแล้ว แยกเส้นทางต่อเซลส์ · bk = ตามสัดส่วน (ที่นั่งของเส้นทางที่ถือว่าเป็นของเขา) · own = ใบของเขาเองที่เดินทางในเดือนนี้ */
    Object.keys(fT).forEach(function(f){ var sh=SH.fam[f]; if(!sh||!sh.tot){ var o=ensure('__none'); o.tgt+=fT[f]; o.bk+=fB[f]||0; o.byF[f]={tgt:fT[f], bk:fB[f]||0, w:1, own:0}; return; }
      Object.keys(sh.by).forEach(function(sid){ var w=sh.by[sid]/sh.tot, o=ensure(sid); o.tgt+=fT[f]*w; o.bk+=(fB[f]||0)*w; o.byF[f]={tgt:fT[f]*w, bk:(fB[f]||0)*w, w:w, own:0}; }); });
    eachTrip(R.mFrom, R.mTo, function(b,t){ var sid=salesOf(sidOf(b)).id, f=(fam(t.routeId)||{}).id||t.routeId, o=SL[sid]; if(!o) return; o.own+=pax(t); if(o.byF[f]) o.byF[f].own+=pax(t); });
    s7.list.forEach(function(b){ var o=ensure(salesOf(sidOf(b)).id); (b.trips||[]).forEach(function(t){ var p=pax(t)/7, f=(fam(t.routeId)||{}).id||t.routeId; o.pace+=p; if(t.date>=R.mFrom && t.date<=R.mTo) o.paceF[f]=(o.paceF[f]||0)+p; }); });
    /* รายชื่อโทร */
    var s14=salesIn(addDays(t0,-14), addDays(t0,-1)), s60=salesIn(addDays(t0,-60), addDays(t0,-15)), last={}, agSid={}, agRoutes={}, nm={}, v60={};
    var mark=function(b, bucket){ var k=agKey(b); if(k==='__b2c'||k==='__none') return; var d=bkDay(b); if(!last[k]||d>last[k]) last[k]=d; agSid[k]=salesOf(sidOf(b)).id; nm[k]=agentName(b);
      (b.trips||[]).forEach(function(t){ var f=(fam(t.routeId)||{}).id||t.routeId; (agRoutes[k]=agRoutes[k]||{})[f]=((agRoutes[k]||{})[f]||0)+pax(t); if(bucket==='60') v60[k]=(v60[k]||0)+pax(t); }); };
    s14.list.forEach(function(b){ mark(b,'14'); }); s60.list.forEach(function(b){ mark(b,'60'); });
    var port={}; (typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).forEach(function(a){ if(a&&a.sales&&a.active!==false&&a.status!=='inactive') port[a.sales]=(port[a.sales]||0)+1; });
    var sent14={}; s14.list.forEach(function(b){ var k=agKey(b); if(k!=='__b2c'&&k!=='__none') (sent14[salesOf(sidOf(b)).id]=sent14[salesOf(sidOf(b)).id]||{})[k]=1; });
    var shortFams={}; famL.forEach(function(F){ days.forEach(function(d){ var c=cells[F.f.id+'|'+d]; if(c && (c.worst==='y'||c.worst==='r') && c.lead<=7) (shortFams[F.f.id]=shortFams[F.f.id]||[]).push(d); }); });
    Object.keys(agSid).forEach(function(k){ var o=SL[agSid[k]]; if(!o) return; var gone=nDays(last[k],t0)-1;
      var topF=Object.keys(agRoutes[k]||{}).sort(function(a,b){ return agRoutes[k][b]-agRoutes[k][a]; })[0];
      if(gone>=7 && gone<=60 && (v60[k]||0)>=3) o.calls.push({k:k, name:nm[k], why:'เงียบ '+gone+' วัน', cls:'q', sub:'ส่ง '+num(v60[k])+' pax ใน 60 วันก่อน'+(topF?' · '+E(famName(topF)):''), w:2+Math.min(3,(v60[k]||0)/20)});
      else if(gone<7){ var rs=Object.keys(agRoutes[k]||{}).filter(function(f){ return shortFams[f]; }).sort(function(a,b){ return agRoutes[k][b]-agRoutes[k][a]; })[0];
        if(rs){ var d=shortFams[rs][0]; o.calls.push({k:k, name:nm[k], why:'ว่าง '+dowS[dt(d).getDay()]+' '+dt(d).getDate(), cls:'o', sub:'เคยส่ง '+E((fams[rs]||{}).f?fams[rs].f.name:rs)+' · '+num(agRoutes[k][rs])+' pax', w:1}); } }
    });
    /* ล็อกที่ยังไม่ใช้และใกล้วัน */
    try{ (typeof SB_SEAT_LOCKS!=='undefined'?SB_SEAT_LOCKS:[]).forEach(function(l){ if(!l||l.status!=='active'||!l.agentId||bkV2LockSpansDays(l)) return; if(!l.date||l.date<t0||l.date>addDays(t0,7)) return;
      var rem=bkV2LockHeldRemaining(l,l.date); if(rem<=0) return; var a=sbGetAgent(l.agentId); if(!a) return; var o=SL[salesOf(a.sales).id]; if(!o) return;
      o.calls.push({k:l.agentId, name:a.name||l.agentId, why:'ล็อก '+rem+' ที่ยังไม่ใช้', cls:'l', sub:E(rName(l.routeId).f)+' · '+thD(l.date), w:3}); }); }catch(_){}
    var sl=Object.keys(SL).map(function(k){ return SL[k]; }).filter(function(o){ return o.tgt>0||o.pace>0||o.calls.length; }).sort(function(a,b){ return (a.s.none-b.s.none)||(b.tgt-a.tgt); });
    var allSales=Object.keys(SL).map(function(k){ return SL[k].s; }); (typeof sbSalesActive==='function'?sbSalesActive():[]).forEach(function(x){ if(!allSales.some(function(y){ return y.id===x.id; })) allSales.push(salesOf(x.id)); });
    h+='<div class="eb-sec">ช่องว่างแบ่งให้เซลส์ · '+(SH.manual?'สัดส่วนที่ผู้บริหารกำหนด ('+E(SH.src)+')':'ตามสัดส่วนที่แต่ละคนขายได้ต่อเส้นทาง ('+E(SH.src||'ยังไม่มีฐาน')+')')
      + (canAlloc()&&!EB.allocEdit?' <button class="eb-btn s" onclick="ebAllocEdit(true)">'+(SH.manual?'แก้สัดส่วน':'กำหนดสัดส่วนเอง')+'</button>':'')+'</div>'
      + (EB.allocEdit&&canAlloc()?allocEditor(R, SH, fT, allSales):'')
      + '<div class="eb-mv eb-sl">'
      + (sl.length?sl.map(function(o){ var gap=Math.max(0,o.tgt-o.bk), nd=gap/daysLeft, pc=pct(o.bk,o.tgt), should=pct(nDays(R.mFrom,t0)-1,nDays(R.mFrom,R.mTo));
          var act=Object.keys(sent14[o.s.id]||{}).length, all=port[o.s.id]||0;
          var calls=o.calls.sort(function(a,b){ return b.w-a.w; }); var seen={}; calls=calls.filter(function(c){ var k=c.k+'|'+c.cls; if(seen[k]) return false; seen[k]=1; return true; }).slice(0,4);
          return '<div class="eb-card"><h2><span class="eb-dot" style="background:'+E(o.s.color)+'"></span>'+E(o.s.name)+'</h2>'
            + '<div class="eb-q"><div><div class="l">เป้าเดือน</div><div class="v">'+num(o.tgt)+'</div></div><div><div class="l">ช่องว่าง</div><div class="v" style="color:'+(gap<=0?'var(--eb-good)':(nd>o.pace*1.3?'var(--eb-bad)':'var(--eb-warn)'))+'">'+num(gap)+'</div></div>'
            + '<div><div class="l">ต้องได้/วัน</div><div class="v">'+num(Math.ceil(nd))+'<small> (เพซ '+o.pace.toFixed(0)+')</small></div></div><div><div class="l">Activation 14 วัน</div><div class="v">'+num(act)+'<small>/'+num(all)+'</small></div></div></div>'
            + '<div class="eb-prog"><i style="width:'+Math.min(100,pc)+'%;background:'+E(o.s.color)+'"></i><s style="left:'+should+'%"></s></div><div class="eb-foot" style="margin:0 0 6px">'+pc+'% ของเป้า · เส้นดำ = ควรถึงแล้ว ณ วันนี้ ('+should+'%)'+(o.pace>0&&nd>o.pace*1.3?' · <span class="eb-dn">เพซไม่ทัน</span>':'')+'</div>'
            /* §execAlloc · ช่องว่างแยกเส้นทาง · บอกว่าต้องไปขายอะไร */
            + (function(){ var L=Object.keys(o.byF).map(function(f){ var x=o.byF[f]; return {f:f, gap:Math.max(0,x.tgt-x.bk), tgt:x.tgt, w:x.w, nd:Math.max(0,x.tgt-x.bk)/daysLeft}; }).filter(function(x){ return x.tgt>0; }).sort(function(a,b){ return b.gap-a.gap; });
                if(!L.length) return ''; return '<div class="eb-rf">'+L.map(function(x){ return '<span class="'+(x.gap<=0?'ok':'')+'" title="'+E(famName(x.f))+' · เป้า '+num(x.tgt)+' · รับ '+Math.round(x.w*100)+'% ของเส้นทาง · ต้องได้วันละ '+num(Math.ceil(x.nd))+'"><b>'+E(famName(x.f))+'</b> '+(x.gap<=0?'✓':num(x.gap))+'<small>'+Math.round(x.w*100)+'%</small></span>'; }).join('')+'</div>'; })()
            + (calls.length?'<ul class="eb-calls">'+calls.map(function(c){ return '<li><div><b>'+E(c.name)+'</b><span>'+c.sub+'</span></div><span class="eb-why '+c.cls+'">'+E(c.why)+'</span></li>'; }).join('')+'</ul>':'<div class="eb-foot">ไม่มีรายชื่อที่ต้องโทรวันนี้</div>')
            + '</div>'; }).join('')
        :'<div class="eb-card eb-none">ยังไม่มีเซลส์ที่ผูกกับใบจอง</div>')+'</div>';

    /* §execAlloc · ความคืบหน้าเทียบเป้า · ต่อเซลส์ แยกเส้นทาง */
    var elapsed=Math.max(1,nDays(R.mFrom,t0)), shouldPc=pct(elapsed-1, nDays(R.mFrom,R.mTo));
    var wk=[]; for(var w=4; w>=0; w--){ var a=addDays(t0,-7*w-6), bb=addDays(t0,-7*w); wk.push({from:a, to:bb, lbl:thD(a).split(' ')[0]+'–'+thD(bb)}); }
    var wkPax={}; wk.forEach(function(W,i){ eachMade(W.from, W.to, function(b){ var sid=salesOf(sidOf(b)).id; (b.trips||[]).forEach(function(t){ if(t.date<R.mFrom||t.date>R.mTo) return; var r=route(t.routeId); if(!pierOk(r)) return; var f=(fam(t.routeId)||{}).id||t.routeId; var key=sid+'|'+f; (wkPax[key]=wkPax[key]||[0,0,0,0,0])[i]+=pax(t); (wkPax[sid+'|*']=wkPax[sid+'|*']||[0,0,0,0,0])[i]+=pax(t); }); }); });
    var prow=function(name, color, tgt, bk, pace, weeks, sub){
      var gap=Math.max(0,tgt-bk), nd=gap/daysLeft, fc=bk+pace*daysLeft, pc=pct(bk,tgt), mx=Math.max.apply(null,[1].concat(weeks));
      var st = tgt<=0?'' : (gap<=0?'<span class="eb-st g">✓ ถึงเป้า</span>':(pace>=nd?'<span class="eb-st g">ตามแผน</span>':(fc>=tgt*0.9?'<span class="eb-st w">▲ ใกล้เคียง</span>':'<span class="eb-st b">● ไม่ทัน</span>')));
      return '<tr'+(sub?' class="eb-sub"':'')+'><td class="eb-l">'+(sub?'<span class="eb-mut">└</span> ':'<span class="eb-dot" style="background:'+E(color)+'"></span>')+'<b>'+E(name)+'</b></td><td>'+num(tgt)+'</td><td><b>'+num(bk)+'</b></td>'
        + '<td><div class="eb-pct"><span><i style="width:'+Math.min(100,pc)+'%;background:'+E(color)+'"></i></span>'+pc+'%</div></td><td>'+(gap?num(gap):'<span class="eb-mut">0</span>')+'</td><td>'+(gap?num(Math.ceil(nd)):'<span class="eb-mut">—</span>')+'</td><td>'+pace.toFixed(1)+'</td>'
        + '<td><div class="eb-spark eb-wk">'+weeks.map(function(v,i){ return '<i title="'+E(wk[i].lbl)+' · '+num(v)+' pax" style="height:'+Math.max(2,Math.round(v*100/mx))+'%;background:'+(i===4?E(color):'var(--eb-s2)')+'"></i>'; }).join('')+'</div></td>'
        + '<td>'+num(Math.round(fc))+'<small class="eb-mut"> ('+pct(fc,tgt)+'%)</small></td><td>'+st+'</td></tr>'; };
    var prog=sl.filter(function(o){ return o.tgt>0; }).map(function(o){
      var rows=prow(o.s.name, o.s.color, o.tgt, o.bk, o.pace, wkPax[o.s.id+'|*']||[0,0,0,0,0], false);
      Object.keys(o.byF).sort(function(a,b){ return o.byF[b].tgt-o.byF[a].tgt; }).forEach(function(f){ var x=o.byF[f]; if(x.tgt<=0) return; rows+=prow(famName(f), o.s.color, x.tgt, x.bk, o.paceF[f]||0, wkPax[o.s.id+'|'+f]||[0,0,0,0,0], true); });
      return rows; }).join('');
    h+='<div class="eb-sec">ความคืบหน้าเทียบเป้า · '+E(ymG)+' · วันที่ '+elapsed+'/'+nDays(R.mFrom,R.mTo)+' ของเดือน (ควรถึง '+shouldPc+'%)</div>'
      + '<div class="eb-card eb-scroll"><h2>เซลส์ × เส้นทาง <span class="eb-tag">จองแล้ว = ที่นั่งของเดือนนี้ตามสัดส่วนที่รับ · เข้ามา/วัน = ใบของเขาที่เดินทางเดือนนี้ 7 วันล่าสุด · คาดสิ้นเดือน = จองแล้ว + เข้ามา/วัน × วันที่เหลือ</span>'+src('ที่มา: Booking · Boat Operation')+'</h2>'
      + '<table class="eb-tbl eb-pg"><thead><tr><th>เซลส์ / เส้นทาง</th><th>เป้า</th><th>จองแล้ว</th><th>% ของเป้า</th><th>ขาด</th><th>ต้องได้/วัน</th><th>เข้ามา/วัน</th><th>5 สัปดาห์</th><th>คาดสิ้นเดือน</th><th>สถานะ</th></tr></thead><tbody>'
      + (prog||'<tr><td colspan="10" class="eb-none">ยังไม่มีเป้า</td></tr>')+'</tbody></table>'
      + '<div class="eb-foot">แผน Monthly = เป้าและสัดส่วน · Weekly = แท่ง 5 สัปดาห์ต้องสูงขึ้นเมื่อ "ต้องได้/วัน" สูงกว่า "เข้ามา/วัน" · Daily = ขาดต้องลดลงทุกวัน · สถานะคิดจากเพซ 7 วันล่าสุดไปถึงสิ้นเดือน</div></div>';

    /* ตัดสินใจสัปดาห์นี้ */
    var dec=[]; famL.forEach(function(F){ days.forEach(function(d){ var c=cells[F.f.id+'|'+d]; if(!c||c.lead>7) return; c.rids.forEach(function(s){ if(s.st==='r'||s.belowBe||(s.st==='y'&&s.lead<=3)) dec.push(Object.assign({f:F.f}, s)); }); }); });
    dec.sort(function(a,b){ return a.ds===b.ds ? (b.behind-a.behind) : (a.ds<b.ds?-1:1); });
    var sug=function(s, sib){
      if(s.be && s.proj>=s.be) return ['รอดู', 'คาดสุดท้าย '+Math.round(s.proj)+' ≥ คุ้มทุน '+s.be];
      if(sib) return ['รวมกับ '+dowS[dt(sib.ds).getDay()]+' '+dt(sib.ds).getDate(), 'อีกเที่ยวว่าง '+sib.free+' ที่ รับได้ทั้ง '+s.bk+' คน'];
      if(1-s.c>=0.35) return ['ขายเพิ่ม', 'ตลาดนี้ยังจองช้าได้ '+Math.round((1-s.c)*100)+'% ของยอด'];
      return ['โปร B2C', 'ตลาดหลักจองล่วงหน้าแล้ว เหลือขายหน้างาน'];
    };
    h+='<div class="eb-sec">ตัดสินใจสัปดาห์นี้ · เที่ยวที่เพซไม่ทัน เรียงตามวันออก</div><div class="eb-grid eb-r3">'
      + '<div class="eb-card"><h2>ขายเพิ่ม · โปรโมชั่น · หรือลดเรือ <span class="eb-tag">เส้นตาย 3 วันก่อนออก · ระบบเสนอ ผู้บริหารตัดสิน</span>'+src('ที่มา: ต้นทุน &amp; จุดคุ้มทุน')+'</h2>'
      + (dec.length?'<ul class="eb-dec">'+dec.slice(0,8).map(function(s){ var n=rName(s.rid);
          var sib=null; [-1,1].forEach(function(k){ var d2=addDays(s.ds,k); if(d2<t0||sib) return; var o=tripState(s.rid,d2); if(o && o.free>=s.bk && o.st!=='full') sib=o; });
          var sg=sug(s,sib); var opts=['ขายเพิ่ม','โปร B2C',(sib?'รวมกับ '+dowS[dt(sib.ds).getDay()]+' '+dt(sib.ds).getDate():'ลดเรือ'),'รอดู'];
          return '<li><div class="d1"><b>'+E(n.f+(n.v?' · '+n.v:''))+' · '+E(dowS[dt(s.ds).getDay()]+' '+thD(s.ds))+'</b><span>ออกใน '+s.lead+' วัน'+(s.lead<=3?' · <span class="eb-dn">ถึงเส้นตาย</span>':'')+'</span></div>'
            + '<div class="d2">จอง <b>'+s.bk+'/'+s.cap+'</b>'+(s.be?' · คุ้มทุน '+s.be+' · ขาด <b>'+Math.max(0,s.be-s.bk)+'</b> ถึงคุ้มทุน':' · เป้า '+s.tgt)+' · คาดเพิ่มอีก ~'+Math.round(Math.max(0,s.proj-s.bk))+' · '+E(sg[1])+'</div>'
            + '<span class="eb-opt">'+opts.map(function(x){ return '<b class="'+(x===sg[0]?'on':'')+'">'+E(x)+'</b>'; }).join('')+'</span></li>'; }).join('')+'</ul>'
          + '<div class="eb-foot">ตัวเลือกที่ไฮไลต์เป็นข้อเสนอของระบบจาก booking curve และจุดคุ้มทุน · ยังไม่บันทึกการตัดสินใจ (แสดงอย่างเดียว)</div>'
        : '<div class="eb-none">ไม่มีเที่ยวที่เพซไม่ทันใน 7 วันข้างหน้า</div>')+'</div>'
      + '<div class="eb-card"><h2>Lead time ต่อตลาด <span class="eb-tag">จองก่อนเดินทางกี่วัน · 90 วันล่าสุด</span>'+src('ที่มา: Booking (เวลาที่ใบเข้าระบบ)')+'</h2>'+leadTable()+'</div></div>';
    return h;
  }
  function leadTable(){
    var t0=today(), from=addDays(t0,-90), M={}, tot=0, within7=0, all=0;
    (SB_BOOKINGS||[]).forEach(function(b){ if(!isLive(b)) return; var d=bkDay(b); if(!d) return;
      (b.trips||[]).forEach(function(t){ if(!t||!t.date||t.date<from) return; var lead=Math.max(0,nDays(d,t.date)-1), p=pax(t)||1;
        var m=(typeof laIsB2C==='function'&&laIsB2C(b))?{id:'b2c',name:'B2C ออนไลน์'}:((typeof drMarket==='function')?(drMarket(b)||{}):{}); var k=m.id||'?';
        var X=M[k]=M[k]||{name:m.name||'ไม่ระบุตลาด', ls:[], pax:0}; X.ls.push(lead); X.pax+=p; tot+=p; all+=p; if(lead<=7) within7+=p; }); });
    var rows=Object.keys(M).map(function(k){ var ls=M[k].ls.sort(function(a,b){ return a-b; }), n=ls.length; return {name:M[k].name, pax:M[k].pax, n:n, med:ls[Math.floor(n/2)], p25:ls[Math.floor(n/4)], p75:ls[Math.floor(3*n/4)]}; })
      .filter(function(r){ return r.n>=5; }).sort(function(a,b){ return b.pax-a.pax; }).slice(0,8);
    if(!rows.length) return '<div class="eb-none">ยังมีข้อมูลไม่พอ</div>';
    var mx=Math.max.apply(null,rows.map(function(r){ return r.med; }).concat([1]));
    return '<table class="eb-tbl eb-l2"><thead><tr><th>#</th><th>ตลาด</th><th>มัธยฐาน</th><th>ครึ่งกลาง</th><th>ควรเตือนที่</th><th>ทริป</th></tr></thead><tbody>'
      + rows.map(function(r,i){ return '<tr><td>'+(i+1)+'</td><td class="eb-l"><b>'+E(r.name)+'</b></td><td><i class="eb-lb" style="width:'+Math.max(3,Math.round(r.med*80/mx))+'px"></i>'+r.med+' วัน</td><td>'+r.p25+'–'+r.p75+'</td><td><b>'+Math.max(2,Math.round(r.p25*1.5))+' วัน</b></td><td>'+num(r.n)+'</td></tr>'; }).join('')
      + '</tbody></table><div class="eb-foot">'+(all?pct(within7,all):0)+'% ของ pax จองภายใน 7 วันก่อนออก · ควรเตือน = เริ่มกังวลเมื่อเหลือวันน้อยกว่านี้ (1.5 × จุดที่ลูกค้า 25% แรกจองแล้ว)</div>';
  }

  /* ── วาด ───────────────────────────────────────────────────────────── */
  function seg(key, items){ return '<span class="eb-seg">'+items.map(function(it){ return '<button class="'+(EB[key]===it[0]?'on':'')+'" onclick="ebSet(\''+key+'\',\''+it[0]+'\')">'+it[1]+'</button>'; }).join('')+'</span>'; }
  function render(){
    var w=document.getElementById('eb-wrap'); if(!w) return;
    ensureCss();
    var body='';
    try{ body = EB.tab==='sales' ? viewSales() : (EB.tab==='gap' ? viewGap() : (EB.per==='today' ? viewToday() : viewPeriod())); }
    catch(e){ console.error('[execBoard] render', e); body='<div class="eb-card eb-none">Render error · '+E(e&&e.message)+'</div>'; }
    var t0=today();
    w.innerHTML='<div class="eb">'
      + '<div class="eb-top"><h1>Executive Board<small>OVERVIEW · รายได้และยอดจอง</small></h1>'
      + seg('tab',[['rev','ภาพรวมรายได้'],['sales','Sales Performance'],['gap','Gap to Target']])
      + (EB.tab==='sales'
          ? (seg('sp',[['week','สัปดาห์'],['month','เดือน']])
             + '<span class="eb-nav"><button onclick="ebSet(\'off\','+((+EB.off||0)-1)+')" title="ช่วงก่อนหน้า">\u2039</button><b>'+E(spLabel(spRange(EB.sp||'week',+EB.off||0),EB.sp||'week'))+'</b>'
             + '<button onclick="ebSet(\'off\','+Math.min(0,(+EB.off||0)+1)+')"'+((+EB.off||0)>=0?' disabled':'')+' title="ช่วงถัดไป">\u203a</button></span>')
          : EB.tab==='gap'
          ? (seg('gp',[['h',EB_HORIZON+' วันข้างหน้า'],['month','เดือนนี้'],['next','เดือนหน้า']])
             + seg('pier',[['','ทุกท่า'],['tublamu','Tub Lamu'],['panwa','Panwa'],['ranong','Ranong']]))
          : (seg('per',[['today','วันนี้'],['month','เดือนนี้'],['quarter','ไตรมาส'],['year','ปีนี้']])
             + seg('pier',[['','ทุกท่า'],['tublamu','Tub Lamu'],['panwa','Panwa'],['ranong','Ranong']])))
      + '<span class="eb-sp"></span><span class="eb-upd">'+E(thDow(t0))+' '+E(thD(t0))+' '+t0.slice(0,4)+' · อัปเดต '+hhmm(Date.now())+' · วาดใหม่ทุก 1 นาที</span></div>'
      + body + '</div>';
  }
  var _pending=false;
  function keepRender(sync){
    var m=document.querySelector('.main'), y=m?m.scrollTop:0, wy=window.scrollY;
    var go=function(){ _pending=false; render(); try{ if(m) m.scrollTop=y; window.scrollTo(window.scrollX||0, wy); }catch(_){} };
    if(sync){ go(); return; }
    if(_pending) return; _pending=true;
    /* §execPerf · บอกว่ากำลังคิดก่อน แล้วค่อยคำนวณในเฟรมถัดไป · ปุ่มจึงตอบทันทีแม้ข้อมูลใหญ่ */
    try{ var w=document.getElementById('eb-wrap'); if(w && !document.getElementById('eb-busy')){ var b=document.createElement('div'); b.id='eb-busy'; b.textContent='กำลังคำนวณ…'; w.appendChild(b); } }catch(_){}
    setTimeout(go, 20);
  }
  window.ebRender = render;
  function ebApply(k, v){ if(k==='off') v=Math.min(0,+v||0); if(k==='sp' || k==='tab') EB.off=0; EB[k]=v; }
  window.ebSet = function(k, v){ ebApply(k, v); keepRender(); };
  window.ebSetNow = function(k, v){ ebApply(k, v); keepRender(true); };   /* ใช้ในเทส · วาดทันที */
  /* Live · วาดใหม่ทุก 60 วินาที เฉพาะตอนหน้านี้เปิดอยู่และแท็บไม่ได้ถูกซ่อน */
  if(!window.__ebTick){
    window.__ebTick = setInterval(function(){
      try{ var v=document.getElementById('view-execboard'); if(!v || !v.classList.contains('active') || document.hidden) return;
        /* §execAllocDraft · owner "แก้สัดส่วนแล้วมันไม่บันทึก" · ตัวจับเวลาวาดใหม่ทุกนาทีทับช่องที่กำลังพิมพ์อยู่ · ระหว่างแก้ไม่วาดใหม่ */
        if(EB.allocEdit) return; var ae=document.activeElement; if(ae && ae.closest && ae.closest('#eb-wrap') && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return;
        keepRender(true); }catch(_){}
    }, 60000);
  window.ebTick=function(){ try{ if(EB.allocEdit) return false; keepRender(true); return true; }catch(_){ return false; } };
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
      '#eb-toast{position:fixed;bottom:56px;left:50%;transform:translateX(-50%);z-index:100000;background:#0F7B4F;color:#fff;font-size:12.5px;font-weight:600;padding:8px 16px;border-radius:9px;box-shadow:0 4px 14px rgba(15,27,61,.25);display:none}',
      '#eb-busy{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:50;background:var(--eb-ink);color:#fff;font-size:12px;font-weight:600;padding:6px 14px;border-radius:9px;box-shadow:0 4px 14px rgba(15,27,61,.25)}',
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
      '.eb-mvl .vv{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}',
      /* §execGap */
      '.eb-gap{border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}',
      '.eb-gap th{text-align:center;padding:0 2px 5px;font-weight:600;font-size:10.5px;color:var(--eb-mut)}.eb-gap th.we{color:var(--eb-ink2)}.eb-gap th.r{text-align:right}',
      '.eb-gap td{padding:3px 2px;border:0}',
      '.eb-gap td.c{min-width:44px;height:32px;border-radius:6px;text-align:center;font-size:11px;font-weight:700;color:var(--eb-ink);padding:0 2px;cursor:default}',
      '.eb-gap td.c small{display:block;font-size:9px;font-weight:600;color:var(--eb-ink2);line-height:1.1}',
      '.eb-gap td.c.g{background:#E6F4EC}.eb-gap td.c.y{background:#FDF1DC}.eb-gap td.c.r{background:#FDE8E6;color:var(--eb-bad)}.eb-gap td.c.r small{color:var(--eb-bad)}',
      '.eb-gap td.c.full{background:#DCE9F5;color:var(--eb-ink2)}.eb-gap td.c.off{background:#F6F8FB;color:#C5CAD4}',
      '.eb-gap td.c.bk{box-shadow:inset 0 0 0 2px #B42318}',
      '.eb-gap .rn{padding-right:12px;font-weight:600;font-size:12px;white-space:nowrap;text-align:left}.eb-gap .rn small{display:block;font-size:10px;color:var(--eb-mut);font-weight:500}',
      '.eb-gap td.tot{text-align:right;padding-left:10px;font-weight:700;white-space:nowrap}.eb-gap td.tot small{display:block;font-weight:500;color:var(--eb-mut);font-size:10px}',
      '.eb-sl{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}',
      '.eb-q{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0 8px}',
      '.eb-q>div{background:#F6F8FB;border-radius:8px;padding:6px 9px}.eb-q .l{font-size:10.5px;color:var(--eb-ink2);font-weight:600}.eb-q .v{font-size:17px;font-weight:700}.eb-q .v small{font-size:10.5px;color:var(--eb-mut);font-weight:600}',
      '.eb-prog{height:7px;background:#EDF0F4;border-radius:4px;overflow:hidden;position:relative;margin:4px 0 2px}.eb-prog i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}.eb-prog s{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--eb-ink)}',
      '.eb-calls{list-style:none;margin:6px 0 0;padding:0}.eb-calls li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;padding:5px 0;border-top:1px solid var(--eb-line);font-size:11.5px;align-items:center}.eb-calls li:first-child{border-top:0}',
      '.eb-calls b{display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.eb-calls span{color:var(--eb-mut);font-size:10.5px}',
      '.eb-why{font-size:10px;font-weight:700;border-radius:5px;padding:1px 6px;white-space:nowrap;color:inherit}',
      '.eb-why.q{background:var(--eb-warn-l);color:var(--eb-warn)}.eb-why.r{background:var(--eb-bad-l);color:var(--eb-bad)}.eb-why.l{background:#EFEAFB;color:#5B289A}.eb-why.o{background:#EAF3FB;color:var(--eb-blue-d)}',
      '.eb-dec{list-style:none;margin:0;padding:0}.eb-dec li{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-top:1px solid var(--eb-line)}.eb-dec li:first-child{border-top:0;padding-top:2px}',
      '.eb-dec .d1 b{display:block;font-size:12.5px}.eb-dec .d1 span{font-size:11px;color:var(--eb-mut)}.eb-dec .d2{font-size:11.5px;color:var(--eb-ink2)}.eb-dec .d2 b{color:var(--eb-ink)}',
      '.eb-opt{display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.eb-opt b{font-size:11px;font-weight:700;border-radius:6px;padding:3px 8px;background:#F1F3F7;color:var(--eb-ink2);white-space:nowrap}.eb-opt b.on{background:var(--eb-ink);color:#fff}',
      '.eb-lb{display:inline-block;height:7px;background:var(--eb-s4);border-radius:3px;vertical-align:middle;margin-right:6px}',
      /* §execAlloc */
      '.eb-btn{font:600 12px inherit;font-family:inherit;padding:5px 12px;border-radius:8px;border:1px solid var(--eb-line);background:#fff;color:var(--eb-ink);cursor:pointer;margin-right:6px}',
      '.eb-btn.p{background:var(--eb-ink);color:#fff;border-color:var(--eb-ink)}.eb-btn.s{font-size:11px;padding:2px 9px;margin-left:8px;text-transform:none;letter-spacing:0;vertical-align:middle}',
      '.eb-btns{margin-top:10px}',
      '.eb-tbl.eb-al input{width:58px;font:600 12px inherit;font-family:inherit;padding:3px 5px;border:1px solid var(--eb-line);border-radius:6px;text-align:right}',
      '.eb-atot{font-weight:700}.eb-atot.over{color:var(--eb-bad)}.eb-atot.under{color:var(--eb-warn)}.eb-atot.ok{color:var(--eb-good)}',
      '.eb-rf{display:flex;flex-wrap:wrap;gap:4px 6px;margin:0 0 8px}',
      '.eb-rf span{font-size:11px;font-weight:700;background:#F1F3F7;border-radius:6px;padding:2px 7px;white-space:nowrap}.eb-rf span.ok{background:var(--eb-good-l);color:var(--eb-good)}',
      '.eb-rf span b{font-weight:600;color:var(--eb-ink2);margin-right:3px}.eb-rf span small{font-weight:600;color:var(--eb-mut);margin-left:3px}',
      '.eb-tbl.eb-pg tr.eb-sub td{padding-top:3px;padding-bottom:3px;font-size:11.5px;color:var(--eb-ink2);border-top:0}.eb-tbl.eb-pg tr.eb-sub td b{font-weight:600}',
      '.eb-spark.eb-wk{width:70px;height:20px;margin-left:auto}',
      '@media(max-width:900px){.eb-dec li{grid-template-columns:minmax(0,1fr)}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
