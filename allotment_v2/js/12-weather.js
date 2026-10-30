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
function wxToday(){ return (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(new Date()) : new Date().toISOString().slice(0,10); }
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
  if(S.wave >= (pt.risk||2) || (S.gust!=null && S.gust >= (pt.wind||20))) return 'risk';
  if(S.wave >= (pt.warn||1.5)) return 'warn';
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
function wxOutcome(ptId, date){
  var o = wxOutcomeIndex()[ptId+'|'+date]; if(!o || (!o.ok && !o.wx)) return null;
  if(o.ok && !o.wx) return { k:'ran', t:'ออก', n:o.ok };
  if(o.wx && !o.ok) return { k:'cx', t:'ยกเลิก', n:o.wx };
  return { k:'part', t:'ออกบางส่วน', n:o.ok, cx:o.wx };
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
  var head = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><b style="font-size:13px">สภาพทะเล · '+dt.getDate()+' '+MON[dt.getMonth()]+'</b><span style="flex:1"></span>'
    + '<button type="button" class="bo-btn" style="padding:4px 10px;font-size:10px" onclick="wxFetchNow(\''+date+'\')">ดึงพยากรณ์ตอนนี้</button></div>';
  if(!WX.pts) return head+'<div style="font-size:11px;color:#6B7785">กำลังโหลด…</div>';
  var P = (WX.pts||[]).filter(function(p){ return !piers || !piers.length || piers.indexOf(p.pier)>=0; });
  if(!P.length) return head+'<div style="font-size:11px;color:#6B7785">ยังไม่ได้ตั้งจุดพยากรณ์ของท่านี้ (weather/points.json)</div>';
  var body = P.map(function(pt){
    var b = wxBest(pt.id, date);
    if(!b || b.S.wave==null) return '<div style="padding:9px 0;border-top:1px solid #EEF1F5"><b style="font-size:12px">'+wxE(pt.name)+'</b><div style="font-size:11px;color:#6B7785">ยังไม่มีข้อมูลวันนี้ · พยากรณ์ดึงอัตโนมัติ 17:00 วันก่อน และ 05:00 เช้า</div></div>';
    var S=b.S, lv=wxLevel(pt,S), c=WX_LV[lv];
    var sim = wxSimilar(pt, S, date), nRan=sim.filter(function(x){ return x.oc.k==='ran'; }).length, nCx=sim.filter(function(x){ return x.oc.k==='cx'; }).length, nPart=sim.length-nRan-nCx;
    var oc = wxOutcome(pt.id, date);
    return '<div style="padding:10px 0;border-top:1px solid #EEF1F5">'
      + '<div style="display:flex;align-items:center;gap:8px"><b style="font-size:12px;flex:1">'+wxE(pt.name)+'</b><span style="font-size:10px;font-weight:700;background:'+c[0]+';color:'+c[1]+';padding:2px 8px;border-radius:6px">'+c[2]+'</span></div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:8px">'
      +   '<div><div style="font-size:9.5px;color:#6B7785">คลื่น</div><b style="font-family:\'DM Mono\',monospace;font-size:17px;color:'+c[1]+'">'+S.wave+'<span style="font-size:10px"> m</span></b><div style="font-size:9.5px;color:#6B7785">คาบ '+S.per+' s · '+wxDirTxt(S.dir)+'</div></div>'
      +   '<div><div style="font-size:9.5px;color:#6B7785">swell</div><b style="font-family:\'DM Mono\',monospace;font-size:17px">'+(S.swell==null?'—':S.swell)+'<span style="font-size:10px"> m</span></b><div style="font-size:9.5px;color:#6B7785">'+(S.swellPer!=null?(S.swellPer+' s · '+wxDirTxt(S.swellDir)):'')+'</div></div>'
      +   '<div><div style="font-size:9.5px;color:#6B7785">ลม</div><b style="font-family:\'DM Mono\',monospace;font-size:17px">'+(S.wind==null?'—':S.wind)+'<span style="font-size:10px"> kt</span></b><div style="font-size:9.5px;color:#6B7785">กระโชก '+(S.gust==null?'—':S.gust)+' · '+wxDirTxt(S.windDir)+'</div></div>'
      +   '<div><div style="font-size:9.5px;color:#6B7785">ฝน '+S.hours[0]+'–'+S.hours[1]+' น.</div><b style="font-family:\'DM Mono\',monospace;font-size:17px">'+(S.rain==null?'—':S.rain)+'<span style="font-size:10px"> mm</span></b></div>'
      + '</div>'
      + '<div style="font-size:9.5px;color:#9B9088;margin-top:4px">'+wxKindTxt(b.kind)+(oc?(' · วันนี้: <b style="color:'+(oc.k==='cx'?'#A32D2D':'#0F6E56')+'">'+oc.t+'</b>'):'')+'</div>'
      + (sim.length ? ('<div style="margin-top:8px;background:'+c[0]+';border-radius:9px;padding:8px 10px">'
          + '<div style="font-size:11px;font-weight:700;color:'+c[1]+'">'+sim.length+' วันที่คล้ายที่สุด: ออก '+nRan+' · ยกเลิก '+nCx+(nPart?(' · บางส่วน '+nPart):'')+'</div>'
          + '<div style="font-size:10.5px;color:'+c[1]+';margin-top:3px;line-height:1.5">'+sim.map(function(x){ var d2=new Date(x.d+'T12:00:00'); return d2.getDate()+' '+MON[d2.getMonth()]+' <span style="font-family:\'DM Mono\',monospace">'+x.S.wave+'m/'+x.S.per+'s</span> '+x.oc.t; }).join(' · ')+'</div></div>')
        : '<div style="font-size:10.5px;color:#9B9088;margin-top:6px">ยังไม่มีวันที่คล้ายกันในประวัติ · กด "ดึงย้อนหลัง" ด้านล่างเพื่อเติมข้อมูลตั้งแต่ มิ.ย.</div>')
      + '</div>';
  }).join('');
  var bf = WX.bf;
  var foot = '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #EEF1F5;font-size:10px;color:#6B7785">'
    + (bf && bf.running ? ('<span>ดึงย้อนหลัง… '+bf.done+'/'+bf.total+(bf.failed?(' · ผิดพลาด '+bf.failed):'')+'</span>') : (bf && bf.finishedAt ? ('<span>ย้อนหลังเสร็จ · ใหม่ '+bf.done+' · มีแล้ว '+bf.skipped+(bf.failed?(' · ผิดพลาด '+bf.failed):'')+'</span>') : '<span>ประวัติ: คลื่นจริงย้อนหลัง + ผลจากใบจอง (ออก / ยกเลิกเพราะอากาศ)</span>'))
    + '<span style="flex:1"></span><button type="button" class="bo-btn" style="padding:4px 10px;font-size:10px" onclick="wxBackfill()">ดึงย้อนหลัง</button></div>';
  return head+body+foot;
}
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
