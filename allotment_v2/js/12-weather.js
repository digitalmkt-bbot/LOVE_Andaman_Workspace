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
function wxHours(pt, date){
  var b = wxBest(pt.id, date); if(!b) return null;
  var H = (WX.hr[pt.id+'|'+date]||{})[b.kind]; if(!H || !H.time) return null;
  var h0 = (pt.hours||[6,15])[0], h1 = (pt.hours||[6,15])[1], out = [];
  H.time.forEach(function(t, i){ var h = +String(t).slice(11,13); if(h < h0 || h > h1) return;
    out.push({ h:h, wave:(H.wave_height||[])[i], per:(H.wave_period||[])[i], wdir:(H.wave_direction||[])[i],
               wind:(H.wind_speed_10m||[])[i], gust:(H.wind_gusts_10m||[])[i], dir:(H.wind_direction_10m||[])[i],
               rain:(H.precipitation||[])[i], cloud:(H.cloud_cover||[])[i], code:(H.weather_code||[])[i] }); });
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
  + '</style>';
function wxHeadHtml(date, sub, right, compact){
  var dt = new Date(date+'T12:00:00'), MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'], WD=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
  return '<div class="wx-hd"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>'
    + '<div style="flex:1;min-width:0"><b style="white-space:nowrap">สภาพทะเล · '+(compact?'':WD[dt.getDay()]+' ')+dt.getDate()+' '+MON[dt.getMonth()]+'</b><i>'+sub+'</i></div>'+right+'</div>';
}
function wxCardBody(date, piers){
  var expBtn = '<button type="button" class="wx-hb" onclick="wxToggleExp()" title="'+(WX.exp?'ย่อแถบรายชั่วโมง':'ดูรายชั่วโมงเหนือตาราง')+'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(WX.exp?'<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>':'<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>')+'</svg>'+(WX.exp?'ย่อ':'ขยาย')+'</button>'
    + '<button type="button" class="wx-hb ic" title="ดึงพยากรณ์ตอนนี้" aria-label="ดึงพยากรณ์ตอนนี้" onclick="wxFetchNow(\''+date+'\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/></svg></button>';
  var P0 = (WX.pts||[]).filter(function(p){ return !piers || !piers.length || piers.indexOf(p.pier)>=0; });
  var kinds = {}; P0.forEach(function(p){ var b=wxBest(p.id,date); if(b) kinds[b.kind]=1; });
  var sub = 'สรุปช่วงออกเรือ · '+(kinds.hist?'ข้อมูลจริง':kinds.fc05?'พยากรณ์ 05:00':kinds.fc17?'พยากรณ์ 17:00 วันก่อน':'ยังไม่มีข้อมูล');
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
    var dec = WX.dec[pt.id+'|'+date] || {}, decD = dec.decision ? (WX_DEC.filter(function(d){ return d[0]===dec.decision; })[0]||[]) : null, oc = wxOutcome(pt.id, date);
    var decRow = canDecide
      ? '<div class="wx-dc"><select aria-label="บันทึกการตัดสินใจ" onchange="wxDecide(\''+pt.id+'\',\''+date+'\',this.value)" style="border:1px '+(decD?'solid '+decD[2]:'dashed #CBD5E1')+';color:'+(decD?decD[2]:'#64748B')+'">'
          + '<option value="">+ ตัดสินใจ…</option>'
          + WX_DEC.map(function(d){ return '<option value="'+d[0]+'"'+(dec.decision===d[0]?' selected':'')+'>'+d[1]+'</option>'; }).join('')+'</select>'
          + '<input type="text" id="wx-why-'+wxE(pt.id)+'" value="'+wxE(dec.reason||'')+'" placeholder="เหตุผล (ไม่บังคับ)" onchange="wxDecide(\''+pt.id+'\',\''+date+'\',(this.previousElementSibling||{}).value||\'\')">'
          + (dec.by_user ? '<span style="font-size:9px;color:#94A3B8;white-space:nowrap" title="บันทึกโดย">'+wxE(dec.by_user)+' '+(dec.at?String(dec.at).slice(11,16):'')+'</span>' : '')
          + '</div>'
      : ((decD || oc) ? '<div style="margin-top:6px;font-size:10px;font-weight:700;color:'+(decD?decD[2]:wxOutColor(oc.k))+'">'+wxE(decD?decD[1]:oc.t)+(dec.reason?(' <span style="font-weight:400;color:#64748B">· '+wxE(dec.reason)+'</span>'):'')+'</div>' : '');
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
    var st = document.getElementById('wx-strip'); if(st){ var sp=st.getAttribute('data-piers'); st.innerHTML=wxStripBody(st.getAttribute('data-date'), sp?sp.split(','):null); }   /* §wx5 */
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
