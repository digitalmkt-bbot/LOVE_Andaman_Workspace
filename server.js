// LOVE Andaman · server for Railway: static app + login (users) + cloud sync with overwrite-guard.
// Data is one JSON blob (loveandaman_v2) in Postgres, versioned (optimistic concurrency).
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

let Pool = null;
try {
  const pg = require('pg'); Pool = pg.Pool;
  pg.types.setTypeParser(20, v => v == null ? null : Number(v));   // int8 -> Number (default is string → the app string-concatenates caps/pax)
} catch(e){ console.warn('[db] pg not installed'); }

const ROOT   = __dirname;
const PORT   = process.env.PORT || 3000;
const DB_URL = process.env.DATABASE_URL || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'); // set SESSION_SECRET to keep logins across redeploys
const ADMIN_USER = (process.env.ADMIN_USER || '').trim();
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const STATE_KEY  = 'loveandaman_v2';
const SESS_DAYS  = 30;   // session cookie lifetime · long so refresh/redeploy never forces re-login

// ── relational backend (DATA_BACKEND=relational): app_state blob is assembled from / decomposed
//    into the operation_schemas tables via os_repo. blob mode (default) is unchanged. ──
const DATA_BACKEND = (process.env.DATA_BACKEND || 'blob').toLowerCase();
const OS_SCHEMA = 'operation_schemas';
// users auth table (2026-07-10 · feat/validation-deprecate-blob): relational backend keeps it in
// operation_schemas (migrated via os-backend/scripts/migrate_users_to_os_schema.js — run BEFORE
// deploying this); blob mode keeps the legacy unqualified `users` (resolves via the role's search_path,
// e.g. allotment.users on prod). app_state + attachments stay unqualified in both modes.
const USERS_T = DATA_BACKEND === 'relational' ? OS_SCHEMA + '.users' : 'users';
// os_repo mapping engine + schema model — used by the relational save path AND the per-entity REST API.
const osRepo  = require('./os-backend/src/mapping/os_repo.js');
const osModel = require('./os-backend/src/mapping/operation_schemas_model.json');
const OS_TABLES = Object.keys(osModel);
const OS_COLS = {};
for (const t of OS_TABLES) OS_COLS[t] = osModel[t].columns.map(c => c.name);
const _osDepth = t => t.split('__').length - 1;                       // children deeper than parents
const OS_ASC  = [...OS_TABLES].sort((a, b) => _osDepth(a) - _osDepth(b));   // parents first (insert)
const OS_DESC = [...OS_TABLES].sort((a, b) => _osDepth(b) - _osDepth(a));   // children first (delete)
const qic = id => '"' + String(id).replace(/"/g, '""') + '"';
const fqt = t => qic(OS_SCHEMA) + '.' + qic(t);

// ── save-safety guard (2026-07-10 · feat/validation-deprecate-blob) ──────────────────────────────
// A stale / old whole-blob client can post data whose collections are empty or drastically shorter than
// what the DB already holds; the relational save then DELETEs the table and re-INSERTs ~nothing → records
// silently revert to DEFAULT_* seeds (e.g. boat pier, agent name). This guard refuses any save that would
// wipe or heavily shrink a top-level table that currently has data. Protects every main entity table.
// Bypass an INTENTIONAL bulk clear with payload.confirm (whole-blob) / op.confirm (per-entity putall).
const OS_TOP = OS_TABLES.filter(t => !t.includes('__') && t !== 'app_meta');   // all main entity tables
const GUARD_MINROWS = 5, GUARD_LOSS_ABS = 20, GUARD_LOSS_FRAC = 0.5;
function shrinkGuard(curCount, incCount){                                       // -> [{table,from,to}] that would be wiped/shrunk
  const bad = [];
  for (const t of OS_TOP){
    const cur = curCount[t] || 0, inc = incCount[t] || 0;
    if (cur >= GUARD_MINROWS && (inc === 0 || (cur - inc >= GUARD_LOSS_ABS && inc < cur * GUARD_LOSS_FRAC)))
      bad.push({ table: t, from: cur, to: inc });
  }
  return bad;
}
function shrinkErr(bad){ const e = new Error('SHRINK_GUARD'); e.code = 'SHRINK_GUARD'; e.detail = bad; return e; }

async function relLoad() {                                           // operation_schemas -> blob (parallel)
  const results = await Promise.all(OS_TABLES.map(t => pool.query(`SELECT * FROM ${fqt(t)}`)));
  const data = {};
  OS_TABLES.forEach((t, i) => { data[t] = results[i].rows; });
  return osRepo.assembleBlob(data);
}
// read-modify-write the whole schema in ONE transaction, serialized by an advisory lock (no lost saves).
// ponytail: full DELETE+INSERT of all tables per save; fine at this data size, switch to targeted upserts if slow.
async function relApplyAndSave(payload, username, base) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(918273645)');
    const vr = await client.query('SELECT version FROM app_state WHERE id=$1', [STATE_KEY]);
    const curVer = vr.rows[0] ? vr.rows[0].version : 0;
    const behind = (base !== -1 && base < curVer);
    const data = {};
    for (const t of OS_TABLES) { const r = await client.query(`SELECT * FROM ${fqt(t)}`); data[t] = r.rows; }
    let blob = osRepo.assembleBlob(data);
    if (payload.full && typeof payload.full === 'string') blob = JSON.parse(payload.full);
    else applyDiff(blob, payload.diff || {});
    const tables = osRepo.decomposeBlob(blob);
    if (!payload.confirm) {                                            // save-safety: refuse a stale/whole-blob overwrite that would wipe existing data
      const curCount = {}, incCount = {};
      for (const t of OS_TOP) { curCount[t] = (data[t] || []).length; incCount[t] = (tables[t] || []).length; }
      const bad = shrinkGuard(curCount, incCount);
      if (bad.length) throw shrinkErr(bad);                            // rolled back by the catch below · handler returns 409
    }
    for (const t of OS_DESC) await client.query(`DELETE FROM ${fqt(t)}`);
    for (const t of OS_ASC) {                                        // batched multi-row insert (fast: ~1-2 queries/table)
      const rows = tables[t] || []; if (!rows.length) continue;
      const cols = OS_COLS[t]; const colSql = cols.map(qic).join(',');
      const perChunk = Math.max(1, Math.floor(60000 / cols.length));  // stay under the 65535 bound-param limit
      for (let i = 0; i < rows.length; i += perChunk) {
        const params = [], tuples = [];
        for (const row of rows.slice(i, i + perChunk)) {
          tuples.push('(' + cols.map(c => { params.push(row[c] === undefined ? null : row[c]); return '$' + params.length; }).join(',') + ')');
        }
        await client.query(`INSERT INTO ${fqt(t)} (${colSql}) VALUES ${tuples.join(',')}`, params);
      }
    }
    const nv = curVer + 1;
    await client.query('INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,NULL,$2,$3,now()) ON CONFLICT(id) DO UPDATE SET version=$2, updated_by=$3, updated_at=now()', [STATE_KEY, nv, username]);
    await client.query('COMMIT');
    return { version: nv, behind };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

let pool = null, dbReady = false;
if (Pool && DB_URL) {
  pool = new Pool({ connectionString: DB_URL, ssl: (DB_URL.includes('rlwy')||DB_URL.includes('railway')||process.env.PGSSL) ? { rejectUnauthorized:false } : false });
  pool.on('error', e => console.error('[db] idle client error (ignored):', e.message));   // a dropped idle connection must not crash the process
  initDb();
} else {
  console.warn('[db] no DATABASE_URL — login & sync disabled');
}
async function initDb(){
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS ${USERS_T} (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, name TEXT, role TEXT DEFAULT 'staff', created_at TIMESTAMPTZ DEFAULT now())`);
    await pool.query("CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, data TEXT, version INT DEFAULT 0, updated_by TEXT, updated_at TIMESTAMPTZ DEFAULT now())");
    await pool.query("ALTER TABLE app_state ADD COLUMN IF NOT EXISTS version INT DEFAULT 0");
    await pool.query("ALTER TABLE app_state ADD COLUMN IF NOT EXISTS updated_by TEXT");
    await pool.query(`ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS perms TEXT`);   // per-user area access (JSON array · null = all)
    await pool.query(`ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT true`);   // legacy global edit flag (fallback)
    await pool.query(`ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS edit_areas TEXT`);   // per-section edit · JSON array of area keys · null = edit all (uses can_edit)
    await pool.query(`ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS dept TEXT`);   // department key (UI grouping) · null = auto-guess from username
    // §user→sales (2026-07-14): sales staff should see only their own agents. Permissions so far gate WHICH
    // PAGE a user sees; this scopes WHICH ROWS. The identity lives on the user record (next to role/perms),
    // so the client can match agent.sales === my sales id. null = not a scoped salesperson (admins, ops, etc.
    // see everything). Assigned in the admin user modal, same place role and department are set.
    await pool.query(`ALTER TABLE ${USERS_T} ADD COLUMN IF NOT EXISTS sales_id TEXT`);
    // §sort (2026-07-11): top-level lists had NO ordering column — os_repo only preserves order for CHILD
    // tables (via idx), so a drag-reorder of the markets / routes list never survived a reload. `sort` is a
    // plain scalar in the mapping, so decompose/assemble carry it with zero changes to os_repo, and the
    // client diff sees it as an ordinary changed field (→ patch ops). Additive: existing rows get NULL.
    if(DATA_BACKEND === 'relational'){
      await pool.query(`ALTER TABLE ${OS_SCHEMA}."sb_markets" ADD COLUMN IF NOT EXISTS "sort" bigint`);
      await pool.query(`ALTER TABLE ${OS_SCHEMA}."routes"     ADD COLUMN IF NOT EXISTS "sort" bigint`);
      // §taxId (2026-07-11): the app reads companyInfo.taxId ("Tax No." on contracts/invoices) but the table
      // had no column for it, so every value was silently dropped on save. Additive: existing rows get NULL.
      await pool.query(`ALTER TABLE ${OS_SCHEMA}."sb_agents" ADD COLUMN IF NOT EXISTS "companyinfo_taxid" text`);
      // §per-trip ops (2026-07-12): boat/van assignment lived ONLY on the booking (ops_*), so a booking with
      // two travel days (an overnight, or a B2C order with two programmes) could hold exactly one boat and one
      // van — day 2 silently inherited day 1's. Ops now also live on the trip row. Day 1 keeps using the
      // booking-level block (1,058 of 1,059 bookings are single-day and are completely untouched).
      const _tripOps = [['ops_boatid','text'],['ops_vanid','text'],['ops_vanreturnid','text'],
                        ['ops_returnsamevan','boolean'],['ops_vangroup','bigint'],['ops_vanseq','bigint'],
                        ['ops_pickuptimefinal','text'],['ops_vansplits','text'],['ops_reconfirm','text']];
      for(const [c,t] of _tripOps){
        await pool.query(`ALTER TABLE ${OS_SCHEMA}."sb_bookings__trips" ADD COLUMN IF NOT EXISTS "${c}" ${t}`);
      }
      // §3-tier contract pricing (2026-07-14): agent contracts quote three numbers per seat — Selling (what
      // the agent should charge the guest), Min. Selling (the floor they may not go under) and Net (what they
      // pay us). Only Net exists in the app: seatRates, and it is the number every booking, invoice and report
      // bills from. sb_rate_types__seatrates is a FLAT table — one column per zone×paxType — so adding two
      // more tiers there means 24 more columns and a rewrite of the decompose path that prices live bookings.
      // Not worth it for two numbers that are only ever printed on a contract. The extra tiers ride in one
      // json_text column instead: {route:{zone:{paxType:{sell,minSell}}}}. seatRates is untouched, the billing
      // path is untouched, and a rate type with no priceTiers simply prints "—" in those columns.
      await pool.query(`ALTER TABLE ${OS_SCHEMA}."sb_rate_types" ADD COLUMN IF NOT EXISTS "pricetiers" text`);
      // §contract templates (2026-07-14): every word of the agent contract — the cancellation clause, the
      // health restrictions, the governing-law paragraph — was a string literal in CT_DOC_I18N. Changing a
      // comma meant a code edit and a deploy. Templates move that text into the database so sales can edit it.
      //
      // Same shape as agent_artifacts: a map {templateId -> template}, one row per key, the whole template
      // object as JSON in `value`. Deliberate — a template will grow fields (new clauses, new sections) and
      // this way none of them need a migration. os_repo already knows the pk/map_key/map_value_json trio.
      //
      // The table has to exist before os_repo can write to it, and operation_schemas_structure.sql only runs
      // on a fresh install, so create it here too. Idempotent.
      await pool.query(`CREATE TABLE IF NOT EXISTS ${OS_SCHEMA}."contract_templates" (id text PRIMARY KEY, key text, value text)`);
      // Which template an agent's contract is generated from. Empty = whichever template is marked default.
      await pool.query(`ALTER TABLE ${OS_SCHEMA}."sb_agents" ADD COLUMN IF NOT EXISTS "contracttemplateid" text`);
      // §vehicle identity colour (2026-07-12): the van-job list coloured rows by POSITION (PAL[i%6]), so a
      // van's colour changed from day to day. The colour now belongs to the vehicle and is printed on the
      // job-sheet header, so a driver recognises his own sheet at a glance. Additive: existing rows get NULL
      // and fall back to a stable hash-of-id colour on the client.
      await pool.query(`ALTER TABLE ${OS_SCHEMA}."sb_vehicles" ADD COLUMN IF NOT EXISTS "color" text`);
    }
    // document attachments · files stored server-side (bytea) · booking keeps only a ref in the app blob
    await pool.query("CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, booking_id TEXT, filename TEXT, mime TEXT, size INT, data BYTEA, uploaded_by TEXT, created_at TIMESTAMPTZ DEFAULT now())");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_attach_booking ON attachments(booking_id)");
    // seed first admin from env if there are no users yet
    const c = await pool.query(`SELECT count(*)::int n FROM ${USERS_T}`);
    if (c.rows[0].n === 0 && ADMIN_USER && ADMIN_PASS) {
      await pool.query(`INSERT INTO ${USERS_T}(username,pass_hash,name,role) VALUES($1,$2,$3,$4)`, [ADMIN_USER, hashPw(ADMIN_PASS), 'Admin', 'admin']);
      console.log('[db] seeded admin user:', ADMIN_USER);
    }
    dbReady = true; console.log('[db] ready');
  }catch(e){ console.error('[db] init failed:', e.message); }
}

// dept: short free-text department key used only for UI grouping · null = auto-guess from username
function cleanDept(d){ d=(d==null?'':String(d)).trim(); return d ? d.slice(0,40) : null; }
function cleanSalesId(s){ s=(s==null?'':String(s)).trim(); return s ? s.slice(0,40) : null; }   // §user→sales · SB_SALES id or null
// ── perms helpers (per-user area access · null/invalid = all areas) ──
function parsePerms(v){ if(v==null) return null; try{ const a=JSON.parse(v); return Array.isArray(a)?a:null; }catch(e){ return null; } }
const PERM_KEYS=new Set(['overview','operations','sales','accounting','fleet','config',  // group keys (back-compat)
  // §2026-07-13: 'reconfirm' and 'bookingflow' were missing here AND from LA_NAV on the client, so the two
  // pages were outside the permission system entirely — laAllowed() lets an unknown view through, meaning
  // every user could open them regardless of their ticks. Adding them to the client alone is not enough:
  // cleanPerms() filters against this Set, so an admin ticking "Booking Flow" would have had the tick
  // silently dropped on save and the box would come back empty.
  'dashboard','calendar','daily','booking','reconfirm','bookingflow','doccheck','operation','insurance','vehicles','vanjobs','pickup-setup',
  'agents','rate-types','contract-tmpl','b2c','staff','marketdata','focdetail','pickupmap','dailypfm',
  'fl-dashboard','fl-boatstatus','fl-dailyreport','fl-incident','fl-projects','fl-maintenance','fl-inventory','fl-consumables','fl-cost','fl-insights','fl-fuel','fl-asset',
  'settings','teammkt','addonsvc']);   // 'accounting' already present as a group key
function cleanPerms(a){ return Array.isArray(a)?a.filter(x=>PERM_KEYS.has(x)):null; }
const AREA_KEYS=new Set(['overview','operations','sales','accounting','fleet','config']);
function cleanAreas(a){ return Array.isArray(a)?a.filter(x=>AREA_KEYS.has(x)):null; }
// A user's editable-areas + "can edit anything" flag · editAreas null → falls back to legacy can_edit
function editInfo(usr){ const ea=parsePerms(usr.edit_areas); const arr=Array.isArray(ea)?ea.filter(x=>AREA_KEYS.has(x)):null; const any = arr ? arr.length>0 : (usr.can_edit!==false); return {editAreas:arr, canEditAny:any}; }

// ── password hashing (scrypt) ──
function hashPw(pw){ const salt = crypto.randomBytes(16).toString('hex'); const h = crypto.scryptSync(String(pw), salt, 32).toString('hex'); return salt+':'+h; }
function verifyPw(pw, stored){ try{ const [salt,h] = String(stored).split(':'); const c = crypto.scryptSync(String(pw), salt, 32).toString('hex'); return crypto.timingSafeEqual(Buffer.from(h,'hex'), Buffer.from(c,'hex')); }catch(e){ return false; } }

// ── signed session cookie ──
function sign(payloadObj){ const p = Buffer.from(JSON.stringify(payloadObj)).toString('base64url'); const sig = crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); return p+'.'+sig; }
function verify(token){ try{ const [p,sig] = String(token).split('.'); const exp = crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(exp))) return null; const o = JSON.parse(Buffer.from(p,'base64url').toString()); if(o.exp && Date.now() > o.exp) return null; return o; }catch(e){ return null; } }
function cookies(req){ const h = req.headers.cookie||''; const o={}; h.split(';').forEach(s=>{ const i=s.indexOf('='); if(i>0) o[s.slice(0,i).trim()] = decodeURIComponent(s.slice(i+1).trim()); }); return o; }
function session(req){ return verify(cookies(req).sess||''); }
// Daily session reset (2026-07-08): sessions expire at the next 03:00 ICT so every user re-logs in each morning → fresh data on login.
const ICT_OFFSET_MS = 7*3600e3, DAILY_RESET_HOUR = 3;
function nextDailyExpiry(){ const nowIct = Date.now()+ICT_OFFSET_MS; const d = new Date(nowIct); d.setUTCHours(DAILY_RESET_HOUR,0,0,0); let exp = d.getTime(); if(exp <= nowIct) exp += 864e5; return exp - ICT_OFFSET_MS; }

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8' };
function readBody(req, cb){ let ch=[], n=0; req.on('data',c=>{ n+=c.length; if(n>20*1024*1024){req.destroy();return;} ch.push(c); }); req.on('end',()=>cb(Buffer.concat(ch).toString('utf8'))); }
function J(res, code, obj, extra){ const h=Object.assign({'Content-Type':'application/json; charset=utf-8'}, extra||{}); res.writeHead(code,h); res.end(JSON.stringify(obj)); }
// gzip variant for large payloads (/api/load) — falls back to plain when the client doesn't accept gzip
function JZ(req, res, code, obj){
  const body = JSON.stringify(obj);
  if (body.length > 50*1024 && /\bgzip\b/.test(req.headers['accept-encoding']||'')){
    const zlib = require('zlib');
    return zlib.gzip(body, (err, buf)=>{
      if (err){ res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'}); return res.end(body); }
      res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Content-Encoding':'gzip'});
      res.end(buf);
    });
  }
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});
  res.end(body);
}
// ── Server-Sent Events · push "data changed" to all open clients instantly (real-time) ──
const sseClients = new Set();
function sseBroadcast(obj){ const msg='data: '+JSON.stringify(obj)+'\n\n'; sseClients.forEach(r=>{ try{ r.write(msg); }catch(e){ sseClients.delete(r); } }); }
// Deep-merge a plain-object patch onto target · patch={p:{key:{v:val}|{m:subdiff}}, d:[deletedKeys]}
function applyObj(target, diff){
  const p=(diff&&diff.p)||{}, d=(diff&&diff.d)||[];
  Object.keys(p).forEach(k=>{ const e=p[k]||{};
    if('v' in e) target[k]=e.v;
    else if('m' in e){ if(!target[k]||typeof target[k]!=='object'||Array.isArray(target[k])) target[k]={}; applyObj(target[k], e.m); } });
  d.forEach(k=>{ delete target[k]; });
}
// Merge a client diff onto the server blob (concurrent-safe per record + per object sub-key).
// diff = { sets:{key:value|null}, cols:{key:{idf,up,del}}, objs:{key:{p,d}} }
function applyDiff(blob, diff){
  const sets = (diff && diff.sets) || {}, cols = (diff && diff.cols) || {}, objs = (diff && diff.objs) || {};
  Object.keys(sets).forEach(k=>{ const v=sets[k]; if(v===null) delete blob[k]; else blob[k]=v; });
  Object.keys(objs).forEach(k=>{ if(!blob[k]||typeof blob[k]!=='object'||Array.isArray(blob[k])) blob[k]={}; applyObj(blob[k], objs[k]); });
  Object.keys(cols).forEach(k=>{ const c=cols[k]||{}; const idf=c.idf||'id';
    const arr = Array.isArray(blob[k]) ? blob[k] : [];
    const map = new Map(); let n=0;
    arr.forEach(x=>{ if(x && x[idf]!=null) map.set(String(x[idf]), x); else map.set('__noid_'+(n++), x); });
    (c.up||[]).forEach(rec=>{ if(rec && rec[idf]!=null) map.set(String(rec[idf]), rec); });   // full insert/replace (new records)
    (c.patch||[]).forEach(pr=>{ if(pr && pr.id!=null){ const id=String(pr.id); const tgt=map.get(id);   // per-field merge onto server's CURRENT record → concurrent edits to different fields both survive
      if(tgt && typeof tgt==='object' && !Array.isArray(tgt)) applyObj(tgt, pr.m||{});
      else if(pr.full!=null) map.set(id, pr.full); } });
    (c.del||[]).forEach(id=>{ map.delete(String(id)); });
    blob[k] = Array.from(map.values());
  });
}

// ═══════════════ Per-entity REST API (v1) over operation_schemas ═══════════════
// Generic CRUD for every top-level entity, driven by the os_repo PLAN. One record (+ its nested
// children) per request via the same assemble/decompose engine, scoped to that entity's subtree.
// Requires DATA_BACKEND=relational (operation_schemas is the store). Auth = session, writes = edit right.
const REST_PLAN = osRepo._plan, REST_KIDS = osRepo._children;
const REST_RES = {};                       // resourceName (appKey) -> { table, pkCol, container }
for (const [t, pl] of Object.entries(REST_PLAN)) {
  if (!pl.isChild && (pl.container === 'array' || pl.container === 'map') && pl.appKey)
    REST_RES[pl.appKey] = { table: t, pkCol: pl.pkCol || pl.keyCol, container: pl.container };
}
function restDescendants(table){ const out = []; (function rec(t){ for (const c of (REST_KIDS[t]||[])){ out.push(c); rec(c); } })(table); return out; }
// scoped load: parent rows (all, or one id) + every descendant child row linked by the FK chain
// db = pool (default) or an open transaction client (patch reads must see earlier ops in the same txn)
async function restLoad(table, id, db){
  db = db || pool;
  const pl = REST_PLAN[table], pkc = pl.pkCol || pl.keyCol, data = {};
  const pr = id == null ? await db.query(`SELECT * FROM ${fqt(table)}`)
                        : await db.query(`SELECT * FROM ${fqt(table)} WHERE ${qic(pkc)}=$1`, [id]);
  data[table] = pr.rows;
  async function kids(t, pkvals){
    if (!pkvals.length) return;
    for (const c of (REST_KIDS[t]||[])){
      const cp = REST_PLAN[c];
      const r = await db.query(`SELECT * FROM ${fqt(c)} WHERE ${qic(cp.fkCol)} = ANY($1)`, [pkvals]);
      data[c] = (data[c]||[]).concat(r.rows);
      await kids(c, r.rows.map(x => x[cp.rowPkCol != null ? cp.rowPkCol : cp.pkCol]).filter(v => v != null));
    }
  }
  await kids(table, data[table].map(r => r[pkc]).filter(v => v != null));
  return data;
}
async function restGet(res, resName, id){
  const R = REST_RES[resName]; if (!R) return J(res, 404, { error: 'unknown resource: ' + resName });
  const { table, container } = R, appKey = REST_PLAN[table].appKey;
  const blob = osRepo.assembleBlob(await restLoad(table, id));
  const val = blob[appKey];
  if (id == null) return J(res, 200, { [resName]: val === undefined ? (container === 'map' ? {} : []) : val });
  const rec = container === 'array' ? (Array.isArray(val) ? val.find(x => x && String(x.id) === String(id)) : null) : (val ? val[id] : null);
  return rec !== undefined && rec !== null ? J(res, 200, rec) : J(res, 404, { error: 'not found' });
}
async function _restInsertRows(client, tables, rows){          // parents first, batched multi-row
  for (const t of tables){
    const rws = rows[t] || []; if (!rws.length) continue;
    const cols = OS_COLS[t], colSql = cols.map(qic).join(','), per = Math.max(1, Math.floor(60000 / cols.length));
    for (let i = 0; i < rws.length; i += per){
      const params = [], tuples = [];
      for (const row of rws.slice(i, i + per)) tuples.push('(' + cols.map(c => { params.push(row[c] === undefined ? null : row[c]); return '$' + params.length; }).join(',') + ')');
      await client.query(`INSERT INTO ${fqt(t)} (${colSql}) VALUES ${tuples.join(',')}`, params);
    }
  }
}
// Apply ONE write op inside an open transaction. Ops:
//   {op:'put',    r, id, body}  replace/create one record (nested children re-inserted; map value may be any JSON)
//   {op:'patch',  r, id, body:{m,full}}  per-FIELD merge onto the record's CURRENT server state (m = deep diff
//                               {p,d} · applyObj) — two users editing different fields of the same record both
//                               survive. Record missing / not an object → falls back to body.full (full replace).
//   {op:'del',    r, id}        delete one record (children cascade)
//   {op:'putall', r, body}      replace the whole collection (id-less wholesale sets · body null/[]/{}= clear)
//   {op:'meta',   id, body}     upsert one top-level scalar in app_meta (body null = delete the key)
async function restApplyOp(client, op){
  if (op.op === 'meta'){
    await client.query(`DELETE FROM ${fqt('app_meta')} WHERE ${qic('key')}=$1`, [op.id]);
    if (op.body !== null && op.body !== undefined)
      await client.query(`INSERT INTO ${fqt('app_meta')} (${qic('key')},${qic('value')}) VALUES ($1,$2)`, [op.id, JSON.stringify(op.body)]);
    return op.id;
  }
  const R = REST_RES[op.r]; if (!R) throw new Error('unknown resource: ' + op.r);
  const { table, pkCol, container } = R, appKey = REST_PLAN[table].appKey;
  const subtree = [table, ...restDescendants(table)].sort((a, b) => _osDepth(a) - _osDepth(b));
  if (op.op === 'del'){ await client.query(`DELETE FROM ${fqt(table)} WHERE ${qic(pkCol)}=$1`, [op.id]); return op.id; }
  if (op.op === 'patch'){
    if (op.id == null) throw new Error(op.r + ': patch needs an id');
    const b = op.body || {};
    const blob = osRepo.assembleBlob(await restLoad(table, op.id, client));
    const val = blob[appKey];
    const cur = container === 'array' ? (Array.isArray(val) ? val.find(x => x && String(x.id) === String(op.id)) : null)
                                      : (val ? val[op.id] : null);
    let merged;
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) { applyObj(cur, b.m || {}); merged = cur; }
    else if (b.full !== undefined && b.full !== null) merged = b.full;      // record gone / not an object → full replace
    else throw new Error(op.r + '/' + op.id + ': patch target not found (no full fallback)');
    return restApplyOp(client, { op: 'put', r: op.r, id: op.id, body: merged });
  }
  if (op.op === 'putall'){
    if (!op.confirm && OS_TOP.indexOf(table) >= 0){                      // save-safety: refuse wiping an existing collection wholesale
      const curN = (await client.query(`SELECT count(*)::int n FROM ${fqt(table)}`)).rows[0].n;
      let incN = 0; if (op.body != null){ const rr = osRepo.decomposeBlob({ [appKey]: op.body }); incN = (rr[table] || []).length; }
      const bad = shrinkGuard({ [table]: curN }, { [table]: incN });
      if (bad.length) throw shrinkErr(bad);
    }
    await client.query(`DELETE FROM ${fqt(table)}`);                     // children cascade
    if (op.body == null) return op.r;
    const rows = osRepo.decomposeBlob({ [appKey]: op.body });
    await _restInsertRows(client, subtree, rows);
    return op.r;
  }
  // put — single record
  let body = op.body;
  if (container === 'array'){
    if (body == null || typeof body !== 'object' || Array.isArray(body)) throw new Error(op.r + ': body must be a record object');
    if (op.id != null) body.id = op.id;
    if (body.id == null) throw new Error(op.r + ': record needs an id');
  } else if (op.id == null) throw new Error(op.r + ': map resource needs an id');
  const recKey = container === 'array' ? body.id : op.id;
  const rows = osRepo.decomposeBlob({ [appKey]: container === 'array' ? [body] : { [recKey]: body } });
  await client.query(`DELETE FROM ${fqt(table)} WHERE ${qic(pkCol)}=$1`, [recKey]);   // replace (children cascade)
  await _restInsertRows(client, subtree, rows);
  return recKey;
}
// Run a batch of ops in ONE transaction (serialized with the legacy save path via the same advisory
// lock), bump the app_state version once, return {version, behind} — same contract as /api/save.
async function restTxn(username, baseVersion, ops){
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(918273645)');
    const vr = await client.query('SELECT version FROM app_state WHERE id=$1', [STATE_KEY]);
    const curVer = vr.rows[0] ? vr.rows[0].version : 0;
    const behind = (baseVersion !== -1 && baseVersion != null && baseVersion < curVer);
    const applied = [];
    for (const op of ops) applied.push(await restApplyOp(client, op));
    const nv = curVer + 1;
    await client.query('INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,NULL,$2,$3,now()) ON CONFLICT(id) DO UPDATE SET version=$2, updated_by=$3, updated_at=now()', [STATE_KEY, nv, username]);
    await client.query('COMMIT');
    return { version: nv, behind, applied };
  } catch (e){ await client.query('ROLLBACK').catch(()=>{}); throw e; } finally { client.release(); }
}

const server = http.createServer((req, res) => {
  const u = (req.url||'/').split('?')[0];
  const q = (req.url||'').split('?')[1]||'';

  // ───── AUTH ─────
  if(u === '/api/login' && req.method === 'POST'){
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body => {
      let b={}; try{ b=JSON.parse(body); }catch(e){}
      pool.query(`SELECT * FROM ${USERS_T} WHERE lower(username)=lower($1)`, [String(b.username||'').trim()])
        .then(r => { const usr=r.rows[0];
          if(!usr || !verifyPw(b.password||'', usr.pass_hash)) return J(res,401,{error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'});
          const perms = parsePerms(usr.perms); const ei = editInfo(usr);
          const EXP = Date.now() + SESS_DAYS*864e5;   // §102 REVERTED 2026-07-10: back to 30-day session. The daily 03:00 re-login forced every client to reload each morning, which is what fired the latent loadData version-mismatch reseed. nextDailyExpiry() kept for reference (unused).
          const tok = sign({uid:usr.id, username:usr.username, name:usr.name, role:usr.role, perms:perms, edit:ei.canEditAny, editAreas:ei.editAreas, salesId:usr.sales_id||null, exp:EXP});
          J(res,200,{username:usr.username,name:usr.name,role:usr.role,perms:perms,canEdit:ei.canEditAny,editAreas:ei.editAreas,salesId:usr.sales_id||null}, {'Set-Cookie':`sess=${tok}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${Math.max(60,Math.floor((EXP-Date.now())/1000))}`});
        }).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }
  if(u === '/api/logout'){ J(res,200,{ok:true},{'Set-Cookie':'sess=; HttpOnly; Path=/; Max-Age=0'}); return; }
  if(u === '/api/me'){ const s=session(req); return s ? J(res,200,{username:s.username,name:s.name,role:s.role,perms:(s.perms!==undefined?s.perms:null),canEdit:(s.edit!==false),editAreas:(s.editAreas!==undefined?s.editAreas:null),salesId:(s.salesId!==undefined?s.salesId:null)}) : J(res,401,{error:'not logged in'}); }

  // ───── DATA (require login) ─────
  if(u === '/api/load'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!pool) return J(res,503,{error:'no database'});
    if(DATA_BACKEND==='relational'){
      Promise.all([relLoad(), pool.query('SELECT version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY])])
        .then(([blob,r])=>{ const m=r.rows[0]||{}; JZ(req,res,200,{data:JSON.stringify(blob),version:m.version||0,updated_by:m.updated_by,updated_at:m.updated_at}); })
        .catch(e=>J(res,500,{error:e.message}));
      return;
    }
    pool.query('SELECT data,version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY])
      .then(r => r.rows[0] ? JZ(req,res,200,{data:r.rows[0].data,version:r.rows[0].version,updated_by:r.rows[0].updated_by,updated_at:r.rows[0].updated_at})
                           : J(res,200,{data:null,version:0}))
      .catch(e=>J(res,500,{error:e.message}));
    return;
  }
  if(u === '/api/version'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(!pool) return J(res,503,{error:'no database'});
    pool.query('SELECT version,updated_by,updated_at FROM app_state WHERE id=$1',[STATE_KEY])
      .then(r=>J(res,200, r.rows[0]?{version:r.rows[0].version,updated_by:r.rows[0].updated_by,updated_at:r.rows[0].updated_at}:{version:0}))
      .catch(e=>J(res,500,{error:e.message}));
    return;
  }
  if(u === '/api/events'){   // SSE stream · server pushes version-bump events → clients refresh instantly
    const s=session(req); if(!s){ res.writeHead(401); return res.end(); }
    res.writeHead(200, {'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write('retry: 5000\n\n');
    sseClients.add(res);
    const hb=setInterval(()=>{ try{ res.write(':hb\n\n'); }catch(e){} }, 25000);
    req.on('close', ()=>{ clearInterval(hb); sseClients.delete(res); });
    return;
  }
  if(u === '/api/save' && req.method === 'POST'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(s.role!=='admin' && s.edit===false) return J(res,403,{error:'view only · ไม่มีสิทธิ์แก้ไข'});   // read-only user cannot change cloud data
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body => {
      let payload; try{ payload=JSON.parse(body); }catch(e){ return J(res,400,{error:'invalid JSON'}); }
      const base = (payload.baseVersion==null ? -1 : payload.baseVersion);
      if(DATA_BACKEND==='relational'){
        // visibility: normal saves go through /api/v1/_batch (per-entity). Landing here means the legacy
        // whole-blob rewrite path was used — seed, old client, or MAPPING DRIFT (a key /api/v1 doesn't know).
        try{ const d=payload.diff||{}; console.warn('[save] LEGACY whole-blob path · user='+s.username
          +(payload.full?' · FULL seed':' · diff sets=['+Object.keys(d.sets||{}).join(',')+'] cols=['+Object.keys(d.cols||{}).join(',')+'] objs=['+Object.keys(d.objs||{}).join(',')+']')
          +' — run os-backend/scripts/check_mapping_drift.js if this repeats'); }catch(e){}
        relApplyAndSave(payload, s.username, base)
          .then(({version,behind})=>{ J(res,200,{ok:true,version,behind}); sseBroadcast({version, updated_by:s.username}); })
          .catch(e=> e.code==='SHRINK_GUARD'
            ? J(res,409,{error:'save_would_delete_data', code:'SHRINK_GUARD', detail:e.detail})
            : J(res,500,{error:e.message}));
        return;
      }
      pool.query('SELECT data,version FROM app_state WHERE id=$1',[STATE_KEY]).then(r=>{
        const curVer = r.rows[0] ? r.rows[0].version : 0;
        let blob={}; if(r.rows[0] && r.rows[0].data){ try{ blob=JSON.parse(r.rows[0].data); }catch(e){ blob={}; } }
        const behind = (base !== -1 && base < curVer);   // others saved since this client loaded → recommend refresh
        if(payload.full && typeof payload.full==='string'){ try{ blob=JSON.parse(payload.full); }catch(e){ return J(res,400,{error:'bad full'}); } }   // seed/first push
        else { try{ applyDiff(blob, payload.diff||{}); }catch(e){ return J(res,400,{error:'bad diff: '+e.message}); } }
        const nv = curVer+1, out = JSON.stringify(blob);
        pool.query('INSERT INTO app_state(id,data,version,updated_by,updated_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=$3, updated_by=$4, updated_at=now()',[STATE_KEY,out,nv,s.username])
          .then(()=>{ J(res,200,{ok:true,version:nv,behind:behind,bytes:out.length}); sseBroadcast({version:nv, updated_by:s.username}); }).catch(e=>J(res,500,{error:e.message}));
      }).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }

  // ───── ATTACHMENTS (document files · stored server-side · booking keeps only a ref in the app blob) ─────
  if(u === '/api/attach' && req.method === 'POST'){   // upload one file (base64 JSON)
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(s.role!=='admin' && s.edit===false) return J(res,403,{error:'view only · ไม่มีสิทธิ์แนบไฟล์'});
    if(!pool) return J(res,503,{error:'no database'});
    readBody(req, body=>{
      let b={}; try{ b=JSON.parse(body); }catch(e){ return J(res,400,{error:'invalid JSON'}); }
      let buf=null; try{ buf=Buffer.from(String(b.dataB64||''),'base64'); }catch(e){ buf=null; }
      if(!buf || !buf.length) return J(res,400,{error:'no file data'});
      if(buf.length > 6*1024*1024) return J(res,413,{error:'ไฟล์ใหญ่เกิน 6MB'});
      const id = 'att_'+Date.now().toString(36)+'_'+crypto.randomBytes(5).toString('hex');
      const mime = String(b.mime||'application/octet-stream').slice(0,100);
      const fn   = String(b.filename||'file').slice(0,200);
      const bkId = String(b.bookingId||'').slice(0,80);
      pool.query('INSERT INTO attachments(id,booking_id,filename,mime,size,data,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,bkId,fn,mime,buf.length,buf,s.username])
        .then(()=>J(res,200,{id:id,filename:fn,mime:mime,size:buf.length,uploaded_by:s.username})).catch(e=>J(res,500,{error:e.message}));
    }); return;
  }
  if(u === '/api/attach' && req.method === 'GET'){   // list metadata for a booking (?booking=<id>)
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(!pool) return J(res,503,{error:'no database'});
    const bk=decodeURIComponent((q.match(/booking=([^&]*)/)||[])[1]||'');
    pool.query('SELECT id,filename,mime,size,uploaded_by,created_at FROM attachments WHERE booking_id=$1 ORDER BY created_at',[bk])
      .then(r=>J(res,200,{files:r.rows})).catch(e=>J(res,500,{error:e.message})); return;
  }
  if(u.startsWith('/api/attach/') && req.method === 'GET'){   // stream one file inline
    const s=session(req); if(!s){ res.writeHead(401); return res.end('login required'); } if(!pool){ res.writeHead(503); return res.end('no db'); }
    const id=decodeURIComponent(u.slice('/api/attach/'.length));
    pool.query('SELECT filename,mime,data FROM attachments WHERE id=$1',[id]).then(r=>{
      const row=r.rows[0]; if(!row){ res.writeHead(404); return res.end('not found'); }
      const buf = Buffer.isBuffer(row.data)?row.data:Buffer.from(row.data||'');
      res.writeHead(200,{'Content-Type':row.mime||'application/octet-stream','Content-Length':buf.length,'Content-Disposition':'inline; filename="'+encodeURIComponent(row.filename||'file')+'"','Cache-Control':'private, max-age=86400'});
      res.end(buf);
    }).catch(e=>{ res.writeHead(500); res.end(e.message); }); return;
  }
  if(u.startsWith('/api/attach/') && req.method === 'DELETE'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(s.role!=='admin' && s.edit===false) return J(res,403,{error:'view only'});
    if(!pool) return J(res,503,{error:'no database'});
    const id=decodeURIComponent(u.slice('/api/attach/'.length));
    pool.query('DELETE FROM attachments WHERE id=$1',[id]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); return;
  }

  // ───── ADMIN: user management (admin only) ─────
  if(u === '/api/users'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    if(!pool) return J(res,503,{error:'no database'});
    if(req.method === 'GET'){ pool.query(`SELECT id,username,name,role,perms,can_edit,edit_areas,dept,sales_id,created_at FROM ${USERS_T} ORDER BY id`).then(r=>J(res,200,{users:r.rows.map(x=>{const ei=editInfo(x); return {id:x.id,username:x.username,name:x.name,role:x.role,perms:parsePerms(x.perms),canEdit:ei.canEditAny,editAreas:ei.editAreas,dept:x.dept||null,salesId:x.sales_id||null,created_at:x.created_at};})})).catch(e=>J(res,500,{error:e.message})); return; }
    if(req.method === 'POST'){ readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} const un=String(b.username||'').trim(); if(!un||!b.password) return J(res,400,{error:'ต้องมี username + password'});
      const perms = cleanPerms(b.perms); const permsStr = perms ? JSON.stringify(perms) : null;
      const ea = cleanAreas(b.editAreas); const eaStr = ea ? JSON.stringify(ea) : null; const canEdit = ea ? ea.length>0 : (b.canEdit!==false);
      pool.query(`INSERT INTO ${USERS_T}(username,pass_hash,name,role,perms,can_edit,edit_areas,dept,sales_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[un,hashPw(b.password),(b.name||un),(b.role==='admin'?'admin':'staff'),permsStr,canEdit,eaStr,cleanDept(b.dept),cleanSalesId(b.salesId)])
        .then(()=>J(res,200,{ok:true})).catch(e=>J(res, e.code==='23505'?409:500, {error: e.code==='23505'?'username นี้มีอยู่แล้ว':e.message})); }); return; }
    if(req.method === 'DELETE'){ const id=parseInt((q.match(/id=(\d+)/)||[])[1]||'0',10); if(!id) return J(res,400,{error:'no id'}); if(id===s.uid) return J(res,400,{error:'ลบบัญชีตัวเองไม่ได้'});
      pool.query(`DELETE FROM ${USERS_T} WHERE id=$1`,[id]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); return; }
  }
  if(u === '/api/users/password' && req.method === 'POST'){
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} if(!b.id||!b.password) return J(res,400,{error:'no id/password'});
      pool.query(`UPDATE ${USERS_T} SET pass_hash=$1 WHERE id=$2`,[hashPw(b.password),parseInt(b.id,10)]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }); return;
  }
  if(u === '/api/users/perms' && req.method === 'POST'){   // admin sets a user's area access · role optional
    const s=session(req); if(!s) return J(res,401,{error:'login required'}); if(s.role!=='admin') return J(res,403,{error:'admin only'});
    readBody(req, body=>{ let b={}; try{b=JSON.parse(body);}catch(e){} const id=parseInt(b.id,10); if(!id) return J(res,400,{error:'no id'});
      const perms = cleanPerms(b.perms); const permsStr = perms ? JSON.stringify(perms) : null;
      const ea = cleanAreas(b.editAreas); const eaStr = ea ? JSON.stringify(ea) : null; const canEdit = ea ? ea.length>0 : (b.canEdit!==false);
      if(b.role==='admin'||b.role==='staff'){ pool.query(`UPDATE ${USERS_T} SET perms=$1, role=$2, can_edit=$3, edit_areas=$4, dept=$6, sales_id=$7 WHERE id=$5`,[permsStr,b.role,canEdit,eaStr,id,cleanDept(b.dept),cleanSalesId(b.salesId)]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }
      else { pool.query(`UPDATE ${USERS_T} SET perms=$1, can_edit=$2, edit_areas=$3, dept=$5, sales_id=$6 WHERE id=$4`,[permsStr,canEdit,eaStr,id,cleanDept(b.dept),cleanSalesId(b.salesId)]).then(()=>J(res,200,{ok:true})).catch(e=>J(res,500,{error:e.message})); }
    }); return;
  }

  // ───── Per-entity REST API (v1) ─────
  //   GET  /api/v1                     resource index {resources:{name:container}}
  //   GET  /api/v1/<entity>[/<id>]     list / one record (nested children assembled)
  //   POST/PUT/DELETE /api/v1/<entity>[/<id>]   create / replace / delete one record
  //   POST /api/v1/_batch              {baseVersion, ops:[{op,r,id,body}]} — many ops, ONE transaction
  // Every write bumps the app_state version + broadcasts on SSE (same live-refresh contract as /api/save).
  if(u === '/api/v1' || u.startsWith('/api/v1/')){
    const s=session(req); if(!s) return J(res,401,{error:'login required'});
    if(!pool) return J(res,503,{error:'no database'});
    if(DATA_BACKEND!=='relational') return J(res,503,{error:'REST API requires DATA_BACKEND=relational'});
    const seg = u === '/api/v1' ? [] : u.slice('/api/v1/'.length).split('/').filter(Boolean).map(decodeURIComponent);
    const resName = seg[0], id = seg.length>1 ? seg[1] : null, m = req.method;
    const done=e=>J(res,500,{error:e.message});
    if(!resName){ const out={}; for(const [n,r] of Object.entries(REST_RES)) out[n]=r.container; return J(res,200,{resources:out}); }
    const canWrite = s.role==='admin' || s.edit!==false;
    if(resName==='_batch'){
      if(m!=='POST') return J(res,405,{error:'method not allowed'});
      if(!canWrite) return J(res,403,{error:'view only · ไม่มีสิทธิ์แก้ไข'});
      readBody(req, body=>{
        let p; try{ p=JSON.parse(body); }catch(e){ return J(res,400,{error:'invalid JSON'}); }
        const ops = Array.isArray(p.ops) ? p.ops : null;
        if(!ops || !ops.length) return J(res,400,{error:'ops required'});
        if(!ops.every(o=>o && (o.op==='meta' ? o.id!=null : (o.op==='put'||o.op==='patch'||o.op==='del'||o.op==='putall') && o.r))) return J(res,400,{error:'bad op shape'});
        restTxn(s.username, p.baseVersion==null?-1:p.baseVersion, ops)
          .then(({version,behind})=>{ try{ const summ=ops.slice(0,25).map(o=>o.op+':'+(o.r||o.id||'')).join(','); console.log('[batch] user='+s.username+' v'+version+' ops='+ops.length+' ['+summ+']'); }catch(e){}   // 2026-07-10: log who saved what (per-entity saves had no username trail — the incident was untraceable)
            J(res,200,{ok:true,version,behind,applied:ops.length}); sseBroadcast({version, updated_by:s.username}); })
          .catch(e=> e.code==='SHRINK_GUARD'
            ? J(res,409,{error:'save_would_delete_data', code:'SHRINK_GUARD', detail:e.detail})
            : J(res, /unknown resource|needs an id|record object|patch target not found/.test(e.message)?400:500, {error:e.message}));
      }); return;
    }
    if(m==='GET'){ restGet(res,resName,id).catch(done); return; }
    if(!canWrite) return J(res,403,{error:'view only · ไม่มีสิทธิ์แก้ไข'});
    const one = op => restTxn(s.username, -1, [op])
      .then(({version,applied})=>{ J(res, m==='POST'?201:200, {ok:true, id:applied[0], version}); sseBroadcast({version, updated_by:s.username}); })
      .catch(e=> e.code==='SHRINK_GUARD'
        ? J(res,409,{error:'save_would_delete_data', code:'SHRINK_GUARD', detail:e.detail})
        : J(res, /unknown resource|needs an id|record object|patch target not found/.test(e.message)?400:500, {error:e.message}));
    if(m==='DELETE'){ if(id==null) return J(res,400,{error:'id required'}); one({op:'del', r:resName, id}); return; }
    if(m==='POST'||m==='PUT'){
      if(m==='PUT'&&id==null) return J(res,400,{error:'id required for PUT'});
      readBody(req, body=>{ let b; try{ b=JSON.parse(body||'{}'); }catch(e){ return J(res,400,{error:'invalid JSON'}); } one({op:'put', r:resName, id, body:b}); }); return;
    }
    return J(res,405,{error:'method not allowed'});
  }

  // ───── static files ─────
  let p = decodeURIComponent(u); if(p==='/'||p==='') p='/allotment_v2/allotment_v2.html';
  const fp = path.normalize(path.join(ROOT,p));
  if(!fp.startsWith(ROOT)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp,(err,data)=>{ if(err){ res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
    const etag = '"'+crypto.createHash('sha1').update(data).digest('hex').slice(0,20)+'"';
    if((req.headers['if-none-match']||'') === etag){ res.writeHead(304,{'ETag':etag,'Cache-Control':'no-cache'}); return res.end(); }
    res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream','ETag':etag,'Cache-Control':'no-cache'}); res.end(data); });
});
server.listen(PORT, ()=>console.log('LOVE Andaman on '+PORT+(pool?' · db on':' · db off')));
