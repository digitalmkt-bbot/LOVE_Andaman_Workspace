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
  /* §wxLatest · today and ahead: the freshest forecast (fc, refreshed every 3 h) · fc05 / fc17 are kept only as the
     record of what the office saw when it decided (history uses them) · past days: the analysed actual */
  var k = past ? (o.hist ? 'hist' : o.fc05 ? 'fc05' : o.fc17 ? 'fc17' : 'fc') : (o.fc ? 'fc' : o.fc05 ? 'fc05' : o.fc17 ? 'fc17' : 'hist');
  return o[k] ? { kind:k, S:o[k].summary||{}, at:o[k].taken_at } : null;
}
function wxHM(iso){ if(!iso) return ''; var d = new Date(iso); if(isNaN(d)) return String(iso).slice(11,16); var h = d.getHours(), m = d.getMinutes(); return (h<10?'0':'')+h+':'+(m<10?'0':'')+m; }   /* local time, not UTC */
function wxKindTxt(k){ return k==='hist' ? 'ข้อมูลจริง (วิเคราะห์หลังวัน)' : k==='fc05' ? 'พยากรณ์ 05:00 วันออกเรือ' : k==='fc' ? 'พยากรณ์ล่าสุด (อัปเดตทุก 3 ชม.)' : 'พยากรณ์ 17:00 วันก่อน'; }
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
/* §wx7 · the wave row sits directly above the first route that uses its forecast point
   (owner: "คลื่น เอาไปแทรกไว้บนหัว variant นั้นๆ") · list = the routes shown under this pier, in order */
function wxRowFor(route, dates, list){
  if(!WX.pts){ return (list && list[0]===route) ? '<div class="bop2-cell" style="grid-column:1/-1;padding:0;min-height:0" data-wx-pier="'+wxE(route.pier||'')+'"></div>' : ''; }
  var pt = wxPtFor(route); if(!pt) return '';
  for(var i=0;i<(list||[]).length;i++){ if(list[i]===route) break; var p2=wxPtFor(list[i]); if(p2 && p2.id===pt.id) return ''; }
  return wxRowOne(pt, dates);
}
function wxRowHtml(pier, dates){
  var P = WX.pts ? wxPtsOf(pier) : null;
  if(!P) return '<div class="bop2-cell" style="grid-column:1/-1;padding:0;min-height:0" data-wx-pier="'+wxE(pier)+'"></div>';
  return P.map(function(pt){ return wxRowOne(pt, dates); }).join('');
}
function wxRowOne(pt, dates){
  {
    return '<div class="bop2-cell bop2-cell-route" style="font-size:10px;color:#0E7490;font-weight:700;min-height:24px;padding:6px 8px 0;align-items:flex-end" title="'+wxE(pt.name)+' · จุดพยากรณ์กลางทะเล">'
      +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:5px;flex:none"><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>คลื่น · '+wxE(pt.name.split(' · ')[0])+'</div>'
      + dates.map(function(d){ return '<div class="bop2-cell" style="min-height:24px;padding:4px 2px 0" data-wx="'+wxE(pt.id)+'|'+d+'">'+wxCellHtml(pt,d)+'</div>'; }).join('');
  }
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
    /* §wxFix · cancelled_weather is the status of EVERY trip-level cancel (§tripCxl) · only the weather reason
       is a sea outcome · "ไม่ถึงคุ้มทุน" / "ไม่มีเรือ" / อื่นๆ count as plain cancels */
    if(wx && typeof tcxBkReason==='function'){ var why = 'weather'; try{ why = tcxBkReason(b) || 'weather'; }catch(_){ } if(why!=='weather'){ wx = false; cx = true; } }
    (b.trips||[]).forEach(function(t){
      var pid = rp[t.routeId]; if(!pid || !t.date) return;
      var k = pid+'|'+t.date, o = idx[k] = idx[k] || { ok:0, wx:0 };
      if(wx) o.wx++; else if(!cx) o.ok++;
      if(!cx && !wx){ var tbe = wxTbPier(b, t); if(tbe) (o.tb = o.tb || []).push(tbe); }   /* §wxTb */
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
/* §wx4 · icons + sky · card redrawn (owner: "วาดใหม่ · สวยงาม · มีครบ คลื่น ลม ฝน แดด") */
var WX_IC = {
  wave:'<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  wind:'<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  rain:'<path d="M7 15a5 5 0 1 1 9.6-2H17a3.5 3.5 0 0 1 0 7"/><path d="M9 18l-1 3M13 18l-1 3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  partly:'<circle cx="8" cy="8" r="3"/><path d="M8 2v1M2 8h1M3.8 3.8l.7.7M12.2 3.8l-.7.7"/><path d="M9 18a4 4 0 1 1 3.9-5H14a3 3 0 0 1 0 6H9z"/>',
  cloud:'<path d="M7 18a5 5 0 1 1 4.9-6H13a3.5 3.5 0 0 1 0 7H7z"/>',
  storm:'<path d="M7 14a5 5 0 1 1 9.6-2H17a3.5 3.5 0 0 1 0 7h-2"/><path d="M11 13l-2 4h3l-2 4"/>'
};
function wxIco(k, c, s){ return '<svg width="'+(s||14)+'" height="'+(s||14)+'" viewBox="0 0 24 24" fill="none" stroke="'+(c||'currentColor')+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">'+WX_IC[k]+'</svg>'; }
function wxSky(S){
  var code=+S.code||0, cl=S.cloud, rain=+S.rain||0;
  if(code>=95) return { k:'storm', t:'พายุ', c:'#6D28D9' };
  if(rain>=5 || (code>=61 && code<95)) return { k:'rain', t:'ฝนตก', c:'#2563EB' };
  if(rain>=1 || (code>=51 && code<61)) return { k:'rain', t:'ฝนปรอย', c:'#3B82F6' };
  if(cl==null) return rain>0 ? { k:'cloud', t:'มีเมฆ', c:'#64748B' } : { k:'partly', t:'—', c:'#94A3B8' };
  if(cl<30) return { k:'sun', t:'แดด', c:'#D97706' };
  if(cl<70) return { k:'partly', t:'เมฆบาง', c:'#B45309' };
  return { k:'cloud', t:'เมฆมาก', c:'#64748B' };
}
/* ══ §wx5 · summary card (right column) + expandable hourly strip above the grid (2026-10-30) ══════
   Owner picked mockup 6: "การ์ดในคอลัมน์ขวาเป็นตัวสรุปของวันนั้น · มีปุ่ม Expand ขยายดูทั้งหมดเป็นแบบ 5B
                           · ให้กดตัดสินใจในหน้าสรุปได้เลย"
   Card: per point · sky icon, name, level pill, one-line reason, max wave / wind / rain, hourly wave bar,
         history verdict, decision select + reason (today and tomorrow only).
   Strip: per point · hourly sky / wave+period / wind+dir+gust / rain over the point's sailing window.
   Hourly arrays come from /api/weather?hourly=1 for the selected date only, cached per date. */
WX.hr = {}; WX.hrLoad = {};
try{ WX.exp = localStorage.getItem('la_wx_exp') === '1'; }catch(_){ WX.exp = false; }
function wxToggleExp(){ WX.exp = !WX.exp; try{ localStorage.setItem('la_wx_exp', WX.exp ? '1' : '0'); }catch(_){ } wxPatch(); var s=document.getElementById('wx-strip'); if(WX.exp && s) try{ s.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(_){ } }
function wxLoadHr(date){
  if(WX.hrLoad[date]) return; WX.hrLoad[date] = 1;
  wxFetch('/api/weather?from='+date+'&to='+date+'&hourly=1')
    .then(function(j){ (j.rows||[]).forEach(function(r){ var k=r.point_id+'|'+r.date; (WX.hr[k]=WX.hr[k]||{})[r.kind]=r.hourly; }); wxIngest(j.rows); })
    .catch(function(e){ WX.hrLoad[date] = 0; try{ console.warn('[wx] hourly', e.message); }catch(_){ } })
    .then(function(){ wxPatch(); });
}
function wxLoadHrRange(from, to){   /* §wx5d · one request for the 5-day view */
  var need = []; for(var d = from; d <= to; d = wxAddDays(d, 1)) if(!WX.hrLoad[d]) need.push(d);
  if(!need.length) return; need.forEach(function(d){ WX.hrLoad[d] = 1; });
  wxFetch('/api/weather?from='+need[0]+'&to='+need[need.length-1]+'&hourly=1')
    .then(function(j){ (j.rows||[]).forEach(function(r){ var k=r.point_id+'|'+r.date; (WX.hr[k]=WX.hr[k]||{})[r.kind]=r.hourly; }); wxIngest(j.rows); })
    .catch(function(e){ need.forEach(function(d){ WX.hrLoad[d] = 0; }); try{ console.warn('[wx] hourly', e.message); }catch(_){ } })
    .then(function(){ wxPatch(); });
}
function wxHours(pt, date, all){
  var b = wxBest(pt.id, date); if(!b) return null;
  var H = (WX.hr[pt.id+'|'+date]||{})[b.kind]; if(!H || !H.time) return null;
  var h0 = (pt.hours||[6,15])[0], h1 = (pt.hours||[6,15])[1], out = [];
  H.time.forEach(function(t, i){ var h = +String(t).slice(11,13); if(!all && (h < h0 || h > h1)) return;
    out.push({ h:h, wave:(H.wave_height||[])[i], per:(H.wave_period||[])[i], wdir:(H.wave_direction||[])[i],
               wind:(H.wind_speed_10m||[])[i], gust:(H.wind_gusts_10m||[])[i], dir:(H.wind_direction_10m||[])[i],
               rain:(H.precipitation||[])[i], cloud:(H.cloud_cover||[])[i], code:(H.weather_code||[])[i],
               temp:(H.temperature_2m||[])[i], feels:(H.apparent_temperature||[])[i] }); });   /* §wx5d */
  return out;
}
function wxHrSky(x){
  var code = +x.code || 0, r = +x.rain || 0, cl = x.cloud;
  if(code >= 95) return 'storm';
  if(r >= 0.5 || (code >= 51 && code < 95)) return 'rain';
  if(cl == null) return r > 0 ? 'rain' : 'partly';
  return cl >= 70 ? 'cloud' : cl >= 30 ? 'partly' : 'sun';
}
var WX_SKY_SVG = {
  sun:'<circle cx="12" cy="12" r="4" fill="#FCD34D" stroke="#F59E0B"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="#F59E0B"/>',
  partly:'<circle cx="8" cy="8" r="3.5" fill="#FCD34D" stroke="#F59E0B"/><path d="M9 19a4 4 0 1 1 3.9-5H14a3 3 0 0 1 0 6H9z" fill="#E2E8F0" stroke="#94A3B8"/>',
  cloud:'<path d="M7 18a5 5 0 1 1 4.9-6H13a3.5 3.5 0 0 1 0 7H7z" fill="#CBD5E1" stroke="#64748B"/>',
  rain:'<path d="M7 15a5 5 0 1 1 9.6-2H17a3.5 3.5 0 0 1 0 7H7z" fill="#CBD5E1" stroke="#64748B"/><path d="M9 19l-1 3M13 19l-1 3" stroke="#2563EB"/>',
  storm:'<path d="M7 14a5 5 0 1 1 9.6-2H17a3.5 3.5 0 0 1 0 7h-2" fill="#94A3B8" stroke="#475569"/><path d="M11 13l-2 4h3l-2 4" stroke="#F59E0B" stroke-width="2"/>'
};
var WX_SKY_TH = { sun:'แดด', partly:'เมฆบางส่วน', cloud:'เมฆมาก', rain:'ฝน', storm:'ฝนฟ้าคะนอง' };
function wxSkySvg(k, s){ return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="'+WX_SKY_TH[k]+'" style="flex:none">'+WX_SKY_SVG[k]+'</svg>'; }
function wxWaveC(pt, w){ if(w == null) return ['#F1F5F9','#94A3B8','#E2E8F0'];
  var a = pt.warn||1.5, r = pt.risk||2;
  if(w >= r + 0.5) return ['#FECACA','#991B1B','#EF4444'];
  if(w >= r)       return ['#FED7AA','#9A3412','#FB923C'];
  if(w >= a)       return ['#FEF3C7','#92400E','#FCD34D'];
  return ['#D1FAE5','#065F46','#6EE7B7']; }
function wxWindBg(k){ return k >= 20 ? '#FDE68A' : k >= 15 ? '#BBF7D0' : k >= 10 ? '#CFFAFE' : '#F0F9FF'; }
function wxRange(hrs, f){ var m = hrs.filter(f); if(!m.length) return ''; var a = m[0].h, b = m[m.length-1].h; return (a<10?'0':'')+a+(a===b?'':'–'+(b<10?'0':'')+b)+' น.'; }
/* one phrase that says what the day is like at this point */
function wxDayTxt(pt, S, hrs){
  var bits = [];
  if(hrs && hrs.length){
    var st = wxRange(hrs, function(x){ return wxHrSky(x)==='storm'; }), rn = wxRange(hrs, function(x){ var k=wxHrSky(x); return k==='rain'||k==='storm'; });
    if(st) bits.push('ฝนฟ้าคะนอง '+st); else if(rn) bits.push('ฝน '+rn);
    var hi = wxRange(hrs, function(x){ return x.wave != null && x.wave >= (pt.risk||2); });
    if(hi) bits.push('คลื่นสูง '+hi);
  } else if((+S.rain||0) >= 1) bits.push('ฝน '+S.rain+' mm');
  if(S.perMin != null && S.perMin <= 5 && S.wave >= (pt.warn||1.5)) bits.push('คาบคลื่นสั้น '+S.perMin+'s');
  if(!bits.length){ var sk = wxSky(S); bits.push(sk.k==='sun' ? 'แดดเป็นส่วนใหญ่ · ทะเลเรียบ' : sk.k==='cloud' ? 'เมฆมาก · ทะเลเรียบ' : 'ทะเลเรียบ'); }
  return bits.join(' · ');
}
function wxDaySky(S, hrs){
  if(hrs && hrs.length){ var ks = hrs.map(wxHrSky); if(ks.indexOf('storm')>=0) return 'storm'; if(ks.filter(function(k){ return k==='rain'; }).length >= 2) return 'rain';
    var n = { sun:0, partly:0, cloud:0, rain:0 }; ks.forEach(function(k){ n[k] = (n[k]||0)+1; }); return n.sun >= n.partly && n.sun >= n.cloud ? 'sun' : n.cloud > n.partly ? 'cloud' : 'partly'; }
  return wxSky(S).k === 'rain' ? 'rain' : wxSky(S).k === 'storm' ? 'storm' : wxSky(S).k === 'sun' ? 'sun' : wxSky(S).k === 'cloud' ? 'cloud' : 'partly';
}
function wxVerdict(pt, S, date){
  var sim = wxSimilar(pt, S, date), nCx = sim.filter(function(x){ return x.oc.k==='cx'; }).length, nRough = sim.filter(function(x){ return x.oc.k==='rough'||x.oc.k==='bumpy'; }).length, nRan = sim.filter(function(x){ return x.oc.k==='ran'; }).length;
  var MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var tip = sim.length ? ('วันที่คล้ายกัน '+sim.length+' วัน · ปกติ '+nRan+' · โยน/แรง '+nRough+' · ยกเลิก '+nCx+'\n'+sim.map(function(x){ var d2=new Date(x.d+'T12:00:00'); return d2.getDate()+' '+MON[d2.getMonth()]+' · '+x.S.wave+' m / '+x.S.per+' s → '+x.oc.t; }).join('\n')) : 'ยังไม่มีวันที่คล้ายกันในประวัติ · กด "ดึงย้อนหลัง"';
  if(!sim.length) return { t:'ยังไม่มีประวัติ', c:'#94A3B8', tip:tip };
  if(nCx >= 3) return { t:'ที่ผ่านมามักยกเลิก', c:'#B91C1C', tip:tip };
  if(nCx + nRough >= 3) return { t:'ที่ผ่านมาออกได้แต่โยน', c:'#B45309', tip:tip };
  return { t:'ที่ผ่านมาออกได้ปกติ', c:'#047857', tip:tip };
}
var WX_CSS = '<style>'
  + '#wx-card{padding:0!important;overflow:hidden}'
  + '.wx-hd{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#0E3B5C,#1683C7);color:#fff}'
  + '.wx-hd b{font-size:14px;font-weight:800}.wx-hd i{display:block;font-style:normal;font-size:10px;opacity:.8;margin-top:1px}'
  + '.wx-hb{height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.14);color:#fff;font:700 11px inherit;cursor:pointer;display:inline-flex;align-items:center;gap:5px}'
  + '.wx-hb.ic{width:28px;padding:0;justify-content:center}'
  + '.wx-rw{padding:10px 14px;border-top:1px solid #EEF1F5;position:relative}'
  + '.wx-rw:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--lc)}'
  + '.wx-pl{font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:999px;white-space:nowrap}'
  + '.wx-n{display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums}'
  + '.wx-n span{font-size:8.5px;color:#94A3B8;white-space:nowrap}.wx-n b{font:700 14.5px "DM Mono",monospace;line-height:1.1;white-space:nowrap}.wx-n b small{font-size:9px;font-weight:500;color:#64748B}'
  + '.wx-dc{display:flex;gap:5px;margin-top:7px;align-items:center}'
  + '.wx-dc select{height:26px;border-radius:999px;padding:0 8px;font:700 10.5px inherit;background:#fff;max-width:160px;cursor:pointer}'
  + '.wx-dc input{flex:1;min-width:0;height:26px;border:1px solid #E2E8F0;border-radius:999px;padding:0 10px;font:10.5px inherit;background:#F8FAFC}'
  + '.wx-ft{display:flex;align-items:center;gap:8px;padding:8px 14px;background:#FAFBFC;border-top:1px solid #EEF1F5;font-size:9.5px;color:#64748B;flex-wrap:wrap}'
  + '#wx-strip .wx-sg{display:grid;row-gap:2px;align-items:center;font-variant-numeric:tabular-nums}'
  + '#wx-strip .wx-sg>span{min-width:0}'
  + '.wx-chip{height:24px;padding:0 10px;border-radius:999px;border:1.5px dashed #CBD5E1;background:#fff;color:#64748B;font:700 10.5px inherit;cursor:pointer;white-space:nowrap;flex:none}'
  + '.wx-chip:hover{border-color:#1683C7;color:#1683C7}'
  + '#wx-decmenu .wx-mi{width:100%;display:flex;align-items:center;gap:8px;padding:7px 8px;border:0;background:transparent;border-radius:8px;font:600 12px "DM Sans","IBM Plex Sans Thai",sans-serif;text-align:left;cursor:pointer}'
  + '#wx-decmenu .wx-mi:hover{background:#F1F5F9}#wx-decmenu .wx-mi.on{background:#F8FAFC;font-weight:800}'
  + '#wx-decmenu .dot{width:8px;height:8px;border-radius:4px;flex:none}'
  + '#wx-decmenu input{height:30px;border:1px solid #E2E8F0;border-radius:8px;padding:0 9px;font:11.5px "DM Sans","IBM Plex Sans Thai",sans-serif}'
  + '#wx-decmenu .wx-mb{height:28px;padding:0 12px;border-radius:8px;border:0;background:#1683C7;color:#fff;font:700 11px "DM Sans","IBM Plex Sans Thai",sans-serif;cursor:pointer}'
  + '#wx-decmenu .wx-mb.ghost{background:#fff;color:#64748B;border:1px solid #E2E8F0}'
  + '.wx-tb{display:flex;align-items:center;gap:4px;font-size:10px;color:#7A4300;background:#FFF7ED;border:1px solid #FED7AA;border-radius:7px;padding:2px 7px;white-space:nowrap;overflow:hidden;min-width:0}'
  + '.wx-tb i{font-style:normal;color:#9A6B3F;overflow:hidden;text-overflow:ellipsis;min-width:0}.wx-tb .src{margin-left:auto;font-size:8.5px;color:#B08458;flex:none;padding-left:4px}'
  + '#wx-decmenu .wx-tbsec{border-top:1px solid #EEF1F5;margin-top:6px;padding:7px 6px 3px}'
  + '#wx-decmenu .wx-tbh{display:flex;align-items:center;font-size:10.5px;font-weight:800;color:#7A4300;margin-bottom:5px}'
  + '#wx-decmenu .wx-tbr{display:flex;align-items:center;gap:5px;font-size:10.5px;padding:4px 6px;border-radius:7px;background:#FFF7ED;margin-bottom:3px}'
  + '#wx-decmenu .wx-tbr .x{margin-left:auto;border:0;background:none;color:#A32D2D;cursor:pointer;font-size:12px;padding:0 2px}'
  + '#wx-decmenu .wx-tbf{display:none;flex-direction:column;gap:6px;margin-top:4px;padding:8px;border:1px solid #FED7AA;border-radius:9px;background:#FFFBF5}'
  + '#wx-decmenu .wx-tbf.on{display:flex}'
  + '#wx-decmenu .wx-tbf select,#wx-decmenu .wx-tbf input{height:28px;border:1px solid #E2E8F0;border-radius:7px;padding:0 7px;font:12px "DM Sans","IBM Plex Sans Thai",sans-serif;background:#fff;min-width:0}'
  + '#wx-decmenu .wx-tbo{display:grid;grid-template-columns:1fr 1fr;gap:4px}'
  + '#wx-decmenu .wx-tbo button{height:26px;border:1px solid #E2E8F0;border-radius:7px;background:#fff;font:600 11px "DM Sans","IBM Plex Sans Thai",sans-serif;cursor:pointer;color:#475569}'
  + '#wx-decmenu .wx-tbo button.on{border-color:#C2410C;background:#FFEDD5;color:#9A3412}'
  + '#wx-decmenu .wx-tbadd{width:100%;height:28px;border:1.5px dashed #FDBA74;border-radius:8px;background:#fff;color:#C2410C;font:700 11px "DM Sans","IBM Plex Sans Thai",sans-serif;cursor:pointer}'
  + '#wx-pop{position:fixed;inset:0;z-index:10000;background:rgba(9,16,40,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:28px;font-family:"DM Sans","IBM Plex Sans Thai",sans-serif;color:#0F1B3D}'
  + '#wx-pop .wx-pbox{width:min(1400px,100%);max-height:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);display:flex;flex-direction:column}'
  + '#wx-pop .wx-pbody{overflow:auto;flex:1;min-height:0}'
  + '#wx-pop .wx-pgrp{display:flex;gap:3px;background:rgba(255,255,255,.12);padding:3px;border-radius:999px}'
  + '#wx-pop .wx-pseg{height:26px;padding:0 12px;border-radius:999px;border:0;background:transparent;color:#fff;font:600 11px inherit;cursor:pointer;white-space:nowrap}'
  + '#wx-pop .wx-pseg.on{background:#fff;color:#0E3B5C;font-weight:800}'
  + '#wx-pop .wx-sg{display:grid;align-items:center;font-variant-numeric:tabular-nums}'
  + '#wx-pop .wx-hs{padding:16px 20px;border-bottom:1px solid #EEF1F5}'
  + '#wx-pop .wx-hs h4{margin:0 0 10px;font-size:12px;color:#64748B;font-weight:700}'
  + '#wx-pop .wx-hbar{display:grid;grid-template-columns:96px 1fr 150px;align-items:center;gap:10px;margin-bottom:7px;font-size:11.5px}'
  + '#wx-pop .wx-hbar .tr{display:flex;height:22px;border-radius:6px;overflow:hidden;background:#F1F5F9}'
  + '#wx-pop .wx-hbar .tr span{display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;min-width:0;overflow:hidden}'
  + '#wx-pop .wx-hsug{background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;padding:12px 14px;font-size:12px;line-height:1.65;color:#0C4A6E}'
  + '#wx-pop .wx-hsug b{color:#075985}'
  + '#wx-pop .wx-htb{width:100%;border-collapse:collapse;font-size:11.5px;font-variant-numeric:tabular-nums}'
  + '#wx-pop .wx-htb th{position:sticky;top:0;background:#F8FAFC;text-align:left;font-size:10px;color:#64748B;padding:7px 10px;border-bottom:1px solid #E2E8F0;font-weight:700;cursor:pointer;white-space:nowrap}'
  + '#wx-pop .wx-htb td{padding:6px 10px;border-bottom:1px solid #F1F5F9;vertical-align:top}'
  + '#wx-pop .wx-htb tr:hover td{background:#F8FAFC}'
  + '.wx-dbar{display:flex;align-items:center;gap:9px;margin-top:5px;padding:7px 9px;border-radius:10px;border:1px solid #E2E8F0;background:#F8FAFC;font:inherit;text-align:left;cursor:pointer;width:100%}'
  + '.wx-dbar>span:first-child{width:24px;height:24px;border-radius:12px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}'
  + '.wx-dbar b{font-size:11.5px}.wx-dbar i{font-style:normal;font-size:9.5px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px}'
  + '.wx-dbar.empty{border:1.5px dashed #CBD5E1;color:#64748B;font-size:11px;font-weight:700;justify-content:flex-start}'
  + '.wx-dbar.empty>span:first-child{background:#E2E8F0;color:#64748B}'
  + '</style>';
function wxHeadHtml(date, sub, right, compact){
  var dt = new Date(date+'T12:00:00'), MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'], WD=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
  return '<div class="wx-hd"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>'
    + '<div style="flex:1;min-width:0"><b style="white-space:nowrap">สภาพทะเล · '+(compact?'':WD[dt.getDay()]+' ')+dt.getDate()+' '+MON[dt.getMonth()]+'</b><i>'+sub+'</i></div>'+right+'</div>';
}
function wxCardBody(date, piers){
  var expBtn = '<button type="button" class="wx-hb ic" title="ประวัติ · ทะเลแบบไหนออกได้" aria-label="ประวัติทะเล" onclick="wxOpenHist()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></button>'
    + '<button type="button" class="wx-hb ic" title="ดูรายชั่วโมงทุกเส้นทาง" aria-label="ดูรายชั่วโมงทุกเส้นทาง" onclick="wxOpenPop(\''+date+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>'
    + '<button type="button" class="wx-hb ic" title="ดึงพยากรณ์ตอนนี้" aria-label="ดึงพยากรณ์ตอนนี้" onclick="wxFetchNow(\''+date+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/></svg></button>';
  var P0 = (WX.pts||[]).filter(function(p){ return !piers || !piers.length || piers.indexOf(p.pier)>=0; });
  var kinds = {}, fcAt = ''; P0.forEach(function(p){ var b=wxBest(p.id,date); if(b){ kinds[b.kind]=1; if(b.kind==='fc' && b.at > fcAt) fcAt = b.at; } });
  var sub = 'สรุปช่วงออกเรือ · '+(kinds.hist?'ข้อมูลจริง':kinds.fc?('พยากรณ์ล่าสุด '+wxHM(fcAt)):kinds.fc05?'พยากรณ์ 05:00':kinds.fc17?'พยากรณ์ 17:00 วันก่อน':'ยังไม่มีข้อมูล');
  var head = WX_CSS + wxHeadHtml(date, sub, expBtn, true);
  if(!WX.pts) return head+'<div class="wx-rw" style="font-size:11px;color:#64748B">กำลังโหลด…</div>';
  if(!P0.length) return head+'<div class="wx-rw" style="font-size:11px;color:#64748B">ยังไม่ได้ตั้งจุดพยากรณ์ของท่านี้</div>';
  if(!WX.hrLoad[date]) wxLoadHr(date);
  var canDecide = date <= wxAddDays(wxToday(), 1);
  var body = P0.map(function(pt){
    var short = wxE(pt.name.split(' · ')[0]);
    var b = wxBest(pt.id, date);
    if(!b || b.S.wave == null) return '<div class="wx-rw" style="--lc:#CBD5E1;display:flex;align-items:center;gap:8px"><b style="font-size:13px">'+short+'</b><span style="margin-left:auto;font-size:10px;color:#94A3B8">ยังไม่มีข้อมูล</span></div>';
    var S = b.S, lv = wxLevel(pt, S), hrs = wxHours(pt, date);
    var lc = lv==='risk' ? '#DC2626' : lv==='warn' ? '#F59E0B' : '#10B981';
    var pill = lv==='risk' ? ['#FEE2E2','#B91C1C','เสี่ยง'] : lv==='warn' ? ['#FEF3C7','#B45309','ระวัง'] : ['#D1FAE5','#047857','ออกได้'];
    var sky = wxDaySky(S, hrs), wc = wxWaveC(pt, S.wave), vd = wxVerdict(pt, S, date);
    var bars = hrs && hrs.length
      ? '<div style="flex:1;min-width:0"><div style="display:grid;grid-template-columns:repeat('+hrs.length+',minmax(0,1fr));gap:2px">'
        + hrs.map(function(x){ return '<span title="'+(x.h<10?'0':'')+x.h+':00 · คลื่น '+(x.wave==null?'—':x.wave)+' m · ลม '+(x.wind==null?'—':Math.round(x.wind))+' kt" style="height:8px;border-radius:2px;background:'+wxWaveC(pt,x.wave)[2]+'"></span>'; }).join('')
        + '</div><div style="display:flex;justify-content:space-between;font-size:8.5px;color:#94A3B8;margin-top:1px"><span>'+(hrs[0].h<10?'0':'')+hrs[0].h+'</span><span>'+(hrs[hrs.length-1].h<10?'0':'')+hrs[hrs.length-1].h+' น.</span></div></div>'
      : '<div style="flex:1;font-size:9px;color:#CBD5E1">…</div>';
    var decRow = wxDecChip(pt, date);
    return '<div class="wx-rw" style="--lc:'+lc+'">'
      + '<div style="display:flex;align-items:center;gap:8px">'+wxSkySvg(sky, 28)
      +   '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px"><b style="font-size:13.5px;white-space:nowrap" title="'+wxE(pt.name)+'">'+short+'</b><span class="wx-pl" style="background:'+pill[0]+';color:'+pill[1]+'">'+pill[2]+'</span></div>'
      +   '<div style="font-size:10px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+wxE(wxDayTxt(pt,S,hrs))+'">'+wxE(wxDayTxt(pt,S,hrs))+'</div></div>'
      +   '<div style="display:flex;gap:9px">'
      +     '<div class="wx-n"><span>คลื่นสูงสุด</span><b style="color:'+wc[1]+'">'+S.wave+'<small>m</small></b></div>'
      +     '<div class="wx-n"><span>ลม</span><b>'+(S.wind==null?'—':Math.round(S.wind))+'<small>kt</small></b></div>'
      +     '<div class="wx-n"><span>ฝน</span><b style="color:#2563EB">'+(S.rain==null?'—':(S.rain<0.1?'0':S.rain))+'<small>mm</small></b></div>'
      +   '</div></div>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-top:7px">'+bars+'<span title="'+wxE(vd.tip)+'" style="font-size:10px;font-weight:700;color:'+vd.c+';white-space:nowrap;cursor:help">'+vd.t+'</span></div>'
      + decRow + '</div>';
  }).join('');
  var bf = WX.bf;
  var foot = '<div class="wx-ft">'
    + (bf && bf.running ? ('<span>ดึงย้อนหลัง… '+bf.done+'/'+bf.total+'</span>') : (bf && bf.finishedAt ? ('<span>ย้อนหลังเสร็จ · ใหม่ '+bf.done+' · มีแล้ว '+bf.skipped+(bf.failed?(' · ผิดพลาด '+bf.failed):'')+'</span>') : '<span>แถบสี = คลื่นรายชั่วโมง</span>'))
    + '<span style="display:flex;align-items:center;gap:3px"><span style="width:9px;height:9px;border-radius:2px;background:#6EE7B7"></span>ปกติ</span>'
    + '<span style="display:flex;align-items:center;gap:3px"><span style="width:9px;height:9px;border-radius:2px;background:#FCD34D"></span>ระวัง</span>'
    + '<span style="display:flex;align-items:center;gap:3px"><span style="width:9px;height:9px;border-radius:2px;background:#FB923C"></span>สูง</span>'
    + '<span style="display:flex;align-items:center;gap:3px"><span style="width:9px;height:9px;border-radius:2px;background:#EF4444"></span>เสี่ยง</span>'
    + '<span style="flex:1"></span><button type="button" class="bo-btn" style="padding:2px 8px;font-size:9.5px" onclick="wxBackfill()">ดึงย้อนหลัง</button></div>';
  return head+body+foot;
}
/* ── expanded hourly strip · lives above the Boat Operation grid ── */
function wxStripHtml(date, piers){ return '<div id="wx-strip" data-date="'+wxE(date)+'" data-piers="'+wxE((piers||[]).join(','))+'" style="margin-bottom:12px">'+wxStripBody(date, piers)+'</div>'; }
function wxStripBody(date, piers){
  return '';   /* §wx6 · replaced by the floating popup (wxOpenPop) */
  if(!WX.exp || !WX.pts) return '';
  var P0 = (WX.pts||[]).filter(function(p){ return !piers || !piers.length || piers.indexOf(p.pier)>=0; });
  if(!WX.hrLoad[date]) wxLoadHr(date);
  var rows = P0.map(function(pt){
    var short = wxE(pt.name.split(' · ')[0]), b = wxBest(pt.id, date), hrs = wxHours(pt, date);
    if(!b || b.S.wave == null) return '<div style="display:flex;border-top:1px solid #EEF1F5;padding:10px 14px;font-size:11px;color:#94A3B8"><b style="color:#0F1B3D;margin-right:8px">'+short+'</b>ยังไม่มีข้อมูล</div>';
    var S = b.S, lv = wxLevel(pt, S), vd = wxVerdict(pt, S, date);
    var lc = lv==='risk' ? '#DC2626' : lv==='warn' ? '#F59E0B' : '#10B981';
    var pill = lv==='risk' ? ['#FEE2E2','#B91C1C','เสี่ยง'] : lv==='warn' ? ['#FEF3C7','#B45309','ระวัง'] : ['#D1FAE5','#047857','ออกได้'];
    var nb = 0; try{ var day=(typeof TRIPS!=='undefined'&&TRIPS[date])||{}; var rids=wxRoutesOf(pt).map(function(r){ return r.id; }); Object.keys(day).forEach(function(bid){ if(day[bid] && rids.indexOf(day[bid].route)>=0) nb++; }); }catch(_){ }
    var left = '<div style="width:210px;flex:none;padding:10px 12px;display:flex;flex-direction:column;gap:4px;border-left:4px solid '+lc+';background:#FBFCFD">'
      + '<div style="display:flex;align-items:center;gap:6px"><b style="font-size:13.5px">'+short+'</b><span class="wx-pl" style="background:'+pill[0]+';color:'+pill[1]+'">'+pill[2]+'</span></div>'
      + '<span style="font-size:10px;color:#64748B">'+wxE(pt.name.split(' · ')[1]||'')+(nb?(' · '+nb+' ลำ'):'')+'</span>'
      + '<span title="'+wxE(vd.tip)+'" style="font-size:10.5px;font-weight:700;color:'+vd.c+';cursor:help">'+vd.t+'</span>'
      + '<span style="font-size:10px;color:#64748B">'+wxE(wxDayTxt(pt,S,hrs))+'</span></div>';
    if(!hrs || !hrs.length) return '<div style="display:flex;border-top:1px solid #EEF1F5">'+left+'<div style="flex:1;padding:14px;font-size:11px;color:#94A3B8">กำลังโหลดรายชั่วโมง…</div></div>';
    var n = hrs.length, lab = 'font-size:9.5px;color:#64748B;display:flex;align-items:center;gap:3px;white-space:nowrap';
    var rad = function(i){ return i===0?'6px 0 0 6px':i===n-1?'0 6px 6px 0':'0'; };
    var g = '<div class="wx-sg" style="flex:1;min-width:0;padding:8px 12px;grid-template-columns:56px repeat('+n+',minmax(0,1fr))">'
      + '<span style="font-size:9px;color:#94A3B8">เวลา</span>' + hrs.map(function(x){ return '<span style="text-align:center;font-size:10.5px;font-weight:600;color:#64748B">'+(x.h<10?'0':'')+x.h+'</span>'; }).join('')
      + '<span></span>' + hrs.map(function(x){ return '<span style="display:flex;justify-content:center">'+wxSkySvg(wxHrSky(x),20)+'</span>'; }).join('')
      + '<span style="'+lab+'">'+wxIco('wave','#0EA5E9',11)+'คลื่น m</span>' + hrs.map(function(x,i){ var c=wxWaveC(pt,x.wave); return '<span style="text-align:center;font:600 12px \'DM Mono\',monospace;padding:4px 0;background:'+c[0]+';color:'+c[1]+';border-radius:'+rad(i)+'">'+(x.wave==null?'—':x.wave.toFixed(1))+'<span style="font-size:8.5px;font-weight:500;color:'+((x.per!=null&&x.per<=5)?'#B91C1C':'#64748B')+'"> /'+(x.per==null?'—':Math.round(x.per*10)/10)+'s</span></span>'; }).join('')
      + '<span style="'+lab+'">'+wxIco('wind','#14B8A6',11)+'ลม kt</span>' + hrs.map(function(x,i){ return '<span style="display:flex;align-items:center;justify-content:center;gap:2px;font:600 11.5px \'DM Mono\',monospace;padding:3px 0;background:'+wxWindBg(x.wind||0)+';border-radius:'+rad(i)+'"><svg width="10" height="10" viewBox="0 0 24 24" style="transform:rotate('+(((x.dir||0)+180)%360)+'deg)" aria-hidden="true"><path d="M12 3l6 16-6-4-6 4z" fill="#5B6B8C"/></svg>'+(x.wind==null?'—':Math.round(x.wind))+'<span style="font-size:8.5px;font-weight:500;color:#64748B">'+(x.gust==null?'':Math.round(x.gust))+'</span></span>'; }).join('')
      + '<span style="'+lab+'">'+wxIco('rain','#2563EB',11)+'ฝน mm</span>' + hrs.map(function(x){ return '<span style="text-align:center;font:600 10.5px \'DM Mono\',monospace;color:#2563EB">'+(x.rain>=0.1?Math.round(x.rain*10)/10:'')+'</span>'; }).join('')
      + '</div>';
    return '<div style="display:flex;border-top:1px solid #EEF1F5">'+left+g+'</div>';
  }).join('');
  var close = '<button type="button" class="wx-hb" onclick="wxToggleExp()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>ย่อ</button>';
  return WX_CSS + '<div class="bo-card" style="padding:0;overflow:hidden">'+wxHeadHtml(date, 'รายชั่วโมง · จุดพยากรณ์กลางทะเลของแต่ละเส้นทาง · ลูกศร = ลมพัดไปทาง', close)+rows+'</div>';
}
function wxDecToggle(ptId){ var el=document.getElementById('wx-dec-'+ptId); if(!el) return; el.style.display = el.style.display==='none' ? 'flex' : 'none'; }
/* ── patch in place (no full re-render) ── */
function wxPatch(){
  try{
    document.querySelectorAll('[data-wx]').forEach(function(el){ var k=el.getAttribute('data-wx').split('|'); var pt=(WX.pts||[]).filter(function(p){ return p.id===k[0]; })[0]; if(pt) el.innerHTML=wxCellHtml(pt,k[1]); });
    /* rows rendered before points were known are empty placeholders: a full re-render fills them */
    var ph = document.querySelector('[data-wx-pier]'); if(ph && WX.pts && typeof renderOp==='function' && !WX._rerendered){ WX._rerendered=true; renderOp(); return; }
    if(WX.pop && typeof wxPopRender==='function') wxPopRender();   /* §wx6 */
    var st = document.getElementById('wx-strip'); if(st){ var sp=st.getAttribute('data-piers'); st.innerHTML=wxStripBody(st.getAttribute('data-date'), sp?sp.split(','):null); }   /* §wx5 */
    var card = document.getElementById('wx-card'); if(card){ var date=(typeof _bop2!=='undefined' && _bop2.selDate) || wxToday(); var piers=card.getAttribute('data-piers'); card.innerHTML=wxCardBody(date, piers?piers.split(','):null); }
  }catch(e){ try{ console.warn('[wx] patch', e.message); }catch(_){ } }
}
function wxFetchNow(date){
  /* §wx5d · a past day → re-analyse that day · today or later → refresh the whole outlook (today..+5) */
  var url = date < wxToday() ? '/api/weather/fetch?date='+date+'&kind=hist' : '/api/weather/fetch?outlook=1';
  wxFetch(url, {method:'POST'})
    .then(function(j){ var bad=Object.keys(j.points||{}).filter(function(k){ return j.points[k] && j.points[k].error; }); if(bad.length) alert('Weather fetch failed for '+bad.map(function(k){ return k+': '+j.points[k].error; }).join(' | '));
      WX.rangeKey=''; WX.histLoaded=false; WX._rerendered=false; WX.hrLoad={}; WX.hr={}; var d=(typeof _bop2!=='undefined' && typeof bop2GetDates==='function')?bop2GetDates():[date]; wxLoad(d[0], d[d.length-1]); })
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
  var dc = dec && dec.decision;   /* §wxFix · a recorded ran_all / ran_part beats the booking inference */
  if(base.wx && !base.ok && dc!=='ran_all' && dc!=='ran_part') return { k:'cx', t:'ยกเลิก (ใบจอง)', n:base.wx, src:'bk' };
  var t = base.wx ? 'ออกบางส่วน' : 'ออก', k = base.wx ? 'part' : 'ran', src='bk';
  if(dc==='ran_all'){ t = 'ออกทุกลำ'; k = 'ran'; src = 'dec'; }
  else if(dc==='ran_part'){ t = 'ออกบางลำ'; k = 'part'; src = 'dec'; }
  if(seaMax){ t += ' · กัปตัน '+seaMax+' '+WX_SEA[seaMax]; src='rep'; if(seaMax>=3) k = seaMax>=4 ? 'rough' : 'bumpy'; }
  else if(fuelMax!=null && fuelMax >= 20){ t += ' · น้ำมัน +'+fuelMax+'%'; src='est'; k = fuelMax >= 35 ? 'rough' : 'bumpy'; }
  else if(fuelMax!=null){ src='est'; }
  if(flags.length) t += ' · ' + flags.map(function(f){ var x=WX_FLAGS.filter(function(y){ return y[0]===f; })[0]; return x?x[1]:f; }).join(', ');
  var tbl = wxTbList(ptId, date, base.tb);   /* §wxTb · ⛵ เรือตีกลับ */
  if(tbl.length){
    t += ' · ⛵ ตีกลับ '+tbl.length+' ลำ ('+tbl.map(function(e){ return (WX_TB[e.reason]||WX_TB.other)[0]; }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ')+')';
    if(k==='ran' && tbl.some(function(e){ return e.reason==='sea' || e.reason==='guest'; })) k = 'bumpy';
    if(k==='bumpy' && tbl.some(function(e){ return e.reason==='sea'; })) k = 'rough';
  }
  return { k:k, t:t, n:base.ok, src:src, sea:seaMax, fuelPct:fuelMax, tb:tbl };
}
function wxOutColor(k){ return k==='cx' ? '#A32D2D' : k==='rough' ? '#A32D2D' : k==='bumpy' ? '#854F0B' : k==='part' ? '#854F0B' : '#0F6E56'; }
/* ── decision block in the card ── */
function wxDecisionHtml(pt, date){
  var dec = WX.dec[pt.id+'|'+date] || {};
  var chips = WX_DEC.map(function(d){ var on = dec.decision===d[0];
    return '<button type="button" onclick="wxDecide(\''+pt.id+'\',\''+date+'\',\''+d[0]+'\')" style="height:24px;padding:0 9px;border-radius:12px;border:1px solid '+(on?d[2]:'#D7DBE2')+';background:'+(on?d[2]:'#fff')+';color:'+(on?'#fff':'#1A2A33')+';font:600 10px inherit;cursor:pointer">'+d[1]+'</button>'; }).join('');
  return '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #E3E7EE">'
    + '<div style="font-size:9.5px;color:#6B7785;margin-bottom:5px">บันทึกการตัดสินใจ · '+wxE(pt.name.split(' · ')[0])+(dec.decision?(' · <b style="color:#1A2A33">'+wxDecTxt(dec.decision)+'</b> · '+wxE(dec.by_user||'')+' '+wxHM(dec.at)):'')+'</div>'
    + '<div style="display:flex;gap:4px;flex-wrap:wrap">'+chips+'</div>'
    + '<div style="display:flex;gap:6px;margin-top:6px"><input type="text" id="wx-why-'+wxE(pt.id)+'" value="'+wxE(dec.reason||'')+'" placeholder="เหตุผล / สิ่งที่เห็น (ไม่บังคับ)" style="flex:1;height:26px;border:1px solid #D7DBE2;border-radius:7px;padding:0 8px;font:11px inherit">'
    + (dec.decision ? '<button type="button" class="bo-btn" style="padding:0 10px;font-size:10px;height:26px" onclick="wxDecide(\''+pt.id+'\',\''+date+'\',\''+dec.decision+'\')">บันทึกเหตุผล</button><button type="button" class="bo-btn" style="padding:0 8px;font-size:10px;height:26px" title="ลบการตัดสินใจ" onclick="wxDecide(\''+pt.id+'\',\''+date+'\',\'\')">✕</button>' : '')
    + '</div></div>';
}
function wxDecide(ptId, date, code, why){
  var inp = document.getElementById('wx-why-'+ptId); var reason = (why != null) ? why : (inp ? inp.value : '');
  wxFetch('/api/weather/decision', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pointId:ptId, date:date, decision:code, reason:reason }) })
    .then(function(j){ var k=ptId+'|'+date, old=WX.dec[k]||{};
      if(!code){ if(wxTbArr(old.turnbacks).length){ old.decision=null; old.reason=null; } else delete WX.dec[k]; }
      else WX.dec[k]=Object.assign({}, old, { point_id:ptId, date:date, decision:code, reason:reason, by_user:j.by, at:j.at });
      _wxOutIdx=null; wxPatch(); })
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

/* ══ §wx6 · decision chip + menu (mockup 7B) · hourly popup (mockup 8 with 7D bars) · 2026-10-30 ═══
   Owner: "ตามแนะนำ" → card uses the chip + pop-up menu, the expanded view is a floating popup whose left
   column shows each route's decision as a coloured bar (click it to change). */
function wxDecMeta(code){ var d = WX_DEC.filter(function(x){ return x[0]===code; })[0]; return d || null; }
var WX_DEC_IC = { ran_all:'✓', ran_part:'◐', cx_us:'✕', cx_port:'⚓', cx_park:'⛔', reroute:'⇄' };
var WX_DEC_BG = { ran_all:['#ECFDF5','#A7F3D0'], ran_part:['#FFFBEB','#FDE68A'], cx_us:['#FEF2F2','#FECACA'], cx_port:['#F1F5F9','#CBD5E1'], cx_park:['#F1F5F9','#CBD5E1'], reroute:['#EFF6FF','#BFDBFE'] };
/* B · chip under a card row */
function wxDecChip(pt, date){
  var dec = WX.dec[pt.id+'|'+date] || {}, m = dec.decision ? wxDecMeta(dec.decision) : null;
  var canDecide = date <= wxAddDays(wxToday(), 1);
  if(!canDecide && !m) return wxTbLines(pt, date);
  var chip = m
    ? '<button type="button" class="wx-chip" '+(canDecide?'onclick="wxDecMenu(this,\''+pt.id+'\',\''+date+'\')"':'disabled')+' style="background:'+m[2]+';border-color:'+m[2]+';color:#fff">'+(WX_DEC_IC[m[0]]||'')+' '+m[1]+(canDecide?' ▾':'')+'</button>'
    : '<button type="button" class="wx-chip" onclick="wxDecMenu(this,\''+pt.id+'\',\''+date+'\')">ตัดสินใจ ▾</button>';
  return '<div style="display:flex;align-items:center;gap:6px;margin-top:7px;min-width:0">'+chip
    + (dec.reason ? '<span style="font-size:10px;color:#64748B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0" title="'+wxE(dec.reason)+'">“'+wxE(dec.reason)+'”</span>' : '')
    + (dec.by_user ? '<span style="margin-left:auto;font-size:9px;color:#94A3B8;white-space:nowrap">'+wxE(dec.by_user)+' '+wxHM(dec.at)+'</span>' : '')
    + '</div>' + wxTbLines(pt, date);
}
/* D · bar in the popup's left column */
function wxDecBar(pt, date){
  var dec = WX.dec[pt.id+'|'+date] || {}, m = dec.decision ? wxDecMeta(dec.decision) : null;
  var canDecide = date <= wxAddDays(wxToday(), 1);
  if(!m) return (canDecide
    ? '<button type="button" class="wx-dbar empty" onclick="wxDecMenu(this,\''+pt.id+'\',\''+date+'\')"><span>+</span>บันทึกว่าวันนี้ออกหรือไม่</button>'
    : '<div class="wx-dbar empty" style="cursor:default"><span>–</span>ไม่ได้บันทึก</div>') + wxTbLines(pt, date);
  var bg = WX_DEC_BG[m[0]] || ['#F8FAFC','#E2E8F0'];
  return '<button type="button" class="wx-dbar" '+(canDecide?'onclick="wxDecMenu(this,\''+pt.id+'\',\''+date+'\')"':'disabled')+' style="background:'+bg[0]+';border-color:'+bg[1]+'">'
    + '<span style="background:'+m[2]+'">'+(WX_DEC_IC[m[0]]||'')+'</span><span style="display:flex;flex-direction:column;align-items:flex-start;min-width:0;background:none;width:auto;height:auto;border-radius:0">'
    + '<b style="color:'+m[2]+'">'+m[1]+'</b><i>'+(dec.reason?('“'+wxE(dec.reason)+'” · '):'')+wxE(dec.by_user||'')+' '+wxHM(dec.at)+'</i></span></button>' + wxTbLines(pt, date);
}
/* the menu · one floating panel at a time */
function wxDecMenuClose(){ var m = document.getElementById('wx-decmenu'); if(m) m.remove(); document.removeEventListener('mousedown', wxDecMenuOut, true); }
function wxDecMenuOut(e){ var m = document.getElementById('wx-decmenu'); if(m && !m.contains(e.target)) wxDecMenuClose(); }
function wxDecMenu(btn, ptId, date){
  var was = document.getElementById('wx-decmenu'); if(was && was.getAttribute('data-k') === ptId+'|'+date){ wxDecMenuClose(); return; }
  wxDecMenuClose();
  var pt = (WX.pts||[]).filter(function(p){ return p.id===ptId; })[0] || { name:ptId };
  var dec = WX.dec[ptId+'|'+date] || {};
  var dt = new Date(date+'T12:00:00');
  var el = document.createElement('div'); el.id = 'wx-decmenu'; el.setAttribute('data-k', ptId+'|'+date);
  el.innerHTML = WX_CSS + '<div style="font-size:10px;color:#94A3B8;padding:4px 8px 6px">ผลการตัดสินใจ · '+wxE(pt.name.split(' · ')[0])+' '+dt.getDate()+'/'+(dt.getMonth()+1)+'</div>'
    + WX_DEC.map(function(d){ var on = dec.decision===d[0];
        return '<button type="button" class="wx-mi'+(on?' on':'')+'" style="color:'+d[2]+'" data-code="'+d[0]+'"><span class="dot" style="background:'+d[2]+'"></span>'+d[1]+(on?'<span style="margin-left:auto">✓</span>':'')+'</button>'; }).join('')
    + '<div style="border-top:1px solid #EEF1F5;margin-top:4px;padding:7px 6px 3px"><label style="display:flex;flex-direction:column;gap:3px"><span style="font-size:9.5px;color:#94A3B8">เหตุผล (ไม่บังคับ)</span>'
    + '<input type="text" id="wx-decwhy" value="'+wxE(dec.reason||'')+'" placeholder="เช่น คลื่นเกิน 2.5 ม. ช่วงบ่าย"></label>'
    + '<div style="display:flex;gap:6px;margin-top:7px">'
    + (dec.decision ? '<button type="button" class="wx-mb ghost" data-act="clear">ล้าง</button>' : '')
    + '<button type="button" class="wx-mb" data-act="save" style="margin-left:auto">'+(dec.decision?'บันทึกเหตุผล':'ปิด')+'</button></div></div>'
    + wxTbMenuHtml(ptId, date);
  document.body.appendChild(el);
  var r = btn.getBoundingClientRect(), W = 290;
  var left = Math.min(window.innerWidth - W - 10, Math.max(10, r.right - W));
  el.style.cssText = 'position:fixed;z-index:10050;left:'+left+'px;top:0;width:'+W+'px;max-height:'+(window.innerHeight-20)+'px;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 14px 36px rgba(15,27,61,.25);border:1px solid #E2E8F0;padding:6px;font-family:"DM Sans","IBM Plex Sans Thai",sans-serif';
  var wxPlace = function(){ var h = el.offsetHeight, top = r.bottom + 6; if(top + h > window.innerHeight - 10) top = Math.max(10, Math.min(r.top - h - 6, window.innerHeight - h - 10)); el.style.top = top+'px'; };
  wxPlace();
  el.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    if(wxTbMenuClick(b, el, ptId, date)){ wxPlace(); return; }   /* §wxTb */
    var why = (document.getElementById('wx-decwhy')||{}).value || '';
    if(b.getAttribute('data-code')){ wxDecide(ptId, date, b.getAttribute('data-code'), why); wxDecMenuClose(); return; }
    var act = b.getAttribute('data-act');
    if(act === 'clear'){ wxDecide(ptId, date, '', ''); wxDecMenuClose(); return; }
    if(act === 'save'){ if(dec.decision && why !== (dec.reason||'')) wxDecide(ptId, date, dec.decision, why); wxDecMenuClose(); }
  });
  el.querySelector('#wx-decwhy').addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); el.querySelector('[data-act="save"]').click(); } if(e.key==='Escape') wxDecMenuClose(); });
  setTimeout(function(){ document.addEventListener('mousedown', wxDecMenuOut, true); }, 0);
}
/* ══ §wxTb (2026-10-30) · ⛵ เรือตีกลับ ═════════════════════════════════════
   "เรือตีกลับเพราะ ลค เป็น สว แล้วไม่ไหว · เขียนเลยก็ได้ เรือลำไหนตีกลับเพราะอะไร"
   Two sources, merged per boat:
   · pier check-in's ⛵ ออกเรือแล้วกลับเข้าท่า (ops.turnBack on each booking) · read live, never copied
   · the office's own entry here (weather_decision.turnbacks) · boat + time + reason + note
   The route still counts as "ออก" (boats left the pier) · the turn-back is what the sea did to it,
   so history marks the day bumpy (guest couldn't take it) or rough (sea itself) instead of a clean run. */
var WX_TB = { sea:['คลื่นลม','#A32D2D'], guest:['ลูกค้าไม่ไหว','#B45309'], boat:['เรือขัดข้อง','#475569'], other:['อื่นๆ','#475569'] };
var WX_TB_PIER = { weather:'sea', guest:'guest', boat:'boat', other:'other' };
function wxTbArr(x){ if(typeof x==='string'){ try{ x=JSON.parse(x); }catch(_){ x=null; } } return Array.isArray(x) ? x : []; }
function wxBoatNm(bid){ var b = (typeof getBoat==='function' ? getBoat(bid) : null) || {}; return b.name || bid || '—'; }
function wxTbPier(b, t){
  var tb = (typeof tbOf==='function') ? tbOf(b, t.date) : null; if(!tb) return null;
  var O = {}; try{ O = ((typeof bkOpsRead==='function') ? bkOpsRead(b, t.date) : b.ops) || {}; }catch(_){ }
  var bid = O.boatId || t.charterBoatId || ((Array.isArray(O.boatSplits) && O.boatSplits[0]) ? O.boatSplits[0].boatId : '') || '';
  return { bid:bid, hm:tb.hm||'', reason:WX_TB_PIER[tb.reason]||'other', note:tb.note||'', pax:+tb.pax||0, by:tb.by||'' };
}
/* merged list for one point-day · pre = pier entries already indexed (history); else read live (the day on screen) */
function wxTbList(ptId, date, pre){
  var pier = pre;
  if(!pier){
    pier = []; var pt = (WX.pts||[]).filter(function(p){ return p.id===ptId; })[0];
    var rids = pt ? wxRoutesOf(pt).map(function(r){ return r.id; }) : [];
    (typeof SB_BOOKINGS!=='undefined' ? SB_BOOKINGS : []).forEach(function(b){
      var st = b.status||''; if(st==='cancelled'||st==='rejected'||st==='cancelled_weather') return;
      (b.trips||[]).forEach(function(t){ if(t.date!==date || rids.indexOf(t.routeId)<0) return; var e = wxTbPier(b, t); if(e) pier.push(e); });
    });
  }
  var by = {}, out = [];
  pier.forEach(function(x){
    var k = x.bid || '__'; var e = by[k];
    if(!e){ e = by[k] = { bid:x.bid, hm:x.hm, reason:x.reason, note:x.note, pax:0, nb:0, src:'pier', by:x.by }; out.push(e); }
    e.pax += x.pax; e.nb++; if(x.hm && (!e.hm || x.hm < e.hm)) e.hm = x.hm; if(!e.note && x.note) e.note = x.note;
  });
  wxTbArr((WX.dec[ptId+'|'+date]||{}).turnbacks).forEach(function(m, i){
    var e = by[m.bid];
    if(e){ e.man = i; if(m.hm) e.hm = m.hm; if(m.reason) e.reason = m.reason; if(m.note) e.note = m.note; e.src = 'both'; }
    else { e = by[m.bid] = { bid:m.bid, hm:m.hm||'', reason:m.reason||'other', note:m.note||'', pax:0, nb:0, src:'man', man:i, by:m.by||'' }; out.push(e); }
  });
  out.sort(function(a,b){ return (a.hm||'99') < (b.hm||'99') ? -1 : 1; });
  return out;
}
function wxTbTip(e){ var r = WX_TB[e.reason]||WX_TB.other;
  return wxBoatNm(e.bid)+' ตีกลับ'+(e.hm?(' '+e.hm):'')+' · '+r[0]+(e.pax?(' · '+e.pax+' คน'):'')+(e.note?(' · '+e.note):'')
    + ' · '+(e.src==='man'?'บันทึกจากหน้านี้':e.src==='both'?'ท่าเรือ + หน้านี้':'จากเช็คอินท่าเรือ ('+e.nb+' ใบ)')+(e.by?(' · '+e.by):''); }
function wxTbLines(pt, date){
  var L = wxTbList(pt.id, date); if(!L.length) return '';
  return '<div style="display:flex;flex-direction:column;gap:3px;margin-top:5px">' + L.map(function(e){ var r = WX_TB[e.reason]||WX_TB.other;
    return '<div class="wx-tb" title="'+wxE(wxTbTip(e))+'"><span>⛵</span><b>'+wxE(e.bid?wxBoatNm(e.bid):'ไม่ระบุลำ')+'</b>ตีกลับ'+(e.hm?(' '+wxE(e.hm)):'')
      + ' · <b style="color:'+r[1]+'">'+r[0]+'</b>'+(e.pax?(' · '+e.pax+' คน'):'')+(e.note?('<i>· '+wxE(e.note)+'</i>'):'')
      + '<span class="src">'+(e.src==='man'?'':'ท่าเรือ')+'</span></div>'; }).join('') + '</div>';
}
/* boats on this point that day first, then the rest of the fleet */
function wxTbBoatOpts(ptId, date){
  var pt = (WX.pts||[]).filter(function(p){ return p.id===ptId; })[0];
  var rids = pt ? wxRoutesOf(pt).map(function(r){ return r.id; }) : [];
  var day = (typeof TRIPS!=='undefined' && TRIPS[date]) || {}, on = [];
  Object.keys(day).forEach(function(bid){ if(day[bid] && rids.indexOf(day[bid].route) >= 0) on.push(bid); });
  var all = (typeof BOATS!=='undefined' ? BOATS : []).filter(function(b){ return b && b.id && on.indexOf(b.id) < 0 && !b.archived; });
  var o = function(bid){ return '<option value="'+wxE(bid)+'">'+wxE(wxBoatNm(bid))+'</option>'; };
  return '<option value="">— เลือกลำ —</option>'
    + (on.length ? '<optgroup label="วิ่งเส้นนี้วันนี้">'+on.map(o).join('')+'</optgroup>' : '')
    + (all.length ? '<optgroup label="ลำอื่น">'+all.map(function(b){ return o(b.id); }).join('')+'</optgroup>' : '');
}
function wxTbMenuHtml(ptId, date){
  var L = wxTbList(ptId, date);
  return '<div class="wx-tbsec"><div class="wx-tbh">⛵ เรือตีกลับ'+(L.length?(' · '+L.length+' ลำ'):'')+'</div>'
    + L.map(function(e){ var r = WX_TB[e.reason]||WX_TB.other;
        return '<div class="wx-tbr" title="'+wxE(wxTbTip(e))+'"><b>'+wxE(e.bid?wxBoatNm(e.bid):'ไม่ระบุลำ')+'</b>'+(e.hm?wxE(e.hm):'')+' · <span style="color:'+r[1]+';font-weight:700">'+r[0]+'</span>'
          + (e.man!=null ? '<button type="button" class="x" data-tbdel="'+e.man+'" title="ลบรายการนี้">✕</button>' : '<span style="margin-left:auto;font-size:9px;color:#B08458">ท่าเรือ</span>') + '</div>'; }).join('')
    + '<button type="button" class="wx-tbadd" data-tbact="open">+ เพิ่มเรือตีกลับ</button>'
    + '<div class="wx-tbf" id="wx-tbf">'
    +   '<div style="display:flex;gap:6px"><select id="wx-tbboat" style="flex:1">'+wxTbBoatOpts(ptId, date)+'</select><input id="wx-tbhm" type="time" style="width:92px" title="เวลาที่ตีกลับ"></div>'
    +   '<div class="wx-tbo">'+Object.keys(WX_TB).map(function(k){ return '<button type="button" data-tbr="'+k+'"'+(k==='guest'?' class="on"':'')+'>'+WX_TB[k][0]+'</button>'; }).join('')+'</div>'
    +   '<input id="wx-tbnote" type="text" placeholder="เช่น ลค. สูงอายุไม่ไหว คลื่น ~1.5 ม.">'
    +   '<div style="display:flex;gap:6px"><button type="button" class="wx-mb ghost" data-tbact="cancel">ยกเลิก</button><button type="button" class="wx-mb" data-tbact="add" style="margin-left:auto">บันทึก</button></div>'
    + '</div>'
    + '<div style="font-size:9px;color:#94A3B8;margin-top:5px;line-height:1.4">ถ้าท่าเรือกด ⛵ กลับเข้าท่า ในหน้าเช็คอินไว้แล้ว จะขึ้นที่นี่เอง · เส้นนี้ยังนับว่า "ออก"</div></div>';
}
/* returns true when the click belonged to the turn-back section */
function wxTbMenuClick(b, el, ptId, date){
  var f = el.querySelector('#wx-tbf');
  if(b.hasAttribute('data-tbr')){ Array.prototype.forEach.call(el.querySelectorAll('[data-tbr]'), function(x){ x.classList.toggle('on', x===b); }); return true; }
  if(b.hasAttribute('data-tbdel')){
    var list = wxTbArr((WX.dec[ptId+'|'+date]||{}).turnbacks).slice(); list.splice(+b.getAttribute('data-tbdel'), 1);
    wxTbSave(ptId, date, list); wxDecMenuClose(); return true; }
  var act = b.getAttribute('data-tbact'); if(!act) return false;
  if(act === 'open'){ f.classList.add('on'); b.style.display = 'none'; var s = el.querySelector('#wx-tbboat'); if(s) s.focus(); return true; }
  if(act === 'cancel'){ f.classList.remove('on'); var a = el.querySelector('[data-tbact="open"]'); if(a) a.style.display = ''; return true; }
  if(act === 'add'){
    var bid = el.querySelector('#wx-tbboat').value; if(!bid){ el.querySelector('#wx-tbboat').focus(); return true; }
    var on = el.querySelector('[data-tbr].on'); var reason = on ? on.getAttribute('data-tbr') : 'other';
    var list = wxTbArr((WX.dec[ptId+'|'+date]||{}).turnbacks).filter(function(x){ return x.bid !== bid; });
    list.push({ bid:bid, hm:el.querySelector('#wx-tbhm').value||'', reason:reason, note:el.querySelector('#wx-tbnote').value.trim() });
    wxTbSave(ptId, date, list); wxDecMenuClose(); return true; }
  return false;
}
function wxTbSave(ptId, date, list){
  wxFetch('/api/weather/turnback', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pointId:ptId, date:date, list:list }) })
    .then(function(j){ var k = ptId+'|'+date; var d = WX.dec[k] || (WX.dec[k] = { point_id:ptId, date:date });
      d.turnbacks = j.list || list; if(!d.decision && !wxTbArr(d.turnbacks).length) delete WX.dec[k]; _wxOutIdx = null; wxPatch(); })
    .catch(function(e){ alert('Save failed: '+e.message); });
}
/* ══ §wxHist (2026-10-30) · ประวัติ · ทะเลแบบไหนออกได้ (mockup artboard 4) ═══════════════
   Per forecast point: every past day that had trips, the sea that day (forecast 05:00 = what the office
   decided on, or the analysed actual), and what happened (wxOutcome: decision › captain › fuel › turn-back
   › bookings). Bucketed by wave height → a suggested warn/risk line next to the one set in points.json.
   A suggestion only · the thresholds themselves still live in weather/points.json. */
var WX_HB = [ [0,1,'< 1.0 ม.'], [1,1.5,'1.0–1.4'], [1.5,2,'1.5–1.9'], [2,2.5,'2.0–2.4'], [2.5,99,'≥ 2.5 ม.'] ];
function wxOpenHist(ptId){
  var p0 = (WX.pts||[])[0]; if(!p0) return;
  var ov = document.getElementById('wx-pop');
  if(!ov){ ov = document.createElement('div'); ov.id = 'wx-pop'; document.body.appendChild(ov);
    ov.addEventListener('mousedown', function(e){ if(e.target === ov) wxClosePop(); });
    document.addEventListener('keydown', wxPopKey); }
  WX.pop = { mode:'hist', pt:ptId || (WX.histPt || p0.id), src:WX.histSrc || 'fc05', sort:'wave', only:false };
  wxPopRender();
}
function wxHistSet(k, v){ if(!WX.pop) return; WX.pop[k] = v; if(k==='pt') WX.histPt = v; if(k==='src') WX.histSrc = v; wxPopRender(); }
function wxHistClass(oc){ return oc.k==='cx' ? 'cx' : (oc.k==='rough' || oc.k==='bumpy' || oc.k==='part') ? 'bad' : 'ok'; }
function wxHistDays(pt, src){
  var H = WX.obs[pt.id] || {}, today = wxToday(), out = [];
  Object.keys(H).forEach(function(d){
    if(d >= today) return; var o = H[d];
    var r = src==='hist' ? (o.hist || o.fc05) : (o.fc05 || o.fc17 || o.hist); if(!r || !r.summary || r.summary.wave==null) return;
    var oc = wxOutcome(pt.id, d); if(!oc) return;
    out.push({ d:d, S:r.summary, kind:r.kind, oc:oc, c:wxHistClass(oc), dec:WX.dec[pt.id+'|'+d] || null });
  });
  return out;
}
function wxHistRender(ov){
  var st = WX.pop, pts = WX.pts||[], pt = pts.filter(function(p){ return p.id===st.pt; })[0] || pts[0]; if(!pt) return;
  var days = wxHistDays(pt, st.src);
  var MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var dTxt = function(d){ var x = new Date(d+'T12:00:00'); return x.getDate()+' '+MON[x.getMonth()]; };
  var seg = function(on, label, js){ return '<button type="button" class="wx-pseg'+(on?' on':'')+'" onclick="'+js+'">'+label+'</button>'; };
  var short = function(p){ return wxE(String(p.name||p.id).split(' · ')[0]); };
  var head = '<div class="wx-hd" style="padding:14px 18px;gap:12px;flex-wrap:wrap">'
    + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
    + '<div><b style="font-size:16px">ประวัติทะเล · '+short(pt)+'</b><i>'+(days.length?(dTxt(days.map(function(x){ return x.d; }).sort()[0])+' – '+dTxt(days.map(function(x){ return x.d; }).sort().pop())+' · '):'')+days.length+' วันที่มีเรือออก/ตัดสินใจ</i></div>'
    + '<div class="wx-pgrp">'+pts.map(function(p){ return seg(p.id===pt.id, short(p), 'wxHistSet(\'pt\',\''+p.id+'\')'); }).join('')+'</div>'
    + '<div class="wx-pgrp">'+seg(st.src!=='hist','พยากรณ์ 05:00','wxHistSet(\'src\',\'fc05\')')+seg(st.src==='hist','ข้อมูลจริง','wxHistSet(\'src\',\'hist\')')+'</div>'
    + '<button type="button" class="wx-hb ic" style="margin-left:auto;width:34px;height:34px" aria-label="ปิด" onclick="wxClosePop()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  var body;
  if(!days.length){
    body = '<div style="padding:40px;text-align:center;color:#64748B;font-size:13px">ยังไม่มีข้อมูลย้อนหลังของเส้นนี้<br><span style="font-size:11.5px">กด "ดึงย้อนหลัง" ใต้การ์ดสภาพทะเล เพื่อดึงข้อมูลตั้งแต่ 1 มิ.ย.</span></div>';
  } else {
    /* buckets */
    var B = WX_HB.map(function(b){ return { lo:b[0], hi:b[1], l:b[2], ok:0, bad:0, cx:0, n:0 }; });
    days.forEach(function(x){ var b = B.filter(function(b){ return x.S.wave >= b.lo && x.S.wave < b.hi; })[0]; if(b){ b[x.c]++; b.n++; } });
    var C = { ok:'#10B981', bad:'#F59E0B', cx:'#DC2626' };
    var bars = B.map(function(b){
      var w = function(k){ return b.n ? (b[k]/b.n*100) : 0; };
      var sp = function(k){ return b[k] ? '<span style="width:'+w(k)+'%;background:'+C[k]+'" title="'+b[k]+' วัน">'+(w(k)>=12?b[k]:'')+'</span>' : ''; };
      return '<div class="wx-hbar"><b>'+b.l+'</b><div class="tr">'+(b.n?sp('ok')+sp('bad')+sp('cx'):'<span style="color:#94A3B8;font-weight:600;width:100%">ไม่มีวัน</span>')+'</div>'
        + '<span style="color:#64748B">'+b.n+' วัน'+(b.n?(' · ออกปกติ '+Math.round(w('ok'))+'%'):'')+'</span></div>'; }).join('');
    var legend = '<div style="display:flex;gap:14px;font-size:10.5px;color:#64748B;margin-top:4px">'
      + '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:'+C.ok+';vertical-align:-1px"></span> ออกปกติ</span>'
      + '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:'+C.bad+';vertical-align:-1px"></span> ออกแล้วโยน/แรง · บางลำ · ตีกลับ</span>'
      + '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:'+C.cx+';vertical-align:-1px"></span> ยกเลิก</span></div>';
    /* suggested lines · first bucket (≥3 days) where clean runs fall under 70% → warn; where cancel+rough ≥ 50% → risk */
    var sWarn = null, sRisk = null;
    B.forEach(function(b){ if(b.n < 3) return; var okp = b.ok/b.n, badp = (b.cx + b.bad)/b.n, cxp = b.cx/b.n;
      if(sWarn==null && okp < 0.7) sWarn = b.lo; if(sRisk==null && (cxp >= 0.5 || (badp >= 0.7 && b.lo > 0))) sRisk = b.lo; });
    var lines = B.filter(function(b){ return b.n >= 3; }).map(function(b){
      return '<b>'+b.l+'</b>: ออกปกติ '+Math.round(b.ok/b.n*100)+'% · โยน/ตีกลับ '+Math.round(b.bad/b.n*100)+'% · ยกเลิก '+Math.round(b.cx/b.n*100)+'%'; });
    /* short period · among the bad/cancelled days that ran, how many had period ≤ 6 s */
    var badRan = days.filter(function(x){ return x.c==='bad' && x.S.per!=null; }), shortP = badRan.filter(function(x){ return x.S.per <= 6; }).length;
    var allP = days.filter(function(x){ return x.S.per!=null; }), allShort = allP.filter(function(x){ return x.S.per <= 6; }).length;
    var nData = days.filter(function(x){ return x.oc.src!=='bk'; }).length;
    var sug = '<div class="wx-hsug">'
      + '<div style="font-weight:800;margin-bottom:4px">เกณฑ์ที่ประวัติเสนอ <span style="font-weight:600;color:#0369A1">(จากผลจริง ไม่ใช่กฎตายตัว)</span></div>'
      + '<div>ตั้งไว้ตอนนี้: <b>ระวัง ≥ '+(pt.warn||1.5)+' ม.</b> · <b>เสี่ยง ≥ '+(pt.risk||2)+' ม.</b>'
      + ' &nbsp;→&nbsp; ประวัติเสนอ: <b>ระวัง ≥ '+(sWarn!=null?sWarn+' ม.':'— (ข้อมูลยังไม่พอ)')+'</b> · <b>เสี่ยง ≥ '+(sRisk!=null?sRisk+' ม.':'— (ข้อมูลยังไม่พอ)')+'</b></div>'
      + (lines.length ? '<div style="margin-top:4px">'+lines.join('<br>')+'</div>' : '')
      + (badRan.length >= 3 ? '<div style="margin-top:4px">คาบคลื่น: '+shortP+' ใน '+badRan.length+' วันที่ออกแล้วโยน มีคาบ ≤ 6 วิ (ทั้งหมดมี '+Math.round(allShort/Math.max(1,allP.length)*100)+'% ของวัน)'
          + (shortP/badRan.length > allShort/Math.max(1,allP.length) + 0.15 ? ' → <b>คาบสั้นทำให้แย่กว่าความสูงบอก</b>' : '')+'</div>' : '')
      + '<div style="margin-top:6px;font-size:10.5px;color:#0369A1">มีข้อมูลเกินกว่าใบจอง (ตัดสินใจ / กัปตัน / น้ำมัน / ตีกลับ) '+nData+' จาก '+days.length+' วัน · ยิ่งบันทึกมาก เกณฑ์ยิ่งแม่น · วันที่ไม่มีอะไรเลยนับเป็น "ออกปกติ"</div></div>';
    /* table */
    var rows = days.slice();
    if(st.only) rows = rows.filter(function(x){ return x.c!=='ok'; });
    rows.sort(st.sort==='date' ? function(a,b){ return a.d < b.d ? 1 : -1; } : function(a,b){ return (b.S.wave||0) - (a.S.wave||0); });
    var tb = '<table class="wx-htb"><thead><tr>'
      + '<th onclick="wxHistSet(\'sort\',\'date\')">วันที่'+(st.sort==='date'?' ↓':'')+'</th><th onclick="wxHistSet(\'sort\',\'wave\')">คลื่น'+(st.sort!=='date'?' ↓':'')+'</th><th>คาบ</th><th>ลม · กระโชก</th><th>ผล</th><th>เหตุผล / หมายเหตุ</th></tr></thead><tbody>'
      + rows.map(function(x){ var S = x.S, wc = wxWaveC(pt, S.wave), col = wxOutColor(x.oc.k);
          var why = []; if(x.dec && x.dec.reason) why.push('“'+wxE(x.dec.reason)+'”');
          (x.oc.tb||[]).forEach(function(e){ if(e.note) why.push('⛵ '+wxE(wxBoatNm(e.bid))+': '+wxE(e.note)); });
          return '<tr><td style="white-space:nowrap">'+dTxt(x.d)+'</td>'
            + '<td><b style="padding:1px 6px;border-radius:5px;background:'+wc[0]+';color:'+wc[1]+'">'+S.wave+' m</b></td>'
            + '<td style="'+(S.per!=null && S.per<=6?'color:#B91C1C;font-weight:700':'')+'">'+(S.per==null?'—':S.per+' s')+'</td>'
            + '<td>'+(S.wind==null?'—':Math.round(S.wind))+(S.gust!=null?(' · '+Math.round(S.gust)):'')+' kt</td>'
            + '<td style="color:'+col+';font-weight:700">'+(x.dec && x.dec.decision ? (WX_DEC_IC[x.dec.decision]||'')+' ' : '')+wxE(x.oc.t)+'</td>'
            + '<td style="color:#64748B;max-width:360px">'+(why.join(' · ')||'')+'</td></tr>'; }).join('')
      + '</tbody></table>';
    body = '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border-bottom:1px solid #EEF1F5">'
      + '<div class="wx-hs" style="border-bottom:0;border-right:1px solid #EEF1F5"><h4>เกิดอะไรขึ้นที่คลื่นแต่ละระดับ · '+(st.src==='hist'?'ข้อมูลจริง':'พยากรณ์ 05:00')+' · จุดกลางทาง</h4>'+bars+legend+'</div>'
      + '<div class="wx-hs" style="border-bottom:0">'+sug+'</div></div>'
      + '<div style="display:flex;align-items:center;gap:8px;padding:10px 20px 6px"><b style="font-size:12px">รายวัน</b>'
      + '<label style="font-size:11px;color:#64748B;display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" '+(st.only?'checked':'')+' onchange="wxHistSet(\'only\',this.checked)"> เฉพาะวันที่มีปัญหา</label></div>'
      + tb;
  }
  var keep = ov.querySelector('.wx-pbody'), sT = keep ? keep.scrollTop : 0;
  ov.innerHTML = WX_CSS + '<div class="wx-pbox" style="width:min(1180px,100%)">'+head+'<div class="wx-pbody">'+body+'</div>'
    + '<div class="wx-ft" style="padding:10px 18px"><span>ผล = การตัดสินใจ › รายงานกัปตัน › น้ำมันเกินปกติ › เรือตีกลับ › ใบจองยกเลิกเพราะอากาศ</span><span style="flex:1"></span><span>Esc หรือคลิกนอกกรอบเพื่อปิด</span></div></div>';
  var nb = ov.querySelector('.wx-pbody'); if(nb && sT) nb.scrollTop = sT;
}
/* ── popup ── */
WX.pop = null;   /* {date, pier} while open */
function wxOpenPop(date){
  var p = (typeof _bop2!=='undefined' && _bop2.pier && _bop2.pier!=='all') ? _bop2.pier : '';
  var v = WX.popView || 'days'; try{ v = localStorage.getItem('la_wx_pview') || v; }catch(_){ }
  WX.pop = { date:date || wxToday(), pier:p, view:(date && date < wxToday()) ? 'day' : v };   /* §wx5d · 5-day outlook by default */
  var ov = document.getElementById('wx-pop');
  if(!ov){ ov = document.createElement('div'); ov.id = 'wx-pop'; document.body.appendChild(ov);
    ov.addEventListener('mousedown', function(e){ if(e.target === ov) wxClosePop(); });
    document.addEventListener('keydown', wxPopKey); }
  wxPopRender();
}
function wxPopKey(e){ if(e.key === 'Escape' && WX.pop && !document.getElementById('wx-decmenu')) wxClosePop(); }
function wxClosePop(){ WX.pop = null; wxDecMenuClose(); var ov = document.getElementById('wx-pop'); if(ov) ov.remove(); document.removeEventListener('keydown', wxPopKey); }
function wxPopDay(n){ if(!WX.pop) return; WX.pop.date = wxAddDays(WX.pop.date, n); wxPopRender(); }
function wxPopPier(p){ if(!WX.pop) return; WX.pop.pier = p; wxPopRender(); }
function wxPopView(v){ if(!WX.pop) return; WX.pop.view = v; WX.popView = v; try{ localStorage.setItem('la_wx_pview', v); }catch(_){ } wxPopRender(); }
function wxPopGo(date){ if(!WX.pop) return; WX.pop.date = date; WX.pop.view = 'day'; wxPopRender(); }
function wxPopRender(){
  var ov = document.getElementById('wx-pop'); if(!ov || !WX.pop) return;
  if(WX.pop.mode === 'hist') return wxHistRender(ov);   /* §wxHist */
  var date = WX.pop.date, today = wxToday(), five = WX.pop.view === 'days';
  if(five){ var dTo = wxAddDays(date, 4); wxLoadHrRange(date, dTo);
    if(!WX['_pl5'+date+dTo]){ WX['_pl5'+date+dTo]=1; wxFetch('/api/weather?from='+date+'&to='+dTo).then(function(j){ wxIngest(j.rows); wxPopRender(); }).catch(function(){}); } }
  else if(!WX.hrLoad[date]) wxLoadHr(date);
  if(!(WX.obs && Object.keys(WX.obs).some(function(k){ return WX.obs[k][date]; })) && !WX['_pl'+date]){ WX['_pl'+date]=1; wxFetch('/api/weather?from='+date+'&to='+date).then(function(j){ wxIngest(j.rows); wxPopRender(); }).catch(function(){}); }
  var dt = new Date(date+'T12:00:00'), MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'], WD=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
  var dPrev = new Date(wxAddDays(date,-1)+'T12:00:00'), dNext = new Date(wxAddDays(date,1)+'T12:00:00');
  var piers = []; (WX.pts||[]).forEach(function(p){ if(piers.indexOf(p.pier)<0) piers.push(p.pier); });
  var PN = { tublamu:'Tub Lamu', panwa:'Visit Panwa', ranong:'Ranong' };
  var seg = function(on, label, js){ return '<button type="button" class="wx-pseg'+(on?' on':'')+'" onclick="'+js+'">'+label+'</button>'; };
  var head = '<div class="wx-hd" style="padding:14px 18px;gap:12px;flex-wrap:wrap">'
    + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>'
    + (five
        ? '<div><b style="font-size:16px">พยากรณ์ทะเล 5 วัน · '+dt.getDate()+' '+MON[dt.getMonth()]+' – '+(function(){ var e=new Date(wxAddDays(date,4)+'T12:00:00'); return e.getDate()+' '+MON[e.getMonth()]; })()+'</b><i>ทั้งวัน ทุก 3 ชม. · สีเหลืองอ่อน = ช่วงออกเรือ · กดหัววันเพื่อดูรายชั่วโมง · อัปเดตทุก 3 ชม.</i></div>'
        : '<div><b style="font-size:16px">สภาพทะเลรายชั่วโมง · '+WD[dt.getDay()]+' '+dt.getDate()+' '+MON[dt.getMonth()]+'</b><i>จุดพยากรณ์กลางทะเลของแต่ละเส้นทาง · ลูกศร = ลมพัดไปทาง · /5s = คาบคลื่น</i></div>')
    + '<div class="wx-pgrp">'+seg(five,'5 วัน','wxPopView(\'days\')')+seg(!five,'รายชั่วโมง','wxPopView(\'day\')')+'</div>'
    + '<div class="wx-pgrp">'+seg(false,'‹ '+dPrev.getDate(),'wxPopDay(-1)')+seg(true,(date===today?'วันนี้ ':'')+dt.getDate(),'')+seg(false,dNext.getDate()+' ›','wxPopDay(1)')+'</div>'
    + '<div class="wx-pgrp">'+seg(!WX.pop.pier,'ทุกท่า','wxPopPier(\'\')')+piers.map(function(p){ return seg(WX.pop.pier===p, PN[p]||p, 'wxPopPier(\''+p+'\')'); }).join('')+'</div>'
    + '<button type="button" class="wx-hb ic" style="margin-left:auto;width:34px;height:34px" aria-label="ปิด" onclick="wxClosePop()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  var rows = five ? wxPopDays(date, WX.pop.pier ? [WX.pop.pier] : null) : wxPopRows(date, WX.pop.pier ? [WX.pop.pier] : null);
  var foot = '<div class="wx-ft" style="padding:10px 18px"><span>คลื่น:</span>'
    + '<span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:3px;background:#D1FAE5"></span>ปกติ</span>'
    + '<span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:3px;background:#FEF3C7"></span>ระวัง</span>'
    + '<span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:3px;background:#FED7AA"></span>สูง</span>'
    + '<span style="display:flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:3px;background:#FECACA"></span>เสี่ยง</span>'
    + '<span style="color:#B91C1C">คาบตัวแดง = สั้น โยนกว่าความสูงบอก</span><span style="flex:1"></span><span>Esc หรือคลิกนอกกรอบเพื่อปิด</span></div>';
  var keepScroll = ov.querySelector('.wx-pbody'), sT = keepScroll ? keepScroll.scrollTop : 0;
  ov.innerHTML = WX_CSS + '<div class="wx-pbox"'+(five?' style="width:min(1720px,100%)"':'')+'>'+head+'<div class="wx-pbody">'+rows+'</div>'+foot+'</div>';
  ov.style.padding = five ? '20px' : '';   /* owner: "ไม่ต้องเต็มจอขนาดนั้น" */
  var nb = ov.querySelector('.wx-pbody'); if(nb && sT) nb.scrollTop = sT;
}
/* §wx5d · five days side by side (Windy-style) · per point: day headers, then hours at a 3-h step inside the
   sailing window · rows: sky · temp · feels like · rain · wave · wind · gust · wind dir */
function wxPopDays(from, piers){
  if(!WX.pts) return '<div style="padding:20px;color:#94A3B8">กำลังโหลด…</div>';
  var P0 = (WX.pts||[]).filter(function(p){ return !piers || !piers.length || piers.indexOf(p.pier)>=0; });
  var days = []; for(var i = 0; i < 5; i++) days.push(wxAddDays(from, i));
  var today = wxToday(), tmr = wxAddDays(today, 1), nowH = new Date().getHours();
  var MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'], WD = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  var dLbl = function(d){ var x = new Date(d+'T12:00:00'); return (d===today?'วันนี้ · ':d===tmr?'พรุ่งนี้ · ':'')+WD[x.getDay()]+' '+x.getDate()+' '+MON[x.getMonth()]; };
  var lab = 'font-size:10px;color:#64748B;display:flex;align-items:center;gap:3px;white-space:nowrap;padding-left:2px';
  var mono = "font:600 12px 'DM Mono',monospace;text-align:center;padding:4px 0;";
  return P0.map(function(pt){
    var short = wxE(pt.name.split(' · ')[0]);
    var h0 = (pt.hours||[6,15])[0], h1 = (pt.hours||[6,15])[1], hours = [1,4,7,10,13,16,19,22];   /* whole day, like the reference */
    var nh = hours.length, cols = days.length * nh;
    var left = '<div style="width:150px;flex:none;padding:12px 12px;display:flex;flex-direction:column;gap:4px;background:#FBFCFD;border-right:1px solid #EEF1F5">'
      + '<b style="font-size:15px">'+short+'</b><span style="font-size:10.5px;color:#64748B">'+wxE(pt.name.split(' · ')[1]||'')+'</span>'
      + '<span style="font-size:10px;color:#94A3B8">ช่วงออกเรือ '+(h0<10?'0':'')+h0+'–'+h1+' น. <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#FFF8E6;border:1px solid #FDE68A;vertical-align:-1px"></span></span></div>';
    /* per day: full hourly list → pick the 3-h steps */
    var D = days.map(function(d){ var b = wxBest(pt.id, d), hrs = wxHours(pt, d, true) || []; var pick = hours.map(function(h){ return hrs.filter(function(x){ return x.h===h; })[0] || null; }); return { d:d, b:b, S:b?b.S:null, hrs:hrs, pick:pick }; });
    var cell = function(i){ var h = hours[i], inWin = h >= h0 - 1 && h <= h1 + 1, night = h < 6 || h >= 19;
      return 'border-left:'+(i === 0 ? '2px solid #E2E8F0' : '0')+';background:'+(inWin ? '#FFFBEB' : night ? '#EEF2F9' : 'transparent')+';'; };
    var heads = D.map(function(x, i){ var lv = x.S ? wxLevel(pt, x.S) : 'none'; var pill = lv==='risk' ? ['#FEE2E2','#B91C1C','เสี่ยง'] : lv==='warn' ? ['#FEF3C7','#B45309','ระวัง'] : lv==='ok' ? ['#D1FAE5','#047857','ออกได้'] : ['#F1F5F9','#94A3B8','—'];
        var dec = WX.dec[pt.id+'|'+x.d], m = dec && dec.decision ? wxDecMeta(dec.decision) : null;
        return '<button type="button" onclick="wxPopGo(\''+x.d+'\')" title="ดูรายชั่วโมง '+x.d+'" style="grid-column:span '+nh+';display:flex;align-items:center;justify-content:center;gap:6px;height:28px;margin:0 2px 2px '+(i?'2px':'0')+';border:0;border-radius:8px;background:'+(x.d===today?'#EFF6FF':'#F8FAFC')+';font:700 11px inherit;color:#0F1B3D;cursor:pointer">'
          + dLbl(x.d)+'<span class="wx-pl" style="background:'+pill[0]+';color:'+pill[1]+'">'+pill[2]+(x.S&&x.S.wave!=null?(' '+x.S.wave+' m'):'')+'</span>'
          + (m ? '<span title="'+wxE(m[1])+'" style="width:16px;height:16px;border-radius:8px;background:'+m[2]+';color:#fff;font-size:9px;display:inline-flex;align-items:center;justify-content:center">'+(WX_DEC_IC[m[0]]||'')+'</span>' : '')+'</button>'; }).join('');
    var row = function(label, fn){ return '<span style="'+lab+'">'+label+'</span>' + D.map(function(x){ return x.pick.map(function(c, i){ return '<span style="'+cell(i)+'padding:1px 1px;'+(c?'':'color:#CBD5E1;text-align:center;font-size:10px')+'">'+(c ? fn(c, x) : (x.hrs.length?'':'…'))+'</span>'; }).join(''); }).join(''); };
    var g = '<div class="wx-sg" style="flex:1;min-width:0;padding:8px 14px 10px;grid-template-columns:68px repeat('+cols+',minmax(0,1fr));row-gap:0">'
      + '<span></span>' + heads
      + row('เวลา', function(c, x){ return '<span style="display:block;text-align:center;font-size:11px;font-weight:700;color:'+(x.d===today && c.h===nowH ? '#DC2626' : '#64748B')+'">'+(c.h<10?'0':'')+c.h+'</span>'; })
      + row('', function(c){ return '<span style="display:flex;justify-content:center">'+wxSkySvg(wxHrSky(c),22)+'</span>'; })
      + row('อุณหภูมิ °C', function(c){ return '<span style="display:block;'+mono+'font-size:12.5px">'+(c.temp==null?'—':Math.round(c.temp)+'°')+'</span>'; })
      + row('รู้สึกเหมือน', function(c){ return '<span style="display:block;'+mono+'font-weight:500;color:#64748B;padding:1px 0">'+(c.feels==null?'—':Math.round(c.feels)+'°')+'</span>'; })
      + row(wxIco('rain','#2563EB',12)+'ฝน mm', function(c){ var r = +c.rain||0; return '<span style="display:block;'+mono+'font-size:11px;color:#2563EB;background:'+(r>=0.1?'rgba(37,99,235,'+Math.min(0.25,0.06+r*0.03)+')':'transparent')+';border-radius:5px">'+(r>=0.1?Math.round(r*10)/10:'')+'</span>'; })
      + row(wxIco('wave','#0EA5E9',12)+'คลื่น m', function(c){ var w = wxWaveC(pt, c.wave); return '<span style="display:block;'+mono+'font-size:12.5px;background:'+w[0]+';color:'+w[1]+';border-radius:5px">'+(c.wave==null?'—':c.wave.toFixed(1))+'<span style="font-size:8.5px;font-weight:500;color:'+((c.per!=null&&c.per<=5)?'#B91C1C':'#94A3B8')+'"> /'+(c.per==null?'—':Math.round(c.per))+'s</span></span>'; })
      + row(wxIco('wind','#14B8A6',12)+'ลม kt', function(c){ return '<span style="display:block;'+mono+'background:'+wxWindBg(c.wind||0)+';border-radius:5px">'+(c.wind==null?'—':Math.round(c.wind))+'</span>'; })
      + row('กระโชก kt', function(c){ var g = c.gust||0; return '<span style="display:block;'+mono+'font-weight:500;color:'+(g>=(pt.wind||25)?'#B91C1C':'#475569')+';background:'+(g>=20?'rgba(245,158,11,.18)':'transparent')+';border-radius:5px">'+(c.gust==null?'—':Math.round(c.gust))+'</span>'; })
      + row('ทิศลม', function(c){ return '<span style="display:flex;justify-content:center;padding:2px 0" title="ลมพัดไปทาง '+wxDirTxt(((c.dir||0)+180)%360)+'"><svg width="13" height="13" viewBox="0 0 24 24" style="transform:rotate('+(((c.dir||0)+180)%360)+'deg)" aria-hidden="true"><path d="M12 3l6 16-6-4-6 4z" fill="#5B6B8C"/></svg></span>'; })
      + '</div>';
    return '<div style="display:flex;border-top:1px solid #EEF1F5">'+left+g+'</div>';
  }).join('');
}
function wxPopRows(date, piers){
  if(!WX.pts) return '<div style="padding:20px;color:#94A3B8">กำลังโหลด…</div>';
  var P0 = (WX.pts||[]).filter(function(p){ return !piers || !piers.length || piers.indexOf(p.pier)>=0; });
  return P0.map(function(pt){
    var short = wxE(pt.name.split(' · ')[0]), b = wxBest(pt.id, date), hrs = wxHours(pt, date);
    if(!b || b.S.wave == null) return '<div style="display:flex;border-top:1px solid #EEF1F5;padding:12px 18px;font-size:11.5px;color:#94A3B8"><b style="color:#0F1B3D;margin-right:8px">'+short+'</b>ยังไม่มีข้อมูลวันนี้</div>';
    var S = b.S, lv = wxLevel(pt, S), vd = wxVerdict(pt, S, date);
    var lc = lv==='risk' ? '#DC2626' : lv==='warn' ? '#F59E0B' : '#10B981';
    var pill = lv==='risk' ? ['#FEE2E2','#B91C1C','เสี่ยง'] : lv==='warn' ? ['#FEF3C7','#B45309','ระวัง'] : ['#D1FAE5','#047857','ออกได้'];
    var nb = 0; try{ var day=(typeof TRIPS!=='undefined'&&TRIPS[date])||{}; var rids=wxRoutesOf(pt).map(function(r){ return r.id; }); Object.keys(day).forEach(function(bid){ if(day[bid] && rids.indexOf(day[bid].route)>=0) nb++; }); }catch(_){ }
    var left = '<div style="width:250px;flex:none;padding:12px 16px;display:flex;flex-direction:column;gap:5px;border-left:5px solid '+lc+';background:#FBFCFD">'
      + '<div style="display:flex;align-items:center;gap:7px"><b style="font-size:15px">'+short+'</b><span class="wx-pl" style="background:'+pill[0]+';color:'+pill[1]+'">'+pill[2]+'</span></div>'
      + '<span style="font-size:10.5px;color:#64748B">'+wxE(pt.name.split(' · ')[1]||'')+(nb?(' · '+nb+' ลำ'):'')+'</span>'
      + '<span title="'+wxE(vd.tip)+'" style="font-size:11px;font-weight:700;color:'+vd.c+';cursor:help">'+vd.t+'</span>'
      + '<span style="font-size:10.5px;color:#64748B">'+wxE(wxDayTxt(pt,S,hrs))+'</span>'
      + wxDecBar(pt, date) + '</div>';
    if(!hrs || !hrs.length) return '<div style="display:flex;border-top:1px solid #EEF1F5">'+left+'<div style="flex:1;padding:16px;font-size:11.5px;color:#94A3B8">กำลังโหลดรายชั่วโมง…</div></div>';
    var n = hrs.length, lab = 'font-size:10px;color:#64748B;display:flex;align-items:center;gap:3px;white-space:nowrap';
    var nowH = date === wxToday() ? new Date().getHours() : -1;
    var rad = function(i){ return i===0?'7px 0 0 7px':i===n-1?'0 7px 7px 0':'0'; };
    var g = '<div class="wx-sg" style="flex:1;min-width:0;padding:10px 16px;grid-template-columns:64px repeat('+n+',minmax(0,1fr));row-gap:3px">'
      + '<span style="font-size:9.5px;color:#94A3B8">เวลา</span>' + hrs.map(function(x){ return '<span style="text-align:center;font-size:11px;font-weight:700;color:'+(x.h===nowH?'#DC2626':'#64748B')+'">'+(x.h<10?'0':'')+x.h+'</span>'; }).join('')
      + '<span></span>' + hrs.map(function(x){ return '<span style="display:flex;justify-content:center">'+wxSkySvg(wxHrSky(x),24)+'</span>'; }).join('')
      + '<span style="'+lab+'">'+wxIco('wave','#0EA5E9',12)+'คลื่น m</span>' + hrs.map(function(x,i){ var c=wxWaveC(pt,x.wave); return '<span style="text-align:center;font:600 13px \'DM Mono\',monospace;padding:5px 0;background:'+c[0]+';color:'+c[1]+';border-radius:'+rad(i)+'">'+(x.wave==null?'—':x.wave.toFixed(1))+'<span style="font-size:9px;font-weight:500;color:'+((x.per!=null&&x.per<=5)?'#B91C1C':'#94A3B8')+'"> /'+(x.per==null?'—':Math.round(x.per*10)/10)+'s</span></span>'; }).join('')
      + '<span style="'+lab+'">'+wxIco('wind','#14B8A6',12)+'ลม kt</span>' + hrs.map(function(x,i){ return '<span style="display:flex;align-items:center;justify-content:center;gap:3px;font:600 12.5px \'DM Mono\',monospace;padding:4px 0;background:'+wxWindBg(x.wind||0)+';border-radius:'+rad(i)+'"><svg width="11" height="11" viewBox="0 0 24 24" style="transform:rotate('+(((x.dir||0)+180)%360)+'deg)" aria-hidden="true"><path d="M12 3l6 16-6-4-6 4z" fill="#5B6B8C"/></svg>'+(x.wind==null?'—':Math.round(x.wind))+'<span style="font-size:9px;font-weight:500;color:#64748B">'+(x.gust==null?'':Math.round(x.gust))+'</span></span>'; }).join('')
      + '<span style="'+lab+'">'+wxIco('rain','#2563EB',12)+'ฝน mm</span>' + hrs.map(function(x){ return '<span style="text-align:center;font:600 11px \'DM Mono\',monospace;color:#2563EB">'+(x.rain>=0.1?Math.round(x.rain*10)/10:'')+'</span>'; }).join('')
      + '</div>';
    return '<div style="display:flex;border-top:1px solid #EEF1F5">'+left+g+'</div>';
  }).join('');
}
