// os_repo.js — reversible blob <-> operation_schemas mapping engine.
// Pure functions, DB-independent. Driven entirely by field_mapping.json.
//
//   decomposeBlob(blob)      -> { [table]: rows[] }   (app_state JSON  -> relational rows)
//   assembleBlob(tablesData) -> blob                  (relational rows -> app_state JSON)
//
// Reverse-transform rules implemented (see field_mapping_README.md):
//   1. rename/case      : real key comes from `source` (camelCase), not the lowercased column.
//   2. nested un-flatten: dotted source paths (e.g. companyInfo.legalName, trips[].pax.ad_fr) re-nest.
//   3. arrays -> child tables (parent__field): one row/element, order via idx, link via <parent>_id.
//   4. keyed maps -> child/top tables: original key in `key` column.
//   5. json_text        : JSON.parse on read / JSON.stringify on write.
// Synthetic columns (idx, row_pk, <parent>_id) are generated here and dropped when rebuilding the blob.

'use strict';
const MAP = require('./field_mapping.json'); // { table: { col: { source, kind, db_type } } }

// ---------- small path helpers ----------
function arraySegs(src) {                 // ["repairHistory","assets"] for "repairHistory[].assets[] ..."
  const out = []; const re = /([A-Za-z0-9_$]+)\[\]/g; let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}
function elemPath(src) {                   // path within element/value, AFTER the last "[]." or "[key]." -> keys[], or null
  const a = src.lastIndexOf('[].');
  const b = src.lastIndexOf('[key].');
  let i, cut;
  if (b > a) { i = b; cut = 6; } else { i = a; cut = 3; }
  if (i < 0) return null;
  const rest = src.slice(i + cut).trim();
  if (!rest || rest.startsWith('(')) return null;   // "...[] (element)" -> array-of-scalars
  return rest.split('.');
}
function topPath(src) { return src.split('.'); }     // top-level parent col: "companyInfo.legalName" -> [companyInfo,legalName]
function setPath(obj, keys, val) {
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) { const k = keys[i]; if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
  o[keys[keys.length - 1]] = val;
}
function getPath(obj, keys) {
  let o = obj;
  for (const k of keys) { if (o == null) return undefined; o = o[k]; }
  return o;
}
function reMapKeyName(src) { const m = /^(.*?) map key/.exec(src); return m ? m[1].trim() : null; }
// Real (case-correct) blob field name for a child table, read from its columns' sources
// (the table name is lowercased, so byRoute -> "byroute" etc. — derive from source instead).
function lastPathSeg(path) { const s = String(path).split('.').pop(); return s.replace(/\[key\]$/, '').replace(/\[\]$/, ''); }
function childFieldFromCols(cols) {
  for (const info of Object.values(cols)) {                                   // keyed map: "(map key of PATH)"
    if (info.kind === 'map_key') { const m = /map key of (.+?)\)\s*$/.exec(info.source); if (m) return lastPathSeg(m[1]); }
  }
  for (const info of Object.values(cols)) {                                   // array: "position in PATH[]" / "PATH[] (element)"
    if (info.kind === 'synthetic' && /position in/.test(info.source)) { const m = /position in (.+)$/.exec(info.source); if (m) return lastPathSeg(m[1].trim()); }
    if (info.kind === 'array_scalar') { const m = /^(.+?)\[\]\s*\(element\)/.exec(info.source); if (m) return lastPathSeg(m[1] + '[]'); }
  }
  return null;
}

// ---------- build a plan from the mapping (once) ----------
function buildPlan() {
  const plan = {};
  for (const table of Object.keys(MAP)) {
    const cols = MAP[table];
    const isChild = table.includes('__');
    const p = { table, isChild, dataCols: [], pkCol: null, fkCol: null, idxCol: null, rowPkCol: null,
                keyCol: null, valueCol: null, appKey: null, field: null, parentTable: null,
                container: null, elementScalar: null, isMap: false, isScalarsTable: false };
    for (const [col, info] of Object.entries(cols)) {
      const { source, kind } = info;
      switch (kind) {
        case 'pk': p.pkCol = col; break;
        case 'synthetic-pk': p.rowPkCol = col; break;
        case 'fk': p.fkCol = col; break;
        case 'synthetic': if (/position in/.test(source)) p.idxCol = col; break;
        case 'map_key': p.keyCol = col; p.isMap = true; if (/top-level key/.test(source)) p.isScalarsTable = true; break;
        case 'map_value': p.valueCol = col; break;
        case 'map_value_json': p.valueCol = col; p.valueJson = true; break;   // whole map value stored as JSON text (open-ended/object values → lossless)
        case 'array_scalar': p.elementScalar = col; p.dataCols.push({ col, kind, source, path: null }); break;
        case 'scalar':
        case 'json_text': {
          const hasElem = source.includes('[].') || source.includes('[key].');
          const path = hasElem ? elemPath(source) : topPath(source);
          p.dataCols.push({ col, kind, source, path });
          break;
        }
        default: break;
      }
    }
    // field name (for children) + appKey (for top-level)
    const anySrc = (Object.values(cols).find(i => /\[\]/.test(i.source)) || {}).source
      || (Object.values(cols).find(i => i.kind === 'map_key') || {}).source
      || '';
    if (isChild) {
      const segs = arraySegs(anySrc);
      p.field = segs.length ? segs[segs.length - 1] : (childFieldFromCols(cols) || table.split('__').pop());
      p.parentTable = table.split('__').slice(0, -1).join('__');
      p.container = p.isMap ? 'map' : 'array';
    } else {
      if (p.isScalarsTable) { p.container = 'scalars'; }                 // app_meta -> spreads to top-level keys
      else if (p.isMap) { p.container = 'map'; p.appKey = reMapKeyName(anySrc) || table; }
      else { p.container = 'array'; p.appKey = table; }
    }
    plan[table] = p;
  }
  // children grouped by parent
  const childrenOf = {};
  for (const t of Object.keys(plan)) { const p = plan[t]; if (p.isChild) (childrenOf[p.parentTable] ||= []).push(t); }
  return { plan, childrenOf };
}
const { plan: PLAN, childrenOf: CHILDREN } = buildPlan();

// ---------- fleet_daily__trips special-case ----------
// Per-boat trips (fleet_daily[day][boat].trips[tripKey]) are 3 levels of open-ended maps — beyond the
// generic engine. Stored as one row per (day, boat, tripKey) with the whole trip value as JSON: lossless
// for any boat/engine/field, past or future. (Replaces the old fixed engines_e* column scheme, which
// silently dropped trips for engines that weren't in the generated column list.)
const FD_TRIPS = 'fleet_daily__trips';
// ---------- fleet_daily__boat special-case (2026-08) ----------
// Same trap as the old engines_e* scheme, one level up: the generated mapping gave fleet_daily one
// column per (boat, field) that happened to exist in the snapshot — b2_fuel, b10_fuel, b6_fuel,
// b13_fuel, b12_fuel, b10_paxactual, b2_paxactual. Any boat outside that list lost its litres on
// every save (its engine hours survived, because trips already had this fix), and b12 lost paxActual.
// One row per (day, boat) with every non-trips field as JSON: lossless for any boat, past or future.
// The old columns are LEFT IN PLACE and still written — they now merely duplicate what this table
// carries, so nothing depends on a migration having run before the first save.
const FD_BOAT = 'fleet_daily__boat';
function fleetDailyAssembleFix(blob, tablesData) {
  const fd = blob.fleet_daily; if (!fd || typeof fd !== 'object') return;
  const idToDay = {}; for (const r of (tablesData.fleet_daily || [])) idToDay[r.id] = r.key;
  for (const day of Object.values(fd)) { if (day && typeof day === 'object') { delete day.trips; delete day.boats; } }   // drop the bogus merged day-level keys (generic artifact)
  for (const row of (tablesData[FD_BOAT] || [])) {                     // per-boat scalars · merged, never replacing
    const day = idToDay[row.fleet_daily_id]; if (day == null || row.key == null) continue;
    const v = safeParse(row.value); if (!v || typeof v !== 'object') continue;
    Object.assign(((fd[day] ||= {})[row.key] ||= {}), v);
  }
  for (const row of (tablesData[FD_TRIPS] || [])) {
    const day = idToDay[row.fleet_daily_id]; if (day == null || !row.boat) continue;
    const b = ((fd[day] ||= {})[row.boat] ||= {});
    (b.trips ||= {})[row.key] = safeParse(row.value);
  }
}
function fleetDailyDecompose(blob, out) {
  out[FD_TRIPS] = []; out[FD_BOAT] = [];
  const fd = blob.fleet_daily; if (!fd || typeof fd !== 'object') return;
  for (const [day, dayObj] of Object.entries(fd)) {
    if (!dayObj || typeof dayObj !== 'object') continue;
    for (const [boatId, bObj] of Object.entries(dayObj)) {
      if (!bObj || typeof bObj !== 'object') continue;
      const scal = {}; let hasScal = false;                            // ทุกฟิลด์ของเรือลำนั้น ยกเว้น trips ที่มีตารางของตัวเองอยู่แล้ว
      for (const [k, v] of Object.entries(bObj)) { if (k === 'trips' || v === undefined) continue; scal[k] = v; hasScal = true; }
      if (hasScal) out[FD_BOAT].push({ fleet_daily_id: day, key: boatId,
                                       value: JSON.stringify(scal), row_pk: rowPk(FD_BOAT) });
      if (!bObj.trips) continue;
      for (const [tripKey, trip] of Object.entries(bObj.trips)) {
        out[FD_TRIPS].push({ fleet_daily_id: day, boat: boatId, key: tripKey,
                             value: JSON.stringify(trip), row_pk: rowPk(FD_TRIPS) });
      }
    }
  }
}

// ---------- trips__boat special-case (2026-08) ----------
// Boat Operation deployments live in trips[date][boatId] = {route,type,booked,charterBookingId,…} —
// an open-ended boat map that the generated mapping flattened into one fixed column triple per boat
// that happened to exist when it was written (b1_route … b15_booked). Any boat added AFTER that had
// nowhere to land, so decomposeBlob dropped its deployment on every save: the boat looked assigned in
// Boat Operation, then vanished on the next /api/load, the route never gained an allotment, and the
// program could not be booked. Hit for real with Tri Star 01 (b1784877193883), the Ranong charter that
// runs the Myanmar day trips (Se La Va · Nyaung Oo Phee).
// Same fix as fleet_daily__boat: one row per (date, boat) with the whole op object as JSON — lossless
// for any boat and any field, past or future. The old b*_ columns are LEFT IN PLACE and still written,
// so nothing depends on the DDL having run before the first save.
const TRIPS_BOAT = 'trips__boat';
function tripsAssembleFix(blob, tablesData) {
  const tp = blob.trips; if (!tp || typeof tp !== 'object') return;
  for (const day of Object.values(tp)) { if (day && typeof day === 'object') delete day.boats; }   // bogus merged day-level key (generic artifact)
  for (const row of (tablesData[TRIPS_BOAT] || [])) {
    if (row.trips_id == null || row.key == null) continue;
    const v = safeParse(row.value); if (!v || typeof v !== 'object') continue;
    Object.assign(((tp[row.trips_id] ||= {})[row.key] ||= {}), v);
  }
}
function tripsDecompose(blob, out) {
  out[TRIPS_BOAT] = [];
  const tp = blob.trips; if (!tp || typeof tp !== 'object') return;
  for (const [day, dayObj] of Object.entries(tp)) {
    if (!dayObj || typeof dayObj !== 'object') continue;
    for (const [boatId, op] of Object.entries(dayObj)) {
      if (!op || typeof op !== 'object') continue;
      out[TRIPS_BOAT].push({ trips_id: day, key: boatId,
                             value: JSON.stringify(op), row_pk: rowPk(TRIPS_BOAT) });
    }
  }
}

// ---------- ASSEMBLE: rows -> blob ----------
function buildElement(p, row) {
  if (p.elementScalar) return row[p.elementScalar];         // array-of-scalars element
  const el = {};
  for (const dc of p.dataCols) {
    const v = row[dc.col];
    if (v === undefined || v === null) continue;   // skip SQL NULLs: all-null flattened cols must not fabricate {a:null,...} where the blob had null/missing
    const val = dc.kind === 'json_text' && typeof v === 'string' ? safeParse(v) : v;
    setPath(el, dc.path, val);
  }
  return el;
}
function safeParse(s) { try { return JSON.parse(s); } catch (_) { return s; } }

function attachChildren(table, parentEl, parentPkVal, tablesData, pkIndex) {
  for (const childT of (CHILDREN[table] || [])) {
    const cp = PLAN[childT];
    const rows = (tablesData[childT] || []).filter(r => String(r[cp.fkCol]) === String(parentPkVal));
    rows.sort((a, b) => (a[cp.idxCol] ?? 0) - (b[cp.idxCol] ?? 0));
    if (!rows.length) continue;                       // no rows -> don't fabricate an empty nested field
    if (cp.container === 'map') {
      const mapObj = {};
      for (const r of rows) {
        const val = cp.valueCol ? (cp.valueJson ? safeParse(r[cp.valueCol]) : r[cp.valueCol]) : buildElement(cp, r);
        mapObj[r[cp.keyCol]] = val;
        const pk = cp.rowPkCol ? r[cp.rowPkCol] : r[cp.pkCol];
        if (pk != null) { pkIndex[childT] ??= {}; pkIndex[childT][pk] = val;
          if (!cp.valueCol && val && typeof val === 'object') attachChildren(childT, val, pk, tablesData, pkIndex); }  // recurse into map-value grandchildren
      }
      parentEl[cp.field] = mapObj;
    } else {
      const arr = [];
      for (const r of rows) {
        const el = buildElement(cp, r);
        arr.push(el);
        const key = cp.rowPkCol ? r[cp.rowPkCol] : r[cp.pkCol];
        if (key != null) { pkIndex[childT] ??= {}; pkIndex[childT][key] = el; attachChildren(childT, el, key, tablesData, pkIndex); }
      }
      parentEl[cp.field] = arr;
    }
  }
}

function assembleBlob(tablesData) {
  const blob = {};
  const pkIndex = {};
  for (const table of Object.keys(PLAN)) {
    const p = PLAN[table];
    if (p.isChild) continue;
    const rows = tablesData[table] || [];
    if (p.container === 'scalars') {                 // app_meta -> top-level scalar keys
      for (const r of rows) {
        const v = p.valueCol ? (p.valueJson ? safeParse(r[p.valueCol]) : r[p.valueCol]) : undefined;
        blob[r[p.keyCol]] = v;
      }
    } else if (p.container === 'map') {              // top-level keyed map
      const obj = {};
      for (const r of rows) {
        const val = p.valueCol ? (p.valueJson ? safeParse(r[p.valueCol]) : r[p.valueCol]) : buildElement(p, r);
        obj[r[p.keyCol]] = val;
        if (!p.valueCol) { const key = p.pkCol ? r[p.pkCol] : r[p.keyCol]; pkIndex[table] ??= {}; pkIndex[table][key] = val; attachChildren(table, val, key, tablesData, pkIndex); }
      }
      blob[p.appKey] = obj;
    } else {                                         // top-level array
      const arr = [];
      for (const r of rows) {
        const el = buildElement(p, r);
        const key = r[p.pkCol];
        if (key != null && el && typeof el === 'object') el.id = key;   // pk holds the record's real id
        arr.push(el);
        pkIndex[table] ??= {}; pkIndex[table][key] = el;
        attachChildren(table, el, key, tablesData, pkIndex);
      }
      blob[p.appKey] = arr;
    }
  }
  fleetDailyAssembleFix(blob, tablesData);   // rebuild the boat dimension the mapping dropped
  tripsAssembleFix(blob, tablesData);        // §openMap · เรือที่เพิ่มมาทีหลัง ไม่มีคอลัมน์ b*_ ของตัวเอง
  return blob;
}

// ---------- DECOMPOSE: blob -> rows ----------
let _rk = 0;
function rowPk(table) { return table + ':' + (Date.now().toString(36)) + (++_rk).toString(36); }

function rowFromElement(p, el) {
  const row = {};
  for (const dc of p.dataCols) {
    if (p.elementScalar && dc.col === p.elementScalar) { row[dc.col] = el; continue; }
    const v = getPath(el, dc.path);
    if (v === undefined) continue;
    row[dc.col] = dc.kind === 'json_text' && v != null && typeof v !== 'string' ? JSON.stringify(v) : v;
  }
  return row;
}

function decomposeChildren(table, parentEl, parentPkVal, out) {
  for (const childT of (CHILDREN[table] || [])) {
    const cp = PLAN[childT];
    out[childT] ||= [];
    const container = parentEl[cp.field];
    if (container == null) continue;
    if (cp.container === 'map') {
      for (const [k, val] of Object.entries(container)) {
        const row = cp.valueCol ? {} : rowFromElement(cp, val);
        row[cp.fkCol] = parentPkVal; row[cp.keyCol] = k;
        if (cp.valueCol) row[cp.valueCol] = cp.valueJson ? (val === undefined ? null : JSON.stringify(val)) : val;
        const pk = rowPk(childT); if (cp.rowPkCol) row[cp.rowPkCol] = pk;
        out[childT].push(row);
        if (!cp.valueCol && val && typeof val === 'object') decomposeChildren(childT, val, pk, out);  // recurse into map-value grandchildren
      }
    } else {
      const arr = Array.isArray(container) ? container : [];
      arr.forEach((el, idx) => {
        const row = cp.elementScalar ? { [cp.elementScalar]: el } : rowFromElement(cp, el);
        row[cp.fkCol] = parentPkVal; if (cp.idxCol) row[cp.idxCol] = idx;
        const pk = rowPk(childT); if (cp.rowPkCol) row[cp.rowPkCol] = pk;
        out[childT].push(row);
        if (!cp.elementScalar) decomposeChildren(childT, el, pk, out);
      });
    }
  }
}

function decomposeBlob(blob) {
  const out = {};
  for (const table of Object.keys(PLAN)) { if (!PLAN[table].isChild) out[table] = []; }
  for (const table of Object.keys(PLAN)) {
    const p = PLAN[table]; if (p.isChild) continue;
    if (p.container === 'scalars') {
      for (const [k, v] of Object.entries(blob)) {
        if (!isScalarTop(k, blob)) continue; // only leaf top-level values belong here
        const sv = p.valueJson ? (v === undefined ? null : JSON.stringify(v)) : v;
        out[table].push({ [p.keyCol]: k, ...(p.valueCol ? { [p.valueCol]: sv } : {}) });
      }
    } else if (p.container === 'map') {
      const obj = blob[p.appKey]; if (obj == null || typeof obj !== 'object') continue;
      for (const [k, val] of Object.entries(obj)) {
        const row = p.valueCol ? {} : rowFromElement(p, val);
        row[p.keyCol] = k;
        if (p.valueCol) row[p.valueCol] = p.valueJson ? (val === undefined ? null : JSON.stringify(val)) : val;
        if (p.pkCol) row[p.pkCol] = String(k);          // map id is generated; use key (deterministic, unique per map)
        out[table].push(row);
        if (!p.valueCol) decomposeChildren(table, val, String(k), out);
      }
    } else {
      const arr = blob[p.appKey]; if (!Array.isArray(arr)) continue;
      for (const el of arr) {
        const row = rowFromElement(p, el);
        const pk = el && el.id != null ? el.id : rowPk(table);   // record id (generated if absent)
        if (p.pkCol) row[p.pkCol] = pk;
        out[table].push(row);
        decomposeChildren(table, el, pk, out);
      }
    }
  }
  fleetDailyDecompose(blob, out);   // emit one row per (day, boat, trip) — overrides the generic (which can't see boats)
  tripsDecompose(blob, out);        // one row per (date, boat) — carries boats the b*_ columns can't
  return out;
}

// which top-level blob keys are the "scalars" (app_meta) — leaves that are not owned by an array/map table
const OWNED_TOP = new Set(Object.values(PLAN).filter(p => !p.isChild && p.appKey).map(p => p.appKey));
function isScalarTop(k, blob) {
  if (OWNED_TOP.has(k)) return false;
  const v = blob[k];
  return v == null || typeof v !== 'object';   // scalar / null leaf
}
module.exports = { assembleBlob, decomposeBlob, _plan: PLAN, _children: CHILDREN };
