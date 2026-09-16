function bookingV2RenderAddOnsSection(){
  const d = _bkV2.newBooking;
  if(!Array.isArray(d.addOns)) d.addOns = [];   // ponytail: legacy bookings have no addOns array → edit crashed on .find/.some
  const rt = bookingV2GetRT();
  if(!rt){
    // §b2cEdit · add-on ของใบ B2C ถูกลบแล้วใส่ใหม่ทุกรอบ sync · โชว์ของที่มีจริงแบบอ่านอย่างเดียว
    if(typeof bookingV2IsB2CBk==='function' && bookingV2IsB2CBk(d)){
      var _e=function(x){ return String(x||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
      var _li=(d.addOns||[]).map(function(a){
        return '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:11.5px">'
          +'<span>'+_e(a.label||a.type)+(a.qty>1?(' &times; '+a.qty):'')+'</span>'
          +'<span style="font-family:\'DM Mono\',monospace">&#3647;'+(Number(a.amount)||0).toLocaleString()+'</span></div>';
      }).join('');
      return '<div style="font-size:11.5px;color:var(--ink-soft);padding:4px 0">'
        +(_li||'<span style="font-style:italic">ไม่มี add-on</span>')
        +'<div style="font-size:10.5px;color:#8a7a58;margin-top:6px">มาจาก B2C &middot; แก้ที่ B2C เท่านั้น</div></div>';
    }
    return `<div style="font-size:12px;color:var(--ink-soft);font-style:italic;padding:12px 0">Pick an agent first to see available add-ons.</div>`;
  }

  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const checked = type => d.addOns.some(a => a.type === type);
  const opts = [];

  // Check if any selected trip route has bundled longtail · disable Longtail Join in that case
  const bundledRoutes = d.trips
    .filter(t => t.routeId && _rtBundleAppliesTo(rt.routeBundles?.[t.routeId]?.longtail, t.bookingMode==='charter'))
    .map(t => ({ rid: t.routeId, mode: rt.routeBundles[t.routeId].longtail.mode, name: (typeof ROUTES!=='undefined' ? ROUTES.find(r=>r.id===t.routeId)?.name : t.routeId) }));

  // Filter longtail by applies[] · per-route pricing (Option A) · only show if a trip route applies
  const tripRouteIds = d.trips.map(t => t.routeId).filter(Boolean);
  const ltn = (typeof _rtNormalizeLongtail==='function') ? _rtNormalizeLongtail(rt.addOns?.longtail) : null;
  const ltApplyIds = ltn ? (ltn.applies.length ? tripRouteIds.filter(r=>ltn.applies.includes(r)) : tripRouteIds) : [];
  const longtailApplicable = !!(ltn && ltApplyIds.length);
  const ltJoinRoutes = longtailApplicable ? ltApplyIds.map(r=>(ltn.byRoute[r]||{join:ltn.join}).join||{}).filter(j=>j.adult||j.child) : [];
  if(longtailApplicable && ltJoinRoutes.length){
    const info = bookingV2AddOnInfo('longtail-join');
    const locked = bundledRoutes.length > 0;
    const uniq = [...new Set(ltJoinRoutes.map(j=>`${j.adult||0}/${j.child||0}`))];
    const priceSub = uniq.length===1 ? `฿${ltJoinRoutes[0].adult||0}/A · ฿${ltJoinRoutes[0].child||0}/C` : `ราคาตามเส้นทาง`;
    opts.push({
      type:'longtail-join',
      label:`Longtail Join`,
      sub: locked ? `Locked &middot; bundled in ${bundledRoutes.map(b=>b.name).join(' &middot; ')}` : priceSub,
      amount: info.total,
      locked
    });
  }
  const ltCharterRoutes = longtailApplicable ? ltApplyIds.map(r=>(ltn.byRoute[r]||{charter:ltn.charter}).charter||{}).filter(c=>c.price) : [];
  if(longtailApplicable && ltCharterRoutes.length){
    const info = bookingV2AddOnInfo('longtail-charter');
    const uniq = [...new Set(ltCharterRoutes.map(c=>`${c.price}/${c.capacity||6}`))];
    const sub = uniq.length===1 ? `฿${ltCharterRoutes[0].price}/boat · max ${ltCharterRoutes[0].capacity||6} pax` : `ราคาตามเส้นทาง · per boat`;
    opts.push({ type:'longtail-charter', label:`Longtail Charter`, sub, amount: info.total });
  }
  // Private Van (เหมารถ) · offered for EVERY pickup zone the rate prices (PK/KL), independent of the seat
  // zone. A PK/KL seat price already bundles a SHARED transfer, so a private van must sit on a No-Transfer
  // seat (+ this charge) or the transfer is paid twice — bookingV2ToggleAddOn switches the seat to No-Transfer
  // when a private van is added. Selectable in multiples (qty · rare) and dedicated (not shared).
  // Van ops (By-trip / assignment / job order) is wired in Phase 2.
  const ptMap = rt.addOns?.privateTransfer || {};
  d.trips.forEach(t => {
    if(!t.routeId) return;
    const routePt = ptMap[t.routeId];
    if(!routePt || typeof routePt !== 'object') return;
    const rName = (typeof ROUTES!=='undefined' ? (ROUTES.find(r=>r.id===t.routeId)||{}).name : t.routeId) || t.routeId;
    Object.entries(routePt).forEach(([zone, zoneOpts]) => {
      if(!zoneOpts || typeof zoneOpts !== 'object') return;   // route map = zone→{vehicle:price}
      const zLabel = zone==='PK' ? 'Phuket' : zone==='KL' ? 'Khao Lak' : zone;
      Object.entries(zoneOpts).forEach(([vehicle, price]) => {
        if(!price) return;                                    // 0 = not offered (e.g. sedan)
        const type = `transfer-${t.routeId}-${zone}-${vehicle}`;
        if(opts.some(o => o.type === type)) return;
        opts.push({ type, label:`Private ${vehicle.charAt(0).toUpperCase()+vehicle.slice(1)} · ${zLabel}`, sub:`เหมารถรับ ${zLabel} · ${rName} · ฿${price}/คัน · dedicated (ไม่แชร์)`, amount: price });
      });
    });
  });

  if(opts.length === 0) return `<div style="font-size:12px;color:var(--ink-soft);font-style:italic;padding:12px 0">No add-ons available for this rate type · or pick trips first to enable transfer options.</div>`;

  return `
    <div class="bkv2-nb-addons">
      ${opts.map(o => { const _sel=d.addOns.find(x=>x.type===o.type); const _q=_sel?(_sel.qty||1):1; const _isChtr=o.type==='longtail-charter'; const _isVan=o.type.indexOf('transfer-')===0; const _isQty=_isChtr||_isVan; const _on=checked(o.type)&&!o.locked; const _amt=(o.amount||0)*((_isQty&&_on)?_q:1); const _btn='width:22px;height:22px;border-radius:6px;border:1px solid var(--border);background:#fff;color:var(--bk-navy);font-size:13px;font-weight:700;cursor:pointer;line-height:1;font-family:inherit'; const _qLbl=_isChtr?'ลำ':'คัน'; return `
        <label class="bkv2-nb-addon ${checked(o.type)?'on':''}" style="${o.locked?'opacity:.55;cursor:not-allowed;background:#fafafa':''}">
          <input type="checkbox" ${checked(o.type) && !o.locked?'checked':''} ${o.locked?'disabled':''} onchange="${o.locked?'':`bookingV2ToggleAddOn('${o.type}')`}">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:12px;color:var(--ink)">${escapeHTML(o.label)} ${o.locked?'<span style="background:#0F6E56;color:#fff;font-size:8px;padding:1px 5px;border-radius:3px;font-weight:700;letter-spacing:.06em;margin-left:4px;vertical-align:middle">LOCKED</span>':''}</div>
            <div style="font-size:10px;color:var(--ink-soft);margin-top:1px;font-family:'DM Mono',monospace">${o.sub}</div>
            ${(_isQty&&_on)?`<div onclick="event.preventDefault();event.stopPropagation()" style="display:inline-flex;align-items:center;gap:7px;margin-top:7px;background:#F4F8FC;border:1px solid #DCE7F2;border-radius:8px;padding:4px 8px"><span style="font-size:10px;font-weight:600;color:var(--bk-navy)">จำนวน${_qLbl}</span><button type="button" onclick="event.preventDefault();event.stopPropagation();bookingV2SetAddOnQty('${o.type}',${_q-1})" style="${_btn}">&minus;</button><span style="font-size:13px;font-weight:700;min-width:16px;text-align:center;font-variant-numeric:tabular-nums">${_q}</span><button type="button" onclick="event.preventDefault();event.stopPropagation();bookingV2SetAddOnQty('${o.type}',${_q+1})" style="${_btn}">+</button><span style="font-size:10px;color:var(--ink-soft)">${_qLbl}</span></div>`:''}
            ${(_on&&(o.type==='longtail-join'||o.type==='longtail-charter'))?`<div onclick="event.preventDefault();event.stopPropagation()" style="margin-top:7px"><input type="text" value="${escapeHTML((_sel&&_sel.note)||'')}" oninput="bookingV2SetAddOnNote('${o.type}',this.value)" placeholder="หมายเหตุหางยาว · เช่น จุดลงเรือ / เวลานัด / ผู้ติดต่อ" style="width:100%;box-sizing:border-box;height:28px;border:1px solid #DCE7F2;border-radius:7px;padding:0 9px;font-size:11px;font-family:inherit;background:#fff;color:var(--ink)"></div>`:''}
          </div>
          <div style="font-family:Manrope,sans-serif;font-weight:700;color:${o.locked?'var(--ink-soft)':'var(--bk-navy)'};font-size:14px;font-variant-numeric:tabular-nums;letter-spacing:-.01em">${o.locked?'—':`฿${_amt.toLocaleString()}`}</div>
        </label>
      `; }).join('')}
    </div>
  `;
}
