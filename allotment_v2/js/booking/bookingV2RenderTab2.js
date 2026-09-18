function bookingV2RenderTab2(){
  if(typeof bookingV2HealOvnLegs==='function') bookingV2HealOvnLegs();   // §OVN · a return leg must never carry a pickup
  /* §ovnSpan · ตัวซ่อมเดิมผมไปแขวนไว้ใน renderVanJobs ซึ่งทำงานต่อเมื่อเปิดหน้าใบงานรถ
     ใบค้างเกาะเป็นเรื่องของเรือ คนที่ต้องเห็นคือคนจ่ายเรือ · ย้ายมาที่หน้า By trip */
  if(typeof bkOvnHealSpans==='function') bkOvnHealSpans();     // §ovnSpan · จองเรือให้ครบช่วงของใบค้างเกาะ
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const P = (pax,k)=> bookingV2PaxTot(pax||{}, k);
  // §cityTourView · land trips never need a boat · force off regardless of a stale toggle from the marine page
  const boatMode = !_bkV2CityTourOnly && !!_bkV2.boatAssignMode;   // Boat Assign mode → extra Boat column + auto-assign
  const vanMode = !!_bkV2.vanAssignMode;     // Van Assign mode → extra Van column + pickup time + job order
  const rcMode = !!_bkV2.reconfirmMode;      // Re-Confirm mode → extra Re-confirm column
  const date = bookingV2Tab2ActiveDate();
  if(typeof bookingV2CharterBoatHeal==='function') bookingV2CharterBoatHeal(date);   // charter booking → ops.boatId = charterBoatId (assigned to its own boat · §59/§50)
  if(typeof bookingV2HealAltSplits==='function') bookingV2HealAltSplits(date);   // §altPickups · ALWAYS ensure auto van-splits exist for รับหลายจุด bookings (so they render as separate rows here too, not only in Van Assign)
  if(typeof bookingV2HealSelfArrivePickup==='function') bookingV2HealSelfArrivePickup(date);   // §self-arrive · ล้างเวลารับรถที่ค้างเมื่อสลับเป็น No-Transfer (เหลือ default "…at pier")
  if(vanMode && typeof bookingV2VanGroupHeal==='function') bookingV2VanGroupHeal(date);   // keep grouped bookings' vanId in sync (safety net · prevents ตกบุคกิ้ง)
  const dObj = new Date(date + 'T00:00');
  const dateBig = dObj.toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});

  // Collect (booking, trip) rows for this date
  const rows = [];
  SB_BOOKINGS.forEach(bk=>{
    if(bk.schemaVer===2){
      /* §ovnRow · วันระหว่างทางของใบเหมาค้างเกาะ · ใบไม่มี trip ในวันนั้น
         แต่เรือกับใบยังผูกกันอยู่ · ตารางเลยว่างเปล่าทั้งที่เรือติดงาน
         ทำแถวจำลองจาก trip ขาไป ให้ใบคาอยู่บนตารางทุกวันจนกว่าเรือจะกลับ
         pax เป็นศูนย์ตั้งใจ · วันนั้นไม่มีใครขึ้นเรือ ถ้าใส่ 12 ยอดคนของวันจะเกินจริง
         จำนวนคนที่อยู่บนเกาะไปอยู่บนป้ายของแถวแทน */
      (bk.trips||[]).forEach(t=>{
        if(!t || t.bookingMode!=='charter' || t.ovn!=='return') return;
        { const _isLand = typeof laIsLandRoute==='function' && laIsLandRoute(t.routeId); if(_isLand !== _bkV2CityTourOnly) return; }   // §cityTourView · marine page (flag off) excludes land · land page (flag on) excludes marine
        if(t.date===date || !t.ovnReturnDate || t.ovnReturnDate<=t.date) return;
        if(date<=t.date || date>=t.ovnReturnDate) return;
        if((bk.trips||[]).some(x=>x && x.date===date)) return;   /* วันนั้นมี trip จริงอยู่แล้ว */
        var _all=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0;
        var _d1=Math.round((new Date(date+'T12:00:00')-new Date(t.date+'T12:00:00'))/864e5)+1;
        var _dn=Math.round((new Date(t.ovnReturnDate+'T12:00:00')-new Date(t.date+'T12:00:00'))/864e5)+1;
        rows.push({bk, t, routeId:t.routeId, zone:'__CHARTER__', pax:{}, charter:true,
          charterBoatId:t.charterBoatId||null, pickupTime:'', subtotal:0,
          cxl:['cancelled','rejected','cancelled_weather'].includes(bk.status),
          ovnHoldRow:{from:t.date, to:t.ovnReturnDate, day:_d1, days:_dn, pax:_all}});
      });
      (bk.trips||[]).forEach(t=>{ if(t.date!==date) return; const _isLand=typeof laIsLandRoute==='function' && laIsLandRoute(t.routeId); if(_isLand!==_bkV2CityTourOnly) return; rows.push({bk, t, routeId:t.routeId, zone:(typeof bookingV2EffZone==='function'?bookingV2EffZone(bk,t):(t.zone||bk.pickupZone))||'NoTransfer', pax:t.pax||{}, charter:t.bookingMode==='charter', charterBoatId:t.charterBoatId||null, pickupTime:t.pickupTime||'', subtotal:(typeof tsTripAmount==='function' ? tsTripAmount(bk,t)
   /* §btAmt · ของเดิมเขียน (t.subtotal || bk.total || 0) · "||" ทำให้ขาที่ราคา 0
      (ขากลับค้างคืน · วันที่เพิ่มเข้ามาแล้วยังไม่มีเรต) ตกไปหยิบยอดเต็มของทั้งใบมาแสดง
      ใบ 12 คน 3 วันจึงขึ้น ฿121,800 ทุกแถว = นับซ้ำ 3 รอบในยอดรวมหัวตาราง
      tsTripAmount เป็นตัวเดียวกับที่ Travel Summary ใช้ และกัน ovnLeg ไว้แล้ว
      ที่นี่จึงเรียกใช้ ไม่เขียนกติกาที่สองขึ้นมาอีก */
   : ((bk.trips||[]).length<=1 ? (typeof bk.total==='number'?bk.total:(t.subtotal||0)) : (t.subtotal||0))), cxl:['cancelled','rejected','cancelled_weather'].includes(bk.status)}); });
    } else if(bk.travelDate===date){
      { const _isLand = typeof laIsLandRoute==='function' && laIsLandRoute(bk.programId); if(_isLand !== _bkV2CityTourOnly) return; }   // §cityTourView · marine page (flag off) excludes land · land page (flag on) excludes marine
      rows.push({bk, t:null, routeId:bk.programId, zone:bk.transfer||'NoTransfer', pax:{ad:bk.pax?.adult||0, chd:bk.pax?.child||0, inf:bk.pax?.infant||0, foc:0}, charter:false, charterBoatId:null, pickupTime:'', subtotal:bk.total||0, cxl:['cancelled','rejected','cancelled_weather'].includes(bk.status)});
    }
  });

  // ── Filters: pier + program family (+ optional route from calendar drill) ──
  const pierF = _bkV2T2Pier || 'all';
  const famF = _bkV2T2Family || '';
  const routeF = _bkV2.filterRoute;
  const rowsPier = rows.filter(r=>{ if(pierF==='all') return true; const rt=ROUTES.find(x=>x.id===r.routeId); return rt?.pier===pierF; });
  // program-family options available on this date under the current pier (+ families that have locks)
  const _lockFamIds = (typeof SB_SEAT_LOCKS!=='undefined') ? SB_SEAT_LOCKS.filter(l=>l.status==='active' && bookingV2LocksFor(l.routeId,date).includes(l)).map(l=>bookingV2RouteFamily(l.routeId)?.id) : [];
  const famOpts = (window._BKV2_FAMILIES || []).filter(f =>
    rowsPier.some(r=>bookingV2RouteFamily(r.routeId)?.id===f.id) ||
    (typeof ROUTES!=='undefined' && ROUTES.some(r=>bookingV2RouteFamily(r.id)?.id===f.id && bookingV2LocksFor(r.id,date).length>0 && (pierF==='all'||r.pier===pierF)))
  );
  /* §btHead · คำค้นกรองตรงนี้จุดเดียว · voucher / ชื่อ / เบอร์ / โรงแรม / เอเยนต์ */
  const _btQ = String(_bkV2T2Q||'').toLowerCase().trim();
  const _btHit = r => {
    if(!_btQ) return true;
    const b=r.bk||{}; const ag=(typeof sbGetAgent==='function')?(sbGetAgent(b.agentId)||{}):{};
    const hay=[b.voucherRef,b.code,b.id,b.leadPax,b.customerName,b.phone,b.customerPhone,
               b.hotelName,b.pickupHotelName,b.pickupArea,ag.name,ag.code]
      .concat((b.altPickups||[]).map(a=>a&&a.place))
      .filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(_btQ)>=0;
  };
  const rowsF = rowsPier.filter(r=>{
    if(famF && (bookingV2RouteFamily(r.routeId)?.id)!==famF) return false;
    if(routeF && r.routeId!==routeF) return false;
    if(!_btHit(r)) return false;
    return true;
  });
  /* ══ §btLkHit · booking ที่ดึงที่นั่งจากล็อคของเจ้าที่เลือกไว้ ═══════════════
     ความสัมพันธ์ booking↔ล็อค ไม่ได้เก็บบนตัว booking · อยู่ใน lock.log[]
     ({type:'draw', bookingId, qty}) ซึ่งมี bookingId ครบ 471 จาก 472 รายการดึง
     จึงย้อนกลับได้โดยไม่ต้องแก้โครงสร้างข้อมูล                                  */
  const _btLkSel = String(_bkV2T2Lk||'');
  const _btLkIds = new Set();
  if(_btLkSel){
    (typeof SB_SEAT_LOCKS!=='undefined'?SB_SEAT_LOCKS:[]).forEach(l=>{
      if(!l) return;
      const nm=(typeof bookingV2LockHolderName==='function')?bookingV2LockHolderName(l):String(l.holderId||'');
      if(nm!==_btLkSel) return;
      /* เอาเฉพาะการดึงของ "วันนี้" · ล็อคแบบ bulk ใบเดียวถูกดึงข้ามหลายวัน
         ถ้านับทั้งหมดจะได้ 202 booking ทั้งที่วันนี้มีจริงแค่ 3 */
      (l.log||[]).forEach(e=>{ if(!e || e.type!=='draw' || !e.bookingId) return;
        if(e.tripDate && e.tripDate!==date) return;
        _btLkIds.add(String(e.bookingId)); });
    });
  }
  const _btLkCls = id => (_btLkSel && _btLkIds.has(String(id))) ? ' t2-lkhit' : '';

  // ── Manifest column sort (click Agency / Zone header) ──
  const sortCol = _bkV2T2Sort.col, sortDir = _bkV2T2Sort.dir;
  const _sortVal = r => { if(sortCol==='agency'){ const a=sbGetAgent(r.bk&&r.bk.agentId); return (a?(a.name||''):String((r.bk&&r.bk.agentId)||'')).toLowerCase(); } if(sortCol==='zone'){ return String((r.bk&&r.bk.pickupArea)||'').toLowerCase(); } return ''; };
  const _rowCmp = (a,b)=>{ const va=_sortVal(a), vb=_sortVal(b); if(va<vb) return sortDir==='desc'?1:-1; if(va>vb) return sortDir==='desc'?-1:1; return 0; };
  const _sortArrow = c => sortCol===c ? (sortDir==='asc'?' ▲':' ▼') : '';
  /* §btLkHit · นับเฉพาะแถวที่โผล่อยู่บนหน้านี้จริง ๆ · ป้ายบนการ์ดต้องตรงกับที่ตาเห็น */
  const _btLkHitN = _btLkSel ? new Set(rowsF.filter(r=>r.bk && _btLkIds.has(String(r.bk.id))).map(r=>r.bk.id)).size : 0;
  const agencyTh = `<th class="t2-ag" onclick="bookingV2Tab2SetSort('agency')" style="cursor:pointer;user-select:none" title="Sort by agency">Agency${_sortArrow('agency')}</th>`;
  const zoneTh = `<th class="t2-zn" onclick="bookingV2Tab2SetSort('zone')" style="cursor:pointer;user-select:none" title="Sort by pickup area">Zone${_sortArrow('zone')}</th>`;

  // Group by route
  // §pendSeat · แถว "รออนุมัติ" ถูกแยกออกตั้งแต่ตรงนี้ ไม่ใส่ลง groups
  //   โค้ดที่นับ pax / จัดรถ / จัดเรือ / prep ทุกจุดอ่านจาก groups → จึงมองไม่เห็นมันเลย
  //   ปลอดภัยกว่าไล่เติมเงื่อนไขทีละจุด (มีหลายสิบจุด พลาดจุดเดียวตัวเลขก็เพี้ยน)
  const groups = {}, pendGroups = {};
  rowsF.forEach(r=>{
    if(r.bk && r.bk.status==='pending_approval'){ (pendGroups[r.routeId] = pendGroups[r.routeId] || []).push(r); return; }
    (groups[r.routeId] = groups[r.routeId] || []).push(r);
  });
  // Also surface routes that have a seat-lock on this date even with 0 bookings (respect pier + route filter)
  const lockRouteIds = (typeof bookingV2LocksFor==='function')
    ? [...new Set((typeof ROUTES!=='undefined'?ROUTES:[]).map(r=>r.id).filter(rid => bookingV2LocksFor(rid, date).length>0))]
        .filter(rid => {
          // §cityTourView · marine page (flag off) excludes land locks · land page (flag on) excludes marine locks
          if((typeof laIsLandRoute==='function' && laIsLandRoute(rid)) !== _bkV2CityTourOnly) return false;
          if(famF && (bookingV2RouteFamily(rid)?.id)!==famF) return false;
          if(routeF && rid!==routeF) return false;
          if(pierF!=='all'){ const rt=ROUTES.find(x=>x.id===rid); if(rt?.pier!==pierF) return false; }
          return true;
        })
    : [];
  // Surface routes a booking was manually rescheduled AWAY from on this date (so the ghost row shows even with 0 active bookings)
  const reschedFromRouteIds = [...new Set((SB_BOOKINGS||[])
      .filter(b=> b.reschedule && b.reschedule.fromDate===date)
      .flatMap(b=> (b.trips||[]).map(t=>t.routeId)).filter(Boolean))]
    .filter(rid => {
      // §cityTourView · marine page (flag off) excludes land reschedules · land page (flag on) excludes marine
      if((typeof laIsLandRoute==='function' && laIsLandRoute(rid)) !== _bkV2CityTourOnly) return false;
      if(famF && (bookingV2RouteFamily(rid)?.id)!==famF) return false;
      if(routeF && rid!==routeF) return false;
      if(pierF!=='all'){ const rt=ROUTES.find(x=>x.id===rid); if(rt?.pier!==pierF) return false; }
      return true;
    });
  // Group by program family (main trip), order families by earliest departure · variants kept adjacent
  const _famOf = rid => (bookingV2RouteFamily(rid)?.id) || 'zzz';
  const _timeOf = rid => ROUTES.find(x=>x.id===rid)?.times?.[0] || '99:99';
  /* §btOther · ตารางข้างบนคือกระดานจัดเรือ · โปรแกรมที่ไม่ใช้เรือไม่มีช่องให้กรอก
     จึงดึงออกมาไว้ส่วนล่าง (_btOtherSection) แทนการดันเข้าการ์ดเรือที่เติมไม่ได้ */
  const _isLandRid = rid => (typeof laIsLandRoute==='function') && laIsLandRoute(rid);
  const _allRidsAll = [...new Set([...Object.keys(groups), ...Object.keys(pendGroups), ...lockRouteIds, ...reschedFromRouteIds])];
  const _otherRids = _allRidsAll.filter(_isLandRid);
  const _allRids = _allRidsAll.filter(rid => !_isLandRid(rid));
  const _famMinTime = {};
  _allRids.forEach(rid => { const fid=_famOf(rid), t=_timeOf(rid); if(!(fid in _famMinTime) || t < _famMinTime[fid]) _famMinTime[fid]=t; });
  const routeIds = _allRids.sort((a,b)=>{
    const fa=_famOf(a), fb=_famOf(b);
    if(fa!==fb) return (_famMinTime[fa]||'99').localeCompare(_famMinTime[fb]||'99') || fa.localeCompare(fb);
    return _timeOf(a).localeCompare(_timeOf(b));
  });

  const totalPax = rowsF.reduce((s,r)=> s + (r.cxl?0:(P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc'))), 0);

  // ── Filter bar (pier segmented + program dropdown) · original ──
  const pierBtn = (val,lbl)=>`<button class="${pierF===val?'on':''}" onclick="bookingV2Tab2SetPier('${val}')">${lbl}</button>`;
  const filterBar = `
    <div class="t2-filterbar">
      <div class="t2-seg">${pierBtn('all','All')}${pierBtn('tublamu','Tub Lamu')}${pierBtn('panwa','Visit Panwa')}${pierBtn('ranong','Ranong')}</div>
      <select class="t2-routesel" onchange="bookingV2Tab2SetFamily(this.value)">
        <option value="">All programs</option>
        ${famOpts.map(f=>`<option value="${f.id}" ${famF===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}
      </select>
      ${(pierF!=='all'||famF||routeF)?`<button class="t2-clearf" onclick="bookingV2Tab2ClearFilters()">Clear filters</button>`:''}
    </div>`;

  // ── Left sidebar · mini calendar + previous/upcoming ──
  // §cityTourView · marine page (flag off) excludes land trips · land page (flag on) excludes marine trips
  const allTrips = bookingV2Tab2AllTrips().filter(t=>(typeof laIsLandRoute==='function' && laIsLandRoute(t.routeId))===_bkV2CityTourOnly);
  const tripDates = new Set(allTrips.map(t=>t.date));
  const pad2 = n => String(n).padStart(2,'0');
  const curYM = _bkV2T2Cursor || date.slice(0,7);
  const [cy,cm] = curYM.split('-').map(Number);
  const monthLbl = new Date(cy,cm-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const firstDow = new Date(cy,cm-1,1).getDay();
  const daysInM = new Date(cy,cm,0).getDate();
  const todayStr = bookingV2LocalYMD(new Date());
  let calCells = ['S','M','T','W','T','F','S'].map(d=>`<div class="t2-dow">${d}</div>`).join('');
  for(let i=0;i<firstDow;i++) calCells += `<div class="t2-day t2-mute"></div>`;
  for(let d=1; d<=daysInM; d++){
    const ds = `${cy}-${pad2(cm)}-${pad2(d)}`;
    const cls = ['t2-day']; if(ds===date) cls.push('sel'); if(ds===todayStr) cls.push('today');
    calCells += `<div class="${cls.join(' ')}" onclick="bookingV2Tab2PickDay('${ds}')">${d}${tripDates.has(ds)?'<span class="t2-tdot"></span>':''}</div>`;
  }
  const fmtItem = t=>{
    const r = ROUTES.find(x=>x.id===t.routeId); const fam = bookingV2RouteFamily(t.routeId);
    const dd = new Date(t.date+'T00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    const dep = r?.times?.[0]||'';
    return `<div class="t2-puitem" onclick="bookingV2Tab2PickDay('${t.date}')"><div class="t2-pubar" style="background:${fam?.color||'#8b909c'}"></div><div class="t2-pubody"><div class="t2-punm">${esc(bookingV2RouteShort(t.routeId)||r?.name||t.routeId)}</div><div class="t2-pumeta">${dd}${dep?' · '+dep:''} · ${t.pax}p</div></div></div>`;
  };
  const prevList = allTrips.filter(t=>t.date<date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(fmtItem).join('') || '<div class="t2-puempty">none</div>';
  const upcList  = allTrips.filter(t=>t.date>date).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6).map(fmtItem).join('') || '<div class="t2-puempty">none</div>';
  const sidebar = `
    <aside class="t2-side">
      <div class="t2-calhead"><span class="t2-calmonth">${monthLbl}</span><span class="t2-calnav"><button class="bkv2-mnav-btn" onclick="bookingV2Tab2MonthShift(-1)">&lsaquo;</button><button class="bkv2-mnav-btn" onclick="bookingV2Tab2MonthShift(1)">&rsaquo;</button></span></div>
      <div class="t2-calgrid">${calCells}</div>
      <div class="t2-pulbl">Previous</div>${prevList}
      <div class="t2-pulbl" style="margin-top:14px">Upcoming</div>${upcList}
    </aside>`;

  // ── Day-level aggregates (whole day · all programs · independent of filters) ──
  const _dAD = rows.reduce((s,r)=>s+(r.cxl?0:P(r.pax,'ad')),0);
  const _dCHD = rows.reduce((s,r)=>s+(r.cxl?0:P(r.pax,'chd')),0);
  const _dINF = rows.reduce((s,r)=>s+(r.cxl?0:P(r.pax,'inf')),0);
  const _dFOC = rows.reduce((s,r)=>s+(r.cxl?0:P(r.pax,'foc')),0);
  const _dPax = _dAD+_dCHD+_dINF+_dFOC;
  /* §btFix · การ์ด "โปรแกรมวันนี้" เคยอ่านจาก rows (ทั้งวัน) ไม่ผ่านตัวกรองท่าเลย
     กดชิป "ทับละมุ" แล้วโปรแกรมของภูเก็ตยังโผล่อยู่ · ต้องอ่านจาก rowsPier */
  const _famAgg = {};
  rowsPier.forEach(r => { if(r.cxl) return; const f=bookingV2RouteFamily(r.routeId); if(!f) return; const a=_famAgg[f.id]=_famAgg[f.id]||{fam:f,pax:0,rids:new Set(),locked:0}; a.pax += P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc'); a.rids.add(r.routeId); });
  (typeof ROUTES!=='undefined'?ROUTES:[]).forEach(rr => { if((typeof laIsLandRoute==='function' && laIsLandRoute(rr.id))!==_bkV2CityTourOnly) return; if(pierF!=='all' && rr.pier!==pierF) return; const lk=(typeof bookingV2LockedTotal==='function')?bookingV2LockedTotal(rr.id,date):0; if(lk<=0) return; const f=bookingV2RouteFamily(rr.id); if(!f) return; const a=_famAgg[f.id]=_famAgg[f.id]||{fam:f,pax:0,rids:new Set(),locked:0}; a.locked+=lk; a.rids.add(rr.id); });
  const _famList = Object.values(_famAgg).sort((a,b)=> b.pax-a.pax || (b.locked-a.locked));
  const _dayLocked = (typeof bookingV2DayLockedTotal==='function') ? bookingV2DayLockedTotal(date) : 0;
  const _lockProgs = _famList.filter(a=>a.locked>0).length;
  const _isToday = date === (typeof bookingV2LocalYMD==='function' ? bookingV2LocalYMD(new Date()) : '');

  // ── Day-level "not fully arranged" check (boats / vans) → compact warning · trip name written inline ──
  const _unRn = id => { const f=(typeof bookingV2RouteFamily==='function')?bookingV2RouteFamily(id):null; return (f&&f.name) || (typeof bookingV2RouteShort==='function'&&bookingV2RouteShort(id)) || (((typeof getRoute==='function'&&getRoute(id))||{}).name) || id; };
  const _PPABBR={speedboat:'SB',catamaran:'CAT',sunset:'SS',premium:'PREM',longtail:'LT',private:'PRIV',early:'EARLY',whale:'WS'};
  const _tripAbbr=s=>{ const k=String(s||'').toLowerCase().trim(); if(!k) return ''; for(const w in _PPABBR){ if(k.includes(w)) return _PPABBR[w]; } const ws=String(s).trim().split(/\s+/); return (ws.length>1?ws.map(w=>w[0]||'').join(''):String(s).slice(0,4)).toUpperCase(); };
  let _unBoatN=0,_unBoatPax=0,_unVanN=0,_unVanPax=0,_unRetN=0,_unRetPax=0,_unRcN=0,_unRcPax=0; const _unBoatR={}, _unVanR={}, _unRetR={}, _unRcR={};
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b=>{
    if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
    // §cityTourView · marine page (flag off) excludes land trips · land page (flag on) excludes marine trips
    const dts=(b.trips||[]).filter(t=>(t.date||'')===date && (typeof laIsLandRoute==='function' && laIsLandRoute(t.routeId))===_bkV2CityTourOnly); if(!dts.length) return;
    const pax=dts.reduce((s,t)=>s+((typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0),0);
    const _lbl=_unRn(dts[0].routeId);
    // §cityTourView · land trips never need a boat · skip the check entirely on the City Tour page
    const hasBoat=_bkV2CityTourOnly || bkOpsRead(b,date).boatId||dts.some(t=>t.charterBoatId);
    if(!hasBoat){ _unBoatN++; _unBoatPax+=pax; _unBoatR[_lbl]=(_unBoatR[_lbl]||0)+pax; }
    const zone=(dts[0].zone||b.pickupZone||'NoTransfer');
    if(!b.pickupSelf && zone!=='NoTransfer' && zone!=='NT'){
      const ops=b.ops||{};
      const vanOk = ops.vanId || (Array.isArray(ops.vanSplits)&&ops.vanSplits.length&&ops.vanSplits.every(s=>s.vanId));
      if(!vanOk){ _unVanN++; _unVanPax+=pax; _unVanR[_lbl]=(_unVanR[_lbl]||0)+pax; }
    }
    if(typeof bookingV2RetInfo==='function'){ const _ri=bookingV2RetInfo(b,date); if(_ri.alert){ _unRetN++; _unRetPax+=pax; _unRetR[_lbl]=(_unRetR[_lbl]||0)+pax; } }
    if(!(b.ops&&b.ops.reconfirm&&b.ops.reconfirm.status==='done')){ _unRcN++; _unRcPax+=pax; _unRcR[_lbl]=(_unRcR[_lbl]||0)+pax; }   // re-confirm not yet done
  });
  /* §btUnit · ตัวเลขในแถบนี้เป็น "pax" ส่วนเลขบนการ์ดโหมดเป็น "booking"
     ของเดิมสองอันอยู่คนละที่จึงไม่ชนกัน · ตอนนี้อยู่ในหัวเดียวกันแล้ว
     ไม่บอกหน่วยจะอ่านเป็น Re-confirm 4 กับ Phi Phi Bamboo 8 ขัดกันเอง */
  const _brkHtml = m => Object.keys(m).sort((a,b)=>m[b]-m[a]).map(k=>`${esc(k)} <b>${m[k]}</b>`).join(' · ') + ' pax';
  // ⚠ van-group conflict (รถปนกันในกรุ๊ป) → must resolve or a booking ships on the wrong van's job order
  const _vanConf = (typeof bookingV2VanGroupConflicts==='function') ? bookingV2VanGroupConflicts(date) : [];
  const _confTip = _vanConf.map(c=>`${c.routeName} กรุ๊ป ${c.gid}: `+Object.keys(c.vans).map(v=>((typeof vehGet==='function'&&vehGet(v)||{}).name||v)+'×'+c.vans[v]).join(' / ')).join(' · ');
  const _confLbl = _vanConf.map(c=>esc(_unRn(c.routeId))+' ก.'+c.gid).join(' · ');
  const _unassignBar = (_unBoatN>0||_unVanN>0||_unRetN>0||_vanConf.length>0||_unRcN>0) ? `
      <div class="t2-hd-warn">
        <span class="t2-hd-warnico">&#9888;</span><span class="t2-hd-warntxt">ยังจัดไม่ครบ</span>
        ${_unBoatN>0?`<button class="t2-hd-warnchip" style="background:#C0392B" onclick="if(!_bkV2.boatAssignMode)bookingV2ToggleBoatMode()" title="ยังไม่จัดเรือ ${_unBoatN} booking · ${_unBoatPax} pax · คลิกเข้าโหมดจัดเรือ">Boat · ${_brkHtml(_unBoatR)}</button>`:''}
        ${_unVanN>0?`<button class="t2-hd-warnchip" style="background:#E07C24" onclick="if(!_bkV2.vanAssignMode)bookingV2ToggleVanMode()" title="ยังไม่จัดรถ(ขาไป) ${_unVanN} booking · ${_unVanPax} pax · คลิกเข้าโหมดจัดรถ">Van · ${_brkHtml(_unVanR)}</button>`:''}
        ${_unRetN>0?`<button class="t2-hd-warnchip" style="background:#B8860B" onclick="if(!_bkV2.vanAssignMode)bookingV2ToggleVanMode()" title="ยังไม่จัดรถกลับ (ส่งคนละที่) ${_unRetN} booking · ${_unRetPax} pax · คลิกเข้าโหมดจัดรถ">รถกลับ · ${_brkHtml(_unRetR)}</button>`:''}
        ${_vanConf.length>0?`<button class="t2-hd-warnchip" style="background:#7A1FA2" onclick="if(!_bkV2.vanAssignMode)bookingV2ToggleVanMode()" title="รถปนกันในกรุ๊ป (booking จะขึ้นใบงานผิดคัน) — เข้าโหมด Van แล้วเลือกรถของกรุ๊ปใหม่ให้เป็นคันเดียว · ${esc(_confTip)}">รถปนกัน · ${_confLbl}</button>`:''}
        ${_unRcN>0?`<button class="t2-hd-warnchip" style="background:#185FA5" onclick="if(!_bkV2.reconfirmMode)bookingV2ToggleReconfirmMode()" title="ยังไม่ได้ re-confirm ${_unRcN} booking · ${_unRcPax} pax · คลิกเข้าโหมด Re-Confirm">Re-confirm · ${_brkHtml(_unRcR)}</button>`:''}
      </div>` : '';

  // §Check-in status · สรุปผลจากหน้าเช็คอินรถ / เช็คอินหน้าท่า ของวันนี้ (อ่านอย่างเดียว · ไม่แตะยอดจอง)
  const _ckBar = (function(){
    if(typeof ckSummary!=='function') return '';
    let vD=0,vT=0,vN=0,pD=0,pT=0,pN=0;
    (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b=>{
      if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return;
      // §cityTourView · marine page (flag off) excludes land trips · land page (flag on) excludes marine trips
      const _dts=(b.trips||[]).filter(t=>(t.date||'')===date); if(!_dts.length) return;
      if(!_dts.some(t=>(typeof laIsLandRoute==='function' && laIsLandRoute(t.routeId))===_bkV2CityTourOnly)) return;
      const s=ckSummary(b,date); if(!s) return;
      const _o=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});
      if(_o.vanId){ vT++; if(s.van&&s.van.at){ vD++; vN+=s.vanNoShow; } }
      if(_o.boatId){ pT++; if(s.pier&&s.pier.at){ pD++; pN+=s.pierNoShow; } }
    });
    if(!vD && !pD) return '';
    return `<div style="display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px;padding:4px 10px;background:#F1F8F5;border:1px solid #CFE7DC;border-radius:8px">
      <span style="font-size:11px;font-weight:700;color:#0F6E56">&#10003; เช็คอินหน้างาน</span>
      ${vD?`<button onclick="nav(document.querySelector('[data-view=vancheckin]'))" title="ไปหน้าเช็คอินรถ" style="font-size:10.5px;font-weight:700;color:#fff;background:#0F6E56;border:none;border-radius:6px;padding:3px 9px;cursor:pointer;font-family:inherit">รถ ${vD}/${vT}${vN>0?` · No-show ${vN}`:''}</button>`:''}
      ${pD?`<button onclick="nav(document.querySelector('[data-view=piercheckin]'))" title="ไปหน้าเช็คอินหน้าท่า" style="font-size:10.5px;font-weight:700;color:#fff;background:#185FA5;border:none;border-radius:6px;padding:3px 9px;cursor:pointer;font-family:inherit">ท่าเรือ ${pD}/${pT}${pN>0?` · No-show ${pN}`:''}</button>`:''}
      <span style="font-size:10px;color:#5F7A70">ป้าย No-show อยู่บนแถว booking · ยอดจอง/ราคาไม่ถูกแก้</span>
    </div>`;
  })();

  /* ══ §btHead (2026-09-04) · หัวหน้า By-trip · ยกโครงมาจากเช็คอินหน้าท่า ═══════
     ของเดิมเป็นแถบยาวแถบเดียว: ปุ่มโหมด + การ์ดโปรแกรมทุกตัวเรียงต่อกัน แล้วมีแถบ
     เตือนซ้อนลงมาอีก 2-3 ชั้น · ผลคือความสูงไม่คงที่ (338-520px แล้วแต่วัน) ตรึงไม่ได้
     และ "ที่นั่งว่าง" ซึ่งเป็นตัวเลขที่ต้องตัดสินใจทุกครั้ง ไปอยู่ปลายแถวที่ต้องไถหา

     ของใหม่แบ่งเป็น 3 กรอบ ความสูงคงที่:
       ซ้าย  · โปรแกรมวันนี้ (ท่า + ตระกูล + รอบย่อย + ที่นั่งว่างเป็นชิปสี)
       กลาง  · เรือของทริปที่เลือก (ไม่เลือก = ไล่ให้ดูว่าทริปไหนมีเรืออะไร)
       ขวา   · โหมด/ค้นหา + Seat Lock + Notice

     ไม่มีฟังก์ชันไหนถูกเปลี่ยนพฤติกรรม · ทุกปุ่มยิงเข้าตัวเดิมทั้งหมด
     (bookingV2Tab2SetPier / SetFamily / SetRoute / ToggleVanMode / ToggleBoatMode /
      ToggleReconfirmMode / LockManageOpen / LockFromCalendar)                     */
  const _btSelRid = routeF || null;
  const _btSelFam = _btSelRid ? bookingV2RouteFamily(_btSelRid)
                  : (famF ? (((_famList.find(a=>a.fam.id===famF))||{}).fam||null) : null);
  const _btCol  = (_btSelFam && _btSelFam.color) || '';
  const _btTint = t => _btCol && typeof pckTint==='function' ? pckTint(_btCol,t)
                                                            : (t>0.6?'#E9E7E3':'#D6D2CA');
  const _btBand = _btTint(0.82), _btBandB = _btTint(0.52);

  /* ── ช่วยกัน ─────────────────────────────────────────────────────────── */
  const _btSub = rid => {                       // ชื่อรอบย่อย · ตัดชื่อตระกูลออก
    const rn=(((typeof getRoute==='function'&&getRoute(rid))||{}).name)||rid;
    const fm=(bookingV2RouteFamily(rid)||{}).name||'';
    let x=String(rn).replace(fm,'').replace(/^[\s·\-]*by[\s·\-]*/i,'').replace(/^[\s·\-]+/,'').trim();
    return x || ((typeof bookingV2RouteShort==='function'&&bookingV2RouteShort(rid))||rid);
  };
  const _btDep = rid => (((typeof getRoute==='function'&&getRoute(rid))||{}).times||[])[0]||'';
  const _btPier= rid => { const p=(((typeof getRoute==='function'&&getRoute(rid))||{}).pier)||'';
    return p==='tublamu'?'Tub Lamu':p==='panwa'?'Visit Panwa':p==='ranong'?'Ranong':p; };
  /* เรือของทริปหนึ่ง · ลำที่ Boat Operation จัดไว้ + ลำที่มี booking เกาะอยู่จริง */
  const _btBoats = rid => {
    const acc={}, order=[];
    ((typeof baBoatsForRoute==='function')?baBoatsForRoute(date,rid):[]).forEach(x=>{
      if(acc[x.boatId]) return; acc[x.boatId]={boat:x.boat||{},pax:0}; order.push(x.boatId); });
    (groups[rid]||[]).forEach(r=>{ if(r.cxl) return;
      const bid = r.charter ? (r.charterBoatId||bkOpsRead(r.bk,date).boatId)
                            : bkOpsRead(r.bk,date).boatId;
      if(!bid) return;
      if(!acc[bid]){ const bo=((typeof BOATS!=='undefined'?BOATS:[]).find(b=>b.id===bid))||{};
        acc[bid]={boat:bo,pax:0}; order.push(bid); }
      acc[bid].pax += P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc');
    });
    /* §ovnSpan · ลำที่ติดใบเหมาค้างเกาะ · วันระหว่างทางไม่มี trip ในใบเลย
       จึงไม่เข้าทั้งทาง baBoatsForRoute (ตัดเรือเหมาออกโดยตั้งใจ) และทางบุคกิ้ง
       ผลคือกระดานวันที่ 17-18 ว่างเปล่า ทั้งที่เรือติดงานอยู่ · เติมเข้ามาเอง
       ไม่ใส่จำนวนคน เพราะวันนั้นไม่มีใครขึ้นเรือ · ป้าย "ค้างเกาะ" บอกแทน */
    if(typeof bkOvnHoldMap==='function'){
      try{ bkOvnHoldMap(date).forEach((h,bid)=>{
        if(h.routeId!==rid) return;
        /* §ovnRow · แถวจำลองของวันระหว่างทางใส่เรือเข้ามาแล้ว (pax 0)
           ติดป้ายค้างเกาะทับให้ · วันที่มีคนเดินทางจริง (ขาไป/ขากลับ) ไม่แตะ */
        if(acc[bid]){ if(!acc[bid].pax) acc[bid].ovn=h; return; }
        const bo=((typeof BOATS!=='undefined'?BOATS:[]).find(b=>b.id===bid))||{};
        acc[bid]={boat:bo,pax:0,ovn:h}; order.push(bid);
      }); }catch(_){}
    }
    return order.map(bid=>{ const a=acc[bid], bo=a.boat||{};
      const cap=+(bo.capacity||bo.cap||bo.licensePax||0)||0;
      let c='#5b6472'; if(typeof getBoatColor==='function'){ const _c=getBoatColor(bid); if(_c&&_c.text) c=_c.text; }
      return {id:bid,name:bo.name||bid,col:c,pax:a.pax,cap:cap,over:cap>0&&a.pax>cap,ovn:a.ovn||null};
    });
  };

  /* ══ กรอบซ้าย · โปรแกรมวันนี้ ════════════════════════════════════════════ */
  const _btPierBtn = (v,l)=>`<button class="bt-seg-b${pierF===v?' on':''}" onclick="bookingV2Tab2SetPier('${v}')">${l}</button>`;
  const _btProgBody = _famList.map(a=>{
    const on=(famF===a.fam.id), col=a.fam.color||'#8b909c';
    const rids=[...a.rids].filter(x=>{ if(pierF==='all') return true;
        const rt=(typeof ROUTES!=='undefined'?ROUTES:[]).find(z=>z.id===x); return rt && rt.pier===pierF; })
      .sort((x,y)=>String(_btDep(x)).localeCompare(String(_btDep(y))));
    const nRun=rids.filter(r=>(typeof bookingV2IsRouteOpenOn!=='function')||bookingV2IsRouteOpenOn(r,date)).length;
    const vars=rids.map(rid=>{
      const open=(typeof bookingV2IsRouteOpenOn!=='function')||bookingV2IsRouteOpenOn(rid,date);
      const ron=(routeF===rid);
      const nm=esc(_btSub(rid)), dep=_btDep(rid), pr=_btPier(rid);
      if(!open) return `<div class="bt-pgv off"><span class="vn">${nm}</span><span>${esc(dep)}${pr?' · '+esc(pr):''} · not running</span><span class="sp"><span class="bt-free none">&mdash;</span></span></div>`;
      const al=(typeof getAllotment==='function')?getAllotment(rid,date):null;
      /* §noCapSeat · โปรแกรมบกที่ยังไม่ตั้ง dailyCap · getAllotment ตั้งใจ return ศูนย์ทั้งก้อน
         (04-data-core.js · "ยังไม่ตั้งโควตา = ปล่อยขายเหมือนเดิม") แต่การ์ดนี้เคยอ่าน seatsAvailable<=0
         แล้วปั๊ม full สีแดง → "ขายได้ไม่อั้น" กลายเป็น "เต็มแล้ว" กลับหัวกันพอดี
         เคสนี้โชว์แค่ยอดที่จองแล้ว ไม่มีตัวหาร ไม่มีป้ายเต็ม · ต้องเรียก getSeatsConsumed เอง
         เพราะ getAllotment return ก่อนถึงบรรทัดที่คำนวณมัน */
      const _noCap = !al || !al.hasAllotment;
      const bk=_noCap?((typeof getSeatsConsumed==='function')?getSeatsConsumed(rid,date):0):(al.seatsConsumed||0);
      const cap=al?(al.availableCapacity||0):0, av=al?(al.seatsAvailable||0):0;
      const lk=(typeof bookingV2LockedTotal==='function')?bookingV2LockedTotal(rid,date):0;
      const fr=cap>0?av/cap:0;
      const fc = av<=0 ? 'full' : (fr<0.20 ? 'low' : 'ok');
      const _seatHtml = _noCap ? `<span class="bt-seat"><b>${bk}</b> booked</span><span class="bt-free none">ไม่จำกัด</span>`
                               : `<span class="bt-seat"><b>${bk}</b>/${cap}</span><span class="bt-free ${fc}">${av<=0?'full':(av+' free')}</span>`;
      const _seatTip = _noCap ? `booked ${bk} · ไม่ได้ตั้งโควตา (ขายได้ไม่จำกัด)` : `booked ${bk}/${cap} · ${av} free`;
      return `<div class="bt-pgv${ron?' on':''}" onclick="bookingV2Tab2SetRoute('${ron?'':rid}')" title="${esc(_btSub(rid))} · ${_seatTip}">
        <span class="vn">${nm}</span><span>${esc(dep)}${pr?' · '+esc(pr):''}</span>
        <span class="sp">${lk>0?`<span class="bt-lk">&#128274; ${lk}</span>`:''}${_seatHtml}</span></div>`;
    }).join('');
    return `<div class="bt-pgf${on?' on':''}" style="--e:${col};--ink:${col};background:${(typeof pckTint==='function')?pckTint(col,0.90):'#F5F3F0'}" onclick="bookingV2Tab2SetFamily('${on?'':a.fam.id}')" title="Filter ${esc(a.fam.name)}">
      <span class="ar">&#9662;</span><span class="dot"></span>
      <span class="nm">${esc(a.fam.name)}</span><span class="n">${a.pax}</span>
      <span class="sp"><span class="bt-tag run">${nRun} running</span>${rids.length-nRun>0?`<span class="bt-tag no">${rids.length-nRun} not running</span>`:''}</span></div>${vars}`;
  }).join('') || '<div class="bt-none">No programme on this day</div>';

  /* §btTune · ชิปท่าเคยกินแถวของตัวเองใต้หัวการ์ด · ย้ายขึ้นไปอยู่แถวเดียวกับชื่อ
     การ์ด คืนที่ให้รายการโปรแกรมอีกหนึ่งบรรทัดเต็ม ๆ */
  const _btProg = `<div class="bt-c bt-prog"><div class="bt-ct"><span class="big">Programmes</span>
      <span class="bt-cnt">${_famList.length} route${_famList.length===1?'':'s'}</span>
      <span class="bt-seg">${_btPierBtn('all','All')}${_btPierBtn('panwa','Panwa')}${_btPierBtn('tublamu','Tub Lamu')}${_btPierBtn('ranong','Ranong')}</span>
      ${(pierF!=='all'||famF||routeF)?`<button class="bt-clear" onclick="bookingV2Tab2ClearFilters()">Clear</button>`:''}
      <span class="sp"></span>
      <span class="bt-daytot"><b>${rows.filter(r=>!r.cxl).length}</b> booking &middot; <b>${_dPax}</b> pax<i>${_dAD}A&middot;${_dCHD}C&middot;${_dINF}I&middot;${_dFOC}F</i></span></div>
    <div class="bt-pgbody">${_btProgBody}</div></div>`;

  /* §btTune · ไกด์ / อาหาร / เรือหางยาว ของทริปหนึ่ง · เดิมมีแต่ในตัวกางท้ายตาราง
     การ์ดเรือมีที่ว่างอยู่แล้ว และสามอย่างนี้คือของที่ต้องสั่งล่วงหน้า ควรเห็นตั้งแต่แรก */
  const _btPrep = rid => {
    const lang={}; let veg=0,vegan=0,halal=0,allerg=0,ltJoin=0,ltChtr=0;
    (groups[rid]||[]).forEach(r=>{ if(r.cxl) return;
      const t=P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc');
      const gd=r.bk.guides||{}, mm=r.bk.specialMeals||{};
      if(gd.english) lang['EN']=(lang['EN']||0)+t;
      if(gd.russian) lang['RU']=(lang['RU']||0)+t;
      if(gd.chinese) lang['CN']=(lang['CN']||0)+t;
      const ol=(gd.otherLang||'').trim(); if(ol) lang[ol]=(lang[ol]||0)+t;
      veg+=+mm.veg||0; vegan+=+mm.vegan||0; halal+=+mm.halal||0;
      allerg+=(typeof bookingV2AllergyCount==='function')?bookingV2AllergyCount(mm):((mm.allergies||'').trim()?1:0);
      const af=(typeof bookingV2AddOnFlags==='function')?bookingV2AddOnFlags(r.bk,rid):null;
      if(af){ if(af.charter) ltChtr+=(af.charterQty||1); else if(af.join) ltJoin+=t; }
      if(typeof bookingV2LongtailExtraPax==='function') ltJoin+=(bookingV2LongtailExtraPax(r.bk.id,date)||0);
      if(typeof bookingV2LongtailCharterExtraBoats==='function') ltChtr+=(bookingV2LongtailCharterExtraBoats(r.bk.id,date)||0);
    });
    return {lang,veg,vegan,halal,allerg,ltJoin,ltChtr};
  };
  const _btPrepHtml = rid => {
    const p=_btPrep(rid); const out=[];
    Object.keys(p.lang).sort((a,b)=>p.lang[b]-p.lang[a]).forEach(k=>{
      const c=(typeof bookingV2LangColors==='function')?bookingV2LangColors(k):['#EEF2F7','#3a4150'];
      out.push(`<span class="bt-pc" style="background:${c[0]};color:${c[1]}">${esc(k)} &middot; ${p.lang[k]}</span>`); });
    if(p.veg)   out.push(`<span class="bt-pc" style="background:#EAF6EE;color:#0F6E56">${p.veg} veg</span>`);
    if(p.vegan) out.push(`<span class="bt-pc" style="background:#EAF6EE;color:#0F6E56">${p.vegan} vegan</span>`);
    if(p.halal) out.push(`<span class="bt-pc" style="background:#EAF6EE;color:#0F6E56">${p.halal} halal</span>`);
    if(p.allerg)out.push(`<span class="bt-pc" style="background:#FBEAE7;color:#A32D2D">&#9888; ${p.allerg} allergy</span>`);
    if(p.ltJoin)out.push(`<span class="bt-pc" style="background:#F1EFE8;color:#3C3B37">Longtail join &middot; ${p.ltJoin}</span>`);
    if(p.ltChtr)out.push(`<span class="bt-pc" style="background:#EFEAFB;color:#5B289A">Longtail charter &middot; ${p.ltChtr}</span>`);
    return out.length?`<div class="bt-prep"><span class="l">Prep</span>${out.join('')}</div>`:'';
  };

  /* ══ กรอบกลาง · เรือของทริปที่เลือก ══════════════════════════════════════ */
  let _btBoatCard;
  if(_btSelRid){
    const bl=_btBoats(_btSelRid);
    const al=(typeof getAllotment==='function')?getAllotment(_btSelRid,date):null;
    const bkd=al?(al.seatsConsumed||0):0, cp=al?(al.availableCapacity||0):0, av=al?(al.seatsAvailable||0):0;
    const lk=(typeof bookingV2LockedTotal==='function')?bookingV2LockedTotal(_btSelRid,date):0;
    const nOver=bl.filter(b=>b.over).length;
    const rnm=(((typeof getRoute==='function'&&getRoute(_btSelRid))||{}).name)||_btSelRid;
    _btBoatCard = `<div class="bt-c bt-boat" style="--c:${_btCol||'#B9B3AA'}">
      <div class="bt-ct">Boats running<span class="sp"></span><span class="bt-cnt">${bl.length} boat${bl.length===1?'':'s'}</span>
        ${nOver?`<span class="bt-cnt over">&#9888; ${nOver} over</span>`:''}</div>
      <div class="bt-bnm">${esc(rnm)}<span>${esc(_btDep(_btSelRid))}${_btPier(_btSelRid)?' · '+esc(_btPier(_btSelRid)):''}</span></div>
      <div class="bt-avrow">
        <span class="bt-av"><span class="k">Free</span><span class="v ${av<=0?'full':(cp&&av/cp<0.2?'low':'')}">${av}</span></span><span class="bt-avs"></span>
        <span class="bt-av"><span class="k">Booked</span><span class="v">${bkd}</span></span><span class="bt-avs"></span>
        <span class="bt-av"><span class="k">Capacity</span><span class="v dim">${cp}</span></span><span class="bt-avs"></span>
        <span class="bt-av"><span class="k">Locked</span><span class="v lk">${lk}</span></span></div>
      <div class="bt-blist">${bl.length?bl.map(b=>`<span class="bt-brow${b.over?' over':''}"><span class="d" style="background:${b.col}"></span><span class="nm">${esc(b.name)}</span><span class="ld${b.ovn?' ovn':''}">${b.ovn?('\u0e04\u0e49\u0e32\u0e07\u0e40\u0e01\u0e32\u0e30 \u00b7 \u0e01\u0e25\u0e31\u0e1a '+ovnDayTh(b.ovn.to)):(b.pax+(b.cap?('/'+b.cap):'')+(b.over?(' +'+(b.pax-b.cap)):''))}</span></span>`).join(''):'<span class="bt-none2">No boat assigned to this trip</span>'}</div>
      ${_btPrepHtml(_btSelRid)}</div>`;
  } else {
    const _tg = routeIds.filter(rid=>(typeof bookingV2IsRouteOpenOn!=='function')||bookingV2IsRouteOpenOn(rid,date)).map(rid=>{
      const f=bookingV2RouteFamily(rid)||{}, col=f.color||'#8b909c';
      const bl=_btBoats(rid);
      const al=(typeof getAllotment==='function')?getAllotment(rid,date):null;
      const bkd=al?(al.seatsConsumed||0):0, cp=al?(al.availableCapacity||0):0, av=al?(al.seatsAvailable||0):0;
      const rnm=(((typeof getRoute==='function'&&getRoute(rid))||{}).name)||rid;
      return `<div class="bt-tgp" style="--tc:${col}" onclick="bookingV2Tab2SetRoute('${rid}')" title="Select this trip">
        <div class="bt-tgh"><i></i><span class="nm">${esc(rnm)}</span><span class="tm">${esc(_btDep(rid))}${_btPier(rid)?' · '+esc(_btPier(rid)):''}</span>
          <span class="sm">${bkd}/${cp}<em class="${av<=0?'full':(cp&&av/cp<0.2?'low':'ok')}">${av<=0?'full':(av+' free')}</em></span></div>
        <div class="bt-tgb">${bl.length?bl.map(b=>`<span class="bt-tbc${b.over?' over':''}"><i style="background:${b.col}"></i>${esc(b.name)}<s${b.ovn?' class="ovn"':''}>${b.ovn?('\u0e04\u0e49\u0e32\u0e07\u0e40\u0e01\u0e32\u0e30 \u00b7 \u0e01\u0e25\u0e31\u0e1a '+ovnDayTh(b.ovn.to)):(b.pax+(b.cap?('/'+b.cap):'')+(b.over?(' +'+(b.pax-b.cap)):''))}</s></span>`).join(''):'<span class="bt-tbc none">no boat</span>'}</div>
        ${_btPrepHtml(rid)}</div>`;
    }).join('');
    const _nB=routeIds.reduce((n,rid)=>n+_btBoats(rid).length,0);
    const _nT=routeIds.filter(rid=>(typeof bookingV2IsRouteOpenOn!=='function')||bookingV2IsRouteOpenOn(rid,date)).length;
    const _nOv=routeIds.reduce((n,rid)=>n+_btBoats(rid).filter(b=>b.over).length,0);
    _btBoatCard = `<div class="bt-c bt-boat" style="--c:#B9B3AA">
      <div class="bt-ct">Boats running<span class="sp"></span><span class="bt-cnt">${_nB} boat${_nB===1?'':'s'} &middot; ${_nT} trip${_nT===1?'':'s'}</span>
        ${_nOv?`<span class="bt-cnt over">&#9888; ${_nOv} over</span>`:''}</div>
      <div class="bt-tgl">${_tg||'<div class="bt-none">No trip running today</div>'}</div>
      <div class="bt-tgfoot">Pick a programme on the left to see its free seats and assign boats</div></div>`;
  }

  /* ══ กรอบขวา · โหมด / ค้นหา / Seat Lock / Notice ═════════════════════════ */
  const _btMode = (nm,sub,num,kind,col,on,fn,dis)=>
    `<button class="bt-mc ${kind}${on?' on':''}${dis?' dis':''}" style="--mc:${col}" onclick="${dis?'':fn}" title="${esc(nm)}">
       <span class="tx"><span class="t">${nm}</span><span class="s">${sub}</span></span>
       <span class="n">${num}</span>${on?'<span class="x">&times;</span>':''}</button>`;
  /* ปุ่มโหมดยังกดได้ทุกกรณีเหมือนเดิม · ของเดิมไม่เคยล็อกไว้ตามการเลือกโปรแกรม */
  // §cityTourView · land trips never need a boat · hide the Boat pill on the City Tour page
  const _btModes = `<div class="bt-c"><div class="bt-mrow">
      ${_btMode('Van', _unVanN>0?'not assigned':'all assigned', _unVanN>0?_unVanN:'&#10003;', _unVanN>0?'warn':'ok','#0F6E56',vanMode,'bookingV2ToggleVanMode()',false)}
      ${_bkV2CityTourOnly ? '' : _btMode('Boat',_unBoatN>0?'not assigned':'all assigned', _unBoatN>0?_unBoatN:'&#10003;', _unBoatN>0?'warn':'ok','#185FA5',boatMode,'bookingV2ToggleBoatMode()',false)}
      ${_btMode('Re-confirm',_unRcN>0?'not confirmed':'all confirmed', _unRcN>0?_unRcN:'&#10003;', _unRcN>0?'warn':'ok','#7A4A00',rcMode,'bookingV2ToggleReconfirmMode()',false)}
    </div></div>`;
  const _btSearch = `<div class="bt-c"><div class="bt-srow">
      <span class="bt-sbox"><span class="ic">&#128269;</span>
        <input id="bt-q" value="${esc(_bkV2T2Q)}" placeholder="Search · voucher · name · phone · hotel" oninput="bookingV2Tab2SetQ(this.value)">
        ${_btQ?`<button class="clr" onclick="bookingV2Tab2SetQ('')" title="Clear search">&times;</button>`:''}</span>
      ${_btQ?`<span class="bt-shit">${rowsF.filter(r=>!r.cxl).length} rows</span>`:''}</div></div>`;

  /* Seat Lock · 1 แถว = 1 เอเยนต์ (วันหนักจริงมี 15-24 รายการ แต่ยุบแล้วเหลือ 6-8 แถว)
     เจ้าที่ยังเหลือที่ลอยขึ้นบนสุดเสมอ · ข้อมูลจริงบอกว่ามีไม่เกิน 2 เจ้าต่อวัน */
  const _lkBy={};
  routeIds.forEach(rid=>{ ((typeof bookingV2LocksFor==='function')?bookingV2LocksFor(rid,date):[]).forEach(l=>{
    if(l.parentId) return;
    const nm=(typeof bookingV2LockHolderName==='function')?bookingV2LockHolderName(l):(l.holderId||'—');
    const a=_lkBy[nm]=_lkBy[nm]||{nm,qty:0,left:0,kids:0,id:l.id};
    a.qty += (+l.qty||0);
    a.left += (typeof bookingV2LockHeldRemaining==='function')?bookingV2LockHeldRemaining(l,date)
            : ((typeof bookingV2LockRemaining==='function')?bookingV2LockRemaining(l,date):0);
    a.kids += ((typeof bookingV2LockChildren==='function')?bookingV2LockChildren(l.id):[]).length;
  }); });
  const _lkList=Object.values(_lkBy).sort((a,b)=>(b.left-a.left)||(b.qty-a.qty));
  const _lkTot=_lkList.reduce((n,a)=>n+a.qty,0), _lkLeft=_lkList.reduce((n,a)=>n+a.left,0);
  const _lkN=routeIds.reduce((n,rid)=>n+((typeof bookingV2LocksFor==='function')?bookingV2LocksFor(rid,date):[]).length,0);
  const _btLock = `<div class="bt-c bt-lockc"><div class="bt-ct">Seat Lock<span class="sp"></span>
      ${_btLkSel?`<span class="bt-lkhi">&#9679; ${_btLkHitN} highlighted</span>`:''}
      ${_lkLeft>0?`<span class="bt-lkbadge">${_lkLeft} left</span>`:'<span class="bt-cnt">none left</span>'}
      ${_btSelRid?`<button class="bt-lkbtn" onclick="bookingV2LockFromCalendar('${_btSelRid}','${date}')" title="Lock seats on this trip">&#128274; Lock seats</button>`:''}
      <button class="bt-lkbtn gh" onclick="bookingV2SwitchTab('locks')">All &rarr;</button></div>
    <div class="bt-lkl">${_lkList.length?_lkList.map(a=>{
      const cls=(a.qty<=0)?'gone':(a.left<=0?'done':'');
      const num=(a.qty<=0)?'<s>released</s>':`<b>${a.left}</b><s>/ ${a.qty}</s>`;
      const _on=(_btLkSel===a.nm);
      return `<span class="bt-lkr ${cls}${_on?' on':''}" onclick="bookingV2Tab2SetLk('${a.id}')" title="Highlight bookings drawn from ${esc(a.nm)}'s lock"><i></i><span class="nm">${esc(a.nm)}</span><span class="q">${num}</span>${a.kids?`<span class="sub">${a.kids} sub</span>`:''}<button class="mg" onclick="event.stopPropagation();bookingV2LockManageOpen('${a.id}')" title="Manage lock · add sub-group / release">&#9881;</button></span>`;
    }).join(''):'<span class="bt-none2">No seat lock on this day</span>'}</div>
    ${_lkList.length?`<div class="bt-lkfoot"><b>${_lkTot}</b> held &middot; <b>${_lkTot-_lkLeft}</b> used &middot; <b>${_lkList.length}</b> holder${_lkList.length===1?'':'s'} &middot; <b>${_lkN}</b> lock${_lkN===1?'':'s'}${_lkList.length>3?`<span class="scr">&#9662; ${_lkList.length-3} more</span>`:''}<span class="hint">${_btLkSel?'Click again to clear highlight':'Click a row to highlight its bookings &middot; &#9881; to manage'}</span></div>`:''}</div>`;

  const _btPendN = Object.keys(pendGroups).reduce((n,k)=>n+pendGroups[k].length,0);
  const _btNotice = `<div class="bt-c bt-notice"><div class="bt-ct">Notice<span class="sp"></span><span class="bt-cnt">today</span></div>
    <div class="bt-ncb">
      ${_unassignBar}
      ${_btPendN>0?`<div class="bt-nc warn"><span class="i">&#9873;</span><span><b>Pending approval</b> &middot; ${_btPendN} booking<i>Not counted in trip totals &middot; not on van/boat job orders yet</i></span></div>`:''}
      ${_ckBar}
      ${(!_unassignBar && !_btPendN && !_ckBar)?'<div class="bt-nc ok"><span class="i">&#10003;</span><span><b>Nothing pending</b><i>Vans, boats and re-confirm are all done</i></span></div>':''}
    </div></div>`;

  const header = `
    <div class="bt-pkh">
      <div class="bt-hdtop">
        <button class="bt-arw" onclick="bookingV2Tab2DateShift(-1)" title="Previous day">&lsaquo;</button>
        <span class="bt-dnum">${esc(String(new Date(date+'T00:00').getDate()))}</span>
        <span class="bt-dgrp"><span class="bt-dwk">${esc(new Date(date+'T00:00').toLocaleDateString('en-GB',{weekday:'long'}))}</span>
          <label class="bt-dmo">${esc(new Date(date+'T00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'}))}
            <input type="date" value="${date}" onclick="event.stopPropagation();try{this.showPicker()}catch(e){}" onchange="if(this.value)bookingV2Tab2PickDay(this.value)"></label></span>
        ${_isToday?'<span class="bt-today">TODAY</span>':`<button class="bt-today gh" onclick="bookingV2Tab2Today()">Go to today</button>`}
        <button class="bt-arw" onclick="bookingV2Tab2DateShift(1)" title="Next day">&rsaquo;</button>
        <span class="bt-brand">${_btSelFam?esc(_btSelFam.name):'LOVE ANDAMAN'}</span>
      </div>
      <div class="bt-hgrid${_bkV2CityTourOnly?' bt-hgrid-noboat':''}">
        <div>${_btProg}</div>
        <div>${_btBoatCard}</div>
        <div class="bt-col3">
          <div class="bt-pair">${_btModes}${_btSearch}</div>
          ${/* §btVanCard · โหมดจัดรถ · Seat Lock ไม่เกี่ยวกับการจัดรถเลย และบรรทัด
                "ยังไม่จัดรถ" ของ Notice การ์ด VANS ก็มีอยู่แล้ว · สลับที่กันไปเลย
                การ์ด VANS ต้องสร้างหลังวนทริปเสร็จ จึงเว้นที่ไว้แล้วค่อยแทนตอนท้าย */''}
          ${vanMode ? '<!--BTVANCARD-->' : `<div class="bt-pair2">${_btLock}${_btNotice}</div>`}
        </div>
      </div>
    </div>`;

  const emptyMain = (routeIds.length === 0);

  let _prevFam = null;
  const _btVanParts = [];   /* §btVanCard · ชิ้นส่วนแถบรถของแต่ละทริป · เอาไปประกอบเป็นการ์ดบนหัว */
  const trips = routeIds.map(rid=>{
    const grp = groups[rid] || [];
    // Per-boat color map for this route · shared by the row Boat chip + the summary cards (distinguish boats)
    const _baBoatsRoute = (typeof baBoatsForRoute==='function') ? baBoatsForRoute(date, rid) : [];
    const PAL_BOAT=[['#E6F1FB','#185FA5'],['#E1F5EE','#0F6E56'],['#EEEDFE','#534AB7'],['#FAEEDA','#854F0B'],['#FAECE7','#993C1D'],['#FBEAF0','#993556'],['#EAF3DE','#3B6D11']];
    const boatColor={}; _baBoatsRoute.forEach((x,ix)=>{ let _p=null; if(typeof getBoatColor==='function'){ const _c=getBoatColor(x.boatId); if(_c&&_c.text&&_c.text!=='#666') _p=[_c.bg,_c.text]; } boatColor[x.boatId]=_p||PAL_BOAT[ix%PAL_BOAT.length]; });   // §prefer editable boat identity colour
    // Van color map · distinct color per vehicle used on this route
    const _vanIdsRoute=[...new Set([].concat.apply([],grp.map(r=>{ const o=r.bk&&r.bk.ops; if(!o) return []; if(Array.isArray(o.vanSplits)&&o.vanSplits.length) return o.vanSplits.map(s=>s.vanId).filter(Boolean); return o.vanId?[o.vanId]:[]; })))];
    const vanColor={}; _vanIdsRoute.forEach(vid=>{ vanColor[vid]=vehChipPair(vid); });   /* §สีประจำรถ · เดิมเป็น PAL_BOAT[ix%N] = สีตามลำดับ */
    const route = ROUTES.find(x=>x.id===rid);
    const fam = bookingV2RouteFamily(rid);
    // Program-family section header · shown once per family group · + closed (not-running) variants in faint red
    const _fid = fam?.id || 'zzz';
    let _famHead = '';
    if(_fid !== _prevFam){
      const _famAllIds = routeIds.filter(x => (bookingV2RouteFamily(x)?.id||'zzz')===_fid);
      // ทริปที่มีแถวอยู่แต่ปิดวันนั้น ต้องนับเป็น not running ไม่งั้นหัว family โกหก (เคยขึ้น "1 running" ทั้งที่
      // ตัวที่ running คือ Similan ที่ปิดยาวทั้งมรสุม และถูกดึงขึ้นมาด้วย booking ที่ยกเลิกไปแล้ว)
      const _famShut  = _famAllIds.filter(x => !bookingV2IsRouteOpenOn(x, date));
      const _runCount = _famAllIds.length - _famShut.length;
      const _famVariants = (typeof ROUTES!=='undefined'?ROUTES:[]).filter(rr => (bookingV2RouteFamily(rr.id)?.id||'zzz')===_fid);
      const _closedV = _famVariants.filter(rr => !routeIds.includes(rr.id) && !bookingV2IsRouteOpenOn(rr.id, date) && (pierF==='all' || rr.pier===pierF));
      const _closedChips = _closedV.map(rr => `<span class="t2-closedchip">${esc(rr.name)}</span>`).join('');
      // ── Family boat grid · collapsible · grouped by running variant (boat → pax/cap + guide + special meals) ──
      const _famRunIds = routeIds.filter(x => (bookingV2RouteFamily(x)?.id||'zzz')===_fid);
      const _FPAL=[['#E6F1FB','#185FA5'],['#E1F5EE','#0F6E56'],['#EEEDFE','#534AB7'],['#FAEEDA','#854F0B'],['#FAECE7','#993C1D'],['#FBEAF0','#993556'],['#EAF3DE','#3B6D11']];
      const _fIni=s=>String(s||'?').replace(/[^A-Za-z0-9 ]/g,'').trim().slice(0,2).toUpperCase()||'?';
      let _famPax=0,_famBoatN=0; const _famLang={}; let _fVeg=0,_fVegan=0,_fHalal=0,_fAllerg=0; let _fLtJoin=0,_fLtChtr=0,_fPt=0;
      const _famAddLang=(tgt,gd,t)=>{ if(gd.english)tgt['EN']=(tgt['EN']||0)+t; if(gd.russian)tgt['RU']=(tgt['RU']||0)+t; if(gd.chinese)tgt['CN']=(tgt['CN']||0)+t; const _ol=(gd.otherLang||'').trim(); if(_ol)tgt[_ol]=(tgt[_ol]||0)+t; };
      const _variantSections = _famRunIds.map((rid2,_vi)=>{
        const _vacc=_FPAL[_vi%_FPAL.length];   // per-variant accent (header strip + name)
        const route2=ROUTES.find(x=>x.id===rid2);
        const grp2=(groups[rid2]||[]).filter(r=>!r.cxl);
        const baB=(typeof baBoatsForRoute==='function')?baBoatsForRoute(date,rid2):[];
        const ag={}; const _bOrder=[];
        baB.forEach((x,ix)=>{ ag[x.boatId]={tot:0,lang:{},veg:0,vegan:0,halal:0,allerg:0,ltJoin:0,ltChtr:0,pt:0,col:_FPAL[ix%_FPAL.length],boat:x.boat,charter:false}; _bOrder.push(x.boatId); });
        // charter boats on this variant → each chartered boat is its OWN row (whole boat), like a seat boat
        grp2.forEach(r=>{ if(!r.charter) return; const _cbid=r.charterBoatId||bkOpsRead(r.bk,date).boatId; if(_cbid && !ag[_cbid]){ const _cbo=(BOATS||[]).find(b=>b.id===_cbid)||{}; ag[_cbid]={tot:0,lang:{},veg:0,vegan:0,halal:0,allerg:0,ltJoin:0,ltChtr:0,pt:0,col:['#EFEAFB','#5B289A'],boat:_cbo,charter:true}; _bOrder.push(_cbid); } });
        let vPax=0,uTot=0;
        grp2.forEach(r=>{ const bid=r.charter?(r.charterBoatId||bkOpsRead(r.bk,date).boatId):bkOpsRead(r.bk,date).boatId; const t=P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc'); vPax+=t;
          const gd=r.bk.guides||{}; const mm=r.bk.specialMeals||{};
          const _af=bookingV2AddOnFlags(r.bk, rid2);   // longtail join / charter / transfer on this variant
          const o=(bid&&ag[bid])?ag[bid]:null;
          const _exJoin=bookingV2LongtailExtraPax(r.bk.id, date);   // day-of "+ extra" longtail join (qty = people)
          const _exChtr=bookingV2LongtailCharterExtraBoats(r.bk.id, date);   // day-of "+ extra" private/charter longtail (qty = boats)
          if(o){ o.tot+=t; _famAddLang(o.lang,gd,t); o.veg+=mm.veg||0;o.vegan+=mm.vegan||0;o.halal+=mm.halal||0; o.allerg+=(typeof bookingV2AllergyCount==='function')?bookingV2AllergyCount(mm):((mm.allergies||'').trim()?1:0);
            if(_af.charter) o.ltChtr+=(_af.charterQty||1); else if(_af.join) o.ltJoin+=t; if(_af.transfer) o.pt+=t; o.ltJoin+=_exJoin; o.ltChtr+=_exChtr; }
          else if(!bid){ uTot+=t; }
          _famAddLang(_famLang,gd,t); _fVeg+=mm.veg||0;_fVegan+=mm.vegan||0;_fHalal+=mm.halal||0; _fAllerg+=(typeof bookingV2AllergyCount==='function')?bookingV2AllergyCount(mm):((mm.allergies||'').trim()?1:0);
          if(_af.charter) _fLtChtr+=(_af.charterQty||1); else if(_af.join) _fLtJoin+=t; if(_af.transfer) _fPt+=t; _fLtJoin+=_exJoin; _fLtChtr+=_exChtr;
        });
        _famPax+=vPax; _famBoatN+=_bOrder.length;
        const dep2=route2?.times?.[0]||'';
        const rows=_bOrder.map(bid=>{ const o=ag[bid]; const cap=(o.boat&&o.boat.cap)||0; const over=(cap-o.tot)<0; const bnm=(o.boat&&o.boat.name)||bid;
          const langCh=Object.keys(o.lang).map(code=>{ const lc=bookingV2LangColors(code); return `<span class="t2-dchip" style="background:${lc[0]};color:${lc[1]}">${esc(code)} ${o.lang[code]}</span>`; });
          const foodCh=[]; if(o.veg||o.vegan)foodCh.push(`<span class="t2-dchip" style="background:#EAF3DE;color:#3B6D11">${o.veg+o.vegan} veg</span>`); if(o.halal)foodCh.push(`<span class="t2-dchip" style="background:#E1F5EE;color:#0F6E56">${o.halal} halal</span>`); if(o.allerg)foodCh.push(`<span class="t2-dchip" style="background:#FCEBEB;color:#A32D2D">&#9888; ${o.allerg}</span>`);
          const addCh=[]; if(o.ltJoin)addCh.push(`<span class="t2-dchip" style="background:#E6F1FB;color:#1565A8">Longtail Join ${o.ltJoin} คน</span>`); if(o.ltChtr)addCh.push(`<span class="t2-dchip" style="background:#EFEAFB;color:#5B289A">Longtail เหมา ${o.ltChtr} ลำ</span>`); if(o.pt)addCh.push(`<span class="t2-dchip" style="background:#E1F5EE;color:#0F6E56">Transfer ${o.pt} คน</span>`);
          const chtrTag=o.charter?[`<span class="t2-dchip" style="background:#E7DEF8;color:#5B289A;font-weight:800">&#128676; เหมาลำ</span>`]:[];
          const ch=[].concat(chtrTag,langCh,foodCh,addCh);
          return `<div class="t2-vbrow${over?' t2-vbrow-over':''}"><div class="t2-vbtop"><span class="t2-mav" style="background:${over?'#C0392B':o.col[1]};flex:none">${_fIni(bnm)}</span><span class="t2-vbnm">${esc(bnm)}</span><span class="t2-vbcap"${over?' style="color:#A32D2D"':''}>${o.tot}/${cap}</span></div>${ch.length?`<div class="t2-vbchips">${ch.join('')}</div>`:''}</div>`;
        }).join('');
        const unRow=uTot>0?`<div class="t2-vbrow" style="background:#FFF9F0"><div class="t2-vbtop"><span class="t2-mav" style="background:#9A5B00;flex:none">&#9888;</span><span class="t2-vbnm" style="color:#9A5B00">ยังไม่ assign</span><span class="t2-vbcap" style="color:#9A5B00">${uTot}</span></div></div>`:'';
        const _pierLbl=route2?.pier?(' · '+(route2.pier==='tublamu'?'Tub Lamu':route2.pier==='panwa'?'Visit Panwa':esc(route2.pier))):'';
        return `<div class="t2-vcard"><div class="t2-vcard-hd" style="border-top-color:${_vacc[1]};background:${_vacc[0]}"><div class="t2-vcard-nm" style="color:${_vacc[1]}">${esc(route2?.name||rid2)}</div><div class="t2-vcard-sub"><span>${esc(dep2)}${_pierLbl}</span>${bookingV2IsRouteOpenOn(rid2,date)?`<span class="t2-vcard-px" style="color:${_vacc[1]}">${vPax} · ${_bOrder.length} เรือ</span>`:`<span class="t2-vcard-px" style="color:#A32D2D">not running</span>`}</div></div><div class="t2-vcard-body">${rows}${unRow}</div></div>`;
      }).join('');
      const _famGuide=Object.keys(_famLang).map(code=>{ const lc=bookingV2LangColors(code); return `<span class="t2-dchip" style="background:${lc[0]};color:${lc[1]}">${esc(code)} ${_famLang[code]}</span>`; });
      const _famFood=[]; if(_fVeg||_fVegan)_famFood.push(`<span class="t2-dchip" style="background:#EAF3DE;color:#3B6D11">${_fVeg+_fVegan} veg</span>`); if(_fHalal)_famFood.push(`<span class="t2-dchip" style="background:#E1F5EE;color:#0F6E56">${_fHalal} halal</span>`); if(_fAllerg)_famFood.push(`<span class="t2-dchip" style="background:#FCEBEB;color:#A32D2D">&#9888; ${_fAllerg}</span>`);
      const _famAdd=[]; if(_fLtJoin)_famAdd.push(`<span class="t2-dchip" style="background:#E6F1FB;color:#1565A8">Longtail Join ${_fLtJoin} คน</span>`); if(_fLtChtr)_famAdd.push(`<span class="t2-dchip" style="background:#EFEAFB;color:#5B289A">Longtail เหมา ${_fLtChtr} ลำ</span>`); if(_fPt)_famAdd.push(`<span class="t2-dchip" style="background:#E1F5EE;color:#0F6E56">Transfer ${_fPt} คน</span>`);
      const _famSum=[].concat(_famGuide,_famFood,_famAdd);
      // closed/off-season variants → muted "not running" cards (fill the grid for balanced layout)
      const _closedCards = _closedV.map(rr=>{ const _cd=rr.times?.[0]||''; const _cp=rr.pier?(' · '+(rr.pier==='tublamu'?'Tub Lamu':rr.pier==='panwa'?'Visit Panwa':esc(rr.pier))):'';
        return `<div class="t2-vcard t2-vcard-closed"><div class="t2-vcard-hd" style="border-top-color:#D98C82;background:#FCEBEB"><div class="t2-vcard-nm" style="color:#A32D2D">${esc(rr.name)}</div><div class="t2-vcard-sub"><span>${esc(_cd)}${_cp}</span><span class="t2-vcard-px" style="color:#A32D2D">not running</span></div></div><div class="t2-vcard-body"><div class="t2-vclosed-note">ไม่ออกวันนี้</div></div></div>`; }).join('');
      _famHead = `<details class="t2-famcard" style="border-left-color:${fam?.color||'#8b909c'}">`
        + `<summary class="t2-famcard-hd"><span class="t2-famnm">${esc(fam?.name||route?.name||'ไม่ทราบโปรแกรม')}</span><span class="t2-fampill t2-fampill-run">${_runCount} running</span>${(_closedV.length+_famShut.length)?`<span class="t2-fampill t2-fampill-closed">${_closedV.length+_famShut.length} not running</span>`:''}<span class="t2-fam-tot">รวม <b>${_famPax}</b> pax · ${_famBoatN} เรือ</span><span class="t2-famcaret">&#9662;</span></summary>`
        + `<div class="t2-fambody"><div class="t2-famvgrid">${_variantSections}${_closedCards}</div>${_famSum.length?`<div class="t2-boatsum"><span class="t2-boatsum-lbl">รวมทั้ง family</span>${_famSum.join('')}</div>`:''}</div>`
        + `</details>`;
    }
    _prevFam = _fid;
    const famColor = fam?.color || '#8b909c';
    const dep = route?.times?.[0] || (grp.find(r=>r.pickupTime)?.pickupTime) || '';
    const boats = bookingV2Tab2Boats(rid, date, grp.filter(r=>r.charterBoatId).map(r=>r.charterBoatId));
    const wxClosed = (typeof bookingV2IsWeatherClosed==='function' && bookingV2IsWeatherClosed(rid, date));
    // §notRunning (2026-07-29) · route ที่ "ปิด" ตามตารางเปิด-ปิด แต่ยังมีแถวอยู่ในวันนี้
    //   เดิมการ์ดทริปขึ้นมาเหมือนทริปเปิดปกติทุกอย่าง (มีปุ่ม + Assign boat · นับเป็น running) เพราะ routeIds
    //   สร้างจาก Object.keys(groups) ตรงๆ ซึ่งรวม booking ที่ยกเลิกแล้วด้วย — ใบที่ยกเลิกใบเดียวก็ดึงทริป
    //   ที่ปิดทั้งฤดูกาลขึ้นมาได้ (Similan · 30 ก.ค. 2026) ที่นี่ไม่ได้ซ่อนทริป แต่ติดป้ายให้เห็นทันทีว่าไม่ออก
    const _dayS   = (typeof getDayStatus==='function' && route) ? getDayStatus(route, date) : null;
    const _notRun = !!(_dayS && _dayS.type !== 'open');
    const _notRunWhy = !_notRun ? '' :
      (_dayS.source === 'override'       ? 'ปิดเฉพาะวันนี้ (ตั้ง override ไว้)'
     : _dayS.source === 'outside-season' ? 'อยู่นอกทุกช่วง season ที่ตั้งไว้ — น่าจะยังไม่ได้ตั้ง season ของปีนี้'
     :                                     'ปิดตามฤดูกาล (season)');
    const _notRunLive = grp.filter(r=>!r.cxl).length;
    const COLN = (18 - (vanMode?4:0)) + (vanMode?1:0) + (rcMode?1:0) + (wxClosed?1:0);   // vanMode hides add-on/pay/total/voucher (−4) + adds van (+1)
    const _wxc = wxClosed && typeof bookingV2WeatherCountsFor==='function' ? bookingV2WeatherCountsFor(rid, date) : null;

    // pax + prep aggregates
    let ad=0,chd=0,inf=0,foc=0, veg=0,vegan=0,halal=0, lug=0, allerg=0;
    let ltJoinPax=0, ltCharterBoats=0, ptPax=0;   // add-on prep aggregates (longtail join heads · charter boats · transfer heads)
    const langCnt = {};   // guide language → pax count needing it
    grp.forEach(r=>{
      if(r.cxl) return;   // cancelled bookings don't count toward trip pax / prep
      ad+=P(r.pax,'ad'); chd+=P(r.pax,'chd'); inf+=P(r.pax,'inf'); foc+=P(r.pax,'foc');
      const sm=r.bk.specialMeals||{}; veg+=sm.veg||0; vegan+=sm.vegan||0; halal+=sm.halal||0;
      allerg+=(typeof bookingV2AllergyCount==='function')?bookingV2AllergyCount(sm):((sm.allergies||'').trim()?1:0);
      lug += r.bk.largeLuggage||0;
      const g=r.bk.guides||{};
      const _rp = P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc');
      if(g.english) langCnt['EN']=(langCnt['EN']||0)+_rp;
      if(g.russian) langCnt['RU']=(langCnt['RU']||0)+_rp;
      if(g.chinese) langCnt['CN']=(langCnt['CN']||0)+_rp;
      const _ol=(g.otherLang||'').trim(); if(_ol) langCnt[esc(_ol)]=(langCnt[esc(_ol)]||0)+_rp;
      // ── add-on prep counts (shared detection · see bookingV2AddOnFlags) ──
      const _af=bookingV2AddOnFlags(r.bk, r.routeId);
      if(_af.charter) ltCharterBoats += (_af.charterQty||1);          // charter = whole boat · count boats (× qty)
      else if(_af.join) ltJoinPax+=_rp;          // join = per-head · count heads riding the longtail
      if(_af.transfer) ptPax+=_rp;
      ltJoinPax += bookingV2LongtailExtraPax(r.bk.id, date);   // + day-of longtail join sold via "+ extra"
      ltCharterBoats += bookingV2LongtailCharterExtraBoats(r.bk.id, date);   // + day-of private/charter longtail (boats)
    });
    const recv = ad+chd+inf+foc;
    // Seat vs Charter split (per pax-type) + remaining sellable seats (for the trip-header summary)
    let _sAd=0,_sChd=0,_sInf=0,_sFoc=0, _cAd=0,_cChd=0,_cInf=0,_cFoc=0;
    grp.forEach(r=>{ if(r.cxl) return; const a=P(r.pax,'ad'),c=P(r.pax,'chd'),i=P(r.pax,'inf'),f=P(r.pax,'foc'); if(r.charter){_cAd+=a;_cChd+=c;_cInf+=i;_cFoc+=f;} else {_sAd+=a;_sChd+=c;_sInf+=i;_sFoc+=f;} });
    const _seatPax=_sAd+_sChd+_sInf+_sFoc, _chtrPax=_cAd+_cChd+_cInf+_cFoc;
    // Charter detail strip (trip header) — which boat is chartered, pax/cap, agency, lead
    // §boatSplit · ใบที่แยกลง N ลำ ต้องได้ N ชิป · ยอดเป็นของลำนั้น ไม่ใช่ยอดทั้งใบ
    const _chtrItems = [];
    grp.filter(r=>r.charter && !r.cxl).forEach(r=>{ const bk=r.bk;
      const ag=(bk.agentId?(((typeof SB_AGENTS!=='undefined'?SB_AGENTS:[]).find(a=>a.id===bk.agentId)||{}).name||''):'')||bk.agentName||bk.channel||'';
      const lead=bk.leadPax||''; const ltime=(r.t&&r.t.pickupTime)||bk.pickupTime||'';
      const push=(bid,px,nOf)=>{ const bo=bid?((BOATS||[]).find(b=>b.id===bid)||{}):{};
        _chtrItems.push({bn:bo.name||(bid||''), cap:+bo.cap||0, px:px, ag, lead, ltime, bid, nOf:nOf||''}); };
      const sp=(typeof bkBoatSplits==='function')?bkBoatSplits(bk,date):null;
      if(sp) sp.forEach((x,i)=>push(x.boatId||'', bkPaxSum(bkSplitPax(x)), (i+1)+'/'+sp.length));
      else push(r.charterBoatId||bkOpsRead(bk,date).boatId||'', (typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(r.pax||{}):0, '');
    });
    /* §btChBand · แถบเรือลอยเหนือตารางถูกยุบเข้าแถบ CHARTER ในตารางแล้ว · ดู _zband */
    const _al=(typeof getAllotment==='function')?getAllotment(rid,date):null;
    // Availability = seats on the OPEN boats that are NOT taken by a charter − SEAT bookings − locks.
    //   · charter pax are NOT counted (a chartered boat is removed whole from the pool, via the booking's charterBoatId — no need to wait for Boat-Op flagging)
    const _openBoats=(typeof baBoatsForRoute==='function')?baBoatsForRoute(date,rid):[];
    // §boatSplit · อ่านจาก bkBoatIdsOn — ครอบคลุมทั้งใบที่แยกลำ และใบที่ไม่ได้ระบุ charterBoatId ตอนจอง
    const _chtrBoatSet=new Set();
    grp.filter(r=>r.charter && !r.cxl).forEach(r=>{
      const ids=(typeof bkBoatIdsOn==='function')?bkBoatIdsOn(r.bk,date):[];
      (ids.length?ids:[r.charterBoatId]).forEach(id=>{ if(id) _chtrBoatSet.add(id); });
    });
    const _seatCap=_openBoats.filter(x=>!_chtrBoatSet.has(x.boatId)).reduce((s,x)=>s+((x.boat&&(x.boat.cap||x.boat.licensePax))||0),0);
    const _lockedSeats=(_al&&_al.lockedSeats)||0;
    const _seatLeft=_openBoats.length?Math.max(0, _seatCap - _seatPax - _lockedSeats):null;
    const _bdStr=(a,c,i,f)=>`(${a}+${c}+${i}+${f}FOC)`;
    const boatChip = boats.length
      ? boats.map(b=>`<span class="t2-boatchip"><span class="t2-bav" style="background:${famColor}">${esc(b.name).slice(0,2).toUpperCase()}</span>${esc(b.name)}</span>`).join('')
      : (_notRun ? `<span class="t2-assign-off" title="${esc(_notRunWhy)}">ไม่ออกวันนี้</span>`
                 : `<button class="t2-assign" onclick="event.stopPropagation();alert('Assign boat to this trip (open Boat Operation)')">+ Assign boat</button>`);
    // Prep grouped by category · Guide together · Food + allergy together · Bags separate
    const _guideChips = Object.keys(langCnt).map(code=>{ const lc=bookingV2LangColors(code); return `<span class="t2-prep" style="background:${lc[0]};color:${lc[1]}">${code} · ${langCnt[code]}</span>`; });
    const _foodChips = [];
    if(veg||vegan) _foodChips.push(`<span class="t2-prep" style="background:#EAF3DE;color:#3B6D11">${veg} veg${vegan?` · ${vegan} vegan`:''}</span>`);
    if(halal) _foodChips.push(`<span class="t2-prep" style="background:#E1F5EE;color:#0F6E56">${halal} halal</span>`);
    if(allerg) _foodChips.push(`<span class="t2-prep" style="background:#FCEBEB;color:#A32D2D">&#9888; ${allerg} allergy</span>`);
    const _bagChips = [];
    if(lug) _bagChips.push(`<span class="t2-prep" style="background:#FAEEDA;color:#854F0B">${lug} large bag</span>`);
    const _prepGroup = (label, chips) => chips.length ? `<span class="t2-prepgrp"><span class="t2-prepcat">${label}</span>${chips.join('')}</span>` : '';
    const prepGroups = [
      _prepGroup('Guide', _guideChips),
      _prepGroup('Food', _foodChips),
      _prepGroup('Bags', _bagChips),
    ].filter(Boolean);
    // Add-on prep summary chips (trip header) — how many longtails / transfers to arrange
    const _addonSum = [];
    if(ltJoinPax)      _addonSum.push(`<span class="t2-aochip t2-aochip-join">Longtail Join · <b>${ltJoinPax}</b> คน</span>`);
    if(ltCharterBoats) _addonSum.push(`<span class="t2-aochip t2-aochip-chtr">Longtail เหมา · <b>${ltCharterBoats}</b> ลำ</span>`);
    if(ptPax)          _addonSum.push(`<span class="t2-aochip t2-aochip-tr">Transfer · <b>${ptPax}</b> คน</span>`);
    const addonBar = _addonSum.length ? `<div class="t2-addonbar"><span class="t2-addonbar-lbl">Add-ons</span>${_addonSum.join('')}</div>` : '';
    // Return-trip alert — bookings that drop off at a DIFFERENT place than pickup but have no return van arranged yet
    const _retAlertN = grp.filter(r=>!r.cxl && (typeof bookingV2RetInfo==='function') && bookingV2RetInfo(r.bk,date).alert).length;
    const retAlertBar = _retAlertN ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 16px 8px 21px;background:#FCEDED;border-top:1px solid #F3C5C5"><span style="font-size:10px;font-weight:700;color:#C0392B;text-transform:uppercase;letter-spacing:.05em">&#9888; ส่งกลับคนละที่</span><span style="font-size:12px;background:#FBE3E1;color:#C0392B;font-weight:700;border-radius:8px;padding:3px 10px">${_retAlertN} booking ยังไม่จัดรถกลับ</span><span style="font-size:11px;color:#9A5B00">เลือกรถกลับในโหมด Van Assign (ช่อง ↩ รถกลับ)</span></div>` : '';

    // zone subgroups · CHARTER (เหมาลำ) bookings get their own pseudo-zone '__CHARTER__' rendered FIRST
    //   (full manifest table · boat-assign + all columns work the same · header restyled as a Charter card)
    const zg = {};
    // Charter (เหมาลำ) → own pseudo-zone card (all modes · shown at top). Van grouping for charter uses the
    // '__CHARTER__' namespace consistently (see _bkV2InZone / heal), so picking a van works here too.
    grp.forEach(r=>{ const zk=(r.charter && !r.cxl)?'__CHARTER__':r.zone; (zg[zk]=zg[zk]||[]).push(r); });
    const _zord=z=> z==='__CHARTER__'? -100 : bookingV2ZoneOrder(z);
    const zones = Object.keys(zg).sort((a,b)=>_zord(a)-_zord(b));
    // When this trip is split across 2+ boats, color-code each row by its assigned boat (left accent + faint tint)
    const _routeBoatIds = [...new Set(grp.filter(r=>!r.cxl && bkOpsRead(r.bk,date).boatId).map(r=>bkOpsRead(r.bk,date).boatId))];   /* §per-trip ops · เดิมอ่านเรือของวันแรกเสมอ */
    const _multiBoat = _routeBoatIds.length >= 2;

    const zoneBlocks = zones.map(z=>{
      const list = (zg[z]||[]).filter(r=>!r.cxl);   // active only · cancelled go to their own block below
      if(sortCol) list.sort(_rowCmp);
      if(!list.length) return '';
      const zpax = list.reduce((s,r)=> s + (P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc')), 0);
      // ── Van grouping: cluster rows by bk.ops.vanGroup · ungrouped last · color per group ──
      //    shown in Van-Assign mode (editable) AND in the normal manifest (read-only · soft pastel)
      const _rowTime=r=>((bkOpsRead(r.bk,date).pickupTimeFinal||r.pickupTime||r.bk.pickupTime||'').trim());
      const _pHead=r=>(P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc'));
      // Allocations · a split booking (bk.ops.vanSplits) becomes multiple alloc rows (van mode) · each can join a different group/van
      // Split a booking into one allocation row per van-split. Van Assign mode splits ALL splits; the
      // normal/read-only manifest also splits AUTO alt-pickup bookings (altSplitAuto) so รับหลายจุด shows
      // as a row per pickup point (same booking) — but NOT in Boat Assign mode (boat is per booking).
      const _allocsOf=r=>{ const b=r.bk; const _o=bkOpsRead(b,date);
        /* §split rows · เดิมกางแถวเฉพาะโหมด Van หรือ split ที่มาจาก "รับหลายจุด" — split จาก "แยกคน"
           ถูกยุบเป็นแถวเดียวในหน้าปกติ คนอ่านเลยไม่เห็นว่าใครขึ้นคันไหน · ตอนนี้กางทุกแถว ยกเว้นโหมด Boat
           (เรือผูกกับบุ๊กกิ้งทั้งก้อน ไม่ได้ผูกกับ split → กางแล้วจะซ้ำเปล่าๆ) */
        /* §boatSplit · บุคกิ้งที่แยกลงหลายลำ (กรุ๊ปใหญ่ที่ลำเดียวไม่พอ) → 1 แถวต่อลำ
           มาก่อน vanSplits เพราะ "ลงลำไหน" สำคัญกว่า "ขึ้นรถคันไหน" เมื่อทั้งสองอย่างแยกพร้อมกัน */
        const _bsp = (Array.isArray(_o.boatSplits) && _o.boatSplits.length>1) ? _o.boatSplits : null;
        if(_bsp){ const _g0=+_o.vanGroup||0, _s0=+_o.vanSeq||0;
          return _bsp.map((sp,i)=>({r,idx:i,head:bkPaxSum(bkSplitPax(sp)),bd:bkSplitPax(sp),g:_g0,seq:_s0,vanId:_o.vanId||null,
            key:b.id+'#'+i,split:true,first:i===0,boatId:sp.boatId||null,bsplit:true,bsN:_bsp.length})); }
        if(!boatMode && Array.isArray(_o.vanSplits) && _o.vanSplits.length){ return _o.vanSplits.map((s,i)=>({r,idx:i,head:+s.pax||0,bd:bkSplitPax(s),g:+s.vanGroup||0,seq:+s.vanSeq||0,vanId:s.vanId||null,key:b.id+'@'+i,split:true,first:i===0,pick:{areaId:s.pickAreaId||'',hotel:s.pickHotel||'',zone:s.pickZone||'',who:s.altWho||'',main:!!s.main}})); } const _hasSp = Array.isArray(_o.vanSplits) && _o.vanSplits.length;
        const g  = _hasSp ? (+_o.vanSplits[0].vanGroup||0) : (+_o.vanGroup||0);
        const sq = _hasSp ? (+_o.vanSplits[0].vanSeq||0)   : (+_o.vanSeq||0);
        return [{r,idx:-1,head:_pHead(r),g,seq:sq,vanId:_o.vanId||null,key:b.id,split:false,first:true}]; };
      let alist=[]; list.forEach(r=>{ _allocsOf(r).forEach(a=>alist.push(a)); });
      const _rowG=r=>{ const b=r.bk; const _o=bkOpsRead(b,date); if(Array.isArray(_o.vanSplits)&&_o.vanSplits.length) return +_o.vanSplits[0].vanGroup||0; return +_o.vanGroup||0; };
      const _anyGroup = alist.some(a=>a.g>0);
      const _grouped = vanMode || _anyGroup;
      const _hasGroups = alist.some(a=>a.g>0);   // at least one van group exists → frame + float un-assigned rows to top
      // ── Boat Assign mode: cluster rows by their assigned boat (like Van Assign clusters by group) ──
      //    so the same-boat rows stick together + un-assigned rows float to the TOP (= what's left to assign)
      const _boatCluster = boatMode && !vanMode;
      const _boatId=a=>(a.boatId||bkOpsRead(a.r.bk, date).boatId||'');   // per-day boat · §boatSplit อ่านจาก alloc ก่อน
      const _boatIdx=bid=>{ if(!bid) return -1; const arr=(typeof BOATS!=='undefined'&&BOATS)||[]; const i=arr.findIndex(x=>x.id===bid); return i<0?999:i; };
      if(_boatCluster){
        alist.sort((x,y)=>{ const bx=_boatId(x), by=_boatId(y); const ua=bx?0:-1, ub=by?0:-1; if(ua!==ub) return ua-ub; const ka=_boatIdx(bx), kb=_boatIdx(by); if(ka!==kb) return ka-kb; const ta=_rowTime(x.r)||'~~', tb=_rowTime(y.r)||'~~'; return ta<tb?-1:ta>tb?1:0; });
      }
      // ungrouped (g=0) → sort key -1 so newly-added / not-yet-assigned bookings pop to the TOP (was: last)
      else if(_grouped){ alist.sort((x,y)=>{ const ka=x.g>0?x.g:-1, kb=y.g>0?y.g:-1; if(ka!==kb) return ka-kb;
        // manual pickup-seq matters ONLY within a real group (g>0) · a stale vanSeq left on an ungrouped row must NOT freeze its order
        if(ka>0){ const sa=x.seq||0, sb=y.seq||0; if(sa||sb){ const da=sa||9999, db=sb||9999; if(da!==db) return da-db; } }
        // tiebreak: honor an active column Sort (Agency/Zone) if the user clicked one, else by pickup time
        if(sortCol){ const c=_rowCmp(x.r,y.r); if(c) return c; }
        const ta=_rowTime(x.r)||'~~', tb=_rowTime(y.r)||'~~'; return ta<tb?-1:ta>tb?1:0; }); }
      const groupColor={};
      // §สีประจำรถ · 1 กลุ่ม = 1 คัน → ใช้สีของรถคันนั้น (เดิม PAL_BOAT[i%N] = สีตามลำดับกลุ่ม
      // ทำให้ Love3 เป็นสีนึงวันนี้ อีกสีพรุ่งนี้) · กลุ่มที่ยังไม่เลือกรถ ค่อยใช้สีกลางๆ
      if(_grouped){ const gids=[...new Set(alist.map(a=>a.g).filter(g=>g>0))];
        gids.forEach((g,i)=>{ const _gv=(alist.find(a=>a.g===g&&a.vanId)||{}).vanId;
          groupColor[g] = _gv ? vehChipPair(_gv) : PAL_BOAT[i%PAL_BOAT.length]; }); }
      // which groups still have NO van picked → red-frame them as a warning (until a van is chosen)
      const _grpVan={}; alist.forEach(a=>{ if(a.g>0 && a.vanId) _grpVan[a.g]=true; });
      const _novanLast={}; alist.forEach(a=>{ if(a.g>0 && !_grpVan[a.g]) _novanLast[a.g]=a.key; });   // last member of each no-van group (alist is in cluster order) → gets the box's bottom border
      const _grpHeaderRow=(g)=>{
        const mem=alist.filter(a=>a.g===g);
        const gpax=mem.reduce((s,a)=>s+a.head,0);
        const c=groupColor[g]||['#EEEDF0','#555'];
        const vid=(mem.find(a=>a.vanId)||{}).vanId||'';
        const _gVans=[...new Set(mem.map(a=>a.vanId).filter(Boolean))];   // distinct vans in this group
        const _gConf=_gVans.length>1;   // ⚠ รถปนกัน → booking จะขึ้นใบงานผิดคัน
        const _gConfChip=_gConf?`<span title="รถปนกันในกรุ๊ป: ${esc(_gVans.map(v=>((vehGet(v)||{}).name||v)).join(' / '))} — เลือกรถใหม่ให้ทั้งกรุ๊ปเป็นคันเดียว มิฉะนั้นใบงานจะส่งคนผิดคัน" style="display:inline-flex;align-items:center;gap:5px;background:#F3E0F7;color:#7A1FA2;border:1px solid #D9A8E8;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:800;white-space:nowrap">&#9888; รถปนกัน: ${esc(_gVans.map(v=>((vehGet(v)||{}).name||v)).join(' / '))}</span>`:'';
        const _gtime=(function(){ const m=mem.find(a=>bkOpsRead(a.r.bk,date).pickupTimeFinal); return m?bkOpsRead(m.r.bk,date).pickupTimeFinal:''; })();
        if(!vanMode){
          // read-only · Option 2 · solid van pill (group# + name) + ทะเบียน / คนขับ / เบอร์โทร
          const v=vid?vehGet(vid):null;
          const vn=v?(v.name||''):'';
          const pillBg=c[1]||'#3A6FF7';
          const vanPill = vn
            ? `<span style="display:inline-flex;align-items:center;gap:7px;background:${pillBg};color:#fff;border-radius:999px;padding:4px 13px 4px 5px;font-size:12px;font-weight:700;white-space:nowrap"><span style="width:19px;height:19px;border-radius:50%;background:rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-size:10px;font-family:'DM Mono',monospace">${g}</span>${esc(vn)}</span>`
            : `<span style="display:inline-flex;align-items:center;gap:7px;background:#fff;color:#9a8f88;border:1px dashed #cfc8c0;border-radius:999px;padding:4px 13px 4px 5px;font-size:12px;font-weight:700;white-space:nowrap"><span style="width:19px;height:19px;border-radius:50%;background:#EEEDE8;color:#7a7870;display:flex;align-items:center;justify-content:center;font-size:10px;font-family:'DM Mono',monospace">${g}</span>ยังไม่เลือกรถ</span>`;
          // return van for this group (if different from the outbound van) → show "รับ X · กลับ Y"
          const _retVid=(mem.map(a=>{ const o=bkOpsRead(a.r.bk,date); if(a.split && Array.isArray(o.vanSplits) && o.vanSplits[a.idx]) return o.vanSplits[a.idx].vanReturnId; return o.vanReturnId; }).find(rv=>rv && rv!==vid))||'';
          const _retNm=_retVid?((vehGet(_retVid)||{}).name||_retVid):'';
          const _legTag=_retVid?`<span style="font-size:10px;font-weight:700;color:#0F6E56;letter-spacing:.02em">รับ</span>`:'';
          const _retChip=_retVid?`<span style="display:inline-flex;align-items:center;gap:6px;background:#FBF0E0;color:#9A5B00;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;white-space:nowrap">↩ กลับ ${esc(_retNm)}</span>`:'';
          const _rd = (vid && typeof vanJobsDriverInfo==='function')?vanJobsDriverInfo(vid,date):{driver:(v&&v.driver)||'',phone:(v&&v.driverPhone)||'',plate:(v&&v.plate)||'',override:false,plateOverride:false};
          const _pin = (ov)=>ov?'<span title="อัปเดตวันนี้" style="font-size:9px;margin-left:2px">&#128204;</span>':'';
          const _info=[];
          if(vid && _rd.plate) _info.push(`<span style="display:inline-flex;align-items:center;gap:4px"><span style="font-size:9px;color:#a3a39b;text-transform:uppercase;letter-spacing:.03em">ทะเบียน</span><b style="font-weight:700;color:#3a3a36;font-family:'DM Mono',monospace">${esc(_rd.plate)}</b>${_pin(_rd.plateOverride)}</span>`);
          if(vid && _rd.driver) _info.push(`<span style="display:inline-flex;align-items:center;gap:4px"><span style="font-size:9px;color:#a3a39b;text-transform:uppercase;letter-spacing:.03em">คนขับ</span><b style="font-weight:700;color:#3a3a36">${esc(_rd.driver)}</b>${_pin(_rd.override&&!_rd.plateOverride?true:false)}</span>`);
          if(vid && _rd.phone) _info.push(`<a href="tel:${esc(_rd.phone)}" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none;color:#185FA5"><span style="font-size:11px">&#128222;</span><b style="font-weight:700;font-family:'DM Mono',monospace">${esc(_rd.phone)}</b></a>`);
          const infoHtml = _info.length?`<span style="display:inline-flex;align-items:center;gap:13px;flex-wrap:wrap">${_info.join('<span style="width:1px;height:12px;background:#dcdad3"></span>')}</span>`:'';
          /* §vanBoatSplit · รถคันนี้ส่งคนขึ้นเรือลำไหนบ้าง · ระบบผูกรถกับเรือคนละเส้น หน้านี้เลยไม่เคยบอก
             คันที่แยกลงหลายลำคือคันที่พลาดง่ายที่สุด ต้องเห็นตั้งแต่ตอนจัดรถ ไม่ใช่ไปเจอหน้าท่า */
          const _bsp=(vid && typeof pckVanBoatSplit==='function')?pckVanBoatSplit(vid,date):[];
          const _boatChips=_bsp.length?`<span style="display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap">`
            +(_bsp.length>1?`<span style="font-size:10px;font-weight:800;color:#A32D2D;white-space:nowrap">&#9888; แยกลง ${_bsp.length} ลำ</span>`:'')
            +_bsp.map(x=>{ const nm=x.bid?((typeof pckBoatName==='function')?pckBoatName(x.bid):x.bid):'ยังไม่จัดเรือ';
                const bc=x.bid?bookingV2BoatAvatarColor(x.bid):'#a5a49d';
                return `<span title="รถคันนี้ส่งขึ้นเรือ ${esc(nm)} ${x.pax} คน (${x.n} booking)" style="display:inline-flex;align-items:center;gap:4px;background:${_bkV2Soft(bc,0.9)};color:${bc};border:1px solid ${bc}55;border-radius:999px;padding:2px 9px;font-size:10.5px;font-weight:700;white-space:nowrap">&#128676; ${esc(nm)} ${x.pax}</span>`; }).join('')
            +`</span>`:'';
          /* §vgRound · โหมดอ่านอย่างเดียวก็ต้องเห็นว่าคันนี้วิ่งรอบที่เท่าไหร่
             คนที่เปิดดูเฉย ๆ คือคนที่ต้องรู้ว่าทำไมรถคันเดียวโผล่สองแถบ */
          const _rndR=vid?((typeof vjRoundOfC==='function')?vjRoundOfC(date,vid,rid,g):null):null;
          const _rndRC=_rndR?`<span title="รถคันนี้วิ่งโปรแกรมนี้ ${_rndR.tot} รอบวันนี้ · แถวนี้คือรอบที่ ${_rndR.no}${_rndR.tm?(' · ออก '+esc(_rndR.tm)):''}" style="display:inline-flex;align-items:center;gap:5px;background:#fff;color:${c[1]};border:1.5px solid ${c[1]};border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:800;white-space:nowrap">&#8635; รอบ ${_rndR.no} / ${_rndR.tot}</span>`:'';
          return `<tr><td colspan="${COLN}" style="background:${_bkV2Soft(c[0],(_rndR&&_rndR.no>1)?0.965:0.92)};padding:7px 12px${(_rndR&&_rndR.no>1)?(';border-top:1px dashed '+c[1]+'66'):''}">
            <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">
              ${_legTag}${vanPill}${_rndRC}${_gConfChip}${_retChip}${_boatChips}
              ${infoHtml}
              <span style="margin-left:auto;font-size:11px;color:#8a8a82;font-family:'DM Mono',monospace;white-space:nowrap">${mem.length} ราย · ${gpax} pax${_gtime?(' · '+esc(_gtime)):''}</span>
            </div></td></tr>`;
        }
        /* §vgRound · เดิม "· ใช้แล้ว" + disabled · ตอนนี้บอกตรง ๆ ว่าเลือกไปคือให้วิ่งรอบถัดไป
           และบอกด้วยว่ารอบที่มีอยู่แล้วออกกี่โมง คนจัดจะได้ตัดสินใจได้ทันทีว่าไล่ทันไหม
           รถที่ที่นั่งไม่พอยังปิดเหมือนเดิม · อันนั้นคือข้อจำกัดจริงของคัน ไม่ใช่กฎที่เราตั้งเอง */
        const _usedG={};
        alist.forEach(a=>{ if(a.g && a.g!==g && a.vanId && !_usedG[a.vanId]){
          const _uo=(typeof bkOpsRead==='function')?bkOpsRead(a.r.bk,date):null;
          _usedG[a.vanId]={g:a.g, tm:(_uo&&_uo.pickupTimeFinal)||''}; } });
        const pool=(typeof vanVehiclesForRoute==='function')?vanVehiclesForRoute(date,rid,z):[];
        let opts=pool.length?'<option value="">— เลือกรถ (ทีหลังได้) —</option>':'<option value="">— ยังไม่มีรถจัดให้โปรแกรมนี้ (จัดในตารางเดือน) —</option>';
        pool.forEach(v=>{ const _uu=(v.id!==vid)?_usedG[v.id]:null; const overCap=v.id!==vid&&(v.capacity||0)>0&&gpax>(v.capacity||0); opts+=`<option value="${v.id}" ${vid===v.id?'selected':''} ${overCap?'disabled':''}>${esc(v.name||v.id)}${v.capacity?(' · '+v.capacity+' ที่นั่ง'):''}${v.plate&&v.plate!=='-'?(' · '+esc(v.plate)):''}${_uu?(' · \u21bb รอบถัดไป (อยู่กรุ๊ป '+_uu.g+(_uu.tm?(' · '+_uu.tm):'')+')'):''}${overCap?' · ที่นั่งไม่พอ':''}</option>`; });
        if(vid && !pool.some(v=>v.id===vid)){ const vo=vehGet(vid); opts+=`<option value="${vid}" selected>${esc((vo&&vo.name)||vid)}</option>`; }
        const cap=vid?((vehGet(vid)||{}).capacity||0):0; const over=cap&&gpax>cap;
        /* §vgRound · กรุ๊ปนี้เป็นรอบที่เท่าไหร่ของรถคันนี้ · null = คันนี้วิ่งรอบเดียว → ไม่มีอะไรเปลี่ยน
           จำเป็นต้องมีป้าย เพราะสีหัวกรุ๊ปคือสีประจำรถ · รถคันเดียวสองกรุ๊ป = สองแถบสีเดียวกันเป๊ะ */
        const _rnd=vid?((typeof vjRoundOfC==='function')?vjRoundOfC(date,vid,rid,g):null):null;
        const _rndPrev=(_rnd&&_rnd.no>1)?(_rnd.tms[_rnd.no-2]||''):'';
        /* เตือนเฉพาะที่เป็นไปไม่ได้จริง ๆ · เวลาเท่ากัน หรือยังไม่ตั้งเวลาสักรอบ
           ไม่ไปเดาว่าต้องห่างกันกี่นาทีถึงจะพอ — คนจัดรถรู้ระยะทางดีกว่าระบบ */
        const _rndBad=!!(_rnd && _rnd.no>1 && (!_rnd.tm || !_rndPrev || _rnd.tm===_rndPrev));
        const _rndChip=_rnd?`<span title="รถคันนี้วิ่งโปรแกรมนี้ ${_rnd.tot} รอบวันนี้ · กรุ๊ปนี้คือรอบที่ ${_rnd.no}${_rnd.tm?(' · ออก '+esc(_rnd.tm)):''} — ใบงานรถแยกใบตามรอบ" style="display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:800;white-space:nowrap;${_rnd.no>1?('background:#fff;color:'+c[1]+';border:1.5px solid '+c[1]):('background:'+c[1]+';color:#fff')}">&#8635; รอบ ${_rnd.no} / ${_rnd.tot}</span>`:'';
        const _rndWarn=_rndBad?`<span title="รถคันเดียวอยู่สองที่พร้อมกันไม่ได้ — ตั้งเวลารับของแต่ละรอบให้ต่างกัน" style="display:inline-flex;align-items:center;gap:5px;background:#FCEBEB;color:#A32D2D;border:1px solid #E6C9C3;border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:800;white-space:nowrap">&#9888; ${!_rnd.tm||!_rndPrev?'ยังไม่ตั้งเวลารอบ':'เวลาชนกับรอบก่อน'}</span>`:'';
        const _rndBg=(_rnd&&_rnd.no>1)?_bkV2Soft(c[1],0.955):null;
        /* §per-trip ops · หัวกรุ๊ปเคยอ่าน bk.ops ตรงๆ → เวลารับ/รถกลับของ OVN วันที่ 2 โชว์ค่าของวันที่ 1 */
        const _mOps=a=>(typeof bkOpsRead==='function')?bkOpsRead(a.r.bk,date):((a.r.bk.ops)||{});
        const ctime=((mem.map(_mOps).find(o=>o&&o.pickupTimeFinal))||{}).pickupTimeFinal||'';
        const rvid=((mem.filter(a=>a.vanId).map(_mOps).find(o=>o&&o.vanReturnId))||{}).vanReturnId||'';
        const _retPool=[...pool, ...((typeof vanVehiclesForZone==='function'?vanVehiclesForZone(z,date):[]).filter(v=>!pool.some(p=>p.id===v.id)))];   // ขากลับ = รถ zone เดียวกันคันไหนก็ได้ในวันนั้น (กว้างกว่า ขาไป)
        let ropts='<option value="">รถกลับ: เหมือนเดิม</option>';
        _retPool.forEach(v=>{ ropts+=`<option value="${v.id}" ${rvid===v.id?'selected':''}>กลับ: ${esc(v.name||v.id)}</option>`; });
        if(rvid && !_retPool.some(v=>v.id===rvid)){ const vo=vehGet(rvid); ropts+=`<option value="${rvid}" selected>กลับ: ${esc((vo&&vo.name)||rvid)}</option>`; }
        const _drvO=(typeof VANJOB_DRIVER!=='undefined'&&vid)?(VANJOB_DRIVER[date+'::'+vid]||{}):{}; const _drvV=vid?(vehGet(vid)||{}):{};   // per-date driver/phone (shared with the Van Job Order page)
        return `<tr ${vid?`id="vg-${rid}-${vid}"`:''}><td colspan="${COLN}" style="background:${vid?(_rndBg||c[0]):'#FCEDED'};box-shadow:inset 4px 0 0 ${vid?c[1]:'#D64545'};padding:6px 12px;${(_rnd&&_rnd.no>1)?('border-top:1px dashed '+c[1]+'88;'):''}${vid?'':'border-top:2px solid #E05B5B;border-left:2px solid #E05B5B;border-right:2px solid #E05B5B'}">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:12px;color:${vid?c[1]:'#C0392B'}">&#128656; กรุ๊ป ${g}${vid?'':' · ⚠ ยังไม่เลือกรถ'}</span>
            ${_rndChip}${_rndWarn}
            ${_gConfChip}
            <span style="font-size:11px;color:#6a6a64">${mem.length} booking · <b style="color:${over?'#A32D2D':c[1]}">${gpax}${cap?'/'+cap:''} pax</b></span>
            <select onchange="event.stopPropagation();bookingV2VanGroupSetVan('${date}','${rid}','${z}','${g}',this.value)" onclick="event.stopPropagation()" style="border:1px solid ${vid?'#9FE1CB':'#E6C9C3'};border-radius:6px;padding:3px 7px;font-size:11px;font-family:inherit;background:#fff;font-weight:${vid?'700':'400'}">${opts}</select>
            <input type="text" value="${esc(ctime)}" placeholder="ตั้งเวลาทั้งกรุ๊ป" onclick="event.stopPropagation()" oninput="bookingV2VanGroupSetTime('${date}','${rid}','${z}','${g}',this.value)" title="ตั้งเวลารับให้ทุกแถวในกรุ๊ป (ปรับรายโรงแรมได้ที่คอลัมน์เวลา)" style="border:1px solid #ddd;border-radius:6px;padding:3px 7px;font-size:11px;font-family:'DM Mono',monospace;width:108px">
            <select onchange="event.stopPropagation();bookingV2VanGroupSetReturn('${date}','${rid}','${z}','${g}',this.value)" onclick="event.stopPropagation()" title="รถขากลับ (ถ้าต่างจากขาไป)" style="border:1px solid ${rvid?'#C7B8E8':'#ddd'};border-radius:6px;padding:3px 7px;font-size:11px;font-family:inherit;background:#fff;color:${rvid?'#534AB7':'#888'}">${ropts}</select>
            ${vid?`<span onclick="event.stopPropagation()" title="คนขับวันนี้ของรถคันนี้ — เชื่อมกับใบงานรถ (แก้ที่ไหนก็อัปเดตอีกที่)" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#5a6b62">&#128100;<input value="${esc(_drvO.driver||'')}" oninput="vanJobsSetDriver('${date}','${vid}','driver',this)" placeholder="${esc(_drvV.driver||'คนขับ')}" style="width:86px;border:1px solid #d7dbe2;border-radius:6px;padding:3px 6px;font-size:11px;font-family:inherit;color:#1B2A55"><input value="${esc(_drvO.phone||'')}" oninput="vanJobsSetDriver('${date}','${vid}','phone',this)" placeholder="${esc(_drvV.driverPhone||'เบอร์')}" style="width:96px;border:1px solid #d7dbe2;border-radius:6px;padding:3px 6px;font-size:11px;font-family:'DM Mono',monospace;color:#1B2A55">${_drvV.ownership==='partner'?`<input value="${esc(_drvO.plate||'')}" oninput="vanJobsSetDriver('${date}','${vid}','plate',this)" placeholder="${esc((_drvV.plate&&_drvV.plate!=='-')?_drvV.plate:'ทะเบียน')}" title="ทะเบียนรถวันนี้ (รถร่วม)" style="width:84px;border:1px solid #E6C9A3;border-radius:6px;padding:3px 6px;font-size:11px;font-family:'DM Mono',monospace;color:#8a5500">`:''}${(_drvO.driver||_drvO.phone||_drvO.plate)?'<span style="font-size:9px" title="อัปเดตแล้ว">&#128204;</span>':''}</span>`:''}
            <button onclick="event.stopPropagation();bookingV2VanGroupSave('${date}')" title="บันทึก · ถ้าติ๊กแถวไว้จะจัดลำดับตามที่ติ๊ก" style="background:#0F6E56;border:none;color:#fff;border-radius:6px;padding:3px 11px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">&#10003; Save</button>
            ${mem.some(a=>a.seq>0)?`<button onclick="event.stopPropagation();bookingV2VanGroupClearSeq('${date}','${rid}','${z}','${g}')" title="ล้างลำดับที่ตั้งเอง → กลับไปเรียงตามเวลา" style="background:transparent;border:1px solid #d7dbe2;color:#6a6a64;border-radius:6px;padding:3px 9px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit">&#8635; เรียงตามเวลา</button>`:''}
            <button onclick="event.stopPropagation();bookingV2VanGroupDisband('${date}','${rid}','${z}','${g}')" title="ยกเลิกกรุ๊ปนี้ (booking กลับไปยังไม่จัด)" style="margin-left:auto;background:transparent;border:none;color:#A32D2D;font-size:11px;cursor:pointer;font-family:inherit">ยกเลิกกรุ๊ป</button>
          </div></td></tr>`;
      };
      const groupBar='';   // group controls now live in the sticky Van strip at the top (see vanStrip build)
      const _rowObjs = alist.map(a=>{
        const r=a.r;
        const bk=r.bk;
        const norm=bookingV2Norm(bk);
        const lead = bk.leadPax || bk.customerName || '—';
        const others = Array.isArray(bk.passengers) ? bk.passengers : [];
        const rowId = `t2pax-${esc(bk.id)}-${esc(r.routeId)}`;
        const sm=bk.specialMeals||{}; const g=bk.guides||{};
        const reqBadges=[];
        // Add-on column (longtail / transfer / others) — booking add-ons + trip bundle/manual longtail
        const addonBadges=[];
        const _trip=(bk.trips||[]).find(t=>t.routeId===r.routeId)||{};
        let _ltLabel='', _ltNote='';
        (bk.addOns||[]).forEach(a=>{
          if(typeof bookingV2IsB2CFeeAddOn==='function' && bookingV2IsB2CFeeAddOn(a)) return;   // §b2cFee
          const ty=String(a.type||''); const lbl=String(a.label||a.type||'');
          if(/longtail|หางยาว/i.test(ty) || /longtail|หางยาว/i.test(lbl)){ _ltLabel = (lbl||'Longtail').replace(/\s*\(per boat[^)]*\)/i,''); if((a.note||'').trim()) _ltNote=(a.note||'').trim(); }
          else if(lbl) addonBadges.push(`<span class="t2-rb" style="background:#EDE7FB;color:#5B289A">${esc(lbl)}</span>`);
        });
        if(!_ltLabel && _trip.bundle && _trip.bundle.type==='longtail') _ltLabel = 'Longtail'+(_trip.bundle.mode==='free'?' (incl.)':'');
        if(!_ltLabel && _trip.longtailManual) _ltLabel = 'Longtail';
        // Fallback: forced Longtail bundle defined at the Rate Type level (rt.routeBundles[route].longtail) — not materialised on the trip
        if(!_ltLabel){
          const _rtId = bk.rateTypeRef || (bk.agentId && typeof sbGetAgent==='function' ? ((sbGetAgent(bk.agentId)||{}).rateTypeId) : null);
          const _rtB = (_rtId && typeof getRateType==='function') ? getRateType(_rtId) : null;
          const _lb = _rtB && _rtB.routeBundles && _rtB.routeBundles[r.routeId] && _rtB.routeBundles[r.routeId].longtail;
          if(_lb && _rtBundleAppliesTo(_lb, _trip.bookingMode==='charter')) _ltLabel = 'Longtail'+(_lb.mode==='free'?' (incl.)':' (bundle)');
        }
        if(_ltLabel) addonBadges.unshift(`<span class="t2-rb" style="background:#E6F1FB;color:#1683C7" title="${_ltNote?('หมายเหตุหางยาว: '+esc(_ltNote)):'Longtail'}">${esc(_ltLabel)}${_ltNote?` &#128221; ${esc(_ltNote)}`:''}</span>`);
        const _extras=(typeof bookingV2ExtrasFor==='function')?bookingV2ExtrasFor(bk.id):[];
        const extrasChips=_extras.map(e=>{ const _g=(typeof bkxExGot==='function')?bkxExGot(e):true;
          return `<span class="t2-rb" style="background:${_g?'#E1F5EE':'#FDF3E3'};color:${_g?'#0F6E56':'#8A5300'};cursor:pointer" title="${esc(e.service)}${e.qty>1?(' ×'+e.qty):''} +฿${(e.total||0).toLocaleString()} · กดเพื่อแก้ไข/ลบ · ${_g?('ขายหน้างาน '+(({cash:'เงินสด',transfer:'โอนเงิน',card:'บัตรเครดิต'})[e.method||'cash']||'เงินสด')):'ขายล่วงหน้า · เก็บเงินวันเดินทาง · ยังไม่ได้เก็บ'}" onclick="event.stopPropagation();bookingV2ExtraAdd('${esc(bk.id)}')"><span style="display:inline-block;max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom">${esc(e.service)}</span>${e.qty>1?` ×${e.qty}`:''} +&#3647;${(e.total||0).toLocaleString()}${_g?'':' &#9203;'}</span>`; }).join('');
        const feeChips=(bk.feeItems||[]).map(f=>{ const amt=Math.round(+f.amount||0); if(!amt) return ''; return `<span class="t2-rb" style="background:#FAEEDA;color:#854F0B" title="${esc(f.label||(f.type==='reschedule'?'Reschedule fee':'Fee'))} · บน invoice">&#8635; +&#3647;${amt.toLocaleString()}</span>`; }).join('');
        // reschedule fee collected as CASH (separate · not on invoice) → surface as "collect cash" on the moved-to date
        const _rsch=bk.reschedule; const _reschCash=(_rsch && _rsch.collect==='separate' && (+_rsch.chargeAmount>0))?Math.round(+_rsch.chargeAmount):0;
        const reschCashChip=_reschCash?`<span style="display:inline-block;font-size:10px;font-weight:700;color:#0F6E56;background:#E1F5EE;border:1px solid #BFE3CC;border-radius:7px;padding:2px 8px;white-space:nowrap" title="ค่าเลื่อนวัน ${esc(_rsch.fromDate||'')} → ${esc(_rsch.toDate||'')} · เก็บเงินสด ฿${_reschCash.toLocaleString()}${_rsch.reason?(' · '+esc(_rsch.reason)):''}">&#128181; เลื่อน · เก็บสด ฿${_reschCash.toLocaleString()}</span>`:'';
        const _upgrades=(typeof bookingV2UpgradesFor==='function')?bookingV2UpgradesFor(bk.id):[];
        const upgradeChips=_upgrades.map(u=>`<span class="t2-rb" style="background:#EEEDFE;color:#534AB7;cursor:pointer" title="อัพเกรด: ${esc(u.label)} · ขาย ฿${(+u.sellPrice||0).toLocaleString()} · บริษัท ฿${(+u.toCompany||0).toLocaleString()} · คอม ฿${(+u.commission||0).toLocaleString()}${u.collected?' · เก็บแล้ว':' · รอเก็บ'} · กดแก้ไข" onclick="event.stopPropagation();bookingV2UpgradeOpen('${esc(bk.id)}')">&#11014; <span style="display:inline-block;max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom">${esc(u.label)}</span> ฿${(+u.sellPrice||0).toLocaleString()}${u.collected?'':' &#9888;'}</span>`).join('');
        // Review-level adjustments (extra/discount) are NOT shown in the manifest add-on cell — detail lives in the Voucher.
        // (They remain baked into the TOTAL via priceBreakdown.)
        if(sm.veg) reqBadges.push(`<span class="t2-rb" style="background:#EAF3DE;color:#3B6D11">${sm.veg} veg</span>`);
        if(sm.vegan) reqBadges.push(`<span class="t2-rb" style="background:#EAF3DE;color:#3B6D11">${sm.vegan} vegan</span>`);
        if(sm.halal) reqBadges.push(`<span class="t2-rb" style="background:#E1F5EE;color:#0F6E56">${sm.halal} halal</span>`);
        if(bk.largeLuggage) reqBadges.push(`<span class="t2-rb" style="background:#FAEEDA;color:#854F0B">${bk.largeLuggage} bag</span>`);
        const gl=[]; if(g.english)gl.push('EN'); if(g.russian)gl.push('RU'); if(g.chinese)gl.push('CN'); if((g.otherLang||'').trim())gl.push(esc(g.otherLang));
        gl.forEach(code=>{ const lc=bookingV2LangColors(code); reqBadges.push(`<span class="t2-rb" style="background:${lc[0]};color:${lc[1]}">${code}</span>`); });
        const noteTxt = (bk.notes||bk.note||'').trim();
        const _cot = (typeof bookingV2CotChip==='function') ? bookingV2CotChip(bk, noteTxt) : {chip:'', note:noteTxt};
        const _note = _cot.note;
        const allergTxt = (typeof bookingV2AllergyText==='function')?bookingV2AllergyText(sm):(sm.allergies||'').trim();
        const _ri = (typeof bookingV2RetInfo==='function')?bookingV2RetInfo(bk,date):{sep:false};
        const _ovTrip=(bk.trips||[]).find(x=>x.date===date&&x.routeId===r.routeId);
        let _ovSB='';
        if(_ovTrip){ if(_ovTrip.ovnLeg)_ovSB=`<span style="display:inline-block;font-size:10px;font-weight:700;color:#5B289A;background:#EDE7FB;border-radius:8px;padding:3px 10px;white-space:nowrap">&#127769; OVN ขากลับ</span>`; else if(_ovTrip.ovn==='self')_ovSB=`<span style="display:inline-block;font-size:10px;font-weight:700;color:#9A5B00;background:#FBEAD5;border-radius:8px;padding:3px 10px;white-space:nowrap">&#127769; OVN&middot;กลับเอง</span>`; else if(_ovTrip.ovn==='return')_ovSB=`<span style="display:inline-block;font-size:10px;font-weight:700;color:#5B289A;background:#EDE7FB;border-radius:8px;padding:3px 10px;white-space:nowrap" title="กลับวัน ${esc(_ovTrip.ovnReturnDate||'')}">&#127769; ค้างคืน&middot;กลับ ${esc(String(_ovTrip.ovnReturnDate||'').slice(5))}</span>`; }
        const _sbBase = _ri.sep ? (()=>{ const _dropClean=_ri.selfRet?String(_ri.drop||'').replace(/\s*\(self-?arrive\)/i,'').trim():_ri.drop; const loc=`<span class="t2-sb" title="${esc(_ri.drop||'')}">${esc(_dropClean||'—')}</span>`; if(_ri.selfRet){ return loc+`<br><span class="t2-rb" style="background:#EDEFF2;color:#5F6B7A;white-space:nowrap" title="จุดส่งกลับเป็นท่าเรือ self-arrive · ลูกค้าเดินทางกลับเอง ไม่ต้องจัดรถ">↩ ลูกค้ากลับเอง</span>`; } if(_ri.arranged){ const vn=_ri.retId?((vehGet(_ri.retId)||{}).name||_ri.retId):''; return loc+`<br><span class="t2-rb" style="background:#E1F5EE;color:#0F6E56;white-space:nowrap" title="รถกลับ: ${esc(vn)}">↩ ${esc(vn)}</span>`; } if(_ri.sameVan){ return loc+`<br><span class="t2-rb" onclick="event.stopPropagation();if(!_bkV2.vanAssignMode){bookingV2ToggleVanMode();return;}bookingV2SetReturnSameVan('${bk.id}',false,'${date}')" style="background:#EAF1FA;color:#2C5F94;white-space:nowrap;cursor:pointer" title="${vanMode?'รถขาไปพากลับ · ส่งจุดใหม่ · คลิกเพื่อยกเลิก':'เปิดโหมด Van ก่อนถึงจะจัดรถกลับได้ · คลิกเพื่อเข้าโหมด Van'}">↩ กลับคันเดิม ✓</span>`; } return loc+`<br><span class="t2-rb" style="background:#FBE3E1;color:#C0392B;font-weight:700;white-space:nowrap" title="ส่งกลับคนละที่กับตอนรับ · ยังไม่จัดรถกลับ">⚠ ยังไม่จัดรถกลับ</span> <span class="t2-rb" onclick="event.stopPropagation();if(!_bkV2.vanAssignMode){bookingV2ToggleVanMode();return;}bookingV2SetReturnSameVan('${bk.id}',true,'${date}')" style="background:${vanMode?'#EAF1FA':'#EFE7D6'};color:${vanMode?'#2C5F94':'#8A6A1A'};white-space:nowrap;cursor:pointer;font-weight:700" title="${vanMode?'รถขาไปพากลับเอง ไปส่งจุดใหม่ (ไม่ต้องจัดรถคันอื่น)':'เปิดโหมด Van ก่อนถึงจะจัดรถกลับได้ · คลิกเพื่อเข้าโหมด Van'}">↩ กลับคันเดิม${vanMode?'':' (เปิด Van)'}</span>`; })() : '';
        // §OVN return day — there is no pickup, so the hotel only appears if we print it HERE. Without this
        // the row showed the OVN chip and nothing else: the driver had a passenger and nowhere to take her.
        const _ovnDropTxt = (_ovTrip && _ovTrip.ovnLeg)
          ? `<div style="font-weight:700;color:#1B2A55">${esc(bk.dropoffHotelName || bk.hotelName || bk.pickup || '—')}</div><div style="font-size:10px;color:#8a5500">&#8617; ส่งกลับ · มาจากเกาะ</div>`
          : '';
        const sendBack = [_ovSB, _ovnDropTxt, _sbBase].filter(Boolean).join('') || '—';
        const expandRow = (a.first && others.length) ? `
          <tr id="${rowId}" class="t2-paxrow" style="display:none"><td colspan="${COLN}">
            <div class="t2-paxttl">Passengers · ${others.length+1}</div>
            <div class="t2-paxlist">
              <span><b>${esc(lead)}</b> <span class="t2-natl">lead</span></span>
              ${others.map(p=>`<span>${esc(p.name)}${p.nationality?` <span class="t2-natl">${esc(p.nationality)}</span>`:''}</span>`).join('')}
            </div>
          </td></tr>` : '';
        // Partial-cancel / no-show badge for THIS trip date (from bk.partialCancels)
        let pcBadge='';
        {
          const pcs=(bk.partialCancels||[]).filter(pc=>(pc.date||'')===date);
          if(pcs.length){
            let ns=0, other=0; const tips=[];
            pcs.forEach(pc=>{ const n=pc.count||Object.values(pc.paxRemoved||{}).reduce((s,v)=>s+(+v||0),0); if(pc.category==='no_show') ns+=n; else other+=n; const cc=pc.charged&&pc.charged.count; const money=(cc!=null)?('charge '+(cc||0)+' · waive '+((pc.waived&&pc.waived.count)||0)+(pc.refund>0?(' (refund ฿'+Math.round(pc.refund).toLocaleString()+')'):'')):(pc.refundMode==='refund'?(' · refund ฿'+Math.round(pc.refund||0).toLocaleString()):' · no refund'); tips.push((pc.categoryLabel||pc.category||'reduced')+' −'+n+' · '+money); });
            const tip=tips.join(' · ');
            if(ns>0)    pcBadge+=`<span class="t2-nsbadge" title="${esc(tip)}">No show ${ns}</span>`;
            if(other>0) pcBadge+=`<span class="t2-redbadge" title="${esc(tip)}">&minus;${other} pax</span>`;
          }
        }
        const _rg=a.g; const _rgc=_rg?groupColor[_rg]:null;
        const _selRow=vanMode&&window._bkV2VanSel&&window._bkV2VanSel[a.key];
        // Tint each row by its boat + left accent bar — in Boat Assign mode (any time · helps with 5+ boats while assigning),
        // in Van Assign mode (so the boat split is still visible while arranging vans · van-group color overrides once grouped),
        // and in the normal manifest only when 2+ boats split the trip. Lightest tint (fill barely visible · accent bar carries the cue).
        const _rowBid = a.boatId || (typeof bkOpsRead==='function' ? bkOpsRead(r.bk, date) : (r.bk.ops||{})).boatId;   // per-day boat · §boatSplit
        const _boatRowStyle = ((boatMode || _multiBoat || vanMode) && !_rgc && _rowBid) ? (function(){ const c=bookingV2BoatAvatarColor(_rowBid); return ` style="background:${_bkV2Soft(c,0.95)};box-shadow:inset 5px 0 0 ${c}"`; })() : '';
        const _bSelRow = boatMode && (window._bkV2BoatSel||{})[bk.id];   // ticked for bulk boat-assign
        // Van indicator · shown in Boat Assign mode (under TIME) so you can see which van each booking is on while assigning boats · color per van
        let _vanChipHtml='';
        if(boatMode && bk.ops){
          const _mkVanChip=(vid,grp,pax)=>{ const vn=vid?(((typeof vehGet==='function'?vehGet(vid):null)||{}).name||vid):(grp?('กรุ๊ป '+grp+' · ยังไม่เลือกรถ'):''); if(!vn) return ''; const c=(vid&&vanColor[vid])?vanColor[vid]:['#EFEDE6','#8a877e']; const lbl=vn+(pax!=null?(' ·'+pax):''); return `<span style="display:inline-flex;align-items:center;gap:3px;background:${c[0]};color:${c[1]};font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:5px;white-space:nowrap;${vid?'':'border:1px dashed #cfc8c0'}">&#128656; ${esc(lbl)}</span>`; };
          const _dayOps = (typeof bkOpsRead==='function') ? bkOpsRead(bk, date) : (bk.ops||{});   // per-day van
          let _vc=[];
          if(Array.isArray(_dayOps.vanSplits) && _dayOps.vanSplits.length){
            // แถวถูกกางเป็น 1 แถวต่อ 1 split แล้ว → โชว์เฉพาะรถของแถวนั้น (เดิมยกมาทั้ง 3 คันซ้ำทุกแถว)
            const _s = a.split ? _dayOps.vanSplits[a.idx] : null;
            _vc = (_s ? [_mkVanChip(_s.vanId, _s.vanGroup, _s.pax)]
                      : _dayOps.vanSplits.map(s=>_mkVanChip(s.vanId, s.vanGroup, s.pax))).filter(Boolean);
          }
          else if(_dayOps.vanId){ _vc=[_mkVanChip(_dayOps.vanId, _dayOps.vanGroup, null)]; }
          else if(_dayOps.vanGroup){ _vc=[_mkVanChip(null, _dayOps.vanGroup, null)]; }
          if(_vc.length) _vanChipHtml=`<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px">${_vc.join('')}</div>`;
        }
        // priority: van group color → van selection → boat-assign selection → boat tint (grouping/selecting always wins over the boat cue)
        const _splitAccent = a.split ? (function(){ const c=_bkV2SplitColor(bk.id); return ` style="background:${c}0D;box-shadow:inset 4px 0 0 ${c}"`; })() : '';   // §altPickups · same-booking highlight (per-booking color) on split rows
        const _rowStyle=_rgc?(vanMode?` style="background:${_rgc[0]};box-shadow:inset 4px 0 0 ${_rgc[1]}"`:` style="background:${_bkV2Soft(_rgc[0])}"`):(_selRow?' style="background:#EEF5FC"':(_bSelRow?' style="background:#E8F1FB;box-shadow:inset 5px 0 0 #185FA5"':(_boatRowStyle||_splitAccent)));
        const _ckLost=(!r.cxl && typeof ckLostByType==='function')?ckLostByType(bk,date):null;
        const _ckNsCls=(_ckLost && _ckLost.total>0)?' t2-cklost':'';   // §check-in · มีคนไม่ได้เดินทาง → ไฮไลต์แดง
        const _unassignedCls=(_hasGroups && !a.g && !r.cxl)?' t2-unassigned':'';   // frame newly-added / not-yet-assigned bookings
        const _novanCls=(vanMode && a.g>0 && !_grpVan[a.g] && !r.cxl)?(' t2-novan'+(_novanLast[a.g]===a.key?' t2-novan-last':'')):'';   // red frame · group has no van picked yet (bottom border only on the last member → one big box, no internal lines)
        const _movedBadge=(bk.rebook && bk.rebook.to===date)?`<div class="t2-movedin" title="Rescheduled from ${esc(bk.rebook.from)}${bk.rebook.reason==='weather'?' due to weather':(bk.reschedule&&bk.reschedule.reason?(' · '+esc(bk.reschedule.reason)):'')}">&#8617; Moved from ${esc(String(bk.rebook.from).slice(5))}${bk.rebook.reason==='weather'?' · weather':''}</div>`:'';   // shown in the Special-request column (its own line)
        const _altPicks=(Array.isArray(bk.altPickups)?bk.altPickups.filter(a=>(a.who||'').trim()||(a.place||'').trim()||a.area||a.areaId):[]);   // §altPickups · รับหลายจุด
        const _altPickBadge=_altPicks.length?`<div class="t2-altpick" title="รับหลายจุด:${_altPicks.map(a=>' '+(Math.max(1,parseInt(a.qty)||1))+'คน '+((a.who||'').trim()||'')+(a.zone?(' ['+a.zone+']'):'')+' → '+((a.place||'').trim()||a.area||'?')).join(' ·')}">&#128652; รับหลายจุด (${_altPicks.length})</div>`:'';
        // §split-pickup indicator → ย้ายมาโชว์ในคอลัมน์ Special request (เดิมอยู่ข้างชื่อ · รก) · ต่อ split allocation row
        const _splitBadge = (a.split && a.bsplit) ? `<div class="t2-altpick" title="กรุ๊ปใหญ่ · แยกลงเรือ ${a.bsN} ลำ · บุคกิ้งเดียวกัน ${esc(bk.voucherRef||bk.id)} — เงินและใบวางบิลยังเป็นใบเดียว">&#128676; แยกลงเรือ · ลำ ${a.idx+1}/${a.bsN}</div>`
          : a.split ? `<div class="t2-altpick" title="แยกรับหลายจุด · บุคกิ้งเดียวกัน ${esc(bk.voucherRef||bk.id)}${a.pick&&!a.pick.main&&a.pick.who?(' · '+esc(a.pick.who)):''}">&#128652; ${a.pick&&a.pick.main?'จุดหลัก':'แยกรับ'} · เดียวกัน ${esc(bk.voucherRef||bk.id)}${a.pick&&!a.pick.main&&a.pick.who?(' · '+esc(a.pick.who)):''}</div>` : '';
        const _2nd = a.split && !a.first;   // a non-first split allocation row → hide booking-level cells (Pay/Total/Voucher/Add-on) to avoid duplicating them across the split rows
        return {g:a.g, boat:_rowBid||'', html:`
          <tr class="t2-row${r.cxl?' t2-cxl':''}${_ckNsCls}${_unassignedCls}${_novanCls}${_btLkCls(bk.id)}"${_rowStyle}>
            <td>${(bk.voucherRef && bk.voucherRef.trim().toLowerCase()!==String(lead||'').trim().toLowerCase())?(a.split?`<span class="t2-mono t2-vch" title="${esc(bk.voucherRef)} · แยกรับหลายจุด (บุคกิ้งเดียวกัน)" style="color:${_bkV2SplitColor(bk.id)};font-weight:800;border:1px solid ${_bkV2SplitColor(bk.id)}55;background:${_bkV2SplitColor(bk.id)}12;border-radius:5px;padding:1px 5px">&#128279; ${esc(bk.id.startsWith('b2c_')?bookingV2DisplayCode(bk):bk.voucherRef)}</span>`:`<span class="t2-mono t2-vch" title="${esc(bk.voucherRef)}">${esc(bk.id.startsWith('b2c_')?bookingV2DisplayCode(bk):bk.voucherRef)}</span>`):'<span class="t2-dim">—</span>'}${bk.id.startsWith('b2c_')?'<div style="margin-top:3px"><span style="background:#E6F7F9;color:#0E7D8A;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;letter-spacing:.03em">'+bookingV2B2CMark(11)+'Love Andaman</span></div>':''}</td>
            <td class="t2-ag" style="${bk.agentId?'padding:0':''}">${(bk.agentId && /^b2c_/.test(String(bk.id||'')))?`<div onclick="event.stopPropagation();bookingV2AgentColorEdit('${bk.agentId}',event)" title="Love Andaman &middot; ขายเอง (B2C)${(function(){ if(typeof bookingV2B2CChannel!=='function') return ''; const _c=bookingV2B2CChannel(bk); return _c?(' &middot; ลูกค้าทักมาทาง '+_c.label):''; })()} &middot; คลิกเปลี่ยนสีประจำเอเยนต์ (ใช้ที่หน้าอื่น)" style="background:#fff;border:1px solid #E3E6EC;margin:2px 3px;padding:8px 10px;border-radius:8px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.08);max-width:180px;display:flex;align-items:center;justify-content:center">${bookingV2B2CLogo(22)}</div>`:bk.agentId?(()=>{const _ac=bookingV2AgentColor(bk.agentId);return `<div onclick="event.stopPropagation();bookingV2AgentColorEdit('${bk.agentId}',event)" title="${esc(norm.agentName)}${(function(){ if(typeof bookingV2B2CChannel!=='function') return ''; const _c=bookingV2B2CChannel(bk); return _c?(' · ลูกค้าทักมาทาง '+_c.label):(/^b2c_/.test(String(bk.id||''))?' · ขายเอง (B2C)':''); })()} · คลิกเปลี่ยนสี · Alt+คลิก = สีอัตโนมัติ" style="background:${_ac};color:${bookingV2ContrastInk(_ac)};margin:2px 3px;padding:11px 11px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;box-shadow:0 1px 2px rgba(0,0,0,.10)">${esc(norm.agentName)}</div>`;})():`<span class="t2-agency">${esc(norm.agentName)}</span>`}</td>
            <td class="t2-cu">
              ${(function(){ var _rs=bk.ops&&bk.ops.reconfirm&&bk.ops.reconfirm.status; if(_rs){ var _c=(typeof rcStateColor==='function')?rcStateColor(_rs):'#F6E27A'; var _ik=(typeof bookingV2ContrastInk==='function')?bookingV2ContrastInk(_c):'#000'; var _sl=(typeof _rcStateOf==='function')?_rcStateOf(bk).l:''; return `<span class="t2-lead" style="background:${_c};color:${_ik};padding:1px 7px;border-radius:5px" title="Re-confirm: ${esc(_sl)}">${esc(lead)}</span>`; } return `<span class="t2-lead">${esc(lead)}</span>`; })()}${pcBadge}${(function(){var _el=(typeof bookingV2EditLockActive==='function')&&bookingV2EditLockActive(bk);return _el?`<span title="${esc(_el.by)} กำลังแก้ไขอยู่ (~${_el.mins} นาที)" style="background:#E7F0FC;color:#185FA5;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;letter-spacing:.04em;margin-left:4px">&#9999; ${esc(_el.by)} แก้อยู่</span>`:'';})()}${bk.status==='pending_approval'?`<span title="เกิน capacity · รอผจก.อนุมัติ" style="background:#FCEBEB;color:#A32D2D;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;letter-spacing:.04em;margin-left:4px">รออนุมัติ</span>`:''}${(bk.pickupSelf && r.zone!=='NoTransfer' && r.zone!=='NT')?`<span title="ติ๊ก self-arrive (ลูกค้ามาเอง) แต่โซนนี้เป็นโซนรับส่ง${(bk.ops&&(bk.ops.vanId||bk.ops.vanGroup))?' + จัดรถไว้แล้ว':''} — booking นี้จะไม่ขึ้นในใบงานรถขาไป · เช็คว่าติ๊กผิดหรือไม่" style="background:#F3E8FF;color:#5B289A;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;letter-spacing:.04em;margin-left:4px;cursor:help">🚶 self-arrive?</span>`:''}${(function(){ if(r.cxl||!bk.agentId||typeof docCheckStatus!=='function') return ''; var _st=docCheckStatus(bk); var _nf=(bk.attachments||[]).length; var _m={verified:['#E6F5EA','#1B7F4B','✅','เอกสารตรวจแล้ว'],issue:['#FCEBEB','#B5271F','⚠','เอกสารมีปัญหา'],pending:['#FFF6E0','#8A5B00','📎','รอตรวจเอกสาร ('+_nf+' ไฟล์)']}[_st]; if(!_m) return ''; return `<span onclick="event.stopPropagation();tsGoDoc('${esc(bk.id)}','${esc(date)}')" title="${esc(_m[3])} · คลิกไปตรวจเอกสาร" style="background:${_m[0]};color:${_m[1]};font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;letter-spacing:.04em;margin-left:4px;cursor:pointer">${_m[2]}${_st==='pending'?(' '+_nf):''}</span>`; })()}${(function(){ if(r.cxl||typeof bookingV2FindDuplicateBookings!=='function')return''; const _dd=bookingV2FindDuplicateBookings(bk,bk.id); if(!_dd.length)return''; const _vc=_dd.map(x=>x.bk.voucherRef||x.bk.code||x.bk.id).slice(0,3).join(', '); const _rs=[...new Set(_dd.reduce((a,x)=>a.concat(x.reasons),[]))].join(' · '); return `<span title="อาจเป็นการลงซ้ำกับ: ${esc(_vc)} (${esc(_rs)}) — ตรวจสอบ/ลบตัวซ้ำ" style="background:#FBE9D6;color:#9A5B00;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;letter-spacing:.04em;margin-left:4px;cursor:help">&#9888; อาจซ้ำ</span>`; })()}${r.cxl?`<span class="t2-cxlbadge" title="${bk.cancellation?('Cancelled · '+(bk.cancellation.chargeType==='full'?'Full charge':bk.cancellation.chargeType==='partial'?'Partial charge':'No charge')+(bk.cancellation.reason?' · '+esc(bk.cancellation.reason):'')):'Cancelled'}">CXL</span>`:''}${(!r.cxl && typeof ckNoShowBadge==='function')?ckNoShowBadge(bk,date):''}
              ${others.length?`<button class="t2-more" onclick="event.stopPropagation();bookingV2Tab2TogglePax('${rowId}')"><span id="${rowId}-ic" style="display:inline-block">▾</span> +${others.length}</button>`:'<span class="t2-dim t2-leadonly">lead only</span>'}
            </td>
            ${a.split
              ? (function(){ const _b=a.bd||{ad:a.head,chd:0,inf:0,foc:0};   /* §pax breakdown · เดิมยัดทั้งก้อนลง AD แล้ว CHD/INF/FOC ฮาร์ดโค้ด 0 → เด็กกลายเป็นผู้ใหญ่ */
                  const _t="แยกรับ "+a.head+" คน · "+PAX_K.filter(k=>_b[k]).map(k=>_b[k]+" "+PAX_LBL[k]).join(" · ")+" (บุคกิ้งเดียวกัน)";
                  const _cell=(k,on)=>'<td class="t2-c t2-mono'+(_b[k]?'':' t2-dim')+'"'+((_b[k]&&on)?(' style="'+on+'"'):'')+' title="'+_t.replace(/"/g,'&quot;')+'">'+(_b[k]||0)+'</td>';
                  return _cell("ad","color:#5B289A;font-weight:700")+_cell("chd","color:#5B289A;font-weight:700")+_cell("inf","color:#5B289A;font-weight:700")+_cell("foc","color:#A32D2D;font-weight:700");
                })()
              : (function(){
                  /* §check-in · ช่อง pax โชว์ "เดินทางจริง" · ยอดจองเดิมอยู่ใต้แบบจางๆ (ยอดจอง/ราคาไม่ถูกแก้ · แค่แสดงผล) */
                  const _L=(typeof ckLostByType==='function')?ckLostByType(bk,date):null;
                  const _cell=(k)=>{ const bkd=P(r.pax,k);
                    if(!_L || _L.total<=0){ return `<td class="t2-c t2-mono">${bkd?(k==='foc'?`<span style="color:#A32D2D">${bkd}</span>`:bkd):'<span class="t2-dim">0</span>'}</td>`; }
                    const left=(typeof ckPaxLeft==='function')?ckPaxLeft(bk,date,k,bkd):bkd;
                    if(left===bkd){ return `<td class="t2-c t2-mono">${bkd?(k==='foc'?`<span style="color:#A32D2D">${bkd}</span>`:bkd):'<span class="t2-dim">0</span>'}</td>`; }
                    return `<td class="t2-c t2-mono" title="จองมา ${bkd} · เดินทางจริง ${left}"><span style="color:${left?'#A32D2D':'#c8c6be'};font-weight:700">${left}</span><div style="font-size:9px;color:#c2c0b7;line-height:1.1;margin-top:1px;text-decoration:line-through">${bkd}</div></td>`; };
                  return _cell('ad')+_cell('chd')+_cell('inf')+_cell('foc');
                })()}
            <td class="t2-mono">${r.ovnHoldRow?`<span class="t2-ovnh">&#127765; \u0e04\u0e49\u0e32\u0e07\u0e40\u0e01\u0e32\u0e30 \u00b7 \u0e27\u0e31\u0e19\u0e17\u0e35\u0e48 ${r.ovnHoldRow.day}/${r.ovnHoldRow.days}</span><span class="t2-ovnh2">${r.ovnHoldRow.pax} \u0e04\u0e19\u0e2d\u0e22\u0e39\u0e48\u0e1a\u0e19\u0e40\u0e01\u0e32\u0e30</span>`:(_ovTrip&&_ovTrip.ovnLeg)?'<span style="color:#8a5500;font-weight:600">&#8617; ไม่มีขารับ</span>':vanMode?`<input type="text" value="${esc((typeof bkOpsRead==='function'?bkOpsRead(bk,date).pickupTimeFinal:(bk.ops&&bk.ops.pickupTimeFinal))||r.pickupTime||bk.pickupTime||'')}" placeholder="${esc(r.pickupTime||bk.pickupTime||'เวลา')}" onclick="event.stopPropagation()" oninput="bookingV2SetPickupFinal('${esc(bk.id)}',this.value,'${esc(date)}')" title="เวลารับของโรงแรมนี้" style="border:1px solid var(--border);border-radius:6px;padding:2px 5px;font-size:10px;font-family:'DM Mono',monospace;width:98px;box-sizing:border-box">`:(function(){const orig=r.pickupTime||bk.pickupTime||''; const fin=(typeof bkOpsRead==='function'?bkOpsRead(bk,date).pickupTimeFinal:(bk.ops&&bk.ops.pickupTimeFinal))||''; if(fin && fin!==orig){ /* §เวลารับที่แก้แล้ว · เดิมต่อท้ายบรรทัดเดียวกัน "06.30 (07:30-07:45)" อ่านแวบเดียวแยกไม่ออกว่าอันไหนคือเวลาจริง → เวลาใหม่บรรทัดบน เวลาเดิมบรรทัดล่าง ตัวเล็กจางๆ */
                 return `<div style="font-weight:700;color:#0F6E56;line-height:1.25">${esc(fin)}</div>${orig?`<div style="font-size:9px;color:#b0b0a8;line-height:1.25;text-decoration:line-through" title="เวลารับเดิมก่อนแก้">${esc(orig)}</div>`:''}`; } return esc(orig||'—'); })()}${_vanChipHtml}</td>
            ${vanMode?`<td class="t2-c t2-gwrap" style="background:#F3FBF7">${(typeof bookingV2VanCellHTML==='function')?bookingV2VanCellHTML(bk, r.zone, date, groupColor, rid, a.key, a.g, a.split, a.first):''}</td>`:''}
            <td class="t2-pk">${(function(){ if(a.split && a.pick && !a.pick.main && (a.pick.hotel||a.pick.areaId)){ const _pa=a.pick.areaId&&typeof bookingV2GetArea==='function'?bookingV2GetArea(a.pick.areaId):null; const _pl=a.pick.hotel||(_pa?_pa.name:'')||'—'; return `<span class="t2-pickcell" title="แยกรับ${a.pick.who?(' · '+esc(a.pick.who)):''} @ ${esc(_pl)}" style="color:#5B289A;font-weight:600">&#128652; ${esc(_pl)}</span>`; } if(_ovTrip && _ovTrip.ovnLeg) return '<span class="t2-pickcell" title="ขากลับ OVN · ลูกค้ากลับจากเกาะโดยเรือ · ไม่มีรถไปรับ" style="color:#8a5500;font-weight:600">&#8617; ไม่มีขารับ · มาจากเกาะ</span>';
              return (bk.hotelName||bk.pickup)?`<span class="t2-pickcell" title="${esc(bk.hotelName||bk.pickup)}">${esc(bk.hotelName||bk.pickup)}</span>`:'<span class="t2-needpickup" title="ยังไม่ได้ระบุจุดรับ · กดแก้ไขเพื่อเพิ่ม">&#9888; no pickup</span>'; })()}</td>
            <td class="t2-c">${esc(bk.roomNumber||'')?`<span class="t2-mono t2-room">${esc(bk.roomNumber)}</span>`:'<span class="t2-dim">—</span>'}</td>
            <td>${(a.split&&a.pick&&!a.pick.main)?(function(){const _pa=a.pick.areaId&&typeof bookingV2GetArea==='function'?bookingV2GetArea(a.pick.areaId):null;const _zn=_pa?_pa.name:(a.pick.zone||'');return _zn?`<span class="t2-zonetag">${esc(_zn)}</span>`:'<span class="t2-dim">—</span>';})():(function(){
              // §Zone cell · เดิมอ่าน bk.pickupArea อย่างเดียว → booking B2C ที่ชื่อ area ไม่ตรงกับ sb_pickup_areas
              // ขึ้น "—" ทั้งที่ลูกค้าเลือก area มาแล้ว. อ่าน pickupAreaId ก่อน (ops แก้เองได้ · sync ไม่ทับ)
              // แล้วค่อย fallback เป็นข้อความดิบจาก B2C (โชว์แบบจาง = ยังไม่ผูกกับ area ในระบบ)
              const _pa=(bk.pickupAreaId&&typeof bookingV2GetArea==='function')?bookingV2GetArea(bk.pickupAreaId):null;
              if(_pa&&_pa.name) return `<span class="t2-zonetag">${esc(_pa.name)}</span>`;
              const _raw=(bk.pickupArea||'').trim();
              if(!_raw) return '<span class="t2-dim">—</span>';
              return `<span class="t2-zonetag" style="background:#F4F3EF;color:#8A887F;font-style:italic" title="จาก B2C · ยังไม่ผูกกับ pickup area ในระบบ · แก้ไข booking เพื่อเลือก area">${esc(_raw)}</span>`;
            })()}</td>
            <td>${sendBack==='—'?'<span class="t2-dim">—</span>':sendBack}</td>
            ${vanMode?'':(_2nd?'<td class="t2-req"></td>':`<td class="t2-req"><div class="t2-addoncell"><div class="t2-addoncell-badges">${addonBadges.join('')}${extrasChips}${upgradeChips}${feeChips}</div><div class="t2-addoncell-acts"><button onclick="event.stopPropagation();bookingV2ExtraAdd('${esc(bk.id)}')" title="เพิ่ม extra วันเดินทาง (ขายหน้างาน)" class="t2-addbtn" style="color:var(--ink-soft);font-weight:700">+</button><button onclick="event.stopPropagation();bookingV2UpgradeOpen('${esc(bk.id)}')" title="อัพเกรด/ขายเพิ่มหน้างาน" class="t2-addbtn t2-addbtn-up">&#11014;</button></div></div></td>`)}
            <td class="t2-req">
              ${_movedBadge}
              ${_splitBadge}
              ${_altPickBadge}
              ${reqBadges.length?`<div class="t2-rbwrap">${reqBadges.join('')}</div>`:''}
              ${allergTxt?`<div class="t2-allerg" title="Allergy: ${esc(allergTxt)}">Allergy: ${esc(allergTxt)}</div>`:''}
              ${_note?`<div class="t2-note" title="${esc(_note)}">${esc(_note)}</div>`:''}
              ${(!reqBadges.length && !allergTxt && !_note && !_movedBadge && !_altPickBadge && !_splitBadge)?'<span class="t2-dim">—</span>':''}
            </td>
            ${vanMode?'':(_2nd?'<td></td>':`<td><div class="t2-paywrap">${bookingV2PayChip(bk)}${_cot.chip}${reschCashChip}</div></td>`)}
            ${vanMode?'':(_2nd?'<td class="t2-r t2-mono t2-dim" title="รวมอยู่ในแถวจุดหลัก">&#8629;</td>':`<td class="t2-r t2-mono">&#3647;${bookingV2FmtTHB(r.subtotal)}</td>`)}
            ${vanMode?'':(_2nd?'<td class="t2-c"></td>':`<td class="t2-c"><button class="t2-vcbtn" onclick="event.stopPropagation();bookingV2OpenDetail('${esc(bk.id)}')" title="Voucher · ดูรายละเอียด booking" aria-label="Voucher">VC</button></td>`)}
            <td class="t2-c"${boatMode?' style="background:#F4F9FE"':''}>${boatMode ? `<div style="display:flex;align-items:center;gap:7px;justify-content:center"><input type="checkbox" ${(window._bkV2BoatSel||{})[bk.id]?'checked':''} onclick="event.stopPropagation();bookingV2BoatSelToggle('${esc(bk.id)}')" title="ติ๊กเพื่อเลือกหลายแถว แล้วจัดลงเรือทีเดียว" style="width:15px;height:15px;cursor:pointer;flex:none;accent-color:#185FA5">${(typeof baBoatCellHTML==='function')?baBoatCellHTML(bk, rid, date, a):''}</div>` : ((_rowBid||r.charterBoatId)?(function(){const _bid=_rowBid||r.charterBoatId; const _bn=((typeof BOATS!=='undefined'?BOATS.find(b=>b.id===_bid):null)||{}).name||_bid; const _ac=bookingV2BoatAvatarColor(_bid); const _pl=(typeof bookingV2BoatPulled==='function')&&bookingV2BoatPulled(bk,date); return `<span style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap" title="${_pl?'เรือถูกถอดจาก Boat Operation · จัดเรือใหม่':'เรือที่ขึ้น'}"><span style="width:22px;height:22px;border-radius:50%;background:${_pl?'#C0392B':_ac};color:#fff;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;flex:none">${_pl?'&#9888;':esc(bookingV2BoatInitials(_bn))}</span><span style="font-size:12px;font-weight:600;color:${_pl?'#A32D2D':'var(--ink)'}">${esc(_bn)}${(bk.ops&&bk.ops.upgrade)?' ⤴':''}${_pl?' <span style="font-size:9px;font-weight:700;color:#A32D2D;background:#FCEBEB;border:0.5px solid #E89A92;border-radius:4px;padding:0 4px">ถอดแล้ว</span>':''}</span></span>`;})():'<span class="t2-dim">—</span>')}</td>
            ${rcMode?`<td class="t2-c" style="background:#FDFAF1">${(function(){const rc=bk.ops&&bk.ops.reconfirm;if(rc&&rc.status==='done'){let tm='';try{tm=new Date(rc.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}catch(e){}return `<span style="display:inline-flex;align-items:center;gap:4px"><span style="background:#E1F5EE;color:#0F6E56;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px" title="re-confirmed ${esc(rc.via||'')} ${esc(tm)}">&#10003; ${rc.via==='phone'?'โทร':'list'}</span><button onclick="event.stopPropagation();bookingV2ReconfirmClear('${esc(bk.id)}')" title="ยกเลิก" style="background:transparent;border:none;color:#A32D2D;font-size:11px;cursor:pointer">&times;</button></span>`;}return `<div style="display:flex;gap:3px;justify-content:center"><button onclick="event.stopPropagation();bookingV2Reconfirm('${esc(bk.id)}','list')" style="background:#fff;border:1px solid #EAD9B0;color:#7A4A00;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">List</button><button onclick="event.stopPropagation();bookingV2Reconfirm('${esc(bk.id)}','phone')" style="background:#fff;border:1px solid #EAD9B0;color:#7A4A00;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">โทร</button></div>`;})()}</td>`:''}
            ${wxClosed?`<td class="t2-c" style="background:#FBE8E4">${bookingV2WeatherInlineCell(bk.id)}</td>`:''}
          </tr>${expandRow}`};
      });
      let body='';
      const _unassignedHdr=()=>{ const n=alist.filter(a=>!a.g).length; const px=alist.filter(a=>!a.g).reduce((s,a)=>s+a.head,0); return `<tr><td colspan="${COLN}" style="background:#FFF7E6;box-shadow:inset 4px 0 0 #E6A23C;padding:6px 12px"><span style="font-weight:700;font-size:12px;color:#9A6B00">&#9888; ยังไม่ assign</span> <span style="font-size:11px;color:#9A6B00">${n} booking · ${px} pax — จับเข้ากลุ่ม/เลือกรถ</span></td></tr>`; };
      // Boat Assign · per-boat cluster header (mirrors the van group header · read-only · very light tint)
      const _boatHdrRow=(bid)=>{
        const mem=alist.filter(a=>_boatId(a)===(bid||''));
        const bpax=mem.reduce((s,a)=>s+a.head,0);
        if(!bid){ return `<tr><td colspan="${COLN}" style="background:#FFF7E6;box-shadow:inset 4px 0 0 #E6A23C;padding:6px 12px"><span style="font-weight:700;font-size:12px;color:#9A6B00">&#9888; ยังไม่จัดเรือ</span> <span style="font-size:11px;color:#9A6B00">${mem.length} ราย · ${bpax} pax — เลือกเรือในคอลัมน์ Boat</span></td></tr>`; }
        const c=bookingV2BoatAvatarColor(bid);
        const bo=(typeof BOATS!=='undefined'?BOATS.find(b=>b.id===bid):null)||{}; const bn=bo.name||bid; const cap=+bo.cap||0;
        // cap check uses the boat's TRUE day-total (across all pickup zones), not just this zone's rows
        const dayPax=(typeof baAssignedPax==='function')?baAssignedPax(date,bid):bpax;
        const over=cap&&dayPax>cap; const xZone=dayPax!==bpax;
        return `<tr><td colspan="${COLN}" style="background:${_bkV2Soft(c,0.9)};box-shadow:inset 4px 0 0 ${c};padding:6px 12px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:12px;color:${c}"><span style="width:19px;height:19px;border-radius:50%;background:${c};color:#fff;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace">${esc(bookingV2BoatInitials(bn))}</span>&#128676; ${esc(bn)}</span>
            <span style="font-size:11px;color:#6a6a64">${mem.length} booking${xZone?(' · '+bpax+' โซนนี้'):''} · <b style="color:${over?'#A32D2D':c}">${dayPax}${cap?('/'+cap):''} pax</b>${over?(' <span style="color:#A32D2D;font-weight:700">เกิน '+(dayPax-cap)+'</span>'):''}</span>
          </div></td></tr>`;
      };
      { let _pg=null, _pb=null; _rowObjs.forEach(o=>{ if(_boatCluster){ if((o.boat||'')!==_pb){ body+=_boatHdrRow(o.boat); _pb=o.boat||''; } } else if(_grouped && o.g!==_pg){ if(o.g>0) body+=_grpHeaderRow(o.g); else if(vanMode || _hasGroups) body+=_unassignedHdr(); _pg=o.g; } body+=o.html; }); }
      /* ══ §btTable (2026-09-04) · ทุกโซนของทริปนี้อยู่ในตารางเดียว ═══════════
         ของเดิมแยกเป็นคนละ <table> ต่อโซน · ความกว้างคอลัมน์จึงคำนวณแยกกัน
         Voucher ของ Phuket กว้าง 118px แต่ของเขาหลัก 96px ตาไล่ลงมาแล้วสะดุด
         และหัวตารางซ้ำทุกโซน กินที่ฟรีโซนละ 29px
         ยุบเป็นตารางเดียว หัวโซนกลายเป็นแถบคาดเต็มความกว้างเหมือนแถบคันรถ
         แถวและปุ่มทุกตัวเป็นของเดิมไม่ถูกแตะ (o.html เดิมทั้งดุ้น)          */
      const _isChtr = z==='__CHARTER__';
      const _zband = _isChtr
        ? `<tr class="t2-zband t2-zband-ch"><td colspan="${COLN}"><div class="zw">`
          + `<span class="zkind">เหมาลำ</span><span class="znm">&#128676; CHARTER</span>`
          + `<span class="zsub">${list.length} booking &middot; ${zpax} pax &middot; ทั้งลำ</span>`
          /* §btChBand · ชื่อเรือเคยอยู่บนแถบลอยเหนือตาราง (chtrStrip) ซึ่งเป็นซากของ
             ดีไซน์การ์ดทริปเดิม · พอทริปยุบเป็นแถบในตารางแล้ว (§btBand) มันเหลือลอยอยู่
             คนเดียวและพูดซ้ำกับแถบนี้ · ยุบมารวมเป็นแถบเดียว */
          + (_chtrItems.length ? `<span class="zboats">${_chtrItems.map(it=>
              `<span class="zb"><b>&#128676; ${esc(it.bn||'ยังไม่ระบุเรือ')}</b>`
              + (it.nOf?`<i>ลำ ${it.nOf}</i>`:'')
              + `<s>${it.cap?(it.px+'/'+it.cap):(it.px+' pax')}</s></span>`).join('')}</span>` : '')
          + `</div></td></tr>`
        : `<tr class="t2-zband"><td colspan="${COLN}" style="--zc:${bookingV2ZoneColor(z)}"><div class="zw">`
          + `<span class="zkind">โซน</span><span class="znm">${bookingV2ZoneLabel(z)}</span>`
          + `<span class="zsub">${list.length} booking &middot; ${zpax} pax</span></div></td></tr>`;
      /* §btGap · เหมาลำกับลูกค้าจอยเป็นคนละเรื่องกัน · ติดกันแล้วอ่านเหมือนกลุ่มเดียว
         เว้นช่องว่างสองบรรทัดคั่นไว้ · ใส่เป็นแถวเปล่า เพราะทั้งหมดอยู่ในตารางเดียว
         margin บน <tr> ไม่มีผล */
      return _zband + body + (_isChtr ? `<tr class="t2-zgap"><td colspan="${COLN}"></td></tr>` : '');
    }).join('');
    /* ══ §btBand (2026-09-04) · ชื่อทริปกลายเป็นแถบคาดในตาราง ════════════════
       ของเดิมเป็นการ์ดใหญ่คร่อมตาราง: หัวตระกูลโปรแกรม + หัวทริป + แถบเรือ +
       บรรทัดรวมภาษา รวมสี่บล็อกก่อนจะเห็นแถวแรก · ทุกบล็อกพูดซ้ำกับหัวหน้าใหม่
       ตอนนี้เหลือแถวเดียวในตาราง ชั้นบนสุดของลำดับ โปรแกรม → โซน → คันรถ    */
    const _pbAl  = (typeof getAllotment==='function')?getAllotment(rid,date):null;
    const _pbBk  = _pbAl?(_pbAl.seatsConsumed||0):0;
    const _pbCap = _pbAl?(_pbAl.availableCapacity||0):0;
    const _pbAv  = _pbAl?(_pbAl.seatsAvailable||0):0;
    const _pbFr  = _pbCap>0?_pbAv/_pbCap:0;
    const _pbCls = _pbAv<=0?'full':(_pbFr<0.20?'low':'ok');
    const _pbCol = (bookingV2RouteFamily(rid)||{}).color || '#8b909c';
    const _pbPier= route?.pier ? (route.pier==='tublamu'?'Tub Lamu':route.pier==='panwa'?'Visit Panwa':route.pier==='ranong'?'Ranong':route.pier) : '';
    const _pbNB  = ((typeof baBoatsForRoute==='function')?baBoatsForRoute(date,rid):[]).length;
    const _pband = `<tr class="t2-pband" style="--pc:${_pbCol}"><td colspan="${COLN}"><div class="pw">`
      + `<span class="pd"></span><span class="pn">${esc(route?.name || rid)}</span>`
      + `<span class="pt">${esc(dep)}${_pbPier?(' &middot; '+esc(_pbPier)):''}</span>`
      + (_pbNB?`<span class="pb">${_pbNB} boat${_pbNB===1?'':'s'}</span>`:'')
      + `<span class="ps">${_pbBk}/${_pbCap}<em class="${_pbCls}">${_pbAv<=0?'full':(_pbAv+' free')}</em></span>`
      + `</div></td></tr>`;
    const zoneTable = zoneBlocks ? `
        <div class="t2-tblscroll">
          <table class="t2-mtbl${vanMode?' t2-van':''}">
            <thead><tr>
              <th class="t2-vc">Voucher</th>${agencyTh}<th class="t2-cu">Customer (lead)</th>
              <th class="t2-c">AD</th><th class="t2-c">CHD</th><th class="t2-c">INF</th><th class="t2-c">FOC</th>
              <th>Time</th>${vanMode?`<th class="t2-c t2-gwrap" style="color:#0C6B47;background:#DCF0E7;white-space:nowrap" title="ติ๊กแถวที่จะไปด้วยกัน แล้วกดจับกลุ่ม">&#10003; กลุ่ม</th>`:''}<th class="t2-pk">Pickup</th><th class="t2-c">Room</th>${zoneTh}<th>Send back</th>${vanMode?'':'<th>Add-on</th>'}<th>Special request</th>${vanMode?'':'<th>Pay</th><th class="t2-r">Total</th><th class="t2-c"></th>'}
              <th class="t2-c"${boatMode?' style="color:#12518F;background:#E2EEFA;white-space:nowrap"':''}>&#128676; Boat${boatMode?` <button onclick="baAutoAssign('${date}','${rid}')" style="background:#185FA5;color:#fff;border:none;border-radius:5px;padding:2px 7px;font-size:9px;font-weight:700;cursor:pointer;font-family:inherit;margin-left:4px">auto</button>`:''}</th>
              ${rcMode?`<th class="t2-c" style="color:#7A4A00;background:#FAEBD2;white-space:nowrap">&#9989; Re-confirm <button onclick="bookingV2ReconfirmAll('${date}','${rid}','list')" title="ยืนยันทั้งหมด (list)" style="background:#7A4A00;color:#fff;border:none;border-radius:5px;padding:2px 7px;font-size:9px;font-weight:700;cursor:pointer;font-family:inherit;margin-left:4px">all</button></th>`:''}
              ${wxClosed?'<th class="t2-c" style="color:#A32D2D;background:#FBE8E4;white-space:nowrap">&#9928; Manage</th>':''}
            </tr></thead>
            <tbody>${_pband}${zoneBlocks}</tbody>
          </table>
        </div>` : '';

    // ── Seat locks held on this trip (route+date · incl. month-range) · manage inline (create / sub-group / release) ──
    const trLocks = (typeof bookingV2LocksFor==='function') ? bookingV2LocksFor(rid, date) : [];
    const trParents = trLocks.filter(l=>!l.parentId);   // parents/standalone only (children live inside)
    const trLockedTotal = trParents.reduce((s,l)=> s + ((typeof bookingV2LockPoolHold==='function')?bookingV2LockPoolHold(l,date):bookingV2LockRemaining(l,date)), 0);
    const _subBtn='font-size:10px;font-weight:700;color:#534AB7;background:#EEEDFE;border:1px solid #CECBF6;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit';
    const _relBtn='font-size:10px;font-weight:700;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit';
    const lockChips = trParents.map(l=>{
      const kids=(typeof bookingV2LockChildren==='function')?bookingV2LockChildren(l.id):[];
      const held=(typeof bookingV2LockHeldRemaining==='function')?bookingV2LockHeldRemaining(l,date):bookingV2LockRemaining(l,date);
      const unalloc=(typeof bookingV2LockUnalloc==='function')?bookingV2LockUnalloc(l):0;
      const subChips=kids.map(c=>`<span class="t2-lockchip" style="background:#F3F2FB;border-color:#DAD6F5;color:#4A3FA0">&#8627; ${esc(c.subName||'ย่อย')} &middot; ${bookingV2LockRemaining(c,date)}</span>`).join('');
      const _cut=(typeof bookingV2LockCutoffLabel==='function')?bookingV2LockCutoffLabel(l):'';
      // click the name → manage popup (add sub-group / release) instead of inline buttons
      return `<span class="t2-lockchip t2-lockchip-btn" onclick="bookingV2LockManageOpen('${l.id}')" style="cursor:pointer" title="คลิกเพื่อจัดการ · เพิ่มกรุ๊ปย่อย / ปล่อย">${esc(bookingV2LockHolderName(l))} &middot; ${held}${kids.length?` <span class="t2-lockm" style="background:#EEEDFE;color:#534AB7">${kids.length} ย่อย</span>`:''}${bookingV2LockSpansDays(l)?` <span class="t2-lockm">bulk</span>${_cut?` <span class="t2-lockm" style="background:#E1F5EE;color:#0F6E56">${esc(_cut)}</span>`:''}`:''} <span style="opacity:.5;font-size:10px">&#9662;</span></span>${subChips}`;
    }).join('');
    const lockBar = `
      <div class="t2-lockbar">
        ${trLockedTotal>0?`<span class="t2-lockbadge">&#128274; ${trLockedTotal} locked</span>${lockChips}`:`<span style="font-size:10.5px;color:#9a3b21">ยังไม่ล็อคที่นั่งทริปนี้</span>`}
        <button class="t2-lockmanage" style="color:#0F6E56;border-color:#BFE3CC;margin-left:auto" onclick="bookingV2LockFromCalendar('${rid}','${date}')" title="ล็อคที่นั่งทริปนี้">&#128274; ล็อคที่นั่ง</button>
        <button class="t2-lockmanage" style="margin-left:0" onclick="bookingV2SwitchTab('locks')" title="Manage in Seat Locks">ทั้งหมด &rarr;</button>
      </div>`;

    // ── Rescheduled-away bookings · faint ghost rows kept on the original date (weather + manual reschedule) ──
    const _wxGhosts = wxClosed ? (SB_BOOKINGS||[]).filter(b=> b.weatherResolve && b.weatherResolve.event===(rid+'|'+date) && b.weatherResolve.outcome==='reschedule' && b.weatherResolve.newDate).map(b=>({bk:b, nd:b.weatherResolve.newDate, wx:true})) : [];
    const _mvGhosts = (SB_BOOKINGS||[]).filter(b=> b.reschedule && b.reschedule.fromDate===date && b.reschedule.toDate && (b.trips||[]).some(t=>t.routeId===rid)).map(b=>({bk:b, nd:b.reschedule.toDate, wx:false}));
    const _ghosts = _wxGhosts.concat(_mvGhosts);
    const ghostBlock = _ghosts.length ? `
      <div class="t2-ghost-sec">
        <div class="t2-ghost-hd">&#10515; Rescheduled away · ${_ghosts.length} booking(s) <span style="font-weight:500;text-transform:none;color:#9a6">(original details kept for reference)</span></div>
        ${_ghosts.map(g=>{
          const bk=g.bk; const norm=bookingV2Norm(bk);
          const mt=(bk.trips||[]).find(t=>t.routeId===rid && t.date===g.nd) || (bk.trips||[]).find(t=>t.routeId===rid) || {};
          const gpax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(mt.pax||{}):0;
          const lead=bk.leadPax||bk.customerName||'—';
          const nd=g.nd;
          const why=g.wx?' · weather':(bk.reschedule&&bk.reschedule.reason?(' · '+bk.reschedule.reason):'');
          let ndLbl=nd; try{ ndLbl=new Date(nd+'T00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}); }catch(e){}
          return `<div class="t2-ghost-row">
            <span class="t2-ghost-vc">${bk.voucherRef?esc(bk.voucherRef):esc(bk.code||bk.id)}</span>
            <span class="t2-ghost-ag">${esc(norm.agentName)}</span>
            <span class="t2-ghost-cu">${esc(lead)}</span>
            <span class="t2-ghost-px">${gpax} pax</span>
            <span class="t2-ghost-mv">&#9201; Moved &rarr; ${esc(ndLbl)}${esc(why)}</span>
            <button class="t2-ghost-go" onclick="event.stopPropagation();bookingV2Tab2PickDay('${nd}')" title="Go to new date">View new date &rarr;</button>
          </div>`;
        }).join('')}
      </div>` : '';

    // ── Cancelled bookings · kept as a record in their own block · not counted in totals ──
    // §pendSeat · กลุ่มรออนุมัติของทริปนี้ · แสดงเหนือ manifest ไม่ปนกับคนที่จะเดินทางจริง
    const _pendRows = pendGroups[rid] || [];
    const _pendPax = _pendRows.reduce((s,r)=> s + P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc'), 0);
    const pendBlock = _pendRows.length ? `
      <div class="t2-pend-sec">
        <div class="t2-pend-hd">&#9203; รออนุมัติ &middot; ${_pendRows.length} booking &middot; ${_pendPax} pax
          <span style="font-weight:500;text-transform:none;color:#9a7a3a">(ยังไม่นับในยอดของทริป &middot; ยังไม่เข้าใบงานรถ/เรือ)</span></div>
        ${_pendRows.map(r=>{
          const bk=r.bk, norm=bookingV2Norm(bk), ap=bk.approval||{};
          const lead=bk.leadPax||bk.customerName||'—';
          const ppax=P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc');
          const overCap=(Array.isArray(ap.over)&&ap.over.length>0)||(+ap.totOver>0);
          const why = overCap ? ('เกิน cap +'+(ap.totOver||0)+' ที่')
                    : (+ap.discount>0) ? ('ส่วนลด &#3647;'+(+ap.discount).toLocaleString()+' · รอเซลล์ยืนยัน')
                    : ((typeof bookingV2PendLabel==='function' && (ap.reason||(typeof bookingV2PendReason==='function'?bookingV2PendReason(bk):'')))
                        ? bookingV2PendLabel(ap.reason||bookingV2PendReason(bk)) : 'รอผู้จัดการอนุมัติ');
          const held = (typeof bkPendHoldsSeat==='function') ? bkPendHoldsSeat(bk) : true;
          return `<div class="t2-pend-row">
            <span class="t2-cxl-vc">${bk.voucherRef?esc(bk.voucherRef):esc(bk.code||bk.id)}</span>
            <span class="t2-cxl-ag">${esc(norm.agentName)}</span>
            <span class="t2-cxl-cu">${esc(lead)}</span>
            <span class="t2-cxl-px">${ppax} pax</span>
            <span class="t2-pend-why">${why}</span>
            <span class="t2-pend-hold" title="${held?'ที่นั่งถูกกันไว้ระหว่างรออนุมัติ':'ที่นั่งเกิน cap อยู่แล้ว จึงไม่ถูกกันไว้'}">${held?'&#128274; กันที่นั่งไว้':'ไม่กันที่นั่ง'}</span>
            <button class="t2-ghost-go" onclick="event.stopPropagation();bookingV2OpenDetail('${esc(bk.id)}')" title="ดูรายละเอียด">View</button>
            <button class="t2-ghost-go" style="color:#0F6E56;border-color:#9FE1CB" onclick="event.stopPropagation();bookingV2ApproveBooking('${esc(bk.id)}')" title="อนุมัติ · แถวจะย้ายลงไปอยู่ใน manifest">&#10003; อนุมัติ</button>
          </div>`;
        }).join('')}
      </div>` : '';

    const _cxlRows = grp.filter(r=>r.cxl);
    const cxlBlock = _cxlRows.length ? `
      <div class="t2-cxl-sec">
        <div class="t2-cxl-hd">&#10005; Cancelled &middot; ${_cxlRows.length} booking${_cxlRows.length>1?'s':''} <span style="font-weight:500;text-transform:none;color:#b08">(record kept &middot; not counted)</span></div>
        ${_cxlRows.map(r=>{
          const bk=r.bk; const norm=bookingV2Norm(bk);
          const lead=bk.leadPax||bk.customerName||'—';
          const cpax=P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc');
          const cc=bk.cancellation||null;
          const chLbl = cc ? (cc.chargeType==='full'?('Full charge ฿'+Math.round(cc.chargeAmount||0).toLocaleString()):cc.chargeType==='partial'?('Charge ฿'+Math.round(cc.chargeAmount||0).toLocaleString()):'No charge') : (bk.status==='cancelled_weather'?'Weather':'—');
          return `<div class="t2-cxl-row">
            <span class="t2-cxl-vc">${bk.voucherRef?esc(bk.voucherRef):esc(bk.code||bk.id)}</span>
            <span class="t2-cxl-ag">${esc(norm.agentName)}</span>
            <span class="t2-cxl-cu">${esc(lead)}</span>
            <span class="t2-cxl-px">${cpax} pax</span>
            <span class="t2-cxl-ch">${chLbl}</span>
            <span class="t2-cxl-rs">${cc&&cc.reason?esc(cc.reason):''}</span>
            <button class="t2-ghost-go" onclick="event.stopPropagation();bookingV2OpenDetail('${esc(bk.id)}')" title="View booking">View</button>
            <button class="t2-ghost-go" style="color:#0F6E56;border-color:#9FE1CB" onclick="event.stopPropagation();bookingV2RestoreBooking('${esc(bk.id)}')" title="กู้คืน booking (ยกเลิกการยกเลิก)">&#8634; กู้คืน</button>
          </div>`;
        }).join('')}
      </div>` : '';

    // ── Per-boat load strip (under the trip header · ALWAYS shown when boats serve this trip) ──
    //    Shows which boat carries how many guests · richer (A/C/I/F + seats left) in Boat Assign mode.
    let boatStrip='';
    let _prepInStrip=false;   // true when Prep was folded into the compact boat strip (normal view) → skip standalone prepBar
    let _addonInStrip=false;  // true when Add-ons were folded into the "รวม" summary row → skip the standalone Add-ons bar
    let headBoats=boatChip;   // header right-side boat display (count chip in normal view · falls back to boatChip)
    {
      const baBoats = (typeof baBoatsForRoute==='function') ? baBoatsForRoute(date, rid) : [];
      if(baBoats.length || boatMode){
        const agg={}; baBoats.forEach(x=>agg[x.boatId]={ad:0,chd:0,inf:0,foc:0,tot:0,lang:{},veg:0,vegan:0,halal:0,allerg:0});
        let uAd=0,uChd=0,uInf=0,uFoc=0,uTot=0,uBk=0;
        grp.filter(r=>!r.cxl).forEach(r=>{ const bid=bkOpsRead(r.bk,date).boatId;   /* §per-trip ops */ const a=P(r.pax,'ad'),c=P(r.pax,'chd'),i=P(r.pax,'inf'),f=P(r.pax,'foc'),t=a+c+i+f;
          if(bid && agg[bid]){ const o=agg[bid]; o.ad+=a;o.chd+=c;o.inf+=i;o.foc+=f;o.tot+=t;
            const gd=r.bk.guides||{}; if(gd.english)o.lang['EN']=(o.lang['EN']||0)+t; if(gd.russian)o.lang['RU']=(o.lang['RU']||0)+t; if(gd.chinese)o.lang['CN']=(o.lang['CN']||0)+t; const _ol=(gd.otherLang||'').trim(); if(_ol)o.lang[_ol]=(o.lang[_ol]||0)+t;
            const mm=r.bk.specialMeals||{}; o.veg+=mm.veg||0; o.vegan+=mm.vegan||0; o.halal+=mm.halal||0; o.allerg+=(typeof bookingV2AllergyCount==='function')?bookingV2AllergyCount(mm):((mm.allergies||'').trim()?1:0);
          }
          else if(!bid){ uAd+=a;uChd+=c;uInf+=i;uFoc+=f;uTot+=t; uBk++; }
        });
        const initials=s=>String(s||'?').replace(/[^A-Za-z0-9 ]/g,'').trim().slice(0,2).toUpperCase()||'?';
        if(boatMode){
        // ── Boat Assign mode · rich per-boat KPI cards ──
        // KPI mini-cells (number above · label below · divider) like the trip header
        const kc=(v,l,red)=>`<div style="flex:1;text-align:center;border-left:1px solid #efeee8;padding:0 1px"><div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;line-height:1;color:${red&&v?'#A32D2D':'#1B2A55'}">${v}</div><div style="font-size:7.5px;color:#a3a39b;font-weight:700;letter-spacing:.03em;margin-top:1px">${l}</div></div>`;
        const kpis=(o)=>`<div style="display:flex;border-top:1px solid #f0eee7;padding-top:4px">${kc(o.ad,'AD').replace('border-left:1px solid #efeee8','border-left:none')}${kc(o.chd,'CHD')}${kc(o.inf,'INF')}${kc(o.foc,'FOC',true)}</div>`;
        // Option B card · compact · fixed equal width · 2 rows (header + KPI row)
        const CARD='background:#fff;border:1px solid #e6e4dd;border-radius:9px;padding:7px 9px;display:flex;flex-direction:column;gap:5px;width:200px;box-sizing:border-box';
        const chips=baBoats.map((x,ix)=>{ const g=agg[x.boatId]; const cap=x.boat.cap||0; const rem=cap-g.tot; const over=rem<0; const col=boatColor[x.boatId]||['#E6F1FB','#185FA5'];
          return `<div style="${CARD}${over?';border-color:#E6C9C3':''}">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:26px;height:26px;border-radius:50%;background:${col[0]};color:${col[1]};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;flex:none;font-family:'DM Mono',monospace">${initials(x.boat.name||x.boatId)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:12px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.boat.name||x.boatId)}</div>
                <div style="font-size:9.5px;font-weight:700;color:${over?'#A32D2D':(rem===0?'#0F6E56':'#185FA5')}">${over?('เกิน '+Math.abs(rem)):(rem+' ที่ว่าง')}</div>
              </div>
              <div style="text-align:right;flex:none"><div style="font-size:15px;font-weight:700;line-height:1;font-family:'DM Mono',monospace;color:${over?'#A32D2D':'#1B2A55'}">${g.tot}<span style="font-size:10px;color:#b0b0a8">/${cap}</span></div></div>
            </div>
            ${kpis(g)}
          </div>`; }).join('');
        const unChip = uTot>0 ? `<div style="${CARD};border-color:#E6B97A;background:#FFF9F0">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:26px;height:26px;border-radius:50%;background:#FAEEDA;color:#9A5B00;display:flex;align-items:center;justify-content:center;font-size:14px;flex:none">&#9888;</div>
              <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:12px;line-height:1.15;color:#9A5B00">ยังไม่ assign</div><div style="font-size:9.5px;font-weight:700;color:#9A5B00">${uBk} booking</div></div>
              <div style="text-align:right;flex:none"><div style="font-size:15px;font-weight:700;line-height:1;font-family:'DM Mono',monospace;color:#9A5B00">${uTot}</div></div>
            </div>
            ${kpis({ad:uAd,chd:uChd,inf:uInf,foc:uFoc})}
          </div>` : (baBoats.length?`<div style="align-self:center;font-size:11px;color:#0F6E56;font-weight:700;white-space:nowrap">&#10003; assigned ครบ</div>`:'');
        const inner = baBoats.length ? (chips+unChip) : '<span style="font-size:11px;color:#A32D2D;font-weight:600">⚠ ยังไม่ได้ assign เรือใน Boat Operation</span>';
        boatStrip = `<div class="t2-boatstrip"><span class="t2-boatstrip-lbl">&#128676; Boats</span><div class="t2-boats" style="flex-wrap:wrap;gap:9px">${inner}</div></div>`;
        } else {
        // ── Normal view · collapsible per-boat panel ──
        //   header  = avatar-stack + "N เรือ"  ·  always-visible mini chips = per-boat headcount/cap
        //   expand  = grid of per-boat guide + special-meal chips  ·  footer = trip-level prep summary
        const _stack = baBoats.slice(0,3).map((x,ix)=>{ const col=boatColor[x.boatId]||['#E6F1FB','#185FA5']; return `<span class="t2-bstk" style="background:${col[1]};${ix?'margin-left:-7px':''}">${initials(x.boat.name||x.boatId)}</span>`; }).join('');
        if(baBoats.length) headBoats = `<span class="t2-boatcount"><span style="display:inline-flex">${_stack}</span>${baBoats.length} เรือ</span>`;
        const _miniChips = baBoats.map(x=>{ const g=agg[x.boatId]; const cap=x.boat.cap||0; const over=(cap-g.tot)<0; const col=boatColor[x.boatId]||['#E6F1FB','#185FA5'];
          return `<span class="t2-mchip${over?' t2-mchip-over':''}"><span class="t2-mav" style="background:${over?'#C0392B':col[1]}">${initials(x.boat.name||x.boatId)}</span>${esc(x.boat.name||x.boatId)} <b${over?' style="color:#A32D2D"':''}>${g.tot}/${cap}</b></span>`; }).join('');
        const _miniUn = uTot>0 ? `<span class="t2-mchip t2-mchip-un"><span class="t2-mav" style="background:#9A5B00">&#9888;</span>ยังไม่ assign <b>${uTot}</b></span>` : '';
        const _langOf=(o)=>Object.keys(o.lang||{}).map(code=>{ const lc=bookingV2LangColors(code); return `<span class="t2-dchip" style="background:${lc[0]};color:${lc[1]}">${esc(code)} ${o.lang[code]}</span>`; });
        const _foodOf=(o)=>{ const out=[]; if(o.veg||o.vegan) out.push(`<span class="t2-dchip" style="background:#EAF3DE;color:#3B6D11">${(o.veg||0)+(o.vegan||0)} veg</span>`); if(o.halal) out.push(`<span class="t2-dchip" style="background:#E1F5EE;color:#0F6E56">${o.halal} halal</span>`); if(o.allerg) out.push(`<span class="t2-dchip" style="background:#FCEBEB;color:#A32D2D">&#9888; ${o.allerg}</span>`); return out; };
        const _gridCells = baBoats.map(x=>{ const g=agg[x.boatId]; const cap=(typeof boatCapFor==='function')?boatCapFor(x.boatId,date):(x.boat.cap||0); const over=(cap-g.tot)<0; const col=boatColor[x.boatId]||['#E6F1FB','#185FA5']; const ch=[].concat(_langOf(g),_foodOf(g));
          const _capB=(typeof boatCapBadge==='function')?boatCapBadge(x.boatId,date,'sm'):'';   // §cap override รายวัน · คลิกที่ตัวเลขเพื่อแก้
          return `<div class="t2-bcell${over?' t2-bcell-over':''}"><span class="t2-mav" style="background:${over?'#C0392B':col[1]};flex:none">${initials(x.boat.name||x.boatId)}</span><span class="t2-bcell-nm">${esc(x.boat.name||x.boatId)}</span><span class="t2-bcell-cap" onclick="event.stopPropagation();boatCapModalOpen('${x.boatId}','${date}',function(){ if(typeof bookingV2Render==='function') bookingV2Render(); })" title="คลิกเพื่อปรับที่นั่งของลำนี้ เฉพาะวันนี้"${over?' style="color:#A32D2D;cursor:pointer"':' style="cursor:pointer"'}>${g.tot}/${cap}${_capB}</span><span class="t2-bcell-chips">${ch.join('')||'<span style="color:#b0b0a8;font-size:10px">&mdash;</span>'}</span></div>`; }).join('');
        const _ovChips=[].concat(_guideChips,_foodChips,_bagChips);
        const _ovAll=_ovChips.concat(_addonSum);   // Add-ons folded into the "รวม" row (per user · saves a row)
        const ovSummary = _ovAll.length ? `<div class="t2-boatsum"><span class="t2-boatsum-lbl">รวม</span>${_ovAll.join('')}</div>` : '';
        if(_ovChips.length) _prepInStrip = true;
        if(_addonSum.length) _addonInStrip = true;
        boatStrip = `<details class="t2-boatbox"><summary class="t2-boatsummary"><span class="t2-boatstrip-lbl">&#128676; Boats</span><span class="t2-minichips">${_miniChips}${_miniUn}</span><span class="t2-boatexpand">ไกด์ · อาหารรายลำ <span class="t2-caret">&#9662;</span></span></summary><div class="t2-bgrid">${_gridCells}</div></details>${ovSummary}`;
        }
      }
    }
    // ── Boat Assign · bulk action bar (shows when rows are ticked) → pick a boat → assign all at once ──
    let boatSelStrip='';
    if(boatMode){
      const _bsel=window._bkV2BoatSel||{};
      const _selRows=grp.filter(r=>!r.cxl && _bsel[r.bk.id]);
      if(_selRows.length){
        const _selPax=_selRows.reduce((s,r)=>s+(P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc')),0);
        const _bboats=(typeof baBoatsForRoute==='function')?baBoatsForRoute(date,rid):[];
        let _bopts='<option value="">— เลือกเรือที่จะลง —</option>';
        _bboats.forEach(x=>{ const cap=x.boat.cap||0; const load=(typeof baAssignedPax==='function')?baAssignedPax(date,x.boatId):0; const room=cap-load; _bopts+=`<option value="${x.boatId}">${(x.boat.name||x.boatId).replace(/</g,'')} · ${load}/${cap}${room>0?(' · ว่าง '+room):(room<0?(' · เกิน '+(-room)):' · เต็ม')}</option>`; });
        boatSelStrip=`<div class="bkv2-boatselbar" style="display:flex;align-items:center;gap:10px;padding:8px 16px 8px 21px;background:#EAF3FB;border-top:1px solid #CFE0F2;overflow-x:auto;flex-wrap:nowrap">
          <span style="display:inline-flex;align-items:baseline;gap:8px;flex:none"><span class="bkv2-selcount" style="background:#185FA5;color:#fff;font-family:'DM Mono',monospace;font-size:22px;font-weight:700;line-height:1;border-radius:10px;padding:6px 14px;box-shadow:0 2px 6px rgba(24,95,165,.3)">${_selPax}</span><span style="color:#0C447C;font-size:13px;font-weight:700">pax</span><span style="color:#5a7290;font-size:11px;font-family:'DM Mono',monospace">· ${_selRows.length} ราย</span></span>
          <span style="color:#0C447C;font-size:12px;font-weight:700;flex:none">&#128676; จัดลงเรือ:</span>
          <select onchange="if(this.value){bookingV2BoatAssignSelected('${date}','${rid}',this.value)}" style="border:1px solid #9FC5EC;border-radius:7px;padding:6px 9px;font-size:12px;font-family:inherit;background:#fff;font-weight:600;color:#0C447C;flex:none">${_bopts}</select>
          <button onclick="event.stopPropagation();bookingV2BoatSelClear()" style="background:transparent;border:none;color:#888;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;flex:none">ล้างที่เลือก</button>
        </div>`;
      }
    }
    // ── Van summary strip + job-order buttons (Van Assign mode) ──
    let vanStrip='';
    if(vanMode){
      const vagg={}; let unTot=0, selfTot=0;
      grp.filter(r=>!r.cxl).forEach(r=>{ const b=r.bk; const z=r.zone; const full=P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc');
        if(z==='NoTransfer'||z==='NT'){ selfTot+=full; return; }
        const _amn = b.pickupArea || ((b.pickupAreaId && typeof bookingV2GetArea==='function') ? ((bookingV2GetArea(b.pickupAreaId)||{}).name||'') : '');
        const _bo=(typeof bkOpsRead==='function')?bkOpsRead(b,date):(b.ops||{});   /* §per-trip ops · แถบสรุปรถต้องนับของวันนั้น */
        if(_bo&&Array.isArray(_bo.vanSplits)&&_bo.vanSplits.length){ _bo.vanSplits.forEach(s=>{ const hp=+s.pax||0; if(s.vanId){ (vagg[s.vanId]=vagg[s.vanId]||{pax:0,bk:0,grp:{},area:{},gpax:{}}); vagg[s.vanId].pax+=hp; vagg[s.vanId].bk++; const _gg=+s.vanGroup||0; if(_gg>0){ vagg[s.vanId].grp[_gg]=1; vagg[s.vanId].gpax[_gg]=(vagg[s.vanId].gpax[_gg]||0)+hp; } const _a=s.pickAreaId?(((typeof bookingV2GetArea==='function'?(bookingV2GetArea(s.pickAreaId)||{}).name:'')||s.pickZone||'')):_amn; if(_a) vagg[s.vanId].area[_a]=1; } else unTot+=hp; }); }
        else { const vid=_bo&&_bo.vanId; if(vid){ (vagg[vid]=vagg[vid]||{pax:0,bk:0,grp:{},area:{},gpax:{}}); vagg[vid].pax+=full; vagg[vid].bk++; const _gg=+(_bo&&_bo.vanGroup)||0; if(_gg>0){ vagg[vid].grp[_gg]=1; vagg[vid].gpax[_gg]=(vagg[vid].gpax[_gg]||0)+full; } if(_amn) vagg[vid].area[_amn]=1; } else unTot+=full; }
      });
      const vcards=Object.keys(vagg).map(vid=>{ const v=vehGet(vid)||{}; const g=vagg[vid]; const cap=v.capacity||0; const c=vanColor[vid]||['#E1F5EE','#0F6E56'];
        const _grps=Object.keys(g.grp||{}).map(Number).filter(x=>x>0).sort((a,b)=>a-b);
        /* ══ §vgRound2 · คันที่วิ่งโปรแกรมเดิมหลายรอบ ต้องนับที่นั่ง "รายรอบ" ══
           เดิมบวกรวมทุกกรุ๊ป · โกอู๊ด1 รับ 4 คนรอบเช้า แล้วอีก 9 คนรอบสาย
           ขึ้นเป็น 13/12 pax แดงเถือก เหมือนรถบรรทุกเกิน ทั้งที่แต่ละรอบไม่เกินสักรอบ
           คนดูแถบนี้จะรีบไปหารถเพิ่มโดยไม่จำเป็น */
        const _rMulti=_grps.length>=2;
        const _rPax=_rMulti?_grps.map(x=>+((g.gpax||{})[x]||0)):[];
        const _rMax=_rMulti?Math.max.apply(null,_rPax):g.pax;
        const over=cap>0 && _rMax>cap;
        const _paxTxt=_rMulti?_rPax.join('+'):String(g.pax);
        const _paxTip=_rMulti?('วิ่ง '+_grps.length+' รอบ · '+_grps.map((x,i)=>'รอบ '+(i+1)+' '+_rPax[i]+' คน').join(' · ')+(cap?(' · รถ '+cap+' ที่นั่ง'):'')):'';
        const _grpBadge=_grps.length?`<span title="${esc(_rMulti?_paxTip:('กรุ๊ป '+_grps.join(' · ')))}" style="background:${c[1]};color:#fff;font-size:8.5px;font-weight:700;border-radius:4px;padding:0 5px;margin-right:5px;white-space:nowrap;flex:none">${_rMulti?'&#8635; ':''}${_grps.join('+')}</span>`:'';
        const _areas=Object.keys(g.area||{}).filter(Boolean);
        const _areaLine=_areas.length?`<div style="font-size:8.5px;color:#B07A1F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px" title="รับที่: ${esc(_areas.join(' · '))}">&#128205; ${esc(_areas.join(' · '))}</div>`:'';
        /* §btTune · ชิปรถตู้เดิมกว้างขั้นต่ำ 220px · สามคันก็เต็มแถบ ต้องไถหาคันที่สี่
           ลดขนาดตัวหนังสือกับระยะขอบ แล้วปล่อยความกว้างให้พอดีเนื้อหา */
        return `<div onclick="event.stopPropagation();bookingV2ScrollToVan('${rid}','${vid}')" title="คลิกเพื่อเลื่อนไปที่แถวของ ${esc(v.name||vid)}" style="background:#fff;border:1px solid ${over?'#E6C9C3':'#e6e4dd'};border-radius:8px;padding:4px 8px;display:flex;align-items:center;gap:6px;min-width:0;box-sizing:border-box;cursor:pointer">
          <span style="width:8px;height:8px;border-radius:50%;background:${c[1]};flex:none"></span>
          <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center">${_grpBadge}<span style="overflow:hidden;text-overflow:ellipsis">${esc(v.name||vid)}${v.plate&&v.plate!=='-'?` <span style="font-size:9px;color:#999;font-family:'DM Mono',monospace">${esc(v.plate)}</span>`:''}</span></div><div style="font-size:9px;color:#7a7a72"${_paxTip?` title="${esc(_paxTip)}"`:''}>${g.bk} booking · <span style="font-weight:700;color:${over?'#A32D2D':'#0F6E56'}">${_paxTxt}${cap?'/'+cap:''} pax</span></div>${_areaLine}</div>
        </div>`; }).join('');
      const extra=[]; if(unTot>0) extra.push(`<span style="font-size:11px;font-weight:700;color:#9A5B00;background:#FFF9F0;border:1px solid #E6B97A;border-radius:8px;padding:6px 10px">&#9888; ยังไม่จัดรถ ${unTot} pax</span>`);
      if(selfTot>0) extra.push(`<span style="font-size:11px;color:#5F5E5A;background:#F1EFE8;border-radius:8px;padding:6px 10px">self-arrive ${selfTot} pax</span>`);
      const vanBtns=Object.keys(vagg).length?`<button onclick="event.stopPropagation();bookingV2VanClearRoute('${date}','${rid}')" title="ล้างการจัดรถของโปรแกรมนี้" style="background:#fff;border:1px solid #E6C9C3;color:#A32D2D;border-radius:6px;padding:5px 9px;font-size:10.5px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex:none">ล้าง</button>`:'';
      // Two stacked rows — Van summary + Grouping bar — both shown from the start of Van Assign mode, pinned together as one sticky unit (total 96px)
      const _selKeys=Object.keys(window._bkV2VanSel||{}).filter(k=>window._bkV2VanSel[k]);
      const _selTrip=[]; _selKeys.forEach(k=>{ const p=String(k).split('@'); const r=grp.find(rr=>!rr.cxl&&rr.bk.id===p[0]); if(!r)return; const _ro=(typeof bkOpsRead==='function')?bkOpsRead(r.bk,date):(r.bk.ops||{}); let head; if(p.length>1 && _ro&&Array.isArray(_ro.vanSplits)&&_ro.vanSplits[+p[1]]) head=+_ro.vanSplits[+p[1]].pax||0; else head=P(r.pax,'ad')+P(r.pax,'chd')+P(r.pax,'inf')+P(r.pax,'foc'); _selTrip.push({zone:((r.charter&&!r.cxl)?'__CHARTER__':r.zone), head}); });   /* §charter · ต้องใช้ pseudo-zone เดียวกับที่ _bkV2InZone รู้จัก */
      const vanRow = `<div style="display:flex;align-items:center;gap:7px;height:44px;box-sizing:border-box;padding:0 16px 0 21px;background:#F3FBF7;overflow-x:auto;flex-wrap:nowrap"><span class="t2-boatstrip-lbl" style="color:#0F6E56;flex:none">&#128656; Vans</span>${vanBtns}<div class="t2-boats" style="flex-wrap:nowrap;gap:9px">${vcards||''}${extra.join('')||(!vcards?'<span style="font-size:11px;color:#8a8a82;white-space:nowrap">ยังไม่มีการจัดรถ</span>':'')}</div></div>`;
      let groupRow;
      if(_selTrip.length){
        const _sz=_selTrip[0].zone;
        const inZone=_selTrip.filter(a=>a.zone===_sz);
        const selPax=inZone.reduce((s,a)=>s+a.head,0);
        const existing=[...new Set([].concat.apply([],grp.filter(r=>((r.charter&&!r.cxl)?'__CHARTER__':r.zone)===_sz).map(r=>{ const _o=(typeof bkOpsRead==='function')?bkOpsRead(r.bk,date):(r.bk.ops||{}); if(_o&&Array.isArray(_o.vanSplits)) return _o.vanSplits.map(s=>+s.vanGroup||0); return [+(_o&&_o.vanGroup)||0]; })).filter(g=>g>0))];
        groupRow=`<div style="display:flex;align-items:center;gap:8px;height:44px;box-sizing:border-box;padding:0 16px 0 21px;background:#EAF3FB;border-top:1px solid #CFE0F2;overflow-x:auto;flex-wrap:nowrap">
          <span style="display:inline-flex;align-items:baseline;gap:8px;flex:none"><span class="bkv2-selcount" style="background:#185FA5;color:#fff;font-family:'DM Mono',monospace;font-size:24px;font-weight:700;line-height:1;border-radius:10px;padding:7px 16px;box-shadow:0 2px 6px rgba(24,95,165,.3)">${selPax}</span><span style="color:#0C447C;font-size:13px;font-weight:700">pax</span><span style="color:#5a7290;font-size:11px;font-family:'DM Mono',monospace">· ${inZone.length} ราย</span></span>
          <button onclick="event.stopPropagation();bookingV2VanGroupSelected('${date}','${rid}','${_sz}','new')" style="background:#185FA5;color:#fff;border:none;border-radius:6px;padding:5px 11px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex:none">&#128101; จับเป็นกรุ๊ปใหม่</button>
          ${existing.map(g=>`<button onclick="event.stopPropagation();bookingV2VanGroupSelected('${date}','${rid}','${_sz}','${g}')" style="background:#fff;border:1px solid #B5D4F4;color:#185FA5;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex:none">+ กรุ๊ป ${g}</button>`).join('')}
          <button onclick="event.stopPropagation();bookingV2VanSelClear()" style="background:transparent;border:none;color:#888;font-size:11px;cursor:pointer;font-family:inherit;white-space:nowrap;flex:none">ล้าง</button>
        </div>`;
      } else {
        groupRow=`<div style="display:flex;align-items:center;gap:8px;height:44px;box-sizing:border-box;padding:0 16px 0 21px;background:#F7FAFE;border-top:1px solid #E6EEF7;color:#8a8a82;font-size:12px"><span style="color:#185FA5;font-weight:700;flex:none">&#9745; Grouping</span> ติ๊กแถวที่จะไปด้วยกัน แล้วกดจับกลุ่ม</div>`;
      }
      /* §btVanCard · ไม่วางแถบเหนือตารางแล้ว · ส่งชิ้นส่วนขึ้นไปประกอบเป็นการ์ดบนหัว
         คืนพื้นที่ให้ตาราง 88px และไม่ต้องมองสองที่ */
      void vanRow;
      _btVanParts.push({ rid,
        nm: esc((route&&route.name)||rid),
        dep: esc(dep||''),
        col: (bookingV2RouteFamily(rid)||{}).color || '#8b909c',
        n: Object.keys(vagg).length,
        cards: vcards, extra: extra.join(''), btns: vanBtns,
        grpRow: groupRow, sel: _selTrip.length>0 });
      vanStrip = '';
    }
    // ── Re-confirm roll-up strip ──
    let rcStrip='';
    if(rcMode){
      const act=grp.filter(r=>!r.cxl); const done=act.filter(r=>r.bk.ops&&r.bk.ops.reconfirm&&r.bk.ops.reconfirm.status==='done').length; const tot=act.length; const allDone=tot>0&&done===tot;
      rcStrip=`<div class="t2-boatstrip" style="background:#FDFAF1"><span class="t2-boatstrip-lbl" style="color:#7A4A00">&#9989; Re-confirm</span>
        <span style="font-size:13px;font-weight:700;color:${allDone?'#0F6E56':'#7A4A00'}">${done}/${tot}</span>
        <span style="font-size:11px;color:#8a8a82">ยืนยันแล้ว${allDone?' · ครบ &#10003;':(tot-done>0?' · ค้าง '+(tot-done):'')}</span>
        ${tot-done>0?`<button onclick="bookingV2ReconfirmAll('${date}','${rid}','list')" style="margin-left:auto;background:#7A4A00;color:#fff;border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">ยืนยันทั้งหมด (list)</button>`:''}
      </div>`;
    }
    /* §btBand · หัวการ์ดตระกูลโปรแกรมถูกยกไปเป็นการ์ด "โปรแกรมวันนี้" บนหัวหน้าแล้ว
       ตารางเรือรายลำที่อยู่ข้างในก็ซ้ำกับตัวกาง "ไกด์ · อาหารรายลำ" ของแต่ละทริป */
    void _famHead;
    return `
      <div class="t2-trip t2-trip-variant${(typeof bookingV2IsWeatherClosed==='function'&&bookingV2IsWeatherClosed(rid,date))?' t2-trip-wx':''}${_notRun?' t2-trip-closed':''}" style="--fam:${famColor}">
        ${_notRun?`<div class="t2-notrun"><span class="t2-notrun-ic">&#9888;</span><div style="flex:1;min-width:0"><div class="t2-notrun-t">ทริปนี้ไม่ออกวันนี้ · ${esc(_notRunWhy)}</div><div class="t2-notrun-s">${_notRunLive>0?`ยังมี <b>${_notRunLive}</b> booking ค้างอยู่บนวันนี้ — ต้องเลื่อนวันหรือยกเลิกให้เรียบร้อย`:'เหลือแต่รายการที่ยกเลิกแล้ว (เก็บไว้เป็นประวัติ)'}</div></div></div>`:''}
        ${(typeof bookingV2IsWeatherClosed==='function'&&bookingV2IsWeatherClosed(rid,date))?`<div style="background:#FCEBEB;border:1.5px solid #E89A92;border-radius:9px;padding:11px 14px;margin-bottom:10px;display:flex;align-items:center;gap:12px"><span style="font-size:20px">&#9928;</span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:#A32D2D">This trip is cancelled due to weather</div><div style="font-size:11px;color:#8a3a30;margin-top:1px">${bookingV2WeatherNote(rid,date)?esc(bookingV2WeatherNote(rid,date)):'Cannot depart'} · resolve booking by booking</div></div><button onclick="event.stopPropagation();bookingV2WeatherPanel('${rid}','${date}')" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:11.5px;font-weight:600;padding:8px 14px;border-radius:8px;cursor:pointer;white-space:nowrap">Resolve by booking</button></div>`:''}
        <div class="t2-tripcard">
        ${/* §btBand · ชื่อทริปย้ายลงไปเป็นแถบแรกของตารางแล้ว */''}
        <div class="t2-triphead" hidden>
          <div class="t2-tt">
            <div class="t2-tnm">${esc(route?.name || rid)}</div>
            <div class="t2-tmeta">${esc(dep)} departure${route?.pier?` · ${route.pier==='tublamu'?'Tub Lamu':route.pier==='panwa'?'Visit Panwa':esc(route.pier)}`:''}</div>
          </div>
          <div class="t2-sum">
            ${wxClosed && _wxc ? `
            <div class="t2-kpi"><div class="v">${_wxc.total}</div><div class="l">original</div></div>
            <div class="t2-kpi"><div class="v" style="color:#185FA5">${_wxc.rescheduled}</div><div class="l">rescheduled</div></div>
            <div class="t2-kpi"><div class="v" style="color:#A32D2D">${_wxc.cancelled}</div><div class="l">cancelled</div></div>
            ${_wxc.pending>0?`<div class="t2-kpi"><div class="v" style="color:#7A4A00">${_wxc.pending}</div><div class="l">pending</div></div>`:''}
            ` : `
            <div class="t2-availline">
              ${_seatLeft!=null?`<span class="t2-asg" title="ที่นั่งคงเหลือที่ยังรับได้ = ความจุเรือที่เปิดทั้งหมด − booking ที่นั่งที่จองแล้ว (ไม่นับเหมาลำ · ไม่ต้องรอจัดเรือ)"><span class="t2-asg-l">Availability</span><b class="t2-asg-v" style="color:${_seatLeft>0?'#0F6E56':'#A32D2D'}">${_seatLeft}</b></span><span class="t2-asg-div"></span>`:''}
              <span class="t2-asg"><span class="t2-asg-l">Total</span><b class="t2-asg-v" style="color:var(--coral)">${recv}</b><span class="t2-asg-bd">${_bdStr(ad,chd,inf,foc)}</span></span>
              ${_chtrPax>0?`<span class="t2-asg-div"></span><span class="t2-asg"><span class="t2-asg-l">Charter · ${_chtrBoatSet.size} ลำ</span><b class="t2-asg-v" style="color:#5B289A">${_chtrPax}</b><span class="t2-asg-bd">${_bdStr(_cAd,_cChd,_cInf,_cFoc)}</span></span><span class="t2-asg-div"></span><span class="t2-asg"><span class="t2-asg-l">Seat</span><b class="t2-asg-v" style="color:#0F6E56">${_seatPax}</b><span class="t2-asg-bd">${_bdStr(_sAd,_sChd,_sInf,_sFoc)}</span></span>`:''}
              ${trLockedTotal>0?`<span class="t2-asg-div"></span><span class="t2-asg"><span class="t2-asg-l">&#128274; Lock</span><b class="t2-asg-v" style="color:#C0392B">${trLockedTotal}</b></span>`:''}
            </div>
            `}
            <div class="t2-boats">${headBoats}</div>
          </div>
        </div>
          ${/* §btFix · แถบ Add-ons กับ Prep ย้ายไปอยู่ตัวกาง "ไกด์ · อาหารรายลำ"
                ท้ายตารางแล้ว (ตัวเดียวกัน แยกรายลำด้วย) · ไม่ต้องมีสองที่ */''}
          ${retAlertBar}
          ${/* §btBand · ตัวกางไกด์/อาหารรายลำ ย้ายไปท้ายตาราง (ดูตอนต้องใช้ ไม่ใช่ทุกครั้ง) */''}
          ${''}
        </div>
        <div class="t2-listcard">
        ${/* §btFix · โหมดจัดเรือ · เรือทุกลำกับความจุอยู่ในกรอบแดง "เรือที่วิ่ง" บนหัวแล้ว
              ตัวที่ใช้ทำงานจริงคือคอลัมน์ BOAT รายแถว + ปุ่ม auto บนหัวคอลัมน์ */''}
        ${''+(boatSelStrip?'':'')}
        ${vanStrip}
        ${rcStrip}
        ${/* §btSlim · แถบล็อคที่นั่งรายทริปถูกยกไปอยู่การ์ด Seat Lock บนหัวหน้าแล้ว
              (ยุบตามเอเยนต์ + ปุ่มล็อคที่นั่ง + ทั้งหมด ครบเหมือนเดิม) */''}
        ${pendBlock}
        ${(grp.length===0 && !_pendRows.length) ? '<div class="t2-nobk">No bookings yet · seats held by lock above</div>' : zoneTable}
        ${ghostBlock}
        ${cxlBlock}
        ${/* §btTune · แถบ "BOATS · ไกด์ · อาหารรายลำ" ท้ายตารางถูกตัดออก
              แถว PREP ในการ์ด Boats running บนหัวหน้าบอกยอดรวมของทริปครบแล้ว
              (ภาษาไกด์ / มื้ออาหาร / แพ้อาหาร / เรือหางยาว)
              รายละเอียดแยกรายลำดูได้ที่ Boat Operation และใบงานไกด์ */''}
        </div>
      </div>`;
  }).join('');

  /* ══ §btVanCard · ประกอบการ์ด VANS ════════════════════════════════════════
     เลือกโปรแกรมแล้ว = ทริปเดียว ชิปเรียงเป็นตาราง 3 คอลัมน์
     ยังไม่เลือก = ไล่ทีละทริป มีหัวเล็ก ๆ คั่น (ข้อมูลจริง: รถต่อวันมัธยฐาน 8 มากสุด 17)
     กรอบทั้งใบเป็นสีเข้ม · ตอนมีแถวถูกเลือกเปลี่ยนเป็นน้ำเงินทั้งใบ
     แก้เรื่องปุ่มจับกลุ่มอยู่ไกลจากแถวที่เพิ่งติ๊ก ตาจะได้เด้งไปเจอเอง            */
  let _btVanCard = '';
  if(vanMode){
    const _one = _btVanParts.length===1;
    const _anySel = _btVanParts.some(p=>p.sel);
    const _nVan = _btVanParts.reduce((n,p)=>n+p.n,0);
    const _body = _btVanParts.length
      ? _btVanParts.map(p=>(_one?'':`<span class="bt-vtrip"><i style="background:${p.col}"></i><b style="color:${p.col}">${p.nm}</b><span>${p.dep}${p.n?(' &middot; '+p.n+' van'+(p.n===1?'':'s')):''}</span></span>`)+p.cards+p.extra).join('')
      : '<span class="bt-none2">No van assigned yet</span>';
    const _grpSrc = _btVanParts.filter(p=>p.sel);
    const _grpUse = _grpSrc.length ? _grpSrc : _btVanParts.slice(0,1);
    const _grpMulti = _grpUse.length>1;
    const _grp = _btVanParts.length ? _grpUse.map(p=>(_grpMulti
      ? `<span class="bt-vgrpt"><i style="background:${p.col}"></i><b style="color:${p.col}">${p.nm}</b><em>${p.dep}</em></span>`
      : '')+p.grpRow).join('') : '';
    _btVanCard = `<div class="bt-c bt-vans${_anySel?' act':''}">
      <div class="bt-ct">VANS<span class="bt-cnt">${_nVan} van${_nVan===1?'':'s'}${_one?'':' &middot; '+_btVanParts.length+' trips'}</span>
        ${_btVanParts.length===1&&_btVanParts[0].btns?_btVanParts[0].btns:''}<span class="sp"></span></div>
      <div class="bt-vgrid">${_body}</div>
      <div class="bt-vgrp">${_grp}</div></div>`;
  }

  const style = `<style id="bkv2-t2-style">
    .t2-shell{display:flex;align-items:flex-start}
    .t2-side{width:226px;flex:none;background:var(--white);border-right:1px solid var(--border);padding:16px 14px;position:sticky;top:0;align-self:stretch;min-height:100%}
    .t2-main{flex:1;min-width:0;background:var(--btband,#EDE3E3)}
    .t2-shell{background:var(--btband,#EDE3E3)}
    /* ══ §btTop · ไล่ที่ว่างด้านบนออก ═══════════════════════════════════════
       วัดจริง: ขอบบนของแถบเมนูซ้ายอยู่ที่ 6px แต่เนื้อหาเริ่มที่ 22px
       (main มี padding-top:22) · เยื้องกัน 16px เห็นชัดเวลาวางเทียบกัน
       ดันแถบแท็บขึ้น 16 ให้ขอบบนตรงกัน แล้วบีบระยะที่เหลืออีกสองจุด
       สไตล์ก้อนนี้อยู่ในผลลัพธ์ของหน้า By-trip เท่านั้น หน้าอื่นไม่โดน       */
    .bkv2-topcard{margin-top:-16px !important;margin-bottom:4px !important}
    #view-booking .bkv2-bodycard{overflow:visible}
    .t2-hd{padding:9px 14px;background:var(--white);border-bottom:1px solid var(--border);box-shadow:0 2px 6px -3px rgba(15,23,42,.18);position:relative;z-index:45}
    .t2-hd-top{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
    .t2-hd-nav{display:flex;gap:5px;padding-top:4px}
    .t2-hd-dwrap{flex:none;min-width:0}
    .t2-hd-date{font-family:'DM Sans',sans-serif;font-size:24px;font-weight:800;color:var(--ink);letter-spacing:-.4px;line-height:1}
    .t2-hd-meta{font-family:'DM Mono',monospace;font-size:11px;color:var(--ink-soft);margin-top:5px}
    .t2-hd-total{text-align:right}
    .t2-hd-tlab{font-size:9px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.5px;font-weight:700}
    .t2-hd-tnum{font-size:32px;font-weight:800;color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}
    .t2-hd-tbrk{font-size:10px;color:var(--ink-soft);font-family:'DM Mono',monospace;margin-top:2px}
    .t2-hd-lockbar{display:flex;align-items:center;gap:9px;margin-top:13px;padding:7px 12px;background:#FBEAE6;border:1px solid #EAC6BF;border-radius:9px}
    .t2-hd-lockbadge{font-size:11px;font-weight:700;color:#fff;background:#C0392B;border-radius:6px;padding:3px 9px;white-space:nowrap}
    .t2-hd-locktxt{font-size:11px;color:#9a3b21}
    .t2-hd-warn{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px;padding:4px 10px;background:#FCEBEB;border:1px solid #E6A9A2;border-radius:8px}
    .t2-hd-warnico{font-size:13px;color:#C0392B;line-height:1}
    .t2-hd-warntxt{font-size:11px;font-weight:700;color:#A32D2D}
    .t2-hd-warnchip{font-size:10.5px;font-weight:600;color:#fff;background:#C0392B;border:none;border-radius:6px;padding:3px 9px;cursor:pointer;font-family:inherit;transition:filter .12s}
    .t2-hd-warnchip:hover{filter:brightness(1.08)}
    .t2-hd-warnchip b{font-family:'DM Mono',monospace;font-size:11px}
    .t2-hd-progs{display:flex;gap:7px;flex:1;min-width:0;overflow-x:auto;align-items:center;padding:2px 2px}
    .t2-pc{background:var(--white);border:1px solid var(--border);border-left:3px solid var(--c);border-radius:8px;padding:5px 10px;min-width:104px;cursor:pointer;transition:box-shadow .12s,border-color .12s}
    .t2-pc:hover{box-shadow:0 1px 5px rgba(0,0,0,.07)}
    .t2-pc.on{box-shadow:0 0 0 2px var(--c) inset}
    .t2-pcn{font-size:10px;font-weight:600;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t2-pcv{font-size:16px;font-weight:800;color:var(--ink);line-height:1;margin-top:2px;font-variant-numeric:tabular-nums}
    .t2-pcf{font-size:9px;color:var(--ink-faint);font-family:'DM Mono',monospace;margin-top:3px;display:flex;align-items:center;gap:5px}
    .t2-pclk{font-size:8px;font-weight:700;color:#C0392B;background:#FBEAE6;border-radius:4px;padding:1px 5px}
    .t2-filterbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:6px 14px;background:var(--white);border-bottom:1px solid var(--border)}
    .t2-seg{display:inline-flex;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:2px;gap:2px}
    .t2-seg button{border:none;background:transparent;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:var(--ink-soft);padding:3px 10px;border-radius:6px;cursor:pointer}
    .t2-seg button.on{background:var(--coral);color:#fff}
    .t2-routesel{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:var(--ink);border:1px solid var(--border);border-radius:7px;padding:4px 8px;background:var(--white);cursor:pointer;max-width:240px}
    .t2-clearf{font-family:'DM Sans',sans-serif;font-size:10.5px;color:var(--ink-soft);border:1px solid var(--border);background:var(--white);border-radius:7px;padding:3px 9px;cursor:pointer}
    .t2-clearf:hover{border-color:var(--coral);color:var(--coral)}
    .t2-calhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .t2-calmonth{font-size:13px;font-weight:700}
    .t2-calnav{display:flex;gap:4px}
    .t2-calgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
    .t2-dow{font-size:9px;color:var(--ink-faint);font-weight:700;text-align:center;padding:3px 0;text-transform:uppercase}
    .t2-day{aspect-ratio:1;display:flex;align-items:center;justify-content:center;position:relative;font-size:11px;font-family:'DM Mono',monospace;border-radius:8px;cursor:pointer;border:1px solid transparent}
    .t2-day.t2-mute{cursor:default}
    .t2-day:not(.t2-mute):hover{background:var(--bg)}
    .t2-day.today{border-color:var(--coral);color:var(--coral);font-weight:700}
    .t2-day.sel{background:var(--coral);color:#fff;font-weight:700}
    .t2-tdot{width:4px;height:4px;border-radius:50%;background:var(--coral);position:absolute;bottom:3px}
    .t2-day.sel .t2-tdot{background:#fff}
    .t2-pulbl{font-size:10px;color:var(--ink-soft);font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:18px 0 8px}
    .t2-puitem{display:flex;align-items:center;gap:9px;padding:7px 2px;border-bottom:1px solid var(--border-2);cursor:pointer}
    .t2-puitem:hover{background:var(--bg);border-radius:8px}
    .t2-pubar{width:3px;height:28px;border-radius:3px;flex:none}
    .t2-pubody{min-width:0;flex:1}
    .t2-punm{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t2-pumeta{font-size:10px;color:var(--ink-soft);font-family:'DM Mono',monospace;margin-top:1px}
    .t2-puempty{font-size:11px;color:var(--ink-faint);font-style:italic;padding:4px 2px}
    /* §btGap · เดิมเว้นบน 16 + ตัวแถบหัวเว้นล่าง 10 + การ์ดทริปเว้นล่าง 8 = ห่างกันเกินไป
       ตอนนี้หัวกับตารางเป็นพื้นสีเดียวกันแล้ว ระยะห่างที่ต้องมีคือขอบการ์ดอย่างเดียว */
    /* §btScroll · padding-top ต้องเป็น 0 · เนื้อที่ไถผ่านยังถูกวาดในเขต padding
       เศษแถวจะโผล่เหนือหัวตารางที่ตรึงไว้ */
    .t2-wrap{box-sizing:border-box;padding:0 8px 40px;overflow:auto;max-height:var(--bt-wraph,72vh);
      overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
    .t2-trip{background:transparent;border:none;border-radius:0;margin-bottom:12px;overflow:visible}
    .t2-tripcard{background:var(--white);border:1px solid var(--border);border-left:5px solid var(--fam);border-radius:14px;overflow:hidden;margin-bottom:0}
    /* การ์ดหัวทริปว่างแล้ว (ชื่อทริปย้ายลงตาราง) · ไม่ต้องกินที่เป็นกล่องเปล่า */
    .t2-tripcard:empty,.t2-tripcard{border:none;background:transparent}
    .t2-listcard{background:var(--white);border:1px solid var(--border);border-radius:14px;overflow:visible}
    /* ══ §btSlim · หัวการ์ดทริปเหลือเป็นแถบบาง ๆ ═══════════════════════════
       ชื่อทริป เวลาออก ท่า ที่นั่งว่าง ขายแล้ว ความจุ และเรือทุกลำ ตอนนี้อยู่ใน
       กรอบแดง "เรือที่วิ่ง" บนหัวหน้าแล้ว · หัวการ์ดเดิมจึงพูดซ้ำทั้งบล็อก
       เหลือไว้เป็นแถบคาดบาง ๆ ที่ทำหน้าที่บอกว่า "ตารางข้างล่างนี้คือทริปไหน"
       ยกเว้นวันที่ทริปถูกยกเลิกเพราะอากาศ · ตัวเลข original/rescheduled/cancelled
       ไม่มีที่อื่นบอก ต้องคงไว้                                                 */
    /* §btBand · attribute hidden แพ้กฎ display:flex ข้างล่าง ต้องปิดให้ชัด */
    .t2-triphead[hidden]{display:none !important}
    .t2-triphead{display:flex;align-items:center;gap:10px;padding:7px 14px;
      background:#FBFAF8;box-shadow:inset 5px 0 0 var(--fam,#8b909c);border-bottom:1px solid var(--border-2)}
    .t2-tt{min-width:0;flex:1;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
    .t2-tnm{font-size:13px;font-weight:800;line-height:1.15;color:var(--fam,#22262e)}
    .t2-tmeta{font-size:10px;color:var(--ink-soft);font-family:'DM Mono',monospace;margin-top:0}
    .t2-tripcard .t2-sum{display:none}
    /* §btSlim · ชิปเรือในแถบนี้ซ้ำกับกรอบแดง "เรือที่วิ่ง" บนหัวหน้าทุกตัวเลข
       ซ่อนเฉพาะชิป · ตัวกาง "ไกด์ · อาหารรายลำ" กับบรรทัดรวมภาษา/มื้ออาหาร
       ไม่มีที่อื่นบอก ต้องคงไว้ */
    .t2-boatbox .t2-minichips{display:none}
    .t2-boatsummary{padding:4px 14px 4px 18px}
    .t2-trip-wx .t2-sum{display:flex}
    .t2-sum{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
    .t2-kpi{text-align:center;padding:0 8px;border-left:1px solid var(--border-2)}
    .t2-kpi:first-child{border-left:none}
    .t2-kpi .v{font-family:'DM Mono',monospace;font-size:15px;font-weight:500;line-height:1}
    .t2-kpi .l{font-size:8.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
    /* trip-header summary line · Availability | Total | Charter | Seat (one row) */
    .t2-availline{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
    .t2-asg{display:inline-flex;align-items:baseline;gap:6px;white-space:nowrap}
    .t2-asg-l{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-faint);font-weight:700}
    .t2-asg-v{font-size:17px;font-family:'DM Mono',monospace;line-height:1;font-weight:700}
    .t2-asg-bd{font-size:10px;color:var(--ink-soft);font-family:'DM Mono',monospace}
    .t2-asg-div{width:1px;height:18px;background:var(--border-2);flex:none}
    .t2-boats{display:flex;gap:5px;flex-wrap:wrap;margin-left:6px}
    .t2-boatchip{display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:4px 9px;font-size:12px;font-weight:600}
    .t2-bav{width:22px;height:22px;border-radius:6px;color:#fff;font-size:9px;font-weight:700;font-family:'DM Mono',monospace;display:flex;align-items:center;justify-content:center}
    .t2-assign{font-size:11px;color:var(--ink-soft);border:1px dashed var(--ink-faint);background:transparent;border-radius:9px;padding:5px 10px;cursor:pointer;font-family:inherit}
    .t2-assign-off{font-size:11px;font-weight:700;color:#A32D2D;background:#FCEBEB;border:1px solid #E6C9C3;border-radius:9px;padding:5px 10px;white-space:nowrap}
    .t2-notrun{background:#FBF3E6;border:1.5px solid #E0C79A;border-radius:9px;padding:11px 14px;margin-bottom:10px;display:flex;align-items:center;gap:12px}
    .t2-notrun-ic{font-size:19px;color:#8A5B00;flex:none}
    .t2-notrun-t{font-size:13px;font-weight:700;color:#8A5B00}
    .t2-notrun-s{font-size:11px;color:#9a7433;margin-top:1px}
    .t2-trip-closed .t2-tripcard,.t2-trip-closed .t2-listcard{background:#FDFAF3;border-color:#E7D6B4}
    .t2-trip-closed .t2-tnm{color:#8A5B00}
    .t2-assign:hover{border-color:var(--coral);color:var(--coral);border-style:solid}
    .t2-boatstrip{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:6px 14px 6px 18px;background:#F7FAFE;border-top:1px solid var(--border-2)}
    .t2-boatpin{position:sticky;top:var(--t2-vangroup-top,52px);z-index:46;box-shadow:0 4px 10px rgba(0,0,0,.10);border-radius:14px 14px 0 0;overflow:hidden}
    .t2-boatpin .t2-boatstrip{border-top:none}
    .t2-boatstrip-lbl{font-size:10px;font-weight:700;color:#185FA5;text-transform:uppercase;letter-spacing:.05em;flex:none}
    .t2-addonbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:5px 14px 5px 18px;background:#FBFAFF;border-top:1px solid var(--border-2)}
    .t2-addonbar-lbl{font-size:10px;font-weight:700;color:#7A5AB0;text-transform:uppercase;letter-spacing:.05em;flex:none}
    .t2-aochip{font-size:11px;font-weight:600;border-radius:7px;padding:3px 9px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
    .t2-aochip b{font-weight:800;font-variant-numeric:tabular-nums}
    .t2-aochip-join{background:#E6F1FB;color:#1565A8}
    .t2-aochip-chtr{background:#EFEAFB;color:#5B289A}
    .t2-aochip-tr{background:#E1F5EE;color:#0F6E56}
    .t2-boatstrip-compact{background:transparent}
    @keyframes bkv2-selpop{0%{transform:scale(1.45);background:#0F6E56;box-shadow:0 0 0 6px rgba(15,110,86,.25)}60%{transform:scale(1.12);background:#1573D4}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(15,110,86,0)}}
    .bkv2-selcount{display:inline-block;animation:bkv2-selpop .35s ease-out}
    @keyframes bkv2-selpaxflash{0%{color:#0F6E56;transform:scale(1.3)}100%{color:inherit;transform:scale(1)}}
    .bkv2-selpax{display:inline-block;animation:bkv2-selpaxflash .35s ease-out}
    .t2-boatcount{display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:3px 11px 3px 4px;font-size:12px;font-weight:700}
    .t2-bstk{width:20px;height:20px;border-radius:50%;color:#fff;font-size:8px;font-family:'DM Mono',monospace;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff}
    .t2-boatbox{border-top:1px solid var(--border-2)}
    .t2-boatsummary{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:6px 14px 6px 18px;cursor:pointer;list-style:none}
    .t2-boatsummary::-webkit-details-marker{display:none}
    .t2-boatsummary:hover{background:#FBFAF7}
    .t2-minichips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0}
    .t2-mchip{display:inline-flex;align-items:center;gap:5px;background:#F4F2EC;border:1px solid #ECEAE3;border-radius:8px;padding:3px 9px 3px 4px;font-size:11px;font-weight:600;white-space:nowrap}
    .t2-mchip b{font-weight:700;font-family:'DM Mono',monospace}
    .t2-mchip-over{background:#FCEBEB;border-color:#E6C9C3}
    .t2-mchip-un{background:#FFF4E2;border-color:#EAD2A8;color:#9A5B00}
    .t2-mav{width:17px;height:17px;border-radius:50%;color:#fff;font-size:7.5px;font-family:'DM Mono',monospace;display:flex;align-items:center;justify-content:center;flex:none}
    .t2-boatexpand{font-size:10.5px;color:#185FA5;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
    .t2-caret{display:inline-block;transition:transform .15s}
    .t2-boatbox[open] .t2-caret{transform:rotate(180deg)}
    .t2-bgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));border-top:1px solid var(--border-2)}
    .t2-bcell{display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:0.5px solid #F0EEE8;border-right:0.5px solid #F0EEE8}
    .t2-bcell-over{background:#FDF4F3}
    .t2-bcell-nm{font-weight:700;font-size:12px;flex:none;min-width:60px;max-width:96px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t2-bcell-cap{font-family:'DM Mono',monospace;font-size:11px;color:var(--ink-soft);font-weight:700;flex:none}
    .t2-bcell-chips{margin-left:auto;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
    .t2-dchip{font-size:10px;font-weight:600;border-radius:5px;padding:1px 6px;white-space:nowrap}
    .t2-boatsum{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:5px 14px 5px 18px;background:#FBFAF7;border-top:1px solid var(--border-2)}
    .t2-boatsum-lbl{font-size:10px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em;font-weight:700}
    .t2-capchip{display:inline-flex;align-items:center;gap:6px;background:#F4F2EC;border:1px solid #ECEAE3;border-radius:9px;padding:4px 10px;font-size:12px;font-weight:600;white-space:nowrap}
    .t2-capchip-over{background:#FCEBEB;border-color:#E6C9C3}
    .t2-capnm{font-weight:700}
    .t2-capn{font-family:'DM Mono',monospace;color:#8a8a82;font-weight:700}
    .t2-capfree{font-size:10.5px;font-weight:700}
    .t2-prepwrap{margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .t2-prepbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:5px 14px 5px 18px;background:#fcfcfd;border-top:1px solid var(--border-2)}
    .t2-lockbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 16px 8px 21px;background:#FBEAE6;border-top:1px solid #EAC6BF}
    .t2-lockbadge{font-size:11px;font-weight:700;color:#fff;background:#C0392B;border-radius:6px;padding:3px 9px}
    .t2-lockchip{font-size:11px;font-weight:600;color:#9a3b21;background:#fff;border:1px solid #EAC6BF;border-radius:6px;padding:3px 9px}
    .t2-lockm{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;background:#EAC6BF;color:#7a2d1a;border-radius:3px;padding:1px 4px;margin-left:3px}
    .t2-lockmanage{margin-left:auto;font-size:10px;font-weight:700;color:#C0392B;background:#fff;border:1px solid #EAC6BF;border-radius:6px;padding:4px 9px;cursor:pointer;font-family:inherit}
    .t2-lockchip-btn{transition:border-color .12s,background .12s}.t2-lockchip-btn:hover{border-color:#C0392B;background:#fff}
    .t2-nobk{padding:11px 16px;font-size:11px;color:var(--ink-soft);font-style:italic;border-top:1px solid var(--border-2)}
    .t2-vcbtn{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:50%;font-size:11px;font-weight:600;letter-spacing:.02em;color:#5F5E5A;background:transparent;border:1px solid #B4B2A9;cursor:pointer;font-family:inherit;line-height:1}
    .t2-vcbtn:hover{border-color:#5F5E5A;background:#F1EFE8;color:#2C2C2A}
    /* §btSlim · การ์ดตระกูลโปรแกรม · หัวหน้ามีการ์ด "โปรแกรมวันนี้" อยู่แล้ว
       อันนี้เหลือหน้าที่เป็นตัวคั่น + ปุ่มกางดูเรือรายลำ จึงลดน้ำหนักลง */
    .t2-famcard{background:var(--white);border:1px solid var(--border);border-left:3px solid #8b909c;border-radius:12px;margin:10px 0 7px;overflow:hidden}
    .t2-famcard-hd{padding:5px 12px !important}
    .t2-famnm{font-size:12.5px !important}
    .t2-famcaret{width:20px !important;height:20px !important}
    .t2-famcard:first-child{margin-top:2px}
    .t2-famcard-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 14px;cursor:pointer;list-style:none}
    .t2-famcard-hd::-webkit-details-marker{display:none}
    .t2-famcard-hd:hover{background:#FBFAF7}
    .t2-famcaret{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--bg);color:var(--ink-soft);font-size:11px;transition:transform .15s;flex:none}
    .t2-famcard[open] .t2-famcaret{transform:rotate(180deg);background:#E6F1FB;color:#185FA5}
    .t2-fambody{padding:12px 14px;background:var(--bg);border-top:1px solid var(--border-2)}
    .t2-famvgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(208px,280px));gap:10px;align-items:start;justify-content:start}
    .t2-vcard{background:var(--white);border:1px solid var(--border);border-radius:10px;overflow:hidden}
    .t2-vcard-closed{opacity:.92}
    .t2-vclosed-note{padding:11px;font-size:11px;color:#b06a60;font-style:italic;text-align:center}
    .t2-vcard-hd{padding:8px 11px;border-top:3px solid #185FA5}
    .t2-vcard-nm{font-size:12.5px;font-weight:700;line-height:1.2}
    .t2-vcard-sub{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px}
    .t2-vcard-sub span:first-child{font-size:10.5px;color:var(--ink-soft)}
    .t2-vcard-px{font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
    .t2-vcard-body{padding:3px 0}
    .t2-vbrow{padding:7px 11px;border-top:0.5px solid #F2F0EA}
    .t2-vcard-body .t2-vbrow:first-child{border-top:none}
    .t2-vbrow-over{background:#FDF4F3}
    .t2-vbtop{display:flex;align-items:center;gap:7px}
    .t2-vbnm{font-weight:700;font-size:12px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t2-vbcap{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-soft);flex:none}
    .t2-vbchips{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;margin-left:28px}
    .t2-vbchips .t2-dchip{border-radius:999px;padding:1px 8px}
    .t2-famnm{font-size:15px;font-weight:800;color:var(--ink);letter-spacing:.01em}
    .t2-fampill{font-size:11px;font-weight:700;border-radius:999px;padding:2px 10px;white-space:nowrap}
    .t2-fampill-run{color:#0F6E56;background:#E1F5EE}
    .t2-fampill-closed{color:#A32D2D;background:#FCEBEB}
    .t2-famclosed-wrap{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .t2-famclosed-lbl{font-size:11px;color:#A32D2D;font-weight:600}
    .t2-closedchip{font-size:11px;background:#F0EEE8;color:#7a7870;border-radius:5px;padding:2px 8px;white-space:nowrap}
    .t2-fam-tot{margin-left:auto;font-size:11px;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
    .t2-fam-tot b{font-weight:700;font-size:15px;color:#3A6FF7}
    .t2-fv-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 16px;background:#F2F6FF;border-top:0.5px solid #E3E9F5}
    .t2-fv-dot{width:7px;height:7px;border-radius:50%;flex:none}
    .t2-fv-nm{font-size:12px;font-weight:700;color:#0C2E7A}
    .t2-fv-meta{font-size:11px;color:var(--ink-soft)}
    .t2-fv-px{margin-left:auto;font-size:11px;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
    .t2-trip-variant{margin-left:0}
    .t2-trip-wx .t2-tripcard,.t2-trip-wx .t2-listcard{background:#FDEEEC;border-color:#E89A92}
    .t2-ghost-sec{margin-top:10px;border:1px dashed #E89A92;border-radius:9px;background:#FCF6F4;padding:9px 13px}
    .t2-ghost-hd{font-size:10px;font-weight:700;color:#A32D2D;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
    .t2-ghost-row{display:flex;align-items:center;gap:13px;padding:6px 0;border-top:0.5px solid #F0D9D4;font-size:11.5px;color:#8d726d}
    .t2-ghost-row:first-of-type{border-top:none}
    .t2-ghost-vc{font-family:'DM Mono',monospace;font-size:10.5px;min-width:74px;text-decoration:line-through;opacity:.75}
    .t2-ghost-ag{font-weight:600;min-width:96px;color:#7a5f5a}
    .t2-ghost-cu{flex:1;min-width:0;text-decoration:line-through;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t2-ghost-px{font-family:'DM Mono',monospace;font-size:10.5px;white-space:nowrap}
    .t2-ghost-mv{font-weight:700;color:#185FA5;white-space:nowrap}
    .t2-ghost-go{font-size:9.5px;color:#185FA5;background:#fff;border:1px solid #C5D8EA;border-radius:5px;padding:3px 9px;cursor:pointer;white-space:nowrap;font-family:inherit}
    .t2-ghost-go:hover{background:#EAF3FB}
    .t2-movedin{display:inline-block;margin-top:3px;font-size:9.5px;font-weight:700;color:#185FA5;background:#EAF3FB;border:1px solid #C5D8EA;border-radius:5px;padding:1px 7px;white-space:nowrap}
    .t2-altpick{display:inline-block;margin-top:3px;font-size:9.5px;font-weight:700;color:#5B289A;background:#EDE7FB;border:1px solid #C7B8E8;border-radius:5px;padding:1px 7px;white-space:nowrap;cursor:help}
    .t2-paywrap{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
    .t2-cot{display:inline-block;background:#E0F7FA;color:#00838F;border:1px solid #9FE3EC;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap}
    .t2-needpickup{display:inline-block;background:#FCEFDD;color:#9A5B00;border:1px solid #EAD2A8;font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:6px;white-space:nowrap}
    .t2-row.t2-cxl td{opacity:.5;background:#FBF7F6}
    .t2-row.t2-cxl .t2-lead{text-decoration:line-through}
    .t2-cxlbadge{display:inline-block;background:#FCEBEB;color:#A32D2D;border:1px solid #E6C9C3;font-size:9px;font-weight:800;letter-spacing:.04em;padding:1px 6px;border-radius:5px;margin-left:6px;opacity:1}
    /* §Check-in overlay · ผลจากหน้าเช็คอินรถ/หน้าท่า · ครอบ booking เฉยๆ ไม่ย้ายแถว ไม่แก้ยอด/ราคา (สรุปที่ Travel Summary) */
    .t2-ckns{display:inline-block;background:#FCEBEB;color:#A32D2D;border:1px solid #E6C9C3;font-size:9px;font-weight:800;letter-spacing:.03em;padding:1px 6px;border-radius:5px;margin-left:6px;cursor:help;white-space:nowrap}
    .t2-ckns-full{background:#C0392B;color:#fff;border-color:#C0392B}
    .t2-ckok{display:inline-block;background:#E6F5EA;color:#1B7F4B;font-size:9px;font-weight:700;padding:1px 6px;border-radius:5px;margin-left:6px;white-space:nowrap}
    .t2-row.t2-cklost>td{background:#F6CFCB !important;border-bottom-color:#E9B4AF}
    .t2-row.t2-cklost>td:first-child{box-shadow:inset 5px 0 0 #C0392B}
    .t2-row.t2-cklost:hover>td{background:#F2C2BD !important}
    .t2-nsbadge{display:inline-block;background:#FBE3D0;color:#9A4A12;border:1px solid #EFC6A3;font-size:9px;font-weight:800;letter-spacing:.03em;padding:1px 6px;border-radius:5px;margin-left:6px;white-space:nowrap}
    .t2-redbadge{display:inline-block;background:#FCEBEB;color:#A32D2D;border:1px solid #E6C9C3;font-size:9px;font-weight:700;padding:1px 6px;border-radius:5px;margin-left:6px;white-space:nowrap}
    /* §pendSeat · กลุ่มรออนุมัติ · โทนอำพัน แยกจากกลุ่มยกเลิก (แดง) ให้ชัด */
    .t2-pend-sec{margin-bottom:10px;border:1px solid #EAD9B0;border-radius:9px;background:#FDF8EE;padding:9px 13px}
    .t2-pend-hd{font-size:10px;font-weight:700;color:#8A5B00;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
    .t2-pend-row{display:flex;align-items:center;gap:13px;padding:6px 0;border-top:0.5px solid #EFE0C2;font-size:11.5px;color:#7a6338}
    .t2-pend-why{flex:1;min-width:0;font-weight:700;color:#8A5B00;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .t2-pend-hold{font-size:10px;font-weight:700;color:#5F6B7A;background:#EEF1F5;border-radius:6px;padding:1px 7px;white-space:nowrap}
    /* ใช้คลาสช่องเดียวกับกลุ่มยกเลิกเพื่อให้คอลัมน์ตรงกัน · แต่ต้องล้างเส้นขีดฆ่าออก
       รออนุมัติยังไม่ถูกยกเลิก · ขีดฆ่าจะอ่านเป็น "ใบนี้ตายแล้ว" ซึ่งผิด */
    .t2-pend-row .t2-cxl-vc,.t2-pend-row .t2-cxl-cu{text-decoration:none;opacity:1}
    .t2-pend-row .t2-cxl-vc{color:#7a6338}
    .t2-pend-row .t2-cxl-cu{font-weight:600;color:#5a4a2a}
    .t2-pend-row .t2-cxl-ag{color:#8a7350}
    .t2-cxl-sec{margin-top:10px;border:1px solid #E6C9C3;border-radius:9px;background:#FCF6F5;padding:9px 13px}
    .t2-cxl-hd{font-size:10px;font-weight:700;color:#A32D2D;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
    .t2-cxl-row{display:flex;align-items:center;gap:13px;padding:6px 0;border-top:0.5px solid #F0DBD6;font-size:11.5px;color:#8d726d}
    .t2-cxl-row:first-of-type{border-top:none}
    .t2-cxl-vc{font-family:'DM Mono',monospace;font-size:10.5px;min-width:90px;text-decoration:line-through;opacity:.75}
    .t2-cxl-ag{font-weight:600;min-width:96px;color:#7a5f5a}
    .t2-cxl-cu{min-width:120px;text-decoration:line-through;opacity:.8}
    .t2-cxl-px{font-family:'DM Mono',monospace;font-size:10.5px;white-space:nowrap}
    .t2-cxl-ch{font-weight:700;color:#A32D2D;white-space:nowrap}
    .t2-cxl-rs{flex:1;min-width:0;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85}
    .t2-trip-wx .t2-zhead{background:#FAE3E0;border-color:#EEC9C3}
    .t2-trip-wx table.t2-mtbl tr.t2-row:hover td{background:#F8DED9}
    .t2-closedline{display:flex;align-items:center;gap:8px;padding:7px 11px;background:#FCEBEB;border-radius:8px}
    .t2-cdot{width:6px;height:6px;border-radius:50%;background:#E24B4A;flex:none}
    .t2-closednm{font-size:12px;font-weight:600;color:#791F1F;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t2-closedtag{flex:none;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#A32D2D}
    .t2-preplbl{font-size:10px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em}
    .t2-prepgrp{display:inline-flex;align-items:center;gap:5px}
    .t2-prepcat{font-size:9px;font-weight:700;letter-spacing:.05em;color:var(--ink-soft);text-transform:uppercase}
    .t2-prepdiv{display:inline-block;width:1px;height:15px;background:var(--border);margin:0 3px;vertical-align:middle}
    .t2-prep{font-size:10px;border-radius:5px;padding:2px 7px;font-weight:600}
    .t2-zhead{display:flex;align-items:center;gap:8px;padding:8px 16px;background:#f6f7f9;border-top:1px solid var(--border-2);border-bottom:1px solid var(--border-2)}
    /* §btBand · แถบโปรแกรม · ชั้นบนสุดของตาราง เข้มกว่าแถบโซนอีกระดับ */
    .t2-mtbl tr.t2-pband>td{background:#F7F4F1;border-top:3px solid var(--pc);
      border-bottom:1px solid #E2DBD4;padding:8px 14px}
    .t2-pband .pw{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .t2-pband .pd{width:11px;height:11px;border-radius:50%;background:var(--pc);flex:none}
    .t2-pband .pn{font-size:14px;font-weight:800;color:var(--pc);letter-spacing:.01em}
    .t2-pband .pt{font-size:11px;color:#7a746d;font-weight:600;font-family:'DM Mono',monospace}
    .t2-pband .pb{font-size:10px;font-weight:800;color:#5b5b55;background:#fff;
      border:1px solid #E2DBD4;border-radius:6px;padding:2px 8px}
    .t2-pband .ps{margin-left:auto;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;
      color:#5b5b55;white-space:nowrap}
    .t2-pband .ps em{font-style:normal;font-family:inherit;border-radius:6px;padding:2px 8px;
      margin-left:7px;font-weight:800;font-size:11px}
    .t2-pband .ps em.ok{background:#DCF4E8;color:#0C6B47}
    .t2-pband .ps em.low{background:#FAEEDA;color:#854F0B}
    .t2-pband .ps em.full{background:#FCEBEB;color:#A32D2D}
    /* §btBand · ตัวกางไกด์/อาหาร ย้ายมาท้ายตาราง · ทำให้เบาลงให้รู้ว่าเป็นของเสริม */
    .t2-listcard > .t2-boatbox{border-top:1px solid var(--border-2);background:#FCFBF9}
    /* §btTable · หัวโซนในตาราง · แถบเข้มกว่าแถบคันรถหนึ่งระดับ ให้ลำดับชั้นอ่านออก */
    .t2-mtbl tr.t2-zband>td{background:#EEF2F7;border-top:2px solid #C9D4E2;border-bottom:1px solid #D9E1EA;
      padding:7px 14px;box-shadow:inset 5px 0 0 var(--zc,#8b909c)}
    .t2-mtbl tr.t2-zband-ch>td{background:#F2EEFC;border-top-color:#D6CCF2;border-bottom-color:#DDD4F2;
      box-shadow:inset 5px 0 0 #5B289A}
    .t2-zband .zw{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .t2-zband .zkind{font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8a93a1}
    .t2-zband .znm{font-size:13px;font-weight:800;color:#28344A;letter-spacing:.01em}
    .t2-zband-ch .znm{color:#5B289A}
    .t2-zband .zsub{font-size:11px;color:#6a7180;font-weight:600}
    .t2-zband-ch .zsub{color:#7A6FA8}
    .t2-zdot{width:8px;height:8px;border-radius:50%}
    .t2-zn{font-size:12px;font-weight:700}
    .t2-zc{font-size:11px;color:var(--ink-soft);font-family:'DM Mono',monospace}
    /* ══ §btScroll · ตัวเลื่อนเดียวสำหรับทั้งวัน ═════════════════════════════
       ก่อนหน้านี้ให้ตารางของ "แต่ละทริป" มีกล่องเลื่อนของตัวเอง · วันที่มีหลายทริป
       เลยมีตัวเลื่อนหลายตัวซ้อนกับตัวเลื่อนของหน้า · พอไถหน้าลงมา กล่องของทริปที่ 2
       เลื่อนตามหน้าไปทั้งกล่อง หัวตารางที่ตรึงกับกล่องจึงหลุดออกนอกจอ
       เห็นตารางที่ไม่มีหัวคอลัมน์ · แถมพอไถในกล่องจนสุดแล้วหน้าไม่ไถต่อ (รู้สึกค้าง)

       ของใหม่: ทั้งวันอยู่ในกล่องเดียว (.t2-wrap) · หน้าไม่เลื่อน กล่องเลื่อนแทน
       หัวตารางของทุกทริปตรึงกับกล่องนี้ ไถผ่านทริปไหนหัวของทริปนั้นขึ้นมาแทนเอง
       คอลัมน์ซ้ายที่แช่แข็งไว้ก็เกาะกล่องนี้ ทุกทริปเลื่อนแนวนอนพร้อมกัน           */
    .t2-tblscroll{overflow:visible;position:relative;z-index:0}
    /* §btScroll · border-collapse:collapse ทำให้ position:sticky บน th ไม่ทำงาน
       (หัวตารางไถหายไปทั้งที่ตั้ง sticky ไว้) · ต้องเป็น separate + border-spacing:0
       เหมือนที่ตารางเช็คอินรถ/หน้าท่าใช้อยู่ · เส้นขอบวาดที่ td/th อยู่แล้วจึงไม่ซ้อน */
    table.t2-mtbl{border-collapse:separate;border-spacing:0;width:100%;min-width:1180px;font-size:12px}
    /* §t2Hdr · หัวตารางเดิมเป็นเทาอ่อน 9px บนพื้นขาว · จางกว่าเนื้อตารางที่มันกำกับอยู่
       ตารางนี้กว้างกว่าจอต้องเลื่อนแนวนอน คนเลื่อนไปกลางตารางแล้วไม่รู้ว่าคอลัมน์ไหนคืออะไร
       ทำเป็นพื้นทึบ · sticky อยู่แล้ว พอเลื่อนลงหัวยังติดอยู่และอ่านออก
       §btHdr (2026-09-04) · เดิมเป็นน้ำเงินกรมท่า ซึ่งเป็นสีเดียวในหน้าที่ไม่เข้าชุด
       หลังทำหัวหน้าใหม่เป็นโทนอุ่น (ทราย/ชมพูตามสีโปรแกรม) · เปลี่ยนเป็นทรายเข้ม
       ยังทึบและอ่านออกเหมือนเดิม แต่ไม่ตัดกับหน้าเป็นแถบดำกลางจอ */
    table.t2-mtbl th{text-align:left;font-size:9.5px;font-weight:800;color:#4A3C3C;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;white-space:nowrap;position:sticky;top:var(--t2-head-top,0px);z-index:35;background:#EDE6E6;box-shadow:inset 0 -2px 0 #C4B2B2}
    /* §btHdr · เส้นแบ่งคอลัมน์ · ตารางกว้างมาก ไม่มีเส้นตั้งแล้วตาไล่ข้ามคอลัมน์หลุด */
    /* §btCell · ของเดิมเว้นบน-ล่างช่องละ 13px · พอป้ายในช่องลูกค้าตกเป็นสองบรรทัด
       แถวสูงเกือบ 60px เห็นได้ 8 แถวต่อจอ · ลดเหลือ 6px ตามที่วางไว้ใน mockup
       ตัวหนังสือขยับขึ้นเป็น 12.5px ชดเชยความแน่น ไม่ให้อ่านยากลง */
    table.t2-mtbl td{padding:6px 9px;border-bottom:1px solid #DCE1E8;border-right:1px solid #E8EBEF;vertical-align:middle;white-space:nowrap;font-size:12.5px}
    table.t2-mtbl td:last-child{border-right:0}
    /* ══ §btFreeze (2026-09-04) · แช่แข็งสามคอลัมน์ซ้าย ═══════════════════════
       ตารางกว้าง 1,585-1,850px แต่จอให้พื้นที่จริง ~1,438px จึงต้องเลื่อนไปขวา
       เพื่อดู Pay / Total / Boat · พอเลื่อนแล้วไม่รู้ว่ากำลังดูแถวของใครอยู่
       ตรึง Voucher · Agency · ลูกค้า ไว้กับที่ (วิธีเดียวกับเช็คอินรถ/หน้าท่าใช้อยู่)

       ช่องที่ตรึงต้องมีพื้นทึบ ไม่งั้นแถวข้างหลังทะลุขึ้นมาตอนเลื่อน
       แต่แถวมีสีของตัวเองอยู่แล้ว (เรือ / กรุ๊ป / ยกเลิก / No-show / ที่เลือกไว้)
       จะทาขาวทับไม่ได้ · ให้ tr มีพื้นขาวเป็นค่าตั้งต้น แล้ว td รับสีของแถวมาแทน
       ความจำเพาะต่ำกว่ากฎ hover เดิม (0,2,2 < 0,3,3) hover จึงยังทับได้เหมือนเดิม */
    .t2-mtbl tr.t2-row{background:#fff}
    .t2-mtbl tr.t2-row>td{background:inherit;background-clip:padding-box}
    .t2-mtbl tr.t2-row>td:nth-child(-n+3),
    .t2-mtbl thead th:nth-child(-n+3){position:sticky;z-index:12}
    .t2-mtbl thead th:nth-child(-n+3){z-index:36}
    .t2-mtbl tr.t2-row>td:nth-child(1),.t2-mtbl thead th:nth-child(1){left:0}
    .t2-mtbl tr.t2-row>td:nth-child(2),.t2-mtbl thead th:nth-child(2){left:var(--t2-fz1,112px)}
    .t2-mtbl tr.t2-row>td:nth-child(3),.t2-mtbl thead th:nth-child(3){left:var(--t2-fz2,254px)}
    /* เส้นหนาบอกขอบของส่วนที่ตรึง · ไม่งั้นตาแยกไม่ออกว่าตรงไหนหยุดเลื่อน */
    .t2-mtbl tr.t2-row>td:nth-child(3),.t2-mtbl thead th:nth-child(3){
      border-right:2px solid #C3CCD8;box-shadow:3px 0 6px -3px rgba(15,23,42,.18)}
    /* เนื้อในแถบคาด (โซน / คันรถ / กรุ๊ป / เรือ) เกาะซ้ายไว้ด้วย
       เลื่อนไปขวาสุดก็ยังอ่านออกว่าแถวพวกนี้อยู่ใต้โซนไหน คันไหน */
    .t2-mtbl tr>td[colspan]>div{position:sticky;left:0;
      width:-moz-max-content;width:max-content;max-width:100%}
    table.t2-mtbl tr.t2-row:hover td{background:#fcfcfd;cursor:pointer}
    .t2-mtbl .t2-c,.t2-mtbl th.t2-c{text-align:center}
    /* §btCell · AD/CHD/INF/FOC เป็นฟอนต์ความกว้างเท่ากัน หลักจะได้ตรงกันทั้งคอลัมน์ */
    .t2-mtbl td.t2-c{font-family:'DM Mono',ui-monospace,monospace}
    .t2-mtbl .t2-r,.t2-mtbl th.t2-r{text-align:right}
    .t2-mono{font-family:'DM Mono',monospace}
    .t2-dim{color:var(--ink-faint)}
    .t2-agency{font-weight:600;color:#0f7a5a;white-space:nowrap;display:inline-block;max-width:130px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
    /* overflow-wrap:anywhere ทำให้ min-content ของช่องนี้เหลือ 1 ตัวอักษร → พอตารางถูกบีบ ชื่อโรงแรมถูกหั่นกลางคำ
       ("Novot / el Kamal / a Beach") · break-word ตัดที่ช่องว่างก่อน จะหั่นกลางคำเฉพาะคำที่ยาวเกินช่องจริงๆ */
    /* §t2Hdr · สามช่องนี้คือของที่คนจัดรถต้องอ่านทุกแถว (ไปรับที่ไหน ห้องอะไร โซนไหน)
       เดิมเป็นตัวปกติสีเดียวกับทุกคอลัมน์ เลยกลืนไปกับ voucher/agency ที่อ่านนาน ๆ ครั้ง */
    /* §pickW · 230px รับได้ ~32 ตัวอักษรต่อบรรทัด · วัดจากชื่อจริง 2,711 ใบ (791 ชื่อไม่ซ้ำ)
       มี 446 ใบ (16%) ที่ยาวเกินจนตกบรรทัด · ยาวเฉลี่ย 25 ตัว p90 34 ตัว ยาวสุด 68 ตัว
       ขยับเป็น 320px (~45 ตัว) เหลือตกบรรทัดแค่ 2% · ที่ได้มาจากการบีบ Special request ข้างล่าง */
    /* §pickW · max-width บน span อย่างเดียวไม่พอ · ตารางเป็น auto layout
       ความกว้างคอลัมน์คิดจาก min-content ของเนื้อใน ซึ่งของ span ที่ตัดคำได้ = min-width (96px)
       คอลัมน์เลยยุบเหลือ 96px แล้วชื่อตกบรรทัดทั้งที่ max-width ตั้งไว้ 320
       ต้องบังคับที่ th/td ของคอลัมน์นั้นตรง ๆ
       ลองวัด 3 วันจริง: 240px เหลือตกบรรทัด 7/31 · 270px เหลือ 2/31 · 300px เหลือ 1/31
       เลือก 270 เพราะจาก 270→300 ได้เพิ่มแค่แถวเดียว แต่จ่ายความกว้างอีก 30px
       วันที่มี 31 แถว: สูง 3,100 → 2,624px (-15%) · กว้าง 1,585 → 1,743px */
    /* §btCols · จุดรับตัดเป็น 2 บรรทัดได้อยู่แล้ว · 270 → 196 คืนที่ให้ตาราง 74px */
    .t2-mtbl th.t2-pk,.t2-mtbl td.t2-pk{min-width:196px;max-width:196px}
    /* §btGap · จุดรับ / โซน / ห้อง ไม่ต้องมีพื้นชิป · มีเส้นแบ่งคอลัมน์แล้ว
       ตาแยกค่าออกจากช่องข้าง ๆ ได้อยู่ · ชิปซ้อนอีกชั้นทำให้ตารางลาย */
    .t2-pickcell{display:inline-block;max-width:190px;min-width:80px;white-space:normal;overflow-wrap:break-word;line-height:1.3;vertical-align:middle;font-weight:700;font-size:12.5px;color:#26303F}
    /* ══ §btCols · บีบคอลัมน์ให้ตารางแคบลง ═══════════════════════════════════
       ตารางกว้าง 2,228px แต่จอ 1800px ให้พื้นที่จริงแค่ 1,438px จึงต้องเลื่อนซ้ายขวา
       ตลอด และกล่องเลื่อนนั้นกลืน position:sticky (แกนหนึ่งไม่ใช่ visible อีกแกน
       กลายเป็น auto ตาม) หัวตารางจึงตรึงกับหน้าไม่ได้
       ตัวที่กินเกินจำเป็น: ช่องชื่อลูกค้า 377px (ป้ายทั้งหมดอยู่บรรทัดเดียวกับชื่อ)
       จุดรับ 270px · โซน 212px · Agency 172px — บีบลงโดยให้ป้ายตกบรรทัดแทน  */
    .t2-mtbl td.t2-cu,.t2-mtbl th.t2-cu{max-width:210px;width:210px}
    .t2-mtbl td.t2-cu{white-space:normal;line-height:1.5}
    .t2-mtbl td.t2-ag,.t2-mtbl th.t2-ag{max-width:142px;width:142px;overflow:hidden}
    .t2-mtbl td.t2-zn,.t2-mtbl th.t2-zn{max-width:116px;width:116px}
    .t2-mtbl th.t2-vc{width:104px}
    .t2-lead{font-weight:700;white-space:nowrap;display:inline-block;max-width:190px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
    .t2-vch{display:inline-block;max-width:96px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
    .t2-zonetag{max-width:104px;overflow:hidden;text-overflow:ellipsis;display:inline-block;vertical-align:middle}
    .t2-agf,.t2-mtbl td.t2-ag .agf{max-width:138px}
    .t2-leadonly{font-size:10px;margin-left:4px}
    .t2-more{font-size:10px;border:1px solid var(--border);background:var(--bg);color:var(--ink-soft);border-radius:6px;padding:1px 7px;cursor:pointer;margin-left:5px;font-family:inherit}
    .t2-more:hover{border-color:var(--coral);color:var(--coral)}
    .t2-zonetag{font-size:11px;font-weight:700;background:transparent;color:#2F4E77;border-radius:0;padding:0;white-space:nowrap}
    /* §t2Hdr · เลขห้องเป็นชิป · ตาจับได้ว่าเป็นค่าที่มีจริง ไม่ใช่ตัวเลขลอย ๆ ปนกับเวลา */
    .t2-room{font-weight:700;color:#1B2A55;background:transparent;border-radius:0;padding:0}
    .t2-sb{color:var(--ink-soft);display:inline-block;max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}
    /* §pickW · Special request มีข้อความจริงแค่ 131 ใบจาก 3,205 (4%) แต่กินที่ 196px ทุกตาราง
       บีบเหลือ 150px แล้วยกที่ให้ชื่อจุดรับที่ต้องอ่านทุกแถว
       ชดเชยด้วยการเพิ่มจาก 2 เป็น 3 บรรทัด — แคบลงแต่ยังเห็นข้อความเท่าเดิม
       แถวที่มีโน้ตจะสูงขึ้นบ้าง แต่มีแค่ 4% ของแถวทั้งหมด */
    .t2-req{max-width:118px;overflow:hidden}
    .t2-rbwrap{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;max-width:112px}
    .t2-rb{font-size:10px;border-radius:5px;padding:2px 7px;font-weight:600;white-space:nowrap}
    /* Add-on cell: badges on top, action buttons (+ / upgrade) stacked below · smaller */
    .t2-addoncell{display:flex;flex-direction:column;gap:4px;max-width:118px;flex-wrap:wrap}
    .t2-addoncell-badges{display:flex;gap:3px;flex-wrap:wrap}
    .t2-addoncell-badges:empty{display:none}
    .t2-addoncell-badges .t2-rb{font-size:9px;padding:1px 6px}
    .t2-addoncell-acts{display:flex;gap:4px}
    .t2-addbtn{font-size:10px;line-height:1;background:#fff;border:1px dashed var(--border);border-radius:5px;padding:2px 6px;cursor:pointer}
    .t2-addbtn-up{color:#534AB7;border-color:#B8B2E8}
    /* Not-yet-assigned booking (after van grouping started) — amber frame, floats to top */
    /* unassigned cue · amber FRAME (กรอบคลุม) · NO fill override → the row shows its boat tint (inline _boatRowStyle) instead */
    .t2-mtbl tr.t2-unassigned td{border-top:2px solid #E6A85C;border-bottom:2px solid #E6A85C}
    .t2-mtbl tr.t2-unassigned td:first-child{border-left:2px solid #E6A85C}
    .t2-mtbl tr.t2-unassigned td:last-child{border-right:2px solid #E6A85C}
    /* group with no van picked yet · ONE big red box around the whole group (header top + sides on every row + bottom on the last row only · no internal lines) */
    .t2-mtbl tr.t2-novan td:first-child{border-left:2px solid #E05B5B}
    .t2-mtbl tr.t2-novan td:last-child{border-right:2px solid #E05B5B}
    .t2-mtbl tr.t2-novan-last td{border-bottom:2px solid #E05B5B}
    /* ══ §btVCell2 · บีบช่องจัดการกลุ่มรถให้แคบที่สุดเท่าที่ยังกดได้ ═══════════
       และในโหมดจัดรถไม่ต้องกางดูชื่อผู้โดยสารคนอื่น · คนจัดรถดูชื่อหัวใบกับ
       จำนวนคนพอ · ตัดปุ่มกางออก ช่องชื่อเหลือบรรทัดเดียว แถวเตี้ยลงอีก        */
    .t2-mtbl th.t2-gwrap,.t2-mtbl td.t2-gwrap{width:184px;max-width:184px}
    .t2-mtbl.t2-van .t2-more,.t2-mtbl.t2-van .t2-leadonly{display:none}
    .t2-mtbl.t2-van td.t2-cu{max-width:186px;width:186px}
    /* §btLkHit · แถวที่ดึงที่นั่งจากล็อคที่กำลังเลือก · ใช้ภาษาเดียวกับแถวที่ถูกติดธงอยู่แล้ว
       (กรอบรอบแถว ไม่ทาสีทับ) เพื่อไม่กลบสีเรือ/กรุ๊ปที่แถวมีอยู่ */
    .t2-mtbl tr.t2-lkhit>td{border-top:2px solid #C0392B;border-bottom:2px solid #C0392B}
    .t2-mtbl tr.t2-lkhit>td:first-child{border-left:2px solid #C0392B}
    .t2-mtbl tr.t2-lkhit>td:last-child{border-right:2px solid #C0392B}
    /* §SPECIAL REQUEST · เดิม nowrap + max-width 230px → โน้ตยาวๆ ("Extra Person NT1300 Paid 13.07.26")
       ดันคอลัมน์นี้กว้างจนคอลัมน์อื่นถูกบีบ · ตอนนี้ตัดเป็น 2 บรรทัดแล้วใส่ … (ตัวเต็มอยู่ใน tooltip) */
    .t2-allerg,.t2-note{font-size:11px;line-height:1.35;max-width:112px;white-space:normal;overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}   /* §pickW */
    .t2-allerg{color:#A32D2D}
    .t2-note{color:var(--ink-soft);margin-top:2px}
    .t2-pay{font-size:10px;background:#e7f0fb;color:#1d5fa5;border-radius:6px;padding:2px 8px;white-space:nowrap}
    .t2-paxrow td{background:#f6f7f9;padding:9px 10px 9px 40px}
    .t2-paxttl{font-size:10px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
    .t2-paxlist{display:flex;gap:16px;flex-wrap:wrap;font-size:12px}
    .t2-natl{font-size:10px;background:#E6F1FB;color:#185FA5;border-radius:5px;padding:1px 6px}

    /* ══ §btHead · หัวหน้า By-trip ══════════════════════════════════════════
       ตรึงทั้งก้อนเหมือนหน้าท่า · ค่า top ของชั้นล่าง ๆ ถูกตั้งจาก JS หลัง render
       (--bt-hd-h) เพราะความสูงจริงเปลี่ยนตามความกว้างจอ                        */
    /* §btStick · เดิม top:-22px คือให้หัวไถขึ้นไป 22px ก่อนค่อยหยุด · ทำให้ขอบบน
       ไม่ตรงกับขอบบนของแถบเมนูซ้าย · ชิดขอบเลย */
    .bt-pkh{position:sticky;top:0;z-index:60;background:var(--btband,#E9E7E3);
      padding:6px 6px 4px;margin-bottom:0}
    .bt-hdtop{position:relative;display:flex;align-items:center;gap:13px;padding:0 8px 7px}
    .bt-arw{width:27px;height:27px;flex:none;border:1px solid rgba(0,0,0,.13);background:#fff;border-radius:9px;
      display:flex;align-items:center;justify-content:center;color:#7d7a74;font-size:14px;cursor:pointer;font-family:inherit;line-height:1}
    /* §btNav · แถวหัวเป็น flex · ทุกชิ้นที่กว้างไม่คงที่ ดันปุ่ม › ให้ขยับตาม
       วัดแล้วปุ่ม › แกว่งได้ถึง 33px ระหว่างวัน · กดเลื่อนวันรัว ๆ แล้วปุ่มหนีมือ
       ต้นเหตุมีสามชิ้น ตรึงความกว้างทั้งสาม:
         เลขวัน   1 หลัก 21px / 2 หลัก 43px
         ชื่อวัน+เดือน  Wednesday/SEPTEMBER 2026 ยาวกว่า Thursday/DECEMBER 2026 อยู่ 6px
         ปุ่ม today  TODAY 67px / Go to today 100px */
    .bt-dnum{font-size:32px;font-weight:800;letter-spacing:-1px;line-height:1;font-family:'DM Mono',monospace;
      display:inline-block;min-width:43px;text-align:center;flex:none}
    .bt-dgrp{display:inline-block;min-width:118px;flex:none}
    .bt-dwk{display:block;font-size:15px;font-weight:800;line-height:1.05}
    .bt-dmo{position:relative;display:block;font-size:9px;font-weight:800;letter-spacing:.13em;
      color:#8d8880;text-transform:uppercase;cursor:pointer}
    .bt-dmo input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
    .bt-today{background:#15201a;color:#fff;border:none;border-radius:999px;padding:5px 13px;
      font-size:11px;font-weight:700;font-family:inherit;flex:none;
      min-width:100px;text-align:center;box-sizing:border-box}
    .bt-today.gh{background:#fff;color:#5b5b55;border:1px solid rgba(0,0,0,.13);cursor:pointer}
    /* กลางจริง · margin:auto จะกลางแค่ "ที่ว่างที่เหลือ" ฝั่งซ้ายยาวกว่าเลยเบี้ยวไปขวา ~110px */
    .bt-brand{position:absolute;left:50%;transform:translateX(-50%);font-size:20px;font-weight:800;
      letter-spacing:.46em;padding-left:.46em;color:#1F2124;white-space:nowrap;pointer-events:none;
      max-width:44%;overflow:hidden;text-overflow:ellipsis}
    .bt-hgrid{display:grid;grid-template-columns:minmax(0,1.28fr) minmax(0,0.92fr) minmax(0,1.9fr);
      gap:9px;padding:0 8px;align-items:stretch}
    /* §cityTourView · Transfer/City Tour never has a boat to assign · drop the middle column
       instead of leaving an empty "no trip running" box */
    .bt-hgrid.bt-hgrid-noboat{grid-template-columns:minmax(0,1.28fr) minmax(0,1.9fr)}
    .bt-hgrid.bt-hgrid-noboat>div:nth-child(2){display:none}
    .bt-hgrid>div{display:flex;flex-direction:column;gap:9px;min-width:0}
    .bt-hgrid>div>.bt-c{flex:1 1 auto;display:flex;flex-direction:column}
    .bt-hgrid>div>.bt-c>.bt-pgbody,.bt-hgrid>div>.bt-c>.bt-blist,.bt-hgrid>div>.bt-c>.bt-tgl{flex:1 1 auto}
    /* จอแคบ · 3 กรอบเรียงกันแล้วการ์ดโหมดถูกบีบจนชื่อขาด · ยกกรอบขวาลงมาเต็มแถวแทน
       ความสูงหัวที่เปลี่ยนไปไม่เป็นไร เพราะชั้นที่ตรึงวัดจากของจริงหลัง render */
    @media (max-width:1740px){
      .bt-hgrid{grid-template-columns:minmax(0,1.18fr) minmax(0,1fr)}
      .bt-hgrid>div:nth-child(3){grid-column:1 / -1}
      .bt-col3{flex-direction:row;align-items:stretch}
      .bt-col3>.bt-pair{flex:1 1 46%}
      .bt-col3>.bt-pair2{flex:1 1 54%}
    }
    @media (max-width:1150px){
      .bt-hgrid{grid-template-columns:minmax(0,1fr)}
      .bt-hgrid>div:nth-child(3){grid-column:auto}
      .bt-col3{flex-direction:column}
      .bt-pair,.bt-pair2{grid-template-columns:minmax(0,1fr)}
    }
    .bt-c{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:12px;overflow:hidden}
    /* §btTune · หัวการ์ดเคยดำเหมือนกันหมดสี่ใบ ตาต้องอ่านคำถึงจะรู้ว่ากรอบไหนเรื่องอะไร
       ให้สีประจำเรื่องไปเลย · ฟ้า=โปรแกรม แดง=เรือ ส้มแดง=ล็อคที่นั่ง ม่วง=Notice */
    .bt-ct{font-size:10px;font-weight:800;letter-spacing:.07em;color:#1F2124;text-transform:uppercase;
      padding:7px 11px 5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .bt-prog>.bt-ct,.bt-prog>.bt-ct .big{color:#12518F}
    .bt-boat>.bt-ct{color:#A32D2D}
    .bt-lockc>.bt-ct{color:#9A3B21}
    .bt-notice>.bt-ct{color:#5B289A}
    .bt-ct .big{font-size:13.5px;font-weight:800;letter-spacing:0;text-transform:none}
    .bt-ct .sp{margin-left:auto}
    .bt-cnt{background:#EFEBE7;color:#403833;border-radius:999px;padding:2px 9px;font-size:10.5px;font-weight:800;letter-spacing:0}
    .bt-cnt.over{background:#FBEAE7;color:#A32D2D}
    /* §btTune · พอชิปท่ามาอยู่แถวเดียวกัน ยอดรวมวันตกบรรทัด · .sp เดิมกินที่ว่าง
       ไปแล้วบรรทัดล่างจึงชิดซ้าย · ให้ยอดรวมดันตัวเองไปขวาไม่ว่าจะอยู่บรรทัดไหน */
    .bt-daytot{margin-left:auto;font-size:10.5px;color:#6b6660;font-weight:600;letter-spacing:0;text-transform:none;text-align:right;line-height:1.25}
    .bt-daytot b{font-family:'DM Mono',monospace;font-size:12.5px;font-weight:800;color:#3a3a36}
    .bt-daytot i{display:block;font-style:normal;font-family:'DM Mono',monospace;font-size:9.5px;color:#a3a099;font-weight:600}
    /* โปรแกรมวันนี้ */
    .bt-seg{display:inline-flex;border:1px solid #E0DBD5;border-radius:999px;overflow:hidden;background:#fff}
    .bt-seg-b{font-size:10px;font-weight:700;padding:3px 8px;color:#5b6472;background:transparent;border:none;cursor:pointer;font-family:inherit;letter-spacing:0;text-transform:none}
    .bt-seg-b.on{background:#22262e;color:#fff}
    .bt-clear{font-size:9.5px;font-weight:700;color:#A32D2D;background:#fff;letter-spacing:0;text-transform:none;
      border:1px solid #E6C9C3;border-radius:6px;padding:3px 7px;cursor:pointer;font-family:inherit}
    /* §btFix · ต่อไปทริปจะเยอะขึ้น · ถ้าปล่อยให้การ์ดยืดตามจำนวนทริป หัวจะสูงขึ้น
       เรื่อย ๆ แล้วกินพื้นที่ตารางไปหมด (แถมชั้นที่ตรึงต้องคำนวณใหม่ทุกครั้ง)
       ล็อกความสูงไว้ที่ราว 6 บรรทัด เกินนั้นไถในการ์ดเอง */
    /* §btTune · เว้นก้นกล่อง · ของเดิมแถวสุดท้ายชนขอบล่างพอดี ดูเหมือนโดนตัด */
    .bt-pgbody{padding-bottom:10px;overflow:auto;min-height:0;max-height:214px;scroll-padding-bottom:12px}
    .bt-tgl{max-height:196px}
    .bt-blist{max-height:196px;overflow:auto}
    .bt-pgf{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:8px;margin:0 8px 3px;
      box-shadow:inset 4px 0 0 var(--e);cursor:pointer}
    .bt-pgf.on{box-shadow:inset 4px 0 0 var(--e),0 0 0 1.5px var(--e)}
    .bt-pgf .ar{color:#a6a29b;font-size:10px}
    .bt-pgf .dot{width:9px;height:9px;border-radius:50%;background:var(--e);flex:none}
    .bt-pgf .nm{min-width:0;font-size:12.5px;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bt-pgf .n{font-family:'DM Mono',monospace;font-size:12.5px;font-weight:700;color:#4a4a45}
    .bt-pgf .sp{margin-left:auto;display:flex;gap:6px}
    .bt-tag{border-radius:6px;padding:1px 7px;font-size:9.5px;font-weight:700;white-space:nowrap}
    .bt-tag.run{background:#E6F5EC;color:#0F6E56}
    .bt-tag.no{background:#FBEDEA;color:#A32D2D}
    .bt-pgv{display:flex;align-items:center;gap:7px;padding:3px 10px 3px 24px;font-size:11px;color:#5b6472;
      margin:0 8px;white-space:nowrap;cursor:pointer;border-radius:7px}
    .bt-pgv:hover{background:#FAF8F5}
    .bt-pgv.on{background:#EFEAFB;box-shadow:inset 3px 0 0 #5B289A}
    .bt-pgv.off{opacity:.6;cursor:default}
    .bt-pgv .vn{flex:none;font-weight:700;color:#3a3a36}
    .bt-pgv .sp{margin-left:auto;display:flex;align-items:center;gap:6px;flex:none}
    .bt-seat{font-family:'DM Mono',monospace;font-size:11px;color:#8a8a82}
    .bt-seat b{color:#3a3a36;font-weight:800}
    .bt-lk{font-size:10px;font-weight:700;color:#8A5B00;background:#FBF0DA;border-radius:6px;padding:1px 6px}
    .bt-free{font-size:10px;font-weight:800;border-radius:6px;padding:1px 7px;white-space:nowrap}
    .bt-free.ok{background:#DCF4E8;color:#0C6B47}
    .bt-free.low{background:#FAEEDA;color:#854F0B}
    .bt-free.full{background:#FCEBEB;color:#A32D2D}
    .bt-free.none{background:#F1EFE8;color:#a3a099}
    .bt-none{padding:22px 14px;text-align:center;font-size:12px;color:#a8a49c}
    .bt-none2{display:block;padding:14px;text-align:center;font-size:11.5px;color:#a8a49c}
    /* เรือ */
    .bt-boat{border-left:4px solid var(--c)}
    .bt-boat .bt-ct{padding-bottom:2px}
    .bt-bnm{font-size:12.5px;font-weight:800;padding:2px 12px 6px;line-height:1.3}
    .bt-bnm span{display:block;font-size:10.5px;font-weight:600;color:#9b9088}
    .bt-avrow{display:flex;align-items:stretch;gap:0;padding:2px 8px 9px}
    .bt-av{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0}
    .bt-av .k{font-size:9.5px;color:#9b9088;font-weight:600;white-space:nowrap}
    .bt-av .v{font-family:'DM Mono',monospace;font-size:20px;font-weight:800;line-height:1.05;color:#3a3a36}
    .bt-av .v.dim{color:#b6b1a8}
    .bt-av .v.low{color:#854F0B}
    .bt-av .v.full{color:#A32D2D}
    .bt-av .v.lk{color:#A32D2D}
    .bt-avs{width:1px;background:#EFEBE5;margin:2px 0}
    .bt-blist{display:flex;flex-direction:column;gap:5px;padding:0 10px 10px}
    .bt-brow{display:flex;align-items:center;gap:8px;border:1.5px solid #E4E1DA;border-radius:10px;padding:5px 9px;background:#fff}
    .bt-brow.over{border-color:#F0BDB4;background:#FDF4F2}
    .bt-brow .d{width:10px;height:10px;border-radius:50%;flex:none}
    .bt-brow .nm{font-size:12.5px;font-weight:800;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .bt-brow .ld{font-family:'DM Mono',monospace;font-size:11.5px;font-weight:700;background:#F3EFEB;
      border-radius:7px;padding:2px 8px;color:#3a3a36;white-space:nowrap}
    .bt-brow.over .ld{background:#F7DCD7;color:#A32D2D}
    /* เรือ · ตอนยังไม่เลือกทริป */
    .bt-tgl{display:flex;flex-direction:column;padding:2px 10px 8px;overflow:auto;min-height:0}
    .bt-tgp{padding:7px 0 8px;border-bottom:1px dashed #EAE5DE;cursor:pointer}
    .bt-tgp:last-child{border-bottom:0}
    .bt-tgh{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    .bt-tgh i{width:9px;height:9px;border-radius:50%;background:var(--tc);flex:none}
    .bt-tgh .nm{font-size:12.5px;font-weight:800;color:var(--tc);line-height:1.2}
    .bt-tgh .tm{font-size:10px;color:#948f88;font-weight:600}
    .bt-tgh .sm{margin-left:auto;font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:#5b5b55;white-space:nowrap}
    .bt-tgh .sm em{font-style:normal;border-radius:5px;padding:1px 6px;margin-left:5px;font-weight:800}
    .bt-tgh .sm em.ok{background:#DCF4E8;color:#0C6B47}
    .bt-tgh .sm em.low{background:#FAEEDA;color:#854F0B}
    .bt-tgh .sm em.full{background:#FCEBEB;color:#A32D2D}
    .bt-tgb{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;padding-left:16px}
    .bt-tbc{display:inline-flex;align-items:center;gap:6px;border:1px solid #E6E2DB;border-radius:8px;
      padding:2px 8px;background:#fff;font-size:11px;font-weight:700;color:#3a3a36}
    .bt-tbc.over{border-color:#EFC5BD;background:#FDF4F2;color:#A32D2D}
    .bt-tbc.none{color:#a8a49c;font-weight:600;border-style:dashed}
    .bt-tbc i{width:7px;height:7px;border-radius:50%;flex:none}
    .bt-tbc s{text-decoration:none;font-family:'DM Mono',monospace;font-size:10.5px;font-weight:700;color:#8a857e}
    .bt-tbc.over s{color:#A32D2D}
    /* §ovnSpan · ลำที่ติดใบเหมาค้างเกาะ · ม่วง เหมือนสถานะในใบงานเรือ */
    .bt-brow .ld.ovn,.bt-tbc s.ovn{background:#F2EBFA;color:#5B3B96;font-weight:700;
      border-radius:6px;padding:1px 7px;font-family:inherit;letter-spacing:0}
    /* §ovnRow · แถวใบเหมาที่คาอยู่ระหว่างทาง · ไม่มีใครขึ้นเรือวันนี้ */
    .t2-ovnh{display:inline-block;background:#F2EBFA;color:#5B3B96;font-weight:800;font-size:11px;
      border-radius:7px;padding:2px 8px;font-family:inherit;white-space:nowrap}
    .t2-ovnh2{display:block;margin-top:3px;font-size:10px;color:#8b86a8;font-family:inherit;
      font-weight:600;white-space:nowrap}
    /* §btGap · ช่องว่างคั่นกลุ่มเหมาลำออกจากกลุ่มลูกค้าจอย */
    .t2-zgap td{height:26px;padding:0;border:0;background:transparent}
    /* §btChBand · ชิปเรือบนแถบเหมาลำ */
    .t2-zband-ch .zboats{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap;margin-left:10px}
    .t2-zband-ch .zb{display:inline-flex;align-items:center;gap:7px;background:#F4EFFC;
      border:1px solid #DDD0F2;border-radius:9px;padding:3px 10px;font-size:11.5px;white-space:nowrap}
    .t2-zband-ch .zb b{color:#5B289A;font-weight:800}
    .t2-zband-ch .zb i{font-style:normal;background:#EBE2FA;color:#5B289A;border-radius:4px;
      padding:0 5px;font-size:9px;font-weight:800}
    .t2-zband-ch .zb s{text-decoration:none;color:#7A6FA8;font-family:'DM Mono',monospace}
    .bt-tgfoot{padding:6px 12px 8px;border-top:1px solid #F2EEE9;font-size:10px;color:#948f88;text-align:center}
    /* §btTune · ไกด์ / อาหาร / เรือหางยาว · ของที่ต้องสั่งล่วงหน้า ควรเห็นตั้งแต่เปิดหน้า */
    .bt-prep{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px 10px 9px;
      border-top:1px dashed #EAE5DE;margin-top:auto}
    .bt-prep .l{font-size:8.5px;font-weight:800;letter-spacing:.08em;color:#a09a92;text-transform:uppercase;flex:none}
    .bt-pc{font-size:9.5px;font-weight:700;border-radius:5px;padding:1px 7px;white-space:nowrap}
    /* โหมด + ค้นหา */
    .bt-col3{display:flex;flex-direction:column;gap:9px}
    .bt-pair{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:9px;align-items:stretch;flex:none}
    .bt-pair>.bt-c{display:flex;flex-direction:column}
    .bt-pair>.bt-c>.bt-mrow,.bt-pair>.bt-c>.bt-srow{flex:1 1 auto;align-items:stretch}
    .bt-pair2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:9px;align-items:stretch;flex:1 1 auto}
    .bt-pair2>.bt-c{display:flex;flex-direction:column}
    .bt-pair2>.bt-c>.bt-lkl,.bt-pair2>.bt-c>.bt-ncb{flex:1 1 auto}
    .bt-mrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr);gap:6px;padding:9px 10px 10px}
    .bt-mc{position:relative;border:1.5px solid #E4DEDA;border-radius:11px;padding:8px 9px 8px 12px;
      display:flex;align-items:center;gap:6px;background:#fff;overflow:hidden;--mc:#8a8078;
      cursor:pointer;font-family:inherit;text-align:left}
    .bt-mc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--mc)}
    .bt-mc .tx{display:flex;flex-direction:column;min-width:0}
    .bt-mc .t{font-size:12.5px;font-weight:800;line-height:1.2;color:#1F2124;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bt-mc .s{overflow:hidden;text-overflow:ellipsis}
    .bt-mc .s{font-size:9.5px;color:#8a7f78;white-space:nowrap;margin-top:1px}
    .bt-mc .n{margin-left:auto;flex:none;font-family:'DM Mono',monospace;font-size:14px;font-weight:800;
      line-height:1;border-radius:8px;padding:5px 7px;background:#F3EFEB;color:#5a504a}
    .bt-mc.warn .n{background:#FBEFD8;color:#8A5B00}
    .bt-mc.ok .n{background:#E4F3EA;color:#0F6E56;font-size:13px}
    .bt-mc.on{background:var(--mc);border-color:var(--mc);box-shadow:0 2px 7px rgba(0,0,0,.16)}
    .bt-mc.on::before{background:rgba(255,255,255,.55)}
    .bt-mc.on .t{color:#fff}
    .bt-mc.on .s{color:rgba(255,255,255,.86)}
    .bt-mc.on .n{background:rgba(255,255,255,.2);color:#fff}
    .bt-mc.dis{opacity:.45;cursor:not-allowed}
    .bt-mc .x{margin-left:5px;flex:none;width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.22);
      color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:800}
    /* §btTune · การ์ดที่เปิดอยู่มีปุ่มกากบาทเพิ่มมา ชื่อโหมดเลยถูกบีบจนขาด ("V…")
       สีทึบกับกากบาทบอกอยู่แล้วว่ากำลังใช้โหมดนี้ · ซ่อนคำบรรยายใต้ชื่อตอนเปิด */
    .bt-mc.on .s{display:none}
    .bt-mc.on .t{font-size:13px}
    .bt-srow{display:flex;gap:7px;padding:9px 10px 10px;align-items:stretch}
    .bt-sbox{flex:1;display:flex;align-items:center;gap:7px;border:1px solid #E4DCD5;border-radius:10px;
      padding:4px 10px;background:#fff;min-width:0}
    .bt-sbox .ic{font-size:12px;color:#a49c94;flex:none}
    .bt-sbox input{flex:1;min-width:0;border:none;outline:none;background:transparent;font-family:inherit;
      font-size:12.5px;color:#22262e;padding:4px 0}
    .bt-sbox .clr{border:none;background:transparent;color:#a49c94;font-size:15px;cursor:pointer;line-height:1;padding:0 2px;font-family:inherit}
    .bt-shit{flex:none;align-self:center;font-size:10.5px;font-weight:800;color:#0C447C;background:#E7EEFA;border-radius:7px;padding:4px 9px;white-space:nowrap}
    /* Seat Lock */
    .bt-lkbadge{font-size:10.5px;font-weight:800;color:#fff;background:#C0392B;border-radius:7px;padding:2px 9px;letter-spacing:0}
    .bt-lkbtn{font-size:10.5px;font-weight:700;border-radius:7px;padding:3px 10px;border:1px solid #BFE3CC;
      background:#fff;color:#0F6E56;cursor:pointer;font-family:inherit;letter-spacing:0}
    .bt-lkbtn.gh{border-color:#E2D9D2;color:#5b6472}
    .bt-lkl{display:flex;flex-direction:column;padding:0 8px 8px;gap:2px;overflow:auto;min-height:0;max-height:101px}
    .bt-lkr{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:8px;background:#fff;
      border:1px solid #EFE6E1;cursor:pointer}
    .bt-lkr:nth-child(even){background:#FDFBF9}
    .bt-lkr.done{border-color:#E8E4DD;background:#FAF9F6}
    .bt-lkr.gone{border-color:#EEEBE5;background:#FAF9F6;opacity:.72}
    .bt-lkr>i{width:8px;height:8px;border-radius:50%;flex:none;background:#C0392B}
    .bt-lkr.done>i{background:#C9C6BE}
    .bt-lkr.gone>i{background:#DAD6CE}
    .bt-lkr .nm{font-size:11.5px;font-weight:700;color:#3a3a36;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .bt-lkr.done .nm,.bt-lkr.gone .nm{color:#8f8a82;font-weight:600}
    .bt-lkr .q{flex:none;display:flex;align-items:baseline;gap:4px;font-family:'DM Mono',monospace}
    .bt-lkr .q b{font-size:15px;font-weight:800;color:#A32D2D;line-height:1}
    .bt-lkr.done .q b{color:#9b9088}
    .bt-lkr .q s{text-decoration:none;font-size:10px;color:#9b9088;font-weight:600}
    .bt-lkr .sub{flex:none;font-size:9.5px;font-weight:800;border-radius:5px;padding:1px 6px;background:#EEEDFE;color:#534AB7}
    .bt-lkr .mg{flex:none;border:none;background:transparent;color:#a89a9a;font-size:12px;line-height:1;
      padding:2px 3px;cursor:pointer;font-family:inherit;border-radius:5px}
    .bt-lkr .mg:hover{background:#F2ECE8;color:#5b5b55}
    .bt-lkr.on{border-color:#C0392B;background:#FDF1EF;box-shadow:0 0 0 1.5px #C0392B33}
    .bt-lkhi{font-size:10px;font-weight:800;color:#fff;background:#C0392B;border-radius:6px;padding:2px 8px;letter-spacing:0}
    .bt-lkfoot{padding:5px 12px 8px;font-size:10px;color:#8a8078;border-top:1px solid #F2ECE8;
      display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .bt-lkfoot b{color:#3a3a36;font-family:'DM Mono',monospace}
    .bt-lkfoot .scr{font-size:9.5px;font-weight:800;color:#7A2B18;background:#FBEFEC;border-radius:5px;padding:1px 7px}
    .bt-lkfoot .hint{margin-left:auto;font-size:9.5px;color:#a89a9a;white-space:nowrap}
    /* Notice */
    .bt-notice{border-left:4px solid #6D28D9}
    /* ══ §btVanCard · การ์ดรถในโหมดจัดรถ ═══════════════════════════════════
       กรอบทั้งใบเป็นสีเข้ม ไม่ใช่ขีดข้างเดียว · ตอนติ๊กแถวเปลี่ยนทั้งใบเป็นน้ำเงิน */
    .bt-vans{flex:1 1 auto;display:flex;flex-direction:column;border:2px solid #0F6E56;
      max-height:268px;min-height:0;overflow:hidden;
      box-shadow:0 0 0 2px rgba(15,110,86,.14);transition:border-color .15s,box-shadow .15s}
    .bt-vans>.bt-ct,.bt-vans>.bt-vgrp{flex:none}
    .bt-vans>.bt-ct{color:#0C6B47;background:#F1FBF6;border-bottom:1px solid #DFF0E8}
    .bt-vans.act{border-color:#185FA5;box-shadow:0 0 0 3px rgba(24,95,165,.28)}
    .bt-vans.act>.bt-ct{color:#12518F;background:#EEF5FC;border-bottom-color:#D8E6F5}
    /* §btVanFit · ชิปรถกว้างพอดีเนื้อหา ไม่ใช่ยืดเต็มช่อง
       ของเดิมบังคับตาราง 3 คอลัมน์ ชิปจึงถูกยืดเป็น 1/3 ของการ์ดทุกใบ
       ทั้งที่เนื้อหากว้างราว 130px แต่ช่องกว้าง 443px = เหลือที่ว่างใบละ ~310px
       และพอรถไม่พอดี 3 ช่อง ก็ต้องขึ้นแถวใหม่ทั้งที่ยังมีที่เหลือเต็มไปหมด
       เปลี่ยนเป็นเรียงต่อกันแล้วตกบรรทัดเอง · คันที่รับหลายโซนกว้างขึ้นได้ตามจริง
       วัดวันที่ 21 ก.ค. (16 คัน 3 ทริป) แถวชิป 7 แถว -> 3 แถว */
    .bt-vgrid{display:flex;flex-wrap:wrap;gap:5px;
      padding:7px 9px 8px;overflow-y:auto;overflow-x:hidden;min-height:56px;max-height:196px;
      flex:1 1 auto;align-content:flex-start;overscroll-behavior:contain}
    .bt-vgrid::-webkit-scrollbar{width:8px}
    .bt-vgrid::-webkit-scrollbar-thumb{background:#CFE3D8;border-radius:4px}
    .bt-vgrid>*{min-width:0;max-width:100%}
    .bt-vtrip{flex:1 0 100%;display:flex;align-items:center;gap:7px;padding:3px 2px 1px}
    .bt-vtrip i{width:8px;height:8px;border-radius:50%;flex:none}
    .bt-vtrip b{font-size:10.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bt-vtrip span{font-size:9px;color:#948f88;font-weight:600;white-space:nowrap}
    .bt-vgrp{border-top:1px solid #E4EFE9}
    /* แถบ Grouping เดิมสูง 44px ตายตัว · ในการ์ดให้ยืดตามเนื้อหาและตัดขอบซ้ายทิ้ง */
    .bt-vgrp>div{height:auto !important;min-height:46px;padding:6px 10px !important;
      border-top:0 !important;flex-wrap:nowrap !important;overflow-x:auto !important;
      overflow-y:hidden !important;overscroll-behavior:contain}
    .bt-vgrp>div+div{border-top:1px dashed #E4EFE9 !important}
    /* ป้ายชื่อทริปเหนือแถบจับกลุ่ม · โผล่เฉพาะตอนติ๊กข้ามทริปจนมีหลายแถบ */
    .bt-vgrpt{display:flex;align-items:center;gap:6px;padding:6px 11px 0;font-size:10px}
    .bt-vgrpt i{width:7px;height:7px;border-radius:50%;flex:none}
    .bt-vgrpt b{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bt-vgrpt em{font-style:normal;font-size:9px;color:#8d97a4;font-weight:600;flex:none}
    .bt-vgrp>div+.bt-vgrpt{border-top:1px dashed #D8E6F5;margin-top:3px}
    /* §btTune · Notice เล็กลงทั้งบล็อก · เป็นของที่อ่านผ่าน ๆ ไม่ใช่ตัวเลขที่ต้องเพ่ง */
    .bt-ncb{display:flex;flex-direction:column;gap:4px;padding:2px 9px 8px;overflow:auto;min-height:0}
    .bt-nc{display:flex;gap:7px;border-radius:8px;padding:5px 8px;font-size:10.5px;line-height:1.4}
    .bt-nc .i{flex:none;font-weight:800}
    .bt-nc i{display:block;font-style:normal;font-size:9.5px;color:#7a8087;font-weight:400;margin-top:1px}
    .bt-nc.warn{background:#FDF6E9;color:#7A4A00}
    .bt-nc.ok{background:#F0F9F4;color:#0F6E56}
    /* แถบเตือนเดิมสองตัวถูกยกมาไว้ในการ์ด Notice · บีบให้พอดีกล่อง */
    /* §btUnit · แถบเตือนเดิมเป็นชมพูแดง · ในการ์ด Notice มันเป็นบล็อกสีเดียวที่หลุด
       จากโทนของการ์ด (เหลือง=ต้องทำ / เขียว=ทำแล้ว) · ปรับให้เข้าชุดกัน
       สีแดงสงวนไว้ให้เรื่องที่แก้ไม่ได้แล้ว เช่น เรือเกินความจุ */
    .bt-ncb .t2-hd-warn{margin:0;padding:5px 8px;border-radius:8px;flex-wrap:wrap;gap:5px;
      background:#FDF6E9;border-color:#EBD9B4}
    .bt-ncb .t2-hd-warntxt{font-size:10px}
    .bt-ncb .t2-hd-warnchip{font-size:9.5px;padding:2px 7px}
    .bt-ncb .t2-hd-warnchip b{font-size:10px}
    .bt-ncb > div[style*="F1F8F5"]{padding:4px 8px !important;gap:5px !important}
    .bt-ncb > div[style*="F1F8F5"] span{font-size:10px !important}
    .bt-ncb > div[style*="F1F8F5"] button{font-size:9.5px !important;padding:2px 7px !important}
    .bt-ncb .t2-hd-warnico{color:#B4560A}
    .bt-ncb .t2-hd-warntxt{color:#7A4A00}
    .bt-ncb > div[style*="F1F8F5"]{margin-top:0 !important}
  </style>`;

  /* §btOther · คำนวณก่อน mainBody · ข้อความ "ไม่มีทริป" ต้องรู้ว่าข้างล่างมีใบหรือไม่ */
  const _btOther = _btOtherSection(date, rowsF, _otherRids);
  const mainBody = emptyMain
    ? `<div class="bkv2-empty"><div class="ttl">${(_btOther?'No boat trips':'No trips')}${(pierF!=='all'||routeF)?' match this filter':` on ${bookingV2FmtDate(date)}`}</div><div class="sub">${(pierF!=='all'||routeF)?'Clear the filter or':'Pick another day in the calendar or use the arrows'}${(pierF!=='all'||routeF)?' pick another day':''}</div></div>`
    /* §btOther · อยู่ ข้างใน .t2-wrap ไม่ใช่ต่อท้าย · §btScroll ทำให้กล่องนี้เป็นตัวเลื่อนเดียวของหน้า
       แล้วดึงส่วนที่เกินจอกลับด้วย margin-bottom ติดลบเท่ากับส่วนที่เกิน
       ต่อท้ายกล่อง = เพิ่มความสูงหน้า → margin ติดลบโตขึ้นตาม → ดึงตัวเองขึ้นไปทับตาราง
       (กรณีไม่มีทริปเลย ไม่มี .t2-wrap · โค้ด §btScroll ข้ามไป ต่อท้ายจึงปลอดภัย) */
    : `<div class="t2-wrap">${trips}${_btOther}</div>`;
  void sidebar;
  /* §btHead · ตัวกรองท่า/โปรแกรมย้ายไปอยู่ในการ์ด "โปรแกรมวันนี้" แล้ว · แถบเดิมจึงไม่ถูกใช้ */
  void filterBar;
  /* §btGap · สีของหัวต้องคุมทั้งหน้า ไม่ใช่แค่แถบหัว · ตั้งตัวแปรที่กรอบนอกสุด
     แล้วทั้งหัวและพื้นหลังใต้ตารางใช้ค่าเดียวกัน เปลี่ยนโปรแกรมก็เปลี่ยนพร้อมกันทั้งหน้า */
  const _hdr = vanMode ? header.replace('<!--BTVANCARD-->', _btVanCard) : header;
  return style + `<div class="t2-shell" style="--btband:${_btBand};--btbandb:${_btBandB}"><div class="t2-main">${_hdr}${mainBody}${(emptyMain?_btOther:'')}</div></div>`;
}
