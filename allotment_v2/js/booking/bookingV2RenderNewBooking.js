// New Booking form (P2 · single page · navy theme)
function bookingV2RenderNewBooking(){
  const d = _bkV2.newBooking;
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  // Agent dropdown · group by market · only active
  const agentsByMarket = {};
  (SB_AGENTS||[]).forEach(a => {
    if(a.active === false) return;
    const m = a.market || 'other';
    if(!agentsByMarket[m]) agentsByMarket[m] = [];
    agentsByMarket[m].push(a);
  });
  const mktName = (mid) => {
    if(typeof SB_MARKETS === 'undefined') return mid;
    const m = SB_MARKETS.find(x => x.id === mid);
    return m?.name || mid;
  };
  // Build flat list for datalist · prefix with market label since datalist can't use optgroup
  const agentFlatList = Object.entries(agentsByMarket).sort((a,b) => mktName(a[0]).localeCompare(mktName(b[0]))).flatMap(([mid, agents]) => {
    return agents.map(a => ({
      id: a.id,
      label: `[${mktName(mid)}] ${a.code} · ${a.name}`
    }));
  });
  const agentDataList = agentFlatList.map(o => `<option value="${escapeHTML(o.label)}"></option>`).join('');
  const currentAgentLabel = (function(){
    if(!d.agentId) return '';
    const a = sbGetAgent(d.agentId);
    if(!a) return '';
    return `[${mktName(a.market)}] ${a.code} · ${a.name}`;
  })();

  // Rate Type preview (from selected agent)
  const rt = d.rateTypeRef ? (SB_RATE_TYPES||[]).find(r => r.id === d.rateTypeRef) : null;
  const agent = d.agentId ? sbGetAgent(d.agentId) : null;
  const isWalkin = !!(agent && (agent.code==='WALKIN' || agent.id==='a_walkin'));   // direct/walk-in house account
  const isStaff  = !!(agent && (agent.code==='STAFF'  || agent.id==='a_staff'));    // staff welfare/inspection house account
  const isHouse  = isWalkin || isStaff;   // house accounts → Sold-by/Staff picker + manual price option
  let rtPreview = '';
  if(rt){
    /* §bkRouteSrc · เลขตรงนี้เคยนับจาก Rate Type อย่างเดียว ทั้งที่ตัวที่คุม
       dropdown จริง ๆ คือโปรแกรมในสัญญาของเอเยนต์ · เลขสองตัวไม่ตรงกัน
       แล้วไม่มีอะไรบอก คนใช้จึงคิดว่าเพิ่มเส้นทางแล้วระบบไม่ขึ้น */
    const _bk = bookingV2BookableRoutes();
    const _n = _bk.ids.length, _rtN = _bk.rtIds.length;
    const validFrom = rt.validFrom || '—';
    const validTo = rt.validTo || '—';
    const _short = (_bk.src === 'contract' && _rtN > _n);
    rtPreview = `
      <div class="bkv2-nb-rt-preview">
        <div><strong>${escapeHTML(rt.code)} &middot; ${escapeHTML(rt.name)}</strong></div>
        <div class="meta">${_n} route${_n===1?'':'s'} bookable${_rtN&&_rtN!==_n?(' &middot; '+_rtN+' in rate type'):''} &middot; valid ${validFrom} &rarr; ${validTo}</div>
        ${_short?`<div class="meta" style="color:#8A5A0B;margin-top:3px">&#9888; \u0e40\u0e2a\u0e49\u0e19\u0e17\u0e32\u0e07\u0e17\u0e35\u0e48\u0e08\u0e2d\u0e07\u0e44\u0e14\u0e49\u0e22\u0e36\u0e14\u0e15\u0e32\u0e21\u0e42\u0e1b\u0e23\u0e41\u0e01\u0e23\u0e21\u0e43\u0e19\u0e2a\u0e31\u0e0d\u0e0d\u0e32\u0e02\u0e2d\u0e07\u0e40\u0e2d\u0e40\u0e22\u0e19\u0e15\u0e4c &middot; \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e43\u0e19 Rate Type \u0e2d\u0e22\u0e48\u0e32\u0e07\u0e40\u0e14\u0e35\u0e22\u0e27\u0e22\u0e31\u0e07\u0e08\u0e2d\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 \u0e15\u0e49\u0e2d\u0e07\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e17\u0e35\u0e48\u0e2b\u0e19\u0e49\u0e32 Agent \u0e14\u0e49\u0e27\u0e22</div>`:''}
      </div>
    `;
  } else if(typeof bookingV2IsB2CBk==='function' && bookingV2IsB2CBk(d)){
    // §b2cEdit · ใบ B2C ไม่ต้องมี Rate Type · ราคามาจากต้นทางโดยตรง · การไปผูกเรทให้เอเจนต์ B2C
    //   จะทำให้ระบบคิดราคาใหม่ทับยอดที่ลูกค้าจ่ายจริง ซึ่งผิดกว่าเดิม
    rtPreview = `<div class="bkv2-nb-rt-preview" style="background:#EEF5FF;border-color:#C3D8F2;color:#185FA5"><strong>ราคามาจาก B2C โดยตรง</strong><div class="meta">&#3647;${Number(d.manualTotal||0).toLocaleString()} &middot; ไม่ต้องผูก Rate Type &middot; ยอดเงิน ทริป และจำนวนคน แก้ที่ B2C เท่านั้น &middot; ที่แก้ได้ในหน้านี้คือจุดรับ-ส่ง ผู้ติดต่อ และข้อมูลปฏิบัติการ</div></div>`;
  } else if(d.agentId){
    rtPreview = `<div class="bkv2-nb-rt-preview" style="background:#FFF6E5;border-color:#EAD9B0;color:#633806"><strong>&#9888; No Rate Type bound</strong><div class="meta">This agent has no Rate Type assigned · go to Agent List to bind one before proceeding</div></div>`;
  }

  // Format created date
  const createdAt = new Date(d.createdAt);
  const createdStr = createdAt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

  // §b2cEdit · ใบ B2C ผ่านได้โดยไม่ต้องมีเรทและไม่ต้องมียอด (ใบ ฿0 ก็ยังต้องแก้จุดรับได้)
  const canContinue = d.agentId && d.leadPax && (d.rateTypeRef || (d.priceMode==='manual' && Number(d.manualTotal)>0)
    || (typeof bookingV2IsB2CBk==='function' && bookingV2IsB2CBk(d)));

  return `
    <div class="bkv2-nb">
      <div class="bkv2-nb-topbar">
        <button class="bkv2-nb-back" onclick="bookingV2CloseNewBooking()">&larr; ${_bkV2.editingId?'Back to detail':'Back to list'}</button>
        <div class="bkv2-nb-h1">${_bkV2.editingId?'Edit Booking':'New Booking'}</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--ink-soft);margin-left:6px">${_bkV2.editingId?d.id:d.code}</div>
        <div class="bkv2-nb-draft" style="${_bkV2.editingId?'background:#dbeafe;color:#1e40af':''}"><span class="dot" style="${_bkV2.editingId?'background:#1e40af':''}"></span>${_bkV2.editingId?'Editing':'Draft'}</div>
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;background:transparent;min-height:calc(100vh - 80px)">
       <div>

      <div class="bkv2-nb-sec">
        <div class="bkv2-nb-sec-h">&#9679; Agent &amp; Voucher</div>
        <div class="bkv2-nb-row" style="grid-template-columns:minmax(0,2.2fr) minmax(0,1fr)">
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Agent * <em style="font-weight:500;color:#b4b2a9;font-style:normal">· type to search</em></label>
            <div class="bkv2-nb-ddwrap">
              <input id="bkv2-agent-input" class="bkv2-nb-input" type="text" placeholder="Type code, name, or market..." value="${escapeHTML(currentAgentLabel)}" autocomplete="off" oninput="bookingV2AgentDDFilter(this.value)" onfocus="bookingV2AgentDDShow()" onkeydown="bookingV2AgentDDKey(event)" style="text-overflow:ellipsis">
              <div id="bkv2-agent-dd" class="bkv2-nb-dd"></div>
            </div>
          </div>
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Voucher ref <em style="font-weight:500;color:#b4b2a9;font-style:normal">· from agent</em></label>
            <input class="bkv2-nb-input" type="text" placeholder="e.g. AT-VC-25060042" value="${escapeHTML(d.voucherRef||'')}" oninput="bookingV2SetBookingField('voucherRef', this.value);bookingV2VoucherLiveCheck(this.value)">
            <div id="bkv2-voucher-dup-warn" style="margin-top:4px">${(typeof bookingV2VoucherDupHtml==='function')?bookingV2VoucherDupHtml(d.voucherRef||''):''}</div>
          </div>
        </div>
        <div class="bkv2-nb-row" style="grid-template-columns:${isHouse?'1fr 1fr 1fr 1fr':'1fr 1fr 1fr'}">
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Booking date <em style="font-weight:500;color:#b4b2a9;font-style:normal">· default today</em></label>
            <input class="bkv2-nb-input" type="date" value="${escapeHTML(d.bookingDate||new Date().toISOString().slice(0,10))}" onchange="bookingV2SetBookingField('bookingDate', this.value)">
          </div>
          ${isWalkin ? `<div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Sold by <em style="font-weight:500;color:#b4b2a9;font-style:normal">· sales credit</em></label>
            <select class="bkv2-nb-input" onchange="bookingV2SetBookingField('soldBy', this.value)"><option value="">— select sales —</option>${(typeof SB_SALES!=='undefined'?SB_SALES:[]).map(s=>`<option value="${s.id}" ${d.soldBy===s.id?'selected':''}>${escapeHTML(s.name)}</option>`).join('')}</select>
          </div>` : ''}
          ${isStaff ? (function(){ const yr=(d.bookingDate||'').slice(0,4)||String(new Date().getFullYear()); const sp=d.staffPurpose||'welfare'; const rem=d.staffId?staffRemaining(d.staffId,yr):null;
            return `<div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Purpose <em style="font-weight:500;color:#b4b2a9;font-style:normal">· staff trip</em></label>
            <select class="bkv2-nb-input" onchange="bookingV2SetBookingField('staffPurpose', this.value)"><option value="welfare" ${sp==='welfare'?'selected':''}>สวัสดิการ · Welfare (ใช้โควต้า)</option><option value="inspection" ${sp==='inspection'?'selected':''}>ตรวจงาน · Inspection (ไม่ใช้โควต้า)</option></select>
          </div>
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Staff member <em style="font-weight:500;color:#b4b2a9;font-style:normal">· ${sp==='inspection'?'inspection':'welfare'}</em></label>
            <select class="bkv2-nb-input" onchange="bookingV2SetBookingField('staffId', this.value)"><option value="">— select staff —</option>${(typeof SB_STAFF!=='undefined'?SB_STAFF:[]).filter(s=>s.active).map(s=>`<option value="${s.id}" ${d.staffId===s.id?'selected':''}>${escapeHTML(s.name||s.code)}</option>`).join('')}</select>
            ${d.staffId&&sp==='welfare'?`<div style="font-size:10.5px;margin-top:3px;color:${rem<=0?'#A32D2D':'#0F6E56'}">โควต้าฟรีเหลือ ${rem} ที่นั่ง (ปี ${yr})</div>`:''}
            ${sp==='welfare'?`<div style="font-size:10px;margin-top:3px;color:#8a8a82;line-height:1.4">ใช้สิทธิ์ฟรี → ใส่เป็น <b>FOC</b> (หักโควต้า) · เกินโควต้า/จ่ายเงิน → ใส่เป็น <b>ผู้ใหญ่/เด็ก</b> คิดตามเรท <b>Staff Welfare</b></div>`:''}
            ${sp==='inspection'?`<div style="font-size:10.5px;margin-top:3px;color:#6c5ce7">ตรวจงาน · นับที่นั่งใน manifest · ไม่หักโควต้า</div>`:''}
          </div>`; })() : ''}
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Submitted by</label>
            <input class="bkv2-nb-input" type="text" placeholder="name / initials" value="${escapeHTML(d.createdBy||'')}" oninput="bookingV2SetBookingField('createdBy', this.value)">
          </div>
          <div class="bkv2-nb-field">
            <label class="bkv2-nb-label">Confirmed by <span style="font-weight:400;color:#9aa">· auto = ผู้ล็อกอิน</span></label>
            <input class="bkv2-nb-input" type="text" placeholder="auto = ผู้ล็อกอิน" value="${escapeHTML(d.confirmedBy||'')}" oninput="bookingV2SetBookingField('confirmedBy', this.value)">
          </div>
        </div>
        ${rtPreview}
        ${isHouse ? `<div style="margin-top:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="bkv2-nb-label" style="margin:0">Pricing</span>
          <div style="display:inline-flex;gap:3px;background:var(--sand-mid);border-radius:9px;padding:3px">
            <button type="button" onclick="bookingV2SetBookingField('priceMode','rate')" style="border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;${d.priceMode!=='manual'?'background:var(--bk-navy);color:#fff':'background:transparent;color:var(--ink-soft)'}">Rate type</button>
            <button type="button" onclick="bookingV2SetBookingField('priceMode','manual')" style="border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;${d.priceMode==='manual'?'background:var(--bk-navy);color:#fff':'background:transparent;color:var(--ink-soft)'}">Manual · walk-in</button>
          </div>
          ${d.priceMode==='manual' ? `<div style="display:flex;align-items:center;gap:6px"><span class="bkv2-nb-label" style="margin:0">Total &#3647;</span><input class="bkv2-nb-input" type="number" min="0" style="width:130px" value="${escapeHTML(String(d.manualTotal||0))}" onchange="bookingV2SetBookingField('manualTotal', this.value)"></div>` : ''}
        </div>` : ''}
      </div>

      ${bookingV2HasAvailableAddOns() ? `
        <div class="bkv2-nb-sec">
          <div style="display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:20px">
            <div>
              <div class="bkv2-nb-sec-h">&#9679; Trips &amp; Pax</div>
              ${bookingV2RenderTripsSection()}
            </div>
            <div>
              <div class="bkv2-nb-sec-h">&#9679; Add-ons</div>
              ${bookingV2RenderAddOnsSection()}
            </div>
          </div>
        </div>
      ` : `
        <div class="bkv2-nb-sec">
          <div class="bkv2-nb-sec-h">&#9679; Trips &amp; Pax</div>
          ${bookingV2RenderTripsSection()}
        </div>
      `}

      <div class="bkv2-nb-sec">
        <div class="bkv2-nb-sec-h">&#9679; Guests <em style="font-weight:500;color:#b4b2a9;font-style:normal;font-size:11px;text-transform:none;letter-spacing:0">&middot; lead + auto-sized to Adult pax</em><button type="button" onclick="bookingV2GroupPasteOpen()" title="Paste a whole group (30-40 pax) at once" style="margin-left:auto;display:inline-flex;align-items:center;gap:5px;background:#E6F1FB;color:#185FA5;border:1px solid #C5D8EA;border-radius:8px;font-family:inherit;font-size:11px;font-weight:600;padding:5px 11px;cursor:pointer;text-transform:none;letter-spacing:0">&#128203; Paste group list</button></div>
        <!-- Unified guest table · Lead = #1 with badge · additional passengers #2+ -->
        <div style="background:#fafafa;border:1px solid var(--border);border-radius:var(--r-sm);overflow:visible">
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <colgroup>
              <col style="width:38px">
              <col>
              <col style="width:180px">
              <col style="width:62px">
            </colgroup>
            <thead><tr style="background:#f5f3ef">
              <th style="padding:6px;text-align:left;font-size:9px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em">#</th>
              <th style="padding:6px;text-align:left;font-size:9px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em">Full Name</th>
              <th style="padding:6px;text-align:left;font-size:9px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em">Nationality</th>
              <th style="padding:6px;text-align:center;font-size:9px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em"></th>
            </tr></thead>
            <tbody>
              <!-- Lead pax row (#1) -->
              <tr style="background:var(--bk-navy-50)">
                <td style="padding:6px 6px;vertical-align:middle">
                  <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--bk-navy);font-weight:700;line-height:1.1">#1</div>
                  <div style="background:var(--bk-navy);color:#fff;font-size:7px;font-weight:700;padding:1px 4px;border-radius:2px;letter-spacing:.08em;display:inline-block;margin-top:2px">LEAD</div>
                  ${(d.leadType&&d.leadType!=='AD')?`<div style="background:${d.leadType==='FOC'?'#FCE9B5':'#E6F1FB'};color:${d.leadType==='FOC'?'#7A5A12':'#185FA5'};font-size:7px;font-weight:700;padding:1px 4px;border-radius:2px;letter-spacing:.06em;display:inline-block;margin-top:2px">${d.leadType}</div>`:''}
                  ${((d.trips||[]).some(t=>bookingV2PaxTot(t.pax,'foc')>0))?`<div onclick="event.stopPropagation();bookingV2ToggleLeadFoc()" title="${d.leadFoc?'Lead เป็น FOC · คลิกเพื่อยกเลิก':'ตั้ง Lead เป็น FOC (ฟรี · ไม่ต้องมี Adult)'}" style="cursor:pointer;font-size:13px;line-height:1;margin-top:3px;color:${d.leadFoc?'#D9A400':'#cfcabd'}">${d.leadFoc?'★':'☆'} <span style="font-size:7px;color:#a8a59e;vertical-align:1px;letter-spacing:.04em">FOC</span></div>`:''}
                </td>
                <td style="padding:5px 6px">
                  <input class="bkv2-nb-input" type="text" placeholder="Lead pax name *" value="${escapeHTML(d.leadPax)}" oninput="bookingV2SetBookingField('leadPax', this.value)" onblur="bookingV2Render()" style="padding:6px 8px;font-size:12px;width:100%;box-sizing:border-box">
                </td>
                <td style="padding:5px 6px">
                  <div class="bkv2-nb-ddwrap">
                    <input id="bkv2-nat-input-lead" class="bkv2-nb-input" type="text" placeholder="Type or pick…" autocomplete="off" value="${d.leadNationality ? escapeHTML(bookingV2NatDDLabel(d.leadNationality)) : ''}" oninput="bookingV2NatDDFilter('lead', this.value)" onfocus="bookingV2NatDDShow('lead')" onkeydown="bookingV2NatDDKey(event,'lead')" onblur="bookingV2NatDDBlur('lead')" style="padding:6px 8px;font-size:12px;width:100%;box-sizing:border-box">
                    <div id="bkv2-nat-dd-lead" class="bkv2-nb-dd"></div>
                  </div>
                </td>
                <td style="padding:5px 6px;text-align:center">${d.leadNationality && bookingV2GuessNationality(d.leadPax||'') === d.leadNationality ? '<span style="background:#E1F5EE;color:#0F6E56;font-size:8px;padding:1px 5px;border-radius:3px;font-weight:600;letter-spacing:.06em">GUESS</span>' : ''}</td>
              </tr>
              <!-- Lead contact sub-row · phone + email -->
              <tr style="background:var(--bk-navy-50);border-bottom:1px solid var(--bk-navy-light)">
                <td></td>
                <td colspan="3" style="padding:0 6px 8px">
                  <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:8px;margin-top:-2px">
                    <input class="bkv2-nb-input" type="text" placeholder="📞 Phone · +66 ..." value="${escapeHTML(d.leadPhone)}" oninput="bookingV2SetBookingField('leadPhone', this.value)" style="padding:5px 8px;font-size:11px;box-sizing:border-box">
                    <input class="bkv2-nb-input" type="email" placeholder="✉️ Email · lead@example.com" value="${escapeHTML(d.leadEmail)}" oninput="bookingV2SetBookingField('leadEmail', this.value)" style="padding:5px 8px;font-size:11px;box-sizing:border-box">
                  </div>
                </td>
              </tr>
              ${bookingV2RenderPassengerRows()}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bkv2-nb-sec">
        <div class="bkv2-nb-sec-h">&#9679; Pickup &amp; Drop-off</div>
        ${bookingV2RenderPickupSection()}
      </div>

      <!-- Combined: Dietary + Guides in ONE card -->
      <div class="bkv2-nb-sec">
        <div class="bkv2-nb-sec-h">&#9679; Dietary, Luggage &amp; Guides</div>
        ${bookingV2RenderDietaryLuggageSection()}
        <div style="height:1px;background:var(--border);margin:14px 0 12px"></div>
        ${(() => {
          const g = d.guides || { english:false, russian:false, chinese:false, otherLang:'' };
          const guidePill = (key, on, lbl, flagSvg) =>
            `<label style="display:inline-flex;align-items:center;gap:7px;padding:6px 12px;background:${on?'#E1F5EE':'var(--white)'};border:1px solid ${on?'#9FE1CB':'var(--border)'};border-radius:14px;cursor:pointer;font-size:11.5px;font-weight:600;color:${on?'#0F6E56':'var(--ink-soft)'}"><input type="checkbox" ${on?'checked':''} onchange="bookingV2ToggleGuide('${key}',this.checked)" style="accent-color:#0F6E56;margin:0;width:14px;height:14px">${flagSvg}<span>${lbl}</span></label>`;
          return `
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-bottom:10px">
              <span style="font-size:10px;color:var(--ink-soft);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-right:3px">Guide</span>
              ${guidePill('english', g.english, 'English', bookingV2FlagSVG('uk'))}
              ${guidePill('russian', g.russian, 'Russian', bookingV2FlagSVG('ru'))}
              ${guidePill('chinese', g.chinese, 'Chinese', bookingV2FlagSVG('cn'))}
              <input type="text" placeholder="+ other language…" value="${(g.otherLang||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}" oninput="bookingV2SetGuideOther(this.value)" style="flex:1;min-width:140px;padding:6px 12px;font-family:inherit;font-size:11.5px;background:var(--white);border:1px solid var(--border);border-radius:14px;color:var(--ink)">
            </div>
          `;
        })()}
        <label class="bkv2-nb-label">Notes / Special Request</label>
        <textarea class="bkv2-nb-input" rows="3" placeholder="e.g. VIP family · prefers speedboat · notify guide for life vest sizes" style="width:100%;box-sizing:border-box;font-family:inherit;resize:vertical;margin-top:4px" oninput="bookingV2SetBookingField('notes', this.value)">${(d.notes||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}</textarea>
      </div>

      <!-- Combined: Payment + Cash on Tour in ONE card -->
      ${bookingV2RenderPaymentSection()}

      ${bookingV2RenderFocSection()}

       </div>
       <div class="bkv2-review-cell">
         <div class="bkv2-review-sticky">
           <div class="bkv2-review-inner">
             <div class="bkv2-nb-sec-h" style="margin-bottom:10px;color:var(--bk-navy)">&#9679; Booking Review</div>
             ${bookingV2RenderReviewPanel()}
             <div style="height:1px;background:var(--border);margin:14px 0 12px"></div>
             ${bookingV2RenderAttachSection()}
             <div style="margin-bottom:10px">${bookingV2RenderActionMeta()}</div>
             <div style="display:flex;flex-direction:column;gap:6px">
               ${bookingV2RenderSubmitButton()}
               <button class="bkv2-nb-btn" onclick="bookingV2SaveDraft()" ${!d.agentId?'disabled':''} style="width:100%">Save Draft</button>
               <button class="bkv2-nb-btn ghost" onclick="bookingV2CloseNewBooking()" style="width:100%">Cancel</button>
             </div>
           </div>
         </div>
       </div>
      </div>
      ${bookingV2RenderCharterConfirmModal()}
    </div>
  `;
}
