/* ══════════════════════════════════════════════════════════════════════════
   §opsCancelReport (w4-f1, 2026-10-18) · Booking "Cancellations" tab ⇄ GET /v1/reports/cancellations?from=&to=
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b2-reports-model.md. Legacy loaded every booking with a trip in the month
   (bookingV2EnsureOpsRange, 500 at a time) and added the cancellations up in the browser. The server counts once:
   cancellations, partial cancels, pax, fees, rate and no-show rate, by reason, fault side, month and agent. This file
   draws the legacy cards from that answer (markup copied from bookingV2RenderCancelReport.js) and loads no booking.

   Period: the screen's month. The server windows a cancellation by the day it was MADE (not by the trip's travel date,
   as legacy did) and counts as the base the bookings SOLD in the window; the line above the cards therefore says
   "Cancelled in:" where legacy said "Travel period:". Reversible: this one string.
   The City Tour page (land) keeps legacy's own report: the server's answer has no marine/land split yet.
   Classic script, after 73-ops-srv-reads.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  var orig = window.bookingV2RenderCancelReport;
  if(typeof orig !== 'function' || orig.__w4f1) return;

  function repaint(){
    if(O.activeView() === 'booking' && window._bkV2 && window._bkV2.tab === 'cancel' && !window._bkV2.newBooking && !O.busy()) window.bookingV2Render();
  }
  var esc = function(s){ return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var fmt = function(n){ return '฿' + Math.round(n || 0).toLocaleString(); };

  var w = function(){
    if(!on() || window._bkV2CityTourOnly || typeof window._opsBookingMonthRange !== 'function') return orig.apply(this, arguments);
    var month = (_bkV2.month && /^\d{4}-\d{2}$/.test(_bkV2.month)) ? _bkV2.month : window.bookingV2LocalYMD(new Date()).slice(0, 7);
    var range = window._opsBookingMonthRange(month), key = 'cxl|' + range.from + '|' + range.to;
    var j = O.srv.read(key, '/v1/reports/cancellations', { from: range.from, to: range.to }, repaint);
    var st = O.srv.status(key);
    if(!j){
      if(st === 'failed') return orig.apply(this, arguments);      // legacy's own report, with its booking loads
      return '<div class="bkv2" style="padding:18px">Loading cancellation report…</div>';
    }
    var period = '<div style="font-size:12px;margin-bottom:12px">Cancelled in: ' + esc(range.from) + ' → ' + esc(range.to) + '</div>';
    if(j.empty){
      return '<div class="bkv2" style="padding:40px;text-align:center;color:var(--ink-soft,#888)">' + period + '<div style="font-size:14px;font-weight:600;margin-bottom:4px">No cancellations yet</div><div style="font-size:12px">Cancelled bookings will be analysed here by reason, fault side, agent and month.</div></div>';
    }
    var card = function(inner, extra){ return '<div style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:14px 16px;' + (extra || '') + '">' + inner + '</div>'; };
    var kpi = function(lab, val, sub, col){ return card('<div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a8a82">' + lab + '</div><div style="font-size:24px;font-weight:700;color:' + (col || '#1B2A55') + ';font-family:\'DM Mono\',monospace;margin-top:4px">' + val + '</div><div style="font-size:10.5px;color:#8a8a82;margin-top:1px">' + (sub || '') + '</div>'); };
    var kpis = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">\n    '
      + kpi('Cancellations', j.cancellations, j.cancel_rate_pct + '% of ' + j.bookings_in_period + (j.partial_cancels ? ' · +' + j.partial_cancels + ' partial' : ''), '#A32D2D') + '\n    '
      + kpi('Pax cancelled', j.pax_cancelled, j.pax_partial ? (j.pax_full + ' full · ' + j.pax_partial + ' partial') : 'seats released') + '\n    '
      + kpi('No-show rate', j.no_show_rate_pct + '%', j.no_shows + ' no-show', '#A05A1A') + '\n    '
      + kpi('Fees collected', fmt(j.fees), 'cancellation charges', '#0F6E56') + '\n  </div>';
    var catRows = j.by_reason.slice().sort(function(a, b){ return b.count - a.count; });
    var maxC = Math.max.apply(null, [1].concat(catRows.map(function(v){ return v.count; })));
    var grpColor = function(g){ return g === 'operator' ? '#185FA5' : g === 'other' ? '#8a8a82' : '#A32D2D'; };
    var label = function(r){ return typeof window.bookingV2CancelLabel === 'function' ? window.bookingV2CancelLabel(r.code) : r.label; };
    var catHtml = card('<div style="font-size:13px;font-weight:700;color:#1B2A55;margin-bottom:10px">By reason</div>' + catRows.map(function(v){
      var g = v.group || 'other', wd = Math.round(v.count / maxC * 100);
      return '<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>' + esc(label(v)) + ' <span style="font-size:9px;color:#fff;background:' + grpColor(g) + ';padding:1px 6px;border-radius:8px;text-transform:uppercase;letter-spacing:.03em">' + g + '</span></span><span style="font-family:\'DM Mono\',monospace;color:#5A5A52">' + v.count + ' &middot; ' + v.pax + ' pax &middot; ' + fmt(v.fee) + '</span></div><div style="height:7px;border-radius:4px;background:#f0eee8"><div style="width:' + wd + '%;height:100%;border-radius:4px;background:' + grpColor(g) + '"></div></div></div>';
    }).join(''));
    var F = j.fault;
    var faultHtml = card('<div style="font-size:13px;font-weight:700;color:#1B2A55;margin-bottom:10px">Fault side</div><div style="display:flex;height:14px;border-radius:7px;overflow:hidden;margin-bottom:8px">\n    <div style="width:' + F.customer_pct + '%;background:#A32D2D"></div><div style="width:' + F.operator_pct + '%;background:#185FA5"></div><div style="width:' + F.other_pct + '%;background:#8a8a82"></div></div>\n    <div style="display:flex;gap:14px;font-size:11.5px;color:#5A5A52"><span><span style="color:#A32D2D">&#9632;</span> Customer ' + F.customer + ' (' + F.customer_pct + '%)</span><span><span style="color:#185FA5">&#9632;</span> Operator ' + F.operator + ' (' + F.operator_pct + '%)</span><span><span style="color:#8a8a82">&#9632;</span> Other ' + F.other + '</span></div>');
    var agentsHtml = card('<div style="font-size:13px;font-weight:700;color:#1B2A55;margin-bottom:10px">Top cancelling agents</div>' + j.by_agent.slice(0, 8).map(function(a){
      var nm = (!a.agent_id || a.agent_id === 'B2C') ? 'B2C / Walk-in' : (a.name || a.agent_id);
      return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:0.5px solid rgba(0,0,0,.05)"><span>' + esc(nm) + '</span><span style="font-family:\'DM Mono\',monospace;font-weight:700;color:#A32D2D">' + a.count + '</span></div>';
    }).join(''));
    var maxM = Math.max.apply(null, [1].concat(j.by_month.map(function(m){ return m.count; })));
    var monthHtml = card('<div style="font-size:13px;font-weight:700;color:#1B2A55;margin-bottom:10px">By month</div>' + j.by_month.map(function(m){
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:62px;font-size:11px;font-family:\'DM Mono\',monospace;color:#5A5A52">' + esc(m.month) + '</span><div style="flex:1;height:7px;border-radius:4px;background:#f0eee8"><div style="width:' + Math.round(m.count / maxM * 100) + '%;height:100%;border-radius:4px;background:#185FA5"></div></div><span style="width:22px;text-align:right;font-size:11px;font-family:\'DM Mono\',monospace">' + m.count + '</span></div>';
    }).join(''));
    return '<div class="bkv2" style="padding:18px">' + period + kpis + '<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:12px;align-items:start;margin-bottom:12px">' + catHtml + '<div style="display:flex;flex-direction:column;gap:12px">' + faultHtml + agentsHtml + '</div></div>' + monthHtml + '</div>';
  };
  w.__w4f1 = true; w.__orig = orig; window.bookingV2RenderCancelReport = w;

  /* the count next to the tab title: the server's cancellations for the same window as the report */
  var meta = window.bookingV2TopbarMeta;
  if(typeof meta === 'function' && !meta.__w4fc){
    var wm = function(){
      if(on() && !window._bkV2CityTourOnly && window._bkV2 && window._bkV2.tab === 'cancel' && typeof window._opsBookingMonthRange === 'function'){
        var month = (_bkV2.month && /^d{4}-d{2}$/.test(_bkV2.month)) ? _bkV2.month : window.bookingV2LocalYMD(new Date()).slice(0, 7), r = window._opsBookingMonthRange(month);
        var j = O.srv.peek('cxl|' + r.from + '|' + r.to);
        if(j) return j.cancellations + ' cancellation' + (j.cancellations === 1 ? '' : 's');
      }
      return meta.apply(this, arguments);
    };
    wm.__w4fc = true; wm.__orig = meta; window.bookingV2TopbarMeta = wm;
  }
})();
