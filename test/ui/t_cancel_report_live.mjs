import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Read-only localhost fixture: the real mapper, range loader and renderer run in
// Chromium. Every browser request is intercepted; only local booking GETs pass.
const OPS='http://localhost:3100';
const auth=await (await fetch(OPS+'/v1/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'cmpadmin',password:'cmpadmin'})})).json();
assert.ok(auth.access_token,'local login');
const browser=await chromium.launch({channel:'chrome'});
try{
 const context=await browser.newContext();const external=[];const calls=[];
 await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin===OPS && r.method()==='GET' && u.pathname==='/v1/bookings'){
     calls.push(u.search);
     const result=await fetch(u.href,{headers:{authorization:'Bearer '+auth.access_token}});
     return route.fulfill({status:result.status,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:await result.text()});
   }
   external.push(r.url());await route.abort();
 });
 const page=await context.newPage();await page.setContent('<main id="report"></main>');
 await page.evaluate(()=>{
   window.LA_LEGACY_UNAVAILABLE=true;window.laOps={enabled:()=>false,state:{loaded:false}};
   window.SB_BOOKINGS=[];window._bkV2={month:'2026-10',tab:'cancel'};window._bkV2CityTourOnly=false;
   window.bookingV2LocalYMD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
   window.bookingV2PaxAllTot=p=>Object.values(p).reduce((s,n)=>s+(+n||0),0);
   window.laOpsFetch=p=>fetch('http://localhost:3100'+p);
 });
 for(const file of ['ops/40-ops-bookings.js','booking/bookingV2FromOpsBooking.js','booking/bookingV2LoadFromOpsBackend.js','booking/bookingV2RenderCancelReport.js']) await page.addScriptTag({content:fs.readFileSync('allotment_v2/js/'+file,'utf8')});
 await page.evaluate(()=>{
   window.bookingV2Render=()=>document.querySelector('#report').innerHTML=bookingV2RenderCancelReport();
   bookingV2Render();
 });
 await page.waitForFunction(()=>document.querySelector('#report').textContent.includes('Fees collected'),null,{timeout:60000});
 const result=await page.evaluate(()=>{
   const inMonth=b=>b.trips.some(t=>t.date>='2026-10-01' && t.date<='2026-10-31');
   const cancelled=SB_BOOKINGS.filter(inMonth).filter(b=>['cancelled','cancelled_weather'].includes(b.status));
   const count=cancelled.length,fee=cancelled.reduce((s,b)=>s+(b.cancellation?.chargeAmount||0),0);
   const before=document.querySelector('#report').innerHTML;
   SB_BOOKINGS.push({_fromOpsBackend:true,status:'cancelled',trips:[{date:'2025-01-01',pax:{adult:999}}],cancellation:{category:'zz-outside',group:'operator',chargeAmount:999999}});
   bookingV2Render();
   return {count,fee,html:document.querySelector('#report').innerHTML,unchanged:before===document.querySelector('#report').innerHTML,mapped:cancelled.filter(b=>b.cancellation).length};
 });
 assert.ok(result.count>0);assert.ok(result.mapped>0);assert.ok(result.unchanged);
 assert.ok(result.html.includes('฿'+Math.round(result.fee).toLocaleString()));
 assert.ok(calls.length>0);assert.ok(calls.every(q=>q.includes('from=2026-10-01')&&q.includes('to=2026-10-31')&&q.includes('limit=500')));
 assert.deepEqual(external,[],'zero external escapes');
 console.log(JSON.stringify({cancelled:result.count,mapped:result.mapped,fees:result.fee,pages:calls.length,externalEscapes:external.length,outsideWindowExcluded:result.unchanged}));
}finally{await browser.close();}
