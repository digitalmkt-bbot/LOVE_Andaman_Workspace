/* ══════════════════════════════════════════════════════════════════════════
   §opsVanBills · partner-van bills (วางบิลรถร่วม) ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   The server works out the rows of a period, the rates, the totals, the profit/loss and the
   draft / sent / paid state. renderVanBill() is replaced by a display of that view. The browser
   keeps only the inputs (rate, extra, deduction, per-pax sale) and sends them back; nothing is
   added up here and nothing is written to the legacy blob (vbPersist is silenced).

   GET   /v1/van-bills?month=YYYY-MM&period=1|2|3                     overview
   GET   /v1/van-bills/:partner/:month/:period[?van_id=]              one partner
   PATCH /v1/van-bills/:partner/:month/:period                        inputs (+ mark_seen)
   POST  …/pull-rates      409 no_van_rates
   POST  …/send  …/unsend  …/pay {via,ref,paid_on}  …/unpay

   The period/partner controls reuse the legacy vbShiftMonth / vbPick / vbMode / vbOpenSup, which
   only set _vb and call renderVanBill(). Load order: after 34-ops-vans.js, before 90-ops-boot.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var cache = {};          // url -> { at, view }
  var inflight = {};
  var TTL = 20000;
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function n(v){ var x = Number(v); return Number.isFinite(x) ? x : 0; }
  function text(v){ return v == null ? '' : String(v); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function baht(v){ return '฿' + Math.round(n(v)).toLocaleString('en-US'); }
  function num(v){ return v === '' || v == null ? null : n(v); }

  function address(){ return '/v1/van-bills/' + enc(_vb.sup) + '/' + enc(_vb.ym) + '/' + enc(_vb.per); }
  function overviewKey(){ return '/v1/van-bills?month=' + enc(_vb.ym) + '&period=' + enc(_vb.per); }
  function viewKey(){
    if(_vb.mode === 'ov') return overviewKey();
    return address() + (_vb.van ? '?van_id=' + enc(_vb.van) : '');
  }
  /* The van owners of this period, as the server's overview lists them. Not vbSuppliers(): that reads
     SB_VEHICLES, which nothing fills in ops mode, so it answers with 08-app.js's demo vehicles. */
  function partnerNames(){
    var hit = cache[overviewKey()];
    return hit ? (hit.view.partners || []).map(function(p){ return text(p.partner); }).filter(Boolean) : [];
  }
  function host(){ return document.getElementById('vanbill-host'); }
  function put(key, view){ cache[key] = { at: Date.now(), view: view }; }
  function drop(){ cache = {}; }

  /* ── load ── */
  function load(key){
    if(inflight[key]) return inflight[key];
    var p = O.call('GET', key).then(function(v){ put(key, v); delete inflight[key]; return v; },
      function(e){ delete inflight[key]; throw e; });
    inflight[key] = p;
    return p;
  }

  /* ── render ── */
  var CSS = 'padding:8px 10px;font-size:12px;';
  function input(val, attrs, ro){
    return '<input type="number" step="any" value="' + esc(val == null ? '' : val) + '"' + (ro ? ' disabled' : '') + ' ' + attrs
      + ' style="width:84px;text-align:right;border:1px solid #d6d9e0;border-radius:6px;padding:4px 6px;font:inherit">';
  }
  function card(t, v, sub){
    return '<div style="flex:1;min-width:150px;background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:12px 14px">'
      + '<div style="font-size:10.5px;color:#6b7686;text-transform:uppercase;letter-spacing:.05em;font-weight:600">' + esc(t) + '</div>'
      + '<div style="font-size:21px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:3px">' + v + '</div>'
      + (sub ? '<div style="font-size:11px;color:#6b7686;margin-top:2px">' + sub + '</div>' : '') + '</div>';
  }
  function stateChip(v){
    var c = v.state === 'paid' ? '#0F6E56' : v.state === 'sent' ? '#185FA5' : '#8B96A0';
    return '<span style="display:inline-block;padding:2px 9px;border-radius:99px;background:' + c + ';color:#fff;font-size:10.5px;font-weight:600">' + esc(v.state) + '</span>';
  }
  function bar(){
    var sups = partnerNames();
    var b = '<div class="vb-bar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">'
      + '<span class="vb-mode"><button class="' + (_vb.mode === 'ov' ? 'on' : '') + '" onclick="vbMode(\'ov\')">Overview</button>'
      + '<button class="' + (_vb.mode === 'ov' ? '' : 'on') + '" onclick="vbMode(\'one\')">By partner</button></span>'
      + '<button onclick="vbShiftMonth(-1)">‹</button><b>' + esc(_vb.ym) + '</b><button onclick="vbShiftMonth(1)">›</button>'
      + '<select onchange="vbPick(\'per\',this.value)">'
      + [1, 2, 3].map(function(p){ return '<option value="' + p + '"' + (+_vb.per === p ? ' selected' : '') + '>Period ' + p + '</option>'; }).join('') + '</select>';
    if(_vb.mode !== 'ov'){
      b += '<select onchange="vbPick(\'sup\',this.value)">'
        + sups.map(function(s){ return '<option value="' + esc(s) + '"' + (s === _vb.sup ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>';
    }
    return b + '</div>';
  }
  function overviewHtml(v){
    var rows = (v.partners || []).map(function(p){
      return '<tr style="border-top:1px solid #eceef3;cursor:pointer" onclick="vbOpenSup(this.getAttribute(\'data-p\'))" data-p="' + esc(p.partner) + '">'
        + '<td style="' + CSS + '"><b>' + esc(p.partner) + '</b></td>'
        + '<td style="' + CSS + 'text-align:right">' + n(p.trips) + '</td><td style="' + CSS + 'text-align:right">' + n(p.pax) + '</td>'
        + '<td style="' + CSS + 'text-align:right">' + baht(p.bill) + '</td><td style="' + CSS + 'text-align:right">' + baht(p.sale) + '</td>'
        + '<td style="' + CSS + 'text-align:right;color:' + (n(p.pl) < 0 ? '#A32D2D' : '#0F6E56') + '">' + baht(p.pl) + '</td>'
        + '<td style="' + CSS + '">' + (p.missing_rate ? '<span style="color:#A05A1A">' + n(p.missing_rate) + ' without rate</span>' : '') + '</td>'
        + '<td style="' + CSS + '">' + stateChip(p) + '</td></tr>';
    }).join('');
    var t = v.totals || {};
    return '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
      + card('Billed', baht(t.bill), n(t.trips) + ' trips · ' + n(t.pax) + ' pax') + card('Sale', baht(t.sale)) + card('Profit / loss', baht(t.pl)) + '</div>'
      + '<div style="background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:auto"><table style="width:100%;border-collapse:collapse">'
      + '<thead><tr style="background:#fafaf8;font-size:10px;text-transform:uppercase;color:#6b7686">'
      + ['Partner', 'Trips', 'Pax', 'Billed', 'Sale', 'P/L', '', 'State'].map(function(h, i){ return '<th style="' + CSS + 'text-align:' + (i && i < 6 ? 'right' : 'left') + '">' + h + '</th>'; }).join('')
      + '</tr></thead><tbody>' + (rows || '<tr><td colspan="8" style="padding:24px;text-align:center;color:#6b7686">No partner vans</td></tr>') + '</tbody></table></div>';
  }
  function rowHtml(r, ro){
    var k = esc(r.key), set = function(f){ return 'onchange="laOpsVanBills.setRow(this.getAttribute(\'data-k\'),\'' + f + '\',this.value)" data-k="' + k + '"'; };
    return '<tr style="border-top:1px solid #eceef3' + (r['new'] ? ';background:#fff7e6' : '') + '">'
      + '<td style="' + CSS + '">' + esc(r.date) + (r.return_only ? ' <small>(return)</small>' : '') + (r['new'] ? ' <b style="color:#A05A1A">NEW</b>' : '') + '</td>'
      + '<td style="' + CSS + '">' + esc(r.code) + '</td><td style="' + CSS + '">' + esc(r.van_id) + '</td>'
      + '<td style="' + CSS + 'text-align:right">' + n(r.pax) + '</td>'
      + '<td style="' + CSS + 'max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc((r.pickups || []).join(' | ')) + '">' + esc((r.pickups || []).join(', ')) + '</td>'
      + '<td style="' + CSS + '">' + input(r.rate, set('rate'), ro) + '</td><td style="' + CSS + '">' + input(r.ex || '', set('ex'), ro) + '</td>'
      + '<td style="' + CSS + '">' + input(r.cut || '', set('cut'), ro) + '</td><td style="' + CSS + '">' + input(r.per_pax || '', set('per'), ro) + '</td>'
      + '<td style="' + CSS + 'text-align:right"><b>' + baht(r.bill) + '</b></td>'
      + '<td style="' + CSS + 'text-align:right;color:' + (n(r.pl) < 0 ? '#A32D2D' : '#0F6E56') + '">' + baht(r.pl) + '</td></tr>';
  }
  function extraHtml(x, ro){
    var k = esc(x.id), set = function(f){ return 'onchange="laOpsVanBills.setExtra(this.getAttribute(\'data-k\'),\'' + f + '\',this.value)" data-k="' + k + '"'; };
    return '<tr style="border-top:1px solid #eceef3"><td style="' + CSS + '" colspan="2"><input type="text" value="' + esc(x.note || '') + '"' + (ro ? ' disabled' : '') + ' ' + set('note') + ' placeholder="note" style="width:100%;border:1px solid #d6d9e0;border-radius:6px;padding:4px 6px;font:inherit"></td>'
      + ['vans', 'pax', 'rate', 'ex', 'cut', 'per_pax'].map(function(f){ return '<td style="' + CSS + '">' + input(x[f], set(f), ro) + '</td>'; }).join('')
      + '<td style="' + CSS + 'text-align:right"><b>' + baht(x.bill) + '</b></td><td style="' + CSS + '">' + (ro ? '' : '<button onclick="laOpsVanBills.delExtra(this.getAttribute(\'data-k\'))" data-k="' + k + '">✕</button>') + '</td></tr>';
  }
  function partnerHtml(v){
    var ro = v.state === 'paid', t = v.totals || {};
    var codes = (v.codes || []).map(function(c){
      return '<label style="font-size:11px;margin-right:12px">' + esc(c.code) + ' (' + n(c.rows) + ') '
        + input(c.rate || '', 'onchange="laOpsVanBills.setCodeRate(\'' + esc(c.code) + '\',this.value)"', ro) + '</label>';
    }).join('');
    var btn = function(label, fn, extra){ return '<button class="vb-btn" onclick="laOpsVanBills.' + fn + '()"' + (extra || '') + '>' + label + '</button>'; };
    var acts = ro ? btn('Undo payment', 'unpay')
      : (btn('Pull rates', 'pullRates') + btn('Mark rows seen', 'save') + (v.sent ? btn('Unsend', 'unsend') + btn('Mark paid', 'pay') : btn('Send to owner', 'send')));
    var sentNote = v.sent ? '<div style="font-size:11px;color:#185FA5;margin-top:6px">Sent ' + esc(text(v.sent.at).slice(0, 10)) + ' for ' + baht(v.sent.bill)
      + (v.sent.changed_since_sent ? ' · <b style="color:#A32D2D">changed since sent</b>' : '') + '</div>' : '';
    var paidNote = v.paid ? '<div style="font-size:11px;color:#0F6E56;margin-top:6px">Paid ' + esc(v.paid.on) + ' via ' + esc(v.paid.via) + (v.paid.ref ? ' · ' + esc(v.paid.ref) : '') + ' · ' + baht(v.paid.amount) + '</div>' : '';
    return '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
      + card('Billed', baht(t.bill), n(t.vans) + ' vans · ' + n(t.pax) + ' pax') + card('Extra − deduction', baht(n(t.ex) - n(t.cut)), '+' + baht(t.ex) + ' − ' + baht(t.cut))
      + card('Sale', baht(t.sale)) + card('Profit / loss', baht(t.pl), n(v.missing_rate) ? n(v.missing_rate) + ' rows without a rate' : '') + '</div>'
      + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px">' + stateChip(v) + ' ' + acts
      + '<label style="font-size:11px">Sale / pax ' + input(v.per_pax || '', 'onchange="laOpsVanBills.setPerPax(this.value)"', ro) + '</label>'
      + '<label style="font-size:11px">Default rate ' + input(v.rate || '', 'onchange="laOpsVanBills.setRate(this.value)"', ro) + '</label></div>'
      + '<div style="margin-bottom:12px">' + codes + '</div>' + sentNote + paidNote
      + '<div style="background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:auto;margin-top:12px"><table style="width:100%;border-collapse:collapse">'
      + '<thead><tr style="background:#fafaf8;font-size:10px;text-transform:uppercase;color:#6b7686">'
      + ['Date', 'Code', 'Van', 'Pax', 'Pickups', 'Rate', 'Extra', 'Deduct', 'Sale/pax', 'Bill', 'P/L'].map(function(h){ return '<th style="' + CSS + 'text-align:left">' + h + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + ((v.rows || []).map(function(r){ return rowHtml(r, ro); }).join('') || '<tr><td colspan="11" style="padding:24px;text-align:center;color:#6b7686">No work in this period</td></tr>')
      + '</tbody></table></div>'
      + '<div style="margin-top:14px;font-size:12px;font-weight:600">Extra lines ' + (ro ? '' : '<button onclick="laOpsVanBills.addExtra()">+ Add</button>') + '</div>'
      + ((v.extra_lines || []).length ? '<div style="background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse"><tbody>'
        + v.extra_lines.map(function(x){ return extraHtml(x, ro); }).join('') + '</tbody></table></div>' : '');
  }

  function draw(v){
    var h = host(); if(!h) return;
    h.innerHTML = '<div data-ops-van-bills="1" style="padding:18px 20px">' + bar() + (_vb.mode === 'ov' ? overviewHtml(v) : partnerHtml(v)) + '</div>';
  }
  function drawError(e){
    var h = host(); if(!h) return;
    h.innerHTML = '<div style="padding:18px 20px">' + bar() + '<div style="padding:32px;text-align:center;color:#A32D2D">' + esc(e && e.message || 'Van bills could not load') + '</div></div>';
  }
  function render(){
    var h = host(); if(!h) return;
    if(!_vb.ym){
      var t = O.today(); _vb.ym = t.slice(0, 7); var dd = +t.slice(8, 10); _vb.per = dd <= 10 ? 1 : (dd <= 20 ? 2 : 3);
    }
    if(_vb.mode !== 'ov'){
      if(!cache[overviewKey()]){
        h.innerHTML = '<div style="padding:18px 20px">' + bar() + O.loadingHtml('Loading van bills…') + '</div>';
        load(overviewKey()).then(function(){ render(); }, drawError);
        return;
      }
      var sups = partnerNames();
      if(!_vb.sup || sups.indexOf(_vb.sup) < 0) _vb.sup = sups[0] || '';
      if(!_vb.sup){ h.innerHTML = '<div style="padding:18px 20px">' + bar() + '<div style="padding:40px;text-align:center;color:#6b7686">No partner vans in this period</div></div>'; return; }
    }
    var key = viewKey(), hit = cache[key];
    if(hit){ draw(hit.view); if(Date.now() - hit.at < TTL) return; }
    else h.innerHTML = '<div style="padding:18px 20px">' + bar() + O.loadingHtml('Loading van bills…') + '</div>';
    load(key).then(function(v){
      if(viewKey() === key && (!hit || JSON.stringify(hit.view) !== JSON.stringify(v))) draw(v);
    }, function(e){ if(viewKey() === key && !hit) drawError(e); else O.fail('Van bills could not refresh', e); });
  }

  /* ── writes · server first: the screen shows the server's answer, or goes back ── */
  function current(){ var h = cache[viewKey()]; return h ? h.view : null; }
  // a one-van filter is not what a write answers: refetch in that case
  function answered(v){ if(_vb.van) drop(); else { drop2(); put(address(), v); } render(); return v; }
  function drop2(){ Object.keys(cache).forEach(function(k){ if(k.indexOf('/v1/van-bills?') === 0) delete cache[k]; }); }   // overview is stale now
  function refused(title){ return function(e){ O.fail(title, e); render(); return null; }; }

  function patch(body, title){
    return O.queue(function(){
      return O.patch(address(), body);
    }).then(answered, refused(title || 'Van bill was not saved'));
  }
  function clone(x){ return O.clone(x) || {}; }
  function setRow(key, field, val){
    var v = current(); if(!v) return;
    var map = clone(v.row_overrides), o = map[key] || { rate: null, ex: null, cut: null, per: null };
    o[field] = num(val); map[key] = o;
    return patch({ row_overrides: map });
  }
  function setCodeRate(code, val){
    var v = current(); if(!v) return;
    var map = clone(v.route_rates); if(num(val) == null) delete map[code]; else map[code] = num(val);
    return patch({ route_rates: map });
  }
  function setRate(val){ return patch({ rate: n(val) }); }
  function setPerPax(val){ return patch({ per_pax: n(val) }); }
  function lines(){ var v = current(); return v ? clone(v.extra_lines) : []; }
  function addExtra(){
    var l = lines(); l.push({ date: null, note: null, vans: 1, pax: 0, rate: 0, ex: 0, cut: 0, per_pax: 0 });
    return patch({ extra_lines: l });
  }
  function setExtra(id, field, val){
    var l = lines(); l.forEach(function(x){ if(x.id === id) x[field] = field === 'note' ? (val || null) : n(val); });
    return patch({ extra_lines: l });
  }
  function delExtra(id){
    if(!confirm('Remove this extra line?')) return;
    return patch({ extra_lines: lines().filter(function(x){ return x.id !== id; }) });
  }
  function save(){ return patch({ mark_seen: true }, 'Van bill was not saved'); }
  function action(path, body, title){
    return O.queue(function(){ return O.post(address() + '/' + path, body); })
      .then(answered, refused(title));
  }
  function pullRates(){
    return O.queue(function(){ return O.post(address() + '/pull-rates'); }).then(function(v){
      var got = (v.pulled && v.pulled.got) || [];
      answered(v);
      O.toast({ kind: 'success', title: 'Rates pulled', status: 'OK', sub: got.map(function(g){ return g.code + ' ' + g.rate; }).join(' · ') || 'No rate found', dur: 5000 });
    }, refused('Rates were not pulled'));
  }
  function send(){ return action('send', {}, 'Bill was not sent'); }
  function unsend(){ if(!confirm('Take this bill back to draft?')) return; return action('unsend', {}, 'Bill was not unsent'); }
  function unpay(){ if(!confirm('Undo the payment of this bill?')) return; return action('unpay', {}, 'Payment was not undone'); }
  function pay(){
    var via = prompt('Paid via (transfer / cash / cheque)', 'transfer'); if(via == null) return;
    var ref = prompt('Reference (optional)', ''); if(ref == null) return;
    return action('pay', { via: String(via).trim().toLowerCase(), ref: ref.trim() || null }, 'Payment was not recorded');
  }

  /* ── wiring ── */
  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsVanBills = true;
    window[name] = w;
  }
  wrap('renderVanBill', function(){ render(); });
  wrap('vbPersist', function(){ return; });          // the bill lives on the server, not in the blob
  O.onChange(function(){ drop(); });

  /* Transfer Fleet's van_rates blob is a server-backed cell map. */
  var vr = { loaded: false, loading: null, rates: {}, known: {}, pending: 0, failed: false };
  function vrFlat(R){
    var out = {};
    Object.keys(R || {}).forEach(function(g){
      var G = R[g] || {};
      if(G.base != null) out[JSON.stringify([g, null, 'base'])] = n(G.base);
      Object.keys(G.rt || {}).forEach(function(r){
        ['base', 'PK', 'KL'].forEach(function(f){
          if(G.rt[r][f] != null) out[JSON.stringify([g, r, f])] = n(G.rt[r][f]);
        });
      });
    });
    return out;
  }
  function vrApply(view){
    var R = {};
    (view.rates || []).forEach(function(c){
      var G = R[c.group_key] = R[c.group_key] || {};
      if(c.route_id == null) G.base = n(c.rate);
      else { G.rt = G.rt || {}; (G.rt[c.route_id] = G.rt[c.route_id] || {})[c.field] = n(c.rate); }
    });
    vr.rates = R; vr.known = vrFlat(R); vr.loaded = true;
  }
  /* Readers of vanRates() outside the Costing screen get {} until the first load lands. After that first
     successful load, redraw the active one (unless someone is typing). costing repaints itself (ctRender/ctRead).
     In ops mode renderDailyReport / renderTripPL draw the server's own figures and never read vanRates();
     they are listed only so a local-fallback draw cannot stay stale. The pick-up "fill rates" action (08-app 7890)
     reads vanRate() on click, so it needs no redraw. */
  var READERS = { dailyreport: 'renderDailyReport', trippl: 'renderTripPL', dailypfm: 'renderDailyPfm' };
  function vrRefreshReaders(){
    try{
      if(O.busy && O.busy()) return;
      var fn = READERS[O.activeView ? O.activeView() : ''];
      if(fn && typeof window[fn] === 'function') window[fn]();
    }catch(_){}
  }
  function vrLoad(force){
    if(vr.loading) return vr.loading;
    if(vr.loaded && !force) return Promise.resolve();
    var first = !vr.loaded;
    vr.loading = O.get('/v1/van-rates').then(vrApply).then(function(){ if(first) vrRefreshReaders(); });
    return vr.loading.then(function(){ vr.loading = null; }, function(e){ vr.loading = null; throw e; });
  }
  function vrRepaint(){ if(typeof window.ctRender === 'function') window.ctRender(); }
  function vrWrite(val){
    if(!vr.loaded) { O.fail('Van rates were not saved', new Error('Wait for van rates to load')); return; }
    var next = vrFlat(val), jobs = Object.keys(next).filter(function(k){ return next[k] !== vr.known[k]; });
    Object.keys(vr.known).forEach(function(k){ if(!(k in next)) jobs.push(k); });
    if(!jobs.length) return Promise.resolve();
    // Keep successive edits while queued; only the final server answer replaces this draft.
    // Snapshot first: a refusal puts the pre-edit state back at once (server-first), then reloads.
    var snap = { rates: vr.rates, known: vr.known };
    vr.rates = O.clone(val); vr.known = next; vr.pending++;
    return O.queue(function(){
      var last;
      return jobs.reduce(function(p, k){ return p.then(function(){
        var a = JSON.parse(k);
        return O.call('PUT', '/v1/van-rates', { group: a[0], route_id: a[1], field: a[2], rate: k in next ? next[k] : null })
          .then(function(v){ last = v; });
      }); }, Promise.resolve()).then(function(){ return last; });
    }).then(function(v){ return v; }, function(e){
      vr.failed = true; vr.rates = snap.rates; vr.known = snap.known; vrRepaint();
      O.fail('Van rates were not saved', e);
    })
      .then(function(v){
        vr.pending--; drop();
        if(vr.pending) return;
        if(vr.failed){ vr.failed = false; return vrLoad(true).then(vrRepaint, function(e){ vr.loaded = false; O.fail('Van rates could not reload', e); }); }
        vrApply(v); vrRepaint();
      });
  }
  wrap('ctRender', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    if(vr.loaded) return orig.apply(self, args);
    return vrLoad().then(function(){ return orig.apply(self, args); }, function(e){
      O.fail('Van rates could not load', e);
      var host = document.getElementById('ct-body'); if(!host) return;
      host.innerHTML = '<div data-van-rates-unavailable="1" style="padding:32px;text-align:center;color:#A32D2D">'
        + 'Van rates are unavailable (they did not load from operation-backend), so Costing is not shown. '
        + '<button onclick="ctRender()">Retry</button></div>';
    });
  });
  wrap('ctRead', function(orig, key){
    if(key !== 'van_rates') return orig.apply(this, [].slice.call(arguments, 1));
    if(!vr.loaded){ vrLoad().then(vrRepaint, function(e){ O.fail('Van rates could not load', e); }); return null; }
    return O.clone(vr.rates);
  });
  wrap('ctWrite', function(orig, key, val){
    return key === 'van_rates' ? vrWrite(val) : orig.apply(this, [].slice.call(arguments, 1));
  });

  window.laOpsVanBills = { render: render, setRow: setRow, setCodeRate: setCodeRate, setRate: setRate, setPerPax: setPerPax,
    addExtra: addExtra, setExtra: setExtra, delExtra: delExtra, save: save, pullRates: pullRates, send: send, unsend: unsend,
    pay: pay, unpay: unpay, originals: originals };
})();
