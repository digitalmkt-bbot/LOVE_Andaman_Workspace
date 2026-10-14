import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(process.env.VAN_ADAPTER_FILE || 'allotment_v2/js/ops/45-ops-van-bills.js', 'utf8');
function harness(enabled = true) {
  let rows = [{group_key:'own', route_id:null, field:'base', rate:900}];
  let chain = Promise.resolve(), renders = 0, failNext = false;
  const calls=[], local=[], errors=[];
  const ctx = { console, Promise, document:{getElementById:()=>null}, ctRender(){renders++;},
    ctRead(k){local.push(['read',k]); return {legacy:true};}, ctWrite(k,v){local.push(['write',k,v]);} };
  ctx.window=ctx;
  ctx.laOps={ enabled:()=>enabled, clone:v=>JSON.parse(JSON.stringify(v)), onChange(){},
    fail:(t,e)=>errors.push(e.message), get:async path=>{calls.push(['GET',path]); return {rates:rows};},
    queue(fn){const p=chain.then(fn); chain=p.catch(()=>{}); return p;},
    call:async(method,path,body)=>{
      assert.equal(path,'/v1/van-rates'); assert.equal(method,'PUT'); calls.push([method,path,body]);
      if(failNext){failNext=false; throw Error('denied');}
      rows=rows.filter(c=>!(c.group_key===body.group && c.route_id===body.route_id && c.field===body.field));
      if(body.rate!==null) rows.push({group_key:body.group,route_id:body.route_id,field:body.field,rate:body.rate});
      return {rates:JSON.parse(JSON.stringify(rows))};
    }
  };
  vm.createContext(ctx); vm.runInContext(source,ctx);
  return {ctx,calls,local,errors, renders:()=>renders, deny:()=>{failNext=true;}};
}
test('fleet render loads server rates; reads are copies; unrelated blobs pass through',async()=>{
  const h=harness(); await h.ctx.ctRender();
  assert.equal(h.calls[0][0],'GET'); assert.equal(h.renders(),1);
  const r=h.ctx.ctRead('van_rates'); assert.equal(r.own.base,900); r.own.base=7;
  assert.equal(h.ctx.ctRead('van_rates').own.base,900);
  h.ctx.ctWrite('other',{x:1}); assert.equal(h.local[0][1],'other');
});
test('cell edits and clears write server; rapid edits retain both changes',async()=>{
  const h=harness(); await h.ctx.ctRender();
  const r=h.ctx.ctRead('van_rates'); r.own.base=1000;
  const p=h.ctx.ctWrite('van_rates',r);
  const r2=h.ctx.ctRead('van_rates'); r2.own.rt={route1:{PK:1200,KL:1300}};
  const p2=h.ctx.ctWrite('van_rates',r2); await Promise.all([p,p2]);
  assert.equal(h.ctx.ctRead('van_rates').own.rt.route1.KL,1300);
  assert.equal(h.calls.filter(c=>c[0]==='PUT').length,3);
  const r3=h.ctx.ctRead('van_rates'); delete r3.own.rt.route1.PK; await h.ctx.ctWrite('van_rates',r3);
  assert.equal(h.calls.at(-1)[2].rate,null); assert.equal(h.local.length,0);
});
test('failed write reloads server state and reports error',async()=>{
  const h=harness(); await h.ctx.ctRender(); h.deny();
  await h.ctx.ctWrite('van_rates',{own:{base:777}});
  assert.equal(h.ctx.ctRead('van_rates').own.base,900);
  assert.deepEqual(h.errors,['denied']); assert.equal(h.calls.at(-1)[0],'GET');
});
test('legacy mode retains original blob behavior without API calls',()=>{
  const h=harness(false); h.ctx.ctRead('van_rates'); h.ctx.ctWrite('van_rates',{}); h.ctx.ctRender();
  assert.equal(h.local.length,2); assert.equal(h.calls.length,0); assert.equal(h.renders(),1);
});

/* ── C7h hardening ── */
function harness2({ getFails = false, view = '', gate = false } = {}) {
  let rows = [{group_key:'own', route_id:null, field:'base', rate:900}];
  let chain = Promise.resolve(), failPut = false, release = null, hold = false;
  const calls = [], errors = [], redraws = [], host = { innerHTML: '' };
  const ctx = { console, Promise, document:{getElementById:id=>id==='ct-body'?host:null}, ctRender(){ host.innerHTML='ORIG'; ctx.__r=(ctx.__r||0)+1; },
    ctRead(){return null;}, ctWrite(){}, renderDailyReport(){ redraws.push('dailyreport'); } };
  ctx.window = ctx;
  ctx.laOps = { enabled:()=>true, clone:v=>JSON.parse(JSON.stringify(v)), onChange(){}, busy:()=>false, activeView:()=>view,
    fail:(t,e)=>errors.push(e.message),
    get: async path => { calls.push(['GET',path]); if(getFails) throw Error('down');
      if(hold){ await new Promise(r=>{ release=r; }); } return {rates:rows}; },
    queue(fn){ const p=chain.then(fn); chain=p.catch(()=>{}); return p; },
    call: async (m,path,body) => { calls.push([m,path,body]); if(failPut){ failPut=false; throw Error('denied'); }
      rows=rows.filter(c=>!(c.group_key===body.group && c.route_id===body.route_id && c.field===body.field));
      if(body.rate!==null) rows.push({group_key:body.group,route_id:body.route_id,field:body.field,rate:body.rate});
      return {rates:JSON.parse(JSON.stringify(rows))}; } };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  return { ctx, host, errors, redraws, calls, denyPut:()=>{failPut=true;}, holdGet:()=>{hold=true;}, releaseGet:()=>{hold=false; release&&release();} };
}
const tick = () => new Promise(r => setTimeout(r, 5));

test('C7h-1: when GET /v1/van-rates fails, Costing draws a visible rates-unavailable note (not blank)', async () => {
  const h = harness2({ getFails: true });
  await h.ctx.ctRender();
  assert.match(h.host.innerHTML, /Van rates are unavailable/);
  assert.match(h.host.innerHTML, /data-van-rates-unavailable/);
  assert.deepEqual(h.errors, ['down']);
});

test('C7h-2: first successful load redraws the active reader view (not repeated after)', async () => {
  const h = harness2({ view: 'dailyreport' });
  assert.equal(h.ctx.ctRead('van_rates'), null);   // triggers first load
  await tick();
  assert.deepEqual(h.redraws, ['dailyreport']);
  await h.ctx.ctRender(); await tick();
  assert.deepEqual(h.redraws, ['dailyreport']);     // loaded once, no further refresh
  const other = harness2({ view: 'booking' });
  other.ctx.ctRead('van_rates'); await tick();
  assert.deepEqual(other.redraws, []);
});

test('C7h-3: refused write restores the pre-edit value immediately, before the reload answers', async () => {
  const h = harness2();
  await h.ctx.ctRender();
  const r = h.ctx.ctRead('van_rates'); r.own.base = 777;
  h.denyPut(); h.holdGet();
  const p = h.ctx.ctWrite('van_rates', r);
  await tick();                                     // PUT refused, reload GET still pending
  assert.equal(h.ctx.ctRead('van_rates').own.base, 900);
  assert.deepEqual(h.errors, ['denied']);
  h.releaseGet(); await p;
  assert.equal(h.ctx.ctRead('van_rates').own.base, 900);
});
