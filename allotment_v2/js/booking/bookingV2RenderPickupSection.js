// ── Render sub-sections ──
function bookingV2RenderPickupSection(){
  const d = _bkV2.newBooking;
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  // Group areas by zone
  const grouped = {};
  (SB_PICKUP_AREAS||[]).forEach(a => {
    if(!grouped[a.zone]) grouped[a.zone] = [];
    grouped[a.zone].push(a);
  });
  const zoneLabel = z => laZoneLabel(z);                  /* §rnZone */
  // Flat list for datalist · prefix area name with zone label
  const areaFlat = LA_PICKUP_ZONES.filter(z => grouped[z]?.length).flatMap(z => grouped[z].map(a => ({ id:a.id, label:`[${zoneLabel(z)}] ${a.name}` })));
  const areaDataList = areaFlat.map(o => `<option value="${escapeHTML(o.label)}"></option>`).join('');
  const labelFromId = (aid) => {
    if(!aid) return '';
    const a = bookingV2GetArea(aid);
    if(!a) return '';
    return `[${zoneLabel(a.zone)}] ${a.name}`;
  };
  const pickupLabel = labelFromId(d.pickupAreaId);
  const dropoffLabel = labelFromId(d.dropoffAreaId);
  const area = bookingV2GetArea(d.pickupAreaId);
  // Private Van → real hotel pickup (NOT self-arrive) even though the SEAT is No-Transfer
  const _hasPrivVan = (d.trips||[]).some(t => bookingV2TripPrivateVan(d, t));
  const _pickIsNT = !_hasPrivVan && ((area && (area.zone==='NoTransfer'||area.zone==='NT')) || d.pickupZoneFilter==='NoTransfer');
  const dropoffArea = bookingV2GetArea(d.dropoffAreaId);

  // Per-trip pickup time table
  let pickupTimeRows = '';
  if(area && d.trips.some(t => t.routeId)){
    pickupTimeRows = d.trips.filter(t => t.routeId).map((t, idx) => {
      const autoTime = bookingV2GetPickupTime(t.routeId, d.pickupAreaId, t.date);
      const displayTime = t.pickupTime || autoTime || '';
      const isEdited = t.pickupTimeEdited;
      const routeName = (typeof ROUTES!=='undefined' && ROUTES.find(r=>r.id===t.routeId)?.name) || t.routeId;
      const tripIdx = d.trips.indexOf(t);
      return `
        <tr>
          <td style="padding:6px 0;font-family:'DM Mono',monospace;font-size:10px;color:var(--ink-soft)">${t.date?(typeof bkNbfDMY==='function'?bkNbfDMY(t.date):t.date):'—'}</td>
          <td style="padding:6px 8px;font-size:11px">${escapeHTML(routeName)}</td>
          <td style="padding:6px 0;text-align:right">
            <input type="text" value="${escapeHTML(displayTime)}" style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--bk-navy);background:transparent;border:1px solid transparent;border-radius:3px;padding:3px 6px;width:120px;text-align:right" onchange="bookingV2SetTripPickupTime(${tripIdx}, this.value)" placeholder="—">
            ${displayTime ? (isEdited
              ? `<span style="background:#FAEEDA;color:#633806;font-size:8px;padding:1px 5px;border-radius:3px;font-weight:600;margin-left:4px">EDITED</span> <button onclick="bookingV2ResetTripPickupTime(${tripIdx})" style="background:none;border:none;color:var(--ink-soft);font-size:9px;cursor:pointer;text-decoration:underline">reset</button>`
              : `<span style="background:#E1F5EE;color:#0F6E56;font-size:8px;padding:1px 5px;border-radius:3px;font-weight:600;margin-left:4px">AUTO</span>`) : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  return `
    <div class="nbf-pk4">
    <!-- Row 1: ZONE pills (left, narrow) + PICKUP AREA input (right, filtered) -->
    <div class="bkv2-nb-row" style="grid-template-columns:auto minmax(0,1fr)">
      <div class="bkv2-nb-field">
        <label class="bkv2-nb-label">Zone <em style="font-weight:500;color:#b4b2a9;font-style:normal">· from trip above</em></label>
        ${(() => {
          const tripsZones = [...new Set((d.trips||[]).filter(t => t.zone).map(t => bookingV2EffZone(d, t)))];   // private van → its pickup zone, not the No-Transfer seat
          const effectiveZone = tripsZones[0] || d.pickupZoneFilter || 'PK';
          const zoneLbl = (z) => laZoneLabel(z);           /* §rnZone */
          const mixed = tripsZones.length > 1;
          return `<div style="padding:0 12px;background:#F7F7F5;border:1.5px solid #ECEBE6;border-radius:10px;font-size:13.5px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:7px;height:38px;box-sizing:border-box;white-space:nowrap">
            <span style="flex:1">${zoneLbl(effectiveZone)}${mixed?` <span style="font-size:9px;color:#a32d2d;font-weight:600;margin-left:4px">⚠ trips have mixed zones</span>`:''}</span>
          </div>`;
        })()}
      </div>
      <div class="bkv2-nb-field">
        <label class="bkv2-nb-label">Pickup area * <em style="font-weight:500;color:#b4b2a9;font-style:normal">· type to search</em></label>
        ${(d.pickupZoneFilter==='NoTransfer' && d.pickupAreaId)
          ? `<div style="padding:0 12px;background:#DDF1EA;border:1.5px solid #DDF1EA;border-radius:10px;font-size:13px;color:#0B5A43;font-weight:600;height:38px;display:flex;align-items:center;gap:8px;box-sizing:border-box"><span style="font-size:11px">✓ AUTO</span><span style="font-family:'DM Mono',monospace;font-size:11px">${escapeHTML(pickupLabel)}</span></div>`
          : `<div class="bkv2-nb-ddwrap">
              <input id="bkv2-area-input-pickup" class="bkv2-nb-input" type="text" placeholder="Type or pick an area..." value="${escapeHTML(pickupLabel)}" autocomplete="off" oninput="bookingV2AreaDDFilter('pickup', this.value)" onfocus="bookingV2AreaDDShow('pickup')" onkeydown="bookingV2AreaDDKey(event, 'pickup')">
              <div id="bkv2-area-dd-pickup" class="bkv2-nb-dd"></div>
            </div>`}
      </div>
    </div>
    ${area ? `
      <!-- Row 2: Hotel / Pickup Location (wider) + Room # (narrower) on same line -->
      <div class="bkv2-nb-row" style="grid-template-columns:minmax(0,2.2fr) minmax(0,1fr)">
        <div class="bkv2-nb-field">
          <label class="bkv2-nb-label">${_pickIsNT?`Note <em style="font-weight:500;color:#b4b2a9;font-style:normal">· optional · self-arrival</em>`:`Hotel / Pickup Location`}</label>
          <div class="bkv2-nb-ddwrap" style="position:relative">
            <input id="bkv2-hotel-input" class="bkv2-nb-input" type="text" autocomplete="off" placeholder="${_pickIsNT?'optional note · guest arrives on their own':'e.g. Thavorn Beach Village · Patong main road · etc.'}" value="${escapeHTML(d.hotelName||'')}" oninput="bookingV2HotelDDFilter(this.value)" onfocus="bookingV2HotelDDShow()" onkeydown="bookingV2HotelDDKey(event)">
            <div id="bkv2-hotel-dd" class="bkv2-nb-dd"></div>
          </div>
        </div>
        <div class="bkv2-nb-field">
          <label class="bkv2-nb-label">Room #</label>
          <input class="bkv2-nb-input" type="text" placeholder="A-205" value="${escapeHTML(d.roomNumber||'')}" oninput="bookingV2SetBookingField('roomNumber', this.value)">
        </div>
      </div>
      ${pickupTimeRows ? `<div style="grid-column:1/-1;margin-top:10px;display:flex;flex-direction:column;gap:4px"><div style="font-size:11.5px;font-weight:600;color:#3E4658">Pickup time <span style="font-weight:400;color:#5B6170">&middot; per trip &middot; type over it if another time was agreed</span></div>
            ${d.trips.filter(t => t.routeId).map(t => {
              const autoTime = bookingV2GetPickupTime(t.routeId, d.pickupAreaId, t.date);
              const displayTime = t.pickupTime || autoTime || '';
              const isEdited = t.pickupTimeEdited;
              const routeName = (typeof ROUTES!=='undefined' && ROUTES.find(r=>r.id===t.routeId)?.name) || t.routeId;
              if(!displayTime && !t.date) return '';
              return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#F7F7F5;border:1px solid #ECEBE6;border-radius:9px;font-size:12.5px">
                <span style="font-family:'DM Mono',monospace;color:var(--ink-soft);min-width:80px">${t.date ? (typeof bkNbfDMY==='function'?bkNbfDMY(t.date):t.date) : '—'}</span>
                <span style="order:-1;flex:1;color:var(--ink);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(routeName)}</span>
                <input type="text" value="${escapeHTML(displayTime)}" placeholder="—" onchange="bookingV2SetTripPickupTime(${d.trips.indexOf(t)}, this.value)" style="width:136px;height:30px;box-sizing:border-box;text-align:center;font-family:'DM Mono',monospace;font-size:14px;font-weight:500;color:#0F1B3D;background:#fff;border:1.5px solid #C9CCD6;border-radius:8px;padding:0 6px">
                ${displayTime ? `<span style="background:${isEdited?'#FBEBD3':'#DDF1EA'};color:${isEdited?'#7A4300':'#0B5A43'};font-size:9px;padding:1px 7px;border-radius:5px;font-weight:700;letter-spacing:.06em">${isEdited?'EDITED':'AUTO'}</span>` : ''}
                ${isEdited ? `<button type="button" onclick="bookingV2ResetTripPickupTime(${d.trips.indexOf(t)})" style="border:none;background:none;color:#0F6CA6;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;padding:0;white-space:nowrap">Reset to auto</button>` : ''}
              </div>`;
            }).join('')}
          </div>` : ''}
    ` : ''}
    </div>
    <!-- Pickup time table moved inline under Hotel/Pickup Location · per request -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:12px">
    <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:${d.pickupSelf?'#E8F3FB':'#fff'};border:1.5px solid ${d.pickupSelf?'#1272B3':'#C9CCD6'};border-radius:10px;cursor:pointer">
      <input type="checkbox" ${d.pickupSelf?'checked':''} onchange="bookingV2TogglePickupSelf()" style="accent-color:#16265C;width:16px;height:16px;margin:2px 0 0;flex:none">
      <span style="font-size:13px;color:${d.pickupSelf?'#0B4F7A':'var(--ink)'};font-weight:600">&#128694; ขารับ: ลูกค้ามาเองที่ท่าเรือ (self-arrive · เก็บเรทเต็ม)<span style="display:block;font-size:12px;font-weight:400;color:#5B6170;margin-top:1px">No van on the way out &middot; the full rate still applies</span></span>
    </label>
    <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:${d.dropoffSame?'#E8F3FB':'#fff'};border:1.5px solid ${d.dropoffSame?'#1272B3':'#C9CCD6'};border-radius:10px;cursor:pointer">
      <input type="checkbox" ${d.dropoffSame?'checked':''} onchange="bookingV2ToggleDropoffSame()" style="accent-color:#16265C;width:16px;height:16px;margin:2px 0 0;flex:none">
      <span style="font-size:13px;color:${d.dropoffSame?'#0B4F7A':'var(--ink)'};font-weight:600">Drop-off same as pickup<span style="display:block;font-size:12px;font-weight:400;color:#5B6170;margin-top:1px">Untick to choose another area and location for the way back</span></span>
    </label>
    ${(d.pickupSelf && (d.hotelName||'').trim())?`<div style="grid-column:1/-1;padding:8px 12px;background:#FBE3E0;border-radius:10px;font-size:12.5px;color:#8E2019;line-height:1.45">&#9888; ติ๊ก self-arrive (ลูกค้ามาเอง) แต่กรอกโรงแรม "<b>${escapeHTML(d.hotelName)}</b>" ไว้ — booking นี้จะ<b>ไม่ขึ้นในใบงานรถขาไป</b> · ถ้าลูกค้าให้ไปรับที่โรงแรม อย่าติ๊กช่องนี้</div>`:''}
    </div>
    ${!d.dropoffSame ? `
      <div class="bkv2-nb-row" style="margin-top:10px;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr)">
        <div class="bkv2-nb-field">
          <label class="bkv2-nb-label">Drop-off area <em style="font-weight:500;color:#b4b2a9;font-style:normal">· zone</em></label>
          <div class="bkv2-nb-ddwrap">
            <input id="bkv2-area-input-dropoff" class="bkv2-nb-input" type="text" placeholder="Type or pick an area..." value="${escapeHTML(dropoffLabel)}" autocomplete="off" oninput="bookingV2AreaDDFilter('dropoff', this.value)" onfocus="bookingV2AreaDDShow('dropoff')" onkeydown="bookingV2AreaDDKey(event, 'dropoff')">
            <div id="bkv2-area-dd-dropoff" class="bkv2-nb-dd"></div>
          </div>
        </div>
        <div class="bkv2-nb-field">
          <label class="bkv2-nb-label">Drop-off Location</label>
          <input class="bkv2-nb-input" type="text" placeholder="e.g. Airport · Hotel name · Patong main road" value="${escapeHTML(d.dropoffHotelName||'')}" oninput="bookingV2SetBookingField('dropoffHotelName', this.value)">
        </div>
      </div>
    ` : ''}
    ${(() => {
      // §altPickups · รับหลายจุดในบุคกิ้งเดียว (บางคนรับคนละที่กับ pickup หลัก)
      // แถวละ: เลือกชื่อ → เลือกจุดรับ (Pickup area · โซนเด้ง auto) → ใส่ชื่อ Location
      const alt = Array.isArray(d.altPickups) ? d.altPickups : [];
      const _zShort = z => laZoneLabel(z);                 /* §rnZone */
      // dropdown จุดรับ · จัดกลุ่มตามโซน (แหล่งเดียวกับ Pickup area หลัก)
      const areaOptGroups = LA_PICKUP_ZONES.filter(z=>grouped[z]&&grouped[z].length)
        .map(z=>`<optgroup label="${zoneLabel(z)}">${grouped[z].map(ar=>`<option value="${ar.id}">${escapeHTML(ar.name)}</option>`).join('')}</optgroup>`).join('');
      // รายชื่อจากส่วน Guests (lead + passengers ที่มีชื่อ) · ให้เลือก (พิมพ์เองได้ด้วย เช่น "2 คน")
      const guestNames = [...new Set([d.leadPax, ...((d.passengers)||[]).map(p=>p&&p.name)].map(s=>String(s||'').trim()).filter(Boolean))];
      const nameOpts = guestNames.map(n=>`<option value="${escapeHTML(n)}"></option>`).join('');
      // headcount ของกลุ่ม = ทริปที่คนเยอะสุด (แขกเป็นกลุ่มเดียวข้ามทริป) · ใช้คำนวณจำนวนที่จุดรับหลัก
      const _hc = (d.trips||[]).reduce((m,t)=>Math.max(m,(typeof bookingV2PaxAllTot==='function'?bookingV2PaxAllTot(t.pax||{}):0)),0);
      const _altTot = alt.reduce((s,a)=>s+bkPaxSum(bkAltPax(a)),0);
      const _mainQty = _hc - _altTot;
      // ยอดของบุ๊กกิ้งแยกประเภท (ทริปที่คนเยอะสุด) → เอาไว้เช็คว่าแยกเด็ก/ทารกเกินที่มีจริงไหม
      let _bkBd={ad:0,chd:0,inf:0,foc:0};
      (d.trips||[]).forEach(t=>{ const p=bkPaxOfTrip(t); if(bkPaxSum(p)>bkPaxSum(_bkBd)) _bkBd=p; });
      const _altBd = alt.reduce((acc,a)=>bkPaxAdd(acc,bkAltPax(a)), {ad:0,chd:0,inf:0,foc:0});
      const _mainBd = bkPaxSub(_bkBd,_altBd);
      const _badK = PAX_K.filter(k=>_altBd[k] > _bkBd[k]);   // แยกประเภทไหนเกินยอดที่มีจริง
      const _over = (_hc>0 && _altTot>_hc) || _badK.length>0;
      /* §altDrop · เพิ่มคอลัมน์จุดส่ง · แถวนี้คุมทั้งฝั่งรับและฝั่งส่งแล้ว */
      const _gcols = 'minmax(0,0.86fr) 190px minmax(0,1fr) minmax(0,1fr) minmax(0,1.12fr) auto';
      const rows = alt.map((a,i) => {
        const _ar = a.areaId ? bookingV2GetArea(a.areaId) : null;
        const _zone = _ar ? _ar.zone : '';
        const _areaSel = areaOptGroups.replace(`<option value="${a.areaId}">`, `<option value="${a.areaId}" selected>`);
        const zoneChip = _zone
          ? `<div style="margin-top:3px"><span style="font-size:9px;font-weight:700;color:#23335F;background:#EEF1F8;padding:1px 7px;border-radius:4px">โซน ${_zShort(_zone)} · auto</span></div>`
          : `<div style="margin-top:3px;font-size:9px;color:#b4b2a9;font-style:italic">เลือกจุดรับ → โซนมาอัตโนมัติ</div>`;
        return `
        <div class="bkv2-nb-row bkv2-alt-row" style="grid-template-columns:${_gcols};align-items:start;gap:7px;margin-top:6px">
          <input class="bkv2-nb-input" list="bkv2-altpick-names" type="text" placeholder="เลือก/พิมพ์ชื่อ" value="${escapeHTML(a.who||'')}" oninput="bookingV2SetAltPickup(${i},'who',this.value)">
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px">${PAX_K.map(k=>{const _v=bkAltPax(a)[k]; const _bad=_altBd[k]>_bkBd[k]; return `<input class="bkv2-nb-input bkv2-pax-box" type="number" min="0" step="1" value="${_v}" onchange="bookingV2SetAltPickupPax(${i},'${k}',this.value)" title="${PAX_LBL[k]} ที่จุดนี้ (กลุ่มนี้มีทั้งหมด ${_bkBd[k]})"${_bad?' style="border-color:#E0857E;background:#FDECEA"':(_v?'':' style="color:#c4c1b8"')}>`;}).join('')}</div>
          <div>
            <select class="bkv2-nb-input" onchange="bookingV2SetAltPickupArea(${i},this.value)" style="cursor:pointer"><option value="">— เลือกจุดรับ —</option>${_areaSel}</select>
            ${zoneChip}
          </div>
          <input class="bkv2-nb-input" type="text" placeholder="ชื่อโรงแรม / Location" value="${escapeHTML(a.place||'')}" oninput="bookingV2SetAltPickup(${i},'place',this.value)">
          ${(() => {
            /* §altDrop · ติ๊กไว้ = ส่งที่เดิม = พฤติกรรมเดิมทุกอย่าง ของเก่าไม่กระทบ
               เอาติ๊กออกถึงจะมีจุดส่งของตัวเอง */
            const _same = (a.dropSame !== false);
            const _dar  = a.dropAreaId ? bookingV2GetArea(a.dropAreaId) : null;
            const _dz   = _dar ? _dar.zone : '';
            const _dsel = areaOptGroups.replace(`<option value="${a.dropAreaId}">`, `<option value="${a.dropAreaId}" selected>`);
            return `<div>
              <label style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:${_same?'#5B6170':'#0F1B3D'};cursor:pointer;font-weight:${_same?'400':'700'}">
                <input type="checkbox" ${_same?'checked':''} onchange="bookingV2ToggleAltDropSame(${i})" style="accent-color:#16265C"> ส่งที่เดิม
              </label>
              ${_same ? `<div style="margin-top:3px;font-size:9px;color:#b4b2a9;font-style:italic">ขากลับส่งจุดเดียวกับที่รับ</div>` : `
                <select class="bkv2-nb-input" onchange="bookingV2SetAltDropArea(${i},this.value)" style="cursor:pointer;margin-top:3px"><option value="">— เลือกจุดส่ง —</option>${_dsel}</select>
                <input class="bkv2-nb-input" type="text" placeholder="ชื่อโรงแรม / Location" value="${escapeHTML(a.dropPlace||'')}" oninput="bookingV2SetAltPickup(${i},'dropPlace',this.value)" style="margin-top:3px">
                ${_dz?`<div style="margin-top:3px"><span style="font-size:9px;font-weight:700;color:#7A4A00;background:#FBF0DA;padding:1px 7px;border-radius:4px">โซนส่ง ${_zShort(_dz)} · auto</span></div>`:''}
              `}
            </div>`; })()}
          <button onclick="bookingV2RemoveAltPickup(${i})" title="ลบ" style="border:none;background:transparent;cursor:pointer;color:var(--ink-soft);font-size:16px;line-height:1;padding:6px 6px">&times;</button>
        </div>`; }).join('');
      const summary = alt.length ? `<div style="margin-top:9px;padding:7px 10px;border-radius:7px;background:${_over?'#FBE3E0':'#EEF1F8'};border:1px solid ${_over?'#F0BDB7':'#D9DFEE'};font-size:10.5px;color:${_over?'#8E2019':'#23335F'};line-height:1.5">
        จุดรับหลัก (ด้านบน · รวม Lead): <b>${Math.max(0,_mainQty)} คน</b> <span style="opacity:.75">(${PAX_K.filter(k=>_mainBd[k]>0).map(k=>_mainBd[k]+' '+PAX_LBL[k]).join(' · ')||'—'})</span>
        &nbsp;·&nbsp; แยกไปจุดอื่น: <b>${_altTot} คน</b> <span style="opacity:.75">(${PAX_K.filter(k=>_altBd[k]>0).map(k=>_altBd[k]+' '+PAX_LBL[k]).join(' · ')||'—'})</span>
        &nbsp;·&nbsp; กลุ่มทั้งหมด: <b>${_hc} คน</b> <span style="opacity:.75">(${PAX_K.filter(k=>_bkBd[k]>0).map(k=>_bkBd[k]+' '+PAX_LBL[k]).join(' · ')||'—'})</span>
        ${_badK.length?('<div style="margin-top:3px">&#9888; แยก '+_badK.map(k=>PAX_LBL[k]+' '+_altBd[k]+' คน แต่กลุ่มนี้มี '+_bkBd[k]).join(' · ')+'</div>'):(_hc>0&&_altTot>_hc?('<div style="margin-top:3px">&#9888; แยกเกินจำนวนกลุ่ม ('+_altTot+'>'+_hc+')</div>'):'')}
      </div>` : '';
      return `
        <datalist id="bkv2-altpick-names">${nameOpts}</datalist>
        <div style="margin-top:12px;padding:10px 12px;background:${alt.length?'#F7F7F5':'#fff'};border:1px solid ${alt.length?'#ECEBE6':'#D5D7DE'};border-radius:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span style="font-size:13px;color:#0F1B3D;font-weight:600">&#128652; แยกคน · รับหรือส่งคนละที่${alt.length?` · ${alt.length} รายการ`:''}</span>
            <button onclick="bookingV2AddAltPickup()" style="font-size:12.5px;font-weight:600;color:#0F1B3D;background:#fff;border:1px solid #CFCFC8;border-radius:8px;height:30px;padding:0 10px;cursor:pointer;font-family:inherit;white-space:nowrap">+ เพิ่มจุดรับ</button>
          </div>
          ${alt.length?`<div class="bkv2-alt-row" style="display:grid;grid-template-columns:${_gcols};gap:7px;margin-top:8px;font-size:8.5px;font-weight:700;letter-spacing:.05em;color:#5B6170;text-transform:uppercase"><span>ชื่อ (จากรายชื่อด้านบน)</span><span style="text-align:center">AD · CHD · INF · FOC</span><span>จุดรับ · Pickup area</span><span>ชื่อโรงแรม / Location</span><span>จุดส่งขากลับ</span><span></span></div>`:''}
          ${rows}
          ${summary}
          ${alt.length?'<div style="font-size:9.5px;color:#5B6170;margin-top:6px">จุดรับหลักด้านบน = คนส่วนใหญ่ (รวม Lead) · รายการนี้ = คนที่รับคนละที่ · โซนมาจากจุดรับที่เลือกอัตโนมัติ · จำนวน "จุดรับหลัก" คำนวณอัตโนมัติ = กลุ่มทั้งหมด − ที่แยกไป</div>':''}
        </div>`;
    })()}
  `;
}
