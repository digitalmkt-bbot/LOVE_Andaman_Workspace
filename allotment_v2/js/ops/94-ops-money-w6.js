/* ═════════════════════════════════════════════════════════════════
   §opsMoneyW6 (w6-d, 2026-10-18) · money screens: the agents with something to invoice, the By-trip payment chip's PFM / staff labels

   The backend built two fields the w5-d walk asked for (README "Fields the new frontend asked for", items 14 and 15):

     GET /v1/invoices/candidate-agents?kind=booking   { agents: [{ agent_id, code, name, bookings, total }] }
                                                      acctNewInvoiceRender: the "Agent" drop-down of the New invoice dialog
     GET /v1/bookings/{id}  pfm_status, past_cutoff   bookingV2PayChip: "On hold" / "Extended" / "Paid" / "เลย cutoff" / "Awaiting" / "Pro Forma"
                                                      (also the rows of GET /v1/pfm, which carry the same status and past_cutoff)
     GET /v1/bookings/{id}  internal_free             bookingV2PayChip: the staff trip that collects nothing (FOC · Welfare / Inspection · FREE)

   The drop-down lists the agents the server would list candidates for (the list under it is 30-ops-money.js's, from /v1/invoices/candidates);
   until the answer lands, and offline, legacy's own list stays. The chip draws legacy's markup with the server's status in place of the
   browser's own reading of the invoice, the cutoff time and the total.

   Load order: after 30-ops-money.js, 31-ops-pfm.js, 40-ops-bookings.js and 83-ops-pay-chip.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; }); }
  function laT(s){ return typeof g('laT') === 'function' ? window.laT(s) : s; }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsMoneyW6) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] money w6 · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsMoneyW6 = true; w.__orig = orig; window[name] = w;
  }

  /* ── 1 · New invoice: the agents with something to invoice ── */
  var cand = { at: 0, agents: null, loading: null };
  function fixAgentSelect(){
    var ov = document.getElementById('acct-modal'), sel = ov && ov.querySelector('select');
    if(!sel || !cand.agents) return;
    var cur = typeof _acctNewInvAgent !== 'undefined' ? _acctNewInvAgent : '';
    var html = '<option value="">— เลือก agent —</option>' + cand.agents.map(function(a){
      return '<option value="' + esc(a.agent_id) + '"' + (a.agent_id === cur ? ' selected' : '') + '>' + (a.code ? esc(a.code) + ' · ' : '') + esc(a.name) + '</option>';
    }).join('');
    if(cur && !cand.agents.some(function(a){ return a.agent_id === cur; })) html += '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>';
    if(sel.innerHTML !== html) sel.innerHTML = html;
  }
  function loadCand(){
    if(cand.loading) return cand.loading;
    cand.loading = O.get('/v1/invoices/candidate-agents', { kind: 'booking' }).then(function(res){
      cand.loading = null;
      if(!res || !Array.isArray(res.agents)) return;
      cand.agents = res.agents; cand.at = Date.now();
      fixAgentSelect();
    }, function(){ cand.loading = null; });
    return cand.loading;
  }
  var open0 = window.acctNewInvoiceOpen;
  if(typeof open0 === 'function' && !open0.__opsMoneyW6){
    var wOpen = function(){ if(enabled()){ cand.agents = null; cand.at = 0; } return open0.apply(this, arguments); };
    wOpen.__opsMoneyW6 = true; window.acctNewInvoiceOpen = wOpen;
  }
  wrap('acctNewInvoiceRender', function(orig, a){
    var r = orig.apply(this, a);
    if(cand.agents) fixAgentSelect();
    else loadCand();
    return r === undefined ? null : r;
  });
  O.onWrite(function(){ cand.agents = null; cand.at = 0; });

  /* ── 2 · the By-trip payment chip ── */
  /* the Daily PFM status the server gave this booking: the single read's (bk.pfmStatus), else the row of the period loaded (31-ops-pfm.js) */
  function pfmOf(bk){
    var row = typeof g('pfmServerRow') === 'function' ? window.pfmServerRow(bk) : null;
    if(row && row.kind === 'proforma' && row.status) return { status: row.status, past: !!row.past_cutoff };
    if(bk && bk.pfmStatus) return { status: bk.pfmStatus, past: !!bk.pastCutoff };
    return null;
  }
  var PM = {
    hold:       ['On hold', '#FCEBEB', '#A32D2D', '#E6C9C3'],
    approved:   ['Extended', '#E1F5EE', '#0F6E56', '#9FE1CB'],
    paid:       ['Paid', '#E1F5EE', '#0F6E56', '#9FE1CB'],
    alert:      [null, '#FCEBEB', '#A32D2D', '#E6C9C3'],
    awaiting:   ['Awaiting', '#FBF0DD', '#7A4A00', '#EAD7A8'],
    no_invoice: ['Pro Forma', '#FBF0DD', '#7A4A00', '#EAD7A8']
  };
  function isStaffTrip(bk){ return !!(bk && (bk.purpose === 'staff_welfare' || bk.purpose === 'staff_inspection' || bk.staffId)); }
  wrap('bookingV2PayChip', function(orig, a){
    var bk = a[0]; if(!bk) return undefined;
    var inv = typeof g('acctBookingInvoice') === 'function' ? window.acctBookingInvoice(bk.id) : null;
    var ag = typeof g('sbGetAgent') === 'function' ? window.sbGetAgent(bk.agentId) : null;
    var fl = bk.srvFlags;

    /* a staff trip that collects nothing: the server says whether anything is owed (internal_free); the label is the trip's own purpose */
    if(isStaffTrip(bk) && fl && typeof fl.internalFree === 'boolean'){
      if(fl.internalFree && !inv){
        var insp = bk.staffPurpose === 'inspection' || bk.purpose === 'staff_inspection';
        var t2 = insp ? 'Inspection · FREE' : 'FOC · Welfare';
        var c = insp ? ['#EEE9FB', '#6c5ce7', '#D9CFFA'] : ['#FCE9B5', '#7A5A12', '#EAD7A8'];
        return '<span class="t2-pay" style="background:' + c[0] + ';color:' + c[1] + ';border:1px solid ' + c[2] + ';cursor:pointer;font-weight:600" onclick="event.stopPropagation();bookingV2RowPayAction(\'' + bk.id + '\')" title="Staff trip · no charge">' + t2 + '</span>';
      }
      /* something is owed (or an invoice exists): legacy's other labels, as for any booking */
      var plain = Object.assign({}, bk, { purpose: '', staffId: '' });
      return orig(plain);
    }

    /* a proforma agent's booking: the server's status of the Daily PFM */
    var inPfm = (ag && ag.payType === 'proforma') || (bk.ops && bk.ops.pfm);
    var p = inPfm ? pfmOf(bk) : null, pm = p ? PM[p.status] : null;
    if(pm){
      if(pm[0] === null) pm = ['&#9888; ' + laT('เลย cutoff')].concat(pm.slice(1));
      return '<span class="t2-pay" style="background:' + pm[1] + ';color:' + pm[2] + ';border:1px solid ' + pm[3] + ';cursor:pointer;font-weight:600" onclick="event.stopPropagation();bookingV2RowPayAction(\'' + bk.id + '\')" title="'
        + esc(laT('สถานะ PFM · จัดการที่หน้า Daily PFM (Extend/Hold) หรือคลิกเพื่อออก/รับเงิน')) + '">' + pm[0] + '</span>';
    }
    return undefined;
  });

  O.moneyW6 = { pfmOf: pfmOf, candidates: function(){ return cand.agents; } };
})();
