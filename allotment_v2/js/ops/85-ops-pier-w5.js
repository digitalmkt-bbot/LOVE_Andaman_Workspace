/* ══════════════════════════════════════════════════════════════════════════
   §opsPierW5 (w5-f, 2026-10-18) · the pier job card: what the browser still decided, now the server's
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "Pier office: job sheets, team and duty" and "Guide orders".

     pjChtrOf(B)       ← GET …/days/{date}/boats/{boat}/job  `charter { who, heads, mixed, seat_heads, voucher }`
     pjItinOf          ← the job's `itinerary { text, own, colour, from }` (own day, else the same boat's nearest earlier day on the
                         same route, else the route's islands; legacy lk-inbox §pjItinCarry). Until the day is read, or while an
                         edit is waiting to be sent, legacy's own answer shows.
     pjItinSet         sends what was typed as `itinerary_text` (the server turns -> => > ➜ into →, cuts nothing: over 200 is its 400);
                         the colour goes as `itinerary_colour` (47-ops-pier-job.js proj). Legacy's browser-side arrow rewrite is off.
     pjCopyYday        ← POST …/days/{date}/jobs/copy-yesterday  → { copied, skipped_complete, none_yesterday }; the day is read again
     pjAllBoats        ← GET …/days/{date}/boats `fleet[]` (which boats the pier lists, their order, the "away" flag) once it is read
     pjGdLead          ← GET /v1/guide-orders/{date}/{boat}/sheet `lead_guide` (the first guide-role person of the saved order)
   Legacy mode (!P.enabled()): every wrapper delegates to the captured original. Classic script · after 47, 72 and 73-*.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.pier || !O.pierJob) return;
  var P = O.pier, enc = encodeURIComponent;
  function on(){ return P.enabled() && P.loaded; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w5f) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w5f = true; w.__orig = orig; window[name] = w;
  }
  function jview(date, bid){ return O.pierJob.state.views[date + '::' + bid] || null; }
  function again(){ if(!P.busy || !P.busy()){ try{ if(typeof window.renderPierJob === 'function') window.renderPierJob(); }catch(_){} } }

  /* ── pjChtrOf: the charter on a boat ────────────────────────────────── */
  wrap('pjChtrOf', function(orig, B){
    var v = B && B.bid ? jview(window._poDate, B.bid) : null;
    if(!v || !('charter' in v)) return orig.apply(this, [].slice.call(arguments, 1));
    var c = v.charter; if(!c) return null;
    return { who: String(c.who || '').trim(), n: +c.heads || 0, mixed: !!c.mixed, seat: +c.seat_heads || 0, vc: c.voucher || '' };
  });

  /* ── pjItinOf / pjItinSet: the boat's island itinerary of the day ───── */
  wrap('pjItinOf', function(orig, date, bid, rt){
    var args = [].slice.call(arguments, 1), v = jview(date, bid), it = v && v.itinerary;
    if(!it) return orig.apply(this, args);
    var raw = typeof window.pjRaw === 'function' ? window.pjRaw(date, bid) : null;
    // an edit that is not sent yet: the card shows what was typed (legacy's answer over the card), the server's once it has answered
    if(raw && (String(raw.itin || '') !== String(v.itinerary_text || '') || String(raw.itinc || '') !== String(v.itinerary_colour || ''))) return orig.apply(this, args);
    return { t: String(it.text || ''), own: !!it.own, c: /^#[0-9a-fA-F]{6}$/.test(it.colour || '') ? it.colour : '', from: it.from || '' };
  });
  wrap('pjItinSet', function(orig, bid, val){
    if(typeof window.poGuard === 'function' && !window.poGuard()) return;
    window.pjSet(window._poDate, bid, { itin: String(val == null ? '' : val).trim() });
    window.renderPierJob();
  });

  /* ── pjCopyYday: "copy yesterday" is the server's command ───────────── */
  wrap('pjCopyYday', function(orig, pier){
    if(typeof window.poCanEdit === 'function' && !window.poCanEdit()) return;
    var date = window._poDate, d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - 1);
    var prev = typeof window.poYMD === 'function' ? window.poYMD(d) : d.toISOString().slice(0, 10);
    return P.flush().then(function(){
      return O.queue(function(){ return O.call('POST', '/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/jobs/copy-yesterday'); });
    }).then(function(r){
      O.wrote('pier');
      return O.pierJob.loadDay(pier, date).then(function(){
        var n = ((r && r.copied) || []).length, skip = ((r && r.skipped_complete) || []).length;
        if(!n && !skip) alert('เมื่อวาน (' + prev + ') ยังไม่มีใบงานที่บันทึกไว้');
        else if(skip) alert('คัดลอกมา ' + n + ' ลำ · ข้าม ' + skip + ' ลำที่กดจัดเสร็จแล้วไว้'
          + '\n\nถ้าต้องการทับลำที่ข้ามไป ให้กดแก้ไขที่ท้ายการ์ดของลำนั้นก่อน');
        window.renderPierJob();
        return r;
      });
    }, function(e){
      O.fail('Copy yesterday not done' + (e && e.code ? ' · ' + e.code : ''), e);
      P.redraw();
    });
  });

  /* ── pjAllBoats: the pier's boats of the day, as the server lists them ─ */
  wrap('pjAllBoats', function(orig, date, pier){
    var out = orig.apply(this, [].slice.call(arguments, 1));
    var DB = O.pier.dayBoats, e = DB && DB.entry && DB.entry(pier, date);
    if(!e || !e.order) return out;
    var byId = {}; out.forEach(function(B){ byId[B.bid] = B; });
    var res = [];
    e.order.forEach(function(id){
      var f = e.fleet[id]; if(!f || f.no_charter) return;                 // not hired today: not a boat of the pier (legacy §pjCharter)
      var B = byId[id];
      if(!B){
        var boat = typeof window.getBoat === 'function' ? window.getBoat(id) : null; if(!boat) return;
        B = { bid: id, boat: boat, rid: '', route: {}, dep: '', pax: 0, bks: [], _away: null, _asn: null, _shop: '' };
        B._st = typeof window.pjBoatSt === 'function' ? window.pjBoatSt(date, boat, false) : { k: f.state };
      }
      if(f.state === 'away' && !B._away){
        var rt = f.route_id && typeof window.getRoute === 'function' ? window.getRoute(f.route_id) : null;
        B._away = { op: { route: f.route_id }, rid: f.route_id, route: rt || {} };
      }
      res.push(B);
    });
    return res;
  });

  /* ── pjGdLead: who leads the guide order ────────────────────────────── */
  var lead = {}, leadLoading = {};
  O.onWrite(function(){ Object.keys(lead).forEach(function(k){ lead[k].old = true; }); });
  function askLead(date, bid){
    var k = date + '::' + bid; if(leadLoading[k]) return; leadLoading[k] = true;
    O.get('/v1/guide-orders/' + enc(date) + '/' + enc(bid) + '/sheet').then(function(j){
      var id = j && j.lead_guide && j.lead_guide.id || '', was = lead[k];
      lead[k] = { id: id, old: false, shown: was ? was.shown : undefined };
      delete leadLoading[k];
      if(!was || was.shown !== id) again();
    }, function(){ delete leadLoading[k]; if(lead[k]) lead[k].old = false; });
  }
  wrap('pjGdLead', function(orig, bid){
    var date = window._poDate, k = date + '::' + bid, c = lead[k];
    if(!c || c.old) askLead(date, bid);
    if(!c) return orig.apply(this, [].slice.call(arguments, 1));
    c.shown = c.id;
    return c.id;
  });
})();
