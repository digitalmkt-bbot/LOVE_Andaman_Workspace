// §opsAgents · server-first Agent adapter checks without a backend.
// The static harness supplies the legacy UI; this test replaces laOps.call with
// a controllable fake so no localStorage or database is touched.
import assert from 'node:assert/strict';
import { open } from './_harness.mjs';

const { page, errors, close } = await open({ width: 1440, height: 1000 });
let bad = 0;
const ok = m => console.log('  ✓ ' + m);
const fail = m => { bad++; console.log('  ✗ ' + m); };

await page.evaluate(() => {
  window.LA_LEGACY_UNAVAILABLE = true;
  sessionStorage.setItem('la_ops_token', 'test-token');
  window.laOps.enabled = () => true;
  window.__agentCalls = [];
  window.laOps.call = (method, path, body) => {
    window.__agentCalls.push({ method, path, body });
    if(method === 'POST' && path === '/v1/agents') return new Promise(resolve => { window.__agentResolve = resolve; });
    if(method === 'PATCH') return Promise.resolve(window.__agentEditResponse);
    return Promise.resolve(null);
  };
});

const before = await page.evaluate(() => {
  _agNewDraft = {
    name:'Ops Test Agent', code:'', market:'mkt_test', sub:'Sub', sales:'sales_test', payType:'bank', vatMode:'exclude',
    creditDays:14, creditLimit:5000, contact:'Test Contact', email:'test@example.test', phone:'+66 80 000 0000', note:'ops test',
    legalName:'Ops Test Co.', taxId:'0105555555555', tatLicense:'TAT-1', address:'1 Test Road', website:'test.example',
    sigName:'Signer', sigDesignation:'Director', sigTel:'+66 80 000 0000', rateTypeId:'rt_test'
  };
  return SB_AGENTS.length;
});
const createPromise = page.evaluate(() => agCreateSubmit());
await page.waitForTimeout(50);
const pending = await page.evaluate(() => ({ n:SB_AGENTS.length, call:window.__agentCalls[0] }));
if(pending.n !== before) fail('create changed SB_AGENTS before the server response');
else ok('create leaves in-memory agents unchanged while request is pending');
if(pending.call?.method !== 'POST' || pending.call?.path !== '/v1/agents' || pending.call?.body?.pay_type !== 'bt'
   || pending.call?.body?.company?.legal_name !== 'Ops Test Co.')
  fail('create payload did not use the documented nested/snake-case contract');
else ok('create sends nested company data and maps bank to bt');
await page.evaluate(() => window.__agentResolve({
  id:'ops_test_agent', code:'OPSTEST', name:'Ops Test Agent', active:true, house:false,
  market_id:'mkt_test', sub_market:'Sub', sales_id:'sales_test', color:null, pay_type:'bt', vat_mode:'exclude',
  credit_days:14, credit_limit:5000, rate_type_id:'rt_test', contract_status:'active', contract_version:null,
  contract_start:null, contract_end:null, contract_template_id:null, contact:'Test Contact', email:'test@example.test', phone:'+66 80 000 0000', note:'ops test',
  company:{legal_name:'Ops Test Co.',tax_id:'0105555555555',tat_license:'TAT-1',address:'1 Test Road',tel:'+66 80 000 0000',hotline:null,fax:null,website:'test.example'},
  signatory:{name:'Signer',designation:'Director',tel:'+66 80 000 0000',signed_date:null},
  booking_channel:{method:null,cutoff:null,cancel_policy:null,email:null,phone:null}, programs:[], rate_seasons:[], created_at:'now', updated_at:'now'
}));
await createPromise;
const created = await page.evaluate(() => SB_AGENTS.find(a => a.id === 'ops_test_agent'));
if(!created || created.payType !== 'bank' || created.companyInfo.legalName !== 'Ops Test Co.') fail('successful create did not replace the local projection');
else ok('successful create replaces the local projection from the server response');

const editSetup = await page.evaluate(() => {
  const a=SB_AGENTS.find(x=>x.id==='ops_test_agent');
  _agEditAgentId=a.id; _agEditSection='company';
  _agEditDraft={name:'Ops Edited Agent',market:'mkt_test',sub:'New Sub',email:'edited@example.test',color:'',legalName:'Ops Test Co.',taxId:'0105555555555',tatLicense:'TAT-1',address:'2 Test Road',tel:'+66 80 000 0000',hotline:'',fax:'',website:'test.example'};
  window.__agentEditResponse={...a,name:'Ops Edited Agent',sub_market:'New Sub',email:'edited@example.test',company:{legal_name:'Ops Test Co.',tax_id:'0105555555555',tat_license:'TAT-1',address:'2 Test Road',tel:'+66 80 000 0000',hotline:null,fax:null,website:'test.example'}};
  return a.name;
});
await page.evaluate(() => agEditSave());
const editCall = await page.evaluate(() => window.__agentCalls.at(-1));
const edited = await page.evaluate(() => SB_AGENTS.find(a => a.id === 'ops_test_agent'));
if(editCall?.method !== 'PATCH' || editCall?.body?.company?.legal_name !== 'Ops Test Co.' || editSetup === edited.name)
  fail('edit did not wait for the server or send nested company fields');
else ok('edit uses PATCH and updates the projection only after success');

await page.evaluate(() => {
  window.laOps.call = () => Promise.reject(Object.assign(new Error('denied'), { status:403 }));
  _agEditAgentId='ops_test_agent'; _agEditSection='notes'; _agEditDraft={note:'must not persist'};
});
await page.evaluate(() => agEditSave());
const afterFailure = await page.evaluate(() => SB_AGENTS.find(a => a.id === 'ops_test_agent').note);
if(afterFailure === 'must not persist') fail('failed edit changed the in-memory projection');
else ok('failed edit leaves the in-memory projection untouched');

const realErrors = errors.filter(x => !/Failed to load resource|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|net::ERR_/.test(x));
if(realErrors.length){ bad += realErrors.length; realErrors.forEach(x => console.log('  ✗ '+x)); }
console.log('Agent ops adapter failures: '+bad);
await close();
assert.equal(bad,0);
