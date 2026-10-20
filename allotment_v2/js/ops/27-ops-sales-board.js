/* ══════════════════════════════════════════════════════════════════════════
   §opsSalesMarkets · Markets and salespeople ⇄ operation-backend (S5, part)
   ──────────────────────────────────────────────────────────────────────────
   Wired (ops mode only; legacy mode calls the original functions untouched):
   - tmSaveModal (market branch)  → POST /v1/markets {id,name,color,subs}
                                    PATCH /v1/markets/:id {name,color,subs}   (id never changes)
   - tmSaveModal (sales branch)   → POST /v1/sales {code,name,full_name,designation,email,tel,color,signature,active}
                                    PATCH /v1/sales/:id  (same fields)       (no id sent: server makes it)
   - tmDeleteMarket(mId)          → DELETE /v1/markets/:id  (server refuses while agents use it)
   - tmDeleteSales(sId)           → DELETE /v1/sales/:id    (server unassigns agents, 409 if logins/rate types use it)
   - tmApplyMarketOrder(ids)      → PUT    /v1/markets/order {ids}  (every market exactly once)
   Source: operation-backend src/routes/sales-editing.ts (lines ~416-560) and
   src/domain/team.ts (planMarketCreate/Patch/Order, planSalesCreate/Patch).

   Projection: SB_MARKETS / SB_SALES are replaced row by row from each response
   (the catalogue adapter 10-ops-catalogue.js still does the full reads).
   Server first: local arrays change only after the server answers.
   Legacy persistence (sbMarketsPersist / sbSalesPersist) is a no-op in ops mode.

   - agSubMarketRemember(marketId,sub) (agent form, new sub-market) -> PATCH /v1/markets/:id {subs}  (undone on refusal)

   Sales Board (source: sales-editing.ts ~450-490, domain/sales-board.ts):
   - GET /v1/sales-board?month=YYYY-MM  -> the whole board (pax, FOC, target, streak, rank, previous rank,
     agents with pax / previous pax / trend / followed flags). Cached per month (20 s, then refreshed in
     the background; any non-sales write marks it stale).
   - salesPaxAgg / salesTargetFor / salesStreak / salesIsFollowed  -> read the cached server board instead
     of summing SB_BOOKINGS in the browser. renderSalesBoard shows "Loading" until the first answer.
     Previous month: the server sends previous_pax per agent and previous_rank per salesperson; the
     browser only needs the order, so previous bySales is a rank-preserving stand-in (not real pax).
   - salesSetTarget(id,ym,pax) -> PUT /v1/sales/:id/targets/:month {pax}  (0 clears; 403 for a sales login)
   - salesToggleFollow(id,ym,agentId,kind) -> PUT /v1/sales/:id/followups {month,agent_id,kind:'agent'|'foc',marked}
     The server sets an explicit state (no toggle), so a retry cannot undo it.
   Still in the browser: agentTrend() (pure, same thresholds as the server), the per-person booking count
   (nBk) and layout inside renderSalesBoard in 08-app.js. SB_SALES.targets/followup are no longer written.

   Load order: after 19-ops-addon-services.js, before 90-ops-boot.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function nullable(v){ var s = text(v); return s ? s : null; }

  function listMarkets(){ return typeof SB_MARKETS !== 'undefined' && Array.isArray(SB_MARKETS) ? SB_MARKETS : null; }
  function listSales(){ return typeof SB_SALES !== 'undefined' && Array.isArray(SB_SALES) ? SB_SALES : null; }
  function listAgents(){ return typeof SB_AGENTS !== 'undefined' && Array.isArray(SB_AGENTS) ? SB_AGENTS : []; }

  function renderTeam(){ if(typeof window.renderTeamMkt === 'function') window.renderTeamMkt(); }
  function closeModal(){ if(typeof window.tmCloseModal === 'function') window.tmCloseModal(); }

  // ── mappers (server → legacy projection; same shape as 10-ops-catalogue.js) ──

  function marketFromServer(s){
    var o = { id: s.id, name: s.name, subs: (s.subs || []).slice() };
    if(s.color != null) o.color = s.color;
    if(s.sort != null) o.sort = s.sort;
    return o;
  }

  function salesFromServer(s, prev){
    var o = { id: s.id, name: s.name, active: s.active !== false };
    if(s.code != null) o.code = s.code;
    if(s.full_name != null) o.fullName = s.full_name;
    if(s.designation != null) o.designation = s.designation;
    if(s.email != null) o.email = s.email;
    if(s.tel != null) o.tel = s.tel;
    if(s.color != null) o.color = s.color;
    // the server returns the signature only on some reads; keep the one already held rather than drop it
    if(typeof s.signature === 'string') o.signature = s.signature;
    else if(prev && prev.signature) o.signature = prev.signature;
    return o;
  }

  function upsertRow(list, row){
    var i = list.findIndex(function(x){ return x && x.id === row.id; });
    if(i >= 0) list[i] = row; else list.push(row);
  }
  function dropRow(list, id){
    var i = list.findIndex(function(x){ return x && x.id === id; });
    if(i >= 0) list.splice(i, 1);
  }

  // ── Markets ──

  function marketBody(d){
    return { name: text(d.name), color: nullable(d.color), subs: Array.isArray(d.subs) ? d.subs.map(text).filter(Boolean) : [] };
  }

  function createMarketServer(draft){
    var body = Object.assign({ id: text(draft.id) }, marketBody(draft));
    return O.queue(function(){
      return O.post('/v1/markets', body);
    }).then(function(row){
      var list = listMarkets();
      if(list) upsertRow(list, marketFromServer(row));
      O.wrote('sales-market-create');
      closeModal(); renderTeam();
      return row;
    }, function(e){
      O.fail('Could not add market', e);
      throw e;
    });
  }

  function updateMarketServer(mId, draft){
    return O.queue(function(){
      return O.patch('/v1/markets/' + enc(mId), marketBody(draft));
    }).then(function(row){
      var list = listMarkets();
      if(list) upsertRow(list, marketFromServer(row));
      O.wrote('sales-market-update');
      closeModal(); renderTeam();
      return row;
    }, function(e){
      O.fail('Could not save market', e);
      throw e;
    });
  }

  function deleteMarketServer(mId){
    return O.queue(function(){
      return O.del('/v1/markets/' + enc(mId));
    }).then(function(){
      var list = listMarkets();
      if(list) dropRow(list, mId);
      O.wrote('sales-market-delete');
      renderTeam();
    }, function(e){
      O.fail('Could not delete market', e);
      throw e;
    });
  }

  function applyMarketOrderServer(ids){
    return O.queue(function(){
      return O.call('PUT', '/v1/markets/order', { ids: ids });
    }).then(function(res){
      var list = listMarkets();
      if(list && res && Array.isArray(res.markets)){
        var rows = res.markets.map(marketFromServer);
        list.length = 0;
        Array.prototype.push.apply(list, rows);
      }
      O.wrote('sales-market-order');
      renderTeam();
      return res;
    }, function(e){
      O.fail('Could not save market order', e);
      throw e;
    });
  }

  // ── Salespeople ──

  function salesBody(d){
    var body = {
      code: text(d.code),
      name: text(d.name),
      full_name: nullable(d.fullName != null ? d.fullName : d.full_name),
      designation: nullable(d.designation),
      email: nullable(d.email),
      tel: nullable(d.tel),
      color: nullable(d.color),
      active: d.active !== false
    };
    // a signature is sent only when the draft carries one (server: a PNG or JPEG data URL)
    if(d.signature !== undefined) body.signature = nullable(d.signature);
    return body;
  }

  function createSalesServer(draft){
    return O.queue(function(){
      return O.post('/v1/sales', salesBody(draft));
    }).then(function(row){
      var list = listSales();
      if(list) upsertRow(list, salesFromServer(row, null));
      O.wrote('sales-person-create');
      closeModal(); renderTeam();
      return row;
    }, function(e){
      O.fail('Could not add salesperson', e);
      throw e;
    });
  }

  function updateSalesServer(sId, draft){
    var list = listSales();
    var prev = list ? list.find(function(x){ return x && x.id === sId; }) : null;
    return O.queue(function(){
      return O.patch('/v1/sales/' + enc(sId), salesBody(draft));
    }).then(function(row){
      if(list) upsertRow(list, salesFromServer(row, prev));
      O.wrote('sales-person-update');
      closeModal(); renderTeam();
      return row;
    }, function(e){
      O.fail('Could not save salesperson', e);
      throw e;
    });
  }

  function deleteSalesServer(sId){
    return O.queue(function(){
      return O.del('/v1/sales/' + enc(sId));
    }).then(function(){
      var list = listSales();
      if(list) dropRow(list, sId);
      // the server unassigns this person's agents; mirror that locally after its answer
      listAgents().forEach(function(a){ if(a && a.sales === sId) a.sales = null; });
      O.wrote('sales-person-delete');
      renderTeam();
    }, function(e){
      O.fail('Could not delete salesperson', e);
      throw e;
    });
  }

  // ── wrappers ──

  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsSalesMarkets = true;
    window[name] = w;
  }

  // The modal keeps its draft in the legacy globals; read them only inside ops mode.
  function modalState(){
    return {
      type: typeof _tmModalType !== 'undefined' ? _tmModalType : null,
      editId: typeof _tmModalEditId !== 'undefined' ? _tmModalEditId : null,
      draft: typeof _tmModalDraft !== 'undefined' ? _tmModalDraft : null
    };
  }

  wrap('tmSaveModal', function(orig){
    var st = modalState();
    if(!st.draft) return undefined;
    var d = st.draft;

    if(st.type === 'market'){
      if(!text(d.name)) { window.alert('Market name is required'); return undefined; }
      if(!st.editId && !text(d.id)) { window.alert('Market ID is required'); return undefined; }
      if(st.editId) return updateMarketServer(st.editId, d).catch(function(){ return null; });
      return createMarketServer(d).catch(function(){ return null; });
    }
    if(st.type === 'sales'){
      if(!text(d.code)) { window.alert('Code is required'); return undefined; }
      if(!text(d.name)) { window.alert('Name is required'); return undefined; }
      if(st.editId) return updateSalesServer(st.editId, d).catch(function(){ return null; });
      return createSalesServer(d).catch(function(){ return null; });
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('tmDeleteMarket', function(orig, mId){
    var list = listMarkets();
    var m = list ? list.find(function(x){ return x && x.id === mId; }) : null;
    if(!m) return undefined;
    if(!window.confirm('Delete market "' + m.name + '"?')) return undefined;
    return deleteMarketServer(mId).catch(function(){ return null; });
  });

  wrap('tmDeleteSales', function(orig, sId){
    var list = listSales();
    var s = list ? list.find(function(x){ return x && x.id === sId; }) : null;
    if(!s) return undefined;
    if(!window.confirm('Delete "' + s.name + '"?')) return undefined;
    return deleteSalesServer(sId).catch(function(){ return null; });
  });

  wrap('tmApplyMarketOrder', function(orig, ids){
    if(!Array.isArray(ids) || !ids.length) return undefined;
    return applyMarketOrderServer(ids).catch(function(){ return null; });
  });

  // Legacy blob writers for these two lists never run in ops mode (the server owns them).
  ['sbMarketsPersist', 'sbSalesPersist'].forEach(function(name){
    wrap(name, function(){ return undefined; });
  });

  /* Agent form: a new sub-market typed or picked is remembered under its market (legacy saved SB_MARKETS at once).
     The legacy function adds it to the local list and returns true; we then write only that market's subs:
     PATCH /v1/markets/:id {subs}. A refusal takes the sub back out of the list. A 403 (an agent editor without the
     config right) is silent: the server also adds a new sub-market to the market when the agent itself is saved. */
  wrap('agSubMarketRemember', function(orig, marketId, sub){
    var added = orig.apply(this, [].slice.call(arguments, 1));
    if(added !== true) return added;
    var list = listMarkets();
    var m = list ? list.find(function(x){ return x && x.id === marketId; }) : null;
    if(!m) return added;
    var name = text(sub);
    O.queue(function(){
      return O.patch('/v1/markets/' + enc(marketId), { subs: m.subs.map(text).filter(Boolean) });
    }).then(function(row){
      if(row && Array.isArray(row.subs)) m.subs = row.subs.slice();
      O.wrote('sales-market-subs');
    }, function(e){
      var i = m.subs.findIndex(function(s){ return String(s).toLowerCase() === name.toLowerCase(); });
      if(i >= 0) m.subs.splice(i, 1);
      if(!(e && e.statusCode === 403)) O.fail('Could not save sub-market', e);
    });
    return added;
  });

  // ── Sales Board (the server board replaces salesPaxAgg and friends) ──

  var BOARD_TTL = 20000;
  var boards = {};      // 'YYYY-MM' -> { board, at }
  var inflight = {};

  function nowMs(){ return Date.now(); }
  function curMonth(){ return typeof _sbMonth !== 'undefined' ? _sbMonth : null; }
  function boardFor(ym){ var e = boards[ym]; return e ? e.board : null; }
  function boardWithPrev(ym){
    for(var k in boards){ if(boards[k] && boards[k].board && boards[k].board.previous_month === ym) return boards[k].board; }
    return null;
  }
  function resetSig(){ try{ _sbSig = null; }catch(_){} }

  function aggFromBoard(ym){
    var out = { bySales: {}, byAgent: {}, focBySales: {}, focByAgent: {} };
    var b = boardFor(ym);
    if(b){
      (b.sales || []).forEach(function(r){ out.bySales[r.sales_id] = r.pax; if(r.foc) out.focBySales[r.sales_id] = r.foc; });
      (b.agents || []).forEach(function(a){ out.byAgent[a.agent_id] = a.pax; if(a.foc) out.focByAgent[a.agent_id] = a.foc; });
      return out;
    }
    var p = boardWithPrev(ym);
    if(p){
      var n = (p.sales || []).length;
      // order only: renderSalesBoard uses previous-month bySales just to rank people
      (p.sales || []).forEach(function(r){ out.bySales[r.sales_id] = n - r.previous_rank + 1; });
      (p.agents || []).forEach(function(a){ out.byAgent[a.agent_id] = a.previous_pax; });
    }
    return out;
  }
  function salesRow(salesId, ym){
    var b = boardFor(ym);
    return b ? (b.sales || []).find(function(r){ return r.sales_id === salesId; }) || null : null;
  }

  function fetchBoard(ym){
    return O.get('/v1/sales-board?month=' + enc(ym)).then(function(board){
      boards[ym] = { board: board, at: nowMs() };
      return board;
    });
  }
  function refreshBoard(ym){
    if(inflight[ym]) return inflight[ym];
    var origRender = originals.renderSalesBoard;
    inflight[ym] = fetchBoard(ym).then(function(){
      if(curMonth() === ym && typeof origRender === 'function') origRender();
    }, function(e){
      if(!boards[ym]){
        var el = document.getElementById('salesboard-wrap');
        if(el) el.innerHTML = '<div style="padding:40px;text-align:center;color:#b0aea6">Could not load the Sales Board</div>';
        O.fail('Could not load Sales Board', e);
      }
    }).then(function(){ delete inflight[ym]; });
    return inflight[ym];
  }

  function setTargetServer(salesId, ym, pax){
    var n = Math.max(0, parseInt(pax, 10) || 0);
    return O.queue(function(){
      return O.call('PUT', '/v1/sales/' + enc(salesId) + '/targets/' + enc(ym), { pax: n });
    }).then(function(res){
      O.wrote('sales-target');
      return fetchBoard(ym).then(function(){
        resetSig();
        if(typeof window.renderSalesBoard === 'function') window.renderSalesBoard();
        return res;
      });
    }, function(e){
      O.fail('Could not save target', e);
      throw e;
    });
  }

  function setFollowServer(salesId, ym, agentId, kind){
    var k = kind === 'foc' ? 'foc' : 'agent';
    var now = window.salesIsFollowed(salesId, ym, agentId, kind);
    return O.queue(function(){
      return O.call('PUT', '/v1/sales/' + enc(salesId) + '/followups', { month: ym, agent_id: agentId, kind: k, marked: !now });
    }).then(function(res){
      var b = boardFor(ym);
      var a = b ? (b.agents || []).find(function(x){ return x.agent_id === agentId; }) : null;
      if(a){ if(k === 'foc') a.feedback_collected = !now; else a.followed = !now; }
      O.wrote('sales-followup');
      resetSig();
      if(typeof window.renderSalesBoard === 'function') window.renderSalesBoard();
      return res;
    }, function(e){
      O.fail('Could not save follow-up', e);
      throw e;
    });
  }

  wrap('salesPaxAgg', function(orig, ym){ return aggFromBoard(ym); });
  wrap('salesTargetFor', function(orig, salesId, ym){ var r = salesRow(salesId, ym); return (r && +r.target) || 0; });
  wrap('salesStreak', function(orig, salesId, ym){ var r = salesRow(salesId, ym); return r ? r.streak : 0; });
  wrap('salesIsFollowed', function(orig, salesId, ym, agentId, kind){
    var b = boardFor(ym);
    var a = b ? (b.agents || []).find(function(x){ return x.agent_id === agentId && x.sales_id === salesId; }) : null;
    return !!(a && (kind === 'foc' ? a.feedback_collected : a.followed));
  });
  // SB_BOOKINGS is a partial cache here, so the board's booking counts come from the server row;
  // the route mix and sold value are not in /v1/sales-board yet, so the person view shows none
  // rather than a sum of whatever bookings happen to be loaded.
  wrap('salesBookingCounts', function(orig, ym){
    var out = {}, b = boardFor(ym);
    ((b && b.sales) || []).forEach(function(r){ if(r.bookings) out[r.sales_id] = r.bookings; });
    return out;
  });
  wrap('salesPersonMix', function(){ return { routePax: {}, routeVal: {}, value: null }; });
  wrap('salesSetTarget', function(orig, salesId, ym, pax){
    if(!salesId || !ym) return undefined;
    return setTargetServer(salesId, ym, pax).catch(function(){ return null; });
  });
  wrap('salesToggleFollow', function(orig, salesId, ym, agentId, kind){
    if(!salesId || !agentId) return undefined;
    return setFollowServer(salesId, ym, agentId, kind).catch(function(){ return null; });
  });
  wrap('renderSalesBoard', function(orig){
    var ym = curMonth();
    if(!ym) return orig();
    var ent = boards[ym];
    if(ent){
      orig();
      if(nowMs() - ent.at > BOARD_TTL) refreshBoard(ym);
      return undefined;
    }
    var el = document.getElementById('salesboard-wrap');
    if(el){ el.innerHTML = '<div style="padding:40px;text-align:center;color:#b0aea6">Loading Sales Board...</div>'; resetSig(); }
    return refreshBoard(ym);
  });

  // bookings or agents may have changed: keep the cache for the next paint but refresh it
  if(typeof O.onWrite === 'function'){
    O.onWrite(function(kind){
      if(String(kind || '').indexOf('sales-') === 0) return;
      for(var k in boards){ if(boards[k]) boards[k].at = 0; }
    });
  }

  var api = {
    createMarket: createMarketServer,
    updateMarket: updateMarketServer,
    deleteMarket: deleteMarketServer,
    applyMarketOrder: applyMarketOrderServer,
    createSales: createSalesServer,
    updateSales: updateSalesServer,
    deleteSales: deleteSalesServer,
    setTarget: setTargetServer,
    setFollow: setFollowServer,
    loadBoard: fetchBoard
  };
  O.salesMarkets = api;
  O.salesBoardFor = boardFor;      // w5-a: agentTrend (80-ops-w5a-reads.js) reads the board's trend of an agent
  window.laOpsSalesMarkets = api;
  window.__laOpsSalesMarketsCompat = {
    marketBody: marketBody, salesBody: salesBody,
    marketFromServer: marketFromServer, salesFromServer: salesFromServer
  };
})();
