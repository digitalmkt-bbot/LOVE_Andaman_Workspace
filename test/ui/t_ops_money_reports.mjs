// M4 · computed accounting/report adapters use operation-backend payloads.
// The static harness supplies the classic-script app; API calls are faked so no
// localStorage or database is used.
import assert from 'node:assert/strict';
import { open } from './_harness.mjs';

const { page, errors, close } = await open({ width: 1440, height: 1000 });
let bad = 0;
const ok = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

const accounting = {
  as_of:'2026-10-10', outstanding:1200, paid_this_month:800, credit_exposure:500,
  overdue_invoices:2, deposits_held:300, extras_this_month:90,
  aging:{not_due:400,days_1_30:500,days_31_60:200,days_60_plus:100},
  refunds_to_pay:{count:1,amount:70,items:[]},
  collections:[{month:'2026-05',amount:10},{month:'2026-06',amount:20}],
  top_outstanding:[{agent_id:'a1',name:'Server Agent',balance:1200}]
};
const statement = {agent_id:'a1',name:'Server Agent',code:'SA',pay_type:'invoice',invoiced:2000,paid:800,outstanding:1200,
  credit_balance:{available:300,held:0},credit:{limit:5000,used:1200,available:3800},
  invoices:[{id:'i1',number:'INV-1',kind:'booking',issued_at:'2026-10-01',due_at:'2026-10-31',total:2000,paid:800,balance:1200,status:'open'}],
  credits:[{id:'r1',invoice_id:'i1',invoice_number:'INV-1',booking_id:'b1',amount:50,reason:'Weather credit',created_at:'2026-10-03'}],deposits:[{id:'d1',amount:300,method:'transfer',received_on:'2026-10-02',ref:'DEP-1',note:'test'}]};
const travel = {date:'2026-10-10',bookings:2,booked:5,travelled:4,no_show:1,cxl:0,
  money:{cash:100,transfer:200,card:0,received:300,fees:0,pier:{cash:100,transfer:200,card:0,total:300,fees:0,no_slip:0},sales:0,sales_due:0,sales_count:0,commission:0,sales_fees:0,sales_by:{cash:0,transfer:0,card:0},sales_no_slip:0,no_slip:0,cash_on_tour:0,to_collect:100,to_collect_bookings:1,due:100,net:300},
  cot:{total:0,deduct:0,payout:0,not_collected:0,not_collected_bookings:0,undecided_bookings:0},
  noshow:{cases:1,pending:1,decided:0,postponed:0,charged:0},collect_rows:[{booking_id:'b1',voucher_ref:'V1',route_id:'r1',target:100,paid:0,due:100,not_counted:null}]};
const daily = {date:'2026-10-10',bookings:2,pax:{ad:4,chd:1,inf:0,foc:0,total:5},paying_pax:5,revenue:2500,revenue_per_pax:500,
  by_route:[{route_id:'r1',name:'Route 1',bookings:2,pax:5,revenue:2500,per_pax:500,share_pct:100}],by_market:[],
  by_channel:{invoice:2500,proforma:0,cot:0,transfer:0,other:0},by_agent:[{key:'a1',agent_id:'a1',name:'Server Agent',bookings:2,ad:4,chd:1,inf:0,foc:0,pax:5,revenue:2500,due:100,docs:{}}],
  upgrades:{collected:0,due:0},due:100,got:300,no_slip:0,extras:0,
  van_cost:{total:600,estimated:false,vans:1,default_rate_vans:0,per_van_fallback:1200,by_van:{v1:600}}};
const settings = {van_cost:1200,van_quota:6,target_per_pax:130,set:{van_cost:null,van_quota:null,target_per_pax:null},updated_at:null,updated_by:null};

await page.evaluate(({accounting,statement,travel,daily,settings}) => {
  window.LA_LEGACY_UNAVAILABLE = true;
  sessionStorage.setItem('la_ops_token','test-token');
  window.laOps.enabled = () => true;
  window.__moneyCalls = [];
  const response = (method,path,body) => {
    window.__moneyCalls.push({method,path,body});
    if(path === '/v1/reports/accounting') return Promise.resolve(accounting);
    // the accounting screen reads the money lists too (w5-c): none here
    if(path === '/v1/invoices') return Promise.resolve({invoices:[]});
    if(path === '/v1/deposits') return Promise.resolve({deposits:[]});
    if(path === '/v1/refunds') return Promise.resolve({refunds:[]});
    // the Travel Summary also reads the day's check-in rows, vans, bookings and stranded vans (w5-c / w5-d): none here
    if(path.startsWith('/v1/after-trip')) return Promise.resolve({rows:[],bookings:[]});
    if(path === '/operations/vans') return Promise.resolve({vans:[]});
    if(path.startsWith('/v1/bookings?')) return Promise.resolve({bookings:[]});
    if(path.startsWith('/operations/van-strands')) return Promise.resolve({strands:[]});
    if(path === '/v1/agents/a1/statement') return Promise.resolve(statement);
    if(path.startsWith('/v1/reports/travel-summary')) return Promise.resolve(travel);
    if(path.startsWith('/v1/reports/daily/settings')) return method === 'PUT' ? Promise.resolve({...settings,...body,set:{...settings.set,...body}}) : Promise.resolve(settings);
    if(path.startsWith('/v1/reports/daily')) return Promise.resolve({...daily,settings});
    // other screens' reads (van board, van jobs, the trend days, ...) answer with nothing: this test is about the report payloads
    if(method === 'GET') return Promise.resolve({});
    return Promise.reject(new Error('unexpected report call '+method+' '+path));
  };
  // laOps.get is a convenience closure in 00-ops-core, so replace both
  // entry points here while keeping the adapter on its real O.get/O.call API.
  window.laOps.call = response;
  window.laOps.get = (path,query) => response('GET',path+(query ? '?'+Object.entries(query).map(([k,v]) => k+'='+v).join('&') : ''));
  window.__moneyBlobBefore = localStorage.getItem('loveandaman_v2');

  ['acct-body','travelsum-host','dailyreport-host'].forEach(id => {
    if(!document.getElementById(id)){ const el=document.createElement('div'); el.id=id; document.body.appendChild(el); }
  });
}, {accounting,statement,travel,daily,settings});

await page.evaluate(() => renderAccounting());
await page.waitForFunction(() => document.querySelector('[data-ops-money-kpis]'));
let s = await page.evaluate(() => ({
  kpis:document.querySelector('[data-ops-money-kpis]')?.innerText || '',
  dashboard:document.querySelector('[data-ops-money-dashboard]')?.innerText || '',
  calls:window.__moneyCalls.slice()
}));
if(!s.kpis.includes('฿1,200') || !s.dashboard.includes('Receivables aging')) fail('accounting view did not render server dashboard payload');
else ok('accounting dashboard/KPIs render the server response');
if(s.calls.some(x => x.path === '/v1/reports/accounting' && x.method === 'GET')) ok('accounting uses the documented GET endpoint');
else fail('accounting endpoint was not called');

await page.evaluate(() => acctStatementOpen('a1'));
await page.waitForFunction(() => document.querySelector('#acct-modal')?.innerText.includes('Server Agent'));
s = await page.evaluate(() => ({text:document.querySelector('#acct-modal')?.innerText || '', calls:window.__moneyCalls.slice()}));
if(s.text.includes('INV-1') && s.text.includes('฿1,200') && s.text.includes('Weather credit')) ok('agent statement renders the server statement payload');
else fail('agent statement did not render server values');
if(s.calls.some(x => x.path === '/v1/agents/a1/statement')) ok('statement uses the documented agent endpoint');
else fail('statement endpoint was not called');

await page.evaluate(() => { _tsDate='2026-10-10'; renderTravelSum(); });
await page.waitForFunction(() => document.querySelector('[data-ops-ts-view]'));
// the screen is the sheet of 59-ops-travelsum-view.js (not the plain table this test first drew): it mounts and asks the documented endpoint
s = await page.evaluate(() => ({mounted:!!document.querySelector('#travelsum-host [data-ops-ts-view]'), calls:window.__moneyCalls.map(x => x.method+' '+x.path)}));
if(s.mounted && s.calls.includes('GET /v1/reports/travel-summary?date=2026-10-10')) ok('Travel Summary mounts the server-drawn sheet and reads the documented endpoint');
else fail('Travel Summary did not render server payload');

await page.evaluate(() => { _drDate='2026-10-10'; renderDailyReport(); });
await page.waitForFunction(() => document.querySelector('#dailyreport-host')?.innerText.includes('Daily Report'));
await page.waitForTimeout(500);
// the screen is 59-ops-daily-report.js (boats, vans and a trend as well): this test only checks the report is asked from the server
s = await page.evaluate(() => ({calls:window.__moneyCalls.map(x => x.method+' '+x.path)}));
if(s.calls.includes('GET /v1/reports/daily?date=2026-10-10')) ok('Daily Report reads the documented daily endpoint');
else fail('Daily Report did not read the server');

await page.evaluate(() => drCfgSet('vanCost','1500'));
await page.waitForTimeout(50);
s = await page.evaluate(() => window.__moneyCalls.find(x => x.method === 'PUT' && x.path === '/v1/reports/daily/settings'));
if(s?.body?.van_cost === 1500) ok('daily settings use the documented PUT payload');
else fail('daily settings did not send van_cost');

const beforeLegacy = await page.evaluate(() => window.__moneyCalls.length);
await page.evaluate(() => { window.laOps.enabled = () => false; renderTravelSum(); renderDailyReport(); });
await page.waitForTimeout(30);
const afterLegacy = await page.evaluate(() => window.__moneyCalls.length);
if(afterLegacy === beforeLegacy) ok('legacy mode does not call report endpoints');
else fail('legacy mode called an operation-backend report endpoint');

const finalState = await page.evaluate(() => ({before:window.__moneyBlobBefore, after:localStorage.getItem('loveandaman_v2')}));
if(finalState.before === finalState.after) ok('report reads/settings do not write the legacy blob');
else fail('report adapter mutated the legacy blob');

const realErrors = errors.filter(x => !/Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/.test(x));
if(realErrors.length){ bad += realErrors.length; realErrors.forEach(x => console.log('  ✗ '+x)); }
console.log('Money report adapter failures: '+bad);
await close();
assert.equal(bad,0);
