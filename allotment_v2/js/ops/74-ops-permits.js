/* ═════════════════════════════════════════════════════════════════
   §opsPermits (w4-f2, 2026-10-18) · the national-park permit line on the boat job card, from the server

   Legacy pjDocsHtml(boat, route, date) draws two lines under the boat's name: the boat licence, and the park permit(s) the
   day's programme needs. It picks the parks by matching the route's name and islands against PJ_PARK (pjParkNeed), finds the
   boat's current document of each type and grades it (pjDocLv). The server now answers that for the pier office:

     GET /v1/pier-office/{pier}/days/{date}/boats   boats[].permits and fleet[].permits   (README "Pier office")
       permits = { for_route, permits: [{ type, name, doc_type, doc_name, status, expires_on, days_left, level }],
                   worst, more, note: not_needed | none_held | null }

   so the card prints `worst` (+ `more`) with the server's level and no browser rule picks a park. 47-ops-pier-job.js reads
   that endpoint once per pier and day (laOps.pier.dayBoats); this file puts the permit line on the card from it.
   The licence line (the first one) stays what the Documents page holds in the browser; the server's permits are for parks.

   One difference on purpose (the server's rule): the worst permit is the expired one. Legacy's sort read RANK[k] || 9, which put an
   expired permit (rank 0) last, so the card showed one with weeks left ahead of one already out of date.

   pjParkNeed and PJ_PARK are no longer consulted for the card in ops mode; pcPkIsland (the island's name on a park-fee cash line) still
   reads PJ_PARK: it names an island, it does not judge a permit.
   Until the server has answered for the day, for a boat it does not list and in non-ops mode legacy's line shows.
   Load order: after 47-ops-pier-job.js, before 90-ops-boot.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function esc(v){ return typeof window.poE === 'function' ? window.poE(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function dateTh(d){ return typeof window.pjDocDate === 'function' ? window.pjDocDate(d) : String(d || ''); }

  /* legacy pjDocLv's wording, from the server's level, expiry and days left */
  function textOf(p){
    var left = p.days_left, d = dateTh(p.expires_on);
    if(p.level === 'none') return p.doc_name == null ? 'ไม่มีใบในระบบ' : 'ไม่ระบุวันหมดอายุ';
    if(p.level === 'renew') return (left < 0 ? ('หมด ' + d) : d) + ' · กำลังต่ออายุ';
    if(p.level === 'x') return 'หมด ' + d + ' · เกิน ' + (-left) + ' วัน';
    return d + ' · เหลือ ' + left + ' วัน';
  }
  function line(level, name, value, extra){
    return '<div class="pj-dl ' + level + '"><span class="nm">' + esc(name) + (extra || '') + '</span><span class="vl">' + esc(value) + '</span></div>';
  }
  /* the permit line the card prints for a permits block */
  function permitLine(P){
    if(!P) return null;
    if(!P.worst){
      if(P.note === 'not_needed') return line('none', 'ใบเข้าเกาะ', 'โปรแกรมนี้ไม่ต้องใช้ใบอุทยาน');
      return line('none', 'ใบเข้าเกาะ', 'ไม่มีใบในระบบ');
    }
    var w = P.worst;
    return line(w.level, 'ใบอนุญาต ' + w.name, textOf(w), P.more > 0 ? ('<span class="pj-dmore">+' + P.more + '</span>') : '');
  }

  function permitsOf(boat, date){
    var D = O.pier && O.pier.dayBoats; if(!D || !boat || !boat.id) return null;
    var f = D.fleet ? D.fleet(date, boat.id) : null;
    if(f && f.f && f.f.permits) return f.f.permits;
    var pier = ''; try{ pier = typeof _poPier !== 'undefined' ? _poPier : ''; }catch(_){}
    var b = pier ? D.boat(pier, date, boat.id) : null;
    return b && b.permits ? b.permits : null;
  }

  var orig = window.pjDocsHtml;
  if(typeof orig === 'function' && !orig.__opsPermits){
    window.pjDocsHtml = function(boat, rt, date){
      var legacy = orig.apply(this, arguments);
      if(!enabled()) return legacy;
      var P = permitsOf(boat, date), pl = permitLine(P);
      if(!pl) return legacy;
      var m = /^<div class="pj-docs">(<div class="pj-dl[\s\S]*?<\/div>)/.exec(String(legacy));   // the licence line (legacy's) is the first
      return '<div class="pj-docs">' + (m ? m[1] : '') + pl + '</div>';
    };
    window.pjDocsHtml.__opsPermits = true;
  }

  O.permits = { of: permitsOf, line: permitLine };
})();
