/* §ntRetVan (2026-10-14) · เจ้าของ: "เคสที่เดินทางเองขามา แต่ขากลับใช้รถกลับด้วย ไม่สามารถจัดรถได้"
   ช่องรถของแถว self-arrive คืนคำว่า self-arrive แล้วจบ · ไม่มีที่ให้เลือกรถขากลับ
   ทั้งที่ใบตั้ง "ส่งคนละที่" ไว้ และการ์ดรถก็นับเป็น "ยังไม่จัดรถ" · ใบงานขากลับอ่าน vanReturnId
   โดยไม่สนโซนขาไปอยู่แล้ว (_collect) · ขาดแค่ช่องให้เลือก · รถที่เลือกได้ = รถของเส้นทางวันนั้น
   + รถในโซนของจุดส่ง (จุดส่งอยู่ภูเก็ต ก็เอารถภูเก็ตมาส่ง ไม่ใช่รถของโซนขาไป) */
function bookingV2NtRetSel(bk, date, routeId){
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const ri=(typeof bookingV2RetInfo==='function')?bookingV2RetInfo(bk,date):null;
  if(!ri || !ri.sep || ri.selfRet) return '';
  const _O=(typeof bkOpsRead==='function')?bkOpsRead(bk,date):(bk.ops||{});
  const ar=(bk.dropoffAreaId&&typeof bookingV2GetArea==='function')?bookingV2GetArea(bk.dropoffAreaId):null;
  const dz=(ar&&ar.zone)||null;
  const _rPool=(typeof vanVehiclesForRoute==='function')?vanVehiclesForRoute(date, routeId, dz):[];
  const _zPool=(typeof vanVehiclesForZone==='function')?vanVehiclesForZone(dz, date):[];
  const pool=[..._rPool, ..._zPool.filter(v=>!_rPool.some(r=>r.id===v.id))];
  const rvid=_O.vanReturnId||'';
  let ropts='<option value="">&#8617; รถกลับ</option>';
  pool.forEach(v=>{ ropts+=`<option value="${v.id}" ${rvid===v.id?'selected':''}>&#8617; ${e(v.name||v.id)}</option>`; });
  if(rvid && !pool.some(v=>v.id===rvid)){ const vo=vehGet(rvid); ropts+=`<option value="${rvid}" selected>&#8617; ${e((vo&&vo.name)||rvid)}</option>`; }
  return `<select onchange="event.stopPropagation();bookingV2AssignVanReturn('${bk.id}',this.value,'${date}')" onclick="event.stopPropagation()" title="มาเอง แต่ขากลับส่ง ${e(ri.drop)} · เลือกรถขากลับ" style="border:1px solid ${rvid?'#C7B8E8':'#D9534A'};border-radius:6px;padding:1px 4px;font-size:9.5px;font-family:inherit;background:#fff;color:${rvid?'#534AB7':'#A32D2D'};max-width:84px;padding:1px 0 1px 2px">${ropts}</select>`;
}
