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
          <td style="padding:6px 0;font-family:'DM Mono',monospace;font-size:10px;color:var(--ink-soft)">${t.date||'—'}</td>
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
    <!-- Row 1: ZONE pills (left, narrow) + PICKUP AREA input (right, filtered) -->
    <div class="bkv2-nb-row" style="grid-template-columns:auto minmax(0,1fr)">
      <div class="bkv2-nb-field">
        <label class="bkv2-nb-label">Zone <em style="font-weight:500;color:#b4b2a9;font-style:normal">· from trip above</em></label>
        ${(() => {
          const tripsZones = [...new Set((d.trips||[]).filter(t => t.zone).map(t => bookingV2EffZone(d, t)))];   // private van → its pickup zone, not the No-Transfer seat
          const effectiveZone = tripsZones[0] || d.pickupZoneFilter || 'PK';
          const zoneLbl = (z) => laZoneLabel(z);           /* §rnZone */
          const mixed = tripsZones.length > 1;
          return `<div style="padding:8px 12px;background:var(--white);border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:7px;height:34px;box-sizing:border-box">
            <span style="flex:1">${zoneLbl(effectiveZone)}${mixed?` <span style="font-size:9px;color:#a32d2d;font-weight:600;margin-left:4px">⚠ trips have mixed zones</span>`:''}</span>
          </div>`;
        })()}
      </div>
      <div class="bkv2-nb-field">
        <label class="bkv2-nb-label">Pickup area * <em style="font-weight:500;color:#b4b2a9;font-style:normal">· type to search</em></label>
        ${(d.pickupZoneFilter==='NoTransfer' && d.pickupAreaId)
          ? `<div style="padding:8px 11px;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:var(--r-sm);font-size:12px;color:#0F6E56;font-weight:600;height:34px;display:flex;align-items:center;gap:7px;box-sizing:border-box"><span style="font-size:11px">✓ AUTO</span><span style="font-family:'DM Mono',monospace;font-size:11px">${escapeHTML(pickupLabel)}</span></div>`
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
          ${pickupTimeRows ? `<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">
            ${d.trips.filter(t => t.routeId).map(t => {
              const autoTime = bookingV2GetPickupTime(t.routeId, d.pickupAreaId, t.date);
              const displayTime = t.pickupTime || autoTime || '';
              const isEdited = t.pickupTimeEdited;
              const routeName = (typeof ROUTES!=='undefined' && ROUTES.find(r=>r.id===t.routeId)?.name) || t.routeId;
              if(!displayTime && !t.date) return '';
              return `<div style="display:flex;align-items:center;gap:10px;padding:4px 9px;background:#F4F8F5;border:1px solid #E5EDE7;border-radius:6px;font-size:11px">
                <span style="font-family:'DM Mono',monospace;color:var(--ink-soft);min-width:80px">${t.date || '—'}</span>
                <span style="flex:1;color:var(--ink);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(routeName)}</span>
                <span style="font-family:'DM Mono',monospace;font-weight:700;color:#0F6E56">${displayTime || '—'}</span>
                ${displayTime ? `<span style="background:${isEdited?'#FAEEDA':'#DDF0E5'};color:${isEdited?'#633806':'#0F6E56'};font-size:8px;padding:1px 5px;border-radius:3px;font-weight:600;letter-spacing:.06em">${isEdited?'EDITED':'AUTO'}</span>` : ''}
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>
        <div class="bkv2-nb-field">
          <label class="bkv2-nb-label">Room #</label>
          <input class="bkv2-nb-input" type="text" placeholder="A-205" value="${escapeHTML(d.roomNumber||'')}" oninput="bookingV2SetBookingField('roomNumber', this.value)">
        </div>
      </div>
    ` : ''}
    <!-- Pickup time table moved inline under Hotel/Pickup Location · per request -->
    <label style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:${d.pickupSelf?'#F6F2FE':'var(--white)'};border:1px solid ${d.pickupSelf?'#C7B8E8':'var(--border)'};border-radius:var(--r-sm);cursor:pointer;margin-top:10px">
      <input type="checkbox" ${d.pickupSelf?'checked':''} onchange="bookingV2TogglePickupSelf()" style="accent-color:#5B289A">
      <span style="font-size:11px;color:${d.pickupSelf?'#5B289A':'var(--ink)'};font-weight:600">&#128694; ขารับ: ลูกค้ามาเองที่ท่าเรือ (self-arrive · เก็บเรทเต็ม)</span>
    </label>
    ${(d.pickupSelf && (d.hotelName||'').trim())?`<div style="margin-top:6px;padding:7px 11px;background:#FCEBEB;border:1px solid #F0C4C4;border-radius:var(--r-sm);font-size:10.5px;color:#A32D2D;line-height:1.45">&#9888; ติ๊ก self-arrive (ลูกค้ามาเอง) แต่กรอกโรงแรม "<b>${escapeHTML(d.hotelName)}</b>" ไว้ — booking นี้จะ<b>ไม่ขึ้นในใบงานรถขาไป</b> · ถ้าลูกค้าให้ไปรับที่โรงแรม อย่าติ๊กช่องนี้</div>`:''}
    <label style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:${d.dropoffSame?'var(--bk-navy-50)':'var(--white)'};border:1px solid ${d.dropoffSame?'var(--bk-navy-mid)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer;margin-top:10px">
      <input type="checkbox" ${d.dropoffSame?'checked':''} onchange="bookingV2ToggleDropoffSame()" style="accent-color:var(--bk-navy)">
      <span style="font-size:11px;color:${d.dropoffSame?'var(--bk-navy)':'var(--ink)'};font-weight:600">Drop-off same as pickup</span>
    </label>
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
          ? `<div style="margin-top:3px"><span style="font-size:9px;font-weight:700;color:#5B289A;background:#EDE7FB;padding:1px 7px;border-radius:4px">โซน ${_zShort(_zone)} · auto</span></div>`
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
              <label style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:${_same?'#8a7db0':'#5B289A'};cursor:pointer;font-weight:${_same?'400':'700'}">
                <input type="checkbox" ${_same?'checked':''} onchange="bookingV2ToggleAltDropSame(${i})" style="accent-color:#5B289A"> ส่งที่เดิม
              </label>
              ${_same ? `<div style="margin-top:3px;font-size:9px;color:#b4b2a9;font-style:italic">ขากลับส่งจุดเดียวกับที่รับ</div>` : `
                <select class="bkv2-nb-input" onchange="bookingV2SetAltDropArea(${i},this.value)" style="cursor:pointer;margin-top:3px"><option value="">— เลือกจุดส่ง —</option>${_dsel}</select>
                <input class="bkv2-nb-input" type="text" placeholder="ชื่อโรงแรม / Location" value="${escapeHTML(a.dropPlace||'')}" oninput="bookingV2SetAltPickup(${i},'dropPlace',this.value)" style="margin-top:3px">
                ${_dz?`<div style="margin-top:3px"><span style="font-size:9px;font-weight:700;color:#7A4A00;background:#FBF0DA;padding:1px 7px;border-radius:4px">โซนส่ง ${_zShort(_dz)} · auto</span></div>`:''}
              `}
            </div>`; })()}
          <button onclick="bookingV2RemoveAltPickup(${i})" title="ลบ" style="border:none;background:transparent;cursor:pointer;color:var(--ink-soft);font-size:16px;line-height:1;padding:6px 6px">&times;</button>
        </div>`; }).join('');
      const summary = alt.length ? `<div style="margin-top:9px;padding:7px 10px;border-radius:7px;background:${_over?'#FDECEA':'#F0EBFA'};border:1px solid ${_over?'#F5C9C4':'#DDD1F2'};font-size:10.5px;color:${_over?'#A32D2D':'#5B289A'};line-height:1.5">
        จุดรับหลัก (ด้านบน · รวม Lead): <b>${Math.max(0,_mainQty)} คน</b> <span style="opacity:.75">(${PAX_K.filter(k=>_mainBd[k]>0).map(k=>_mainBd[k]+' '+PAX_LBL[k]).join(' · ')||'—'})</span>
        &nbsp;·&nbsp; แยกไปจุดอื่น: <b>${_altTot} คน</b> <span style="opacity:.75">(${PAX_K.filter(k=>_altBd[k]>0).map(k=>_altBd[k]+' '+PAX_LBL[k]).join(' · ')||'—'})</span>
        &nbsp;·&nbsp; กลุ่มทั้งหมด: <b>${_hc} คน</b> <span style="opacity:.75">(${PAX_K.filter(k=>_bkBd[k]>0).map(k=>_bkBd[k]+' '+PAX_LBL[k]).join(' · ')||'—'})</span>
        ${_badK.length?('<div style="margin-top:3px">&#9888; แยก '+_badK.map(k=>PAX_LBL[k]+' '+_altBd[k]+' คน แต่กลุ่มนี้มี '+_bkBd[k]).join(' · ')+'</div>'):(_hc>0&&_altTot>_hc?('<div style="margin-top:3px">&#9888; แยกเกินจำนวนกลุ่ม ('+_altTot+'>'+_hc+')</div>'):'')}
      </div>` : '';
      return `
        <datalist id="bkv2-altpick-names">${nameOpts}</datalist>
        <div style="margin-top:10px;padding:9px 11px;background:${alt.length?'#F6F2FE':'var(--white)'};border:1px solid ${alt.length?'#C7B8E8':'var(--border)'};border-radius:var(--r-sm)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span style="font-size:11px;color:${alt.length?'#5B289A':'var(--ink)'};font-weight:600">&#128652; แยกคน · รับหรือส่งคนละที่${alt.length?` · ${alt.length} รายการ`:''}</span>
            <button onclick="bookingV2AddAltPickup()" style="font-size:11px;font-weight:600;color:#5B289A;background:#EDE7FB;border:1px solid #C7B8E8;border-radius:6px;padding:4px 10px;cursor:pointer;font-family:inherit">+ เพิ่มจุดรับ</button>
          </div>
          ${alt.length?`<div class="bkv2-alt-row" style="display:grid;grid-template-columns:${_gcols};gap:7px;margin-top:8px;font-size:8.5px;font-weight:700;letter-spacing:.05em;color:#8a7db0;text-transform:uppercase"><span>ชื่อ (จากรายชื่อด้านบน)</span><span style="text-align:center">AD · CHD · INF · FOC</span><span>จุดรับ · Pickup area</span><span>ชื่อโรงแรม / Location</span><span>จุดส่งขากลับ</span><span></span></div>`:''}
          ${rows}
          ${summary}
          ${alt.length?'<div style="font-size:9.5px;color:#8a7db0;margin-top:6px">จุดรับหลักด้านบน = คนส่วนใหญ่ (รวม Lead) · รายการนี้ = คนที่รับคนละที่ · โซนมาจากจุดรับที่เลือกอัตโนมัติ · จำนวน "จุดรับหลัก" คำนวณอัตโนมัติ = กลุ่มทั้งหมด − ที่แยกไป</div>':''}
        </div>`;
    })()}
  `;
}
