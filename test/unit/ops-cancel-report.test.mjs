import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../allotment_v2/js/booking/bookingV2RenderCancelReport.js',import.meta.url),'utf8');
test('mapped record overrides weather status and stale local category/group',()=>{
  const c={window:{LA_LEGACY_UNAVAILABLE:true},console,Date,_bkV2:{month:'2026-10',tab:'cancel'},_bkV2CityTourOnly:false,
    SB_BOOKINGS:[{_fromOpsBackend:true,status:'cancelled_weather',cancelCategory:'wrong',trips:[{date:'2026-10-14',pax:{adult:2}}],cancellation:{category:'no_show',group:'other',chargeAmount:123,at:'2026-09-30'}}],
    bookingV2LocalYMD:()=> '2026-10-14',_opsBookingMonthRange:()=>({from:'2026-10-01',to:'2026-10-31'}),bookingV2EnsureOpsRange:()=>null,
    bookingV2PaxAllTot:p=>p.adult||0,BKV2_CANCEL_REASONS:[{code:'no_show',group:'customer',en:'No show'}]};
  vm.createContext(c);vm.runInContext(source,c);const html=c.bookingV2RenderCancelReport();
  assert.match(html,/No show/);assert.match(html,/Other 1/);assert.match(html,/฿123/);assert.match(html,/2026-09/);
});
test('cancel report loads its travel month once and respects mapped cancellation category, group, fee and date',async()=>{
  const requests=[]; let resolve, renders=0;
  const c={window:{LA_LEGACY_UNAVAILABLE:true},console,Date,SB_BOOKINGS:[],_bkV2:{tab:'cancel',month:'2026-10'},_bkV2CityTourOnly:false,
    bookingV2LocalYMD:()=> '2026-10-14',_opsBookingMonthRange:()=>({from:'2026-10-01',to:'2026-10-31'}),
    bookingV2EnsureOpsRange:o=>{requests.push(o);return new Promise(r=>{resolve=r});},bookingV2Render:()=>{renders++;c.bookingV2RenderCancelReport();},
    bookingV2PaxAllTot:p=>p.adult||0,BKV2_CANCEL_REASONS:[{code:'no_show',group:'customer',en:'No show'}]};
  vm.createContext(c);vm.runInContext(source,c);
  const book=(date,fee)=>({_fromOpsBackend:true,status:'cancelled_weather',cancelCategory:'wrong',trips:[{date,pax:{adult:2}}],cancellation:{category:'no_show',group:'operator',chargeAmount:fee,at:'2026-09-30'}});
  const current=book('2026-10-14',123);
  current.trips.push({date:'2026-09-30',pax:{adult:100}});
  current.partialCancels=[{date:'2026-09-30',category:'outside',count:100}];
  c.SB_BOOKINGS=[book('2026-09-30',999),current];
  const loading=c.bookingV2RenderCancelReport();c.bookingV2RenderCancelReport();
  assert.match(loading,/Loading cancellation report/);assert.doesNotMatch(loading,/No cancellations yet/);
  resolve({bookings:[]});await new Promise(r=>setImmediate(r));
  const html=c.bookingV2RenderCancelReport();
  assert.equal(requests.length,1);assert.deepEqual(JSON.parse(JSON.stringify(requests[0])),{from:'2026-10-01',to:'2026-10-31',limit:500});
  assert.match(html,/Travel period: 2026-10-01 → 2026-10-31/);assert.match(html,/Operator 1/);assert.match(html,/No show/);assert.match(html,/฿123/);assert.doesNotMatch(html,/฿999/);assert.match(html,/2026-09/);
  assert.equal(renders,1);assert.equal(requests.length,1);
  assert.doesNotMatch(html,/outside|102/);
  c._bkV2CancelLoad.at=0;
  c.bookingV2RenderCancelReport();resolve(null);await new Promise(r=>setImmediate(r));
  const failed=c.bookingV2RenderCancelReport();assert.match(failed,/could not load/);assert.doesNotMatch(failed,/Fees collected|No cancellations yet/);
});
