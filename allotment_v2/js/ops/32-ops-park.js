/* ════════════════════════════════════════════════════════════════════════
   §opsPark (2026-10-12) · pier office park tickets (legacy §pkTk) on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET    /v1/pier-office/{pier}/park-tickets?date=      → the day's boats and people (read)
   PUT    /v1/pier-office/{pier}/park-tickets/{date}/names   → a name typed at the pier
   PUT    /v1/pier-office/{pier}/park-tickets/{date}/fixes   → a person counted under another type
   GET    /v1/pier-office/park-types                     → the type catalogue
   POST   /v1/pier-office/park-types                     → add a type
   PATCH  /v1/pier-office/park-types/{key}               → rename / regroup / recode a type
   DELETE /v1/pier-office/park-types/{key}               → delete an added type
     · the server computes every count, person and ticket; the browser shows them
       (pkTkData and pkTypes read the server cache in ops mode, never recount)
     · server first: a write goes out through O.queue, and the screen changes only
       from the server's answer (a re-read of the day or the type row it returned)
     · a refused write (409 duplicate_name / code_in_use, 400, 403) is a red toast and
       nothing on screen changes
     · no legacy PIER_CFG write (poPersist) in ops mode
   w5-f (85-ops-pier-park-w5.js): filling names from the lead ("<lead> (2)") and dropping typed names that copy the
   lead are the server's now (POST …/fill-lead, `lead_duplicates`). Not wired: the month overview (it reads the loaded
   day only; the server's month read has no nationality split of the heads, see docs/walk/w5-f.md).
   Legacy mode: every wrapper delegates to the captured original when !enabled().
   Classic script · loads after 08-app.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  // Legacy originals, captured before they are replaced. Legacy mode calls these exactly.
  var L = {
    renderPierPark: window.renderPierPark, pkTkData: window.pkTkData, pkTypes: window.pkTypes,
    pkTyModal: window.pkTyModal, pkNmEdit: window.pkNmEdit, pkFixSet: window.pkFixSet,
    pkNmClearBoat: window.pkNmClearBoat, pkNmDropOver: window.pkNmDropOver,
    pkNmFillLead: window.pkNmFillLead, pkNmDropLeadDup: window.pkNmDropLeadDup,
    pkTypeSet: window.pkTypeSet, pkTypeAdd: window.pkTypeAdd, pkTypeDel: window.pkTypeDel
  };

  // Server cache for the loaded day, plus the type catalogue. Filled only from server answers.
  var st = { key: '', pending: '', boats: [], tickets: [], types: null, seq: 0, nat: {} };
  var enc = encodeURIComponent;
  function dayBase(pier, date){ return '/v1/pier-office/' + enc(pier) + '/park-tickets/' + enc(date); }
  function curPier(){ return window._poPier || ''; }
  function curDate(){ return window._poDate || ''; }
  function fresh(date, pier){ return st.key === pier + '|' + date; }

  function failTitle(label, e){ return label + ' · ' + ((e && e.code) || 'error'); }
  function redraw(){ if(typeof window.renderPierPark === 'function') window.renderPierPark(); }
  function refreshTypeModal(){
    try{ if(document.getElementById('po-modal') && L.pkTyModal) L.pkTyModal(); }catch(_){}
  }

  /* ── reads ──────────────────────────────────────────────────────────── */
  function load(pier, date){
    pier = pier || curPier(); date = date || curDate();
    if(!pier || !date) return Promise.resolve(null);
    var key = pier + '|' + date, my = ++st.seq;
    st.pending = key;
    // The going heads by nationality (pk2BoatS's pax8) are the server's booked.nationality of the pier day's boats.
    return Promise.all([
      O.get('/v1/pier-office/' + enc(pier) + '/park-tickets', { date: date }),
      O.get('/v1/pier-office/' + enc(pier) + '/days/' + enc(date) + '/boats')
    ]).then(function(r){
      var j = r[0], nat = {};
      ((r[1] && r[1].boats) || []).forEach(function(b){ if(b.booked && b.booked.nationality) nat[b.boat_id] = b.booked.nationality; });
      if(my !== st.seq) return j;                      // a later request for another day won
      st.pending = ''; st.key = key; st.nat = nat;
      st.boats = (j && j.boats) || []; st.tickets = (j && j.tickets) || [];
      if(j && Array.isArray(j.types)) st.types = j.types;
      redraw();
      return j;
    }, function(e){
      if(my === st.seq) st.pending = '';
      O.fail('Park tickets did not load', e);
    });
  }
  // The renderer asks for a day it has not loaded yet: fetch it once, then redraw (the redraw finds it fresh).
  function ensure(){
    var pier = curPier(), date = curDate();
    if(!pier || !date || fresh(date, pier) || st.pending === pier + '|' + date) return;
    load(pier, date);
  }
  function loadTypes(){
    return O.get('/v1/pier-office/park-types').then(function(j){
      st.types = (j && j.types) || [];
      redraw(); refreshTypeModal();
      return j;
    }, function(e){ O.fail('Ticket types did not load', e); });
  }

  /* ── converting the server's rows to the shape the legacy renderer reads ── */
  function natName(n){ try{ return typeof window.pkTkNatName === 'function' ? window.pkTkNatName(n) : ''; }catch(_){ return ''; } }
  function nat3(n){ try{ return typeof window.pckNat3 === 'function' ? window.pckNat3(n) : n; }catch(_){ return n; } }
  function convPerson(p){
    var nat = p.nationality || '';
    return {
      ph: !!p.ph, typed: !!p.typed, seq: p.seq, cat: p.cat, auto: p.auto, fixed: !!p.fixed,
      f: p.first || '', l: p.last || '', full: p.full || '',
      nat2: nat, nat3: nat3(nat), natName: natName(nat), natFromLead: !!p.ph,
      mism: !!p.mismatch, over: !!p.over,
      ix: p.slot, bkId: p.booking_id, vc: p.voucher || '', lead: p.lead || ''
    };
  }
  function routeColor(rid){
    try{
      var R = Array.isArray(window.DEFAULT_ROUTES) ? window.DEFAULT_ROUTES : [];
      for(var i = 0; i < R.length; i++) if(R[i] && R[i].id === rid && R[i].color) return R[i].color;
    }catch(_){}
    return '#94A3B8';
  }
  function convBoat(b){
    var cnt = {
      adTH: b.counts.adTH || 0, chTH: b.counts.chTH || 0, adFR: b.counts.adFR || 0, chFR: b.counts.chFR || 0, inf: b.counts.inf || 0
    };
    return {
      bid: b.boat_id, boat: { id: b.boat_id, name: b.boat_name }, dep: b.departure || '',   // the job's own time, else the route's first (server)
      cnt: cnt, tot: b.tot, cntPc: cnt, totPc: b.tot, pcDiff: false, pax8: st.nat[b.boat_id] || {},
      booked: b.booked, people: (b.people || []).map(convPerson), miss: b.miss || {}, missTot: b.miss_total || 0,
      orphan: (b.orphans || []).map(function(o){ return { full: o.full, cat: o.cat, seq: o.seq, bkId: o.booking_id, vc: '', lead: '' }; }),
      byNat: false
    };
  }

  window.pkTkData = function(date, pier){
    if(!O.enabled()) return L.pkTkData.apply(this, arguments);
    if(!fresh(date, pier)) return [];
    var byRid = {}, order = [];
    st.boats.forEach(function(b){
      var g = byRid[b.route_id];
      if(!g){ g = byRid[b.route_id] = { rid: b.route_id, route: { name: b.route_name, color: routeColor(b.route_id) }, boats: [] }; order.push(g); }
      g.boats.push(convBoat(b));
      if(b.departure && O.pier){ O.pier.dep = O.pier.dep || {}; O.pier.dep[st.key.split('|')[1] + '|' + b.boat_id] = { departure: b.departure, source: b.departure_source || null }; }   // read by pjDepOf (47)
    });
    return order;
  };

  window.pkTypes = function(){
    if(!O.enabled() || !st.types) return L.pkTypes.apply(this, arguments);
    var base = Array.isArray(window.PK_BASE) ? window.PK_BASE : [];
    var add = Array.isArray(window.PK_ADDC) ? window.PK_ADDC : ['#B4560A'];
    return st.types.map(function(t, i){
      var B = null;
      for(var j = 0; j < base.length; j++) if(base[j].k === t.key) B = base[j];
      return { k: t.key, n: t.name, s: t.short || t.name, grp: t.group, code: t.code || '',
               c: B ? B.c : add[i % add.length], ch: B ? B.ch : [], base: !!t.base };
    });
  };

  window.renderPierPark = function(pier){
    var r = L.renderPierPark.apply(this, arguments);
    if(O.enabled()) ensure();
    return r;
  };

  /* ── writes ─────────────────────────────────────────────────────────── */
  // The seat the renderer means: a typed seat of this booking with this number, under the type shown
  // (the fixed one) or the seat's own type. Typed seats are keyed by their own type on the server.
  function findSeat(bkId, seq, cat){
    var hit = null;
    st.boats.forEach(function(b){ (b.people || []).forEach(function(p){
      if(!p.ph || p.booking_id !== bkId || p.seq !== +seq) return;
      if(p.cat === cat) hit = hit || p;
    }); });
    if(hit) return hit;
    st.boats.forEach(function(b){ (b.people || []).forEach(function(p){
      if(!hit && p.ph && p.booking_id === bkId && p.seq === +seq && p.auto === cat) hit = p;
    }); });
    return hit;
  }
  function slotOf(bkId, idx){
    var s = String(idx);
    if(s.indexOf('ph|') === 0){
      var parts = s.split('|');
      var seat = findSeat(bkId, parts[2], parts[1]);
      return seat ? seat.slot : null;
    }
    return s;
  }

  // One write at a time, then re-read the day so the screen shows what the server holds.
  function writeDay(label, fn){
    return O.queue(fn).then(function(r){
      O.wrote('park');
      return load().then(function(){ return r; });
    }, function(e){
      O.fail(failTitle(label, e), e);
      redraw();
      return null;
    });
  }

  window.pkNmEdit = function(el, date, bkId, cat, seq){
    if(!O.enabled()) return L.pkNmEdit.apply(this, arguments);
    var seat = findSeat(bkId, seq, cat);
    var v = String((el && el.value) || '').trim();
    if(!seat){ O.fail('Name not saved · seat not on this day', new Error('Reload the page and try again.')); redraw(); return; }
    var base = dayBase(curPier(), date);
    var body = { booking_id: bkId, cat: seat.auto, seq: +seq, name: v || null };
    return writeDay('Name not saved', function(){ return O.call('PUT', base + '/names', body); });
  };

  window.pkFixSet = function(date, bkId, idx, v){
    if(!O.enabled()) return L.pkFixSet.apply(this, arguments);
    var slot = slotOf(bkId, idx);
    if(!slot){ O.fail('Type not saved · seat not on this day', new Error('Reload the page and try again.')); redraw(); return; }
    var base = dayBase(curPier(), date);
    var body = { booking_id: bkId, slot: slot, type: v ? String(v) : null };
    return writeDay('Type not saved', function(){ return O.call('PUT', base + '/fixes', body); });
  };

  // Clears a list of typed names one by one (each its own PUT), then re-reads the day.
  function clearNames(date, list, label){
    var base = dayBase(curPier(), date);
    return writeDay(label, function(){
      return list.reduce(function(p, s){
        return p.then(function(){ return O.call('PUT', base + '/names', { booking_id: s.booking_id, cat: s.cat, seq: +s.seq, name: null }); });
      }, Promise.resolve());
    });
  }

  window.pkNmClearBoat = function(date, bid, pier){
    if(!O.enabled()) return L.pkNmClearBoat.apply(this, arguments);
    if(!confirm('ล้างชื่อที่กรอกเองของลำนี้ทั้งหมด?')) return;
    var list = [];
    st.boats.forEach(function(b){ if(b.boat_id !== bid) return;
      (b.people || []).forEach(function(p){ if(p.ph && p.typed) list.push({ booking_id: p.booking_id, cat: p.auto, seq: p.seq }); });
    });
    if(!list.length) return;
    return clearNames(date, list, 'Names not cleared');
  };

  window.pkNmDropOver = function(date, bid, pier){
    if(!O.enabled()) return L.pkNmDropOver.apply(this, arguments);
    var list = [];
    st.boats.forEach(function(b){ if(b.boat_id !== bid) return;
      (b.orphans || []).forEach(function(o){ list.push({ booking_id: o.booking_id, cat: o.cat, seq: o.seq, full: o.full }); });
    });
    if(!list.length) return;
    if(!confirm('ลบชื่อที่เกินหัวที่ต้องซื้อ '+list.length+' ชื่อ\n\n  '
        +list.map(function(o){ return o.full; }).join('\n  ')
        +'\n\nเป็นชื่อของคนที่ยกเลิก/ไม่มา ตอนนี้ไม่มีตั๋วรองรับแล้ว\n'
        +'ถ้าคนกลับมาเดินทางได้ ต้องพิมพ์ชื่อใหม่')) return;
    return clearNames(date, list, 'Names not cleared');
  };

  // pkNmFillLead, pkNmLeadDup, pkNmDropLeadDup: the server's commands, see 85-ops-pier-park-w5.js (w5-f)

  /* ── type catalogue ─────────────────────────────────────────────────── */
  var FIELD = { n: 'name', grp: 'group', code: 'code' };
  function replaceType(t){
    if(!st.types) st.types = [];
    var i = -1;
    for(var k = 0; k < st.types.length; k++) if(st.types[k].key === t.key) i = k;
    if(i >= 0) st.types[i] = t; else st.types.push(t);
  }
  function typeWrite(label, fn, after){
    return O.queue(fn).then(function(r){
      O.wrote('park');
      if(after) after(r);
      redraw(); refreshTypeModal();
      return r;
    }, function(e){
      O.fail(failTitle(label, e), e);
      redraw(); refreshTypeModal();
      return null;
    });
  }

  window.pkTypeSet = function(k, f, v){
    if(!O.enabled()) return L.pkTypeSet.apply(this, arguments);
    var field = FIELD[f]; if(!field) return;
    var body = {}; body[field] = (String(v == null ? '' : v).trim()) || null;
    return typeWrite('Type not saved', function(){ return O.call('PATCH', '/v1/pier-office/park-types/' + enc(k), body); },
      function(r){ if(r && r.type) replaceType(r.type); });
  };

  window.pkTypeAdd = function(){
    if(!O.enabled()) return L.pkTypeAdd.apply(this, arguments);
    return typeWrite('Type not added', function(){ return O.call('POST', '/v1/pier-office/park-types', { name: 'ประเภทใหม่', group: 'ad' }); },
      function(r){ if(r && r.type) replaceType(r.type); });
  };

  window.pkTypeDel = function(k){
    if(!O.enabled()) return L.pkTypeDel.apply(this, arguments);
    return typeWrite('Type not deleted', function(){ return O.call('DELETE', '/v1/pier-office/park-types/' + enc(k)); },
      function(){ st.types = (st.types || []).filter(function(t){ return t.key !== k; }); });
  };

  // Opening the type box re-reads the catalogue first, so it shows the server's table.
  window.pkTyModal = function(){
    if(!O.enabled()) return L.pkTyModal.apply(this, arguments);
    if(L.pkTyModal) L.pkTyModal();
    return loadTypes();
  };

  // w5-f: 85-ops-pier-park-w5.js asks for the day's raw boat (lead_duplicates) and writes through the same queue
  O.park = { load: load, loadTypes: loadTypes, writeDay: writeDay, clearNames: clearNames, dayBase: dayBase, conv: convPerson,
             rawBoat: function(date, pier, bid){ if(!fresh(date, pier)) return null; for(var i = 0; i < st.boats.length; i++) if(st.boats[i].boat_id === bid) return st.boats[i]; return null; } };
})();
