/* ════════════════════════════════════════════════════════════════════════
   §opsExecBoard (2026-10-20) · FE-3a · Executive Board core (js/11-exec-board.js stays the legacy copy)
   ────────────────────────────────────────────────────────────────────────
   11-exec-board.js is one IIFE: its views read SB_BOOKINGS (here only the ranges some screen loaded), getAllotment, pxTrip and the
   localStorage blob, so every figure it drew would be wrong. This file REPLACES the renderer: the frame (title, tabs, filters, clock) is
   legacy's, the body is drawn by a view file from the server's answer:

     O.eb.views[tab] = { path(EB) -> [url, query], extra?(EB) -> [[url, query], ...], draw(answer, EB, extras) -> html }

   rev   GET /v1/exec-board/overview        (99-ops-eb-overview.js)
   sales GET /v1/exec-board/sales           (99-ops-eb-sales.js)  tgt GET /v1/exec-board/sales-targets
   gap   GET /v1/exec-board/gap + alloc     (99-ops-eb-gap.js)
   move  GET /v1/exec-board/movement        (99-ops-eb-move.js)

   Answers are cached per url+query; a miss draws "loading" and redraws when the answer arrives; an answer older than 20 s is asked again
   while the old one stays on screen (the 60 s tick). A refusal (403 for an agent login) is drawn as the server's message: no fallback to
   the browser's own figures. Window functions replaced: ebRender, ebSet, ebSetNow, ebTick (and the 60 s interval). Not replaced: ebGoTrip,
   ebCopy (legacy's, they only read the DOM). When laOps is off every one of them calls legacy's original.
   Classic script · loads after 98-ops-w8-add-on-offers.js, before 90-ops-boot.js, and before the 99-ops-eb-*.js view files.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var EB = window._eb = window._eb || { per: 'today', pier: '', tab: 'move', sp: 'week', off: 0, gp: 'h' };
  var L0 = { ebRender: window.ebRender, ebSet: window.ebSet, ebSetNow: window.ebSetNow, ebTick: window.ebTick };

  /* ── formatting helpers (legacy's, display only) ── */
  function E(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ymd(d){ return (typeof bookingV2LocalYMD === 'function') ? bookingV2LocalYMD(d) : d.toISOString().slice(0, 10); }
  function dt(ds){ return new Date(ds + 'T12:00:00'); }
  function addDays(ds, n){ var d = dt(ds); d.setDate(d.getDate() + n); return ymd(d); }
  function today(){ return ymd(new Date()); }
  function num(n){ return Math.round(+n || 0).toLocaleString('en-US'); }
  function baht(n){ n = +n || 0; var a = Math.abs(n), s = n < 0 ? '−' : '';
    if(a >= 1e6) return s + '฿' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
    if(a >= 1e4) return s + '฿' + Math.round(a / 1e3) + 'K';
    return s + '฿' + num(a); }
  function pct(a, b){ return b > 0 ? Math.round(a * 100 / b) : 0; }
  /* legacy's chg(cur, base) takes the two numbers; the server sends change_pct (null = no base) */
  function chgP(p){
    if(p == null) return '<span class="eb-mut">—</span>';
    if(Math.abs(p) < 0.5) return '<span class="eb-mut">±0%</span>';
    return '<span class="' + (p > 0 ? 'eb-up' : 'eb-dn') + '">' + (p > 0 ? '▲ ' : '▼ ') + Math.abs(p).toFixed(Math.abs(p) < 10 ? 1 : 0) + '%</span>';
  }
  function chg(cur, base){
    if(!(base > 0)) return '<span class="eb-mut">—</span>';
    return chgP((cur - base) * 100 / base);
  }
  var TH_DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  function thD(ds){ var d = dt(ds), M = (typeof laMonAbbrTH === 'function') ? laMonAbbrTH() : null; return d.getDate() + ' ' + (M ? M[d.getMonth()] : (d.getMonth() + 1)); }
  function thDow(ds){ return TH_DOW[dt(ds).getDay()]; }
  function hhmm(ts){ var d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  var CHAN_LBL = { b2b: 'B2B เอเย่นต์', b2c: 'B2C ออนไลน์', ctr: 'เคาน์เตอร์ / walk-in' };
  /* a route's name without its programme (the server sends both): legacy's rName variant */
  function variantOf(name, fam){
    var n = String(name || ''); if(!fam) return '';
    var v = n.indexOf(fam) >= 0 ? n.replace(fam, '') : n;
    return v.replace(/^\s*(by|·|-|—|\/)\s*/i, '').replace(/\s*(by|·|-|—|\/)\s*$/i, '').replace(/\s+/g, ' ').trim();
  }
  function kpi(l, v, d, cls, bar){
    return '<div class="eb-card eb-k' + (cls ? ' ' + cls : '') + '"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="d">' + (d || '') + '</div>'
      + (bar != null ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, bar)) + '%"></i></div>' : '') + '</div>';
  }
  function src(t){ return '<span class="eb-src">' + t + '</span>'; }
  function hbar(rows, fmt){
    var mx = Math.max.apply(null, [1].concat(rows.map(function(r){ return r.v; })));
    return '<div class="eb-rows">' + rows.map(function(r){
      return '<div class="rw" title="' + E(r.l + ' · ' + fmt(r.v)) + '"><span class="lb">' + E(r.l) + '</span><span class="mini"><i style="width:' + Math.round(r.v * 100 / mx) + '%' + (r.c ? ';background:' + r.c : '') + '"></i></span><span class="vv">' + fmt(r.v) + (r.x || '') + '</span></div>';
    }).join('') + '</div>';
  }
  function chanCard(byChan, title){
    var tot = byChan.b2b + byChan.b2c + byChan.ctr;
    var seg = [['b2b', 'var(--eb-s5)'], ['b2c', 'var(--eb-s3)'], ['ctr', 'var(--eb-s1)']];
    return '<div style="font-size:11.5px;color:var(--eb-ink2);font-weight:600">' + title + '</div>'
      + '<div class="eb-hstack">' + (tot > 0 ? seg.map(function(s){ var p = byChan[s[0]] * 100 / tot; return p > 0 ? '<i title="' + E(CHAN_LBL[s[0]] + ' ' + baht(byChan[s[0]])) + '" style="width:' + p + '%;background:' + s[1] + '"></i>' : ''; }).join('') : '<i style="width:100%;background:#EDF0F4"></i>') + '</div>'
      + '<div class="eb-foot" style="margin:0 0 10px">' + seg.map(function(s){ return CHAN_LBL[s[0]] + ' <b>' + pct(byChan[s[0]], tot) + '%</b>'; }).join(' · ') + '</div>';
  }
  function liveTag(){ return '<span class="eb-live"><i></i>LIVE · ' + hhmm(Date.now()) + '</span>'; }
  function seg(key, items){ return '<span class="eb-seg">' + items.map(function(it){ return '<button class="' + (EB[key] === it[0] ? 'on' : '') + '" onclick="ebSet(\'' + key + '\',\'' + it[0] + '\')">' + it[1] + '</button>'; }).join('') + '</span>'; }
  function toast(msg){ try{ var t = document.getElementById('eb-toast'); if(!t){ t = document.createElement('div'); t.id = 'eb-toast'; document.body.appendChild(t); } t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(function(){ t.style.display = 'none'; }, 2600); }catch(_){} }
  function canAlloc(){ try{ return (typeof laCanEditArea !== 'function') || laCanEditArea('sales'); }catch(_){ return false; } }

  /* ── answers: cached per url+query, asked again after 20 s while the old one stays on screen ── */
  var TTL = 20000, cache = {}, order = [];
  function keyOf(req){ return req[0] + JSON.stringify(req[1] || {}); }
  function viewOn(){ var v = document.getElementById('view-execboard'); return !!(v && v.classList.contains('active')); }
  function ensure(req){
    var k = keyOf(req), e = cache[k];
    if(!e){ e = cache[k] = { at: 0, data: null, err: null, busy: false }; order.push(k); if(order.length > 40) delete cache[order.shift()]; }
    if(!e.busy && Date.now() - e.at > TTL){
      e.busy = true;
      O.get(req[0], req[1]).then(function(j){ e.data = j; e.err = null; e.at = Date.now(); e.busy = false; arrived(); },
        function(err){ e.err = err; e.at = Date.now(); e.busy = false; arrived(); });
    }
    return e;
  }
  function arrived(){ if(viewOn() && !EB.allocEdit) keepRender(true); }
  function forget(){ cache = {}; order = []; }

  /* ── the frame (legacy's header) and the body (a view file's) ── */
  var views = {};
  function render(){
    if(!O.enabled()) return L0.ebRender ? L0.ebRender.apply(this, arguments) : undefined;
    var w = document.getElementById('eb-wrap'); if(!w) return;
    ensureCss();
    var tab = views[EB.tab] ? EB.tab : 'rev', V = views[tab], body = '', ans = null;
    try{
      if(!V) body = '<div class="eb-card eb-none">Executive Board view "' + E(tab) + '" is not loaded</div>';
      else {
        var e = ensure(V.path(EB)), xs = (V.extra ? V.extra(EB) : []).map(ensure);
        ans = e.data;
        if(e.data) body = V.draw(e.data, EB, xs.map(function(x){ return x.data; }));
        else if(e.err) body = '<div class="eb-card eb-none">' + E(e.err.message || 'The Executive Board did not load') + '</div>';
        else body = '<div class="eb-card eb-none">กำลังโหลด…</div>';
      }
    }catch(err){ console.error('[execBoard] render', err); body = '<div class="eb-card eb-none">Render error · ' + E(err && err.message) + '</div>'; }
    var t0 = today(), nav = (O.eb.navLabel && tab === 'sales') ? O.eb.navLabel(EB, ans) : '';
    w.innerHTML = '<div class="eb">'
      + '<div class="eb-top"><h1>Executive Board<small>' + (EB.tab === 'move' ? 'OVERVIEW · มูฟเมนต์บุคกิ้ง' : EB.tab === 'tgt' ? 'OVERVIEW · เป้าเซลส์รายวัน' : EB.tab === 'gap' ? 'OVERVIEW · ต้องหาอีกเท่าไหร่ถึงเต็มเรือ' : 'OVERVIEW · รายได้และยอดจอง') + '</small></h1>'
      + seg('tab', [['move', 'มูฟเมนต์'], ['rev', 'ภาพรวมรายได้'], ['sales', 'Sales Performance'], ['gap', 'Gap to Target'], ['tgt', 'เป้าเซลส์']])
      + (EB.tab === 'tgt'
          ? (seg('stm', [['this', 'เดือนนี้'], ['next', 'เดือนหน้า']]) + seg('me', [['', 'ทุกคน'], ['1', 'เฉพาะฉัน']]) + seg('pier', [['', 'ทุกท่า'], ['tublamu', 'Tub Lamu'], ['panwa', 'Panwa'], ['ranong', 'Ranong']]))
          : EB.tab === 'move'
          ? seg('pier', [['', 'ทุกท่า'], ['tublamu', 'Tub Lamu'], ['panwa', 'Panwa'], ['ranong', 'Ranong']])
          : EB.tab === 'sales'
          ? (seg('sp', [['week', 'สัปดาห์'], ['month', 'เดือน']])
             + '<span class="eb-nav"><button onclick="ebSet(\'off\',' + ((+EB.off || 0) - 1) + ')" title="ช่วงก่อนหน้า">‹</button><b>' + E(nav) + '</b>'
             + '<button onclick="ebSet(\'off\',' + Math.min(0, (+EB.off || 0) + 1) + ')"' + ((+EB.off || 0) >= 0 ? ' disabled' : '') + ' title="ช่วงถัดไป">›</button></span>')
          : EB.tab === 'gap'
          ? (seg('gp', [['h', '14 วันข้างหน้า'], ['month', 'เดือนนี้'], ['next', 'เดือนหน้า']])
             + seg('pier', [['', 'ทุกท่า'], ['tublamu', 'Tub Lamu'], ['panwa', 'Panwa'], ['ranong', 'Ranong']]))
          : (seg('per', [['today', 'วันนี้'], ['month', 'เดือนนี้'], ['quarter', 'ไตรมาส'], ['year', 'ปีนี้']])
             + seg('pier', [['', 'ทุกท่า'], ['tublamu', 'Tub Lamu'], ['panwa', 'Panwa'], ['ranong', 'Ranong']])))
      + '<span class="eb-sp"></span><span class="eb-upd">' + E(thDow(t0)) + ' ' + E(thD(t0)) + ' ' + t0.slice(0, 4) + ' · อัปเดต ' + hhmm(Date.now()) + ' · วาดใหม่ทุก 1 นาที</span></div>'
      + body + '</div>';
  }
  var _pending = false;
  function keepRender(sync){
    var m = document.querySelector('.main'), y = m ? m.scrollTop : 0, wy = window.scrollY;
    var go = function(){ _pending = false; render(); try{ if(m) m.scrollTop = y; window.scrollTo(window.scrollX || 0, wy); }catch(_){} };
    if(sync){ go(); return; }
    if(_pending) return; _pending = true;
    setTimeout(go, 20);
  }
  function mvDate(){
    var d = EB.mvd; if(d && /^\d{4}-\d{2}-\d{2}$/.test(String(d))) return d;
    var last = O.eb && O.eb.last && O.eb.last.moveDate; return last || addDays(today(), 1);
  }
  function ebApply(k, v){
    if(k === 'off') v = Math.min(0, +v || 0);
    if(k === 'sp' || k === 'tab') EB.off = 0;
    if(k === 'tab') EB.gx = '';
    if(k === 'mvd'){ var t0 = today(); v = v === 'prev' ? addDays(mvDate(), -1) : v === 'next' ? addDays(mvDate(), 1) : v === 'tm' ? addDays(t0, 1) : v === 'td' ? t0 : v; }
    EB[k] = v;
  }

  window.ebRender = render;
  window.ebSet = function(k, v){
    if(!O.enabled()) return L0.ebSet ? L0.ebSet.apply(this, arguments) : undefined;
    ebApply(k, v); keepRender();
  };
  window.ebSetNow = function(k, v){
    if(!O.enabled()) return L0.ebSetNow ? L0.ebSetNow.apply(this, arguments) : undefined;
    ebApply(k, v); keepRender(true);
  };
  window.ebTick = function(){
    if(!O.enabled()) return L0.ebTick ? L0.ebTick.apply(this, arguments) : false;
    try{ if(EB.allocEdit) return false; keepRender(true); return true; }catch(_){ return false; }
  };
  /* legacy's own 60 s interval draws legacy's views: stop it and run the same guards here */
  try{ if(window.__ebTick) clearInterval(window.__ebTick); }catch(_){}
  window.__ebTick = setInterval(function(){
    try{
      if(!O.enabled()){ if(L0.ebTick && viewOn() && !document.hidden) L0.ebTick(); return; }
      if(!viewOn() || document.hidden) return;
      if(EB.allocEdit) return;
      var ae = document.activeElement;
      if(ae && ae.closest && ae.closest('#eb-wrap') && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return;
      keepRender(true);
    }catch(_){}
  }, 60000);

  function ensureCss(){
    if(document.getElementById('eb-style')) return;
    var s = document.createElement('style'); s.id = 'eb-style';
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
      /* §execMove · บอร์ดเรือ · จอมอนิเตอร์ */
      '.ebm-card{padding:0;overflow:hidden}',
      '.ebm-head{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1fr) minmax(0,1.75fr);gap:26px;align-items:start;padding:20px 26px;border-bottom:1px solid var(--eb-line)}',
      '@media(max-width:1180px){.ebm-head{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.ebm-side{grid-column:1/-1}}',
      '@media(max-width:700px){.ebm-head{grid-template-columns:minmax(0,1fr)}}',
      '.ebm-date .k{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.1em;color:var(--eb-mut)}',
      '.ebm-date .big{font-size:32px;font-weight:700;line-height:1.15;letter-spacing:-.01em;margin-top:2px}',
      '.ebm-date .sub{font-size:13px;color:var(--eb-mut)}',
      '.ebm-date .nav{display:flex;gap:8px;margin-top:8px}',
      '.ebm-date .nav button{min-width:32px;height:32px;border-radius:8px;border:1px solid #D6DBE3;background:#fff;color:var(--eb-ink);font:600 13px inherit;font-family:inherit;cursor:pointer;padding:0 10px}',
      '.ebm-mood{display:flex;align-items:center;gap:18px}',
      '.ebm-ring{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}',
      '.ebm-ring>div{width:72px;height:72px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}',
      '.ebm-ring b{font-size:21px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}.ebm-ring small{font-size:10px;color:var(--eb-mut)}',
      '.ebm-mood .n{font-size:30px;font-weight:700;line-height:1.1}.ebm-mood .n span{font-size:15px;font-weight:600;color:var(--eb-mut)}',
      '.ebm-mood .s{font-size:12.5px;color:var(--eb-ink2);margin-top:2px}.ebm-mood .c{font-size:12px;font-weight:600;margin-top:2px}.ebm-mood .c.up{color:#15803D}.ebm-mood .c.dn{color:var(--eb-bad)}',
      '.ebm-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--eb-line)}',
      '.ebm-stats>div{min-width:0}',
      '.ebm-stats .l{font-size:11px;color:var(--eb-mut);font-weight:600}.ebm-stats .v{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.25}.ebm-stats .d{font-size:10.5px;color:var(--eb-ink2);line-height:1.4}',
      '.ebm-vt .hh{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.ebm-vt .hh b{font-size:12.5px}.ebm-vt .hh span{font-size:11px;color:var(--eb-mut)}.ebm-vt .hh i{flex:1}',
      '.ebm-vt .hh button{font:inherit;font-size:11px;font-weight:600;color:var(--eb-ink2);background:#fff;border:1px solid var(--eb-line);border-radius:7px;padding:2px 9px;cursor:pointer}.ebm-vt .hh button:hover{background:#F6F8FA}',
      '.ebm-vt table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}',
      '.ebm-vt th{font-size:10px;font-weight:700;color:var(--eb-mut);letter-spacing:.06em;text-align:right;padding:0 8px 6px;white-space:nowrap}.ebm-vt th:first-child{text-align:left;padding-left:10px}.ebm-vt th.sum{color:var(--eb-ink)}.ebm-vt th.add{color:#15803D}',
      '.ebm-vt td{padding:4px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:12.5px;white-space:nowrap}.ebm-vt td:first-child{text-align:left;white-space:normal}',
      '.ebm-vt td.z{color:#C3C8D1}.ebm-vt td.sum{font-weight:700}.ebm-vt td.add{color:#15803D;font-weight:600}.ebm-vt td.add.z{color:#C3C8D1;font-weight:400}',
      '.ebm-vt tr.fam td{font-weight:700;padding-top:6px;padding-bottom:6px}.ebm-vt tr.fam td:first-child{border-radius:8px 0 0 8px;font-size:12.5px}.ebm-vt tr.fam td:last-child{border-radius:0 8px 8px 0}',
      '.ebm-vt tr.fam.tg{cursor:pointer}.ebm-vt tr.fam.tg:hover td{filter:brightness(.97)}',
      '.ebm-vt tr.fam .cv{display:inline-block;width:12px;font-size:10px;opacity:.8}.ebm-vt tr.fam .sw{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:7px;vertical-align:1px}.ebm-vt tr.fam .vn{font-size:10.5px;font-weight:600;opacity:.72;margin-left:6px}',
      '.ebm-vt tr.var td{border-bottom:1px solid #F1F3F6}.ebm-vt tr.var td:first-child{padding-left:29px;color:var(--eb-ink2);font-weight:500}',
      '.ebm-vt tr.var .dep{font-size:11px;color:#9CA3AF;margin-left:6px;font-variant-numeric:tabular-nums}.ebm-vt tr.var .tag{font-size:9.5px;font-weight:700;color:#047857;background:#DCFCE7;border-radius:5px;padding:0 5px;margin-left:5px}',
      '.ebm-vt tr.gap td{height:4px;padding:0;border:0}.ebm-vt tr.tot td{border-top:2px solid var(--eb-ink);font-weight:700;padding-top:7px;font-size:13px}.ebm-vt tr.tot td:first-child{padding-left:10px}',
      '.ebm-cols,.ebm-row{display:grid;grid-template-columns:minmax(220px,300px) 120px minmax(0,1fr) 150px 104px 140px;gap:12px;align-items:center;padding:6px 26px;min-height:40px}',
      '.ebm-cols{background:#F6F8FA;border-bottom:1px solid var(--eb-line);font-size:11px;font-weight:600;color:var(--eb-mut);letter-spacing:.04em;padding-top:7px;padding-bottom:7px}',
      '.ebm-cols>div{display:flex;align-items:center;gap:8px}',
      '.ebm-livek{display:inline-flex;align-items:center;gap:5px;color:#15803D;letter-spacing:.06em}',
      '@media(max-width:1000px){.ebm-cols{display:none}.ebm-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.ebm-row .rt{grid-column:1/-1}}',
      '.ebm-pier{display:flex;align-items:center;gap:10px;padding:8px 26px 3px;font-size:11.5px;font-weight:700;color:#334155;border-top:1px solid #EEF1F5}',
      '.ebm-row{border-top:1px solid #EEF1F5}.ebm-row.be{background:#FFF7F7}',
      '.ebm-row .rt{min-width:0;line-height:1.3}.ebm-row .rt b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ebm-row .rt small{display:block;font-size:11px;color:var(--eb-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ebm-row .bts{display:flex;flex-wrap:wrap;column-gap:10px;row-gap:1px;min-width:0;line-height:1.3}.ebm-row .bt{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:12px;white-space:nowrap}.ebm-row .bt i{width:10px;height:10px;border-radius:50%;flex:none}.ebm-row .bt small{font-weight:600;color:var(--eb-mut)}',
      '.ebm-fill{position:relative;height:22px;background:#EEF1F5;border-radius:6px;overflow:hidden}',
      '.ebm-fill>i{position:absolute;left:0;top:0;bottom:0;border-radius:6px}',
      '.ebm-fill>s{position:absolute;top:0;bottom:0;width:2px;background:var(--eb-ink);opacity:.6}',
      '.ebm-fill em{position:absolute;left:8px;top:0;line-height:22px;font-style:normal;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.ebm-fill b{position:absolute;right:8px;top:0;line-height:22px;font-size:11.5px;font-weight:600}',
      '.ebm-fill.na em{color:var(--eb-mut);font-weight:500}',
      '@keyframes ebm-stripe{from{background-position:0 0}to{background-position:28px 0}}',
      '@keyframes ebm-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}',
      '@keyframes ebm-scan{0%{left:-30%}100%{left:110%}}',
      '.ebm-live{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.22) 0 7px,transparent 7px 14px);background-size:28px 28px;animation:ebm-stripe 1.1s linear infinite}',
      '.ebm-scan{position:absolute;top:0;bottom:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:ebm-scan 2.4s ease-in-out infinite;pointer-events:none}',
      '.ebm-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#16A34A;animation:ebm-pulse 1.4s ease-in-out infinite}',
      '@media(prefers-reduced-motion:reduce){.ebm-live,.ebm-scan,.ebm-dot{animation:none}}',
      '.ebm-row .lst{display:flex;flex-direction:column;gap:0;min-width:0;line-height:1.3}.ebm-row .lst small{font-size:10.5px;color:var(--eb-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ebm-new{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#15803D;background:#DCFCE7;border-radius:6px;padding:1px 7px;width:fit-content;font-variant-numeric:tabular-nums}',
      '.ebm-old{font-size:12px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums}',
      '.ebm-row .bec{font-size:12px;color:var(--eb-mut)}.eb-num{font-weight:600;color:var(--eb-ink);font-variant-numeric:tabular-nums}',
      '.ebm-zt{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;font-size:12px;color:#334155;margin-bottom:4px}.ebm-zt b{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;margin-right:4px}',
      '.ebm-hrs{display:flex;align-items:flex-end;gap:5px;height:110px;padding-top:16px}',
      '.ebm-hrs>div{flex:1;display:flex;flex-direction:column-reverse;gap:1px;position:relative;min-width:0}.ebm-hrs>div i{display:block;border-radius:2px}',
      '.ebm-hrs>div b{position:absolute;top:-16px;left:0;right:0;text-align:center;font-size:10px;font-weight:600;color:var(--eb-mut)}.ebm-hrs>div.on b{color:var(--eb-ink)}',
      '.ebm-hx{display:flex;gap:5px;font-size:10px;color:var(--eb-mut);margin-top:3px}.ebm-hx span{flex:1;text-align:center}',
      '.ebm-lg{display:flex;gap:14px;font-size:11px;color:#334155;margin:6px 0 4px}.ebm-lg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
      '.ebm-feed{display:flex;flex-direction:column;border-top:1px solid #EEF1F5;margin-top:4px}',
      '.ebm-feed .r{display:grid;grid-template-columns:50px minmax(0,1fr) 46px 80px;gap:10px;align-items:center;padding:7px 0;border-top:1px solid #EEF1F5;font-size:12.5px}.ebm-feed .r:first-child{border-top:0}',
      '.ebm-feed .t{font-size:11.5px;color:var(--eb-mut);font-variant-numeric:tabular-nums}.ebm-feed .w{min-width:0}.ebm-feed .w b{font-weight:600}.ebm-feed .w>span{font-size:11.5px;color:var(--eb-mut)}',
      '.ebm-feed .sl{display:inline-block;margin-left:8px;font-size:10.5px;font-weight:600;color:#4338CA;background:#EEF2FF;border-radius:6px;padding:1px 7px;white-space:nowrap}.ebm-feed .sl.on{color:var(--eb-ink2);background:#F3F4F6}',
      '.ebm-feed .p{font-weight:700;text-align:right;font-variant-numeric:tabular-nums}.ebm-feed .d{font-size:11.5px;color:#334155;text-align:right;white-space:nowrap}',
      '.ebm-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}',
      '.ebm-days .d{border:1px solid var(--eb-line);border-radius:12px;padding:10px 4px;text-align:center;display:flex;flex-direction:column;gap:4px;background:#fff;font-family:inherit;cursor:pointer;min-width:0}',
      '.ebm-days .d.cur{border:2px solid var(--eb-ink);padding:9px 3px}',
      '.ebm-days .dw{font-size:11px;color:var(--eb-mut);font-weight:600}.ebm-days .dd{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}.ebm-days .pc{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.ebm-days .g .pc{color:#047857}.ebm-days .w .pc{color:#B45309}.ebm-days .b .pc{color:var(--eb-bad)}.ebm-days .n .pc{color:var(--eb-mut)}',
      '.ebm-days .br{display:block;height:6px;background:#EEF1F5;border-radius:3px;overflow:hidden}.ebm-days .br i{display:block;height:6px}',
      '.ebm-days .g .br i{background:#047857}.ebm-days .w .br i{background:#F59E0B}.ebm-days .b .br i{background:#DC2626}',
      '.ebm-days .m{font-size:10.5px;color:#334155}',
      '.ebm-hr{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-top:1px solid #EEF1F5}.ebm-hr:first-of-type{border-top:0}',
      '.ebm-hr>i{width:12px;height:12px;border-radius:50%;display:inline-block}.ebm-hr>i.b{background:#DC2626}.ebm-hr>i.w{background:#F59E0B}',
      '.ebm-hr b{display:block;font-weight:600}.ebm-hr small{display:block;font-size:11.5px;color:var(--eb-mut)}',
      '.ebm-hr button{font:600 12px inherit;font-family:inherit;border:0;background:transparent;color:var(--eb-blue-d);cursor:pointer;white-space:nowrap;min-height:36px}',
      /* §execGap2 · Gap to Target วาดใหม่ */
      '.eg-head{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,2fr);gap:0;padding:0;overflow:hidden}',
      '.eg-head.st{grid-template-columns:minmax(0,1.1fr) minmax(0,1.6fr)}',
      '@media(max-width:1000px){.eg-head,.eg-head.st{grid-template-columns:minmax(0,1fr)}}',
      '.eg-hl{padding:20px 26px;border-right:1px solid #EEF1F5;display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.eg-hl .k{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.1em;color:var(--eb-mut)}',
      '.eg-hl .big{font-size:28px;font-weight:700;line-height:1.15;letter-spacing:-.01em}.eg-hl .big .n{font-variant-numeric:tabular-nums}.eg-hl .big .n.bad{color:var(--eb-bad)}.eg-hl .big .n.good{color:#15803D}.eg-hl .big .u{font-size:15px;font-weight:600;color:var(--eb-mut)}',
      '.eg-hl .s{font-size:13px;color:var(--eb-ink2)}.eg-hl .c{font-size:12px;font-weight:600;color:var(--eb-ink2)}.eg-hl .c.bad{color:var(--eb-bad)}.eg-hl .c.warn{color:#B45309}.eg-hl .c.good{color:#15803D}',
      '.eg-hl .bar{display:flex;align-items:center;gap:10px;margin-top:4px}.eg-hl .bar .t{flex:1;height:10px;background:#EEF1F5;border-radius:5px;overflow:hidden;position:relative}.eg-hl .bar .t i{position:absolute;left:0;top:0;bottom:0;background:var(--eb-blue-d);border-radius:5px}.eg-hl .bar .t s{position:absolute;top:0;bottom:0;width:2px;background:var(--eb-ink);opacity:.5}.eg-hl .bar span{font-size:11.5px;color:var(--eb-mut);white-space:nowrap}',
      '.eg-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.eg-tiles>div{padding:20px 18px;border-right:1px solid #EEF1F5;display:flex;flex-direction:column;gap:2px;min-width:0}.eg-tiles>div:last-child{border-right:0}',
      '.eg-tiles .l{font-size:11px;color:var(--eb-mut);font-weight:600}.eg-tiles .v{font-size:25px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2}.eg-tiles .v small{font-size:13px;color:var(--eb-mut);font-weight:600}.eg-tiles .v.bad{color:var(--eb-bad)}.eg-tiles .v.warn{color:#B45309}.eg-tiles .v.good{color:#15803D}.eg-tiles .d{font-size:11px;color:var(--eb-ink2)}',
      '@media(max-width:1000px){.eg-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.eg-tiles>div{border-bottom:1px solid #EEF1F5}}',
      '.eg-lg{margin-left:auto;display:flex;gap:12px;font-size:11px;font-weight:500;color:#334155}.eg-lg i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:4px}',
      '.eg-grid{display:grid;gap:4px;align-items:stretch;margin-top:4px}',
      '.eg-dh{text-align:center;font-size:11px;color:var(--eb-mut);font-weight:600;padding-bottom:2px}.eg-dh.we{color:var(--eb-ink)}.eg-dh.td{color:var(--eb-blue-d);font-weight:800}.eg-dh.r{text-align:right}',
      '.eg-rn{display:flex;flex-direction:column;justify-content:center;min-width:0}.eg-rn b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eg-rn small{font-size:11px;color:var(--eb-mut)}',
      '.eg-c{border:0;border-radius:8px;padding:6px 2px;text-align:center;position:relative;font-family:inherit;cursor:pointer;min-height:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;background:#F3F4F6;color:#9CA3AF}',
      '.eg-c b{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.1}.eg-c i{position:absolute;top:3px;right:5px;font-size:9.5px;font-style:normal;font-weight:700;color:#15803D}.eg-c small{font-size:9.5px;font-weight:600;opacity:.8}',
      '.eg-c.g{background:#D1FAE5;color:#047857}.eg-c.w{background:#FEF3C7;color:#92400E}.eg-c.b{background:#FEE2E2;color:#B91C1C}.eg-c.off{cursor:default}',
      '.eg-grid.dense .eg-c b{font-size:12px}.eg-grid.dense .eg-c{min-height:34px;padding:4px 1px}.eg-grid.dense .eg-c small,.eg-grid.dense .eg-c i{display:none}.eg-grid.dense .eg-dh{font-size:10px}',
      '.eg-tot{text-align:right;display:flex;flex-direction:column;justify-content:center}.eg-tot b{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}.eg-tot small{font-size:10.5px;color:var(--eb-mut)}',
      '.eg-sh,.eg-sr{display:grid;grid-template-columns:160px minmax(0,1fr) 70px 110px 130px;gap:10px;align-items:center}',
      '.eg-sh{font-size:11px;font-weight:600;color:var(--eb-mut);letter-spacing:.04em;padding:4px 0 6px;border-bottom:1px solid var(--eb-line)}.eg-sh span:nth-child(n+3){text-align:right}',
      '.eg-sr{padding:8px 0;border-bottom:1px solid #EEF1F5}.eg-sr.open{border-bottom:0}',
      '.eg-sr .nm{display:flex;align-items:center;gap:8px;font:600 13px inherit;font-family:inherit;border:0;background:transparent;color:var(--eb-ink);cursor:pointer;padding:4px 0;text-align:left;min-height:32px}.eg-sr .nm i{font-style:normal;color:var(--eb-mut);font-size:11px}',
      '.eg-sr .pb{position:relative;height:18px;background:#EEF1F5;border-radius:5px;overflow:hidden}.eg-sr .pb i{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.eg-sr .pb s{position:absolute;top:0;bottom:0;width:2px;background:var(--eb-ink);opacity:.5}.eg-sr .pb b{position:absolute;right:7px;top:0;line-height:18px;font-size:11px;font-weight:600;color:#334155;font-variant-numeric:tabular-nums}',
      '.eg-sr .gp{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.eg-sr .gp.bad{color:var(--eb-bad)}.eg-sr .gp.warn{color:#B45309}.eg-sr .gp.good{color:#15803D}',
      '.eg-sr .nd{text-align:right;font-variant-numeric:tabular-nums}.eg-sr .nd small{font-size:10.5px;color:var(--eb-mut)}.eg-sr .td{text-align:right}',
      '@media(max-width:900px){.eg-sh{display:none}.eg-sr{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.eg-sr .nm{grid-column:1/-1}}',
      '.eg-sx{background:#F6F8FA;border-radius:10px;padding:6px 12px 10px;margin:0 0 8px;display:flex;flex-direction:column}',
      '.eg-sxh{display:grid;grid-template-columns:minmax(0,1fr) 52px 64px 50px minmax(0,1.7fr);gap:8px;font-size:10.5px;font-weight:600;color:var(--eb-mut);letter-spacing:.04em;padding:6px 0 4px;border-bottom:1px solid var(--eb-line);order:-1}.eg-sxh span:nth-child(2),.eg-sxh span:nth-child(3),.eg-sxh span:nth-child(4){text-align:right}',
      '.eg-sx .r,.eg-sx-r{display:grid;grid-template-columns:minmax(0,1fr) 52px 64px 50px minmax(0,1.7fr);gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #EEF1F5;font-size:12.5px}.eg-sx .r.lag,.eg-sx-r.lag{background:#FFF7F7;margin:0 -8px;padding-left:8px;padding-right:8px;border-radius:6px}',
      '.eg-sx .f,.eg-sx-r .f{font-weight:600}.eg-sx .f small,.eg-sx-r .f small{display:block;font-size:10.5px;font-weight:500;color:var(--eb-mut)}.eg-sx .f b,.eg-sx-r .f b{color:var(--eb-bad);font-size:10.5px}',
      '.eg-sx .n,.eg-sx-r .n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}.eg-sx .n.bad,.eg-sx-r .n.bad{color:var(--eb-bad)}.eg-sx .n.g,.eg-sx-r .n.g{color:#15803D}.eg-sx .n.w,.eg-sx-r .n.w{color:#B45309}.eg-sx .n.b,.eg-sx-r .n.b{color:var(--eb-bad)}',
      '.eg-sx .od,.eg-sx-r .od{display:flex;gap:4px;flex-wrap:wrap}.eg-sx .od button,.eg-sx-r .od button{font:600 11px inherit;font-family:inherit;background:#EEF2FF;color:var(--eb-blue-d);border:0;border-radius:6px;padding:2px 7px;cursor:pointer;min-height:24px}',
      '.eg-calls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:11.5px;padding-top:8px}.eg-calls span,.eg-call{background:#F3F4F6;border-radius:6px;padding:2px 8px;white-space:nowrap}.eg-calls span.q,.eg-call.q{background:#FEE2E2;color:#991B1B}.eg-calls span.l,.eg-call.l{background:#FEF3C7;color:#92400E}',
      '.eg-dec{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #EEF1F5}.eg-dec:first-of-type{border-top:0}.eg-dec b{display:block;font-weight:600}.eg-dec small{display:block;font-size:11.5px;color:var(--eb-mut)}',
      '.eg-opt{display:inline-flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.eg-opt b{font-size:11px;font-weight:600;border:1px solid var(--eb-line);border-radius:7px;padding:3px 8px;color:var(--eb-ink2);background:#fff}.eg-opt b.on{background:var(--eb-ink);color:#fff;border-color:var(--eb-ink)}.eg-opt button{font:600 11.5px inherit;font-family:inherit;border:0;background:transparent;color:var(--eb-blue-d);cursor:pointer;min-height:32px}',
      '.eg-ld{display:grid;grid-template-columns:130px minmax(0,1fr) 54px;gap:10px;align-items:center;font-size:12px;padding:3px 0}.eg-ld .b{height:8px;background:#EEF1F5;border-radius:4px;overflow:hidden}.eg-ld .b i{display:block;height:8px;background:var(--eb-blue)}.eg-ld .n{text-align:right;font-variant-numeric:tabular-nums}',
      /* §execAlloc2 · หน้าต่างกำหนดสัดส่วน */
      '#eb-alloc-ov{position:fixed;inset:0;z-index:9400;background:rgba(11,31,58,.42);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}',
      '#eb-alloc-ov .ea{width:min(1080px,100%);max-height:94vh;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(11,31,58,.28);display:flex;flex-direction:column;overflow:hidden;color:var(--eb-ink,#0F1B3D);font-size:13px}',
      '#eb-alloc-ov .ea-hd{display:flex;align-items:flex-start;gap:16px;padding:18px 24px 14px;border-bottom:1px solid #E1E5EB}#eb-alloc-ov .ea-hd>div{flex:1}#eb-alloc-ov .ea-hd .t{font-size:17px;font-weight:700}#eb-alloc-ov .ea-hd .s{font-size:12px;color:#6B7280;margin-top:2px}',
      '#eb-alloc-ov .ea-hd .x{width:36px;height:36px;border-radius:10px;border:1px solid #E1E5EB;background:#fff;color:#4B5563;font:inherit;font-size:15px;cursor:pointer}',
      '#eb-alloc-ov .ea-src{display:flex;align-items:center;gap:12px;padding:10px 24px;background:#F6F8FA;border-bottom:1px solid #E1E5EB;flex-wrap:wrap;font-size:12px}#eb-alloc-ov .ea-src>span:first-child{font-weight:600;color:#334155}',
      '#eb-alloc-ov .eb-seg{display:inline-flex;background:#fff;border:1px solid #E1E5EB;border-radius:9px;padding:2px}#eb-alloc-ov .eb-seg button{font:600 12px inherit;font-family:inherit;padding:5px 11px;border-radius:7px;border:0;background:transparent;color:#4B5563;cursor:pointer}#eb-alloc-ov .eb-seg button.on{background:#0B1F3A;color:#fff}',
      '#eb-alloc-ov .ea-body{overflow:auto;padding:14px 24px 6px}',
      '#eb-alloc-ov .ea-grid{display:grid;gap:8px 10px;align-items:center}',
      '#eb-alloc-ov .hh{font-size:11px;font-weight:600;color:#6B7280;letter-spacing:.04em;padding-bottom:8px;border-bottom:1px solid #E1E5EB;align-self:end}#eb-alloc-ov .hh.r{text-align:right}',
      '#eb-alloc-ov .hh.f b{display:block;font-size:13px;color:#0B1F3A;letter-spacing:0}#eb-alloc-ov .hh.f small{display:block;font-weight:500;letter-spacing:0}#eb-alloc-ov .hh.f label{display:flex;align-items:center;gap:5px;font-weight:500;letter-spacing:0;margin-top:3px}',
      '#eb-alloc-ov input[type=number]{width:52px;border:1px solid #D6DBE3;border-radius:8px;padding:6px 7px;font:600 13px inherit;font-family:inherit;text-align:right;font-variant-numeric:tabular-nums}#eb-alloc-ov .hh input{width:44px;padding:4px 6px;font-size:12px}#eb-alloc-ov input:focus{outline:0;border-color:#0B1F3A}',
      '#eb-alloc-ov .sn{display:flex;align-items:center;gap:8px;font-weight:600}#eb-alloc-ov .sn small{font-size:10.5px;font-weight:600;background:#F3F4F6;border-radius:6px;padding:1px 6px;color:#6B7280}#eb-alloc-ov .sn.mut{color:#6B7280}',
      '#eb-alloc-ov .cell{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:#6B7280}#eb-alloc-ov .cell b{color:#0B1F3A;font-variant-numeric:tabular-nums}#eb-alloc-ov .cell small{font-size:10.5px;color:#9CA3AF}#eb-alloc-ov .cell.mut{color:#6B7280}',
      '#eb-alloc-ov .rt{text-align:right;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}#eb-alloc-ov .rt.mut{color:#6B7280;font-weight:500}',
      '#eb-alloc-ov .tt{padding-top:8px;border-top:1px solid #E1E5EB;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px}#eb-alloc-ov .tt.r{justify-content:flex-end;font-size:15px}#eb-alloc-ov .tt .eb-atot{font-size:14px;font-variant-numeric:tabular-nums}',
      '#eb-alloc-ov .eb-atot.over{color:var(--eb-bad,#B42318)}#eb-alloc-ov .eb-atot.under{color:#B45309}#eb-alloc-ov .eb-atot.ok{color:#047857}',
      '#eb-alloc-ov .eb-st{display:inline-flex;align-items:center;font-size:11px;font-weight:700;border-radius:6px;padding:1px 7px}#eb-alloc-ov .eb-st.g{background:#D1FAE5;color:#047857}#eb-alloc-ov .eb-st.w{background:#FEF3C7;color:#92400E}#eb-alloc-ov .eb-st.b{background:#FEE2E2;color:#B91C1C}',
      '#eb-alloc-ov .ea-ft{display:flex;align-items:center;gap:10px;padding:12px 24px 16px;border-top:1px solid #E1E5EB;background:#FAFBFC;flex-wrap:wrap}',
      '#eb-alloc-ov .eb-btn{font:600 12.5px inherit;font-family:inherit;padding:8px 14px;border-radius:9px;border:1px solid #D6DBE3;background:#fff;color:#0B1F3A;cursor:pointer;min-height:38px}#eb-alloc-ov .eb-btn.p{background:#0B1F3A;color:#fff;border-color:#0B1F3A}',
      '#eb-alloc-ov .eb-foot{font-size:11.5px;color:#6B7280;padding:8px 0 6px}#eb-alloc-ov .eb-mut{color:#6B7280}#eb-alloc-ov .eb-sp{flex:1}#eb-alloc-ov .eb-num{font-weight:600;color:#0B1F3A}#eb-alloc-ov .eb-dot{width:10px;height:10px;border-radius:50%;display:inline-block}',
      /* §execSalesTgt */
      '.st-chart{padding:16px 24px;display:flex;flex-direction:column;gap:6px;min-width:0}.st-chart .hh{display:flex;align-items:baseline;gap:10px;font-size:12.5px;flex-wrap:wrap}',
      '.st-chart .bars{position:relative;display:flex;align-items:flex-end;gap:6px;height:110px;padding-top:16px;border-bottom:1px solid var(--eb-line)}.st-chart .bars>div{flex:1;background:#D1D5DB;border-radius:3px 3px 0 0;position:relative;min-width:0}.st-chart .bars>div.ok{background:#15803D}.st-chart .bars>div.td{background:var(--eb-blue-d)}',
      '.st-chart .bars>div b{position:absolute;top:-15px;left:0;right:0;text-align:center;font-size:10px;font-weight:600;color:var(--eb-mut)}.st-chart .bars>div.td b{color:var(--eb-ink)}',
      '.st-chart .bars>s{position:absolute;left:0;right:0;border-top:2px dashed var(--eb-ink);opacity:.4;pointer-events:none}.st-chart .bars>em{position:absolute;right:0;margin-bottom:3px;font-size:10.5px;font-style:normal;color:var(--eb-ink2);background:#fff;padding:0 4px}',
      '.st-chart .hx{display:flex;gap:6px;font-size:10px;color:var(--eb-mut)}.st-chart .hx span{flex:1;text-align:center}.st-chart .hx span.td{font-weight:700;color:var(--eb-ink)}',
      '.st-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}@media(max-width:1100px){.st-cards{grid-template-columns:minmax(0,1fr)}}',
      '.st-card{display:flex;flex-direction:column;gap:8px}.st-card.alert{box-shadow:0 0 0 1.5px #FCA5A5,0 1px 2px rgba(15,27,61,.05)}',
      '.st-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.st-h b{font-size:15px;font-weight:700}',
      '.st-d7{display:inline-flex;gap:3px}.st-d7 i{width:10px;height:10px;border-radius:2px;background:#D1D5DB;display:inline-block}.st-d7 i.ok{background:#15803D}.st-d7 i.td{background:var(--eb-blue-d)}.st-d7 i.tdm{background:#DC2626}',
      '.st-card .eg-sxh{order:0}.st-ft{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11.5px;padding-top:6px}',
      '@media(max-width:900px){.eb-dec li{grid-template-columns:minmax(0,1fr)}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  O.eb = { views: views, keepRender: keepRender, forget: forget, ensure: ensure, E: E, ymd: ymd, dt: dt, addDays: addDays, today: today, num: num, baht: baht, pct: pct,
           chg: chg, chgP: chgP, thD: thD, thDow: thDow, hhmm: hhmm, CHAN_LBL: CHAN_LBL, variantOf: variantOf, kpi: kpi, src: src, hbar: hbar,
           chanCard: chanCard, liveTag: liveTag, seg: seg, toast: toast, canAlloc: canAlloc, mvDate: mvDate, last: {}, TH_DOW: TH_DOW };
})();
