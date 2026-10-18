/* ══════════════════════════════════════════════════════════════════════════
   §opsAnalysisWhy (w4-f1, 2026-10-18) · Analysis tab "Agent x route" with the rate card and the reason ⇄ GET /v1/reports/analysis
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b2-reports-model.md and README ("Rate card against what was taken"). Each agent-by-route cell of
   agents[].routes[] carries what the booking's own rate card says these heads should have paid (expected_per_pax), what the same
   lines took (taken_per_pax), the rate card and zone, the bookings no card could be matched to, and, when the cell loses money a
   head, the reason {tag, class, text} (legacy pxMxWhy: FOC, check data, under contract, empty boats, contract < cost,
   no rate card, thin route). The Analysis tab of 44-ops-costing-pl.js draws the server's report compactly; this file adds the
   matrix the legacy tab had (agent rows, route columns, heat colour, the reason tag, the hover text with the rate card).

     pxAnalysis      44's page + the "Agent x route" matrix built from the SAME answer (read when 44 asked for it: laOps.get is
                     watched for /v1/reports/analysis, so no second 30-second read)
     pxMxWhy         not called in operation mode: the reason comes with the cell
     pxAgents        the per-trip split of the day card (Trip P&L, one boat-day): the report is for a window, it carries no
                     per-trip agent split, so it stays a local read of the loaded bookings (as 44 says)
   Classic script, after 44-ops-costing-pl.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function e(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function N(v){ return typeof window.pxN === 'function' ? window.pxN(v) : String(Math.round(n(v))); }

  /* watch the answers 44 reads: the last one for each (days, pier) */
  var seen = {};
  if(!O.get.__w4f1){
    var og = O.get;
    O.get = function(path, q){
      var p = og.apply(this, arguments);
      if(path === '/v1/reports/analysis') p.then(function(d){ if(d && d.window) seen[(q && q.days || '') + '|' + (q && q.pier || '')] = d; }, function(){});
      return p;
    };
    O.get.__w4f1 = true;
  }

  function stepOf(d){ return Math.max(1, +d.target_per_pax || 130); }
  function cls(v, step){
    if(v >= 3 * step) return 'd3p';
    if(v >= step) return 'd2p';
    if(v > 0) return 'd1p';
    if(v === 0) return 'd0';
    if(v > -step) return 'd1n';
    if(v > -3 * step) return 'd2n';
    return 'd3n';
  }
  function cell(r, step){
    if(!r || (!r.heads && Math.round(n(r.revenue)) === 0)) return '<td class="mx e"><div><span>—</span></div></td>';
    var px = Math.max(1, n(r.heads)), nph = Math.round(n(r.net) / px), loss = nph < 0, W = r.why;
    var ttl = r.route_name + ' · ' + r.heads + ' pax · rev ' + N(n(r.revenue) / px) + '/pax · cost ' + N(n(r.cost) / px) + '/pax · net ' + N(r.net) + ' ฿'
      + (r.expected_per_pax != null ? ('\nRate card ' + N(r.expected_per_pax) + ' ฿/pax · taken ' + N(r.taken_per_pax) + ' ฿/pax'
        + '\nBasis: ' + r.expected_heads + ' booked pax matched to a rate card' + (r.rate_card ? (' · ' + r.rate_card) : '') + (r.zone ? (' · zone ' + r.zone) : '')) : '')
      + (W ? ('\n\nWhy: ' + W.text) : '');
    return '<td class="mx ' + cls(nph, step) + '" title="' + e(ttl) + '"><div><b class="' + (loss ? 'neg' : 'pos') + ' n">' + (loss ? '−' : '+') + N(Math.abs(nph)) + '</b>'
      + '<small>' + r.heads + ' pax</small>' + (W ? ('<u class="' + e(W['class'] || '') + '">' + e(W.tag) + '</u>') : '') + '</div></td>';
  }
  function matrix(d){
    var AG = d.agents || [], RS = d.routes || [], step = stepOf(d);
    var cols = RS.filter(function(r){ return !r.did_not_sail || r.trips > r.did_not_sail; });
    if(!AG.length || !cols.length) return '';
    var shown = (window._px && window._px.agAll) ? AG : AG.slice(0, 15);
    var tgt = n(d.target_per_pax) || 130;
    var rows = shown.map(function(a){
      var byR = {}; (a.routes || []).forEach(function(r){ byR[r.route_id] = r; });
      var loss = n(a.net_per_pax) < 0, b2c = /^_b2c/.test(String(a.key || ''));
      return '<tr class="br' + (loss ? ' loss' : '') + '"><td class="l stk"><div class="bn"><i style="background:' + (typeof window.pxAColor === 'function' ? window.pxAColor({ b2c: b2c, name: a.name }) : '#94A3B8') + '"></i><div>'
        + '<b>' + e(a.name) + '</b><small>' + (b2c ? 'Direct · no commission' : 'Agent') + ' · ' + a.bookings + ' booking' + (a.bookings === 1 ? '' : 's') + '</small></div></div></td>'
        + '<td class="c"><span class="num n">' + a.heads + '</span></td>'
        + cols.map(function(r){ return cell(byR[r.route_id], step); }).join('')
        + '<td class="netc' + (loss ? ' neg' : '') + '"><span class="net' + (loss ? ' neg' : '') + ' n">' + (loss ? '−' : '+') + N(Math.abs(n(a.net_per_pax))) + '</span></td>'
        + '<td class="netc' + (loss ? ' neg' : '') + '"><span class="net' + (loss ? ' neg' : '') + ' n">' + (n(a.net) < 0 ? '−' : '+') + N(Math.abs(n(a.net))) + '</span></td>'
        + '<td class="c"><span class="pill ' + (loss ? 'ro' : (n(a.net_per_pax) < tgt ? 'am' : 'em')) + '">' + (loss ? 'Below cost' : (n(a.net_per_pax) < tgt ? 'Thin' : 'Strong')) + '</span></td></tr>';
    }).join('');
    var head = cols.map(function(r){ return '<th class="rth"><i style="background:' + e(r.color || '#94A3B8') + '"></i>' + e(r.name) + '</th>'; }).join('');
    return '<div class="eg" id="w4-agent-route"><div class="phd"><div><h2>Agent × route</h2><p>Net per pax, split by route · the same agent earns a different margin on every route, '
      + 'so their headline number hides the ones that lose money · each losing cell says why</p></div></div>'
      + '<div class="twrap"><div class="tscroll"><table class="sum" style="min-width:' + (430 + 118 * cols.length) + 'px"><thead><tr><th class="l stk" style="min-width:212px">Agent</th><th class="c">Pax</th>'
      + head + '<th>Net / pax</th><th>Total net</th><th class="c">Status</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
      + '<div class="mxlg"><span class="t">Net per pax</span><span class="q"><i style="background:#F8FAFC;border:1px solid #E2E8F0"></i>— = never sent on this route</span>'
      + '<span class="q">top number = ฿ per head · bottom = pax · hover for the rate card and the reason</span></div></div>';
  }

  var orig = window.pxAnalysis;
  if(typeof orig === 'function' && !orig.__w4f1){
    var w = function(){
      var html = orig.apply(this, arguments);
      if(!on() || typeof html !== 'string' || !window._px) return html;
      var d = seen[(window._px.an || 47) + '|' + (window._px.pier || '')];
      return d ? html + matrix(d) : html;
    };
    w.__w4f1 = true; w.__orig = orig; window.pxAnalysis = w;
  }
})();
