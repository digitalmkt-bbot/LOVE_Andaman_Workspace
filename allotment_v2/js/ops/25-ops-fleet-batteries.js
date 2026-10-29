/* ════════════════════════════════════════════════════════════════════════
   §opsFleetBatteries (2026-10-29) · boat batteries ⇄ operation-backend (05-fleet.js §flBat)
   ────────────────────────────────────────────────────────────────────────
   Before this, FL_BATTERIES was only filled by the legacy /api/load blob (a 404 here) and flSave()
   is a no-op in ops mode, so the Batteries tab was always empty and every save vanished on reload.
   Hydrates FL_BATTERIES from the server and sends every battery write there first.

   GET    /v1/fleet/batteries                       → FL_BATTERIES (age, log and photos are the server's)
   POST   /v1/fleet/batteries                       fbSave, new battery; with replace_id the old one is retired in the same write
   PATCH  /v1/fleet/batteries/{id}                  fbSave on an open battery (install / move / to spare / correct)
   POST   /v1/fleet/batteries/{id}/volt             fbVolt      {volt}
   POST   /v1/fleet/batteries/{id}/uninstall        fbUninstall {location}
   POST   /v1/fleet/batteries/{id}/retire           fbRetire    {reason}
   Photos: kind 'bat' in 99-ops-fleet-photos.js → /v1/fleet/batteries/{id}/photos.
   A refusal shows the server's message and changes nothing on screen. Classic script · after 25-ops-fleet-stock.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var NAMES = ['fbSave', 'fbVolt', 'fbUninstall', 'fbRetire'];
  var orig = {};
  NAMES.forEach(function(n){ orig[n] = window[n]; });
  var state = { loaded: false, loading: null };

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function list(){
    if(!Array.isArray(window.FL_BATTERIES)) window.FL_BATTERIES = [];
    return window.FL_BATTERIES;
  }
  function photoFrom(p){ return typeof O.fleetPhotoFrom === 'function' ? O.fleetPhotoFrom(p) : p; }

  /* server battery → legacy FL_BATTERIES entry ('' for "none", camelCase) */
  function fromServer(b){
    b = b || {};
    var s = function(v){ return v == null ? '' : v; };
    return {
      id: b.id, boatId: s(b.boat_id), pos: s(b.pos), brand: s(b.brand), model: s(b.model), cap: s(b.cap), volt: s(b.volt), serial: s(b.serial),
      cost: Number(b.cost) || 0, supplier: s(b.supplier), status: b.status || 'spare', installDate: s(b.install_date), buyDate: s(b.buy_date),
      lifeMonths: Number(b.life_months) || 18, warrantyMonths: Number(b.warranty_months) || 0, spareLocation: s(b.spare_location), memoNo: s(b.memo_no),
      replacedId: s(b.replaced_id), replacedById: s(b.replaced_by_id), retiredDate: s(b.retired_date), retiredReason: s(b.retired_reason), note: s(b.note),
      photos: (b.photos || []).map(photoFrom),
      log: (b.log || []).map(function(l){ var o = { date: l.date, type: l.type, desc: l.desc, by: l.by || '' }; if(l.volt != null) o.volt = Number(l.volt); return o; }),
      age: b.age || null
    };
  }
  function replaceAll(rows){
    var target = list();
    target.length = 0;
    Array.prototype.push.apply(target, (rows || []).map(fromServer));
    return target;
  }
  function upsert(row){
    var target = list(), mapped = fromServer(row);
    var i = target.findIndex(function(x){ return x && x.id === mapped.id; });
    if(i < 0) target.push(mapped); else target[i] = mapped;
    return mapped;
  }
  function load(force){
    if(!enabled()) return Promise.resolve(false);
    if(state.loaded && !force) return Promise.resolve(true);
    if(state.loading) return state.loading;
    state.loading = O.get('/v1/fleet/batteries').then(function(res){
      replaceAll(res && res.batteries);
      state.loaded = true;
      after();
      return true;
    }).catch(function(e){ O.fail('Could not load batteries from operation-backend', e); throw e; })
      .finally(function(){ state.loading = null; });
    return state.loading;
  }
  function after(){ try{ if(typeof window.fbAfter === 'function') window.fbAfter(); }catch(_){} }
  function toast(msg){ try{ if(typeof window.flShowToast === 'function') window.flShowToast(msg); }catch(_){} }
  function can(){ try{ return typeof window.fbCan !== 'function' || window.fbCan(); }catch(_){ return true; } }
  function get(id){ return list().filter(function(x){ return x && x.id === id; })[0] || null; }

  /* one write; the answer is the battery as the server now has it (a replace also changes the old one: read the list again) */
  function write(title, send, reloadAll){
    return O.queue(send).then(function(res){
      O.wrote('fleet-battery');   // first: a read still in flight from before the write must not be reused
      var p = reloadAll ? load(true) : Promise.resolve(res && res.id ? upsert(res) : null);
      return p.then(function(){ after(); return res; });
    }, function(e){ O.fail(title, e); return null; });
  }

  /* fbSave: the open form, sent as it stands; the server checks it (boat, install date, position) */
  function formBody(M, cur){
    var g = function(k){ var el = document.getElementById(k); return el ? String(el.value || '').trim() : ''; };
    var st = g('fb-status');
    var body = {
      brand: g('fb-brand'), model: g('fb-model'), cap: g('fb-cap'), volt: g('fb-volt'), cost: parseFloat(g('fb-cost').replace(/,/g, '')) || 0,
      serial: g('fb-serial'), supplier: g('fb-supplier'), buy_date: g('fb-buy') || null,
      life_months: parseInt(g('fb-life'), 10) || window.FB_LIFE_DEFAULT || 18, warranty_months: parseInt(g('fb-war'), 10) || 0,
      memo_no: g('fb-memo'), note: g('fb-note')
    };
    if(cur && cur.status === 'retired') return body;   // a retired battery's facts can be corrected, not its status
    body.status = st;
    if(st === 'installed'){ body.boat_id = g('fb-boat'); body.pos = g('fb-pos'); body.install_date = g('fb-inst') || null; }
    else body.spare_location = g('fb-sploc');
    if(!cur && M.replaceId){ body.replace_id = M.replaceId; body.replace_reason = g('fb-rep-why') || 'เปลี่ยน'; }
    return body;
  }

  function wrap(name, fn){
    window[name] = function(){
      if(!enabled()) return orig[name] ? orig[name].apply(this, arguments) : undefined;
      return fn.apply(this, arguments);
    };
  }

  wrap('fbSave', function(){
    var FB = window.FB, M = FB && FB.modal; if(!M) return null;
    var cur = M.id ? get(M.id) : null;
    var body = formBody(M, cur);
    var send = cur
      ? function(){ return O.patch('/v1/fleet/batteries/' + enc(cur.id), body); }
      : function(){ return O.post('/v1/fleet/batteries', body); };
    return write(cur ? 'Battery not updated' : 'Battery not saved', send, !!body.replace_id).then(function(res){
      if(!res) return null;   // refused: the form stays open with what was typed
      if(typeof window.fbClose === 'function') window.fbClose();
      FB.sel = res.id;
      toast(cur ? 'Battery updated' : 'Battery saved');
      after();
      return res;
    });
  });
  wrap('fbVolt', function(id){
    if(!can() || !get(id)) return null;
    var v = window.prompt('Voltage reading (V) · e.g. 12.6', ''); if(v == null) return null;
    var n = parseFloat(v); if(!(n > 0)){ window.alert('Enter a number'); return null; }
    return write('Reading not saved', function(){ return O.post('/v1/fleet/batteries/' + enc(id) + '/volt', { volt: n }); });
  });
  wrap('fbUninstall', function(id){
    if(!can() || !get(id)) return null;
    var loc = window.prompt('Store where? (คลัง Tub Lamu / คลัง Visit Panwa)', 'คลัง Tub Lamu'); if(loc == null) return null;
    return write('Battery not taken off', function(){ return O.post('/v1/fleet/batteries/' + enc(id) + '/uninstall', { location: loc }); });
  });
  wrap('fbRetire', function(id){
    if(!can() || !get(id)) return null;
    var why = window.prompt('Reason (หมดอายุ / เสื่อม / เคลม)', 'เสื่อม'); if(why == null) return null;
    return write('Battery not retired', function(){ return O.post('/v1/fleet/batteries/' + enc(id) + '/retire', { reason: why }); });
  });

  var api = {
    load: function(){ return load(true); },
    ensureLoaded: function(){ return load(false); },
    /* after a photo write: the battery again (its photos and its log are the server's) */
    reload: function(id){ return O.get('/v1/fleet/batteries/' + enc(id)).then(function(res){ upsert(res); after(); return res; }); }
  };
  O.fleetBatteries = api;
  window.__laOpsFleetBatteriesCompat = { fromServer: fromServer, formBody: formBody };

  /* §loadOnOpen · only the fleet screens (fl-*) read batteries: the Batteries tab, a boat's page, the overview chips */
  if(enabled()){
    if(O.later) O.later('fleet batteries', function(){ return load(false); }, 5, ['fl-*']);
    else load(false).catch(function(){});
  }
})();
