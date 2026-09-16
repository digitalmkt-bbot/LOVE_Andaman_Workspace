function bookingV2RenderTripsSection(){
  const d = _bkV2.newBooking;
  const rt = bookingV2GetRT();
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  if(!rt){
    // §b2cEdit · ใบ B2C ไม่มี Rate Type และไม่ควรมี · แสดงทริปจริงแบบอ่านอย่างเดียว
    if(typeof bookingV2IsB2CBk==='function' && bookingV2IsB2CBk(d)) return bookingV2RenderB2CTripsRO(d);
    return `<div style="font-size:12px;color:var(--ink-soft);font-style:italic;padding:12px 0">Pick an agent first to enable trip selection.</div>`;
  }

  // Routes covered by this rate type · with full name
  const coveredRoutes = (rt.routes || []).map(rid => {
    const r = (typeof ROUTES !== 'undefined') ? ROUTES.find(rr => rr.id === rid) : null;
    return r ? { id:rid, name:r.name } : null;
  }).filter(Boolean);

  const zones = LA_PICKUP_ZONES;                          /* §rnZone */
  const zoneLabel = z => laZoneLabel(z);

  // Compact pax stepper · used in 2x4 mixed grid
  const stepper = (idx, key, val) => `
    <div style="display:inline-flex;align-items:center;gap:1px;background:var(--white);border:1px solid var(--border);border-radius:999px;padding:1px 2px">
      <button onclick="bookingV2BumpPax(${idx},'${key}',-1)" style="width:18px;height:18px;border:none;background:transparent;color:var(--ink-soft);font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;line-height:1;padding:0;border-radius:50%">&minus;</button>
      <span style="min-width:17px;text-align:center;font-family:'DM Mono',monospace;font-weight:700;font-size:11px;font-variant-numeric:tabular-nums;color:${val>0?'var(--ink)':'#c7c5bb'}">${val}</span>
      <button onclick="bookingV2BumpPax(${idx},'${key}',1)" style="width:18px;height:18px;border:none;background:transparent;color:var(--ink-soft);font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;line-height:1;padding:0;border-radius:50%">+</button>
    </div>
  `;

  /* §pkNat · ตัวนับหัวคนไทยจริง · หน้าตาเหมือน stepper ปกติแต่เป็นสีเขียวของ "ไม่เกี่ยวกับเงิน"
     ค่าที่โชว์ตอนยังไม่มีใครแตะ = ช่อง TH ของแถวราคา · เท่ากับพฤติกรรมเดิมเป๊ะ
     บวกเกินหัวทั้งหมดของประเภทนั้นไม่ได้ · ปุ่ม + จะจางลงเมื่อเต็มแล้ว */
  const natStep = (idx, k, t) => {
    const px = t.pax || {};
    const all = (+px[k+'_th']||0) + (+px[k+'_fr']||0) + (+px[k]||0);
    const val = bkNatTH(t, k);
    const on  = bkNatHas(t);
    return `
    <div style="display:inline-flex;align-items:center;gap:1px;background:var(--white);border:1px solid ${on?'#B7E2D2':'var(--border)'};border-radius:999px;padding:1px 2px" title="ทั้งหมด ${all} คน${on?'':' · ยังไม่ได้ระบุ ถือตามช่อง TH ไปก่อน'}">
      <button onclick="bookingV2BumpNat(${idx},'${k}',-1)" style="width:18px;height:18px;border:none;background:transparent;color:${val>0?'#0F6E56':'#c7c5bb'};font-weight:700;cursor:pointer;font-family:inherit;font-size:12px;line-height:1;padding:0;border-radius:50%">&minus;</button>
      <span style="min-width:17px;text-align:center;font-family:'DM Mono',monospace;font-weight:700;font-size:11px;font-variant-numeric:tabular-nums;color:${val>0?'#0F6E56':'#c7c5bb'}">${val}</span>
      <button onclick="bookingV2BumpNat(${idx},'${k}',1)" style="width:18px;height:18px;border:none;background:transparent;color:${val<all?'#0F6E56':'#d8d5cc'};font-weight:700;cursor:${val<all?'pointer':'default'};font-family:inherit;font-size:12px;line-height:1;padding:0;border-radius:50%">+</button>
    </div>`;
  };

  // Bundle helper · detect free/paid longtail bundle for a route
  const bundleInfo = (rId) => {
    const b = rt.routeBundles?.[rId]?.longtail;
    if(!b) return null;
    return { mode: b.mode, adult: b.adult||0, child: b.child||0 };
  };
  const routeDataList = coveredRoutes.map(r => `<option value="${escapeHTML(r.name)}"></option>`).join('');
  const tripRows = d.trips.map((t, idx) => {
    const subtotal = bookingV2TripSubtotal(t);
    const totAd  = bookingV2PaxTot(t.pax,'ad');
    const totChd = bookingV2PaxTot(t.pax,'chd');
    const totInf = bookingV2PaxTot(t.pax,'inf');
    const totFoc = bookingV2PaxTot(t.pax,'foc');
    const currentRouteLabel = t.routeId ? (coveredRoutes.find(r=>r.id===t.routeId)?.name || '') : '';
    const bi = (t.routeId && _rtBundleAppliesTo(rt.routeBundles?.[t.routeId]?.longtail, t.bookingMode==='charter')) ? bundleInfo(t.routeId) : null;
    const bundleBadge = bi
      ? (bi.mode === 'free'
          ? `<div style="margin-top:6px;padding:5px 9px;background:#E1F5EE;border:1px solid #B8E5D2;border-radius:var(--r-sm);font-size:10px;color:#0F6E56;font-weight:700;display:flex;align-items:center;gap:6px"><span style="background:#0F6E56;color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;letter-spacing:.06em">BUNDLED</span>Longtail Join included (free) · auto-applied</div>`
          : `<div style="margin-top:6px;padding:5px 9px;background:#FFF6E5;border:1px solid #EAD9B0;border-radius:var(--r-sm);font-size:10px;color:#633806;font-weight:700;display:flex;align-items:center;gap:6px"><span style="background:#ba7517;color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;letter-spacing:.06em">BUNDLED</span>Longtail Join · auto +฿${bi.adult}/A &middot; +฿${bi.child}/C</div>`)
      : '';
    // Allotment status badge · only if route + date selected
    let allotBadge = '';
    if(t.routeId && t.date && typeof getAllotment === 'function'){
      const al = getAllotment(t.routeId, t.date, _bkV2.editingId || null);   // exclude this booking's own seats when editing
      const totPaxThisTrip = bookingV2PaxAllTot(t.pax);
      const styles = {
        'open':          { bg:'#E1F5EE', border:'#B8E5D2', color:'#0F6E56', tag:'OPEN'  },
        'tight':         { bg:'#FFF6E5', border:'#EAD9B0', color:'#A05A1A', tag:'TIGHT' },
        'full':          { bg:'#FDE7E7', border:'#F5B7B7', color:'#a32d2d', tag:'FULL'  },
        'all-chartered': { bg:'#F4E8FB', border:'#D7B5F0', color:'#6B289A', tag:'CHARTERED' },
        'no-allotment':  { bg:'#fafafa', border:'#d3d1c7', color:'#5A5A52', tag:'PROVISIONAL', dashed:true },
        'no-limit':      { bg:'#F3EAFB', border:'#D7B5F0', color:'#5B289A', tag:'NO LIMIT', dashed:true }   // §otherPier
      };
      /* §otherPier · โปรแกรมบกที่ยังไม่ตั้งโควตา ไม่ใช่ ยังไม่มีเรือ · มันขายได้ไม่จำกัด */
      const _isLandNoCap = (typeof laIsLandRoute==='function') && laIsLandRoute(t.routeId) && !al.hasAllotment;
      const s = _isLandNoCap ? styles['no-limit'] : (styles[al.state] || styles['no-allotment']);
      let msg = '';
      if(al.state === 'open' || al.state === 'tight'){
        msg = al.isLand   // §otherPier · ไม่มีเรือให้นับ
          ? `<strong style="font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">${al.seatsAvailable}</strong> seat${al.seatsAvailable===1?'':'s'} left of the ${al.availableCapacity}/day quota (${al.seatsConsumed} booked)`
          : `<strong style="font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">${al.seatsAvailable}</strong> seat${al.seatsAvailable===1?'':'s'} available · ${al.assignedBoats.length} boat${al.assignedBoats.length===1?'':'s'} (${al.seatsConsumed}/${al.availableCapacity} booked${al.charteredBoats.length?` · ${al.charteredBoats.length} chartered`:''})`;
      } else if(al.state === 'full'){
        msg = al.isLand   // §otherPier
          ? `Daily quota full · all ${al.availableCapacity} seats booked. Raise the quota in Config &rarr; Programme, or rent another vehicle.`
          : `Sold out · all ${al.availableCapacity} seats booked. Ask dispatcher to add more boats in Boat Operation.`;
      } else if(al.state === 'all-chartered'){
        msg = `All ${al.assignedBoats.length} boat${al.assignedBoats.length===1?'':'s'} chartered for this date · no seats available.`;
      } else {
        msg = _isLandNoCap
          ? `Land programme · no daily quota set, so seats are <strong>not limited</strong>. Set one in Config &rarr; Programme if you want a cap.`
          : `No boat assigned yet · this booking will be <strong>provisional</strong>. Confirmed once dispatcher assigns a boat in Boat Operation.`;
      }
      // Over-capacity warning if pax exceeds available
      let warn = '';
      if(al.hasAllotment && totPaxThisTrip > al.seatsAvailable && totPaxThisTrip > 0){
        warn = `<div style="margin-top:4px;padding:4px 8px;background:#FDE7E7;color:#a32d2d;border:1px solid #F5B7B7;border-radius:3px;font-size:10px;font-weight:600">⚠ Over capacity · ${totPaxThisTrip} pax requested · only ${al.seatsAvailable} seat${al.seatsAvailable===1?'':'s'} left. Booking can be saved but needs dispatcher action.</div>`;
      }
      allotBadge = `<div style="margin-top:6px;padding:5px 9px;background:${s.bg};border:${s.dashed?'1px dashed':'1px solid'} ${s.border};border-radius:var(--r-sm);font-size:10px;color:${s.color};font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="background:${s.color};color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;letter-spacing:.06em;font-weight:700;flex-shrink:0">${s.tag}</span><span style="flex:1;min-width:0">${msg}</span></div>${warn}`;
    }
    const isCharter = t.bookingMode === 'charter';
    // Charter boat picker · only boats assigned to route+date · filter availability
    let charterPickerHtml = '';
    if(isCharter && t.routeId && t.date && typeof getAssignedBoatsForRouteDate === 'function'){
      const assigned = getAssignedBoatsForRouteDate(t.routeId, t.date);
      const charterRatesByType = rt.charterRates?.[t.routeId] || {};
      const opts = assigned.map(a => {
        const bt = (a.boat?.type || '').toLowerCase();
        const hasCharterRate = !!charterRatesByType[bt];
        const alreadyChartered = !!a.charterBookingId;
        // seats currently booked on this boat (cannot derive per-boat directly · check route+date seatsConsumed > 0)
        const hasSeats = (typeof getSeatsConsumed === 'function') && getSeatsConsumed(t.routeId, t.date) > 0;
        let label = `${a.boat.name} · ${a.boat.cap} cap · ${a.boat.type}`;
        let disabled = false;
        let note = '';
        if(alreadyChartered){ note = ' · ALREADY CHARTERED'; disabled = true; }
        else if(!hasCharterRate){ note = ' · no charter rate set'; disabled = true; }
        else if(hasSeats){ note = ' · has existing seat bookings (will need confirm)'; }
        return `<option value="${a.boatId}" ${t.charterBoatId===a.boatId?'selected':''} ${disabled?'disabled':''}>${escapeHTML(label+note)}</option>`;
      }).join('');
      const noBoats = assigned.length === 0;
      const noAvailable = assigned.length > 0 && !assigned.some(a => !a.charterBookingId && charterRatesByType[(a.boat?.type||'').toLowerCase()]);
      charterPickerHtml = `
        <div class="bkv2-nb-row" style="margin-top:8px">
          <div class="bkv2-nb-field" style="grid-column:1/-1">
            <label class="bkv2-nb-label">Charter boat <em style="font-weight:500;color:#b4b2a9;font-style:normal">· pick from boats assigned in Boat Operation</em></label>
            ${noBoats ? `<div style="padding:8px 11px;background:#FFF6E5;border:1px dashed #EAD9B0;color:#633806;font-size:11px;border-radius:var(--r-sm)">No boat assigned for this route+date yet · go to Boat Operation to assign first</div>` :
              noAvailable ? `<div style="padding:8px 11px;background:#FDE7E7;border:1px solid #F5B7B7;color:#a32d2d;font-size:11px;border-radius:var(--r-sm)">All assigned boats are chartered or have no charter rate set</div>` :
              `<select class="bkv2-nb-input" onchange="bookingV2SetTripCharterBoat(${idx}, this.value || null)">
                <option value="">&mdash; pick a boat &mdash;</option>
                ${opts}
              </select>`}
          </div>
        </div>
      `;
    }
    // Charter price · Rate (auto) or Flexible (manual) · when charter mode + boat picked
    let charterBreakdownHtml = '';
    if(isCharter && subtotal.isCharter && t.charterBoatId && !subtotal.error){
      const totPax = bookingV2PaxAllTot(t.pax);
      const manual = t.charterPriceMode === 'manual';
      const seg = `
        <div style="display:inline-flex;background:#fff;border:1px solid #D7B5F0;border-radius:5px;overflow:hidden">
          <button onclick="bookingV2SetTripCharterPriceMode(${idx},'rate')" style="border:none;cursor:pointer;font-family:inherit;font-size:10px;font-weight:700;padding:3px 9px;background:${!manual?'#6B289A':'#fff'};color:${!manual?'#fff':'#6B289A'}">RATE</button>
          <button onclick="bookingV2SetTripCharterPriceMode(${idx},'manual')" style="border:none;cursor:pointer;font-family:inherit;font-size:10px;font-weight:700;padding:3px 9px;background:${manual?'#6B289A':'#fff'};color:${manual?'#fff':'#6B289A'}">FLEXIBLE</button>
        </div>`;
      const body = manual ? `
          <div style="display:flex;align-items:center;gap:7px;margin-top:6px">
            <span style="font-size:11px;color:#6B289A;font-weight:600">Charter price ฿</span>
            <input type="number" min="0" value="${(Number(t.charterPriceManual)||0)||''}" onchange="bookingV2SetTripCharterManual(${idx}, this.value)" placeholder="0" style="width:110px;font-size:13px;font-weight:700;padding:5px 8px;text-align:right;font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums;border:1px solid #D7B5F0;border-radius:5px">
            <span style="font-size:10px;color:${subtotal.manualDelta===0?'#6B289A':(subtotal.manualDelta<0?'#0F7A5A':'#A05A1A')}">rate ฿${subtotal.rateTotal.toLocaleString()}${subtotal.manualDelta!==0?` · ${subtotal.manualDelta<0?'&minus;':'+'}฿${Math.abs(subtotal.manualDelta).toLocaleString()}`:''}</span>
          </div>
          <input value="${escapeHTML(t.charterPriceNote||'')}" oninput="bookingV2SetTripCharterNote(${idx}, this.value)" placeholder="Reason / note · e.g. repeat charter discount" style="margin-top:6px;width:100%;box-sizing:border-box;font-size:11px;padding:5px 8px;border:1px solid #D7B5F0;border-radius:5px;color:#6B289A">
      ` : `
          <div style="display:flex;justify-content:space-between;gap:6px;margin-top:6px"><span>Starter (first ${subtotal.starterIncludes} pax)</span><span style="font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">฿${subtotal.starterPrice.toLocaleString()}</span></div>
          ${subtotal.extras > 0 ? `<div style="display:flex;justify-content:space-between;gap:6px"><span>+ ${subtotal.extras} extra pax × ฿${subtotal.extraRate.toLocaleString()}</span><span style="font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">฿${subtotal.extraTotal.toLocaleString()}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;gap:6px;border-top:1px solid #D7B5F0;padding-top:3px;margin-top:3px;font-weight:700"><span>Total · ${totPax} pax</span><span style="font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">฿${subtotal.total.toLocaleString()}</span></div>
      `;
      charterBreakdownHtml = `
        <div style="margin-top:6px;padding:7px 10px;background:#F4E8FB;border:1px solid #D7B5F0;border-radius:var(--r-sm);font-size:10px;color:#6B289A;line-height:1.5">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><span style="font-weight:700;letter-spacing:.06em;font-size:9px">CHARTER PRICE</span><span style="margin-left:auto">${seg}</span></div>
          ${body}
        </div>
      `;
    } else if(isCharter && t.charterBoatId && subtotal.error){
      charterBreakdownHtml = `<div style="margin-top:6px;padding:6px 10px;background:#FDE7E7;color:#a32d2d;font-size:10px;border:1px solid #F5B7B7;border-radius:var(--r-sm)">⚠ ${escapeHTML(subtotal.error)} for this boat type · check Rate Type charter rates</div>`;
    }
    // ── Seat-lock draw banner (Step 3c · seat mode · pick which sub-group to draw from) ──
    let lockBannerHtml = '';
    if(!isCharter && t.routeId && t.date && d.agentId && typeof bookingV2DrawSources==='function'){
      const srcs = bookingV2DrawSources(t.routeId, t.date, d.agentId);
      const remTotal = srcs.reduce((s,x)=>s+x.remaining,0);
      if(remTotal > 0){
        const pax = bookingV2PaxAllTot(t.pax);
        const sel = t.lockDrawSel || {};
        const drawnTot = srcs.reduce((s,x)=> s + Math.min(Number(sel[x.lockId])||0, x.remaining), 0);
        const general = Math.max(0, pax - drawnTot);
        const undrawn = pax>0 && drawnTot===0;   // has lock but hasn't used it → LOUD reminder
        const accent = undrawn ? '#B45309' : '#2952C8';
        const stepBtn = `width:22px;height:22px;border:1px solid ${undrawn?'#EAD9B0':'#C7D8F7'};background:#fff;border-radius:5px;cursor:pointer;color:${accent};font-weight:700`;
        const srcRows = srcs.map(x=>{
          const v = Math.min(Number(sel[x.lockId])||0, x.remaining);
          const canInc = drawnTot < pax && v < x.remaining;
          return `
            <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
              <span style="font-size:10.5px;color:${accent};flex:1;min-width:120px">${escapeHTML(x.label)} <span style="opacity:.7">· เหลือ ${x.remaining}</span></span>
              <button onclick="bookingV2SetTripLockDraw(${idx},'${x.lockId}',${Math.max(0,v-1)})" ${v<=0?'disabled':''} style="${stepBtn}">&minus;</button>
              <span style="font-family:Manrope,sans-serif;font-weight:800;color:${accent};min-width:18px;text-align:center;font-variant-numeric:tabular-nums">${v}</span>
              <button onclick="bookingV2SetTripLockDraw(${idx},'${x.lockId}',${v+1})" ${canInc?'':'disabled'} style="${stepBtn}">+</button>
            </div>`;
        }).join('');
        lockBannerHtml = undrawn ? `
          <div style="margin-top:8px;padding:10px 12px;background:#FFF6E5;border:1.5px solid #E0A93B;border-radius:var(--r-sm);box-shadow:0 0 0 3px rgba(224,169,59,.15)">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:14px">⚠</span>
              <span style="font-size:11.5px;font-weight:800;color:#8A4B0A;flex:1;min-width:150px">อย่าลืมใช้ seat lock · มี <b>${remTotal}</b> ที่ว่างของเอเจนต์นี้</span>
              <button onclick="bookingV2AutoDrawLocks(${idx})" style="font-size:11px;font-weight:800;color:#fff;background:#B45309;border:none;border-radius:6px;padding:6px 11px;cursor:pointer;font-family:inherit">⚡ ใช้ lock ก่อน (ดึง ${Math.min(remTotal,pax)})</button>
            </div>
            <div style="margin-top:2px;font-size:10px;color:#8A4B0A">กด "ใช้ lock ก่อน" เพื่อดึงอัตโนมัติ หรือเลือกกรุ๊ปเองด้านล่าง</div>
            ${srcRows}
          </div>` : `
          <div style="margin-top:8px;padding:9px 11px;background:#EAF1FE;border:1px solid #C7D8F7;border-radius:var(--r-sm)">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
              <span style="font-size:13px">🔒</span>
              <span style="font-size:11px;font-weight:700;color:#2952C8">${remTotal} locked seat${remTotal===1?'':'s'} · เลือกดึงจากกรุ๊ป</span>
            </div>
            ${srcRows}
            <div style="margin-top:6px;font-size:10px;color:#2952C8">ดึงจากล็อค <b>${drawnTot}</b> ที่ (ไม่กระทบ pool) + <b>${general}</b> ที่นั่งใหม่ · ยืนยันตอนบันทึก</div>
          </div>`;
      }
    }
    return `
      <div class="bkv2-nb-trip">
        <div class="bkv2-nb-trip-h" style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:700;color:var(--ink-soft);letter-spacing:.06em">TRIP ${idx+1}</span>
          <div style="display:inline-flex;background:#f5f3ef;border-radius:4px;padding:2px;margin-left:6px">
            <button onclick="bookingV2SetTripBookingMode(${idx},'seat')" style="padding:3px 10px;font-size:10px;font-weight:700;border:none;background:${!isCharter?'#fff':'transparent'};color:${!isCharter?'var(--bk-navy)':'var(--ink-soft)'};border-radius:3px;cursor:pointer;font-family:inherit;letter-spacing:.06em;${!isCharter?'box-shadow:0 1px 2px rgba(0,0,0,.06)':''}">SEAT</button>
            <button onclick="bookingV2SetTripBookingMode(${idx},'charter')" style="padding:3px 10px;font-size:10px;font-weight:700;border:none;background:${isCharter?'#fff':'transparent'};color:${isCharter?'#6B289A':'var(--ink-soft)'};border-radius:3px;cursor:pointer;font-family:inherit;letter-spacing:.06em;${isCharter?'box-shadow:0 1px 2px rgba(0,0,0,.06)':''}">CHARTER</button>
          </div>
          ${t.ovnLeg ? `<span style="margin-left:auto;font-size:9px;font-weight:800;letter-spacing:.04em;color:#5B289A;background:#EDE7FB;border-radius:8px;padding:4px 11px;white-space:nowrap">&#127769; OVN ขากลับ · กันที่นั่ง</span>` : `<div style="margin-left:auto;display:inline-flex;background:#f5f3ef;border-radius:5px;padding:2px;gap:2px">
            ${[['','Day Trip'],['return','OVN'],['self','OVN o/w']].map(([v,lbl])=>{ const on=(t.ovn||'')===v; const onbg=v==='return'?'#EDE7FB':v==='self'?'#FBEAD5':'#fff'; const onc=v==='return'?'#5B289A':v==='self'?'#9A5B00':'var(--bk-navy)'; return `<button type="button" onclick="bookingV2SetTripOvn(${idx},'${v}')" title="${v===''?'ทริปไป-กลับวันเดียว':v==='return'?'ค้างคืน · เรารับกลับวันอื่น (กันที่นั่ง+จัดรถกลับ)':'ค้างคืน · ลูกค้ากลับเอง (one-way)'}" style="padding:3px 11px;font-size:10px;font-weight:700;border:none;background:${on?onbg:'transparent'};color:${on?onc:'var(--ink-soft)'};border-radius:3px;cursor:pointer;font-family:inherit;letter-spacing:.04em;white-space:nowrap;${on?'box-shadow:0 1px 2px rgba(0,0,0,.06)':''}">${lbl}</button>`; }).join('')}
          </div>`}
          ${d.trips.length > 1 ? `<button onclick="bookingV2RemoveTrip(${idx})" style="background:transparent;border:none;color:#a32d2d;font-size:11px;cursor:pointer;font-family:inherit;margin-left:8px">&times; Remove</button>` : ''}
        </div>
        ${t.ovn?`<div style="margin-bottom:9px;background:${t.ovn==='return'?'#F6F2FE':'#FCF6EC'};border:1px solid ${t.ovn==='return'?'#E4D7FB':'#F0E0C4'};border-radius:8px;padding:9px 11px">
          <div style="font-size:9.5px;color:${t.ovn==='return'?'#5B289A':'#9A5B00'};margin-bottom:7px">${t.ovn==='return'?'🌙 OVN · ขากลับค้างคืน · กันที่นั่งวันกลับ + จัดรถกลับ · ขึ้นเรือท่าเกาะ':'🌙 OVN o/w · ค้างคืน · ลูกค้ากลับเอง (one-way) · ไม่กันที่นั่งกลับ ไม่จัดรถ'}</div>
          <div style="display:grid;grid-template-columns:${t.ovn==='return'?'1fr 1fr':'1fr'};gap:8px;align-items:end">
            ${t.ovn==='return'?`<div><label class="bkv2-nb-label" style="color:#5B289A">วันกลับ (OVN) *</label>${t.date?`<input class="bkv2-nb-input" type="date" min="${escapeHTML(t.date)}" value="${escapeHTML(t.ovnReturnDate||'')}" onchange="bookingV2SetTripField(${idx},'ovnReturnDate',this.value)" style="width:100%;box-sizing:border-box">`:`<div class="bkv2-nb-input" style="width:100%;box-sizing:border-box;color:#b4b2a9;background:#f3f1ec;cursor:not-allowed;font-size:11px;display:flex;align-items:center">&#9888; เลือก DATE (วันไป) ก่อน</div>`}</div>`:''}
            <div><label class="bkv2-nb-label" style="color:#854F0B">ค่าค้างคืน (Extra) &#3647;</label><input class="bkv2-nb-input" type="number" min="0" value="${Number(t.ovnCharge)||0}" onchange="bookingV2SetTripField(${idx},'ovnCharge',this.value)" placeholder="0" style="width:100%;box-sizing:border-box;text-align:right;font-variant-numeric:tabular-nums"></div>
          </div>
        </div>`:''}
        <div class="bkv2-nb-row">
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Route <em style="font-weight:500;color:#b4b2a9;font-style:normal">· type to search</em></label>
            <div class="bkv2-nb-ddwrap">
              <input id="bkv2-route-input-${idx}" class="bkv2-nb-input" type="text" placeholder="Type or pick route..." value="${escapeHTML(currentRouteLabel)}" autocomplete="off" oninput="bookingV2RouteDDFilter(${idx}, this.value)" onfocus="bookingV2RouteDDShow(${idx})" onkeydown="bookingV2RouteDDKey(event, ${idx})">
              <div id="bkv2-route-dd-${idx}" class="bkv2-nb-dd"></div>
            </div>
          </div>
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Date</label>
            <div class="bkv2-cal-wrap">
              <div id="bkv2-cal-trig-${idx}" class="bkv2-nb-input bkv2-cal-trig" onclick="bookingV2CalOpen(${idx})" tabindex="0" style="user-select:none">
                <span style="font-family:'DM Mono',monospace;${t.date?'':'color:#b4b2a9'}">${t.date || 'dd/mm/yyyy'}</span>
              </div>
              <div id="bkv2-cal-pop-${idx}" class="bkv2-cal-pop"></div>
            </div>
            ${(() => {
              if(!t.routeId || typeof ROUTES === 'undefined') return '';
              const route = ROUTES.find(r => r.id === t.routeId);
              if(!route) return '';
              const fmtD = s => s ? new Date(s).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'2-digit'}) : '—';
              const upcoming = (route.seasons||[]).filter(s => s.type === 'closed' && s.to >= (TODAY_STR||'')).sort((a,b) => a.from.localeCompare(b.from))[0];
              const tripDateStatus = t.date ? (typeof getDayStatus === 'function' ? getDayStatus(route, t.date) : null) : null;
              const isCurDateClosed = tripDateStatus && tripDateStatus.type === 'closed';
              if(isCurDateClosed){
                return `<div style="margin-top:4px;padding:5px 9px;background:#FDECEA;color:#A32D2D;border-radius:5px;font-size:10px;font-weight:600">⚠ Selected date is in a closed period · pick another date</div>`;
              }
              if(upcoming){
                return `<div style="margin-top:4px;font-size:10px;color:var(--ink-soft)"><span style="color:#A05A1A">⚠ Closed period:</span> ${fmtD(upcoming.from)} → ${fmtD(upcoming.to)}</div>`;
              }
              return '';
            })()}
          </div>
        </div>
        ${charterPickerHtml}
        ${charterBreakdownHtml}
        ${lockBannerHtml}
        ${allotBadge}
        ${(!isCharter && d.priceMode!=='manual' && subtotal?.noRate && t.routeId && t.zone) ? `<div style="margin-top:6px;padding:7px 10px;background:#FDECEA;border:1.5px dashed #C44A36;border-radius:var(--r-sm);font-size:11px;color:#A32D2D;font-weight:600;display:flex;align-items:center;gap:7px"><span style="background:#C44A36;color:#fff;padding:2px 7px;border-radius:3px;font-size:9px;letter-spacing:.06em;font-weight:700">NO RATE</span><span style="flex:1">Rate Type doesn't cover ${t.zone === 'NoTransfer' ? 'No-Transfer' : t.zone} on this route · cannot save until fixed or zone changed</span></div>` : ''}
        ${bundleBadge}
        <div class="bkv2-nb-row">
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Pickup zone *</label>
            ${(() => {
              const rt = bookingV2GetRT();
              const zoneAvailable = (z) => {
                if(t.ovnLeg) return true;   // OVN return leg · ราคา 0 · เลือกได้ทุกโซน (โดยเฉพาะ No Transfer · ขึ้นเรือที่ท่าเกาะ)
                if(!t.routeId || !rt) return true;
                const sr = rt.seatRates?.[t.routeId]?.[z];
                if(!sr) return false;
                return (sr['adult-fr']||0) > 0 || (sr['adult-thai']||0) > 0;
              };
              return `<div style="display:inline-flex;background:#f5f3ef;border-radius:var(--r-sm);padding:3px;height:34px;align-items:center;width:100%;box-sizing:border-box;gap:1px">
                ${/* §rnZone · zoneAvailable() ไม่ได้ "ซ่อน" โซนที่ไม่มีเรต แต่ขึ้นเป็นปุ่มขีดฆ่ากดไม่ได้
                     ตั้งใจให้เห็นว่ามีโซนนี้อยู่ แต่สัญญาใบนี้ยังไม่ได้ตั้งราคาไว้ (tooltip บอกเหตุผล)
                     ต่างจากการซ่อนซึ่งทำให้คนคิดว่าระบบไม่รองรับ แล้วไปหาทางอ้อมเอง
                     RN จึงกดได้เฉพาะสัญญาที่ตั้งเรตระนองไว้จริง · ยังไม่ได้ตั้ง = เห็นแต่กดไม่ลง */''}
                ${LA_PICKUP_ZONES.map(z => {
                  const lbl = laZoneLabel(z);
                  const on = (t.zone||'PK') === z;
                  const available = zoneAvailable(z);
                  if(!available){
                    return `<button type="button" disabled title="No rate for ${lbl} in this agent's Rate Type" style="flex:1;padding:4px 8px;font-size:10.5px;font-weight:700;border:none;background:transparent;color:#c4c2bb;border-radius:4px;cursor:not-allowed;font-family:inherit;letter-spacing:.02em;text-decoration:line-through;text-decoration-color:#c4c2bb80;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lbl}</button>`;
                  }
                  return `<button type="button" onclick="bookingV2SetTripField(${idx},'zone','${z}')" style="flex:1;padding:4px 8px;font-size:10.5px;font-weight:700;border:none;background:${on?'var(--white)':'transparent'};color:${on?'var(--bk-navy)':'var(--ink-soft)'};border-radius:4px;cursor:pointer;font-family:inherit;letter-spacing:.02em;${on?'box-shadow:0 1px 2px rgba(0,0,0,.06)':''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lbl}</button>`;
                }).join('')}
              </div>`;
            })()}
          </div>
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Subtotal${d.priceMode==='manual'?' · <span style="color:#A05A1A;font-weight:700">overridden</span>':''}</label>
            <div style="padding:8px 11px;font-family:Manrope,sans-serif;font-size:15px;font-weight:700;${d.priceMode==='manual'?'color:var(--ink-soft);text-decoration:line-through;opacity:.65':'color:var(--bk-navy)'};background:#f8f7f3;border:1px solid var(--border);border-radius:var(--r-sm);text-align:right;font-variant-numeric:tabular-nums;letter-spacing:-.01em" title="${d.priceMode==='manual'?'Rate-type reference only — Manual total is used':''}">&#3647;${(subtotal.total||0).toLocaleString()}${subtotal.bundle?` <span style="font-size:9px;color:var(--ink-soft);font-weight:500;font-family:'DM Sans',sans-serif">incl. ฿${subtotal.bundle.toLocaleString()} bundle</span>`:''}</div>
            ${d.priceMode==='manual'?`<div style="font-size:9.5px;color:#A05A1A;margin-top:4px;text-align:right;font-family:'DM Sans',sans-serif">ใช้ราคา Manual &#3647;${(Number(d.manualTotal)||0).toLocaleString()} ทั้งใบ · ตัวเลขบนเป็นเรทอ้างอิง</div>`:''}
          </div>
        </div>
        <div style="margin-top:8px">
          <div style="font-size:8px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;margin-bottom:3px">PAX &middot; FR + TH mixed</div>
          <table style="width:100%;border-collapse:separate;border-spacing:1px;font-size:10px">
            <thead><tr>
              <th style="background:#f5f3ef;padding:3px 6px;text-align:left;font-size:8px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;border-radius:7px 0 0 7px;width:62px"></th>
              <th style="background:#f5f3ef;padding:3px 0;text-align:center;font-size:8px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em">AD</th>
              <th style="background:#f5f3ef;padding:3px 0;text-align:center;font-size:8px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em">CHD</th>
              <th style="background:#f5f3ef;padding:3px 0;text-align:center;font-size:8px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em">INF</th>
              <th style="background:#f5f3ef;padding:3px 0;text-align:center;font-size:8px;color:#ba7517;font-weight:700;letter-spacing:.06em;border-radius:0 7px 7px 0">FOC</th>
            </tr></thead>
            <tbody>
              ${( (rt&&typeof rtNatScopeOf==='function'?rtNatScopeOf(rt):'both')!=='thai' || ((t.pax.ad_fr||0)+(t.pax.chd_fr||0)+(t.pax.inf_fr||0)+(t.pax.foc_fr||0))>0 ) ? `<tr>
                <td style="background:var(--white);padding:3px 6px;font-weight:600;font-size:10px">🌐 FR</td>
                <td style="background:var(--white);padding:2px 0;text-align:center">${stepper(idx,'ad_fr',t.pax.ad_fr||0)}</td>
                <td style="background:var(--white);padding:2px 0;text-align:center">${stepper(idx,'chd_fr',t.pax.chd_fr||0)}</td>
                <td style="background:var(--white);padding:2px 0;text-align:center">${stepper(idx,'inf_fr',t.pax.inf_fr||0)}</td>
                <td style="background:var(--white);padding:2px 0;text-align:center">${stepper(idx,'foc_fr',t.pax.foc_fr||0)}</td>
              </tr>` : ''}
              ${( (rt&&typeof rtNatScopeOf==='function'?rtNatScopeOf(rt):'both')!=='fr' || ((t.pax.ad_th||0)+(t.pax.chd_th||0)+(t.pax.inf_th||0)+(t.pax.foc_th||0))>0 ) ? `<tr>
                <td style="background:var(--white);padding:3px 6px;font-weight:600;font-size:10px">🇹🇭 TH</td>
                <td style="background:var(--white);padding:2px 0;text-align:center">${stepper(idx,'ad_th',t.pax.ad_th||0)}</td>
                <td style="background:var(--white);padding:2px 0;text-align:center">${stepper(idx,'chd_th',t.pax.chd_th||0)}</td>
                <td style="background:var(--white);padding:2px 0;text-align:center">${stepper(idx,'inf_th',t.pax.inf_th||0)}</td>
                <td style="background:var(--white);padding:2px 0;text-align:center">${stepper(idx,'foc_th',t.pax.foc_th||0)}</td>
              </tr>` : ''}
              <tr style="background:var(--bk-navy-50)">
                <td style="padding:3px 6px;font-size:8px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em">SUB</td>
                <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:700;font-variant-numeric:tabular-nums;color:${totAd>0?'var(--bk-navy)':'#c7c5bb'};font-size:11px">${totAd}</td>
                <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:700;font-variant-numeric:tabular-nums;color:${totChd>0?'var(--bk-navy)':'#c7c5bb'};font-size:11px">${totChd}</td>
                <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:700;font-variant-numeric:tabular-nums;color:${totInf>0?'var(--bk-navy)':'#c7c5bb'};font-size:11px">${totInf}</td>
                <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:700;font-variant-numeric:tabular-nums;color:${totFoc?'#ba7517':'#c7c5bb'};font-size:11px">${totFoc}</td>
              </tr>
              ${/* §pkNat · สัญชาติจริงของ นทท. · ไม่เกี่ยวกับราคาเลย ใช้ตอนซื้อตั๋วอุทยานอย่างเดียว
                    สองแถวบนเลือกเรทตามสัญญา · บางสัญญาไม่มีราคาไทย คนไทยจึงต้องคีย์เป็น ตปท.
                    แถวนี้บอกความจริงว่าใครเป็นคนไทย ค่าอุทยานจะได้ไม่จ่ายเรทฝรั่งให้คนไทย */''}
              <tr style="background:#EAF6F0">
                <td style="padding:3px 6px;font-weight:700;font-size:10px;color:#0F6E56;border-radius:0 0 0 7px" title="จำนวนคนไทยจริงบนทริปนี้ · ใช้คิดค่าอุทยานอย่างเดียว ไม่กระทบราคาที่นั่ง">&#128506; ไทยจริง</td>
                <td style="padding:2px 0;text-align:center">${natStep(idx,'ad',t)}</td>
                <td style="padding:2px 0;text-align:center">${natStep(idx,'chd',t)}</td>
                <td style="padding:2px 0;text-align:center">${natStep(idx,'inf',t)}</td>
                <td style="padding:2px 0;text-align:center;border-radius:0 0 7px 0">${natStep(idx,'foc',t)}</td>
              </tr>
              ${bkNatHas(t) && (bkNatTH(t,'ad')+bkNatTH(t,'chd')+bkNatTH(t,'inf')+bkNatTH(t,'foc')) !== ((t.pax.ad_th||0)+(t.pax.chd_th||0)+(t.pax.inf_th||0)+(t.pax.foc_th||0)) ? `<tr><td colspan="5" style="padding:4px 7px;font-size:9.5px;color:#0F6E56;background:#EAF6F0;line-height:1.35">&#8226; ค่าอุทยานจะคิดตามแถวนี้ ไม่ใช่แถว TH &middot; ราคาที่นั่งยังคิดตามสัญญาเหมือนเดิม</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        ${(t.ovn==='return' && t.date && t.ovnReturnDate)?((d.trips||[]).some(x=>x.ovnLeg&&x.routeId===t.routeId&&x.date===t.ovnReturnDate)?`<div style="margin-top:9px;font-size:10.5px;color:#0F6E56;font-weight:600;background:#E9F7EF;border-radius:7px;padding:8px 11px">&#10003; สร้าง trip ขากลับวัน ${escapeHTML(t.ovnReturnDate||'')} แล้ว · กันที่นั่งเรียบร้อย (ดู TRIP ถัดไป)</div>`:`<button type="button" onclick="bookingV2CreateOvnReturnLeg(${idx})" style="margin-top:9px;width:100%;background:#5B289A;color:#fff;border:none;border-radius:8px;padding:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#128679; สร้าง trip ขากลับ (${escapeHTML(t.ovnReturnDate||'')}) + กันที่นั่ง</button>`):''}
      </div>
    `;
  }).join('');

  return `
    ${tripRows}
    <button onclick="bookingV2AddTrip()" style="margin-top:8px;width:100%;background:transparent;border:1px dashed var(--border);color:var(--ink-soft);padding:9px;border-radius:var(--r-sm);cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">+ Add another trip</button>
  `;
}
