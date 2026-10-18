/* ═════════════════════════════════════════════════════════════════
   §opsVanCheckin (w4-f2, 2026-10-18) · Van Check-in KPI, van order and "not yet in a van" from GET /v1/van-checkin

   Legacy renderVanCheckin works out, in the browser, everything above and between the rows: the KPI chips
   (ขึ้นรถแล้ว n/m, ค้างจัดการ, รอ / No-show / CXL / ไปเจอที่ท่า), each van's header tally (ขึ้นรถ x/y · pax · หาย),
   the order of the vans and the zone bands, and the list of bookings that still need a van. The server serves all
   of them (README "The Van Check-in numbers", src/domain/van-checkin.ts):

     GET /v1/van-checkin?date=&route_id=&family_id=
       kpi        { checked rows percent strand no_show_at_checkin heads { booked boarded no_show cxl to_pier waiting } }
       vans[]     { van_id route_id rows checked booked lost going zone order ... }   (in the screen's order)
       zones[]    { zone vans rows pax }
       unassigned { n pax rows[] }

   The rows themselves (ckRowHtml: the tick, the counter, the events) stay legacy's drawing of the booking records the
   screen holds. Legacy draws first; this file then puts the server's figures on that drawing, in place and in one step
   (ckSyncSticky(host) is the last thing renderVanCheckin does, so every draw goes through it, the 35-ops-van-jobs redraws
   too), and reads the day again whenever the answer it holds is not for what is on screen. A write drops the answer
   (the arithmetic of legacy shows until the next one, which is the same number unless two machines disagree).

   With a text search typed (the server leaves search to the client) nothing is replaced: legacy's own counts show.
   Until the first answer, offline, and in non-ops mode legacy's counts show.

   Load order: before 90-ops-boot.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var cache = {};       // key -> { at, data, sig, loading, gen }
  var gen = 0;
  var TTL = 6000;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function esc(v){ var f = window.ckEsc; return typeof f === 'function' ? f(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function num(v){ return +v || 0; }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function sanitize(k){ return String(k).replace(/[^A-Za-z0-9_-]/g, '_'); }

  function scope(){
    var date = '', route = '', fam = '', q = '';
    try{ date = typeof _vanCkDate !== 'undefined' ? _vanCkDate : ''; route = typeof _vckRoute !== 'undefined' ? _vckRoute : ''; fam = typeof _vckFam !== 'undefined' ? _vckFam : ''; q = typeof _vckQ !== 'undefined' ? _vckQ : ''; }catch(_){}
    date = date || ''; route = route || ''; fam = fam || ''; q = q || '';
    return { date: date, route: route, fam: route ? '' : fam, q: String(q || '').trim() };
  }
  function keyOf(s){ return s.date + '|' + s.route + '|' + s.fam; }

  function host(){ return document.getElementById('vancheckin-host'); }
  function visible(){ var h = host(); return !!(h && h.offsetParent); }

  /* ── the read ── */
  function ensure(s, force){
    if(!enabled() || !s.date) return Promise.resolve(null);
    var key = keyOf(s), c = cache[key];
    if(c && c.loading && c.gen === gen) return c.loading;
    if(c && c.data && !force && c.gen === gen && Date.now() - c.at < TTL) return Promise.resolve(c);
    var cur = cache[key] = { at: 0, data: (c && c.gen === gen) ? c.data : null, sig: (c && c.gen === gen) ? c.sig : '', loading: null, gen: gen };
    var q = { date: s.date }; if(s.route) q.route_id = s.route; else if(s.fam) q.family_id = s.fam;
    var mine = gen;
    cur.loading = O.get('/v1/van-checkin', q).then(function(res){
      cur.loading = null;
      if(mine !== gen || cache[key] !== cur) return null;              // a write dropped it while the read was out: the next draw asks again
      var sig = JSON.stringify(res || {});
      cur.data = res || null; cur.at = Date.now(); var changed = sig !== cur.sig; cur.sig = sig;
      if(changed || !cur.patched) applyIfOpen();
      return cur;
    }, function(){ cur.loading = null; cur.at = Date.now(); return cur; });   // a failing read leaves legacy's counts in charge and is not hammered
    return cur.loading;
  }
  function current(){
    var s = scope(), c = cache[keyOf(s)];
    return (c && c.data && c.gen === gen) ? c : null;
  }

  /* ── pieces of markup, the same as legacy's ── */
  function kchip(bg, fg, lbl, n, tip){ return n > 0 ? '<span title="' + esc(tip || '') + '" style="background:' + bg + ';color:' + fg + '">' + lbl + ' ' + n + '</span>' : ''; }
  function kpiHtml(k){
    var h = k.heads || {};
    return '<span style="background:#E1F5EE;color:#0F6E56">ขึ้นรถแล้ว ' + num(k.checked) + '/' + num(k.rows) + '</span>'
      + (num(k.strand) > 0 ? ('<span title="จัดรถไว้แล้วแต่ใบจองถูกยกเลิก · ยังคาอยู่ในกลุ่มรถเดิมจนกว่าจะมีคนกดล้างการจัดรถ" style="background:#FCE4E4;color:#A32D2D">ค้างจัดการ ' + num(k.strand) + '</span>') : '')
      + kchip('#F1EFE8', '#5F5E5A', 'รอ', num(h.waiting), 'ยังไม่ได้เช็คอินและยังไม่ได้กด No-show')
      + kchip('#FCEBEB', '#A32D2D', 'No-show', num(h.no_show), 'ไม่ได้ขึ้นรถและยังไม่มีใครยืนยันว่ามาถึงท่า')
      + kchip('#FBF3E6', '#8A5B00', 'CXL', num(h.cxl), 'ยกเลิกหน้างาน')
      + kchip('#F4E8FB', '#6B289A', 'ไปเจอที่ท่า', num(h.to_pier), 'ไปเองที่ท่า/ไปรถคันอื่น · ยังถือว่าเดินทาง รอหน้าท่ายืนยัน');
  }
  function vanTallyHtml(v){
    var lost = num(v.lost), go = num(v.going), pax = num(v.booked);
    return 'ขึ้นรถ ' + num(v.checked) + '/' + num(v.rows) + ' · '
      + (lost > 0 ? ('<b style="color:#A32D2D;font-size:13px">' + go + '</b> pax <s style="color:#c2c0b7">' + pax + '</s>') : (pax + ' pax'))
      + (lost > 0 ? ' · <span style="color:#A32D2D;font-weight:700">หาย ' + lost + '</span>' : '');
  }
  function zoneHeadHtml(z){
    var lbl = typeof g('bookingV2ZoneLabel') === 'function' ? window.bookingV2ZoneLabel(z.zone) : (z.zone || '—');
    var col = typeof g('bookingV2ZoneColor') === 'function' ? window.bookingV2ZoneColor(z.zone) : '#8a8a82';
    return '<tr class="ck-zhead" data-ops-zone="' + esc(z.zone) + '"><td colspan="17"><span style="width:9px;height:9px;border-radius:50%;background:' + col + ';display:inline-block"></span><span class="ck-zn">' + esc(lbl)
      + '</span><span class="ck-zc">· ' + num(z.vans) + ' คัน · ' + num(z.rows) + ' booking · ' + num(z.pax) + ' pax</span></td></tr>';
  }

  /* ── put the server's figures on the drawing ── */
  function patchKpi(h, d){
    var el = h.querySelector('.ck-kpi'); if(!el || !d.kpi) return;
    var html = kpiHtml(d.kpi);
    if(el.innerHTML !== html) el.innerHTML = html;
  }
  function patchVans(h, d){
    var table = h.querySelector('table.vck-sheet'); if(!table) return;
    var vans = Array.isArray(d.vans) ? d.vans.slice().sort(function(a, b){ return num(a.order) - num(b.order); }) : [];
    var bodies = Array.prototype.slice.call(table.tBodies), byKey = {}, legacyKeys = [], zheads = [];
    bodies.forEach(function(tb){
      var gh = tb.querySelector('tr.ck-ghd > td > div[id^="vckg-"]');
      if(gh){ var k = gh.id.slice(5); byKey[k] = { tb: tb, head: gh }; legacyKeys.push(k); }
      else if(tb.querySelector('tr.ck-zhead')) zheads.push(tb);
    });
    // each van header: the server's tally
    vans.forEach(function(v){
      var e = byKey[sanitize(v.van_id + '~' + v.route_id)]; if(!e) return;
      var span = e.head.lastElementChild;
      if(span && /margin-left:auto/.test(span.getAttribute('style') || '')){ var html = vanTallyHtml(v); if(span.innerHTML !== html) span.innerHTML = html; }
    });
    // the order of the vans, and the zone bands in it
    var zones = {}; (d.zones || []).forEach(function(z){ zones[z.zone] = z; });
    var seq = [], prevZone = null, used = {};
    vans.forEach(function(v){
      var k = sanitize(v.van_id + '~' + v.route_id); if(!byKey[k]) return;
      if(v.zone !== prevZone){ prevZone = v.zone; seq.push({ zone: zones[v.zone] || { zone: v.zone, vans: 0, rows: 0, pax: 0 } }); }
      seq.push({ key: k }); used[k] = 1;
    });
    legacyKeys.forEach(function(k){ if(!used[k]) seq.push({ key: k }); });   // a van with only cancelled / moved-away rows is not in the server's list: it keeps its place after the rest
    var want = seq.map(function(x){ return x.key ? 'g:' + x.key : 'z:' + x.zone.zone + ':' + x.zone.vans + ':' + x.zone.rows + ':' + x.zone.pax; }).join('|');
    if(table.getAttribute('data-ops-order') === want && !h.querySelector('[data-ops-stale]')) return;
    zheads.forEach(function(tb){ table.removeChild(tb); });
    legacyKeys.forEach(function(k){ table.removeChild(byKey[k].tb); });
    seq.forEach(function(x){
      if(x.key){ table.appendChild(byKey[x.key].tb); return; }
      var tb = document.createElement('tbody'); tb.innerHTML = zoneHeadHtml(x.zone); table.appendChild(tb);
    });
    table.setAttribute('data-ops-order', want);
  }
  function localBooking(id){
    var list = typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : [];
    return list.filter(function(b){ return b && (b.opsId === id || b.id === id); })[0] || null;
  }
  function patchUnassigned(h, d){
    var table = h.querySelector('table.vck-sheet'); if(!table || !d.unassigned) return;
    var u = d.unassigned, body = table.tBodies[0]; if(!body) return;
    var rows = Array.isArray(u.rows) ? u.rows : [];
    var warn = body.querySelector('tr.ck-warn');
    var label = function(r){ var b = localBooking(r.booking_id); return String((b && (b.voucherRef || b.code)) || r.voucher_ref || '—'); };
    var lead = function(r){ var b = localBooking(r.booking_id); return String(r.lead_pax || (b && b.leadPax) || '—'); };
    // a row is told by its voucher and lead (many have no voucher): the server's rows are counted off against the drawn ones
    var left = {}; rows.forEach(function(r){ var k = label(r) + '|' + lead(r); left[k] = (left[k] || 0) + 1; });
    var seen = {}, unseen = rows.slice();
    // legacy rows that the server does not list: remove; the ones it lists stay as legacy drew them
    Array.prototype.slice.call(body.querySelectorAll('tr.ck-unassigned')).forEach(function(tr){
      var k = ((tr.querySelector('.ck-vch') || {}).textContent || '') + '|' + ((tr.querySelector('.ck-lead') || {}).textContent || '');
      if(left[k] > 0){
        left[k]--; tr.setAttribute('data-ops-unassigned', k);
        for(var i = 0; i < unseen.length; i++){ if(label(unseen[i]) + '|' + lead(unseen[i]) === k){ unseen.splice(i, 1); break; } }
      } else tr.parentNode.removeChild(tr);
    });
    if(!num(u.n)){ if(warn && warn.parentNode) warn.parentNode.removeChild(warn); return; }
    // server rows the legacy drawing did not have: a short row (voucher, agency, lead, heads)
    var anchor = warn;
    unseen.forEach(function(r){
      var k = label(r) + '|' + lead(r);
      var b = localBooking(r.booking_id), ag = r.agent_id && typeof g('sbGetAgent') === 'function' ? window.sbGetAgent(r.agent_id) : null;
      var tr = document.createElement('tr'); tr.className = 'ck-unassigned'; tr.style.opacity = '.75'; tr.setAttribute('data-ops-unassigned', k);
      tr.innerHTML = '<td><span class="ck-vch">' + esc(label(r)) + '</span></td><td><span style="color:#8a8a82;font-weight:600">' + esc(ag ? (ag.name || ag.code || '—') : (r.agent_id || 'walk-in')) + '</span></td><td><span class="ck-dim">—</span></td>'
        + '<td><span class="ck-lead" style="background:#F6E27A">' + esc(r.lead_pax || (b && b.leadPax) || '—') + '</span></td><td class="ck-c" colspan="4">' + num(r.booked) + ' pax</td><td class="ck-mono">' + esc(r.pickup_time || '—') + '</td><td colspan="8"><span class="ck-dim">' + esc(r.zone || '') + '</span></td>';
      if(!warn){
        warn = document.createElement('tr'); warn.className = 'ck-warn'; warn.innerHTML = '<td colspan="17"></td>'; body.insertBefore(warn, body.firstChild); anchor = warn;
      }
      body.insertBefore(tr, anchor ? anchor.nextSibling : body.firstChild); anchor = tr;
    });
    if(warn){
      var td = warn.firstElementChild;
      if(td){ var html = td.innerHTML.replace(/ยังไม่จัดรถ · \d+ booking · \d+ pax/, 'ยังไม่จัดรถ · ' + num(u.n) + ' booking · ' + num(u.pax) + ' pax');
        if(td.innerHTML !== html) td.innerHTML = html;
        if(!/ยังไม่จัดรถ/.test(td.textContent)) td.innerHTML = '&#9888; ยังไม่จัดรถ · ' + num(u.n) + ' booking · ' + num(u.pax) + ' pax — จัดรถก่อนถึงเช็คอินได้ &nbsp; <a onclick="nav(document.querySelector(\'[data-view=booking]\'))" style="color:#185FA5;cursor:pointer;text-decoration:none">&rarr; ไปจัดรถ (By-trip)</a>'; }
    }
  }

  function patch(h, c){
    if(!h || !c || !c.data) return;
    var s = scope(); if(s.q) return;                       // text search is the client's: legacy's counts stay
    patchKpi(h, c.data); patchVans(h, c.data); patchUnassigned(h, c.data);
    c.patched = true; h.setAttribute('data-ops-vck', c.sig ? String(c.sig.length) : '1');
    if(O.vanRows && O.vanRows.sync) O.vanRows.sync();                 // w5-d: row status and order are the answer's too (83-ops-van-rows.js)
  }
  function applyIfOpen(){
    if(!enabled() || !visible()) return;
    var c = current(); if(c) patch(host(), c);
  }

  /* every draw of the sheet ends with ckSyncSticky(host): patch what is there, and ask when the answer is not for this scope */
  var origSync = window.ckSyncSticky;
  if(typeof origSync === 'function'){
    window.ckSyncSticky = function(h){
      var r = origSync.apply(this, arguments);
      try{
        if(enabled() && h && h.id === 'vancheckin-host'){
          var s = scope(), c = cache[keyOf(s)];
          if(c && c.data && c.gen === gen) patch(h, c);
          if(!s.q) ensure(s);
        }
      }catch(e){ if(window.console) console.warn('[ops] van check-in figures · ' + (e && e.message)); }
      return r;
    };
    window.ckSyncSticky.__opsVanCheckin = true;
  }

  /* a write (a tick, a move, a booking) drops what is held; the open sheet reads again */
  O.onWrite(function(){
    gen++; cache = {};
    if(visible()){ var s = scope(); if(!s.q) ensure(s); }
  });

  O.vanCheckin = { ensure: function(date, route, fam){ return ensure({ date: date || scope().date, route: route || '', fam: fam || '', q: '' }, true); }, scope: scope, current: current, patch: applyIfOpen, clear: function(){ gen++; cache = {}; } };
})();
