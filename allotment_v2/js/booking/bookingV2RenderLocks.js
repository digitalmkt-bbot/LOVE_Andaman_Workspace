function bookingV2RenderLocks(){
  const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const U = _bkV2LockUI;
  const routeOf = rid => (typeof ROUTES!=='undefined' ? ROUTES.find(r=>r.id===rid) : null);
  const routeName = rid => (routeOf(rid)?.name || rid);
  const routeColor = rid => (routeOf(rid)?.color || '#9C9C95');
  const DOWL=['อา','จ','อ','พ','พฤ','ศ','ส'];
  // §cityTourView · Seat Locks tab is per-page: marine page (flag off) excludes land-route locks ·
  //   land page (flag on) shows only land-route locks. Filtered here (display only) — does not
  //   touch bookingV2LocksOnDate/bookingV2LockPoolHold etc., which stay global for Boat Op/availability.
  const _lkOk = rid => (typeof laIsLandRoute!=='function') || (laIsLandRoute(rid)===_bkV2CityTourOnly);

  // ── ยอดรวม ──
  /* §bkLock · ยอดรวมของหน้านี้เป็นเรื่องของ "ที่นั่ง" · ใบชนิดเรือทั้งลำนับแยก
     ถ้าบวกรวมกัน ตัวเลข seats held จะโตขึ้นทั้งที่ไม่มีที่นั่งไหนถูกกันเพิ่มเลย */
  const all = SB_SEAT_LOCKS.filter(l=>!l.parentId && !bookingV2IsBoatLock(l) && _lkOk(l.routeId));
  const act = all.filter(l=>l.status==='active');
  const boatAll = bookingV2BoatLocks().filter(l=>_lkOk(l.routeId));
  const boatAct = boatAll.filter(l=>l.status==='active');
  const boatSeats = boatAct.reduce((s,l)=>s+bookingV2BoatCapOn(l.boatId,l.date),0);
  const boatOd = boatAct.filter(l=>bookingV2BoatLockOverdue(l,_bkLkToday())).length;
  const nDay = act.filter(l=>!bookingV2LockSpansDays(l)).length, nBulk = act.filter(l=>bookingV2LockSpansDays(l)).length;
  const usedQty = SB_SEAT_LOCKS.filter(l=>!bookingV2IsBoatLock(l) && _lkOk(l.routeId)).reduce((s,l)=>s+(l.used||0),0);
  // ความจุที่เสนอออกไปแล้ว · รายวัน = qty · bulk = qty × รอบที่ผ่านไปแล้ว
  const capOffered = SB_SEAT_LOCKS.filter(l=>!bookingV2IsBoatLock(l) && _lkOk(l.routeId)).reduce((s,l)=>{
    if(l.parentId) return s;
    if(!bookingV2LockSpansDays(l)) return s + (l.qty||0);
    return s + (l.qty||0) * (bookingV2LockRounds(l).past||0);
  },0);
  const conv = capOffered ? Math.round(usedQty/capOffered*100) : 0;
  // ── §lkOverview · การ์ดสรุป ──
  const _today=(typeof bookingV2LocalYMD==='function')?bookingV2LocalYMD(new Date()):new Date().toISOString().slice(0,10);
  const _now=Date.now();
  const _dayStr=bookingV2LockDayStr();
  // 14 วันข้างหน้า · ที่นั่งที่กันอยู่ + รอบที่ใกล้ปล่อยคืนใน 48 ชม.
  /* §lkNoAuto · เลยกำหนดแล้วที่นั่งยังกันอยู่ · การ์ดจึงเปลี่ยนจาก "ใกล้ปล่อยคืน"
     เป็น "เลยกำหนด ยังไม่ปล่อย" ซึ่งคือของที่ต้องไปตัดสินใจจริง ๆ
     ถ้ายังไม่มีตัวเลยกำหนด ค่อยบอกตัวที่ใกล้ถึงกำหนดใน 48 ชม. แทน */
  const _spark=[]; let soonRounds=0, soonSeats=0, odRounds=0, odSeats=0;
  for(let i=0;i<14;i++){
    const d=new Date(_today+'T00:00:00'); d.setDate(d.getDate()+i);
    const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    let held=0;
    bookingV2LocksOnDate(ds).filter(l=>_lkOk(l.routeId)).forEach(l=>{
      const cut=bookingV2LockReleaseCutoff(l, ds);
      const h = bookingV2LockHoldsOn(l, ds) ? bookingV2LockPoolHold(l, ds) : 0;
      held += h;
      if(!cut || !h) return;
      const diff = cut.getTime()-_now;
      if(diff<=0){ odRounds++; odSeats += h; }
      else if(diff <= 48*3600e3){ soonRounds++; soonSeats += h; }
    });
    _spark.push(held);
  }
  const _sparkMax=Math.max(1,..._spark);
  // §lkTomorrow · การ์ดนี้ดูของพรุ่งนี้ · ของวันนี้ถูกจัดการไปหมดแล้วตั้งแต่เมื่อวาน
  const _tmr=(function(){ const d=new Date(_today+'T00:00:00'); d.setDate(d.getDate()+1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })();
  const todLocks=bookingV2LocksOnDate(_tmr).filter(l=>_lkOk(l.routeId));
  const todHeld=todLocks.reduce((a,l)=>a + (bookingV2LockHoldsOn(l,_tmr)?bookingV2LockPoolHold(l,_tmr):0), 0);
  const todRoutes=new Set(todLocks.map(l=>l.routeId)).size;
  const card=(cls,lab,val,unit,foot)=>`<div style="background:${cls.bg};border:1px solid ${cls.bd};border-radius:12px;padding:11px 14px;overflow:hidden">
      <div style="font-size:10px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em">${lab}</div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:5px"><b style="font-size:26px;font-weight:700;letter-spacing:-.03em;line-height:1;font-family:'DM Mono',monospace;color:${cls.fg}">${val}</b><span style="font-size:11.5px;color:var(--ink-soft)">${unit}</span></div>
      <div style="font-size:10.5px;color:var(--ink-soft);margin-top:7px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">${foot}</div>
    </div>`;
  const pill=(t,bg,fg)=>`<span style="background:${bg||'#F3F1EC'};color:${fg||'#5c5c55'};border-radius:7px;padding:1px 8px;font-weight:600;font-size:10.5px">${t}</span>`;
  const cards = `<div style="display:grid;grid-template-columns:repeat(${boatAct.length?5:4},1fr);gap:9px;margin:0 12px 10px">
      ${card({bg:'linear-gradient(180deg,#FCF3F1,#fff)',bd:'var(--border)',fg:'#C0392B'},'ล็อกที่ใช้งานอยู่',act.length,'รายการ', pill('รายวัน '+nDay)+pill('Bulk '+nBulk))}
      ${card({bg:'#fff',bd:'var(--border)',fg:'var(--ink)'},'ที่นั่งกันไว้พรุ่งนี้',todHeld,'ที่',
        `<span>${todLocks.length} ล็อก · ${todRoutes} เส้นทาง</span>
         <div style="display:flex;gap:2px;align-items:flex-end;height:20px;width:100%;margin-top:4px">${_spark.map(v=>`<i style="flex:1;min-height:2px;height:${Math.round(v/_sparkMax*100)}%;background:${v?'#E2B7B0':'#EFEDE6'};border-radius:2px 2px 0 0"></i>`).join('')}</div>`)}
      ${card({bg:'#fff',bd:'var(--border)',fg:'#0F6E56'},'ดึงไปขายแล้ว',usedQty,'ที่', `<span>อัตราการใช้ <b style="color:#0F6E56">${conv}%</b> ของที่เสนอไปแล้ว</span>`)}
      ${/* §bkLock · นับแยกจาก seats held เสมอ · ใบชนิดนี้ไม่ได้กันที่นั่ง มันเอาเรือออกไปทั้งลำ */
        boatAct.length ? card({bg:'linear-gradient(180deg,#F3EBFA,#fff)',bd:'#DCC7EE',fg:'#6B289A'},'เรือกันไว้ทั้งลำ',boatAct.length,'ลำ',
          pill(boatSeats+' ที่','#fff','#6B289A') + (boatOd?pill('เลยกำหนด '+boatOd,'#FDECEA','#A32D2D'):'')) : ''}
      ${odRounds
        ? card({bg:'linear-gradient(180deg,#FDECEA,#fff)',bd:'#F5C9C4',fg:'#A32D2D'},'เลยกำหนดปล่อย · ยังกันอยู่',odRounds,'รอบ', pill(odSeats+' ที่ยังขายไม่ได้ · กดปล่อยที่ตารางล่าง','#FDECEA','#A32D2D'))
        : card({bg:'linear-gradient(180deg,#FDF4E7,#fff)',bd:'#F0DDBE',fg:'#A05A1A'},'ใกล้ถึงกำหนดปล่อย · 48 ชม.',soonRounds,'รอบ', pill(soonSeats+' ที่ถึงกำหนดเร็ว ๆ นี้','#FBEFD9','#A05A1A'))}
    </div>`;

  // ── §lkOverview · ตารางล็อกของวันนี้ ──
  const _dObj=new Date(_dayStr+'T00:00:00');
  const _dLbl=_dObj.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  const _dTag=(_dayStr===_today)?'วันนี้':((_bkV2LockUI.dayOff===1)?'พรุ่งนี้':'');
  const dayLocks=bookingV2LocksOnDate(_dayStr).filter(l=>_lkOk(l.routeId)).sort((a,b)=>
    bookingV2LockHolderName(a).localeCompare(bookingV2LockHolderName(b)) || routeName(a.routeId).localeCompare(routeName(b.routeId)));
  const dQty=dayLocks.reduce((a,l)=>a+(l.qty||0)-bookingV2LockPendOn(l,_dayStr),0);   /* §lkPend · ที่รออยู่ไม่ใช่ที่กันไว้ */
  const dPend=dayLocks.reduce((a,l)=>a+bookingV2LockPendOn(l,_dayStr),0);
  const dUsed=dayLocks.reduce((a,l)=>a+bookingV2LockUsedTotal(l,_dayStr),0);
  const dHeld=dayLocks.reduce((a,l)=>a+(bookingV2LockHoldsOn(l,_dayStr)?bookingV2LockPoolHold(l,_dayStr):0),0);
  const navBtn='width:22px;height:22px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:pointer;color:var(--ink-soft);font-size:12px;line-height:1;font-family:inherit';
  const th2='position:sticky;top:0;background:#fff;border-bottom:1px solid var(--border-2);font-size:9.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:6px 12px;white-space:nowrap;z-index:2';
  const td2='border-bottom:1px solid var(--border-2);padding:6px 12px;font-size:12px;vertical-align:middle';
  const dayRows = dayLocks.length ? dayLocks.map(l=>{
    const u=bookingV2LockUsedTotal(l,_dayStr), rm=bookingV2LockPoolHold(l,_dayStr);
    /* §lkPend · ส่วนที่รอที่ว่างของวันนี้ · ว่างเท่าไหร่ = กดยืนยันได้เท่านั้น */
    const pd=bookingV2LockPendOn(l,_dayStr), pdFree=pd?bookingV2LockFreeOn(l.routeId,_dayStr,null):0;
    const pdCan=pd?((pdFree==null)?pd:Math.min(pd,pdFree)):0;
    const cut=bookingV2LockReleaseCutoff(l,_dayStr);
    let relHtml;
    if(cut){
      const diff=cut.getTime()-_now;
      if(bookingV2LockRoundReleased(l,_dayStr)) relHtml=`<span style="font-size:10.5px;font-weight:700;color:#64748B;background:#F1F5F9;border-radius:6px;padding:2px 8px">ปล่อยแล้ว</span>`;
      /* §lkNoAuto · เลยกำหนดแล้วแต่ยังไม่มีใครกด · ที่นั่งยังกันอยู่ ต้องเห็นว่าเป็นของค้าง */
      else if(diff<=0) relHtml=`<span style="font-size:10.5px;font-weight:700;color:#A32D2D;background:#FDECEA;border-radius:6px;padding:2px 8px" title="เลยเวลาที่ตั้งไว้แล้ว แต่ที่นั่งยังถูกกันอยู่ · กดปล่อยเพื่อคืนเข้า pool">เลยกำหนด · ยังกันอยู่</span>`;
      else if(diff<=48*3600e3) relHtml=`<span style="font-size:10.5px;font-weight:700;color:#A05A1A;background:#FBEFD9;border-radius:6px;padding:2px 8px">อีก ${Math.max(1,Math.round(diff/3600e3))} ชม.</span>`;
      else relHtml=`<span style="font-size:10.5px;color:var(--ink-soft)">${cut.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} ${String(cut.getHours()).padStart(2,'0')}:${String(cut.getMinutes()).padStart(2,'0')}</span>`;
    } else relHtml=`<span style="font-size:10.5px;color:var(--ink-soft)">${l.expiry?('หมดอายุ '+esc(l.expiry)):'—'}</span>`;
    const released = bookingV2LockRoundReleased(l,_dayStr);
    return `<tr>
      <td style="${td2};font-weight:700"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bookingV2LockHolderColor(l)};margin-right:7px;vertical-align:0"></span>${esc(bookingV2LockHolderName(l))}</td>
      <td style="${td2}"><span style="display:inline-block;width:3px;height:14px;border-radius:2px;background:${routeColor(l.routeId)};vertical-align:-2px;margin-right:7px"></span>${esc(routeName(l.routeId))}</td>
      <td style="${td2}">${bookingV2LockSpansDays(l)
        ?'<span style="font-size:9px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#5B3FA5;background:#F3EEFB;padding:2px 7px;border-radius:5px">Bulk</span>'
        :'<span style="font-size:9px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#2A5EA8;background:#EAF1FB;padding:2px 7px;border-radius:5px">รายวัน</span>'}</td>
      <td style="${td2};text-align:center;font-family:'DM Mono',monospace;font-weight:700;color:#C0392B">${(l.qty||0)-pd}${pd?`<div class="lkpend-tag" data-lkpend-tag="${l.id}" title="ขอไว้ ${l.qty||0} ที่ · ยังไม่ได้ที่ ${pd} · ไม่กันที่นั่ง ดึงไปจองไม่ได้" style="font-family:inherit;font-size:10px;font-weight:700;color:#64748B;background:#F4F5F7;border:1px dashed #C3CAD5;border-radius:6px;padding:1px 6px;margin-top:3px;white-space:nowrap">&#9203; Pending ${pd}</div>`:''}</td>
      <td style="${td2};text-align:center;font-family:'DM Mono',monospace;font-weight:700">${u}</td>
      <td style="${td2};text-align:center;font-family:'DM Mono',monospace;font-weight:700;color:${released?'var(--ink-faint)':(rm?'#0F6E56':'var(--ink-faint)')}">${released?'—':rm}</td>
      <td style="${td2}">${relHtml}</td>
      <td style="${td2};text-align:right;padding-right:14px;white-space:nowrap">${
        (!released && rm>0)
          ? `<button onclick="bookingV2LockReleaseRoundGo('${l.id}','${_dayStr}')" title="คืน ${rm} ที่ของรอบนี้เข้า pool · รอบอื่นของล็อกนี้ไม่กระทบ" style="font-family:inherit;font-size:11px;font-weight:600;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:7px;padding:4px 9px;cursor:pointer;margin-right:5px">ปล่อย ${rm} ที่</button>` : ''
      }${pd?(pdCan>0
          ? `<button data-lkpend-go="${l.id}" onclick="bookingV2LockPendConfirmGo('${l.id}','${_dayStr}')" title="มีที่ว่างแล้ว ${pdCan} ที่ · กดเพื่อดันเข้าเป็นล็อกจริง" style="font-family:inherit;font-size:11px;font-weight:700;color:#fff;background:#0F6E56;border:1px solid #0F6E56;border-radius:7px;padding:4px 9px;cursor:pointer;margin-right:5px">ยืนยัน ${pdCan} ที่</button>`
          : `<span title="ยังไม่มีที่ว่าง · รออยู่ ${pd} ที่" style="font-size:10.5px;font-weight:700;color:#9A8B73;background:#F6F1E7;border-radius:7px;padding:4px 9px;margin-right:5px;white-space:nowrap">ยังไม่ว่าง</span>`):''
      }<button onclick="bookingV2LockAddOpen('${l.id}')" style="font-family:inherit;font-size:11px;font-weight:600;color:#0F6E56;background:#E1F5EE;border:1px solid #B7E2D2;border-radius:7px;padding:4px 9px;cursor:pointer">+ ที่นั่ง</button></td>
    </tr>`;
  }).join('') : '';
  /* ══ §bkLock · แถวเรือทั้งลำในตารางเดียวกัน ═══════════════════════════════════
     คอลัมน์ที่เป็นจำนวนที่นั่ง (กันไว้ / ใช้วันนี้ / เหลือ) ไม่มีความหมายกับใบชนิดนี้
     จึงใช้เป็น ชื่อลำ / — / ความจุ แทน · ตัวเลขรวมหัวตารางก็ไม่รวมมันด้วยเหตุผลเดียวกัน */
  const dayBoats = bookingV2BoatLocksOn(_dayStr).filter(l=>_lkOk(l.routeId));
  const boatRowsDay = dayBoats.map(l=>{
    const cap=bookingV2BoatCapOn(l.boatId,l.date), od=bookingV2BoatLockOverdue(l,_today);
    return `<tr style="background:#FAF6FD">
      <td style="${td2};font-weight:700"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bookingV2LockHolderColor(l)};margin-right:7px;vertical-align:0"></span>${esc(bookingV2LockHolderName(l))}${l.reason?`<div class="bklk-note" style="font-weight:500;font-size:11px;color:#6B5A80;margin:2px 0 0 15px;white-space:normal;line-height:1.45">${esc(l.reason)}</div>`:''}</td>
      <td style="${td2}"><span style="display:inline-block;width:3px;height:14px;border-radius:2px;background:#6B289A;vertical-align:-2px;margin-right:7px"></span>${esc(routeName(l.routeId))}</td>
      <td style="${td2}"><span style="font-size:9px;font-weight:700;letter-spacing:.03em;color:#fff;background:#6B289A;padding:2px 7px;border-radius:5px">เรือทั้งลำ</span></td>
      <td style="${td2};text-align:center;font-weight:700;color:#6B289A">${esc(bookingV2BoatNameOf(l.boatId))}</td>
      <td style="${td2};text-align:center;color:var(--ink-faint)">—</td>
      <td style="${td2};text-align:center;font-family:'DM Mono',monospace;font-weight:700;color:#6B289A">${cap} ที่</td>
      <td style="${td2}">${od
        ? `<span style="font-size:10.5px;font-weight:700;color:#A32D2D;background:#FDECEA;border-radius:6px;padding:2px 8px" title="เลยวันที่ตั้งไว้แล้ว แต่เรือยังถูกกันทั้งลำ">เลยกำหนด · ยังกันอยู่</span>`
        : `<span style="font-size:10.5px;color:var(--ink-soft)">หมดอายุ ${esc(l.expiry||'—')}</span>`}</td>
      <td style="${td2};text-align:right;padding-right:14px;white-space:nowrap">
        <button onclick="bookingV2BoatLockToCharter('${l.id}')" title="เปิดฟอร์มจองเหมาลำ กรอกให้ล่วงหน้าจากใบล็อกนี้" style="font-family:inherit;font-size:11px;font-weight:700;color:#fff;background:#6B289A;border:1px solid #6B289A;border-radius:7px;padding:4px 9px;cursor:pointer;margin-right:5px">เหมาลำ</button>
        <button onclick="bookingV2BoatLockEditOpen('${l.id}')" title="แก้ผู้ถือ วันหมดอายุ หมายเหตุ หรือย้ายวัน/ลำ" style="font-family:inherit;font-size:11px;font-weight:600;color:#2A5EA8;background:#EAF1FB;border:1px solid #C3D8F2;border-radius:7px;padding:4px 9px;cursor:pointer;margin-right:5px">แก้ไข</button>
        <button onclick="bookingV2BoatLockReleaseGo('${l.id}')" title="คืนเรือลำนี้เข้าพูลขายที่นั่งทันที" style="font-family:inherit;font-size:11px;font-weight:600;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:7px;padding:4px 9px;cursor:pointer">ปล่อยลำ</button></td>
    </tr>`;
  }).join('');
  const dayRowsAll = (dayRows + boatRowsDay) || `<tr><td colspan="8" style="padding:22px;text-align:center;color:var(--ink-faint)">วันนี้ไม่มีล็อก</td></tr>`;
  const todayBox = `<div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;margin:0 12px 10px">
      <div style="display:flex;align-items:center;gap:11px;padding:11px 14px;border-bottom:1px solid var(--border-2);background:#FAF9F5;flex-wrap:wrap">
        <div style="min-width:0">
          <div style="font-size:10px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em">ล็อกของวัน</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:2px">
            <span style="font-size:19px;font-weight:700;letter-spacing:-.01em;color:var(--ink);font-family:'DM Mono',monospace">${esc(_dLbl)}</span>
            ${_dTag?`<span style="font-size:11px;font-weight:700;color:#C0392B;background:#FBEAE6;border-radius:8px;padding:2px 9px">${_dTag}</span>`:''}
          </div>
        </div>
        <button onclick="bookingV2LockDayShift(-1)" style="${navBtn}" title="วันก่อนหน้า">&lsaquo;</button>
        <button onclick="bookingV2LockDayShift(1)" style="${navBtn}" title="วันถัดไป">&rsaquo;</button>
        <button onclick="bookingV2LockDaySet(0)" style="border:1px solid var(--border);background:${_bkV2LockUI.dayOff===0?'#F1EFE8':'#fff'};border-radius:7px;padding:4px 11px;font-family:inherit;font-size:11.5px;font-weight:600;color:var(--ink-soft);cursor:pointer">วันนี้</button>
        <button onclick="bookingV2LockDaySet(1)" style="border:1px solid var(--border);background:${_bkV2LockUI.dayOff===1?'#F1EFE8':'#fff'};border-radius:7px;padding:4px 11px;font-family:inherit;font-size:11.5px;font-weight:600;color:var(--ink-soft);cursor:pointer">พรุ่งนี้</button>
        <span style="margin-left:auto;font-size:12px;color:var(--ink-soft)">${dayLocks.length?`${dayLocks.length} ล็อก · กันไว้ ${dQty} ที่ · ใช้ไป ${dUsed} · เหลือ <b style="color:var(--ink)">${dHeld}</b>${dPend?` · <b style="color:#64748B">Pending ${dPend}</b>`:''}`:''}${dayBoats.length?`${dayLocks.length?' · ':''}<b style="color:#6B289A">เรือ ${dayBoats.length} ลำ</b>`:''}</span>
        ${(function(){ /* §lkNoAuto · ของค้างเป็นร้อยที่ ต้องกดทีเดียวจบได้ ไม่ใช่ไล่กดทีละใบ */
          const _od=bookingV2LockOverdueOn(_dayStr).filter(l=>_lkOk(l.routeId));
          if(!_od.length) return '';
          const _s=_od.reduce((a,l)=>a+bookingV2LockPoolHold(l,_dayStr),0);
          return `<button onclick="bookingV2LockReleaseOverdueGo('${_dayStr}')" title="คืนที่นั่งของทุกล็อกที่เลยกำหนดในวันนี้เข้า pool" style="font-family:inherit;font-size:11.5px;font-weight:700;color:#fff;background:#A32D2D;border:1px solid #A32D2D;border-radius:8px;padding:5px 12px;cursor:pointer">ปล่อยที่เลยกำหนด · ${_od.length} ล็อก ${_s} ที่</button>`;
        })()}
      </div>
      <div style="max-height:212px;overflow:auto">
        <table style="width:100%;border-collapse:separate;border-spacing:0">
          <thead><tr>
            <th style="${th2}">เอเจ้น / ผู้ถือ</th><th style="${th2}">เส้นทาง</th><th style="${th2}">แบบ</th>
            <th style="${th2};text-align:center">กันไว้</th><th style="${th2};text-align:center">ใช้วันนี้</th>
            <th style="${th2};text-align:center">เหลือ</th><th style="${th2}">ปล่อยคืน</th><th style="${th2}"></th>
          </tr></thead><tbody>${dayRowsAll}</tbody></table>
      </div>
    </div>`;

  /* ══ §bkLock · ตารางเรือที่กันไว้ทั้งลำ ════════════════════════════════════════
     แยกกล่องจากรายการล็อกที่นั่งข้างล่าง ไม่ใช่เพราะขี้เกียจยัดรวม แต่เพราะหน่วยคนละอย่าง
     รายการข้างล่างทุกคอลัมน์เป็น "ที่นั่ง" · ของนี่เป็น "ลำ" · ปนกันแล้วยอดกลุ่มอ่านไม่ได้
     ของที่เลยกำหนดถูกดันขึ้นบนสุด เพราะหนึ่งวันที่ค้าง = 40-65 ที่ที่ขายไม่ได้ */
  const boatBox = (function(){
    if(!boatAct.length) return '';
    const rows=boatAct.slice().sort((a,b)=>{
      const oa=bookingV2BoatLockOverdue(a,_today)?0:1, ob=bookingV2BoatLockOverdue(b,_today)?0:1;
      return (oa-ob) || String(a.date).localeCompare(String(b.date));
    });
    const odN=rows.filter(l=>bookingV2BoatLockOverdue(l,_today));
    const odSeat=odN.reduce((s,l)=>s+bookingV2BoatCapOn(l.boatId,l.date),0);
    const th3='background:#F7F4FB;border-bottom:1px solid #E4D8EF;font-size:9.5px;font-weight:700;color:#7A6A89;text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:6px 12px;white-space:nowrap';
    const td3='border-bottom:1px solid var(--border-2);padding:7px 12px;font-size:12px;vertical-align:middle';
    return `<div style="background:#fff;border:1px solid #DCC7EE;border-radius:12px;overflow:hidden;margin:0 12px 10px">
      <div style="display:flex;align-items:center;gap:11px;padding:11px 14px;border-bottom:1px solid #E4D8EF;background:#F7F4FB;flex-wrap:wrap">
        <div><div style="font-size:10px;font-weight:700;color:#8A79A0;text-transform:uppercase;letter-spacing:.06em">เรือกันไว้ทั้งลำ</div>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:2px">เอเยนต์จองลำไว้ ยังไม่ยืนยัน · เรือไม่อยู่ในพูลขายที่นั่งแล้ว</div></div>
        <span style="margin-left:auto;font-size:12px;color:var(--ink-soft)">${boatAct.length} ลำ · <b style="color:#6B289A">${boatSeats} ที่</b></span>
      </div>
      ${odN.length?`<div style="padding:9px 14px;background:#FDECEA;border-bottom:1px solid #F5C9C4;font-size:12px;color:#A32D2D;font-weight:600">
        เลยกำหนดปล่อยแล้ว ${odN.length} ลำ · ${odSeat} ที่ที่ขายไม่ได้ · ยังไม่มีใครกดปล่อย</div>`:''}
      <div style="max-height:260px;overflow:auto">
      <table style="width:100%;border-collapse:separate;border-spacing:0"><thead><tr>
        <th style="${th3}">ลำ</th><th style="${th3};text-align:center">ที่</th><th style="${th3}">ผู้ถือ</th>
        <th style="${th3}">เส้นทาง</th><th style="${th3}">วันเดินทาง</th><th style="${th3}">แบบการตกลง</th>
        <th style="${th3}">หมายเหตุ</th>
        <th style="${th3}">หมดอายุ</th><th style="${th3}"></th></tr></thead><tbody>
      ${rows.map(l=>{
        const cap=bookingV2BoatCapOn(l.boatId,l.date), od=bookingV2BoatLockOverdue(l,_today);
        const fx=bookingV2BoatLockFixed(l), min=bookingV2BoatLockMinCap(l);
        return `<tr${od?' style="background:#FFF8F7"':''}>
          <td style="${td3};font-weight:700;color:#6B289A">${esc(bookingV2BoatNameOf(l.boatId))}</td>
          <td style="${td3};text-align:center;font-family:'DM Mono',monospace;font-weight:700">${cap}</td>
          <td style="${td3}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bookingV2LockHolderColor(l)};margin-right:7px;vertical-align:0"></span>${esc(bookingV2LockHolderName(l))}</td>
          <td style="${td3}">${esc(routeName(l.routeId))}</td>
          <td style="${td3};font-family:'DM Mono',monospace">${esc(l.date)}</td>
          <td style="${td3};font-size:11px;color:var(--ink-soft)">${fx?'สัญญาลำนี้เลย<br><span style="color:#A05A1A">สลับต้องแจ้งก่อน</span>':('ไม่น้อยกว่า '+min+' ที่<br><span style="color:#0C6B47">สลับลำได้เอง</span>')}</td>
          <td class="bklk-note" style="${td3};font-size:11.5px;color:${l.reason?'var(--ink)':'var(--ink-faint)'};white-space:normal;line-height:1.5;min-width:150px;max-width:300px;overflow-wrap:anywhere">${l.reason?esc(l.reason):'—'}</td>
          <td style="${td3}">${od
            ? `<span style="font-size:10.5px;font-weight:700;color:#A32D2D;background:#FDECEA;border-radius:6px;padding:2px 8px">${esc(l.expiry)} · เลยแล้ว</span>`
            : `<span style="font-size:11px;color:var(--ink-soft);font-family:'DM Mono',monospace">${esc(l.expiry||'—')}</span>`}</td>
          <td style="${td3};text-align:right;white-space:nowrap">
            <button onclick="bookingV2BoatLockToCharter('${l.id}')" style="font-family:inherit;font-size:11px;font-weight:700;color:#fff;background:#6B289A;border:1px solid #6B289A;border-radius:7px;padding:4px 9px;cursor:pointer;margin-right:4px">เหมาลำ</button>
            <button onclick="bookingV2BoatLockEditOpen('${l.id}')" title="แก้ผู้ถือ วันหมดอายุ หมายเหตุ หรือย้ายวัน/ลำ" style="font-family:inherit;font-size:11px;font-weight:600;color:#2A5EA8;background:#EAF1FB;border:1px solid #C3D8F2;border-radius:7px;padding:4px 9px;cursor:pointer;margin-right:4px">แก้ไข</button>
            <button onclick="bookingV2BoatLockSwapGo('${l.id}')" style="font-family:inherit;font-size:11px;font-weight:600;color:#5B3A8C;background:#F8F5FD;border:1px solid #D9CCEC;border-radius:7px;padding:4px 9px;cursor:pointer;margin-right:4px">เปลี่ยนลำ</button>
            <button onclick="bookingV2BoatLockReleaseGo('${l.id}')" style="font-family:inherit;font-size:11px;font-weight:600;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:7px;padding:4px 9px;cursor:pointer">ปล่อยลำ</button></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>
    </div>`;
  })();

  // ── แถบกรอง ──
  const rOpts = (typeof ROUTES!=='undefined'?ROUTES:[]).filter(r=>_lkOk(r.id)).map(r=>`<option value="${r.id}" ${U.route===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
  const holderNames = [...new Set(SB_SEAT_LOCKS.filter(l=>!l.parentId && !bookingV2IsBoatLock(l) && _lkOk(l.routeId)).map(bookingV2LockHolderName))].sort();
  const hOpts = holderNames.map(h=>`<option ${U.holder===h?'selected':''}>${esc(h)}</option>`).join('');
  const seg = (field, opts) => `<span style="display:inline-flex;background:#F3F1EC;border-radius:9px;padding:2px;gap:2px">`
    + opts.map(([v,l])=>`<button onclick="bookingV2LockUISet('${field}','${v}')" style="border:none;background:${U[field]===v?'#fff':'transparent'};box-shadow:${U[field]===v?'0 1px 2px rgba(0,0,0,.08)':'none'};border-radius:7px;padding:4px 11px;font-family:inherit;font-size:11.5px;font-weight:600;color:${U[field]===v?'var(--ink)':'var(--ink-soft)'};cursor:pointer">${l}</button>`).join('')
    + `</span>`;
  const inp = 'font-family:inherit;font-size:12px;border:1px solid var(--border);border-radius:8px;padding:5px 9px;background:#FBFAF7;color:var(--ink)';

  // ── กรอง ──
  let rows = SB_SEAT_LOCKS.filter(l=>{
    /* §bkLock · ใบชนิดเรือมีตารางของตัวเองข้างบน · ถ้าโผล่ที่นี่ด้วยจะอ่านเป็นล็อกที่นั่ง
       qty 44 จะถูกอ่านว่า "กันที่นั่งไว้ 44 ที่" ทั้งที่มันคือความจุของลำ คนละความหมาย */
    if(bookingV2IsBoatLock(l)) return false;
    if(l.parentId) return false;
    if(!_lkOk(l.routeId)) return false;
    if(U.st==='active' && l.status!=='active') return false;
    if(U.route && l.routeId!==U.route) return false;
    if(U.holder && bookingV2LockHolderName(l)!==U.holder) return false;
    if(U.scope==='day' && bookingV2LockSpansDays(l)) return false;
    if(U.scope==='bulk' && !bookingV2LockSpansDays(l)) return false;
    if(U.q){ const hay=(routeName(l.routeId)+' '+bookingV2LockHolderName(l)+' '+(l.reason||'')).toLowerCase();
             if(hay.indexOf(U.q.toLowerCase())<0) return false; }
    return true;
  });
  // เรียง: วันที่ใกล้สุดก่อน
  const sortKey = l => bookingV2LockSpansDays(l) ? (bookingV2LockRange(l).from||'') : (l.date||'');
  rows.sort((a,b)=> sortKey(a).localeCompare(sortKey(b)) || routeName(a.routeId).localeCompare(routeName(b.routeId)));

  const bar = `<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;background:#fff;border:1px solid var(--border);border-radius:12px;padding:8px 10px;margin:0 12px 10px">
      <input type="search" value="${esc(U.q)}" placeholder="ค้นหา เส้นทาง / เอเจ้น / โน้ต…" oninput="bookingV2LockUISet('q',this.value)" style="${inp};width:210px">
      <select onchange="bookingV2LockUISet('route',this.value)" style="${inp}"><option value="">ทุกเส้นทาง</option>${rOpts}</select>
      <select onchange="bookingV2LockUISet('holder',this.value)" style="${inp}"><option value="">ทุกผู้ถือ</option>${hOpts}</select>
      <select onchange="bookingV2LockUISet('scope',this.value)" style="${inp}"><option value="">ทุกแบบ</option><option value="day" ${U.scope==='day'?'selected':''}>รายวัน</option><option value="bulk" ${U.scope==='bulk'?'selected':''}>Bulk ช่วงวันที่</option></select>
      <span style="font-size:10.5px;color:var(--ink-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-left:6px">สถานะ</span>
      ${seg('st',[['active','ใช้งานอยู่'],['all','ทั้งหมด']])}
      <span style="font-size:10.5px;color:var(--ink-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-left:6px">จัดกลุ่ม</span>
      ${seg('grp',[['holder','เอเจ้น'],['route','เส้นทาง'],['none','ไม่จัด']])}
      <span style="margin-left:auto;font-size:11.5px;color:var(--ink-soft)">${rows.length} รายการ</span>
    </div>`;

  // ── ชิ้นส่วนของแถว ──
  const stChip = st => {
    const m = { active:['#0F6E56','#E1F5EE'], depleted:['#64748B','#F1F5F9'], released:['#A05A1A','#FBEFD9'], expired:['#A32D2D','#FDECEA'] };
    const c = m[st]||['#64748B','#F1F5F9'];
    return `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${c[0]};background:${c[1]};padding:2px 6px;border-radius:5px">${st}</span>`;
  };
  const dowChips = l => {
    if(!bookingV2LockSpansDays(l)) return '';
    const on = Array.isArray(l.dow)&&l.dow.length ? l.dow : null;
    return `<span style="display:inline-flex;gap:2px;margin-left:6px;vertical-align:middle">`
      + DOWL.map((d,i)=>`<i style="font-style:normal;width:14px;height:14px;border-radius:3px;font-size:8px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;background:${(!on||on.indexOf(i)>=0)?'#5B3FA5':'#EEECE5'};color:${(!on||on.indexOf(i)>=0)?'#fff':'#b3b0a7'}">${d}</i>`).join('')
      + `</span>`;
  };
  const whenCell = l => {
    if(!bookingV2LockSpansDays(l)) return `<span style="font-size:9px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#2A5EA8;background:#EAF1FB;padding:2px 7px;border-radius:5px">รายวัน</span> <span style="font-family:'DM Mono',monospace;font-size:11.5px">${esc(l.date||'')}</span>`;
    const rg = bookingV2LockRange(l);
    /* §lkZero · ล็อกที่ช่วงวันกับวันในสัปดาห์ไม่ตรงกันเลย · ไม่ขึ้น manifest วันไหนทั้งนั้น
       เคส Panorama · ตั้งวันเริ่มวันเสาร์ ไม่ใส่วันจบ (ช่วงยุบเหลือวันเดียว) แล้วติ๊กอังคาร/พฤหัส
       ของเดิมเงียบสนิท เห็นแค่ "ผ่านมา 0/0 รอบ" ซึ่งอ่านเหมือนยังไม่ถึงรอบแรก */
    const _rd = bookingV2LockRounds(l);
    /* §lkHeal · ช่วงวันหายไปกับ round-trip ของ SQL และไม่มีร่องรอยให้กู้ · ต้องกรอกใหม่เอง
       แยกป้ายจาก §lkZero เพราะสาเหตุคนละเรื่อง · อันนี้ไม่ใช่คนตั้งผิด แต่ข้อมูลหายไปจริง */
    if(l.scope==='bulk' && !l.dateFrom)
      return `<span style="font-size:9px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#5B3FA5;background:#F3EEFB;padding:2px 7px;border-radius:5px">Bulk</span>`
        + `<div style="margin-top:3px"><span class="lkheal" style="font-size:9.5px;font-weight:700;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:5px;padding:1px 7px" title="ช่วงวันของล็อกใบนี้หายไปตอนบันทึกขึ้นระบบ (ตารางยังไม่มีคอลัมน์วันเริ่ม-วันจบ) และไม่มีร่องรอยเดิมให้กู้คืน · ล็อกนี้ยังไม่ขึ้น manifest วันไหนเลย · กดแก้ไขเพื่อกรอกช่วงวันใหม่">&#9888; ช่วงวันหาย · กรอกใหม่</span></div>`;
    const _zero = !_rd.total ? `<div style="margin-top:3px"><span style="font-size:9.5px;font-weight:700;color:#A32D2D;background:#FDECEA;border:1px solid #F5C9C4;border-radius:5px;padding:1px 7px" title="ช่วงวันที่กับวันในสัปดาห์ที่ติ๊กไว้ไม่ตรงกันเลย · ล็อกนี้จึงไม่ขึ้นใน manifest วันไหนเลย${(!l.dateTo)?' — ยังไม่ได้ใส่วันจบ ช่วงจึงเหลือวันเดียว':''} · กดแก้ไขเพื่อตั้งใหม่">&#9888; ไม่ครอบรอบไหนเลย${(!l.dateTo)?' · ยังไม่ได้ใส่วันจบ':''}</span></div>` : '';
    return `<span style="font-size:9px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#5B3FA5;background:#F3EEFB;padding:2px 7px;border-radius:5px">Bulk</span> <span style="font-family:'DM Mono',monospace;font-size:11.5px">${esc(rg.from)} <span style="color:var(--ink-faint)">&rarr;</span> ${esc(rg.to)}</span>${dowChips(l)}${_zero}`;
  };
  const bar6 = (pct,col) => `<div style="height:5px;border-radius:3px;background:#EFEDE6;margin-top:4px;overflow:hidden"><div style="width:${Math.max(0,Math.min(100,pct))}%;height:100%;background:${col||'#0F7A5A'}"></div></div>`;

  const lockRow = (l, showHolder) => {
    const kids = bookingV2LockChildren(l.id);
    const hasKids = kids.length>0;
    const isBulk = bookingV2LockSpansDays(l);
    const usedTot = (l.used||0) + kids.reduce((s,c)=>s+(c.used||0),0);
    const rounds = isBulk ? bookingV2LockRounds(l) : {total:1,past:1};
    const offered = isBulk ? (l.qty||0)*(rounds.past||0) : (l.qty||0);
    const pct = offered ? Math.round(usedTot/offered*100) : 0;
    const usedCell = isBulk
      ? `<div style="font-family:'DM Mono',monospace;font-size:11.5px"><b style="font-size:13px">${usedTot}</b> ที่ <span style="color:var(--ink-faint)">· ผ่านมา ${rounds.past}/${rounds.total} รอบ</span></div>${bar6(pct)}`
      : `<div style="font-family:'DM Mono',monospace;font-size:11.5px"><b style="font-size:13px">${usedTot}</b>/${l.qty||0}</div>${bar6(pct)}`;
    const leftNow = isBulk ? (l.qty||0) : bookingV2LockHeldRemaining(l);
    const leftCell = isBulk
      ? `<div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;text-align:center;line-height:1.1">${leftNow}</div><div style="font-size:9px;color:var(--ink-faint);text-align:center">/รอบ</div>`
      : `<div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;text-align:center;color:${leftNow?'var(--ink)':'var(--ink-faint)'}">${leftNow}</div>`;
    const _pds = (l.status==='active' && !l.parentId) ? bookingV2LockPendDates(l) : [];
    const qtyCell = `<div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;text-align:center;color:#C0392B;line-height:1.1">${l.qty||0}</div>`
      + (isBulk?`<div style="font-size:9px;color:var(--ink-faint);text-align:center">/รอบ</div>`:'')
      /* §lkPend · ป้ายบอกว่าใบนี้ยังมีส่วนที่รอที่ว่าง · ล็อกแบบช่วงบอกเป็นจำนวนรอบ รายวันดูได้ที่ "ล็อกของวัน" */
      + (_pds.length?`<div class="lkpend-tag" data-lkpend-list="${l.id}" title="${esc(_pds.slice(0,12).map(x=>x.date+' · '+x.n).join('\n'))}${_pds.length>12?'\n...':''}" style="font-size:10px;font-weight:700;color:#64748B;background:#F4F5F7;border:1px dashed #C3CAD5;border-radius:6px;padding:1px 6px;margin-top:3px;text-align:center;white-space:nowrap">&#9203; Pending ${isBulk?(_pds.length+' รอบ'):_pds[0].n}</div>`:'');
    const _pd1 = (!isBulk && _pds.length) ? _pds[0] : null;
    const _pd1Free = _pd1 ? bookingV2LockFreeOn(l.routeId, _pd1.date, null) : 0;
    const _pd1Can = _pd1 ? ((_pd1Free==null) ? _pd1.n : Math.min(_pd1.n, _pd1Free)) : 0;
    const relTxt = bookingV2LockCutoffLabel(l) || (l.expiry ? ('หมดอายุ '+l.expiry) : '—');
    const subChip = hasKids ? `<span style="font-size:9px;font-weight:700;color:#534AB7;background:#EEEDFE;padding:1px 6px;border-radius:5px">${kids.length} ย่อย</span>` : '';
    const btn = (fn,lbl,col,bg,bd)=>`<button onclick="${fn}" style="font-family:inherit;font-size:11px;font-weight:600;color:${col};background:${bg};border:1px solid ${bd};border-radius:7px;padding:4px 9px;cursor:pointer">${lbl}</button>`;
    const acts = `<div style="display:flex;gap:5px;justify-content:flex-end;white-space:nowrap">`
      + (_pd1Can>0 ? btn(`bookingV2LockPendConfirmGo('${l.id}','${_pd1.date}')`,'ยืนยัน '+_pd1Can+' ที่','#fff','#0F6E56','#0F6E56') : '')
      + (l.status==='active'? btn(`bookingV2LockAddOpen('${l.id}')`,'+ ที่นั่ง','#0F6E56','#E1F5EE','#B7E2D2') : '')
      + (l.status==='active' && bookingV2LockUnalloc(l)>0 ? btn(`bookingV2SubOpen('${l.id}')`,'+ ย่อย','#534AB7','#EEEDFE','#CECBF6') : '')
      + (l.status==='active'? btn(`bookingV2LockReleaseConfirm('${l.id}')`,'คืน','#A32D2D','#FDECEA','#F5C9C4') : '')
      /* §lkEdit · ปุ่มแก้ไข · เคสจริงคือตั้งช่วงวันผิดแล้วไม่มีทางแก้นอกจากลบทิ้งสร้างใหม่ */
      + (l.status==='active'? btn(`bookingV2LockEditOpen('${l.id}')`,'แก้ไข','#2A5EA8','#EAF1FB','#C3D8F2') : '')
      + btn(`bookingV2LockManageOpen('${l.id}')`,'ประวัติ','var(--ink-soft)','#fff','var(--border)')
      + `</div>`;
    const open = !!U.open[l.id];
    const td = 'border-bottom:1px solid var(--border-2);padding:8px 10px;vertical-align:middle';
    let h = `<tr>
      <td style="${td};width:26px">${hasKids?`<button onclick="bookingV2LockUIToggle('${l.id}')" style="border:none;background:transparent;cursor:pointer;color:var(--ink-faint);font-size:11px;width:18px">${open?'&#9662;':'&#9656;'}</button>`:''}</td>
      ${showHolder?`<td style="${td}"><div style="font-size:12.5px;font-weight:700;color:var(--ink)"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bookingV2LockHolderColor(l)};margin-right:7px;vertical-align:0"></span>${esc(bookingV2LockHolderName(l))}</div><div style="font-size:10px;margin-top:2px">${stChip(l.status)} ${subChip}</div></td>`:''}
      <td style="${td}"><div style="display:flex;align-items:center;gap:8px;min-width:0">
        <span style="width:3px;height:26px;border-radius:2px;flex:none;background:${routeColor(l.routeId)}"></span>
        <div style="min-width:0"><div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(routeName(l.routeId))}</div>
        <div style="font-size:10px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${showHolder?'':stChip(l.status)+' '+subChip+' '}${esc(l.reason||'')}</div></div></div></td>
      <td style="${td};white-space:nowrap">${whenCell(l)}</td>
      <td style="${td};width:92px">${qtyCell}</td>
      <td style="${td};width:170px">${usedCell}</td>
      <td style="${td};width:76px">${leftCell}</td>
      <td style="${td};font-size:11px;color:var(--ink-soft);white-space:nowrap">${esc(relTxt)}</td>
      <td style="${td};width:258px">${acts}</td>
    </tr>`;
    if(open) kids.forEach(c=>{
      const cPct = c.qty ? Math.round((c.used||0)/c.qty*100) : 0;
      h += `<tr style="background:#FCFBF8">
        <td style="${td}"></td>
        ${showHolder?`<td style="${td};padding-left:26px;font-size:12px;font-weight:600">&#8627; ${esc(c.subName||'ย่อย')}</td>`:''}
        <td style="${td};${showHolder?'':'padding-left:32px'};font-size:11.5px;color:var(--ink-soft)">${showHolder?'':`<b style="color:var(--ink);font-size:12px">&#8627; ${esc(c.subName||'ย่อย')}</b> · `}แบ่งจาก ${esc(bookingV2LockHolderName(l))}</td>
        <td style="${td};font-size:11px;color:var(--ink-faint)">ตามล็อกหลัก</td>
        <td style="${td}"><div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;text-align:center;color:#534AB7">${c.qty||0}</div></td>
        <td style="${td}"><div style="font-family:'DM Mono',monospace;font-size:11.5px"><b style="font-size:13px">${c.used||0}</b>/${c.qty||0}</div>${bar6(cPct)}</td>
        <td style="${td}"><div style="font-family:'DM Mono',monospace;font-size:15px;font-weight:700;text-align:center">${Math.max(0,(c.qty||0)-(c.used||0))}</div></td>
        <td style="${td}"></td>
        <td style="${td}"><div style="display:flex;gap:5px;justify-content:flex-end">
          ${c.status==='active'?btn(`bookingV2LockAddOpen('${c.id}')`,'+ ที่นั่ง','#0F6E56','#E1F5EE','#B7E2D2'):''}
          ${c.status==='active'?btn(`bookingV2LockReleaseConfirm('${c.id}')`,'คืน','#A32D2D','#FDECEA','#F5C9C4'):''}
        </div></td>
      </tr>`;
    });
    return h;
  };

  // ── จัดกลุ่ม ──
  const keyOf = l => U.grp==='holder' ? bookingV2LockHolderName(l) : (U.grp==='route' ? routeName(l.routeId) : '');
  const groups = [...new Set(rows.map(keyOf))].sort();
  const showHolder = U.grp!=='holder';
  const nCol = showHolder ? 9 : 8;
  let body='';
  // §lkStickyFix · แต่ละกลุ่มอยู่ใน tbody ของตัวเอง · หัวกลุ่มจะได้ดันกันออกแทนที่จะทับกัน
  groups.forEach(k=>{
    const list = rows.filter(l=>keyOf(l)===k);
    body += '<tbody>';
    if(U.grp!=='none'){
      // §lkOverview · หัวกลุ่มเอเจ้นใช้สีประจำเอเจ้น · กวาดตาหาเจ้าที่ต้องการได้เร็ว
      // §lkTomorrow · ลงสีทั้งแถบ ไม่ใช่แค่ขีดซ้าย · แถบสีบาง ๆ ยังหาไม่เจออยู่ดี
      const col = U.grp==='route' ? routeColor(list[0].routeId) : bookingV2LockHolderColor(list[0]);
      const _rgba=(typeof _calRgba==='function')?_calRgba:function(c,a){return c;};
      const _dk=(typeof _calDk==='function')?_calDk:function(c,k){return c;};
      const hBg=_rgba(col,.15), hFg=_dk(col,.45), hBd=_rgba(col,.32);
      const meta = U.grp==='holder'
        ? `${list.length} ล็อก · ${new Set(list.map(l=>l.routeId)).size} เส้นทาง`
        : `${list.length} ล็อก · ${new Set(list.map(bookingV2LockHolderName)).size} ผู้ถือ`;
      const dSeats = list.filter(l=>!bookingV2LockSpansDays(l)).reduce((a,l)=>a+bookingV2LockHeldRemaining(l),0);
      const bSeats = list.filter(l=>bookingV2LockSpansDays(l)).reduce((a,l)=>a+(l.qty||0),0);
      body += `<tr><td colspan="${nCol}" style="background:${hBg};border-top:1px solid ${hBd};border-bottom:1px solid ${hBd};padding:7px 10px">
        <div style="display:flex;align-items:center;gap:9px">
          <span style="width:4px;height:16px;border-radius:2px;background:${col}"></span>
          <span style="font-size:12.5px;font-weight:700;color:${hFg}">${esc(k)}</span>
          <span style="font-size:10.5px;color:${hFg};opacity:.72">${meta}</span>
          <span style="margin-left:auto;font-size:10.5px;color:${hFg};opacity:.72">รายวันกันอยู่ ${dSeats} ที่ · Bulk ${bSeats} ที่/รอบ</span>
        </div></td></tr>`;
    }
    list.forEach(l=>{ body += lockRow(l, showHolder); });
    body += '</tbody>';
  });
  if(!body) body = `<tbody><tr><td colspan="${nCol}" style="padding:34px;text-align:center;color:var(--ink-faint)">ไม่มีล็อกที่ตรงกับตัวกรอง</td></tr></tbody>`;

  // §lkStickyFix · ความสูงหัวตารางคงที่ 31px · หัวกลุ่มยึดที่ 31px พอดี ไม่เหลื่อม
  const th='position:sticky;top:0;z-index:4;background:#FAF9F5;border-bottom:1px solid var(--border);font-size:9.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:0 10px;height:31px;line-height:31px;white-space:nowrap';
  const table = `<div style="margin:0 12px 40px;background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div style="max-height:calc(100vh - 300px);overflow:auto">
        <table style="width:100%;border-collapse:separate;border-spacing:0">
          <thead><tr>
            <th style="${th};width:26px"></th>
            ${showHolder?`<th style="${th}">เอเจ้น / ผู้ถือ</th>`:''}
            <th style="${th}">เส้นทาง</th><th style="${th}">วันที่</th>
            <th style="${th};text-align:center">ที่นั่ง</th>
            <th style="${th}">ใช้ไปแล้ว</th>
            <th style="${th};text-align:center">คงเหลือ</th>
            <th style="${th}">ปล่อยคืน</th><th style="${th};width:258px"></th>
          </tr></thead>
          ${body}
        </table>
      </div>
    </div>`;

  /* §lkSweep · ที่นั่งผีต้องเห็นตั้งแต่หน้าแรกของแท็บ ไม่ใช่ต้องเปิดล็อคทีละใบถึงจะรู้ */
  const _sw=(typeof bookingV2LockSweep==='function')?bookingV2LockSweep():{nBad:0,nOver:0,seats:0,seatsOver:0,rows:[],over:[]};
  const _swTot=_sw.seats+_sw.seatsOver;
  const _swBar = (!_swTot) ? '' : `
    <div style="margin:0 12px 10px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:11px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="min-width:0;flex:1">
        <div style="font-size:12.5px;font-weight:700;color:#9A3412">มีที่นั่งกันไว้เปล่า ${_swTot} ที่ · ขายไม่ได้</div>
        <div style="font-size:10.5px;color:#B45309;line-height:1.65;margin-top:2px">
          ${_sw.seats?`${_sw.seats} ที่ไม่มีใบจองรออยู่ใน ${_sw.nBad} ล็อค`:''}${(_sw.seats&&_sw.seatsOver)?' · ':''}${_sw.seatsOver?`${_sw.seatsOver} ที่มาจาก ${_sw.nOver} ล็อคที่แบ่งกรุ๊ปย่อยเกินจำนวนที่มี`:''}
        </div>
      </div>
      <button onclick="bookingV2LockSweepOpen()" style="font-family:inherit;font-size:12px;font-weight:700;color:#fff;background:#B45309;border:none;border-radius:8px;padding:8px 14px;cursor:pointer">ดูรายการ</button>
    </div>`;
  const _swModal = !_bkV2SweepOpen ? '' : (function(){
    const S=_sw;
    const th='position:sticky;top:0;background:#fff;border-bottom:1px solid var(--border-2);font-size:9.5px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:6px 10px;white-space:nowrap;z-index:2';
    const td='border-bottom:1px solid var(--border-2);padding:7px 10px;font-size:11.5px;vertical-align:top';
    const rws=S.rows.length?S.rows.map(r=>`<tr>
        <td style="${td}"><b>${esc(r.name)}</b><div style="font-size:10px;color:var(--ink-soft)">${esc(r.date||'—')} · ${esc(routeName(r.routeId))}</div></td>
        <td style="${td};text-align:center;font-family:'DM Mono',monospace">${r.used}</td>
        <td style="${td};text-align:center;font-family:'DM Mono',monospace">${r.live}</td>
        <td style="${td};text-align:center;font-family:'DM Mono',monospace;font-weight:700;color:#A32D2D">${r.diff}</td>
        <td style="${td};font-size:10px;color:var(--ink-soft);line-height:1.6">${esc(r.vcs.slice(0,4).join(' · '))}${r.vcs.length>4?(' … +'+(r.vcs.length-4)):''}</td>
      </tr>`).join(''):`<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--ink-faint);font-size:11.5px">ไม่มี</td></tr>`;
    const ovs=S.over.length?S.over.map(r=>`<tr>
        <td style="${td}"><b>${esc(r.name)}</b><div style="font-size:10px;color:var(--ink-soft)">${esc(r.date||'—')} · ${esc(routeName(r.routeId))}</div></td>
        <td style="${td};text-align:center;font-family:'DM Mono',monospace">${r.qty}</td>
        <td style="${td};text-align:center;font-family:'DM Mono',monospace">${r.alloc}</td>
        <td style="${td};text-align:center;font-family:'DM Mono',monospace">${r.used}</td>
        <td style="${td};text-align:center;font-family:'DM Mono',monospace;font-weight:700;color:#A32D2D">${r.over}</td>
      </tr>`).join(''):`<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--ink-faint);font-size:11.5px">ไม่มี</td></tr>`;
    return `<div onclick="bookingV2LockSweepClose()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:14px;width:760px;max-width:95vw;max-height:88vh;overflow:auto;box-shadow:0 16px 50px rgba(0,0,0,.3)">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-size:9px;font-weight:700;letter-spacing:.06em;color:#B45309;text-transform:uppercase">Seat lock sweep</div>
            <div style="font-size:16px;font-weight:700;color:var(--ink);margin-top:2px">ที่นั่งที่กันไว้เปล่า</div>
            <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">ไล่ครบ ${S.locks} ล็อคทั้งระบบ</div>
          </div>
          <button onclick="bookingV2LockSweepClose()" style="border:none;background:transparent;font-size:20px;color:var(--ink-soft);cursor:pointer;line-height:1">&times;</button>
        </div>
        <div style="padding:14px 18px">
          <div style="font-size:11px;font-weight:700;color:#A32D2D;text-transform:uppercase;letter-spacing:.05em">1 · ตัวนับไม่ตรงกับใบจอง · ${S.nBad} ล็อค · ${S.seats} ที่</div>
          <div style="font-size:10.5px;color:var(--ink-soft);line-height:1.7;margin:3px 0 8px">
            ใบย้ายวันไปแล้ว <b>${S.seatsMoved}</b> ที่ · ใบยกเลิกไปแล้ว <b>${S.seatsDead}</b> ที่ ·
            แก้ได้อัตโนมัติทั้งหมด (ตั้งตัวนับใหม่ให้ตรงใบจอง · จำนวนที่กันไว้ไม่เปลี่ยน)
          </div>
          <div style="border:1px solid var(--border-2);border-radius:10px;overflow:auto;max-height:34vh">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr><th style="${th}">ล็อค</th><th style="${th};text-align:center">นับว่าใช้</th><th style="${th};text-align:center">ใบจองจริง</th><th style="${th};text-align:center">ส่วนต่าง</th><th style="${th}">ใบที่ไม่นับแล้ว</th></tr></thead>
              <tbody>${rws}</tbody></table></div>
          ${S.nBad?`<button onclick="bookingV2LockSweepFixAll()" style="margin-top:10px;font-family:inherit;font-size:12px;font-weight:700;color:#fff;background:#B45309;border:none;border-radius:8px;padding:8px 14px;cursor:pointer">คืนที่นั่งทั้งหมด ${S.seats} ที่</button>`:''}

          <div style="font-size:11px;font-weight:700;color:#A32D2D;text-transform:uppercase;letter-spacing:.05em;margin-top:18px">2 · แบ่งกรุ๊ปย่อยเกินจำนวนที่มี · ${S.nOver} ล็อค · ${S.seatsOver} ที่</div>
          <div style="font-size:10.5px;color:var(--ink-soft);line-height:1.7;margin:3px 0 8px">
            ล็อคแม่ขายที่นั่งไปเอง แล้วที่นั่งก้อนเดิมถูกแบ่งลงกรุ๊ปย่อยซ้ำอีก · ยอด Held จึงต่ำกว่าความจริง
            <b>แก้อัตโนมัติไม่ได้</b> ต้องเลือกเองว่าจะย้ายใบจองไปผูกกรุ๊ปย่อย ลดจำนวนกรุ๊ปย่อยลง หรือเพิ่มที่นั่งให้ล็อค
          </div>
          <div style="border:1px solid var(--border-2);border-radius:10px;overflow:auto;max-height:28vh">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr><th style="${th}">ล็อค</th><th style="${th};text-align:center">มีทั้งหมด</th><th style="${th};text-align:center">แบ่งย่อย</th><th style="${th};text-align:center">แม่ขายเอง</th><th style="${th};text-align:center">เกิน</th></tr></thead>
              <tbody>${ovs}</tbody></table></div>
        </div>
        <div style="display:flex;gap:8px;padding:12px 18px;background:#fafafa;border-top:1px solid var(--border)">
          <button onclick="bookingV2LockSweepClose()" style="margin-left:auto;font-family:inherit;font-size:12px;font-weight:600;color:var(--ink-soft);background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 14px;cursor:pointer">ปิด</button>
        </div>
      </div>
    </div>`;
  })();
  return `<div class="bkv2-locks">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 12px 10px">
      <div><div style="font-size:16px;font-weight:700;letter-spacing:-.01em">Seat Locks</div>
        <div style="font-size:11.5px;color:var(--ink-soft)">ที่นั่งที่กันไว้ก่อนขายเข้า pool รวม</div></div>
      <button onclick="bookingV2BoatLockOpen()" title="กันเรือทั้งลำไว้ให้เอเยนต์ · เรือจะหายจากพูลขายที่นั่งทันที" style="font-family:inherit;font-size:12.5px;font-weight:700;color:#fff;background:#6B289A;border:1px solid #6B289A;border-radius:9px;padding:7px 14px;cursor:pointer;margin-left:auto">+ ล็อกเรือทั้งลำ</button>
      <button class="bkv2-newbtn2" onclick="bookingV2OpenLockModal()" style="font-size:12.5px">+ ล็อกที่นั่ง</button>
    </div>
    ${_swBar}${_swModal}
    ${cards}
    ${todayBox}
    ${boatBox}
    ${bar}
    ${table}
  </div>`;
}
