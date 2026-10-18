/* ══════════════════════════════════════════════════════════════════════════
   §opsPierParkW5 (w5-f, 2026-10-18) · park tickets: names from the lead and lead-copy names are the server's
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "Pier office: park tickets".

     pkNmFillLead(date, bid, pier)      → POST …/park-tickets/{date}/fill-lead { boat_id } → { filled: [{ booking_id, cat, seq, name }] }
                                          The server names the boat's empty seats "<lead> (2)", "(3)" … never a name already on the
                                          day; the day is read again. Nothing filled: legacy's alert.
     pkNmLeadDup(B)                     ← GET park-tickets `boats[].lead_duplicates` (typed names equal to the lead's, in a booking
                                          whose list already has it)
     pkNmDropLeadDup(date, bid, pier)   legacy's confirm, then the same names are cleared (PUT …/names { name: null })
   The dialogs and Thai texts are legacy's. Legacy mode: the originals answer. Classic script · after 32-ops-park.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.park || !O.park.writeDay) return;
  var enc = encodeURIComponent;
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w5f) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!O.enabled()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w5f = true; w.__orig = orig; window[name] = w;
  }
  function dups(date, pier, bid){
    var b = O.park.rawBoat(date, pier, bid);
    return b ? (b.lead_duplicates || []).map(O.park.conv) : null;
  }

  wrap('pkNmFillLead', function(orig, date, bid, pier){
    var base = O.park.dayBase(pier, date);
    return O.park.writeDay('Names not filled', function(){ return O.call('POST', base + '/fill-lead', { boat_id: bid }); }).then(function(r){
      if(r && !(r.filled || []).length) alert('ลำนี้ไม่มีหัวที่ต้องเติมชื่อ หรือใบจองไม่มีชื่อหัวกรุ๊ปให้ใช้');
      return r;
    });
  });
  wrap('pkNmLeadDup', function(orig, B){
    var list = B && B.bid ? dups(window._poDate, window._poPier, B.bid) : null;
    return list || orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('pkNmDropLeadDup', function(orig, date, bid, pier){
    var hit = dups(date, pier, bid) || [];
    if(!hit.length){ alert('ลำนี้ไม่มีชื่อที่พิมพ์เองซ้ำกับหัวกรุ๊ป'); return; }
    if(!confirm('พบชื่อที่พิมพ์เองซ้ำกับชื่อหัวกรุ๊ปของใบเดียวกัน ' + hit.length + ' ชื่อ\n\n'
        + hit.slice(0, 8).map(function(p){ return '  · ' + p.full + '   (ใบ ' + (p.vc || '-') + ')'; }).join('\n')
        + (hit.length > 8 ? ('\n  · … อีก ' + (hit.length - 8) + ' ชื่อ') : '')
        + '\n\nชื่อจากใบจองยังอยู่ครบ · ลบเฉพาะตัวที่พิมพ์เองซ้ำ')) return;
    return O.park.clearNames(date, hit.map(function(p){ return { booking_id: p.bkId, cat: p.auto, seq: p.seq }; }), 'Names not removed');
  });
})();
