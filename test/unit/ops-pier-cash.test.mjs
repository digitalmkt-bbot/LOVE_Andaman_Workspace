import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC=fs.readFileSync('allotment_v2/js/ops/46-ops-pier-cash.js','utf8');
const P='panwa', D='2026-10-12', M='2026-10';
function runtime({enabled=true, answers={}, legacyCert=()=>{}}={}){
 const calls=[],fails=[], rows=[],lt=[],pk=[], els={};
 const day={pier:P,date:D,opening:100,closing:70,negative:false,in:20,out:50,net:-30,reference:{longtail:20,park:15,dock:15,total:50},pulled:50,waiting:0,rows:[{id:'pc_1',pier:P,date:D,kind:'out',description:'ice',amount:50,time:'09:00',source:null,created_at:'t',created_by:'GSA'}]};
 const req=(method,path,body)=>{ calls.push({method,path,body}); const a=answers[method+' '+path]; if(a instanceof Error)return Promise.reject(a); return Promise.resolve(typeof a==='function'?a(body):a===undefined?day:a); };
 const w={laOps:{enabled:()=>enabled,get:(p,q)=>req('GET',p+(q?'?'+new URLSearchParams(q):'')),call:req,queue:f=>Promise.resolve().then(f),wrote:()=>{},fail:(t,e)=>fails.push(e)},_pcPier:P,_pcDate:D,_pcYM:M,_pcTab:0,
  pcRowsArr:()=>rows,pcLtArr:()=>lt,pcPkArr:()=>pk,pcSync:()=>{},renderPierCash:()=>{},pcMonthDays:()=>['legacy'],pcOpening:()=>0,pcTotals:()=>({net:0}),pcGuard:()=>true,
  pcRowSave:()=>{throw Error('legacy write')},pcRowDel:()=>{},pcPull:()=>{},pcSetLT:()=>{},pcSetLTNote:()=>{},pcSetPK:()=>{},pcFillPK:()=>{},pc2EdSave:()=>{},pcPax:()=>({n:{ad_th:1,chd_th:2,inf_th:3,foc_th:4,ad_fr:5,chd_fr:6,inf_fr:7,foc_fr:8},ad_th:11,chd_th:12,inf_th:13,foc_th:14,ad_fr:15,chd_fr:16,inf_fr:17,foc_fr:18}),pcNum:v=>+v,pc2HM:v=>v,pc2EdK:()=>P+'|'+D,pc2EdRefresh:()=>{},pcKeep:()=>{},pcWho:()=> 'GSA',pcPrintCert:o=>legacyCert(o,w),pcSelHas:(k,id)=>id==='pc_1',pcDay:()=>({out:[]}),pcThDate:()=>'legacy-date',pcBahtText:()=>'legacy-text',pcCoEdit:cb=>{w._coEdit=cb;},pcCoName:()=>'',pcCoNameSet:()=>{},pcCoSave:()=>{},ckReasonClose:()=>{}};
 const ctx={window:w,console,Promise,Array,Object,Error,String,Number,JSON,Math,encodeURIComponent,URLSearchParams,setTimeout,clearTimeout,alert:()=>{},confirm:()=>true,document:{getElementById:id=>els[id]||null}};
 vm.runInContext(SRC,vm.createContext(ctx)); return {w,calls,fails,rows,lt,pk,els};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('ops petty cash hydrates the legacy ledger and sheet cells from server views',async()=>{
 const longtail={pier:P,month:M,date:D,days:[{date:D,boats:[{boat_id:'b1',cell:{join_boats:2,charter_boats:1,used_boats:3,amount:20,note:'paid',updated_at:'t',updated_by:'GSA'}}]}]};
 const park={pier:P,month:M,date:D,days:[{date:D,boats:[{boat_id:'b1',cell:{ad_th:1,chd_th:0,inf_th:0,foc_th:0,ad_fr:2,chd_fr:0,inf_fr:0,foc_fr:0,amount:15,dock:15,filled_from:'nat',updated_at:'t',updated_by:'GSA'}}]}]};
 const rt=runtime({answers:{['GET /v1/pier-cash/'+P+'/months/'+M+'/longtail?date='+D]:longtail,['GET /v1/pier-cash/'+P+'/months/'+M+'/park?date='+D]:park,['GET /v1/pier-cash/settings']:{company_name:'Love'},['GET /v1/pier-cash/'+P+'/months/'+M]:{pier:P,month:M,days:[{...{date:D,opening:100,closing:70,negative:false,in:20,out:50,net:-30,reference:{longtail:20,park:15,dock:15,total:50},pulled:50}}]}}});
 await rt.w.laOps.pierCash.loadCurrent(P,D); await flush();
 assert.deepEqual(rt.rows.map(r=>[r.id,r.txt,r.src]),[['pc_1','ice','']]);
 assert.deepEqual(rt.lt.map(r=>[r.bid,r.nj,r.nc,r.amt,r.note]),[['b1',2,1,20,'paid']]);
 assert.deepEqual(rt.pk.map(r=>[r.bid,r.ad_th,r.ad_fr,r.amt,r.dock]),[['b1',1,2,15,15]]);
 assert.equal(rt.w.pcCoName(),'Love');
});
test('manual row, delete, pull, sheets and company name write server-first',async()=>{
 const base='/v1/pier-cash/'+P+'/days/'+D;
 const rt=runtime({answers:{
  ['POST '+base+'/rows']:{row:{},day:{pier:P,date:D,rows:[],in:30,out:0,net:30,opening:0,closing:30,reference:{longtail:0,park:0,dock:0,total:0},pulled:0,waiting:0}},
  ['DELETE /v1/pier-cash/rows/pc_1']:{day:{pier:P,date:D,rows:[],in:0,out:0,net:0,opening:0,closing:0,reference:{longtail:0,park:0,dock:0,total:0},pulled:0,waiting:0}},
  ['POST '+base+'/pull']:{day:{pier:P,date:D,rows:[],in:0,out:20,net:-20,opening:0,closing:-20,reference:{longtail:20,park:0,dock:0,total:20},pulled:20,waiting:0}},
  ['PATCH '+base+'/longtail/b1']:{},['PATCH '+base+'/park/b1']:{},['PUT /v1/pier-cash/settings']:{company_name:'New Co'} }});
 rt.els['pc-r-txt']={value:'float'};rt.els['pc-r-amt']={value:'30'};rt.els['pc-r-at']={value:'10:30'};
 await rt.w.pcRowSave('in'); await rt.w.pcRowDel('out','pc_1'); await rt.w.pcPull(D); await rt.w.pcSetLT(D,'b1','nj','2'); await rt.w.pcSetPK(D,'b1','dock','10'); await rt.w.pcCoNameSet('New Co');
 const writes=rt.calls.filter(x=>x.method!=='GET').map(x=>[x.method,x.path,x.body]);
 assert.deepEqual(JSON.parse(JSON.stringify(writes)),[['POST',base+'/rows',{kind:'in',description:'float',amount:'30',time:'10:30'}],['DELETE','/v1/pier-cash/rows/pc_1',null],['POST',base+'/pull',{}],['PATCH',base+'/longtail/b1',{join_boats:2}],['PATCH',base+'/park/b1',{dock:10}],['PUT','/v1/pier-cash/settings',{company_name:'New Co'}]]);
 assert.equal(rt.w.pcCoName(),'New Co');
});
test('pcFillPK patches the complete park cell before changing the displayed source',async()=>{
 const base='/v1/pier-cash/'+P+'/days/'+D;
 const rt=runtime({answers:{['PATCH '+base+'/park/b1']:{},['GET '+base]:{pier:P,date:D,rows:[],in:0,out:0,net:0,opening:0,closing:0,reference:{longtail:0,park:0,dock:0,total:0},pulled:0,waiting:0},['GET /v1/pier-cash/'+P+'/months/'+M+'/longtail?date='+D]:{pier:P,month:M,date:D,days:[]},['GET /v1/pier-cash/'+P+'/months/'+M+'/park?date='+D]:{pier:P,month:M,date:D,days:[]},['GET /v1/pier-cash/settings']:{}}});
 rt.pk.push({pier:P,date:D,bid:'b1',amt:99,dock:7}); rt.w._pcFillAsk=D+'::b1';
 await rt.w.pcFillPK(D,'b1',P,'nat');
 const write=rt.calls.find(x=>x.method==='PATCH');
 assert.deepEqual(JSON.parse(JSON.stringify(write.body)),{ad_th:1,chd_th:2,inf_th:3,foc_th:4,ad_fr:5,chd_fr:6,inf_fr:7,foc_fr:8,amount:99,dock:7,filled_from:'nat'});
 assert.equal(rt.w._pcFillAsk,'');
});
test('pc2EdSave posts new rows and edits a saved row with one atomic PATCH',async()=>{
 const base='/v1/pier-cash/'+P+'/days/'+D, day={pier:P,date:D,rows:[],in:0,out:0,net:0,opening:0,closing:0,reference:{longtail:0,park:0,dock:0,total:0},pulled:0,waiting:0};
 const rt=runtime({answers:{['POST '+base+'/rows']:{day},['PATCH /v1/pier-cash/rows/pc_old']:{row:{id:'pc_old'},day}}});
 rt.w._pc2Ed={id:'',kind:'in',src:'',at:'10:00',txt:'float',amt:'25'};
 await rt.w.pc2EdSave();
 rt.w._pc2Ed={id:'pc_old',kind:'out',src:'',at:'11:00',txt:'ice',amt:'30'};
 await rt.w.pc2EdSave();
 assert.deepEqual(JSON.parse(JSON.stringify(rt.calls.filter(x=>x.method!=='GET').map(x=>[x.method,x.path,x.body]))),[
  ['POST',base+'/rows',{kind:'in',description:'float',amount:25,time:'10:00'}],
  ['PATCH','/v1/pier-cash/rows/pc_old',{kind:'out',description:'ice',amount:30,time:'11:00'}]
 ]);
 assert.equal(rt.w._pc2Ed,null);
});
test('a refused row PATCH changes nothing locally, reloads the server day and keeps the editor open',async()=>{
 const base='/v1/pier-cash/'+P+'/days/'+D, day={pier:P,date:D,rows:[],in:0,out:0,net:0,opening:0,closing:0,reference:{longtail:0,park:0,dock:0,total:0},pulled:0,waiting:0};
 const rt=runtime({answers:{['PATCH /v1/pier-cash/rows/pc_1']:new Error('stale'),['GET '+base]:day}});
 rt.rows.push({id:'pc_1',pier:P,date:D,kind:'out',txt:'ice',amt:50});
 const ed={id:'pc_1',kind:'out',src:'',at:'11:00',txt:'ice2',amt:'99'}; rt.w._pc2Ed=ed;
 await rt.w.pc2EdSave(); await flush();
 assert.equal(rt.fails.length,1); assert.equal(rt.w._pc2Ed,ed);
 assert.equal(rt.rows.length,0,'local rows come from the server reload, not from the failed edit');
 assert.ok(rt.calls.some(x=>x.method==='GET'&&x.path===base),'day reloaded from the server');
});
test('certificate is read from the server and fed to the legacy print layout, then legacy helpers are restored',async()=>{
 const base='/v1/pier-cash/'+P+'/days/'+D+'/certificate', cert={pier:P,date:D,date_th:'12/10/2569',company_name:'Love Co',selected:false,rows:[{id:'pc_1',description:'ice',source:null,time:'09:00',amount:50},{id:'pc_2',description:null,source:'park',time:null,amount:20}],total:70,total_text_th:'THAI70'};
 const seen=[];
 const rt=runtime({answers:{['GET '+base]:cert,['GET '+base+'?ids=pc_1']:{...cert,selected:true,rows:[cert.rows[0]]}},legacyCert:(o,w)=>seen.push({only:!!(o&&o.only),co:w.pcCoName(),th:w.pcThDate(D),txt:w.pcBahtText(1),out:w.pcDay(P,D).out,sel:w.pcSelHas('out','zzz')})});
 rt.rows.push({id:'pc_1',pier:P,date:D,kind:'out',txt:'ice',amt:50},{id:'pc_2',pier:P,date:D,kind:'out',txt:'x',amt:20});
 await rt.w.pcPrintCert(); await rt.w.pcPrintCert({only:1});
 assert.deepEqual(rt.calls.map(x=>x.path),[base,base+'?ids=pc_1']);
 assert.equal(seen.length,2);
 assert.deepEqual(JSON.parse(JSON.stringify(seen[0])),{only:false,co:'Love Co',th:'12/10/2569',txt:'THAI70',sel:true,out:[{id:'pc_1',at:'09:00',txt:'ice',amt:50,src:''},{id:'pc_2',at:'',txt:'',amt:20,src:'pk'}]});
 assert.equal(seen[1].only,true);
 assert.equal(rt.w.pcThDate(D),'legacy-date'); assert.equal(rt.w.pcBahtText(1),'legacy-text'); assert.equal(rt.w.pcSelHas('out','zzz'),false);
});
test('certificate: missing company name opens the company dialog then retries; other refusals toast',async()=>{
 const base='/v1/pier-cash/'+P+'/days/'+D+'/certificate', e=Object.assign(new Error('name'),{code:'company_name_missing'}), seen=[];
 const rt=runtime({answers:{['GET '+base]:e},legacyCert:o=>seen.push(o)});
 await rt.w.pcPrintCert(); assert.equal(typeof rt.w._coEdit,'function'); assert.equal(rt.fails.length,0); assert.equal(seen.length,0);
 const rt2=runtime({answers:{['GET '+base]:Object.assign(new Error('boom'),{code:'x'})},legacyCert:o=>seen.push(o)});
 await rt2.w.pcPrintCert(); assert.equal(rt2.fails.length,1); assert.equal(seen.length,0);
 const rt3=runtime({answers:{}}); await rt3.w.pcPrintCert({only:1}); assert.equal(rt3.calls.length,0,'no selection means no request');
});
test('pc2EdSave refuses source rows without a write',()=>{
 const rt=runtime(); rt.w._pc2Ed={id:'pc_source',kind:'out',src:'park',at:'10:00',txt:'park',amt:'20'};
 rt.w.pc2EdSave(); assert.equal(rt.calls.filter(x=>x.method!=='GET').length,0);
});
test('legacy mode delegates without requests',()=>{const rt=runtime({enabled:false});assert.equal(rt.w.pcTotals(P,D).net,0);assert.equal(rt.calls.length,0);});
