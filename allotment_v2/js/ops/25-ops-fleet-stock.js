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
        minQty: st.min_qty != null ? num(st.min_qty) : null,   // the line's minimum (its own, else the item's): min_qty on the stock line
        minOwn: !!st.min_own,
        belowMin: st.below_min != null ? !!st.below_min : null  // min > 0 and qty < min, the server's word (faInvRows / faSpInvBlock)
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
      value: s.value != null ? num(s.value) : null,   // F4: quantity x cost, the server's
      belowMin: !!s.below_min,
      linesBelowMin: s.lines_below_min != null ? num(s.lines_below_min) : null,
      lineMins: s.line_mins ? clone(s.line_mins) : null,
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
      if(O.fleetKpis && res[0]) O.fleetKpis.put('stock', res[0].kpis);   // F4: the strip (its memos block too)
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

  /* legacy flConsumeCostOf: qty × unit cost worked out again in the browser. The server computes `cost` on each
     consumable (POST /v1/fleet/consumables), mapped above; a row from the server shows that cost, rounded to
     the baht as legacy's figure was. */
  wrap('flConsumeCostOf', function(orig, rec){
    if(rec && rec._fromOpsBackend && rec.cost != null && isFinite(rec.cost)) return Math.round(+rec.cost);
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flSaveAddStock', function(){
    var d = function(id){ return document.getElementById(id); };
    var name = d('add-inv-name') ? d('add-inv-name').value.trim() : '';
    if(!name){ alert('กรุณากรอกชื่ออะไหล่'); return null; }
    var body = toStockCreateBody({
      name: name,
      partNo: d('add-inv-partno') ? d('add-inv-partno').value.trim() : '',
      category: d('add-inv-cat') ? d('add-inv-cat').value : 'general',
      supplier: d('add-inv-supplier') ? d('add-inv-supplier').value.trim() : '',
      location: d('add-inv-location') ? d('add-inv-location').value : 'คลัง Tub Lamu',
      qty: d('add-inv-qty') ? (parseFloat(d('add-inv-qty').value) || 0) : 0,
      minQty: d('add-inv-min') ? (parseInt(d('add-inv-min').value, 10) || 0) : 0,
      unit: d('add-inv-unit') ? d('add-inv-unit').value.trim() : 'ชิ้น',
      cost: d('add-inv-cost') ? (parseFloat(d('add-inv-cost').value) || 0) : 0,
      note: d('add-inv-note-extra') ? d('add-inv-note-extra').value.trim() : ''
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
    var idEl = document.getElementById('inv-edit-id');
    var id = idEl ? (idEl.value || null) : null;
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
    var sel = document.getElementById('maint-inv-sel-' + jobId);
    var qtyEl = document.getElementById('maint-inv-qty-' + jobId);
    var whEl = document.getElementById('maint-inv-loc-' + jobId);
    // The picker shows a part label ("name · part no"); the screen maps it to the item id.
    var invId = sel ? ((window._maintInvLabelMap || {})[sel.value] || '') : '';
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

  /* Inventory "duplicate scan" merge (invDupMerge): legacy re-pointed memos/jobs and spliced the dropped items out of
     FL_INVENTORY in the browser (flSave is a no-op here), so a merge came back after a reload.  Same keep rule as legacy
     (most history, then most stock); the server moves stock, history and memo/job references (POST .../merge). */
  wrap('invDupMerge', function(orig, keyEnc){
    if(typeof laGuardEdit === 'function' && !laGuardEdit('fleet')) return null;
    var key = decodeURIComponent(keyEnc || '');
    var all = (typeof _invAll === 'function') ? _invAll() : [];
    var L = all.filter(function(x){ return _invKeyOf(x.name, x.partNo) === key; });
    if(L.length < 2){ if(typeof invDupOpen === 'function') invDupOpen(); return null; }
    var qty = function(x){ return x.totalQty != null ? x.totalQty : (x.qty || 0); };
    L = L.slice().sort(function(a, b){ return ((b.history || []).length - (a.history || []).length) || (qty(b) - qty(a)); });
    var keep = L[0], drop = L.slice(1);
    var totQ = L.reduce(function(a, x){ return a + qty(x); }, 0);
    if(!confirm('รวม "' + keep.name + '" ' + L.length + ' รายการเป็นรายการเดียว?\n\nยอดรวมหลังรวม ' + totQ + ' ' + (keep.unit || 'ชิ้น') + ' (เท่าเดิม ไม่มีของหาย)')) return null;
    return api.mergeStock(keep.id, drop.map(function(d){ return d.id; })).then(function(){
      O.wrote('fleet-stock-merge');
      if(typeof flShowToast === 'function') flShowToast('รวมแล้ว · ' + keep.name);
      redrawStock();
      if(typeof invDupOpen === 'function') invDupOpen();
    }).catch(function(e){ O.fail('Could not merge stock items', e); return null; });
  });

  /* Receive state and labour-only are the server's (fleet-memos.ts receiveState / laborOnly), served on the memo
     as receive_state and labor_only. A memo that did not come from the server keeps the legacy calculation. */
  wrap('memoRecvState', function(orig, m){
    if(m && m._fromOpsBackend && m.receiveState) return clone(m.receiveState);
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  wrap('flwMemoLabour', function(orig, mo){
    if(mo && mo._fromOpsBackend && mo.receiveState) return !!mo.laborOnly;
    return orig.apply(this, [].slice.call(arguments, 1));
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

  /* legacy moLiveSave (05-fleet.js): the memo detail's live edit of its lines. Same checks and toasts, then
     PATCH /v1/fleet/memos/{id} {lines}. The totals, discount and VAT are the server's (computed from the lines), so the
     browser's own sum is not sent. The edit stays open when the server refuses (for example a line with stock received). */
  wrap('moLiveSave', function(){
    var memos = listMemos();
    var liveId = typeof _moLiveId !== 'undefined' ? _moLiveId : null;
    var mo = memos.find(function(x){ return x && x.id === liveId; });
    if(!mo) return null;
    if(mo.status === 'paid' || mo.status === 'cancelled'){
      if(typeof window.flShowToast === 'function') window.flShowToast('MO สถานะนี้แก้ไม่ได้', 'error');
      _moLiveId = null; return null;
    }
    var live = typeof _moLiveItems !== 'undefined' && Array.isArray(_moLiveItems) ? _moLiveItems : [];
    var clean = live.filter(function(it){ return String(it.name || '').trim(); });
    if(!clean.length){
      if(typeof window.flShowToast === 'function') window.flShowToast('ต้องมีอย่างน้อย 1 รายการ', 'error');
      return null;
    }
    var lines = toMemoBody({ items: clean, memoType: mo.memoType }, true).lines;
    return O.queue(function(){
      return O.patch('/v1/fleet/memos/' + enc(mo.id), { lines: lines });
    }).then(function(res){
      upsertMemo(res);
      var id = mo.id;
      _moLiveId = null; _moLiveItems = [];
      O.wrote('fleet-memo-edit');
      if(typeof window.flShowToast === 'function') window.flShowToast('บันทึกรายการแล้ว');
      try{ if(mo.maintId && typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(mo.maintId); }catch(_){}
      try{ if(typeof window.flRenderMemos === 'function') window.flRenderMemos(); }catch(_){}
      if(typeof window.flViewMemo === 'function') window.flViewMemo(id);
      return res;
    }).catch(function(e){ O.fail('Could not save the memo lines', e); return null; });
  });

  /* legacy flSaveMemo (05-fleet.js): the "create memo" / "edit memo" form. The old code built the memo in
     FL_MEMOS and flSave() (a no-op in ops), so a new memo or an edit was lost on reload; it also worked out the
     totals and auto-registered stock items in the browser. Now POST /v1/fleet/memos (or PATCH for an edit):
     the totals, the status (pending_approval, step 1), the stock auto-register and the job / project log lines are the
     server's; the boat of a memo made from a job or project is the server's too when none is sent. Same checks and
     toasts as legacy; the form stays open when the server refuses (for example a memo number already used). */
  wrap('flSaveMemo', function(){
    var el = function(id){ return document.getElementById(id); };
    var val = function(id){ var e = el(id); return e ? e.value : ''; };
    var subject = val('memo-subject').trim();
    if(!subject){ alert('กรุณากรอกเรื่อง'); return null; }
    var memoDate = val('memo-date') || O.today();
    var editId = typeof _memoEditId !== 'undefined' ? _memoEditId : null;
    var maintId = typeof _memoMaintId !== 'undefined' ? _memoMaintId : null;
    var projectId = typeof _memoProjectId !== 'undefined' ? _memoProjectId : null;
    var scope = (typeof _memoScope !== 'undefined' && _memoScope) || 'vessel';
    var memoType = (typeof _memoType !== 'undefined' && _memoType) || 'parts';
    var items = typeof _memoItems !== 'undefined' && Array.isArray(_memoItems) ? _memoItems.slice() : [];
    var vatBox = el('memo-vat-enabled');
    var vatEnabled = !vatBox || vatBox.checked !== false;
    var vatRate = vatEnabled ? (parseFloat(val('memo-vat-rate')) || 0) : 0;
    var memos = listMemos();
    var ex = editId ? memos.find(function(x){ return x && x.id === editId; }) : null;
    var jobs = typeof FL_MAINT !== 'undefined' && Array.isArray(FL_MAINT) ? FL_MAINT : [];
    var projs = typeof FL_PROJECTS !== 'undefined' && Array.isArray(FL_PROJECTS) ? FL_PROJECTS : [];
    var job = maintId ? jobs.find(function(x){ return x && x.id === maintId; }) : null;
    var proj = projectId ? projs.find(function(x){ return x && x.id === projectId; }) : null;
    var d = {
      title: subject,
      memoType: memoType,
      scope: ex ? (scope || ex.scope) : scope,
      generalCategory: scope === 'general' ? val('memo-general-cat') : null,
      to: val('memo-to'), from: val('memo-from'), proposer: val('memo-proposer'),
      supplier: val('memo-supplier').trim(), note: val('memo-note').trim(),
      memoDate: memoDate,
      vatEnabled: vatEnabled, vatRate: vatRate,
      discountPct: parseFloat(val('memo-discount-pct')) || 0,
      discountAmt: parseFloat(val('memo-discount-amt')) || 0,
      items: items
    };
    if(ex){
      d.boatId = ex.boatId;
      d.maintId = ex.maintId;
      d.projectId = ex.projectId;
      d.cc = ex.cc; d.refNote = ex.refNote;
    } else {
      d.boatId = scope === 'general' ? null : ((job && job.boatId) || (proj && proj.boatId) || null);
      d.maintId = maintId;
      d.projectId = projectId || null;
      // the next number, as legacy (highest MO-n + 1); the server refuses a number already used
      var top = 0;
      memos.forEach(function(m){ var n = parseInt(String(m && m.no || '').replace(/^MO-/, ''), 10) || 0; if(n > top) top = n; });
      d.no = 'MO-' + String(top + 1).padStart(3, '0');
    }
    var body = toMemoBody(d, !!ex);
    return O.queue(function(){
      return ex ? O.patch('/v1/fleet/memos/' + enc(ex.id), body) : O.post('/v1/fleet/memos', body);
    }).then(function(res){
      var saved = upsertMemo(res);
      // stock items auto-registered by the server, and the job / project log lines it wrote
      var tasks = [refetchStockAndMemos()];
      if(O.fleetJobs && typeof O.fleetJobs.load === 'function') tasks.push(O.fleetJobs.load().catch(function(){}));
      if(O.fleetDaily && typeof O.fleetDaily.load === 'function') tasks.push(O.fleetDaily.load().catch(function(){}));
      return Promise.all(tasks).then(function(){ return saved; });
    }).then(function(saved){
      O.wrote(ex ? 'fleet-memo-edit' : 'fleet-memo-create');
      var mid = saved.maintId, pid = saved.projectId;
      var total = Number(saved.amount || 0);
      if(ex){
        _memoEditId = null; _memoProjectId = null;
        var t = el('memo-modal-title'); if(t) t.textContent = 'สร้าง Memo';
        var sb = el('memo-save-btn'); if(sb) sb.textContent = 'สร้าง Memo';
        if(typeof window.closeModal === 'function') window.closeModal('fl-modal-memo');
        if(mid && typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(mid);
        if(pid && typeof window.flRenderProjects === 'function'){ _selProjId = pid; window.flRenderProjects(); }
        if(typeof window.flShowToast === 'function') window.flShowToast('บันทึกการแก้ไข Memo แล้ว');
        if(typeof window.flViewMemo === 'function') window.flViewMemo(saved.id);
        return saved;
      }
      _memoProjectId = null;
      if(typeof window.closeModal === 'function') window.closeModal('fl-modal-memo');
      if(maintId && typeof window.flRenderMaintDetail === 'function') window.flRenderMaintDetail(maintId);
      if(pid && typeof window.flRenderProjects === 'function'){
        _selProjId = pid;
        window.flRenderProjects();
        if(typeof window.flShowToast === 'function') window.flShowToast('Memo ' + saved.no + ' added to project');
      }
      var memoTab = document.querySelector('.inv-tab:nth-child(2)');
      var stockTab = el('inv-tab-stock');
      if(memoTab && stockTab && stockTab.style.display !== 'none' && typeof window.invSwitchTab === 'function') window.invSwitchTab('memo', memoTab);
      if(typeof window.flRenderInventory === 'function') window.flRenderInventory();
      if(typeof window.flShowToast === 'function') window.flShowToast('สร้าง ' + saved.no + ' เรียบร้อย · ฿' + total.toLocaleString());
      return saved;
    }).catch(function(e){
      // F4: 409 part_no_required · the server's own text, then the person picks the part number (76-ops-fleet-kpis.js)
      if(e && e.code === 'part_no_required' && typeof window.flMemoPartNoPick === 'function'){ window.flMemoPartNoPick(e); return null; }
      O.fail(ex ? 'Could not save the memo' : 'Could not create the memo', e); return null;
    });
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
