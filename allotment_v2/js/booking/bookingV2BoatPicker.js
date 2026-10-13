// Boat-picker popover · floats next to the clicked button (Boat Op style · dot + name + pier·load)
function bookingV2BoatPicker(el, bkId, routeId){
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const bk=SB_BOOKINGS.find(b=>b.id===bkId); if(!bk) return;
  const old=document.getElementById('bkv2-boatpick'); if(old){ old.remove(); }
  const date=(typeof bookingV2Tab2ActiveDate==='function')?bookingV2Tab2ActiveDate():'';
  const _O=bkOpsRead(bk,date);   // per-day boat
  const up=false;   /* §upgRoute · upgrade ย้ายเส้นทางจริงแล้ว · เรือที่เลือกได้คือเรือของเส้นทางที่ใบอยู่ตอนนี้ */
  /* §OVN · ขากลับค้างคืน — รอบก่อนกางเป็น "เรือทุกลำที่วิ่งวันนั้น" ทันที ซึ่งกว้างเกินไป:
     บุ๊กกิ้ง PP Bamboo เห็นเรือ Phi Maiton / Whale Shark โผล่มาให้เลือกด้วย
     เหตุผลที่กางตอนนั้นคือกันเคส "โปรแกรมขาไปไม่เปิดรันวันที่กลับ" → baBoatsForRoute คืน [] แล้วขึ้น
     "No boats on this route" — แต่นั่นเป็นเคส fallback ไม่ใช่เคสปกติ
     กติกาใหม่: เรือของเส้นทางเดิมก่อนเสมอ · ว่างจริงๆ ค่อยกางทั้งวัน (ยังกดปุ่ม ⤴ upgrade กางเองได้เหมือนเดิม) */
  const _tOnDate = (bk.trips||[]).find(t=>t && (t.date||'')===date && (t.routeId||'')===routeId);
  const _isOvnRet = !!(_tOnDate && _tOnDate.ovnLeg);
  const _routeBoats = baBoatsForRoute(date,routeId);
  const _ovnFallback = _isOvnRet && !_routeBoats.length;   /* เส้นทางเดิมไม่วิ่งวันนั้น → ต้องหาเรือลำอื่นพากลับ */
  const wide = up || _ovnFallback;
  const pool = wide ? baDayBoats(date) : _routeBoats;
  const cur=_O.boatId||'';
  /* ══ §bpk2 (2026-10-13) · หน้าตาตัวเลือกเรือใหม่ ══════════════════════════════════
     owner (ภาพตัวเลือกเรือจาก By trip): "ตอนคลิกเรือ ทำให้เห็นหน่อยว่าเราคลิกเรือของบุคกิ้งนั้น
     และมันยังไม่มีตัวที่เราทำไว้ Upgrade กับ แยกลงเรือด้วย · ขอออกแบบ UI ใหม่นิด"
     · หัวบอกว่าเป็นของใบไหน: ชื่อลูกค้า · voucher · จำนวนคน · โปรแกรม · และแถวนั้นในตารางถูกไฮไลต์ไว้ตลอดที่เปิด
     · เรือแต่ละลำ: วงสีประจำเรือ + ชื่อ · ท่า · แถบความจุ · ยอดตอนนี้ → ยอดถ้าใส่ใบนี้ (เกินขึ้นแดง)
     · ท้าย: ⤴ Upgrade · ⇆ แยกลงหลายลำ · × ถอดเรือ (ปุ่มเดียวกับในโหมดเรือ ทำงานเหมือนเดิม)
     กดเลือก/ถอด → bookingV2AssignBoat ตัวเดิม (ด่าน cap / เหมาลำ / แยกลำ ครบ) */
  const q=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const myPax=(bk.trips||[]).filter(t=>t && (t.date||'')===date).reduce((s2,t)=>s2+((typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax||{}):0),0);
  const _code=(/^b2c_/.test(String(bk.id)) && typeof bookingV2DisplayCode==='function') ? bookingV2DisplayCode(bk) : (bk.voucherRef||'');
  const _rn=(typeof bookingV2RouteShort==='function' && bookingV2RouteShort(routeId)) || (((typeof getRoute==='function' && getRoute(routeId))||{}).name) || routeId;
  const _upT=(typeof bkUpgTripOn==='function')?bkUpgTripOn(bk, date, routeId):null;
  const _up=!!(_upT && typeof bkUpgActive==='function' && bkUpgActive(_upT));
  const _sp=(typeof bkBoatSplits==='function')?bkBoatSplits(bk,date):null;
  const _poolN=(typeof bkBoatPoolOn==='function' && typeof bkPaxSum==='function')?bkPaxSum(bkBoatPoolOn(bk,date)):myPax;
  const _canSplit=!!_sp || _poolN>=2;
  const TOL=(typeof BA_CAP_TOL!=='undefined')?BA_CAP_TOL:2;
  const rowsH = pool.length ? pool.map(x=>{
    const cap=(typeof boatCapFor==='function')?boatCapFor(x.boatId,date):(x.boat.cap||0);
    const load=(typeof baAssignedPax==='function')?baAssignedPax(date,x.boatId):0;
    const on=(cur===x.boatId);
    const next=on?load:load+myPax;
    const over=cap>0 && next>cap, hard=cap>0 && next>cap+TOL;
    const pct=cap>0?Math.min(100,Math.round(load/cap*100)):0, pct2=cap>0?Math.min(100,Math.round(next/cap*100)):0;
    const col=(typeof bookingV2BoatAvatarColor==='function')?bookingV2BoatAvatarColor(x.boatId):'#185FA5';
    const nm=x.boat.name||x.boatId, rid2=x.routeId, r2=(typeof getRoute==='function'?getRoute(rid2):null);
    return `<div class="bpk-b${on?' on':''}${hard?' hard':''}" onclick="bookingV2BoatPickSet('${q(bkId)}','${q(x.boatId)}','${q(date)}')" title="${q(nm+' · '+(on?laT('เรือปัจจุบันของใบนี้'):(laT('ใส่ใบนี้')+' '+myPax+' '+laT('คน')+' → '+next+'/'+cap)))}">
      <span class="av" style="background:${col}">${q((typeof bookingV2BoatInitials==='function')?bookingV2BoatInitials(nm):nm.slice(0,2))}</span>
      <span class="nm"><b>${q(nm)}</b><i>${q(_baPierShort(x.boat.pier))}${(wide&&rid2!==routeId)?(' · '+q(r2?r2.name:rid2)):''}</i></span>
      <em class="${over?'ov':''}">${on?(load+'/'+cap):(load+'→<b>'+next+'</b>/'+cap)}</em>
      <span class="bar"><s style="width:${pct2}%;background:${over?'#E5484D':col}40"></s><s style="width:${pct}%;background:${col}"></s></span>
      <span class="ck">${on?'&#10003;':''}</span>
    </div>`; }).join('') : '<div class="bpk-none">'
      +(wide ? 'ยังไม่มีเรือลำไหนวิ่งในวันนี้เลย<br><span>ไปผูกเรือกับวันนี้ที่ Boat Operation ก่อน</span>'
             : 'เส้นทางนี้ยังไม่มีเรือในวันนี้<br><span>ไปผูกเรือกับเส้นทางที่ Boat Operation ก่อน</span>')
      +'</div>';
  const _cls='event.stopPropagation();bookingV2BoatPickClose();';
  const actH = `<div class="bpk-act">
      <button type="button" class="${_up?'on':''}" onclick="${_cls}bookingV2BoatUpgrade('${q(bkId)}','${q(routeId)}','${q(date)}')" title="${q(_up?('Upgrade · '+((typeof bkUpgRouteName==='function')?bkUpgRouteName(_upT.upg.fromRouteId):'')+' · '+laT('กดเพื่อยกเลิก')):laT('ย้ายใบนี้ไปโปรแกรมอื่น (Upgrade)'))}">&#10548; ${_up?laT('ยกเลิก'):'Upgrade'}</button>
      ${_canSplit?`<button type="button" class="${_sp?'on':''}" onclick="${_cls}bookingV2BoatSplit('${q(bkId)}','${q(date)}')" title="${q(laT('แยกคนลงหลายลำ (กรุ๊ปใหญ่ที่ลำเดียวไม่พอ)'))}">&#8646; ${_sp?laTp('แยก {0} ลำ', _sp.length):laT('แยกลำ')}</button>`:''}
      ${cur?`<button type="button" class="un" onclick="event.stopPropagation();bookingV2BoatPickSet('${q(bkId)}','','${q(date)}')" title="${q(laT('ถอดเรือออกจากใบนี้'))}">&times; ${laT('ถอด')}</button>`:''}
    </div>`;
  bookingV2BoatPickCSS();
  const ov=document.createElement('div'); ov.id='bkv2-boatpick';
  ov.style.cssText='position:fixed;inset:0;z-index:600;background:transparent';
  ov.innerHTML=`<div id="bkv2-boatpick-panel" class="bpk">
    <div class="bpk-h">
      <div class="bpk-who"><b>${q(bk.leadPax||bk.customerName||'—')}</b><span>&#128676; ${myPax} ${laT('คน')}${_code?(' · '+q(_code)):''} · ${q(_rn)}${_up?' · ⤴':''}${_sp?(' · ⇆ '+_sp.length+' '+laT('ลำ')):''}${wide?(' · <em>'+(_ovnFallback?laT('ขากลับ · ทุกลำของวัน'):'all routes')+'</em>'):''}</span></div>
      <button type="button" class="x" onclick="bookingV2BoatPickClose()" title="${laT('ปิด')}">&times;</button>
    </div>
    <div class="bpk-l">${rowsH}</div>
    ${actH}
  </div>`;
  ov.addEventListener('mousedown',ev=>{ ov._d=(ev.target===ov); });
  ov.onclick=ev=>{ if(ev.target===ov && ov._d) bookingV2BoatPickClose(); };
  document.body.appendChild(ov);
  /* §bpkCell · owner "ตัวไฮไลต์ ไฮไลต์แค่ของเรือดีกว่า" · ไฮไลต์เฉพาะช่องเรือที่กด (ไม่ทั้งแถว) ตลอดที่ตัวเลือกเปิดอยู่ */
  try{ const td=el.closest && el.closest('td'); if(td) td.classList.add('bpk-cell'); }catch(_){}
  // position next to the button (right side · flip left / clamp if off-screen)
  try{
    const panel=document.getElementById('bkv2-boatpick-panel'); const r=el.getBoundingClientRect(); const pw=panel.offsetWidth||260, ph=panel.offsetHeight||240;
    let left=r.right+8; if(left+pw>window.innerWidth-8) left=Math.max(8, r.left-pw-8);
    let top=r.top-6; if(top+ph>window.innerHeight-8) top=Math.max(8, window.innerHeight-ph-8);
    panel.style.left=left+'px'; panel.style.top=Math.max(8,top)+'px';
  }catch(_){}
  try{ document.addEventListener('keydown', _bkV2BpkEsc); }catch(_){}
}
