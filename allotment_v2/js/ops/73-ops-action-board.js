/* ══════════════════════════════════════════════════════════════════════════
   §opsActionBoardSrv (w4-f1, 2026-10-18) · Action Board ⇄ GET /v1/action-board + GET /v1/availability?split=agent
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b1-sales-dashboard-model.md ("Action Board"). Legacy summed SB_BOOKINGS in the
   browser three ways; 52-ops-action-board.js therefore loaded three booking ranges (14 trip days, this month's and
   last month's created bookings) before it drew. With the server's answers nothing of that is needed:

     _abAgentSplit   who sold the seats in each cell    ← availability?split=agent  days[].sold_by (agent_id null = "_")
                     (mCell and the by-sales / by-agent bars read this through abRender's `unit`)
     _abAgentStats   per-agent month figures (S.M)      ← action-board agents[]  (in_current, in_previous, travel_*, revenue_*,
                                                            bookings_*, cancelled_*, last_booked, by_month)
     abRender        draws as legacy, then the cards the rules decide are replaced by the server's lists:
                       At risk, Almost full                ← cards.at_risk / almost_full (departs < 5 days & fill < 40% /
                                                            5 seats or fewer)
                       Top senders, Was big · now gone,
                       Steady senders, Cancellation spike  ← cards.top_senders / was_big_now_gone / steady_senders /
                                                            cancellation_spike (at most 20 each)
                       the four chips                      ← chips.free_14d / almost_full / at_risk / agents_gone
     _abDelta        the ▲ ▼ ≈ new tag next to a number  ← agents[].delta {kind, pct} (5 % or more is up or down); the
                     legacy function stays for the render that runs before the first answer.
   The seat cells (Free / cap / sold / fill) are still getAllotment → /v1/availability (50-ops-availability.js).
   The sales chip sends sales_id, so the agent lists are that salesperson's; the seat side ignores it (as legacy).
   Until the first answer arrives the board shows the loading placeholder (52-ops-action-board.js' three booking
   loads are no longer started); if the read fails, legacy's own render (with those loads) runs as before.
   Classic script, after 52-ops-action-board.js and 73-ops-srv-reads.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function today(){ return (typeof window.TODAY_STR === 'string' && window.TODAY_STR) || O.today(); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function esc(s){ return typeof window._abEsc === 'function' ? window._abEsc(s) : String(s == null ? '' : s); }

  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w4f1) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w4f1 = true; w.__orig = orig; window[name] = w;
  }

  function repaint(){
    if(O.activeView() === 'actionboard' && !O.busy() && typeof window.abRender === 'function') window.abRender();
  }
  function boardKey(){ return 'ab|' + today().slice(0, 7) + '|' + (window._abSales || ''); }
  function board(){
    var q = { month: today().slice(0, 7) };
    if(window._abSales) q.sales_id = window._abSales;
    return O.srv.read(boardKey(), '/v1/action-board', q, repaint);
  }

  /* ── who sold the seats ─────────────────────────────────────────────────── */
  wrap('_abAgentSplit', function(orig, dates){
    if(!dates || !dates.length) return orig.apply(this, [].slice.call(arguments, 1));
    var from = dates[0], to = dates[dates.length - 1];
    var j = O.srv.read('abSplit|' + from + '|' + to, '/v1/availability', { from: from, to: to, split: 'agent' }, repaint);
    if(!j || !Array.isArray(j.days)) return orig.apply(this, [].slice.call(arguments, 1));
    var want = {}; dates.forEach(function(d){ want[d] = 1; });
    var out = {};
    j.days.forEach(function(d){
      if(!want[d.service_date]) return;
      (d.sold_by || []).forEach(function(x){
        if(!(x.pax > 0)) return;
        var k = d.route_id + '|' + d.service_date, m = out[k] || (out[k] = {}), a = x.agent_id || '_';
        m[a] = (m[a] || 0) + x.pax;
      });
    });
    return out;
  });

  /* ── per-agent month figures ────────────────────────────────────────────── */
  wrap('_abAgentStats', function(orig){
    var ab = board();
    if(!ab) return orig.apply(this, [].slice.call(arguments, 1));
    var M = {};
    (ab.agents || []).forEach(function(a){
      M[a.agent_id] = { id: a.agent_id, inCur: n(a.in_current), inPrev: n(a.in_previous), inPrevFull: n(a.in_previous_full),
        tvCur: n(a.travel_current), tvPrev: n(a.travel_previous), revCur: n(a.revenue_current), revPrev: n(a.revenue_previous),
        bkCur: n(a.bookings_current), bkPrev: n(a.bookings_previous), cxCur: n(a.cancelled_current), cxPrev: n(a.cancelled_previous),
        lastIn: a.last_booked || '', byMon: Object.assign({}, a.by_month || {}), delta: a.delta };
    });
    var cur = ab.month, sh = window._abMonShift;
    return { M: M, cur: cur, prev: ab.previous_month, dayN: n(ab.day_n), back3: [sh(cur, -3), sh(cur, -2), sh(cur, -1)] };
  });

  /* ── the ▲ ▼ tag from the server's delta ────────────────────────────────── */
  function deltaHtml(d){
    if(!d || d.kind === 'none') return '<b class="ab-flat">—</b>';
    if(d.kind === 'new') return '<b class="ab-up">new</b>';
    if(d.kind === 'up') return '<b class="ab-up">▲ ' + d.pct + '%</b>';
    if(d.kind === 'down') return '<b class="ab-dn">▼ ' + Math.abs(d.pct) + '%</b>';
    return '<b class="ab-flat">≈ ' + (d.pct > 0 ? '+' : '') + d.pct + '%</b>';
  }

  wrap('_abDelta', function(orig, now, before){
    var ab = O.srv.peek(boardKey()), args = [].slice.call(arguments, 1);
    if(!ab) return orig.apply(this, args);
    var a = (ab.agents || []).filter(function(x){ return n(x.in_current) === n(now) && n(x.in_previous) === n(before); })[0];
    return a ? deltaHtml(a.delta) : orig.apply(this, args);
  });

  /* ── cards (the same markup as abRender's own) ──────────────────────────── */
  function tripRow(t){
    var c = window._abFillCol(t.fill_percent);
    var gapBg = (t.free <= 5) ? '#E6F5EC' : '#FCEBEB', gapFg = (t.free <= 5) ? '#0F6E56' : '#A32D2D';
    var d = t.days_ahead, ds = t.service_date;
    return '<div class="ab-tr' + (d === 0 ? ' now' : '') + '" onclick="abGoTrip(\'' + t.route_id + '\',\'' + ds + '\')">'
      + '<span class="ab-day"><u>' + window._abDow(ds) + '</u><b>' + window._abDate(ds).getDate() + '</b></span>'
      + '<span class="ab-tb"><span class="rt">'
        + '<i class="ab-rdot" style="background:' + window._abRouteCol(t.route_id) + '"></i>' + esc(window._abRouteName(t.route_id)) + '</span>'
        + '<span class="bt">' + esc((t.boats || []).join(' · '))
          + (d === 0 ? ' · today' : (d === 1 ? ' · tomorrow' : ' · in ' + d + ' days')) + '</span>'
        + window._abBar(t.fill_percent, c[1]) + '</span>'
      + '<span class="ab-tn"><b style="color:' + c[1] + '">' + t.fill_percent + '%</b>'
        + '<i><span class="ab-gap" style="background:' + gapBg + ';color:' + gapFg + '">'
        + (t.free <= 5 ? ('short ' + t.free) : ('free ' + t.free)) + '</span> / ' + t.capacity + '</i></span>'
      + '</div>';
  }
  function agRow(a, rank, val, valCol, sub, right){
    var sales = a.sales_id || '';
    return '<div class="ab-ar" onclick="abGoAgents()">'
      + (rank != null ? '<span class="ab-rk">' + rank + '</span>' : '')
      + '<span class="ab-ab"><span class="nm">' + window._abAgPill(a.agent_id, a.name) + '</span>'
        + '<span class="mt">' + (sales ? window._abSalesChip(sales) : '') + (sub ? ('<span>' + sub + '</span>') : '') + '</span></span>'
      + '<span class="ab-an"><span class="v"' + (valCol ? (' style="color:' + valCol + '"') : '') + '>' + val + '</span>'
        + '<span class="d">' + (right || '') + '</span></span>'
      + '</div>';
  }
  function cardsHtml(ab){
    var c = ab.cards, S = { cur: ab.month, prev: ab.previous_month, dayN: ab.day_n };
    var M = window._abMonLbl, flat = function(t){ return '<span class="ab-flat">' + t + '</span>'; };
    var out = {};
    out['At risk'] = window._abCard('risk', 'At risk', c.at_risk.length, 'Departs in &lt; 5 days · fill &lt; 40%',
      c.at_risk.length ? c.at_risk.map(tripRow).join('') : window._abEmpty('No trip at risk in the next 3 days'));
    out['Almost full'] = window._abCard('near', 'Almost full', c.almost_full.length, '≤ 5 seats left',
      c.almost_full.length ? c.almost_full.map(tripRow).join('') : window._abEmpty('No trip close to full yet'));
    out['Top senders this month'] = window._abCard('', 'Top senders this month', c.top_senders.length,
      'Booked in 1–' + S.dayN + ' ' + M(S.cur) + ' · vs same days in ' + M(S.prev),
      c.top_senders.length ? c.top_senders.map(function(x){
        var a = x.agent;
        return agRow(a, x.rank, x.value, null, x.detail.bookings + ' bkgs · ' + window._abMoney(x.detail.revenue) + ' · ' + x.detail.travelling + ' trav',
          deltaHtml(x.delta) + ' ' + flat('(' + x.detail.previous + ')'));
      }).join('') : window._abEmpty('No bookings created this month yet'));
    out['Was big · now gone'] = window._abCard('lost', 'Was big · now gone', c.was_big_now_gone.length, 'Nothing booked this month · quiet ≥ 21 days',
      c.was_big_now_gone.length ? c.was_big_now_gone.map(function(x){
        return agRow(x.agent, x.rank, '−' + x.peak, '#A32D2D', 'last ' + window._abDayLbl(x.agent.last_booked) + ' · quiet ' + x.quiet_days + 'd',
          '<span class="ab-dn">peak ' + x.peak + '</span> ' + flat('(' + M(x.peak_month) + ')'));
      }).join('') : window._abEmpty('No agent has gone quiet'));
    var b3 = [window._abMonShift(S.cur, -3), window._abMonShift(S.cur, -2), window._abMonShift(S.cur, -1)];
    out['Steady senders'] = window._abCard('', 'Steady senders', c.steady_senders.length, 'Every month ' + M(b3[0]) + '–' + M(b3[2]) + ' and still sending',
      c.steady_senders.length ? c.steady_senders.map(function(x){
        return agRow(x.agent, x.rank, x.mean, '#0F6E56', x.months.join(' · ') + ' pax', flat('var ±' + x.variation_percent + '%') + ' · this month ' + x.detail.this_month);
      }).join('') : window._abEmpty('No agent meets the criteria'));
    out['Cancellation spike'] = window._abCard('cxl', 'Cancellation spike', c.cancellation_spike.length,
      '≥ 5 bkgs this month · ≥ 2 cancelled · ≥ 8 pts above last month',
      c.cancellation_spike.length ? c.cancellation_spike.map(function(x){
        return agRow(x.agent, x.rank, x.rate_percent + '%', '#8A4A00', x.detail.cancelled + ' of ' + x.detail.bookings + ' cancelled', flat(M(S.prev) + ' ' + x.previous_rate_percent + '%'));
      }).join('') : window._abEmpty('No abnormal cancellation rate'));
    return out;
  }
  function patch(wrapEl, ab){
    var cards = cardsHtml(ab);
    [].slice.call(wrapEl.querySelectorAll('.ab-c')).forEach(function(el){
      var big = el.querySelector('.ab-ct .big'); if(!big) return;
      var html = cards[big.textContent.trim()]; if(!html) return;
      var t = document.createElement('div'); t.innerHTML = html;
      if(t.firstChild) el.parentNode.replaceChild(t.firstChild, el);
    });
    var chips = { 'Free 14d': ab.chips.free_14d, 'Almost full': ab.chips.almost_full, 'At risk': ab.chips.at_risk, 'Agents gone': ab.chips.agents_gone };
    [].slice.call(wrapEl.querySelectorAll('.ab-chip')).forEach(function(el){
      var b = el.querySelector('b'); if(!b) return;
      var label = el.textContent.replace(b.textContent, '').trim();
      if(!(label in chips)) return;
      b.textContent = chips[label];
      if(label === 'Almost full') el.classList.toggle('ok', chips[label] > 0);
      if(label === 'At risk' || label === 'Agents gone') el.classList.toggle('warn', chips[label] > 0);
    });
  }

  wrap('abRender', function(orig){
    var args = [].slice.call(arguments, 1), host = document.getElementById('ab-wrap');
    var ab = board(), st = O.srv.status(boardKey());
    if(!ab){
      if(st === 'failed') return orig.apply(this, args);                        // legacy's own render, with 52's loads
      if(host && !host.firstChild) host.innerHTML = O.loadingHtml('Loading the Action Board…');
      return;
    }
    /* the legacy render underneath 52's booking loads: its agent sums, the cards and the sold-by bars come from the answers */
    var base = (orig.__opsAb && typeof orig.__orig === 'function') ? orig.__orig : orig;
    var r = base.apply(this, args);
    try{ if(host) patch(host, ab); }catch(e){ console.warn('[ops] Action Board patch', e && e.message); }
    return r;
  });
})();
