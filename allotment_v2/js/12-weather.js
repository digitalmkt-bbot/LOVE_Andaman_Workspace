/* ══ §wx · Weather per route point on Boat Operation (2026-10-30) ═══════════════════════════════
   Owner: "การออกเรือสอดคล้องกับสภาพอากาศ ควรเก็บประวัติว่าเรือเจอสภาพอากาศแบบไหนออกได้ แบบไหนออกไม่ได้
           เอามาเป็นตัวช่วยตัดสินใจ · แต่ละเส้นทางใช้พยากรณ์ไม่เหมือนกัน · ต้องไปอยู่กับ Boat Operation"
   Server side (server.js §wx) stores one row per point/date/kind in weather_obs; this file only reads it:
     · a "คลื่น · <point>" row under each pier header of the Boat Operation grid (one cell per day)
     · a card in the right column for the selected date: numbers, risk level, and the 5 most similar past
       days with what happened (from bookings: ran / cancelled_weather) — the decision aid
   Nothing here writes the app blob. Loads lazily after renderOp paints; patches cells in place, never re-renders. */
var WX = { pts:null, obs:{}, rangeKey:'', histLoaded:false, loading:false, bf:null };
function wxE(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function wxAddDays(ymd,n){ var d=new Date(ymd+'T12:00:00'); d.setDate(d.getDate()+n); return (typeof bkV2LocalYMD==='function')?bkV2LocalYMD(d):d.toISOString().slice(0,10); }
function wxToday(){ return (typeof bkV2LocalYMD==='function') ? bkV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10); }
function wxPtsOf(pier){ return (WX.pts||[]).filter(function(p){ return p.pier===pier; }); }
function wxPtFor(route){
  if(!route || !WX.pts) return null;
  var P = wxPtsOf(route.pier), nm = String(route.name||'');
  for(var i=0;i<P.length;i++){ if(P[i].match && new RegExp(P[i].match,'i').test(nm)) return P[i]; }
  return P.filter(function(p){ return !p.match; })[0] || P[0] || null;
}
function wxRoutesOf(pt){ return (typeof ROUTES!=='undefined'?ROUTES:[]).filter(function(r){ var p=wxPtFor(r); return p && p.id===pt.id; }); }
/* which snapshot to show for a date: analysed history for past days, else the morning forecast, else last evening's */
function wxBest(ptId, date){
  var o = (WX.obs[ptId]||{})[date]; if(!o) return null;
  var past = date < wxToday();
  var k = past ? (o.hist ? 'hist' : (o.fc05 ? 'fc05' : 'fc17')) : (o.fc05 ? 'fc05' : (o.fc17 ? 'fc17' : 'hist'));
  return o[k] ? { kind:k, S:o[k].summary||{}, at:o[k].taken_at } : null;
}
function wxKindTxt(k){ return k==='hist' ? 'ข้อมูลจริง (วิเคราะห์หลังวัน)' : k==='fc05' ? 'พยากรณ์ 05:00 วันออกเรือ' : 'พยากรณ์ 17:00 วันก่อน'; }
function wxLevel(pt, S){
  if(!S || S.wave==null) return 'none';
  if(S.wave >= (pt.risk||2)) return 'risk';
  if(S.wave >= (pt.warn||1.5) || (S.gust!=null && S.gust >= (pt.wind||25))) return 'warn';
  return 'ok';
}
var WX_LV = { risk:['#FDF1F0','#A32D2D','เสี่ยง'], warn:['#FFF8EC','#854F0B','ระวัง'], ok:['#E1F5EE','#0F6E56','ปกติ'], none:['transparent','#B9BDC7',''] };
function wxDirTxt(d){ if(d==null) return ''; var N=['N','NE','E','SE','S','SW','W','NW']; return N[Math.round(d/45)%8]; }
/* ── data ── */
function wxFetch(url, opt){ return fetch(url, Object.assign({credentials:'same-origin'}, opt||{})).then(function(r){ return r.ok ? r.json() : r.json().then(function(j){ throw new Error(j.error||('HTTP '+r.status)); }); }); }
function wxIngest(rows){ (rows||[]).forEach(function(r){ var o=WX.obs[r.point_id]=WX.obs[r.point_id]||{}; var d=o[r.date]=o[r.date]||{}; d[r.kind]=r; }); }
function wxLoad(from, to){
  if(WX.loading) return; WX.loading=true;
  var pp = WX.pts ? Promise.resolve() : wxFetch('/api/weather/points').then(function(j){ WX.pts=j.points||[]; });
  pp.then(function(){ return wxFetch('/api/weather?from='+from+'&to='+to); })
    .then(function(j){ wxIngest(j.rows); WX.rangeKey=from+'|'+to; })
    .then(function(){ if(WX.histLoaded) return; return wxFetch('/api/weather?from=2026-06-01&to='+wxToday()).then(function(j){ wxIngest(j.rows); WX.histLoaded=true; }); })
    .then(function(){ return wxLoadLog('2026-06-01', to > wxToday() ? to : wxToday()); })
    .catch(function(e){ try{ console.warn('[wx] load', e.message); }catch(_){ } })
    .then(function(){ WX.loading=false; wxPatch(); });
}
/* called by renderOp after it painted · loads the visible range once, then patches */
function wxAfterRender(dates){
  if(!dates || !dates.length) return;
  var from=dates[0], to=dates[dates.length-1], key=from+'|'+to;
  if(WX.pts && WX.rangeKey===key && WX.histLoaded){ wxPatch(); return; }
  wxLoad(from, to);
}
/* ── grid row ── */
function wxRowHtml(pier, dates){
  var P = WX.pts ? wxPtsOf(pier) : null;
  if(!P) return '<div class="bop2-cell" style="grid-column:1/-1;padding:0;min-height:0" data-wx-pier="'+wxE(pier)+'"></div>';
  return P.map(function(pt){
    return '<div class="bop2-cell bop2-cell-route" style="font-size:10px;color:#6B7785;font-weight:600;min-height:26px;padding:2px 8px" title="'+wxE(pt.name)+' · จุดพยากรณ์กลางทะเล">'
      +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:5px;flex:none"><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>คลื่น · '+wxE(pt.name.split(' · ')[0])+'</div>'
      + dates.map(function(d){ return '<div class="bop2-cell" style="min-height:26px;padding:2px" data-wx="'+wxE(pt.id)+'|'+d+'">'+wxCellHtml(pt,d)+'</div>'; }).join('');
  }).join('');
}
function wxCellHtml(pt, date){
  var b = wxBest(pt.id, date); if(!b || b.S.wave==null) return '<span style="color:#D5D8E0;font-size:10px">·</span>';
  var lv = wxLevel(pt, b.S), c = WX_LV[lv];
  return '<button type="button" onclick="bop2SelectDate(\''+date+'\')" title="'+wxE(pt.name)+' · '+date+' · คลื่น '+b.S.wave+' m คาบ '+b.S.per+' s '+wxDirTxt(b.S.dir)+' · ลม '+b.S.wind+' kt · '+wxKindTxt(b.kind)+'" style="width:100%;height:22px;border:0;border-radius:6px;background:'+c[0]+';color:'+c[1]+';font:700 10.5px \'DM Mono\',monospace;cursor:pointer;padding:0'+(b.kind==='hist'?'':';outline:1px dashed '+c[1]+'55;outline-offset:-1px')+'">'+b.S.wave+'</button>';
}
/* ── outcomes from bookings · what actually happened on a day for the routes of a point ── */
var _wxOutIdx = null, _wxOutSig = '';
function wxOutcomeIndex(){
  var B = (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]); var sig = B.length+'|'+(WX.pts?WX.pts.length:0);
  if(_wxOutIdx && _wxOutSig===sig) return _wxOutIdx;
  var rp = {}; (typeof ROUTES!=='undefined'?ROUTES:[]).forEach(function(r){ var p=wxPtFor(r); if(p) rp[r.id]=p.id; });
  var idx = {};
  B.forEach(function(b){
    var st = b.status||''; var cx = (st==='cancelled'||st==='rejected'); var wx = st==='cancelled_weather';
    (b.trips||[]).forEach(function(t){
      var pid = rp[t.routeId]; if(!pid || !t.date) return;
      var k = pid+'|'+t.date, o = idx[k] = idx[k] || { ok:0, wx:0 };
      if(wx) o.wx++; else if(!cx) o.ok++;
    });
  });
  _wxOutIdx = idx; _wxOutSig = sig; return idx;
}
function wxSimilar(pt, S, date){
  var H = WX.obs[pt.id]||{}, out=[];
  Object.keys(H).forEach(function(d){
    if(d===date || !H[d].hist) return; var T = H[d].hist.summary||{}; if(T.wave==null) return;
    var oc = wxOutcome(pt.id, d); if(!oc) return;
    var ang = (S.dir!=null && T.dir!=null) ? Math.min(Math.abs(S.dir-T.dir), 360-Math.abs(S.dir-T.dir)) : 0;
    var dist = Math.abs((S.wave||0)-(T.wave||0))/0.3 + Math.abs((S.per||0)-(T.per||0))/1.5 + ang/45*0.5 + Math.abs((S.wind||0)-(T.wind||0))/5*0.5;
    out.push({ d:d, S:T, oc:oc, dist:dist });
  });
  out.sort(function(a,b){ return a.dist-b.dist; });
  return out.slice(0,5);
}
/* ── right-column card for the selected date ── */
function wxCardHtml(date, piers){
  return '<div class="bo-card" id="wx-card" style="padding:14px 16px">'+wxCardBody(date, piers)+'</div>';
}
function wxCardBody(date, piers){
  var dt = new Date(date+'T12:00:00'); var MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var head = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:13px">สภาพทะเล · '+dt.getDate()+' '+MON[dt.getMonth()]+'</b><span style="flex:1"></span>'
    + '<button type="button" class="bo-btn icon" title="ดึงพยากรณ์ตอนนี้" aria-label="ดึงพยากรณ์ตอนนี้" onclick="wxFetchNow(\''+date+'\')" style="width:24px;height:24px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/></svg></button></div>';
  if(!WX.pts) return head+'<div style="font-size:11px;color:#6B7785">กำลังโหลด…</div>';
  var P = (WX.pts||[]).filter(function(p){ return !piers || !piers.length || piers.indexOf(p.pier)>=0; });
  if(!P.length) return head+'<div style="font-size:11px;color:#6B7785">ยังไม่ได้ตั้งจุดพยากรณ์ของท่านี้</div>';
  var canDecide = date <= wxAddDays(wxToday(), 1);
  var body = P.map(function(pt){
    var short = wxE(pt.name.split(' · ')[0]);
    var b = wxBest(pt.id, date);
    if(!b || b.S.wave==null) return '<div style="padding:7px 0;border-top:1px solid #EEF1F5;display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:4px;background:#D5D8E0"></span><b style="font-size:12px;flex:1">'+short+'</b><span style="font-size:10px;color:#9B9088">ยังไม่มีข้อมูล</span></div>';
    var S=b.S, lv=wxLevel(pt,S), c=WX_LV[lv];
    var sim = wxSimilar(pt, S, date), nRan=sim.filter(function(x){ return x.oc.k==='ran'; }).length, nCx=sim.filter(function(x){ return x.oc.k==='cx'; }).length, nRough=sim.filter(function(x){ return x.oc.k==='rough'||x.oc.k==='bumpy'; }).length;
    var dec = WX.dec[pt.id+'|'+date] || {}, oc = wxOutcome(pt.id, date);
    var tip = wxE(pt.name)+'\n'+wxKindTxt(b.kind)+'\nคลื่น '+S.wave+' m · คาบ '+S.per+' s · '+wxDirTxt(S.dir)+'\nswell '+S.swell+' m · ลม '+S.wind+' กระโชก '+S.gust+' kt '+wxDirTxt(S.windDir)+'\nฝน '+S.rain+' mm ('+S.hours[0]+'–'+S.hours[1]+' น.)'
      + (sim.length ? ('\n\nวันคล้ายกัน:\n'+sim.map(function(x){ var d2=new Date(x.d+'T12:00:00'); return d2.getDate()+' '+MON[d2.getMonth()]+' '+x.S.wave+'m/'+x.S.per+'s → '+x.oc.t; }).join('\n')) : '');
    /* line 2 · verdict from history, one phrase */
    var hist = !sim.length ? '<span style="color:#9B9088">ยังไม่มีประวัติ</span>'
      : (nCx>=3 ? '<b style="color:#A32D2D">คลื่นแบบนี้ส่วนใหญ่ยกเลิก</b>' : (nCx+nRough)>=3 ? '<b style="color:#854F0B">คลื่นแบบนี้ออกได้แต่โยน</b>' : '<b style="color:#0F6E56">คลื่นแบบนี้ออกได้ปกติ</b>')
        + '<span style="color:#6B7785"> · '+sim.length+' วัน: ปกติ '+nRan+(nRough?(' โยน '+nRough):'')+(nCx?(' ยกเลิก '+nCx):'')+'</span>';
    var decTxt = dec.decision ? ('<b style="color:'+(WX_DEC.filter(function(d){ return d[0]===dec.decision; })[0]||[])[2]+'">'+wxDecTxt(dec.decision)+'</b>') : (oc ? ('<span style="color:'+wxOutColor(oc.k)+'">'+wxE(oc.t)+'</span>') : '');
    var decBtn = canDecide ? '<button type="button" onclick="wxDecToggle(\''+pt.id+'\')" title="บันทึกการตัดสินใจ" style="border:0;background:transparent;color:'+(dec.decision?'#1A2A33':'#9B9088')+';font:600 10px inherit;cursor:pointer;padding:0 2px;white-space:nowrap">'+(decTxt||'บันทึก')+' ✎</button>' : (decTxt?'<span style="font-size:10px">'+decTxt+'</span>':'');
    var editor = '<div id="wx-dec-'+wxE(pt.id)+'" style="display:none;gap:5px;margin-top:5px;align-items:center">'
      + '<select onchange="wxDecide(\''+pt.id+'\',\''+date+'\',this.value)" style="height:24px;border:1px solid #D7DBE2;border-radius:6px;padding:0 4px;font:600 10px inherit;background:#fff;max-width:140px"><option value="">— ไม่ระบุ —</option>'
      + WX_DEC.map(function(d){ return '<option value="'+d[0]+'"'+(dec.decision===d[0]?' selected':'')+'>'+d[1]+'</option>'; }).join('')+'</select>'
      + '<input type="text" id="wx-why-'+wxE(pt.id)+'" value="'+wxE(dec.reason||'')+'" placeholder="เหตุผล" onchange="wxDecide(\''+pt.id+'\',\''+date+'\',(this.previousElementSibling||{}).value||\'\')" style="flex:1;min-width:0;height:24px;border:1px solid #D7DBE2;border-radius:6px;padding:0 6px;font:10px inherit">'
      + (dec.by_user?('<span style="font-size:9px;color:#9B9088;white-space:nowrap">'+wxE(dec.by_user)+' '+(dec.at?String(dec.at).slice(11,16):'')+'</span>'):'')+'</div>';
    return '<div style="padding:7px 0;border-top:1px solid #EEF1F5" title="'+tip+'">'
      + '<div style="display:flex;align-items:baseline;gap:7px;font-variant-numeric:tabular-nums"><span style="width:8px;height:8px;border-radius:4px;background:'+(lv==='ok'?'#1D9E75':c[1])+';flex:none;align-self:center"></span>'
      +   '<b style="font-size:12.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+short+'</b>'
      +   '<b style="font-family:\'DM Mono\',monospace;font-size:15px;color:'+c[1]+';margin-left:auto">'+S.wave+'m</b>'
      +   '<span style="font-family:\'DM Mono\',monospace;font-size:10.5px;color:#6B7785;white-space:nowrap">'+S.per+'s '+wxDirTxt(S.dir)+' · '+(S.wind==null?'—':Math.round(S.wind))+'/'+(S.gust==null?'—':Math.round(S.gust))+'kt</span></div>'
      + '<div style="display:flex;align-items:center;gap:6px;font-size:10px;margin-top:2px;padding-left:15px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+hist+'</span>'+decBtn+'</div>'
      + editor + '</div>';
  }).join('');
  var bf = WX.bf;
  var foot = '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;padding-top:5px;border-top:1px solid #EEF1F5;font-size:9px;color:#9B9088">'
    + (bf && bf.running ? ('<span>ดึงย้อนหลัง… '+bf.done+'/'+bf.total+'</span>') : (bf && bf.finishedAt ? ('<span>ย้อนหลังเสร็จ · ใหม่ '+bf.done+' · มีแล้ว '+bf.skipped+(bf.failed?(' · ผิดพลาด '+bf.failed):'')+'</span>') : '<span>คลื่น · คาบ ทิศ · ลม/กระโชก · ชี้เพื่อดูรายละเอียด</span>'))
    + '<span style="flex:1"></span><button type="button" class="bo-btn" style="padding:2px 8px;font-size:9px" onclick="wxBackfill()">ดึงย้อนหลัง</button></div>';
  return head+body+foot;
}
function wxDecToggle(ptId){ var el=document.getElementById('wx-dec-'+ptId); if(!el) return; el.style.display = el.style.display==='none' ? 'flex' : 'none'; }
/* ── patch in place (no full re-render) ── */
function wxPatch(){
  try{
    document.querySelectorAll('[data-wx]').forEach(function(el){ var k=el.getAttribute('data-wx').split('|'); var pt=(WX.pts||[]).filter(function(p){ return p.id===k[0]; })[0]; if(pt) el.innerHTML=wxCellHtml(pt,k[1]); });
    /* rows rendered before points were known are empty placeholders: a full re-render fills them */
    var ph = document.querySelector('[data-wx-pier]'); if(ph && WX.pts && typeof renderOp==='function' && !WX._rerendered){ WX._rerendered=true; renderOp(); return; }
    var card = document.getElementById('wx-card'); if(card){ var date=(typeof _bop2!=='undefined' && _bop2.selDate) || wxToday(); var piers=card.getAttribute('data-piers'); card.innerHTML=wxCardBody(date, piers?piers.split(','):null); }
  }catch(e){ try{ console.warn('[wx] patch', e.message); }catch(_){ } }
}
function wxFetchNow(date){
  var kind = date < wxToday() ? 'hist' : 'fc05';
  wxFetch('/api/weather/fetch?date='+date+'&kind='+kind, {method:'POST'})
    .then(function(j){ var bad=Object.keys(j.points||{}).filter(function(k){ return j.points[k] && j.points[k].error; }); if(bad.length) alert('Weather fetch failed for '+bad.map(function(k){ return k+': '+j.points[k].error; }).join(' | '));
      WX.rangeKey=''; WX.histLoaded=false; WX._rerendered=false; var d=(typeof _bop2!=='undefined' && typeof bop2GetDates==='function')?bop2GetDates():[date]; wxLoad(d[0], d[d.length-1]); })
    .catch(function(e){ alert('Weather fetch failed: '+e.message); });
}
function wxBackfill(){
  if(!confirm('Backfill sea-state history from 2026-06-01 to yesterday for every point? Takes a few minutes in the background.')) return;
  wxFetch('/api/weather/backfill?from=2026-06-01', {method:'POST'}).then(function(j){ WX.bf=j; wxPatch(); wxBfPoll(); })
    .catch(function(e){ alert('Backfill: '+e.message); });
}
function wxBfPoll(){
  wxFetch('/api/weather/backfill').then(function(j){ WX.bf=j; wxPatch(); if(j.running) setTimeout(wxBfPoll, 4000); else { WX.histLoaded=false; WX.rangeKey=''; WX._rerendered=false; var d=(typeof bop2GetDates==='function')?bop2GetDates():[wxToday()]; wxLoad(d[0], d[d.length-1]); } }).catch(function(){});
}


/* ══ §wx2 · decision log + captain's sea report + system estimate (2026-10-30) ═══════════════════
   Owner: "ถ้ากัปตันไม่ได้รายงานตลอดจะเป็นยังไง" → the history must not depend on him:
     outcome of a day = decision (office) › captain 1–5 › system estimate (fuel over the boat's own
     average on that route, weather-cancelled bookings) › plain ran/cancelled from bookings. */
var WX_DEC = [
  ['ran_all','ออกทุกลำ','#0F6E56'], ['ran_part','ออกบางลำ','#854F0B'], ['cx_us','ยกเลิก · เราตัดสินใจ','#A32D2D'],
  ['cx_port','ยกเลิก · เจ้าท่าห้าม','#555'], ['cx_park','ยกเลิก · อุทยานปิด','#555'], ['reroute','เปลี่ยนเส้นทาง','#0F5F92'] ];
var WX_SEA = ['', 'เรียบ', 'เล็กน้อย', 'โยน', 'แรง', 'ไม่ควรออก'];
var WX_SEA_C = ['', '#0F6E56', '#0F6E56', '#854F0B', '#A32D2D', '#A32D2D'];
var WX_FLAGS = [['sick','แขกเมาเยอะ'],['skip','ข้ามจุดดำน้ำ'],['early','กลับก่อนเวลา'],['damage','ของเสียหาย/บาดเจ็บ'],['complaint','ร้องเรียน']];
WX.dec = {}; WX.rep = {}; WX.logKey = '';
function wxDecTxt(code){ var d=WX_DEC.filter(function(x){ return x[0]===code; })[0]; return d ? d[1] : code; }
function wxLoadLog(from, to){
  var key=from+'|'+to; if(WX.logKey===key) return Promise.resolve();
  return wxFetch('/api/weather/log?from='+from+'&to='+to).then(function(j){
    (j.decisions||[]).forEach(function(r){ WX.dec[r.point_id+'|'+r.date]=r; });
    (j.reports||[]).forEach(function(r){ WX.rep[r.date+'|'+r.boat_id]=r; });
    WX.logKey=key; _wxOutIdx=null;
  }).catch(function(e){ try{ console.warn('[wx] log', e.message); }catch(_){ } });
}
/* captain + system view of one boat-day · null when the boat did not run */
function wxBoatDay(date, bid){
  var rep = WX.rep[date+'|'+bid] || null;
  var dd = (typeof FL_DAILY!=='undefined' && FL_DAILY[date]) ? FL_DAILY[date][bid] : null;
  var fuel = dd && +dd.fuel > 0 ? +dd.fuel : null;
  var op = (typeof TRIPS!=='undefined' && TRIPS[date]) ? TRIPS[date][bid] : null;
  var rid = op && op.route;
  var est = null;
  if(fuel && rid){ var avg = wxFuelAvg(bid, rid, date); if(avg && avg.n >= 3){ est = { pct: Math.round((fuel/avg.avg-1)*100), avg: avg.avg, n: avg.n }; } }
  return { rep:rep, sea:rep?rep.sea:null, fuel:fuel, est:est, rid:rid };
}
var _wxFuelAvg = {};
function wxFuelAvg(bid, rid, skipDate){
  var k=bid+'|'+rid; if(_wxFuelAvg[k] && _wxFuelAvg[k].skip===skipDate) return _wxFuelAvg[k];
  var vals=[]; var FD=(typeof FL_DAILY!=='undefined')?FL_DAILY:{};
  Object.keys(FD).forEach(function(d){ if(d===skipDate) return; var x=FD[d]&&FD[d][bid]; var op=TRIPS[d]&&TRIPS[d][bid]; if(x && +x.fuel>0 && op && op.route===rid) vals.push(+x.fuel); });
  vals.sort(function(a,b){ return a-b; });
  var mid = vals.length ? vals[Math.floor(vals.length/2)] : 0;   /* median · one wild entry must not move it */
  return (_wxFuelAvg[k] = { avg: mid, n: vals.length, skip: skipDate });
}
/* ── outcome of a point-day · richer than ran/cancelled ── */
function wxOutcome(ptId, date){
  var dec = WX.dec[ptId+'|'+date];
  var base = wxOutcomeIndex()[ptId+'|'+date] || { ok:0, wx:0 };
  if(dec && dec.decision){
    if(/^cx_/.test(dec.decision)) return { k:'cx', t:wxDecTxt(dec.decision), n:base.wx, src:'dec' };
    if(dec.decision==='reroute') return { k:'part', t:'เปลี่ยนเส้นทาง', n:base.ok, src:'dec' };
  }
  if(!base.ok && !base.wx && !dec) return null;
  /* boats that ran this point's routes that day */
  var pt = (WX.pts||[]).filter(function(p){ return p.id===ptId; })[0];
  var rids = pt ? wxRoutesOf(pt).map(function(r){ return r.id; }) : [];
  var seaMax = 0, seaBy = '', fuelMax = null, flags = [];
  Object.keys((typeof TRIPS!=='undefined' && TRIPS[date]) || {}).forEach(function(bid){
    var op = TRIPS[date][bid]; if(!op || rids.indexOf(op.route) < 0) return;
    var bd = wxBoatDay(date, bid);
    if(bd.sea && bd.sea > seaMax){ seaMax = bd.sea; seaBy = (getBoat(bid)||{}).name||''; }
    if(bd.rep && bd.rep.flags) (bd.rep.flags||[]).forEach(function(f){ if(flags.indexOf(f)<0) flags.push(f); });
    if(bd.est && (fuelMax==null || bd.est.pct > fuelMax)) fuelMax = bd.est.pct;
  });
  if(base.wx && !base.ok) return { k:'cx', t:'ยกเลิก (ใบจอง)', n:base.wx, src:'bk' };
  var t = base.wx ? 'ออกบางส่วน' : 'ออก', k = base.wx ? 'part' : 'ran', src='bk';
  if(seaMax){ t += ' · กัปตัน '+seaMax+' '+WX_SEA[seaMax]; src='rep'; if(seaMax>=3) k = seaMax>=4 ? 'rough' : 'bumpy'; }
  else if(fuelMax!=null && fuelMax >= 20){ t += ' · น้ำมัน +'+fuelMax+'%'; src='est'; k = fuelMax >= 35 ? 'rough' : 'bumpy'; }
  else if(fuelMax!=null){ src='est'; }
  if(flags.length) t += ' · ' + flags.map(function(f){ var x=WX_FLAGS.filter(function(y){ return y[0]===f; })[0]; return x?x[1]:f; }).join(', ');
  return { k:k, t:t, n:base.ok, src:src, sea:seaMax, fuelPct:fuelMax };
}
function wxOutColor(k){ return k==='cx' ? '#A32D2D' : k==='rough' ? '#A32D2D' : k==='bumpy' ? '#854F0B' : k==='part' ? '#854F0B' : '#0F6E56'; }
/* ── decision block in the card ── */
function wxDecisionHtml(pt, date){
  var dec = WX.dec[pt.id+'|'+date] || {};
  var chips = WX_DEC.map(function(d){ var on = dec.decision===d[0];
    return '<button type="button" onclick="wxDecide(\''+pt.id+'\',\''+date+'\',\''+d[0]+'\')" style="height:24px;padding:0 9px;border-radius:12px;border:1px solid '+(on?d[2]:'#D7DBE2')+';background:'+(on?d[2]:'#fff')+';color:'+(on?'#fff':'#1A2A33')+';font:600 10px inherit;cursor:pointer">'+d[1]+'</button>'; }).join('');
  return '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #E3E7EE">'
    + '<div style="font-size:9.5px;color:#6B7785;margin-bottom:5px">บันทึกการตัดสินใจ · '+wxE(pt.name.split(' · ')[0])+(dec.decision?(' · <b style="color:#1A2A33">'+wxDecTxt(dec.decision)+'</b> · '+wxE(dec.by_user||'')+' '+(dec.at?String(dec.at).slice(11,16):'')):'')+'</div>'
    + '<div style="display:flex;gap:4px;flex-wrap:wrap">'+chips+'</div>'
    + '<div style="display:flex;gap:6px;margin-top:6px"><input type="text" id="wx-why-'+wxE(pt.id)+'" value="'+wxE(dec.reason||'')+'" placeholder="เหตุผล / สิ่งที่เห็น (ไม่บังคับ)" style="flex:1;height:26px;border:1px solid #D7DBE2;border-radius:7px;padding:0 8px;font:11px inherit">'
    + (dec.decision ? '<button type="button" class="bo-btn" style="padding:0 10px;font-size:10px;height:26px" onclick="wxDecide(\''+pt.id+'\',\''+date+'\',\''+dec.decision+'\')">บันทึกเหตุผล</button><button type="button" class="bo-btn" style="padding:0 8px;font-size:10px;height:26px" title="ลบการตัดสินใจ" onclick="wxDecide(\''+pt.id+'\',\''+date+'\',\'\')">✕</button>' : '')
    + '</div></div>';
}
function wxDecide(ptId, date, code){
  var inp = document.getElementById('wx-why-'+ptId); var reason = inp ? inp.value : '';
  wxFetch('/api/weather/decision', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pointId:ptId, date:date, decision:code, reason:reason }) })
    .then(function(j){ var k=ptId+'|'+date; if(!code) delete WX.dec[k]; else WX.dec[k]={ point_id:ptId, date:date, decision:code, reason:reason, by_user:j.by, at:j.at }; _wxOutIdx=null; wxPatch(); })
    .catch(function(e){ alert('Save failed: '+e.message); });
}
/* ── captain's sea report · cell in the daily log (ใบงานเรือ) ── */
function wxSeaCell(ds, bid, disabled){
  var r = WX.rep[ds+'|'+bid] || null, sea = r ? r.sea : null;
  var est = null; try{ var bd = wxBoatDay(ds, bid); est = bd.est; }catch(_){ }
  var btns = [1,2,3,4,5].map(function(n){ var on = sea===n;
    return '<button type="button" '+(disabled?'disabled ':'')+'title="'+n+' '+WX_SEA[n]+'" onclick="wxSeaSet(\''+ds+'\',\''+bid+'\','+n+')" style="width:19px;height:22px;border-radius:5px;border:1px solid '+(on?WX_SEA_C[n]:'#DCDFE6')+';background:'+(on?WX_SEA_C[n]:'#fff')+';color:'+(on?'#fff':'#6B7785')+';font:700 10.5px \'DM Mono\',monospace;padding:0;cursor:pointer">'+n+'</button>'; }).join('');
  var sub = sea ? '<em style="color:'+WX_SEA_C[sea]+'">'+WX_SEA[sea]+'</em>'
          : (est && est.pct >= 20 ? '<em style="color:#854F0B" title="น้ำมันสูงกว่าค่ากลางของลำนี้บนเส้นทางนี้ ('+est.avg+' L จาก '+est.n+' วัน)">ระบบ: น้ำมัน +'+est.pct+'%</em>' : '<em style="color:#B9BDC7">ยังไม่กด</em>');
  return '<span data-wxrep="'+wxE(ds)+'|'+wxE(bid)+'" style="display:inline-flex;flex-direction:column;align-items:flex-end;gap:2px"><span style="display:inline-flex;gap:2px">'+btns+'</span>'+sub+'</span>';
}
function wxSeaSet(ds, bid, n){
  var r = WX.rep[ds+'|'+bid] || {}; var sea = (r.sea===n) ? null : n;   /* same button again = clear */
  wxFetch('/api/weather/report', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ date:ds, boatId:bid, sea:sea, flags:r.flags||[], note:r.note||'' }) })
    .then(function(j){ var k=ds+'|'+bid; if(j.deleted) delete WX.rep[k]; else WX.rep[k]=Object.assign({}, r, { date:ds, boat_id:bid, sea:sea, by_user:j.by, at:j.at }); _wxOutIdx=null;
      document.querySelectorAll('[data-wxrep="'+ds+'|'+bid+'"]').forEach(function(el){ el.outerHTML = wxSeaCell(ds, bid, false); }); })
    .catch(function(e){ alert('Save failed: '+e.message); });
}
/* called by the daily log after it painted · loads that day's reports then patches the cells */
function wxAfterDR(ds){
  if(!ds) return;
  var need = !WX.pts || !WX.rep.__loadedDay || WX.rep.__loadedDay!==ds;
  var pp = WX.pts ? Promise.resolve() : wxFetch('/api/weather/points').then(function(j){ WX.pts=j.points||[]; }).catch(function(){ WX.pts=[]; });
  pp.then(function(){ return need ? wxFetch('/api/weather/log?from='+ds+'&to='+ds).then(function(j){ (j.reports||[]).forEach(function(r){ WX.rep[r.date+'|'+r.boat_id]=r; }); (j.decisions||[]).forEach(function(r){ WX.dec[r.point_id+'|'+r.date]=r; }); WX.rep.__loadedDay=ds; }) : null; })
    .then(function(){ document.querySelectorAll('[data-wxrep]').forEach(function(el){ var k=el.getAttribute('data-wxrep').split('|'); el.outerHTML=wxSeaCell(k[0],k[1],el.getAttribute('data-dis')==='1'); }); })
    .catch(function(){});
}
