// Lock action overlays (release + sub-group create) · rendered GLOBALLY by bookingV2Render so they work from any tab (Seat Locks + By-trip-date)
function bookingV2LockOverlays(){
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const rm = _bkV2ReleaseModal;
  const releaseModal = rm ? `
    <div onclick="bookingV2ReleaseModalCancel()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:14px;width:344px;max-width:92vw;box-shadow:0 14px 44px rgba(0,0,0,.28);overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
          <div style="font-size:9px;font-weight:700;letter-spacing:.06em;color:#C0392B;text-transform:uppercase">Release seats</div>
          <div style="font-size:15px;font-weight:700;color:var(--ink);margin-top:2px">Return held seats to pool</div>
        </div>
        <div style="padding:16px 18px">
          <div style="font-size:12px;color:var(--ink-soft);margin-bottom:11px">This lock holds <b style="color:var(--ink)">${rm.max}</b> seat(s) · choose how many to release.</div>
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="bookingV2ReleaseModalSet(${rm.value-1})" style="width:30px;height:30px;border:1px solid var(--border);background:#fff;border-radius:8px;cursor:pointer;color:#C0392B;font-weight:700;font-size:15px">&minus;</button>
            <input type="number" min="0" max="${rm.max}" value="${rm.value}" onchange="bookingV2ReleaseModalSet(this.value)" style="width:84px;height:34px;text-align:center;font-family:Manrope,sans-serif;font-weight:700;font-size:15px;border:1px solid var(--border);border-radius:8px;font-variant-numeric:tabular-nums">
            <button onclick="bookingV2ReleaseModalSet(${rm.value+1})" style="width:30px;height:30px;border:1px solid var(--border);background:#fff;border-radius:8px;cursor:pointer;color:#C0392B;font-weight:700;font-size:15px">+</button>
            <button onclick="bookingV2ReleaseModalSet(${rm.max})" style="margin-left:auto;font-size:11px;font-weight:600;color:#9a3b21;background:#FBEAE6;border:1px solid #EAC6BF;border-radius:8px;padding:6px 11px;cursor:pointer;font-family:inherit">All ${rm.max}</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;background:#fafafa;border-top:1px solid var(--border)">
          <button onclick="bookingV2ReleaseModalCancel()" style="font-size:12px;font-weight:600;color:var(--ink-soft);background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit">Cancel</button>
          <button onclick="bookingV2ReleaseModalCommit()" ${rm.value<=0?'disabled':''} style="font-size:12px;font-weight:700;color:#fff;background:${rm.value<=0?'#d6a9a2':'#C0392B'};border:none;border-radius:8px;padding:8px 16px;cursor:${rm.value<=0?'default':'pointer'};font-family:inherit">Release ${rm.value}</button>
        </div>
      </div>
    </div>` : '';
  const sm = _bkV2SubModal;
  const subParent = sm ? SB_SEAT_LOCKS.find(x=>x.id===sm.parentId) : null;
  const subRoom = subParent ? bookingV2LockUnalloc(subParent) : 0;
  const subModal = (sm && subParent) ? `
    <div onclick="bookingV2SubCancel()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:14px;width:360px;max-width:92vw;box-shadow:0 14px 44px rgba(0,0,0,.28);overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
          <div style="font-size:9px;font-weight:700;letter-spacing:.06em;color:#534AB7;text-transform:uppercase">Sub-group · กรุ๊ปย่อย</div>
          <div style="font-size:15px;font-weight:700;color:var(--ink);margin-top:2px">แบ่งที่นั่งใต้ ${esc(bookingV2LockHolderName(subParent))}</div>
          <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">ยังไม่จัด <b style="color:#A05A1A">${subRoom}</b> ที่ · แบ่งได้ไม่เกินนี้</div>
        </div>
        <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px">
          <div><div style="font-size:10px;color:var(--ink-soft);margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em">ชื่อกรุ๊ป *</div><input value="${esc(sm.name)}" oninput="bookingV2SubSet('name',this.value)" placeholder="เช่น A" style="width:100%;box-sizing:border-box;height:34px;border:1px solid var(--border);border-radius:8px;padding:0 11px;font-family:inherit;font-size:13px"></div>
          <div style="display:flex;gap:10px">
            <div style="flex:1"><div style="font-size:10px;color:var(--ink-soft);margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em">จำนวนที่นั่ง *</div><input type="number" min="1" max="${subRoom}" value="${esc(sm.qty)}" oninput="bookingV2SubSet('qty',this.value)" style="width:100%;box-sizing:border-box;height:34px;border:1px solid var(--border);border-radius:8px;padding:0 11px;font-family:Manrope,sans-serif;font-size:14px;font-variant-numeric:tabular-nums"></div>
            <div style="flex:1"><div style="font-size:10px;color:var(--ink-soft);margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em">หมดอายุ</div><input type="date" value="${esc(sm.expiry)}" oninput="bookingV2SubSet('expiry',this.value)" style="width:100%;box-sizing:border-box;height:34px;border:1px solid var(--border);border-radius:8px;padding:0 9px;font-family:inherit;font-size:12px"></div>
          </div>
          <div><div style="font-size:10px;color:var(--ink-soft);margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em">หมายเหตุ</div><input value="${esc(sm.reason)}" oninput="bookingV2SubSet('reason',this.value)" placeholder="เช่น sub-agent A" style="width:100%;box-sizing:border-box;height:34px;border:1px solid var(--border);border-radius:8px;padding:0 11px;font-family:inherit;font-size:13px"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;background:#fafafa;border-top:1px solid var(--border)">
          <button onclick="bookingV2SubCancel()" style="font-size:12px;font-weight:600;color:var(--ink-soft);background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit">ยกเลิก</button>
          <button onclick="bookingV2SubCommit()" style="font-size:12px;font-weight:700;color:#fff;background:#534AB7;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-family:inherit">+ เพิ่มกรุ๊ปย่อย</button>
        </div>
      </div>
    </div>` : '';
  // Lock manage popup (opened by clicking a lock name) · shows the lock + sub-groups + actions
  const mL = _bkV2LockManageId ? SB_SEAT_LOCKS.find(x=>x.id===_bkV2LockManageId && !x.parentId) : null;
  let manageModal = '';
  if(mL){
    const kids = bookingV2LockChildren(mL.id);
    // §lkAddAnywhere · ล็อกแบบช่วงคิดเป็นรายรอบ · ยอด "Held" คือที่นั่งต่อรอบ
    const _mBulk = (typeof bookingV2LockSpansDays==='function') && bookingV2LockSpansDays(mL);
    const held = bookingV2LockHeldRemaining(mL), usedTot = bookingV2LockUsedTotal(mL), unalloc = bookingV2LockUnalloc(mL), alloc = bookingV2LockAllocated(mL);
    /* §lkOver · ที่นั่งที่ยังแบ่งลงกรุ๊ปย่อยได้จริง = ยังไม่ได้แบ่ง − ที่ล็อคแม่ขายไปเอง */
    const _unallocDraw = (typeof bookingV2LockUnallocDrawable==='function') ? bookingV2LockUnallocDrawable(mL) : unalloc;
    const _overSold = Math.max(0, (Number(mL.used)||0) - unalloc);
    const cut = bookingV2LockCutoffLabel(mL);
    const rN = rid => (typeof ROUTES!=='undefined' ? (ROUTES.find(r=>r.id===rid)?.name||rid) : rid);
    const _mRg = (typeof bookingV2LockRange==='function') ? bookingV2LockRange(mL) : {from:'',to:''};
    const whenTxt = _mBulk ? (_mRg.from + (_mRg.to && _mRg.to!==_mRg.from ? (' → '+_mRg.to) : '')) : (mL.date||'');
    /* §lkSort · แบ่งกรุ๊ปย่อยเป็นชั้น · ที่ยังใช้ได้อยู่บน ที่ใช้ไปแล้วอยู่ล่าง ที่ปล่อยแล้วยุบท้ายสุด
       เดิมเรียงตามลำดับที่สร้าง · กรุ๊ปว่างกับกรุ๊ปหมดปนกัน หาที่ยังจองได้ต้องไล่อ่านทีละบรรทัด */
    const _kUsed = c => Number(c.used)||0;
    const _kBkt  = c => _kUsed(c) ? 'used' : (c.status==='active' ? 'free' : 'rel');
    const kFree = kids.filter(c=>_kBkt(c)==='free').sort((a,b)=> bookingV2LockRemaining(b)-bookingV2LockRemaining(a));
    const kUsed = kids.filter(c=>_kBkt(c)==='used').sort((a,b)=>
      (bookingV2LockRemaining(b)>0) - (bookingV2LockRemaining(a)>0) || _kUsed(b)-_kUsed(a));
    const kRel  = kids.filter(c=>_kBkt(c)==='rel');
    // §lkVC · ใครใช้ที่นั่งของกรุ๊ปนี้ไป · VC ของใบจองจริง ไม่ใช่แค่ตัวเลข
    const vcLine = c => {
      const A = bookingV2LockAudit(c);
      const bits = A.claims.map(x =>
        `<span title="${esc(x.lead||'')}${x.date?' · '+esc(x.date):''}${x.dead?' · '+esc(x.status):''}" style="display:inline-block;font-family:'DM Mono',monospace;font-size:9.5px;font-weight:700;`
        + (x.dead ? `background:#FDECEA;color:#A32D2D;text-decoration:line-through`
                  : `background:#EEF2FF;color:#3730A3`)
        + `;border-radius:5px;padding:1px 6px;margin:2px 4px 0 0">${esc(x.vc)}${x.qty>1?` ×${x.qty}`:''}</span>`).join('');
      const ghost = A.diff>0
        ? `<span style="display:inline-block;font-size:9.5px;font-weight:700;background:#FEF3C7;color:#92400E;border-radius:5px;padding:1px 6px;margin:2px 4px 0 0">ไม่มีใบจองอ้างถึง ${A.diff} ที่</span>` : '';
      if(!bits && !ghost) return '';
      return `<div style="margin-top:3px;line-height:1.7">${bits}${ghost}</div>`;
    };
    const kidRow = (c, tint) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-top:1px solid var(--border-2);border-left:3px solid ${tint}">
          <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--ink)">↳ ${esc(c.subName||'ย่อย')}</div><div style="font-size:10px;color:var(--ink-soft)">${esc(c.reason||'')}${c.expiry?` · หมดอายุ ${esc(c.expiry)}`:''}</div>${vcLine(c)}</div>
          <div style="font-family:Manrope,sans-serif;font-size:12px;font-variant-numeric:tabular-nums;color:var(--ink);white-space:nowrap;padding-top:1px"><b>${c.used}</b>/${c.qty} · <b style="color:${bookingV2LockRemaining(c)>0?'#0F6E56':'#C0392B'}">${bookingV2LockRemaining(c)}</b> เหลือ</div>
          <div style="display:flex;gap:6px;padding-top:1px">${c.status==='active'?`<button onclick="bookingV2LockManageClose();bookingV2LockAddOpen('${c.id}')" style="font-size:11px;font-weight:700;color:#0F6E56;background:#E1F5EE;border:1px solid #B7E2D2;border-radius:6px;padding:5px 10px;cursor:pointer;font-family:inherit">+ ที่นั่ง</button><button onclick="bookingV2LockReleaseConfirm('${c.id}')" style="font-size:11px;font-weight:700;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:6px;padding:5px 10px;cursor:pointer;font-family:inherit">ปล่อย</button>`:`<span style="font-size:10px;color:var(--ink-soft)">${esc(c.status)}</span>`}</div>
        </div>`;
    const kidHead = (label, sub, ink, bg, list, seats) => `
        <div style="display:flex;align-items:baseline;gap:8px;margin:14px 0 0;padding:6px 10px;border-radius:8px;background:${bg};border-left:3px solid ${ink}">
          <span style="font-size:10px;font-weight:800;color:${ink};text-transform:uppercase;letter-spacing:.05em">${label}</span>
          <span style="font-size:10px;color:${ink};opacity:.8">${sub}</span>
          <span style="margin-left:auto;font-family:Manrope,sans-serif;font-size:11px;font-weight:700;color:${ink}">${list.length} กรุ๊ป · ${seats} ที่</span>
        </div>`;
    const _sumRem = L => L.reduce((n,c)=>n+bookingV2LockRemaining(c),0);
    const _sumUse = L => L.reduce((n,c)=>n+_kUsed(c),0);
    const kidRows = !kids.length
      ? `<div style="font-size:11.5px;color:var(--ink-soft);padding:8px 0;border-top:1px solid var(--border-2)">ยังไม่มีกรุ๊ปย่อย</div>`
      : ( (kFree.length ? kidHead('ยังไม่ถูกใช้', 'จองเข้าได้เลย', '#0F6E56', '#ECFDF5', kFree, _sumRem(kFree))
             + kFree.map(c=>kidRow(c,'#8FD3BC')).join('') : '')
        + (kUsed.length ? kidHead('ใช้ไปแล้ว', 'มีใบจองผูกอยู่', '#3730A3', '#EEF2FF', kUsed, _sumUse(kUsed))
             + kUsed.map(c=>kidRow(c,'#A5B4FC')).join('') : '')
        + (kRel.length ? kidHead('ปล่อยคืนแล้ว', 'ไม่กันที่แล้ว', '#64748B', '#F1F5F9', kRel, 0)
             + `<div style="font-size:10.5px;color:var(--ink-soft);padding:8px 10px;border-top:1px solid var(--border-2);border-left:3px solid #CBD5E1;line-height:1.7">${esc(kRel.map(c=>c.subName||'ย่อย').join(' · '))}</div>` : '') );
    // §lkVC · ที่นั่งของล็อกแม่เองที่ยังไม่ได้แบ่ง ใครดึงไปบ้าง
    const ownVc = vcLine(mL);
    const _aud = bookingV2LockAuditTree(mL);
    // §lkCover · ใบจองของเจ้านี้บนทริปนี้ · ที่นั่งไหนไม่ได้ดึงจากล็อก
    const _cov = (typeof bookingV2LockCoverage==='function') ? bookingV2LockCoverage(mL) : null;
    const _covHtml = (!_cov || !_cov.bookings) ? '' : `
          <div style="margin-top:14px;border-top:1px solid var(--border-2);padding-top:11px">
            <div style="display:flex;align-items:baseline;gap:8px">
              <div style="font-size:10px;font-weight:700;color:#0E5E80;text-transform:uppercase;letter-spacing:.05em">ใบจองของเจ้านี้บนทริปนี้</div>
              <div style="margin-left:auto;font-family:Manrope,sans-serif;font-size:11.5px;color:var(--ink)"><b>${_cov.bookings}</b> ใบ · <b>${_cov.pax}</b> ที่</div>
            </div>
            <div style="font-size:10.5px;color:var(--ink-soft);margin-top:2px">ดึงจากล็อกนี้ <b style="color:#0F6E56">${_cov.self}</b> ที่${_cov.other?` · ดึงจากล็อกอื่น <b>${_cov.other}</b> ที่`:''}${_cov.pool?` · <b style="color:#A05A1A">มาจาก pool ทั่วไป ${_cov.pool} ที่</b>`:''}</div>
            ${_cov.pool ? `
            <div style="margin-top:8px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:9px 11px">
              <div style="font-size:11.5px;font-weight:700;color:#9A3412">มี ${_cov.pool} ที่ที่ไม่ได้ดึงจากล็อก</div>
              <div style="font-size:10.5px;color:#B45309;line-height:1.7;margin-top:2px">
                ${held>0 ? `ล็อกยังเหลือ <b>${held}</b> ที่ แต่ใบพวกนี้ไปกินที่จาก pool ที่ขายทั่วไปแทน — ตอนจองน่าจะลืมกดเลือกล็อก`
                         : `ตอนที่จองใบพวกนี้ ล็อกน่าจะเต็มแล้ว จึงไปกินที่จาก pool ทั่วไป`}
              </div>
              ${_cov.rows.filter(r=>r.pool>0).map(r=>`
              <div onclick="bookingV2LockManageClose();bookingV2OpenDetail('${r.id}')" title="เปิดใบจองนี้เพื่อแก้ให้ดึงจากล็อก" style="display:flex;align-items:center;gap:8px;margin-top:6px;cursor:pointer">
                <span style="font-family:'DM Mono',monospace;font-size:9.5px;font-weight:700;background:#FFEDD5;color:#9A3412;border-radius:5px;padding:1px 6px">${esc(r.vc)}</span>
                <span style="font-size:10.5px;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.lead||'—')}</span>
                <span style="font-family:Manrope,sans-serif;font-size:10.5px;color:var(--ink-soft);white-space:nowrap">${r.pax} ที่ · ล็อก ${r.self+r.other} · <b style="color:#A05A1A">pool ${r.pool}</b></span>
              </div>`).join('')}
            </div>` : `
            <div style="margin-top:6px;font-size:10.5px;color:#0F6E56">✓ ทุกที่นั่งของเจ้านี้บนทริปนี้ดึงจากล็อกครบ</div>`}
          </div>`;
    manageModal = `
    <div onclick="bookingV2LockManageClose()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:14px;width:440px;max-width:94vw;max-height:88vh;overflow:auto;box-shadow:0 16px 50px rgba(0,0,0,.3)">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-size:9px;font-weight:700;letter-spacing:.06em;color:#C0392B;text-transform:uppercase">Seat lock</div>
            <div style="font-size:16px;font-weight:700;color:var(--ink);margin-top:2px">${esc(bookingV2LockHolderName(mL))}</div>
            <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">${esc(rN(mL.routeId))} · ${esc(whenTxt)}${_mBulk?' · Bulk':''}</div>
            ${cut?`<div style="font-size:11px;color:#0F6E56;margin-top:3px">🕒 ${esc(cut)}</div>`:''}
          </div>
          <button onclick="bookingV2LockManageClose()" style="border:none;background:transparent;font-size:20px;color:var(--ink-soft);cursor:pointer;line-height:1">&times;</button>
        </div>
        <div style="padding:14px 18px">
          <div style="display:flex;gap:14px;font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">
            <div><div style="font-size:9px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">${_mBulk?'กันไว้/รอบ':'Held'}</div><div style="font-size:20px;font-weight:700;color:#C0392B">${held}</div></div>
            <div><div style="font-size:9px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">${_mBulk?'ดึงไปสะสม':'Used'}</div><div style="font-size:20px;font-weight:700;color:var(--ink)">${usedTot}</div></div>
            <div><div style="font-size:9px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">Total</div><div style="font-size:20px;font-weight:700;color:var(--ink)">${mL.qty}${_mBulk?'<span style="font-size:10px;color:var(--ink-soft);font-weight:600">/รอบ</span>':''}</div></div>
            <div style="margin-left:auto;text-align:right"><div style="font-size:9px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">แบ่งย่อย / ยังไม่จัด</div><div style="font-size:14px;font-weight:700;color:var(--ink);margin-top:4px">${alloc} / <span style="color:${unalloc>0?'#A05A1A':'var(--ink-soft)'}">${unalloc}</span></div></div>
          </div>
          ${ownVc?`<div style="margin-top:10px"><div style="font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">ดึงจากส่วนที่ยังไม่ได้แบ่ง</div>${ownVc}</div>`:''}
          ${_overSold>0?`
          <div style="margin-top:12px;background:#FDECEA;border:1px solid #F5C9C4;border-radius:10px;padding:10px 12px">
            <div style="font-size:11.5px;font-weight:700;color:#A32D2D">จ่ายที่นั่งเกินไป ${_overSold} ที่</div>
            <div style="font-size:10.5px;color:#B45309;line-height:1.7;margin-top:3px">
              ล็อคนี้มี ${mL.qty} ที่ · แบ่งลงกรุ๊ปย่อยไปแล้ว ${alloc} ที่ (เหลือไม่ได้แบ่ง ${unalloc})
              แต่ล็อคแม่เองขายไปแล้ว <b>${Number(mL.used)||0}</b> ที่<br>
              รวมแล้วจ่ายออก ${alloc+(Number(mL.used)||0)} ที่จากที่มีจริง ${mL.qty} · ยอด Held จึงต่ำกว่าความจริง ${_overSold} ที่
            </div>
          </div>`:''}
          ${_aud.diff!==0?`
          <div style="margin-top:12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px">
            <div style="font-size:11.5px;font-weight:700;color:#92400E">ตัวเลขไม่ตรงกับใบจอง · ต่างกัน ${Math.abs(_aud.diff)} ที่</div>
            <div style="font-size:10.5px;color:#A16207;line-height:1.7;margin-top:3px">
              ตัวนับบอกว่าใช้ไป <b>${_aud.used}</b> ที่ แต่ใบจองที่ยังอยู่จริงอ้างถึงแค่ <b>${_aud.live}</b> ที่${_aud.dead?` (อีก ${_aud.dead} ที่อยู่ในใบที่ยกเลิกหรือย้ายวันไปแล้ว)`:''}${_aud.moved?`<br>ในนั้นมี <b>${_aud.moved}</b> ที่ที่ใบจองย้ายวันไปแล้วแต่ที่นั่งยังค้างอยู่กับล็อคนี้`:''}<br>
              ที่นั่งส่วนต่างถูกกันไว้เฉย ๆ ขายไม่ได้ · กดปุ่มล่างเพื่อคืนกลับเข้าล็อก
            </div>
            <button onclick="bookingV2LockFixTree('${mL.id}')" style="margin-top:8px;font-size:11.5px;font-weight:700;color:#fff;background:#B45309;border:none;border-radius:7px;padding:7px 13px;cursor:pointer;font-family:inherit">แก้ตัวเลขให้ตรงกับใบจอง</button>
          </div>`:`
          <div style="margin-top:12px;font-size:10.5px;color:#0F6E56">✓ ตัวเลขตรงกับใบจองที่อ้างถึงจริง ${_aud.live} ที่</div>`}
          ${_covHtml}
          <div style="margin-top:14px;display:flex;align-items:baseline;gap:8px">
            <span style="font-size:10px;font-weight:700;color:#534AB7;text-transform:uppercase;letter-spacing:.05em">กรุ๊ปย่อย (${kids.length})</span>
            <span style="margin-left:auto;font-size:10.5px;color:var(--ink-soft)">${kFree.length?`<b style="color:#0F6E56">ว่าง ${kFree.length}</b>`:''}${kUsed.length?` · <b style="color:#3730A3">ใช้แล้ว ${kUsed.length}</b>`:''}${kRel.length?` · ปล่อยแล้ว ${kRel.length}`:''}</span>
          </div>
          ${kidRows}
        </div>
        <div style="display:flex;gap:8px;padding:12px 18px;background:#fafafa;border-top:1px solid var(--border);flex-wrap:wrap">
          ${(mL.status==='active')?`<button onclick="bookingV2LockManageClose();bookingV2LockAddOpen('${mL.id}')" style="font-size:12px;font-weight:700;color:#fff;background:#0F6E56;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit">+ เพิ่มที่นั่ง</button>`:''}
          ${(mL.status==='active'&&_unallocDraw>0)?`<button onclick="bookingV2SubOpen('${mL.id}')" style="font-size:12px;font-weight:700;color:#fff;background:#534AB7;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit">+ กรุ๊ปย่อย</button>`:''}
          ${(mL.status==='active')?`<button onclick="bookingV2LockReleaseConfirm('${mL.id}')" style="font-size:12px;font-weight:700;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit">ปล่อย${kids.length?' (ยังไม่จัด)':''}</button>`:''}
          <button onclick="bookingV2LockManageClose();bookingV2SwitchTab('locks')" style="font-size:12px;font-weight:600;color:var(--ink-soft);background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit">ดูทั้งหมด →</button>
          <button onclick="bookingV2LockManageClose()" style="margin-left:auto;font-size:12px;font-weight:600;color:var(--ink-soft);background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit">ปิด</button>
        </div>
      </div>
    </div>`;
  }
  return releaseModal + subModal + manageModal + ((typeof bookingV2LockAddModal==='function')?bookingV2LockAddModal():'');
}
