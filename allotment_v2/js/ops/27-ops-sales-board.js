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

   NOT wired here (S5 remainder): sales targets (PUT /v1/sales/:id/targets/:month),
   followups (PUT /v1/sales/:id/followups), GET /v1/sales-board. Their legacy
   entry points and bodies are not verified for this packet.

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

  var api = {
    createMarket: createMarketServer,
    updateMarket: updateMarketServer,
    deleteMarket: deleteMarketServer,
    applyMarketOrder: applyMarketOrderServer,
    createSales: createSalesServer,
    updateSales: updateSalesServer,
    deleteSales: deleteSalesServer
  };
  O.salesMarkets = api;
  window.laOpsSalesMarkets = api;
  window.__laOpsSalesMarketsCompat = {
    marketBody: marketBody, salesBody: salesBody,
    marketFromServer: marketFromServer, salesFromServer: salesFromServer
  };
})();
