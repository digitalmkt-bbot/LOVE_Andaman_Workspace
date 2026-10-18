/* ═════════════════════════════════════════════════════════════════
   §opsAgentsW6 (w6-d, 2026-10-18) · agent screens: the Recent Bookings summary, promo coverage, bulk programme fill, list chips

   The backend built the fields the w5-e walk asked for (README "Fields the new frontend asked for", "Agents, quote, calendar ..."):

     GET  /v1/agents/{id}/booking-summary?by=travel|booked   agSumRows / agSumBlock       the month x programme table of the Recent Bookings tab
     GET  /v1/agents/{id}/promo-coverage                     agTabPrices                  "โปรโมชั่นที่ทับเรทมาตรฐาน" block of the Pricing Matrix tab
     GET  /v1/agents/programs-fill-plan                      agProgBulkPlan               the empty / partial / mismatch heaps of the rate admin panel
     POST /v1/agents/programs-fill {scope}                   agProgBulkApply              fills the programmes (one command; the server re-reads the plan)
     GET  /v1/agents  rows[].gaps, gap_counts                agGapCounts, agTblRows       the chips programs / rate / vat / docs of the agent list
     alerts[] code rate_not_started                          agAlerts                     (16-ops-agents.js: AL_BY_CODE)

   Markup, texts and click handlers are legacy's; only the figures and the rows come from the answers. A function answers from the held answer
   (laOps.srv.read: a write makes it stale, the old one stays until the new one lands) and returns `undefined` (legacy's own sums answer) before
   the first answer, offline, and when the answer failed. The only things sent are the choices: the agent, the view (travel / booked), the scope.

   Load order: after 16-ops-agents.js, 73-ops-srv-reads.js, 84-ops-agent-rules.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;

  function on(){ return !!(O.enabled && O.enabled()); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function num(v){ return +v || 0; }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function agentOf(id){ return typeof g('sbGetAgent') === 'function' ? window.sbGetAgent(id) : null; }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsAgentsW6) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] agents w6 · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsAgentsW6 = true; w.__orig = orig; window[name] = w;
  }
  /* the open agent tab, redrawn when its answer lands */
  function tabOnScreen(tab, id){
    var t = document.querySelector('#ag-main .sb-tab.on[data-tab="' + tab + '"]');
    return !!(t && String(t.getAttribute('onclick') || '').indexOf("'" + id + "'") >= 0 && document.getElementById('ag-tabbody'));
  }
  function redrawTab(tab, id, fnName){
    return function(){
      if(!on() || (O.busy && O.busy()) || !tabOnScreen(tab, id)) return;
      var a = agentOf(id), body = document.getElementById('ag-tabbody');
      if(a && body && typeof window[fnName] === 'function') body.innerHTML = window[fnName](a);
    };
  }

  /* ── 1 · Recent Bookings: the month x programme table ── */
  var curSumAgent = null;
  function sumKey(id, mode){ return 'agsum|' + id + '|' + mode; }
  function sumMode(){ try{ return typeof _agSumMode !== 'undefined' && _agSumMode === 'booked' ? 'booked' : 'travel'; }catch(_){ return 'travel'; } }
  function summaryOf(id){
    var mode = sumMode();
    return O.srv.read(sumKey(id, mode), '/v1/agents/' + enc(id) + '/booking-summary', { by: mode }, redrawTab('hist', id, 'agTabHist'));
  }
  /* the server's months become the trip rows agSumBlock adds up: one live row and one cancelled row per month and programme */
  wrap('agSumRows', function(orig, a){
    var ag = curSumAgent; if(!ag) return undefined;
    var j = summaryOf(ag.id); if(!j || !Array.isArray(j.months)) return undefined;
    var mode = sumMode(), out = [];
    j.months.forEach(function(m){
      (m.routes || []).forEach(function(r){
        [['live', false], ['cancelled', true]].forEach(function(k){
          var c = r[k[0]]; if(!c || (!num(c.pax) && !num(c.baht) && !num(c.bookings))) return;
          var row = { rid: r.route_id || '', dead: k[1], travel: mode === 'travel' ? m.month : '', booked: mode === 'booked' ? m.month : '', pax: num(c.pax), baht: num(c.baht) };
          out.push(row);
        });
      });
    });
    /* the view switch ("วันที่จอง") is disabled when no row carries a booked month: in the travel view a row with no figures keeps it open */
    if(out.length && mode === 'travel') out.push({ rid: '', dead: true, travel: '', booked: 'server', pax: 0, baht: 0 });
    return out;
  });
  wrap('agSumBlock', function(orig, a){
    var ag = a[0]; if(!ag || !ag.id) return undefined;
    var prev = curSumAgent; curSumAgent = ag;
    try{ return orig.apply(this, a); } finally { curSumAgent = prev; }
  });

  /* ── 2 · Pricing Matrix: the promotions that sit over the standard rate ── */
  var COV_START = '<div style="margin:0 0 12px;background:#FBFAF8;border:1px solid #EFECE6;border-radius:9px;padding:10px 13px">';
  function esc(s){ return typeof g('_ctEsc') === 'function' ? window._ctEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fd(x){ return x ? ((typeof g('_rtFmtDate') === 'function') ? (window._rtFmtDate(x) || x) : x) : '…'; }
  function coverageHtml(j){
    var routes = j.routes || [], rows = '', nCov = 0, nSkip = 0;
    routes.forEach(function(R){
      var live = (R.covered || []), dead = (R.skipped || []);
      if(live.length) nCov++; if(dead.length) nSkip++;
      var tag = live.length
        ? live.map(function(h){
            var own = h.price_mode === 'own';
            var rtCode = own ? 'ราคาในใบโปร' : (h.rate_type_code || '(ไม่พบ Rate Type)');
            return '<span style="background:#FBF0DD;color:#7A4A00;border:1px solid #EAD9B0;border-radius:6px;padding:2px 7px;font-size:9.5px;font-weight:700;white-space:nowrap" title="'
              + esc(own ? 'ราคากรอกไว้ในใบโปรเอง' : ('ราคามาจาก Rate Type ' + rtCode))
              + esc((h.book_from || h.book_to) ? (' · ต้องจองระหว่าง ' + fd(h.book_from) + ' – ' + fd(h.book_to)) : ' · ไม่จำกัดวันจอง')
              + '">PROMO ' + esc(h.version || h.contract_id) + ' &middot; ' + fd(h.travel_from) + ' &rarr; ' + fd(h.travel_to)
              + (own ? ' &middot; ราคาในใบ' : '')
              + ((h.book_from || h.book_to) ? ' &middot; &#128197;' : '') + '</span>';
          }).join(' ')
        : '<span style="color:#8A929E;font-size:10.5px">ไม่มีโปรโมชั่น &middot; ใช้เรทมาตรฐาน</span>';
      var warn = dead.length
        ? '<div style="margin-top:3px;font-size:10px;color:#A32D2D">&#9888; ' + dead.length + ' ใบคลุม route นี้ไว้ แต่'
          + (dead[0].price_mode === 'own' ? 'ไม่ได้กรอกราคาของ route นี้ไว้ในใบ' : ('Rate Type ของใบนั้น (' + esc(dead[0].rate_type_code || '(ไม่พบ Rate Type)') + ') ไม่มีราคาของ route นี้'))
          + ' &rarr; ระบบข้าม ใช้เรทมาตรฐานแทน</div>'
        : '';
      rows += '<div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-top:1px solid #EFECE6">'
        + '<div style="flex:1;min-width:0;font-size:11.5px;font-weight:600;color:#3C4553">' + esc(R.route_name || R.route_id) + warn + '</div>'
        + '<div style="flex:none;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:58%">' + tag + '</div>'
        + '</div>';
    });
    var nPromo = num(j.promos);
    return COV_START
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:#3C4553;font-weight:600">'
      + 'โปรโมชั่นที่ทับเรทมาตรฐาน'
      + '<span style="background:#F1EFE8;color:#5F5E5A;border-radius:999px;padding:2px 9px;font-size:10px;font-weight:700">' + nPromo + ' ใบ</span>'
      + '<span style="font-weight:500;color:#8A929E;font-size:10.5px">'
      + num(j.covered_routes != null ? j.covered_routes : nCov) + ' จาก ' + routes.length + ' route มีโปรทับบางช่วง &middot; ที่เหลือใช้เรทมาตรฐานทั้งปี'
      + (num(j.skipped_routes != null ? j.skipped_routes : nSkip) ? (' &middot; <b style="color:#A32D2D">' + num(j.skipped_routes != null ? j.skipped_routes : nSkip) + ' route โปรไม่มีราคา &rarr; ถูกข้าม</b>') : '')
      + '</span></div>'
      + (nPromo ? rows : '') + '</div>';
  }
  /* the end of the legacy block: the div that opens at `at` closes where the opened / closed pairs balance */
  function blockEnd(html, at){
    var re = /<div\b|<\/div>/g, depth = 0, m; re.lastIndex = at;
    while((m = re.exec(html))){
      if(m[0] === '</div>'){ depth--; if(depth === 0) return re.lastIndex; } else depth++;
    }
    return -1;
  }
  wrap('agTabPrices', function(orig, a){
    var ag = a[0]; if(!ag || !ag.id) return undefined;
    var html = orig.apply(this, a);
    var j = O.srv.read('agpromo|' + ag.id, '/v1/agents/' + enc(ag.id) + '/promo-coverage', undefined, redrawTab('prices', ag.id, 'agTabPrices'));
    if(!j || !Array.isArray(j.routes)) return html;
    var at = html.indexOf(COV_START);
    if(at < 0){
      if(!j.routes.length || !html || typeof html !== 'string') return html;
      return html;           // legacy drew no block (no rate type, or nothing in both lists): the server's block is not added to a page that has no place for it
    }
    var end = blockEnd(html, at); if(end < 0) return html;
    return html.slice(0, at) + (j.routes.length ? coverageHtml(j) : '') + html.slice(end);
  });

  /* ── 3 · bulk programme fill (rate admin panel) ── */
  function planOf(){
    return O.srv.read('agprogfill', '/v1/agents/programs-fill-plan', undefined, function(){
      if(!on() || (O.busy && O.busy())) return;
      try{ if(typeof window.agProgBulkPanel === 'function'){ window.agProgBulkPanel('rta-fill'); window.agProgBulkPanel('rt-fill'); } }catch(_){}
    });
  }
  function agentStandIn(row){
    return agentOf(row.agent_id) || { id: row.agent_id, code: row.code, name: row.name, programs: [], rateTypeId: row.rate_type_id };
  }
  wrap('agProgBulkPlan', function(orig){
    var j = planOf(); if(!j || !Array.isArray(j.empty) || !Array.isArray(j.partial)) return undefined;
    var rows = function(list){ return list.map(function(r){ return { a: agentStandIn(r), add: (r.add || []).slice() }; }); };
    var empty = rows(j.empty), partial = rows(j.partial);
    var mismatch = (j.mismatch || []).map(function(r){ return { a: agentStandIn(r), drop: (r.drop || []).slice() }; });
    var t = j.totals || {};
    var sum = function(list){ return list.reduce(function(s, x){ return s + x.add.length; }, 0); };
    return { empty: empty, partial: partial, mismatch: mismatch,
             nEmpty: t.empty && t.empty.routes != null ? num(t.empty.routes) : sum(empty), nPartial: t.partial && t.partial.routes != null ? num(t.partial.routes) : sum(partial) };
  });
  wrap('agProgBulkApply', function(orig){
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('sales')) return null;
    var scope = (typeof _agProgBulkScope !== 'undefined' && _agProgBulkScope === 'partial') ? 'partial' : 'empty';
    return O.queue(function(){ return O.call('POST', '/v1/agents/programs-fill', { scope: scope }); }).then(function(r){
      var ids = (r && r.agent_ids) || [], fetch = window.laOpsAgentFetch;
      O.srv.clear();
      return Promise.all(ids.map(function(id){ return fetch ? fetch(id).catch(function(){ return null; }) : null; })).then(function(){
        if(typeof window.acctModalClose === 'function') window.acctModalClose();
        if(O.wrote) O.wrote('agents');
        if(typeof window.renderRateAdmin === 'function') window.renderRateAdmin();
        var av = document.getElementById('view-agents');
        if(av && av.classList.contains('active') && typeof window.renderAgents === 'function') window.renderAgents();
        var msg = 'เติมโปรแกรมให้ ' + num(r && r.applied) + ' เอเย่นต์ · ' + num(r && r.routes) + ' เส้นทาง';
        if(typeof window.flShowToast === 'function') window.flShowToast(msg);
        else if(O.toast) O.toast({ kind: 'neutral', title: msg, dur: 5000 });
      });
    }, function(e){ O.fail('Could not fill the programmes', e); });
  });

  /* ── 4 · the list chips: programs / rate / vat / docs ── */
  wrap('agGapCounts', function(orig){
    var A = (typeof SB_AGENTS !== 'undefined' && Array.isArray(SB_AGENTS)) ? SB_AGENTS : [];
    var C = O.agentGapCounts;
    if(C && C.all === A.length && ['programs', 'rate', 'vat', 'docs'].every(function(k){ return C[k] != null; })){
      return { all: num(C.all), programs: num(C.programs), rate: num(C.rate), vat: num(C.vat), docs: num(C.docs) };
    }
    if(A.length && A.every(function(x){ return x && Array.isArray(x.gaps); })){
      var n = function(k){ return A.filter(function(x){ return x.gaps.indexOf(k) >= 0; }).length; };
      return { all: A.length, programs: n('programs'), rate: n('rate'), vat: n('vat'), docs: n('docs') };
    }
    return undefined;
  });
  wrap('agTblRows', function(orig){
    var gap = null; try{ gap = typeof _agGap !== 'undefined' ? _agGap : null; }catch(_){}
    if(!gap || gap === 'all') return undefined;
    var A = (typeof SB_AGENTS !== 'undefined' && Array.isArray(SB_AGENTS)) ? SB_AGENTS : [];
    if(!A.length || !A.every(function(x){ return x && Array.isArray(x.gaps); })) return undefined;
    var rows;
    try{ _agGap = 'all'; rows = orig.apply(this, arguments); } finally { _agGap = gap; }
    return rows.filter(function(x){ return Array.isArray(x.gaps) ? x.gaps.indexOf(gap) >= 0 : true; });
  });
  /* a write to an agent changes its gaps: the list's own counts are old until the list is read again; the rows' gaps (read with each write answer) count from then on */
  O.onWrite(function(kind){ if(/^agent/i.test(String(kind || ''))) O.agentGapCounts = null; });

  O.agentsW6 = { summaryOf: summaryOf, plan: planOf };
})();
