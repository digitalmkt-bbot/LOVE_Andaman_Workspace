/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetStock · stock, consumables, purchase memos ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Hydrates FL_INVENTORY, FL_MEMOS, FL_CONSUMABLE_LOGS from
   /v1/fleet/stock-items, /v1/fleet/memos, /v1/fleet/consumables.
   Quantities are server movement-derived: local stocks[].qty, movement
   history, and replacement arrays are never submitted as client-owned state.

   GET    /v1/fleet/warehouses
   GET    /v1/fleet/suppliers
   GET|POST /v1/fleet/stock-items
   GET|PATCH|DELETE /v1/fleet/stock-items/:id
   POST   /v1/fleet/stock-items/:id/receive|transfer|adjust|merge
   POST|DELETE /v1/fleet/jobs/:id/parts[/:idx]
   GET|POST|DELETE /v1/fleet/consumables[/:id]
   GET|POST /v1/fleet/memos
   GET|PATCH /v1/fleet/memos/:id
   POST   /v1/fleet/memos/:id/approve|order|receive|short-close|pay|cancel
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var state = {
    loaded: false,
    failed: false,
    loading: null,
    warehouses: [],
    suppliers: []
  };
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function nullable(v){ var s = text(v); return s ? s : null; }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function clone(v){ return O.clone ? O.clone(v) : (v == null ? v : JSON.parse(JSON.stringify(v))); }

  function listInventory(){ return typeof FL_INVENTORY !== 'undefined' && Array.isArray(FL_INVENTORY) ? FL_INVENTORY : []; }
  function listMemos(){ return typeof FL_MEMOS !== 'undefined' && Array.isArray(FL_MEMOS) ? FL_MEMOS : []; }
  function listConsumables(){ return typeof FL_CONSUMABLE_LOGS !== 'undefined' && Array.isArray(FL_CONSUMABLE_LOGS) ? FL_CONSUMABLE_LOGS : []; }

  var WH_TO_ID = {
    'tublamu': 'tublamu', 'คลัง Tub Lamu': 'tublamu', 'Tub Lamu': 'tublamu',
    'panwa': 'panwa', 'คลัง Visit Panwa': 'panwa', 'Visit Panwa': 'panwa',
    'ranong': 'ranong', 'คลัง Ranong': 'ranong', 'Ranong': 'ranong'
  };
  var WH_TO_NAME = {
    'tublamu': 'คลัง Tub Lamu',
    'panwa': 'คลัง Visit Panwa',
    'ranong': 'คลัง Ranong'
  };

  function normalizeWarehouse(w){
    var s = text(w);
    if(!s) return 'tublamu';
    if(WH_TO_ID[s]) return WH_TO_ID[s];
    var low = s.toLowerCase().replace(/คลัง/g, '').replace(/\s+/g, '');
    if(low === 'tublamu') return 'tublamu';
    if(low === 'visitpanwa' || low === 'panwa') return 'panwa';
    if(low === 'ranong') return 'ranong';
    return s;
  }

  function warehouseLabel(w){
    var id = normalizeWarehouse(w);
    return WH_TO_NAME[id] || w || 'คลัง Tub Lamu';
  }

  function mapMovement(m){
    m = m || {};
    return {
      id: m.id,
      seq: m.seq,
      date: m.date || '',
      type: m.type || 'receive',
      qty: Math.abs(num(m.delta)),
      delta: num(m.delta),
      location: m.warehouse ? warehouseLabel(m.warehouse) : null,
      warehouse: m.warehouse || null,
      note: m.note || '',
      by: m.by || '',
      memoId: m.memo_id || null,
      jobId: m.job_id || null,
      consumableId: m.consumable_id || null,
      changes: m.changes ? clone(m.changes) : null
    };
  }

  function fromServerStockItem(s, old){
    s = s || {}; old = old || {};
    var stocks = (Array.isArray(s.stocks) ? s.stocks : []).map(function(st){
      return {
        warehouse: st.warehouse,
        location: st.warehouse_name || warehouseLabel(st.warehouse),
        qty: num(st.qty),
        minQty: 0
      };
    });
    var totalQty = s.total_qty != null ? num(s.total_qty) : stocks.reduce(function(sum, x){ return sum + x.qty; }, 0);
    var primaryLoc = s.primary_warehouse_name || (s.primary_warehouse ? warehouseLabel(s.primary_warehouse) : (stocks[0] ? stocks[0].location : 'คลัง Tub Lamu'));
    return {
      id: s.id,
      name: s.name || '',
      partNo: s.part_no || '',
      category: s.category || 'general',
      supplier: s.supplier || '',
      unit: s.unit || 'ชิ้น',
      minQty: num(s.min_qty),
      cost: num(s.cost),
      note: s.note || '',
      createdFrom: s.created_from || null,
      createdDate: s.created_date || null,
      qty: totalQty,
      totalQty: totalQty,
      location: primaryLoc,
      primaryLocation: primaryLoc,
      primaryWarehouse: s.primary_warehouse || null,
      belowMin: !!s.below_min,
      stocks: stocks,
      history: Array.isArray(s.movements) ? s.movements.map(mapMovement) : (Array.isArray(old.history) ? old.history : []),
      _fromOpsBackend: true
    };
  }

  function fromServerConsumable(c){
    c = c || {};
    return {
      id: c.id,
      date: c.date || '',
      itemId: c.item_id || '',
      itemName: c.item_name || '',
      unit: c.unit || 'ชิ้น',
      qty: num(c.qty),
      unitCost: num(c.unit_cost),
      cost: num(c.cost),
      warehouse: c.warehouse || 'tublamu',
      location: warehouseLabel(c.warehouse),
      boatId: c.boat_id || '',
      engineId: c.engine_id || null,
      engineLabel: c.engine_label || '',
      by: c.drawn_by || '',
      note: c.note || '',
      voidedAt: c.voided_at || null,
      _fromOpsBackend: true
    };
  }

  function mapMemoLine(l){
    l = l || {};
    return {
      id: l.id,
      name: l.name || '',
      qty: num(l.qty),
      price: num(l.price),
      discountPct: num(l.discount_pct),
      category: l.category || 'parts',
      partNo: l.part_no || '',
      unit: l.unit || 'ชิ้น',
      invId: l.item_id || null,
      itemId: l.item_id || null,
      fromInventory: !!l.from_inventory,
      recvQty: num(l.received_qty),
      left: l.left != null ? num(l.left) : Math.max(0, num(l.qty) - num(l.received_qty)),
      priceMismatch: !!l.price_mismatch,
      inventorySnapshot: l.snapshot ? {
        cost: l.snapshot.cost,
        primaryLocation: l.snapshot.primary_location,
        qtyAtSelection: l.snapshot.qty_at_selection
      } : null
    };
  }

  function fromServerMemo(m, old){
    m = m || {}; old = old || {};
    return {
      id: m.id,
      no: m.no || '',
      title: m.title || '',
      subject: m.title || '',
      boatId: m.boat_id || null,
      memoType: m.memo_type || 'parts',
      scope: m.scope || 'vessel',
      generalCategory: m.general_category || null,
      proposer: m.proposer || '',
      from: m.from || '',
      to: m.to || '',
      cc: m.cc || '',
      refNote: m.ref_note || '',
      supplier: m.supplier || '',
      note: m.note || '',
      date: m.memo_date || '',
      createdDate: m.memo_date || '',
      maintId: m.job_id || null,
      jobId: m.job_id || null,
      projectId: m.project_id || null,
      status: m.status || 'pending_approval',
      currentStep: m.current_step != null ? num(m.current_step) : 1,
      vatEnabled: m.vat_enabled !== false,
      vatRate: m.vat_rate != null ? num(m.vat_rate) : 7,
      discountPct: num(m.discount_pct),
      discountAmt: num(m.discount_amt),
      subtotal: num(m.subtotal),
      discount: num(m.discount),
      afterDiscount: num(m.after_discount),
      vat: num(m.vat),
      amount: num(m.amount),
      orderedAmount: m.ordered_amount != null ? num(m.ordered_amount) : null,
      approvedBy: m.approved_by || null,
      approvedDate: m.approved_date || null,
      approveNote: m.approve_note || null,
      orderedDate: m.ordered_date || null,
      orderedBy: m.ordered_by || null,
      receivedDate: m.received_date || null,
      receivedBy: m.received_by || null,
      receivedLocation: m.received_warehouse ? warehouseLabel(m.received_warehouse) : null,
      receivedWarehouse: m.received_warehouse || null,
      paidDate: m.paid_date || null,
      paidBy: m.paid_by || null,
      paidVia: m.paid_via || null,
      shortClosed: m.short_closed ? clone(m.short_closed) : null,
      cancelReason: m.cancel_reason || null,
      cancelledBy: m.cancelled_by || null,
      cancelledAt: m.cancelled_at || null,
      items: Array.isArray(m.lines) ? m.lines.map(mapMemoLine) : [],
      receiveState: m.receive_state ? clone(m.receive_state) : null,
      laborOnly: !!m.labor_only,
      duplicateNo: !!m.duplicate_no,
      history: Array.isArray(m.history) ? clone(m.history) : (old.history || []),
      receipts: Array.isArray(m.receipts) ? clone(m.receipts) : (old.receipts || []),
      _fromOpsBackend: true
    };
  }

  function replaceInventory(rows){
    var target = listInventory();
    var byId = {};
    target.forEach(function(x){ if(x && x.id) byId[x.id] = x; });
    var mapped = (rows || []).map(function(s){ return fromServerStockItem(s, byId[s.id] || null); });
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function upsertInventory(row){
    var target = listInventory();
    var idx = target.findIndex(function(x){ return x && x.id === row.id; });
    var mapped = fromServerStockItem(row, idx >= 0 ? target[idx] : null);
    if(idx < 0) target.push(mapped);
    else target[idx] = mapped;
    return mapped;
  }

  function replaceMemos(rows){
    var target = listMemos();
    var byId = {};
    target.forEach(function(x){ if(x && x.id) byId[x.id] = x; });
    var mapped = (rows || []).map(function(s){ return fromServerMemo(s, byId[s.id] || null); });
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function upsertMemo(row){
    var target = listMemos();
    var idx = target.findIndex(function(x){ return x && x.id === row.id; });
    var mapped = fromServerMemo(row, idx >= 0 ? target[idx] : null);
    if(idx < 0) target.unshift(mapped);
    else target[idx] = mapped;
    return mapped;
  }

  function replaceConsumables(rows){
    var target = listConsumables();
    var mapped = (rows || []).map(fromServerConsumable);
    target.length = 0;
    Array.prototype.push.apply(target, mapped);
    return mapped;
  }

  function refetchStockAndMemos(){
    return Promise.all([
      O.get('/v1/fleet/stock-items'),
      O.get('/v1/fleet/memos'),
      O.get('/v1/fleet/consumables')
    ]).then(function(res){
      replaceInventory((res[0] && res[0].items) || []);
      replaceMemos((res[1] && res[1].memos) || []);
      replaceConsumables((res[2] && res[2].consumables) || []);
      state.loaded = true;
      state.failed = false;
      return true;
    });
  }

  function loadAll(force){
    if(!enabled()) return Promise.resolve(false);
    if(state.loaded && !force) return Promise.resolve(true);
    if(state.loading) return state.loading;
    state.loading = Promise.all([
      refetchStockAndMemos(),
      O.get('/v1/fleet/warehouses').then(function(r){ state.warehouses = (r && r.warehouses) || []; }).catch(function(){}),
      O.get('/v1/fleet/suppliers').then(function(r){ state.suppliers = (r && r.suppliers) || []; }).catch(function(){})
    ]).then(function(){ return true; }).catch(function(e){
      state.failed = true;
      O.fail('Could not load fleet inventory and memos from operation-backend', e);
      throw e;
    }).finally(function(){
      state.loading = null;
    });
    return state.loading;
  }

  function redrawStock(){
    try{ if(typeof window.flRenderInventory === 'function' && document.getElementById('fl-inv-list')) window.flRenderInventory(); }catch(_){}
    try{ if(typeof window.renderConsumables === 'function' && document.getElementById('consumables-host')) window.renderConsumables(); }catch(_){}
    try{ if(typeof window.flRenderMaint === 'function' && document.getElementById('fl-maint-list')) window.flRenderMaint(); }catch(_){}
  }

  // Request builders — never send stocks[].qty, total_qty, or history/movements
  function toStockCreateBody(d){
    d = d || {};
    var qty = Math.max(0, num(d.qty));
    var body = {
      name: text(d.name),
      part_no: nullable(d.part_no != null ? d.part_no : d.partNo),
      category: nullable(d.category) || 'general',
      supplier: nullable(d.supplier),
      unit: nullable(d.unit) || 'ชิ้น',
      min_qty: Math.max(0, num(d.min_qty != null ? d.min_qty : d.minQty)),
      cost: Math.max(0, num(d.cost)),
      note: nullable(d.note),
      qty: qty
    };
    if(qty > 0 || d.warehouse || d.location){
      body.warehouse = normalizeWarehouse(d.warehouse || d.location);
    }
    return body;
  }

  function toStockPatchBody(d, partNoAnyway){
    d = d || {};
    var body = {};
    if(d.name !== undefined) body.name = text(d.name);
    if(d.part_no !== undefined || d.partNo !== undefined) body.part_no = nullable(d.part_no != null ? d.part_no : d.partNo);
    if(d.category !== undefined) body.category = nullable(d.category);
    if(d.supplier !== undefined) body.supplier = nullable(d.supplier);
    if(d.unit !== undefined) body.unit = nullable(d.unit) || 'ชิ้น';
    if(d.min_qty !== undefined || d.minQty !== undefined) body.min_qty = Math.max(0, num(d.min_qty != null ? d.min_qty : d.minQty));
    if(d.cost !== undefined) body.cost = Math.max(0, num(d.cost));
    if(d.note !== undefined) body.note = nullable(d.note);
    if(partNoAnyway) body.part_no_anyway = true;
    return body;
  }

  function toStockReceiveBody(warehouse, qty, date, note){
    var body = {
      warehouse: normalizeWarehouse(warehouse),
      qty: num(qty)
    };
    if(nullable(date)) body.date = nullable(date);
    if(nullable(note)) body.note = nullable(note);
    return body;
  }

  function toStockTransferBody(from, to, qty, date, note){
    var body = {
      from: normalizeWarehouse(from),
      to: normalizeWarehouse(to),
      qty: num(qty)
    };
    if(nullable(date)) body.date = nullable(date);
    if(nullable(note)) body.note = nullable(note);
    return body;
  }

  function toStockAdjustBody(warehouse, qty, date, note){
    var body = {
      warehouse: normalizeWarehouse(warehouse),
      qty: Math.max(0, num(qty))
    };
    if(nullable(date)) body.date = nullable(date);
    if(nullable(note)) body.note = nullable(note);
    return body;
  }

  function toConsumableBody(d){
    d = d || {};
    var body = {
      item_id: text(d.item_id != null ? d.item_id : d.itemId),
      warehouse: normalizeWarehouse(d.warehouse || d.location),
      qty: Math.round(num(d.qty)),
      boat_id: text(d.boat_id != null ? d.boat_id : d.boatId)
    };
    if(nullable(d.engine_id != null ? d.engine_id : d.engineId)) body.engine_id = nullable(d.engine_id != null ? d.engine_id : d.engineId);
    if(nullable(d.engine_label != null ? d.engine_label : d.engineLabel)) body.engine_label = nullable(d.engine_label != null ? d.engine_label : d.engineLabel);
    if(nullable(d.date)) body.date = nullable(d.date);
    if(nullable(d.by)) body.by = nullable(d.by);
    if(nullable(d.note)) body.note = nullable(d.note);
    if(d.allow_negative || d.allowNegative) body.allow_negative = true;
    return body;
  }

  function toMemoBody(d, isPatch){
    d = d || {};
    var lines = (d.lines || d.items || []).map(function(l){
      var line = {
        name: text(l.name),
        qty: num(l.qty || 1),
        price: num(l.price),
        discount_pct: num(l.discount_pct != null ? l.discount_pct : l.discountPct),
        category: l.category || (d.memo_type || d.memoType || 'parts'),
        part_no: nullable(l.part_no != null ? l.part_no : l.partNo),
        unit: nullable(l.unit) || 'ชิ้น',
        item_id: nullable(l.item_id != null ? l.item_id : l.invId),
        from_inventory: !!(l.from_inventory != null ? l.from_inventory : l.fromInventory)
      };
      if(isPatch && l.id) line.id = l.id;
      if(l.auto_register !== undefined || l.autoRegister !== undefined){
        line.auto_register = !!(l.auto_register != null ? l.auto_register : l.autoRegister);
      }
      return line;
    });
    var scope = text(d.scope) || 'vessel';
    var body = {
      title: text(d.title != null ? d.title : d.subject),
      memo_type: text(d.memo_type != null ? d.memo_type : d.memoType) || 'parts',
      scope: scope,
      boat_id: scope === 'general' ? null : nullable(d.boat_id != null ? d.boat_id : d.boatId),
      general_category: scope === 'general' ? nullable(d.general_category != null ? d.general_category : d.generalCategory) : null,
      proposer: nullable(d.proposer),
      from: nullable(d.from),
      to: nullable(d.to),
      cc: nullable(d.cc),
      ref_note: nullable(d.ref_note != null ? d.ref_note : d.refNote),
      supplier: nullable(d.supplier),
      note: nullable(d.note),
      memo_date: nullable(d.memo_date != null ? d.memo_date : (d.date || d.createdDate)) || O.today(),
      job_id: nullable(d.job_id != null ? d.job_id : d.maintId),
      project_id: nullable(d.project_id != null ? d.project_id : d.projectId),
      vat_enabled: d.vat_enabled != null ? !!d.vat_enabled : (d.vatEnabled !== false),
      vat_rate: d.vat_rate != null ? num(d.vat_rate) : (d.vatRate != null ? num(d.vatRate) : 7),
      discount_pct: num(d.discount_pct != null ? d.discount_pct : d.discountPct),
      discount_amt: num(d.discount_amt != null ? d.discount_amt : d.discountAmt),
      lines: lines
    };
    if(!isPatch) body.no = text(d.no);
    return body;
  }

  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsFleetStock = true;
    window[name] = w;
  }

  wrap('flSaveAddStock', function(){
    var d = function(id){ return document.getElementById(id); };
    var name = d('add-stock-name') ? d('add-stock-name').value.trim() : '';
    if(!name){ alert('กรุณากรอกชื่ออะไหล่'); return null; }
    var body = toStockCreateBody({
      name: name,
      partNo: d('add-stock-partno') ? d('add-stock-partno').value.trim() : '',
      category: d('add-stock-cat') ? d('add-stock-cat').value : 'general',
      supplier: d('add-stock-supplier') ? d('add-stock-supplier').value.trim() : '',
      location: d('add-stock-loc') ? d('add-stock-loc').value : 'คลัง Tub Lamu',
      qty: d('add-stock-qty') ? (parseFloat(d('add-stock-qty').value) || 0) : 0,
      minQty: d('add-stock-min') ? (parseInt(d('add-stock-min').value, 10) || 0) : 0,
      unit: d('add-stock-unit') ? d('add-stock-unit').value.trim() : 'ชิ้น',
      cost: d('add-stock-cost') ? (parseFloat(d('add-stock-cost').value) || 0) : 0,
      note: d('add-stock-note') ? d('add-stock-note').value.trim() : ''
    });
    return O.queue(function(){
      return O.post('/v1/fleet/stock-items', body);
    }).then(function(res){
      upsertInventory(res);
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-add-stock');
      O.wrote('fleet-stock-create');
      redrawStock();
      return res;
    }).catch(function(e){ O.fail('Could not add stock item', e); return null; });
  });

  wrap('flSaveInvEdit', function(){
    var id = typeof _editInvId !== 'undefined' ? _editInvId : null;
    var item = id ? listInventory().find(function(x){ return x && x.id === id; }) : null;
    if(!item) return null;
    var d = function(elId){ return document.getElementById(elId); };
    var name = d('inv-edit-name') ? d('inv-edit-name').value.trim() : '';
    if(!name){ alert('กรุณาระบุชื่อรายการ'); return null; }
    var patchBody = toStockPatchBody({
      name: name,
      partNo: d('inv-edit-partno') ? d('inv-edit-partno').value.trim() : '',
      category: d('inv-edit-cat') ? d('inv-edit-cat').value : item.category,
      supplier: d('inv-edit-supplier') ? d('inv-edit-supplier').value.trim() : '',
      unit: d('inv-edit-unit') ? d('inv-edit-unit').value.trim() : 'ชิ้น',
      minQty: d('inv-edit-min') ? (parseInt(d('inv-edit-min').value, 10) || 0) : 0,
      cost: d('inv-edit-cost') ? (parseFloat(d('inv-edit-cost').value) || 0) : 0,
      note: d('inv-edit-note') ? d('inv-edit-note').value.trim() : ''
    });

    // Check per-warehouse adjustments if the user changed counted quantities in the edit modal
    var adjustCalls = [];
    ['tublamu', 'panwa', 'ranong'].forEach(function(whId, i){
      var qEl = d('inv-edit-wh-qty-' + i);
      if(!qEl) return;
      var counted = Math.max(0, parseFloat(qEl.value) || 0);
      var st = (item.stocks || []).find(function(s){ return normalizeWarehouse(s.warehouse || s.location) === whId; });
      var have = st ? num(st.qty) : 0;
      if(Math.abs(counted - have) > 0.001){
        adjustCalls.push(function(){
          return O.post('/v1/fleet/stock-items/' + enc(id) + '/adjust', toStockAdjustBody(whId, counted, O.today(), 'ปรับยอดจากการแก้ไขรายการ'));
        });
      }
    });

    return O.queue(function(){
      var p = O.patch('/v1/fleet/stock-items/' + enc(id), patchBody).catch(function(e){
        if(e && e.code === 'part_no_change'){
          if(!confirm(e.message)) throw e;
          return O.patch('/v1/fleet/stock-items/' + enc(id), toStockPatchBody(patchBody, true));
        }
        throw e;
      });
      adjustCalls.forEach(function(fn){ p = p.then(fn); });
      return p;
    }).then(function(res){
      if(res && res.id) upsertInventory(res);
      return refetchStockAndMemos().then(function(){
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-inv-edit');
        O.wrote('fleet-stock-edit');
        redrawStock();
      });
    }).catch(function(e){ O.fail('Could not update stock item', e); return null; });
  });

  wrap('flSaveReceive', function(){
    var d = function(id){ return document.getElementById(id); };
    var memoId = typeof _receiveMemoId !== 'undefined' ? _receiveMemoId : null;
    if(memoId){
      var mo = listMemos().find(function(x){ return x && x.id === memoId; });
      if(!mo) return null;
      var date = d('receive-date') ? d('receive-date').value : O.today();
      var note = d('receive-note') ? d('receive-note').value.trim() : '';
      var wh = d('receive-location') ? normalizeWarehouse(d('receive-location').value) : 'tublamu';
      var parts = (mo.items || []).filter(function(it){ return (it.category || mo.memoType || 'parts') !== 'labor'; });
      var lines = [];
      parts.forEach(function(it, i){
        var qEl = d('recv-qty-' + i);
        var qty = Math.max(0, parseFloat(qEl && qEl.value) || 0);
        if(qty > 0 && it.id) lines.push({ line_id: it.id, qty: qty });
      });
      var body = { warehouse: wh, date: date, note: nullable(note), lines: lines };
      return O.queue(function(){
        return O.post('/v1/fleet/memos/' + enc(memoId) + '/receive', body);
      }).then(function(res){
        upsertMemo(res);
        return refetchStockAndMemos().then(function(){
          if(typeof _receiveMemoId !== 'undefined') _receiveMemoId = null;
          if(typeof window.closeModal === 'function') window.closeModal('fl-modal-receive');
          O.wrote('fleet-memo-receive');
          redrawStock();
          return res;
        });
      }).catch(function(e){ O.fail('Could not receive memo items', e); return null; });
    }

    var itemId = (typeof _receiveItemId !== 'undefined' && _receiveItemId) || (d('receive-item-sel') ? d('receive-item-sel').value : '');
    if(!itemId){ alert('กรุณาเลือกรายการ'); return null; }
    var qty = d('receive-qty') ? (parseFloat(d('receive-qty').value) || 0) : 0;
    if(qty <= 0){ alert('กรุณาระบุจำนวน'); return null; }
    var wh = d('receive-location') ? normalizeWarehouse(d('receive-location').value) : 'tublamu';
    var date = d('receive-date') ? d('receive-date').value : O.today();
    var note = d('receive-note') ? d('receive-note').value.trim() : '';
    return O.queue(function(){
      return O.post('/v1/fleet/stock-items/' + enc(itemId) + '/receive', toStockReceiveBody(wh, qty, date, note));
    }).then(function(res){
      upsertInventory(res);
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-receive');
      O.wrote('fleet-stock-receive');
      redrawStock();
      return res;
    }).catch(function(e){ O.fail('Could not receive stock', e); return null; });
  });

  wrap('flSaveTransfer', function(){
    var d = function(id){ return document.getElementById(id); };
    var id = typeof _transferItemId !== 'undefined' ? _transferItemId : null;
    if(!id) return null;
    var fromLoc = d('transfer-from') ? d('transfer-from').value : '';
    var toLoc = d('transfer-to') ? d('transfer-to').value : '';
    var qty = d('transfer-qty') ? (parseFloat(d('transfer-qty').value) || 0) : 0;
    var date = d('transfer-date') ? d('transfer-date').value : O.today();
    var note = d('transfer-note') ? d('transfer-note').value.trim() : '';
    if(!fromLoc || !toLoc || fromLoc === toLoc){ alert('กรุณาเลือกคลังต้นทางและปลายทางให้ถูกต้อง'); return null; }
    if(qty <= 0){ alert('กรุณาระบุจำนวน'); return null; }
    return O.queue(function(){
      return O.post('/v1/fleet/stock-items/' + enc(id) + '/transfer', toStockTransferBody(fromLoc, toLoc, qty, date, note));
    }).then(function(res){
      upsertInventory(res);
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-transfer');
      O.wrote('fleet-stock-transfer');
      redrawStock();
      return res;
    }).catch(function(e){ O.fail('Could not transfer stock', e); return null; });
  });

  wrap('flMaintAddPart', function(orig, jobId){
    var sel = document.getElementById('part-sel-' + jobId);
    var qtyEl = document.getElementById('part-qty-' + jobId);
    var whEl = document.getElementById('part-wh-' + jobId);
    var invId = sel ? sel.value : '';
    var qty = qtyEl ? (parseInt(qtyEl.value, 10) || 1) : 1;
    var wh = whEl ? normalizeWarehouse(whEl.value) : 'tublamu';
    if(!invId){ alert('กรุณาเลือกอะไหล่'); return null; }
    var jobs = typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT) ? FL_MAINT : [];
    var job = jobs.find(function(x){ return x && x.id === jobId; });
    var late = !!(job && job.status === 'done');
    var body = { item_id: invId, warehouse: wh, qty: qty };
    if(late) body.late_anyway = true;
    return O.queue(function(){
      return O.post('/v1/fleet/jobs/' + enc(jobId) + '/parts', body);
    }).then(function(res){
      if(res && res.item) upsertInventory(res.item);
      if(O.fleetJobs && typeof O.fleetJobs.load === 'function') return O.fleetJobs.load();
    }).then(function(){
      O.wrote('fleet-job-part-add');
      if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
      redrawStock();
    }).catch(function(e){ O.fail('Could not add part to job', e); return null; });
  });

  wrap('flMaintRemovePart', function(orig, jobId, idx){
    var jobs = typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT) ? FL_MAINT : [];
    var job = jobs.find(function(x){ return x && x.id === jobId; });
    var q = (job && job.status === 'done') ? '?late_anyway=true' : '';
    return O.queue(function(){
      return O.del('/v1/fleet/jobs/' + enc(jobId) + '/parts/' + enc(idx) + q);
    }).then(function(res){
      if(res && res.item) upsertInventory(res.item);
      if(O.fleetJobs && typeof O.fleetJobs.load === 'function') return O.fleetJobs.load();
    }).then(function(){
      O.wrote('fleet-job-part-remove');
      if(typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(jobId);
      redrawStock();
    }).catch(function(e){ O.fail('Could not remove part from job', e); return null; });
  });

  wrap('flConsumeSubmit', function(){
    var d = function(id){ return document.getElementById(id); };
    var itemId = d('flc-item') ? d('flc-item').value : '';
    var loc = d('flc-loc') ? d('flc-loc').value : 'คลัง Tub Lamu';
    var qty = d('flc-qty') ? Math.round(parseFloat(d('flc-qty').value) || 0) : 0;
    var boatId = d('flc-boat') ? d('flc-boat').value : '';
    var engVal = d('flc-eng') ? d('flc-eng').value : '';
    var date = d('flc-date') ? d('flc-date').value : O.today();
    var by = d('flc-by') ? d('flc-by').value.trim() : '';
    var note = d('flc-note') ? d('flc-note').value.trim() : '';
    if(!itemId){ alert('เลือกของที่จะเบิกก่อน'); return null; }
    if(qty < 1){ alert('ใส่จำนวนที่เบิก (อย่างน้อย 1)'); return null; }
    if(!boatId){ alert('เลือกเรือที่ใช้ของนี้'); return null; }

    var engSel = d('flc-eng');
    var engLabel = (engSel && engSel.selectedOptions && engSel.selectedOptions[0] && engVal) ? engSel.selectedOptions[0].textContent : '';
    var body = toConsumableBody({
      itemId: itemId,
      warehouse: loc,
      qty: qty,
      boatId: boatId,
      engineId: engVal || null,
      engineLabel: engLabel || null,
      date: date,
      by: by,
      note: note
    });

    return O.queue(function(){
      return O.post('/v1/fleet/consumables', body).catch(function(e){
        if(e && e.code === 'stock_short'){
          if(!confirm(e.message + '\n\nเบิกต่อหรือไม่?')) throw e;
          return O.post('/v1/fleet/consumables', Object.assign({}, body, { allow_negative: true }));
        }
        throw e;
      });
    }).then(function(res){
      return refetchStockAndMemos().then(function(){
        if(typeof window.flConsumeClose === 'function') window.flConsumeClose();
        O.wrote('fleet-consumable-create');
        redrawStock();
        return res;
      });
    }).catch(function(e){ O.fail('Could not record consumable draw', e); return null; });
  });

  wrap('flConsumeDelete', function(orig, id){
    if(!id) return null;
    if(!confirm('ลบรายการเบิกนี้และคืนยอดเข้าคลัง?')) return null;
    return O.queue(function(){
      return O.del('/v1/fleet/consumables/' + enc(id));
    }).then(function(){
      return refetchStockAndMemos().then(function(){
        O.wrote('fleet-consumable-void');
        redrawStock();
      });
    }).catch(function(e){ O.fail('Could not void consumable draw', e); return null; });
  });

  wrap('flSaveApprove', function(){
    var d = function(id){ return document.getElementById(id); };
    var id = typeof _approveMemoId !== 'undefined' ? _approveMemoId : null;
    if(!id) return null;
    var by = d('approve-by') ? d('approve-by').value.trim() : '';
    if(!by){ alert('กรุณาระบุชื่อผู้อนุมัติ'); return null; }
    var date = d('approve-date') ? d('approve-date').value : O.today();
    var note = d('approve-note') ? d('approve-note').value.trim() : '';
    var body = { approved_by: by, approved_date: date };
    if(note) body.note = note;
    return O.queue(function(){
      return O.post('/v1/fleet/memos/' + enc(id) + '/approve', body);
    }).then(function(res){
      upsertMemo(res);
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-approve');
      O.wrote('fleet-memo-approve');
      redrawStock();
      return res;
    }).catch(function(e){ O.fail('Could not approve memo', e); return null; });
  });

  wrap('flAdvanceMemo', function(orig, id){
    var m = listMemos().find(function(x){ return x && x.id === id; });
    if(!m) return null;
    if(m.status === 'pending_approval'){
      if(typeof window.flOpenApproveModal === 'function') window.flOpenApproveModal(id);
      return null;
    }
    var isLaborOnly = m.memoType === 'labor' || (m.memoType === 'mixed' && !(m.items || []).some(function(it){ return (it.category || 'parts') === 'parts'; }));
    if(m.status === 'approved'){
      if(isLaborOnly){
        return O.queue(function(){ return O.post('/v1/fleet/memos/' + enc(id) + '/pay', { paid_date: O.today() }); }).then(function(res){
          upsertMemo(res);
          O.wrote('fleet-memo-pay');
          redrawStock();
          return res;
        }).catch(function(e){ O.fail('Could not mark memo paid', e); return null; });
      }
      return O.queue(function(){ return O.post('/v1/fleet/memos/' + enc(id) + '/order', { ordered_date: O.today() }); }).then(function(res){
        upsertMemo(res);
        O.wrote('fleet-memo-order');
        redrawStock();
        return res;
      }).catch(function(e){ O.fail('Could not mark memo ordered', e); return null; });
    }
    if(m.status === 'ordered'){
      if(typeof window.flOpenReceiveMemo === 'function') window.flOpenReceiveMemo(id);
      return null;
    }
    if(m.status === 'received'){
      return O.queue(function(){ return O.post('/v1/fleet/memos/' + enc(id) + '/pay', { paid_date: O.today() }); }).then(function(res){
        upsertMemo(res);
        O.wrote('fleet-memo-pay');
        redrawStock();
        return res;
      }).catch(function(e){ O.fail('Could not mark memo paid', e); return null; });
    }
    return null;
  });

  wrap('memoShortClose', function(orig, moId){
    var m = listMemos().find(function(x){ return x && x.id === moId; });
    if(!m) return null;
    if(!confirm('ปิดใบ ' + m.no + ' ทั้งที่ของยังไม่ครบ (Short Close)?')) return null;
    return O.queue(function(){
      return O.post('/v1/fleet/memos/' + enc(moId) + '/short-close', {});
    }).then(function(res){
      upsertMemo(res);
      O.wrote('fleet-memo-short-close');
      redrawStock();
      return res;
    }).catch(function(e){ O.fail('Could not short-close memo', e); return null; });
  });

  wrap('flCancelMemo', function(orig, moId){
    var m = listMemos().find(function(x){ return x && x.id === moId; });
    if(!m) return null;
    var reason = prompt('เหตุผลในการยกเลิก Memo ' + (m.no || '') + ':');
    if(reason === null) return null;
    reason = text(reason);
    if(!reason){ alert('กรุณาระบุเหตุผลในการยกเลิก'); return null; }
    return O.queue(function(){
      return O.post('/v1/fleet/memos/' + enc(moId) + '/cancel', { reason: reason }).catch(function(e){
        if(e && e.code === 'stock_short'){
          if(!confirm(e.message + '\n\nยืนยันยกเลิกและให้คลังติดลบหรือไม่?')) throw e;
          return O.post('/v1/fleet/memos/' + enc(moId) + '/cancel', { reason: reason, allow_negative: true });
        }
        throw e;
      });
    }).then(function(res){
      upsertMemo(res);
      return refetchStockAndMemos().then(function(){
        O.wrote('fleet-memo-cancel');
        redrawStock();
        return res;
      });
    }).catch(function(e){ O.fail('Could not cancel memo', e); return null; });
  });

  O.onChange(function(change){
    if(!change) return;
    if(['fleet_stock', 'fleet_memo', 'fleet_consumable', 'fleet_job'].indexOf(change.entity_type) >= 0){
      state.loaded = false;
    }
  });

  var api = {
    load: function(){ return loadAll(true); },
    ensureLoaded: function(){ return loadAll(false); },
    refetch: refetchStockAndMemos,
    createStockItem: function(body){ return O.queue(function(){ return O.post('/v1/fleet/stock-items', toStockCreateBody(body)); }).then(function(r){ upsertInventory(r); return r; }); },
    patchStockItem: function(id, body, anyway){ return O.queue(function(){ return O.patch('/v1/fleet/stock-items/' + enc(id), toStockPatchBody(body, anyway)); }).then(function(r){ upsertInventory(r); return r; }); },
    receiveStock: function(id, wh, qty, date, note){ return O.queue(function(){ return O.post('/v1/fleet/stock-items/' + enc(id) + '/receive', toStockReceiveBody(wh, qty, date, note)); }).then(function(r){ upsertInventory(r); return r; }); },
    transferStock: function(id, from, to, qty, date, note){ return O.queue(function(){ return O.post('/v1/fleet/stock-items/' + enc(id) + '/transfer', toStockTransferBody(from, to, qty, date, note)); }).then(function(r){ upsertInventory(r); return r; }); },
    adjustStock: function(id, wh, qty, date, note){ return O.queue(function(){ return O.post('/v1/fleet/stock-items/' + enc(id) + '/adjust', toStockAdjustBody(wh, qty, date, note)); }).then(function(r){ upsertInventory(r); return r; }); },
    mergeStock: function(keepId, fromIds){ return O.queue(function(){ return O.post('/v1/fleet/stock-items/' + enc(keepId) + '/merge', { from_ids: fromIds }); }).then(function(r){ return refetchStockAndMemos().then(function(){ return r; }); }); },
    createMemo: function(body){ return O.queue(function(){ return O.post('/v1/fleet/memos', toMemoBody(body, false)); }).then(function(r){ upsertMemo(r); return r; }); },
    patchMemo: function(id, body){ return O.queue(function(){ return O.patch('/v1/fleet/memos/' + enc(id), toMemoBody(body, true)); }).then(function(r){ upsertMemo(r); return r; }); }
  };

  O.fleetStock = api;
  window.laOpsFleetStock = api;
  window.__laOpsFleetStockCompat = {
    normalizeWarehouse: normalizeWarehouse,
    fromServerStockItem: fromServerStockItem,
    fromServerConsumable: fromServerConsumable,
    fromServerMemo: fromServerMemo,
    toStockCreateBody: toStockCreateBody,
    toStockPatchBody: toStockPatchBody,
    toStockReceiveBody: toStockReceiveBody,
    toStockTransferBody: toStockTransferBody,
    toStockAdjustBody: toStockAdjustBody,
    toConsumableBody: toConsumableBody,
    toMemoBody: toMemoBody
  };

  if(enabled()) loadAll(false).catch(function(){});
})();
