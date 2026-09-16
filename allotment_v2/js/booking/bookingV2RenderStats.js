// Stats cards row (4 cards · matches Calendar page top stats with navy hero)
function bookingV2RenderStats(){
  const cur = _bkV2.cursor;
  const ym = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
  const agg = bookingV2Aggregate();
  const todayKey = bookingV2DateKey(new Date());
  const monthLbl = cur.toLocaleDateString('en-US', { month:'long', year:'numeric' }).toUpperCase();

  let mPax=0, mBkSet=new Set(), mFocPending=0, mConfirmed=0, mConfirmedPax=0;
  Object.entries(agg.byDate).forEach(([d,x]) => {
    if(!d.startsWith(ym)) return;
    mPax += x.total;
    x.bookings.forEach(id => mBkSet.add(id));
  });
  SB_BOOKINGS.forEach(bk => {
    // §cityTourView · marine page (flag off) excludes land bookings · land page (flag on) excludes marine
    if(typeof laIsLandRoute==='function'){
      const _isLandBk = bk.schemaVer===2
        ? ((bk.trips&&bk.trips.length) ? bk.trips.some(t=>laIsLandRoute(t&&t.routeId)) : false)
        : laIsLandRoute(bk.programId);
      if(_isLandBk !== _bkV2CityTourOnly) return;
    }
    const norm = bookingV2Norm(bk);
    const t = norm.travelDate || '';
    if(!t.startsWith(ym)) return;
    if(norm.status === 'pending_foc') mFocPending++;
    if(norm.status === 'confirmed'){ mConfirmed++; mConfirmedPax += norm.paxTotal; }
  });
  const lastDay = new Date(cur.getFullYear(), cur.getMonth()+1, 0).getDate();
  const weeksInMonth = Math.max(1, Math.ceil(lastDay / 7));
  const avgPerWeek = Math.round(mPax / weeksInMonth);

  // Today's stats
  const tx = agg.byDate[todayKey];
  const tPax = tx?.total || 0;
  const tBookings = tx?.bookings?.length || 0;
  const tIsCur = todayKey.startsWith(ym);

  /* §mxRead · การ์ดเดิมซ้ำกับชิปมุมขวาบน (993 bookings · 2553 pax) และ "987 confirmed"
     ต้องลบเลขในหัวเองถึงจะรู้ว่าค้างกี่ใบ · ยกส่วนต่างขึ้นมาตรง ๆ แล้วเอาช่องที่เหลือ
     ไปใส่ของที่หาจากที่อื่นไม่ได้ คือวันแน่นสุด/เบาสุดของเดือน */
  const _dayVals = Object.entries(agg.byDate).filter(([d]) => d.startsWith(ym))
                     .map(([d,x]) => ({ d, v: x.total })).filter(o => o.v > 0)
                     .sort((a,b) => b.v - a.v);
  const _hiDay = _dayVals[0] || null, _loDay = _dayVals[_dayVals.length-1] || null;
  const _dNum = k => Number(String(k).slice(8,10));
  const _mDays = new Date(cur.getFullYear(), cur.getMonth()+1, 0).getDate();
  const _pendBk = mBkSet.size - mConfirmed, _pendPax = mPax - mConfirmedPax;
  /* ทริปจริง = จำนวนเส้นทางที่ออกวันนั้น · ของเดิมนับใบจองแล้วเขียนว่า trips */
  const tTrips = tx ? Object.keys(tx.routes || {}).length : 0;

  const card3 = mFocPending > 0
    ? `<div class="bkv2-stat warn">
        <div class="s-lab">รอ FOC</div>
        <div class="s-val">${mFocPending} <span class="s-unit">ใบ</span></div>
        <div class="s-foot">ต้องตรวจก่อนออกเรือ</div>
      </div>`
    : `<div class="bkv2-stat">
        <div class="s-lab">วันแน่นสุด / เบาสุด</div>
        <div class="s-val">${_hiDay?_hiDay.v:'—'} <span class="s-unit">${_loDay?('/ '+_loDay.v):''}</span></div>
        <div class="s-foot">${_hiDay?(_dNum(_hiDay.d)+' · '+_dNum(_loDay.d)+' ของเดือน'):'ยังไม่มีข้อมูล'}</div>
      </div>`;

  return `
    <div class="bkv2-stats">
      <div class="bkv2-stat hero">
        <div class="s-lab">${monthLbl}</div>
        <div class="s-val">${mPax.toLocaleString()} <span class="s-unit">pax</span></div>
        <div class="s-foot">${mBkSet.size} ใบจอง &middot; เฉลี่ย ${Math.round(mPax/_mDays)} pax/วัน</div>
      </div>
      <div class="bkv2-stat${_pendBk>0?' alert':' success'}">
        <div class="s-lab">${_pendBk>0?'ยังไม่ยืนยัน':'ยืนยันครบแล้ว'}</div>
        <div class="s-val">${_pendBk>0?_pendBk:mConfirmed} <span class="s-unit">ใบ</span></div>
        <div class="s-foot">${_pendBk>0?(`<b>${_pendPax} pax</b> &middot; จาก ${mBkSet.size} ใบ`):(mConfirmedPax.toLocaleString()+' pax')}</div>
      </div>
      ${card3}
      <div class="bkv2-stat">
        <div class="s-lab">${tIsCur?'วันนี้':'Today'}</div>
        <div class="s-val">${tIsCur?tPax:'—'} <span class="s-unit">${tIsCur?'pax':''}</span></div>
        <div class="s-foot">${tIsCur?(tBookings+' ใบจอง &middot; '+tTrips+' ทริป'):'ไม่ได้อยู่ในเดือนที่ดู'}</div>
      </div>
    </div>
  `;
}
