/* §per-trip ops · รถกลับของ split ตามวัน */
function bookingV2VanCellHTML(bk, zone, date, groupColor, routeId, allocKey, allocG, isSplit, isFirst){
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if(zone==='NoTransfer'||zone==='NT') return '<span style="font-size:10px;color:#8a8a82;font-style:italic">self-arrive</span>';
  const _O = (typeof bkOpsRead==='function') ? bkOpsRead(bk, date) : (bk.ops||{});   // per-day van block
  const key = allocKey || bk.id;
  const ai = (typeof key==='string' && key.indexOf('@')>=0) ? +key.split('@')[1] : -1;
  const g = (allocG!==undefined && allocG!==null) ? +allocG : (+_O.vanGroup||0);
  const sel=window._bkV2VanSel&&window._bkV2VanSel[key];
  const gc=g&&groupColor?groupColor[g]:null;
  const myVan = isSplit ? ((_O.vanSplits&&_O.vanSplits[ai]&&_O.vanSplits[ai].vanId)||'') : (_O.vanId||'');
  const vn = myVan ? ((vehGet(myVan)||{}).name||'') : '';
  const chk=`<span onclick="event.stopPropagation();bookingV2VanSelToggle('${key}')" title="เลือกเพื่อจับกลุ่ม" style="display:inline-flex;width:16px;height:16px;border-radius:4px;cursor:pointer;align-items:center;justify-content:center;font-size:11px;flex:none;${sel?'background:#185FA5;color:#fff':'border:1.5px solid #C9CDD4;color:transparent'}">&#10003;</span>`;
  const gchip=g
    ? `<span title="กรุ๊ป ${g}${vn?' · '+e(vn):''}" style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;background:${gc?gc[0]:'#E6F1FB'};color:${gc?gc[1]:'#185FA5'};white-space:nowrap;max-width:88px;overflow:hidden;text-overflow:ellipsis">${g}${vn?' · '+e(vn):''}</span>`
    : '<span style="font-size:10px;color:#c4c2ba">—</span>';
  let retSel='';
  if(g){
    const _rPool=(typeof vanVehiclesForRoute==='function')?vanVehiclesForRoute(date, routeId, zone):[];
    const _zPool=(typeof vanVehiclesForZone==='function')?vanVehiclesForZone(zone, date):[];
    const pool=[..._rPool, ..._zPool.filter(v=>!_rPool.some(r=>r.id===v.id))];   // return van = broader pool (any zone van that day · กลับกับรถคันอื่นได้)
    const rvid= isSplit ? ((_O.vanSplits&&_O.vanSplits[ai]&&_O.vanSplits[ai].vanReturnId)||'') : ((_O.vanReturnId)||'');
    let ropts='<option value="">&#8617;</option>';
    pool.forEach(v=>{ ropts+=`<option value="${v.id}" ${rvid===v.id?'selected':''}>&#8617; ${e(v.name||v.id)}</option>`; });
    if(rvid && !pool.some(v=>v.id===rvid)){ const vo=vehGet(rvid); ropts+=`<option value="${rvid}" selected>&#8617; ${e((vo&&vo.name)||rvid)}</option>`; }
    const retCall = isSplit ? `bookingV2AssignVanReturnSplit('${bk.id}',${ai},this.value,'${date}')` : `bookingV2AssignVanReturn('${bk.id}',this.value,'${date}')`;
    retSel=`<select onchange="event.stopPropagation();${retCall}" onclick="event.stopPropagation()" title="รถขากลับ · ว่างไว้ = กลับคันเดิมของกรุ๊ป" style="border:1px solid ${rvid?'#C7B8E8':'#e3e0d9'};border-radius:6px;padding:1px 4px;font-size:9.5px;font-family:inherit;background:#fff;color:${rvid?'#534AB7':'#a8a59e'};max-width:46px;width:46px;padding:1px 0 1px 2px">${ropts}</select>`;
  }
  // split / un-split controls
  let splitBtn='';
  if(!isSplit){ splitBtn=`<button onclick="event.stopPropagation();bookingV2VanSplit('${bk.id}','${date}')" title="แยกคนขึ้นหลายคัน (เช่น 16 = 12 + 4)" style="font-size:9px;color:#5B289A;background:#F3EFFB;border:1px solid #D9CEF0;border-radius:5px;padding:1px 6px;cursor:pointer;font-family:inherit;white-space:nowrap">&#9986;</button>`; }
  else if(isFirst){ splitBtn=`<span style="display:inline-flex;gap:4px"><button onclick="event.stopPropagation();bookingV2VanSplit('${bk.id}','${date}')" title="แยกเพิ่มอีกคัน" style="font-size:9px;color:#5B289A;background:#F3EFFB;border:1px solid #D9CEF0;border-radius:5px;padding:1px 6px;cursor:pointer;font-family:inherit">&#9986;+</button><button onclick="event.stopPropagation();bookingV2VanUnsplit('${bk.id}','${date}')" title="รวมกลับเป็นก้อนเดียว" style="font-size:9px;color:#A32D2D;background:#fff;border:1px solid #E6C9C3;border-radius:5px;padding:1px 6px;cursor:pointer;font-family:inherit">รวม</button></span>`; }
  /* §btVCell · ของเดิมวางเป็นสามบรรทัดซ้อนกัน (ติ๊ก+ป้ายกรุ๊ป / รถขากลับ / แยกคน)
     แถวในตารางเลยสูงเกือบ 80px ทั้งที่ข้อมูลจริงมีบรรทัดเดียว · ตาไล่ลงมาแล้วเหนื่อย
     ยุบเป็นบรรทัดเดียว · คำยาว ๆ ย้ายไปอยู่ใน title (ชี้เมาส์ยังอ่านได้เหมือนเดิม)
     กว้างขึ้นราว 50px แต่แถวเตี้ยลงราว 50px ต่อแถว · วันละร้อยกว่าแถวคุ้มกว่ามาก */
  return `<div style="display:flex;align-items:center;gap:4px;justify-content:center;flex-wrap:nowrap;white-space:nowrap">
    ${chk}${gchip}${retSel}${splitBtn}
  </div>`;
}
