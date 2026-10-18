/* §opsPierCash · petty cash is owned by operation-backend.  Legacy globals remain the render model. */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var L={}, enc=encodeURIComponent, cache={ day:{}, month:{}, sheet:{} }, loading={}, catById={};
  ['renderPierCash','pcRowSave','pcRowDel','pcPull','pcSetLT','pcSetLTNote','pcSetPK','pcFillPK','pc2EdSave','pcCoName','pcCoNameSet','pcCoSave','pcPrintCert','pcMonthDays','pcOpening','pcTotals','pcBoats','pcDates','pcPkPullState'].forEach(function(n){ L[n]=window[n]; });
  function on(){ return !!(O.enabled&&O.enabled()); }
  function key(p,d){ return p+'|'+d; }
  function call(m,path,body){ return O.call(m,path,body); }
  function rows(){ return typeof window.pcRowsArr==='function'?window.pcRowsArr():[]; }
  function lts(){ return typeof window.pcLtArr==='function'?window.pcLtArr():[]; }
  function pks(){ return typeof window.pcPkArr==='function'?window.pcPkArr():[]; }
  function refresh(){ try{ window._PC_ARR=null; if(typeof window.pcSync==='function') window.pcSync(); }catch(_){} }
  function redraw(){ try{ L.renderPierCash(window._pcPier); }catch(_){} }
  function put(a, match, add){ for(var i=a.length-1;i>=0;i--) if(match(a[i])) a.splice(i,1); (add||[]).forEach(function(x){ a.push(x); }); }
  function legacyRow(r){ return {id:r.id,pier:r.pier,date:r.date,kind:r.kind,txt:r.description||'',amt:+r.amount||0,at:r.time||'',by:r.created_by||'',ts:r.created_at||'',src:({longtail:'lt',park:'pk',dock:'dock'})[r.source]||'',bid:r.boat_id||'',claim:(r.claim&&r.claim.id)||'',srvRefund:r.refund===undefined?undefined:!!r.refund,srvBal:(typeof r.balance==='number')?r.balance:undefined}; }   /* srvBal: the balance after the row (w5c, pcRunBal) */   /* claim: the claim the line is in (pcClmOn) · srvRefund: the server matched it as a refund (money back from the office) */
  /* pcIsRefund: the server says which in-rows are refunds (isRefund in pier-cash-claims.ts); the browser regex is only the answer for a row the server has not sent yet */
  var isRefundLegacy=window.pcIsRefund;
  if(typeof isRefundLegacy==='function') window.pcIsRefund=function(x){ if(on()&&x&&typeof x.srvRefund==='boolean') return x.srvRefund; return isRefundLegacy.apply(this,arguments); };
  function applyDay(j){
    if(!j) return; var p=j.pier,d=j.date;
    put(rows(),function(x){ return x&&x.pier===p&&x.date===d; },(j.rows||[]).map(legacyRow));
    /* a line's claim must be in the claims list for its chip to show (pcClmOn) before the month list arrives */
    try{ var CA=typeof window.pcClmArr==='function'?window.pcClmArr():null;
      if(CA) (j.rows||[]).forEach(function(r){ var c=r.claim; if(c&&c.id&&!CA.some(function(x){ return x&&x.id===c.id; })) CA.push({id:c.id,pier:p,date:d,name:c.name||'',by:'',ts:''}); }); }catch(_){}
    (j.rows||[]).forEach(function(r){ if(r&&r.id!=null&&r.category!==undefined) catById[r.id]=r.category; });   /* the server's expense group of each row (pcGrpOf) */
    cache.day[key(p,d)]=j; refresh();
  }
  function applySheet(kind,j){
    if(!j) return; var p=j.pier, dates={}; (j.days||[]).forEach(function(day){ dates[day.date]=1; });
    var a=kind==='longtail'?lts():pks();
    put(a,function(x){ return x&&x.pier===p&&dates[x.date]; },[]);
    (j.days||[]).forEach(function(day){ (day.boats||[]).forEach(function(b){ if(!b.cell) return; var c=b.cell, o={id:p+'|'+day.date+'|'+b.boat_id,pier:p,date:day.date,bid:b.boat_id,by:c.updated_by||'',ts:c.updated_at||''};
      if(kind==='longtail'){ o.nj=c.join_boats; o.nc=c.charter_boats; o.n=(+c.used_boats||0)||null; o.amt=c.amount; o.note=c.note||''; }
      else { ['ad_th','chd_th','inf_th','foc_th','ad_fr','chd_fr','inf_fr','foc_fr'].forEach(function(k){ o[k]=c[k]; }); o.amt=c.amount; o.dock=c.dock; o.src=c.filled_from||''; }
      a.push(o);
    }); });
    cache.sheet[kind+'|'+p+'|'+j.month+(j.date?'|'+j.date:'')]=j; refresh();
  }
  function fail(title,e){ O.fail(title,e); }
  function dayPath(p,d){ return '/v1/pier-cash/'+enc(p)+'/days/'+enc(d); }
  function loadCurrent(p,d,force){
    var k=key(p,d); if(!force&&cache.day[k]) return Promise.resolve(cache.day[k]); if(loading[k]) return loading[k]; var ym=d.slice(0,7);
    loading[k]=Promise.all([
      O.get(dayPath(p,d)).then(applyDay),
      O.get('/v1/pier-cash/'+enc(p)+'/months/'+enc(ym)+'/longtail',{date:d}).then(function(j){applySheet('longtail',j);}),
      O.get('/v1/pier-cash/'+enc(p)+'/months/'+enc(ym)+'/park',{date:d}).then(function(j){applySheet('park',j);}),
      O.get('/v1/pier-cash/settings').then(function(j){ cache.settings=j||{}; })
    ]).then(function(){ delete loading[k]; redraw(); },function(e){ delete loading[k]; fail('Petty cash did not load',e); }); return loading[k];
  }
  function loadMonth(p,ym,tab){
    var k='month|'+p+'|'+ym+'|'+tab; if(cache.sheet[k]) return Promise.resolve(cache.sheet[k]); if(loading[k]) return loading[k];
    var have=cache.month[p+'|'+ym], base=have?Promise.resolve(have):O.get('/v1/pier-cash/'+enc(p)+'/months/'+enc(ym)).then(function(j){ cache.month[p+'|'+ym]=j; return j; });
    loading[k]=base.then(function(){ return tab===1?O.get('/v1/pier-cash/'+enc(p)+'/months/'+enc(ym)+'/longtail'):tab===2?O.get('/v1/pier-cash/'+enc(p)+'/months/'+enc(ym)+'/park'):null; }).then(function(j){ if(j) applySheet(tab===1?'longtail':'park',j); cache.sheet[k]=j||true; delete loading[k]; redraw(); },function(e){ delete loading[k]; fail('Petty cash month did not load',e); }); return loading[k];
  }
  window.renderPierCash=function(){ var r=L.renderPierCash.apply(this,arguments); if(on()){ var p=window._pcPier,d=window._pcDate,ym=window._pcYM; if(p&&d) loadCurrent(p,d); if(p&&ym) loadMonth(p,ym,window._pcTab); } return r; };
  // Month rows use the server's carry-forward ledger rather than browser reconstruction.
  window.pcMonthDays=function(p,ym){ if(!on()) return L.pcMonthDays.apply(this,arguments); var m=cache.month[p+'|'+ym]; return m?(m.days||[]).map(function(x){return x.date;}):L.pcMonthDays.apply(this,arguments); };
  window.pcOpening=function(p,d){ if(!on()) return L.pcOpening.apply(this,arguments); var m=cache.month[p+'|'+d.slice(0,7)], x=m&&(m.days||[]).filter(function(v){return v.date===d;})[0], q=cache.day[key(p,d)]; return x?x.opening:(q?q.opening:L.pcOpening.apply(this,arguments)); };
  window.pcTotals=function(p,d){ if(!on()) return L.pcTotals.apply(this,arguments); var m=cache.month[p+'|'+d.slice(0,7)], x=m&&(m.days||[]).filter(function(v){return v.date===d;})[0], q=cache.day[key(p,d)], v=x||q; if(!v) return L.pcTotals.apply(this,arguments); return {in:v.in,out:v.out,other:v.out,net:v.net,lt:v.reference.longtail,pk:v.reference.park,dock:v.reference.dock,ref:v.reference.total,pulled:v.pulled}; };
  // The sheets' boats and dates are the server's (sheetBoats / sheetDates: deployed boats by Program Config order). Legacy lists only boats
  // with a program that day, so cell-only boats (no route_id) are left out; until the sheet has been read the legacy helpers answer.
  function sheetDay(p,d){ var ym=d.slice(0,7), hit=null; Object.keys(cache.sheet).forEach(function(k){ var j=cache.sheet[k]; if(!hit&&j&&j!==true&&j.pier===p&&j.month===ym&&(k.indexOf('longtail|')===0||k.indexOf('park|')===0)){ var day=(j.days||[]).filter(function(x){ return x.date===d; })[0]; if(day) hit=day; } }); return hit; }
  window.pcBoats=function(d,p){ if(!on()) return L.pcBoats.apply(this,arguments); var day=sheetDay(p,d); if(!day) return L.pcBoats.apply(this,arguments);
    return (day.boats||[]).filter(function(b){ return b.route_id; }).map(function(b){ return {bid:b.boat_id,name:b.boat_name||b.boat_id,rid:b.route_id||'',route:b.route_name||b.route_id||''}; }); };
  window.pcDates=function(p,ym){ if(!on()) return L.pcDates.apply(this,arguments); var seen={}, have=false;
    ['longtail','park'].forEach(function(kind){ var j=cache.sheet[kind+'|'+p+'|'+ym]; if(!j||j===true) return; have=true; (j.days||[]).forEach(function(day){ if((day.boats||[]).some(function(b){ return b.route_id; })) seen[day.date]=1; }); });
    return have?Object.keys(seen).sort():L.pcDates.apply(this,arguments); };
  // Park pull state per boat is the server's day `park_pull` (old / off / waiting / boats); the cell (C) for a line is the sheet cell already in the browser.
  window.pcPkPullState=function(p,d){ var q=cache.day[key(p,d)], pp=q&&q.park_pull; if(!on()||!pp) return L.pcPkPullState.apply(this,arguments);
    var D=(typeof window.pcDay==='function'&&window.pcDay(p,d,false))||{}, pk=D.pk||{};
    return {old:!!pp.old, off:!!pp.off, waiting:+pp.waiting||0, total:+pp.total||0, pulledAmt:+pp.pulled_amount||0, nPulled:+pp.pulled_boats||0, nWait:+pp.waiting_boats||0,
      lines:(pp.boats||[]).map(function(b){ return {B:{bid:b.boat_id,rid:b.route_id||'',name:b.boat_name||b.boat_id}, C:pk[b.boat_id]||{}, v:+b.amount||0, pulled:b.pulled_amount==null?null:(+b.pulled_amount||0)}; })}; };
  /* pc2StatLT(pier,ds): which boats need a long-tail entry and which are missing it. "Needs" is the server's booked side of the
     boat (join_heads / charter_boats, GET /v1/pier-office/{pier}/days/{date}/boats, read by 47-ops-pier-job.js) instead of
     pxLongtail from the browser's bookings; the boat list, the keyed amounts and the result shape stay legacy's. */
  var statLTLegacy=window.pc2StatLT;
  if(typeof statLTLegacy==='function') window.pc2StatLT=function(pier,ds){
    /* only the day on screen asks the server: the month list calls this for every day, and each answer reads that day's bookings */
    var DB=on()&&O.pier&&O.pier.dayBoats; if(!DB||!pier||ds!==window._pcDate) return statLTLegacy.apply(this,arguments);
    DB.want(pier,ds,function(){ redraw(); });
    var BS=window.pcBoats(ds,pier), D=(window.pcDay&&window.pcDay(pier,ds,false))||{lt:{}}, o={n:BS.length,need:0,miss:0,missNames:[]}, any=false;
    BS.forEach(function(B){
      var sb=DB.boat(pier,ds,B.bid), bk=sb&&sb.booked, C=(D.lt||{})[B.bid]||{};
      if(!bk){ any=true; return; }
      if((+bk.join_heads||0)>0||(+bk.charter_boats||0)>0){ o.need++; if(!(+C.amt>0)){ o.miss++; o.missNames.push(B.name); } }
    });
    return any?statLTLegacy.apply(this,arguments):o;      // a boat the server did not list: the whole answer stays legacy's
  };
  /* pc2StatPK(pier,ds): the heads on the boat and the park fee it should have paid come from the server's booked side
     (booked.nationality.tot, booked.park_fee.expected: pier-park-fee.ts) instead of pcPax / pcParkAmt over the browser's bookings.
     Counts the pier keyed by hand are a client fact: when there are any, they are priced as legacy prices them. */
  var statPKLegacy=window.pc2StatPK;
  if(typeof statPKLegacy==='function') window.pc2StatPK=function(pier,ds){
    var DB=on()&&O.pier&&O.pier.dayBoats; if(!DB||!pier||ds!==window._pcDate) return statPKLegacy.apply(this,arguments);
    DB.want(pier,ds,function(){ redraw(); });
    var BS=window.pcBoats(ds,pier), D=(window.pcDay&&window.pcDay(pier,ds,false))||{pk:{}}, o={n:BS.length,miss:0,missNames:[],diff:0,keyed:0,pax:0}, any=false;
    BS.forEach(function(B){
      var sb=DB.boat(pier,ds,B.bid), bk=sb&&sb.booked;
      if(!bk||!bk.nationality||!bk.park_fee){ any=true; return; }
      var C=(D.pk||{})[B.bid]||{}, tot=+bk.nationality.tot||0;
      o.pax+=tot;
      if(!(tot>0)) return;
      if(!(+C.amt>0)){ o.miss++; o.missNames.push(B.name); return; }
      var hasK=(window.PC_PK||[]).some(function(k){ return +C[k]>0; });
      var exp=hasK?window.pcPkDue(window.pcParkAmt(window.pcParkRate(B.rid),C),C):window.pcPkDue(bk.park_fee.expected==null?null:+bk.park_fee.expected,C);
      if(exp!=null){ o.diff+=(+C.amt||0)-exp; o.keyed++; }
    });
    return any?statPKLegacy.apply(this,arguments):o;
  };
  /* pcGrpOf(x,kind): the expense group of a ledger row is the server's (rows[].category { key, title, color, background } or null)
     instead of the browser's text matching. A row the server has not sent yet (a typed one not saved) is legacy's. */
  var grpLegacy=window.pcGrpOf;
  if(typeof grpLegacy==='function') window.pcGrpOf=function(x,kind){
    if(on()&&kind!=='in'&&x&&x.id!=null&&Object.prototype.hasOwnProperty.call(catById,x.id)){
      var c=catById[x.id]; return c?{k:c.key,t:c.title,c:c.color,bg:c.background}:null;
    }
    return grpLegacy.apply(this,arguments);
  };
  /* One boat of one day in the park sheet of the month (GET …/months/{ym}/park), with its fill block
     { price, real, expected_price, expected_real, saving, nat_diff } and check { expected, due, ... }. */
  function parkBoat(p,ds,bid){
    var ks=Object.keys(cache.sheet);
    for(var i=0;i<ks.length;i++){
      var j=cache.sheet[ks[i]]; if(ks[i].indexOf('park|'+p+'|')!==0||!j||j===true||j.month!==String(ds).slice(0,7)) continue;
      var days=j.days||[]; for(var a=0;a<days.length;a++){ if(days[a].date!==ds) continue;
        var bs=days[a].boats||[]; for(var b=0;b<bs.length;b++) if(bs[b].boat_id===bid) return bs[b]; }
    }
    return null;
  }
  /* pcPax(date,bid,pier): the heads on a boat by ticket category (the object) and by real nationality (.n) are the server's:
     booked.nationality / booked.nationality_real of the day's boats, else the park sheet's fill { price, real }. Each carries the
     park fee the server priced for it, which pcParkAmt below returns. A boat the server did not list: legacy's count. */
  function srvCount(src,exp){
    var o={}; ['ad_th','chd_th','inf_th','foc_th','ad_fr','chd_fr','inf_fr','foc_fr','tot'].forEach(function(k){ o[k]=+src[k]||0; });
    Object.defineProperty(o,'_srvExp',{value:exp==null?null:+exp,enumerable:false}); return o;
  }
  var paxLegacy=window.pcPax;
  if(typeof paxLegacy==='function') window.pcPax=function(date,bid,pier){
    var DB=on()&&O.pier&&O.pier.dayBoats, p=pier||window._pcPier; if(!DB||!p||!date) return paxLegacy.apply(this,arguments);
    if(date===window._pcDate) DB.want(p,date,function(){ redraw(); });
    var sb=DB.boat(p,date,bid), bk=sb&&sb.booked, pf=(bk&&bk.park_fee)||{}, X=null;
    if(bk&&bk.nationality&&bk.nationality_real){
      X=srvCount(bk.nationality,pf.expected_price); X.n=srvCount(bk.nationality_real,pf.expected_real!==undefined?pf.expected_real:pf.expected);
      X.hasNat=!!bk.has_thai_passengers; X.natDiff=!!bk.nationality.nat_diff;
    } else { var f=parkBoat(p,date,bid); f=f&&f.fill;
      if(f&&f.price&&f.real){ X=srvCount(f.price,f.expected_price); X.n=srvCount(f.real,f.expected_real); X.hasNat=!!f.nat_diff; X.natDiff=!!f.nat_diff; } }
    return X||paxLegacy.apply(this,arguments);
  };
  /* pcParkAmt(R,cnt): for a count that came from pcPax the park fee is the server's (expected_price / expected_real; null = no rate).
     Counts the pier keyed by hand are priced as legacy prices them, with the route's rate R. */
  var amtLegacy=window.pcParkAmt;
  if(typeof amtLegacy==='function') window.pcParkAmt=function(R,cnt){
    if(on()&&cnt&&cnt._srvExp!==undefined) return cnt._srvExp;
    return amtLegacy.apply(this,arguments);
  };
  /* pcPkDue(exp,C): the amount due for the boat's cell is the server's check.due when the server's own expected agrees with exp
     (the cell is found by identity in the park sheet); otherwise exp + dock as legacy. */
  var dueLegacy=window.pcPkDue;
  if(typeof dueLegacy==='function') window.pcPkDue=function(exp,C){
    if(on()&&exp!=null&&C&&typeof C==='object'&&typeof window.pcDay==='function'){
      var ks=Object.keys(cache.sheet);
      for(var i=0;i<ks.length;i++){
        var j=cache.sheet[ks[i]]; if(ks[i].indexOf('park|')!==0||!j||j===true) continue;
        var days=j.days||[]; for(var a=0;a<days.length;a++){ var D=window.pcDay(j.pier,days[a].date,false); if(!D||!D.pk) continue;
          var bs=days[a].boats||[]; for(var b=0;b<bs.length;b++){ if(D.pk[bs[b].boat_id]!==C) continue;
            var ck=bs[b].check; if(ck&&ck.due!=null&&ck.expected!=null&&+ck.expected===+exp) return +ck.due; return dueLegacy.apply(this,arguments); } }
      }
    }
    return dueLegacy.apply(this,arguments);
  };
  /* pcParkRate(rid): the price of one head of each ticket category is the server's, from the cost plan (park sheet boat `rate`:
     { ok, plan, rates, miss, borrowed_from } or { ok:false, plan, why }), turned into legacy's object { ok, ad_th.., plan, how, miss } with
     legacy's Thai texts. A route no loaded park sheet lists (or non-ops mode) answers from the browser's cost plan as before. */
  var MISS_TH={'Thai adult price':'ราคาคนไทย','child price':'ราคาเด็ก'};
  function whyTh(r){
    var w=String(r.why||'');
    if(w==='the route has no cost plan') return 'เส้นทางนี้ยังไม่มีแผนต้นทุน';
    if(w==='the cost template has no park line') return 'สูตรกลางไม่มีบรรทัดค่าเข้าอุทยาน';
    if(/^the plan ".*" turns the park line off$/.test(w)) return 'แผน «'+(r.plan||'')+'» ปิดบรรทัดค่าอุทยานไว้';
    return w;
  }
  function srvRate(rid){
    var ks=Object.keys(cache.sheet), hit=null;
    for(var i=0;i<ks.length&&!hit;i++){
      var j=cache.sheet[ks[i]]; if(ks[i].indexOf('park|')!==0||!j||j===true) continue;
      (j.days||[]).forEach(function(d){ (d.boats||[]).forEach(function(b){ if(!hit&&b&&b.route_id===rid&&b.rate&&typeof b.rate==='object') hit=b.rate; }); });
    }
    return hit;
  }
  var rateLegacy=window.pcParkRate;
  if(typeof rateLegacy==='function') window.pcParkRate=function(rid){
    var r=on()&&rid?srvRate(rid):null; if(!r) return rateLegacy.apply(this,arguments);
    if(!r.ok) return {ok:false,why:whyTh(r),plan:r.plan||undefined};
    var o={ok:true}; ['ad_th','chd_th','inf_th','foc_th','ad_fr','chd_fr','inf_fr','foc_fr'].forEach(function(k){ o[k]=+(r.rates||{})[k]||0; });
    o.plan=r.plan||''; o.how=r.borrowed_from?'ยืมจาก '+r.borrowed_from:''; o.miss=(r.miss||[]).map(function(m){ return MISS_TH[m]||m; });
    return o;
  };
  function current(){ return {p:window._pcPier,d:window._pcDate}; }
  function accepted(j){ var d=(j&&j.day)||j; if(d&&d.pier&&d.date){ delete cache.month[d.pier+'|'+d.date.slice(0,7)]; Object.keys(cache.sheet).forEach(function(k){ if(k.indexOf('|'+d.pier+'|'+d.date.slice(0,7)+'|')>=0) delete cache.sheet[k]; }); } if(j&&j.day) applyDay(j.day); else if(j) applyDay(j); O.wrote('pier'); redraw(); }
  window.pcRowSave=function(kind){
    if(!on()) return L.pcRowSave.apply(this,arguments); if(typeof window.pcGuard==='function'&&!window.pcGuard()) return;
    var t=document.getElementById('pc-r-txt'),a=document.getElementById('pc-r-amt'),h=document.getElementById('pc-r-at'), amount=String(a&&a.value||'').trim();
    if(!amount||!(+amount.replace(/,/g,'')>0)){ alert('Enter an amount first'); return; } var c=current();
    return O.queue(function(){ return call('POST',dayPath(c.p,c.d)+'/rows',{kind:kind==='in'?'in':'out',description:t?t.value.trim():null,amount:amount,time:(h&&h.value)||null}); }).then(function(j){ accepted(j); if(typeof window.ckReasonClose==='function') window.ckReasonClose(); },function(e){ fail('Petty cash row not saved',e); redraw(); });
  };
  window.pcRowDel=function(kind,id){
    if(!on()) return L.pcRowDel.apply(this,arguments); if(typeof window.pcGuard==='function'&&!window.pcGuard()) return; if(!confirm('Delete this row?')) return;
    return O.queue(function(){ return call('DELETE','/v1/pier-cash/rows/'+enc(id)); }).then(accepted,function(e){ fail('Petty cash row not deleted',e); redraw(); });
  };
  window.pcPull=function(d){ if(!on()) return L.pcPull.apply(this,arguments); var p=window._pcPier; return O.queue(function(){ return call('POST',dayPath(p,d)+'/pull',{}); }).then(accepted,function(e){ fail('Petty cash totals not pulled',e); redraw(); }); };
  function patchSheet(kind,ds,bid,body){ var p=window._pcPier; return O.queue(function(){ return call('PATCH',dayPath(p,ds)+'/'+kind+'/'+enc(bid),body); }).then(function(){ delete cache.month[p+'|'+ds.slice(0,7)]; Object.keys(cache.sheet).forEach(function(k){ if(k.indexOf('|'+p+'|'+ds.slice(0,7)+'|')>=0) delete cache.sheet[k]; }); return loadCurrent(p,ds,true).then(function(){ O.wrote('pier'); return true; }); },function(e){ fail('Petty cash sheet not saved',e); return loadCurrent(p,ds,true).then(function(){ return false; }); }); }
  window.pcSetLT=function(ds,bid,fld,val){ if(!on()) return L.pcSetLT.apply(this,arguments); var b={}; b[{nj:'join_boats',nc:'charter_boats',amt:'amount'}[fld]||fld]=val===''?null:+val||0; return patchSheet('longtail',ds,bid,b); };
  window.pcSetLTNote=function(ds,bid,val){ if(!on()) return L.pcSetLTNote.apply(this,arguments); return patchSheet('longtail',ds,bid,{note:String(val||'').trim()||null}); };
  window.pcSetPK=function(ds,bid,fld,val){ if(!on()) return L.pcSetPK.apply(this,arguments); var b={}; b[fld==='amt'?'amount':fld]=val===''?null:+val||0; return patchSheet('park',ds,bid,b); };
  // Fill is a complete cell write: never populate the browser cache before the server accepts it.
  window.pcFillPK=function(ds,bid,pier,src){
    if(!on()) return L.pcFillPK.apply(this,arguments); if(typeof window.pcGuard==='function'&&!window.pcGuard()) return;
    var fb=parkBoat(pier||window._pcPier,ds,bid), fl=fb&&fb.fill&&fb.fill.price&&fb.fill.real?fb.fill:null;   /* the server's two sets (park sheet fill) */
    var x=fl?null:window.pcPax(ds,bid,pier||window._pcPier), picked=fl?(src==='price'?fl.price:fl.real):(src==='price'?x:x.n), old=pks().filter(function(v){ return v&&v.pier===window._pcPier&&v.date===ds&&v.bid===bid; })[0]||{};
    var body={}; ['ad_th','chd_th','inf_th','foc_th','ad_fr','chd_fr','inf_fr','foc_fr'].forEach(function(k){ body[k]=+picked[k]||0; });
    body.amount=old.amt==null?null:+old.amt||0; body.dock=old.dock==null?null:+old.dock||0; body.filled_from=src==='price'?'price':'nat';
    return patchSheet('park',ds,bid,body).then(function(ok){ if(ok) window._pcFillAsk=''; });
  };
  function editorDone(next,E){
    if(next&&!E.id){ window._pc2Ed={k:typeof window.pc2EdK==='function'?window.pc2EdK():'',id:'',kind:E.kind,ok:'',src:'',at:typeof window.ckNowHM==='function'?window.ckNowHM():'',txt:'',amt:'',by:typeof window.pcWho==='function'?window.pcWho():''}; if(typeof window.pc2EdRefresh==='function') window.pc2EdRefresh('txt'); }
    else { window._pc2Ed=null; if(typeof window.pcKeep==='function') window.pcKeep(); }
  }
  window.pc2EdSave=function(next){
    if(!on()) return L.pc2EdSave.apply(this,arguments); var E=window._pc2Ed; if(!E) return; if(typeof window.pcGuard==='function'&&!window.pcGuard()) return;
    var amt=typeof window.pcNum==='function'?window.pcNum(E.amt):+E.amt;
    if(!(amt>0)){ var input=document.getElementById('pc2-ed-amt'); if(input) input.classList.add('bad'); if(typeof window.pc2EdFocus==='function') window.pc2EdFocus('amt'); return; }
    if(E.src){ alert('Source rows cannot be edited.'); return; }
    var c=current(), body={kind:E.kind==='in'?'in':'out',description:String(E.txt||'').trim()||null,amount:amt,time:typeof window.pc2HM==='function'?window.pc2HM(E.at):E.at||null};
    // A saved row is edited by one atomic server PATCH; the browser ledger changes only after the server answers.
    if(E.id) return O.queue(function(){ return call('PATCH','/v1/pier-cash/rows/'+enc(E.id),{kind:body.kind,description:body.description,amount:body.amount,time:body.time||null}); }).then(function(j){ accepted(j); editorDone(next,E); },function(e){
      fail('Petty cash row not saved',e); return loadCurrent(c.p,c.d,true).then(redraw);
    });
    return O.queue(function(){ return call('POST',dayPath(c.p,c.d)+'/rows',body); }).then(function(j){ accepted(j); editorDone(next,E); },function(e){
      fail('Petty cash row not saved',e); redraw();
    });
  };
  window.pcCoName=function(){ return on()&&cache.settings ? (cache.settings.company_name||'') : L.pcCoName.apply(this,arguments); };
  window.pcCoNameSet=function(v){ if(!on()) return L.pcCoNameSet.apply(this,arguments); return O.queue(function(){ return call('PUT','/v1/pier-cash/settings',{company_name:String(v==null?'':v).trim()||null}); }).then(function(j){cache.settings=j||{}; O.wrote('pier'); redraw(); return true;},function(e){fail('Company name not saved',e); return false;}); };
  window.pcCoSave=function(){ if(!on()) return L.pcCoSave.apply(this,arguments); var el=document.getElementById('pc-co-inp'),v=el?el.value:'', next=window._pcCoNext; window._pcCoNext=null; return window.pcCoNameSet(v).then(function(ok){ if(!ok) return; if(typeof window.ckReasonClose==='function') window.ckReasonClose(); if(next&&window.pcCoName()) setTimeout(next,0); }); };
  // The receipt-substitute certificate comes from the server (rows, company, total, Thai text); the legacy
  // print layout is reused by feeding it those values for the duration of the (synchronous) call.
  window.pcPrintCert=function(opt){
    if(!on()) return L.pcPrintCert.apply(this,arguments); opt=opt||{}; var c=current(), q='';
    if(opt.only){
      var ids=rows().filter(function(x){ return x&&x.pier===c.p&&x.date===c.d&&x.kind==='out'&&typeof window.pcSelHas==='function'&&window.pcSelHas('out',x.id); }).map(function(x){ return x.id; });
      if(!ids.length){ alert('No rows selected.'); return; } q='?ids='+enc(ids.join(','));
    }
    return O.get('/v1/pier-cash/'+enc(c.p)+'/days/'+enc(c.d)+'/certificate'+q).then(function(j){
      var keep={ pcDay:window.pcDay, pcCoName:window.pcCoName, pcThDate:window.pcThDate, pcBahtText:window.pcBahtText, pcSelHas:window.pcSelHas };
      try{
        window.pcDay=function(){ return { out:(j.rows||[]).map(function(r){ return {id:r.id,at:r.time||'',txt:r.description||'',amt:+r.amount||0,src:{longtail:'lt',park:'pk',dock:'dock'}[r.source]||''}; }) }; };
        window.pcCoName=function(){ return j.company_name||''; };
        window.pcThDate=function(){ return j.date_th; };
        window.pcBahtText=function(){ return j.total_text_th; };
        window.pcSelHas=function(){ return true; };
        return L.pcPrintCert.call(null,opt);
      } finally { Object.keys(keep).forEach(function(k){ window[k]=keep[k]; }); }
    },function(e){
      if(e&&e.code==='company_name_missing'&&typeof window.pcCoEdit==='function'){ window.pcCoEdit(function(){ window.pcPrintCert(opt); }); return; }
      fail('Petty cash certificate not loaded',e);
    });
  };
  window.laOps.pierCash={loadCurrent:loadCurrent,applyDay:applyDay,applySheet:applySheet,cache:cache};
})();
