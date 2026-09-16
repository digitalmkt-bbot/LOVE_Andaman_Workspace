// Boat-picker popover · floats next to the clicked button (Boat Op style · dot + name + pier·load)
function bookingV2BoatPicker(el, bkId, routeId){
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const bk=SB_BOOKINGS.find(b=>b.id===bkId); if(!bk) return;
  const old=document.getElementById('bkv2-boatpick'); if(old){ old.remove(); }
  const date=(typeof bookingV2Tab2ActiveDate==='function')?bookingV2Tab2ActiveDate():'';
  const _O=bkOpsRead(bk,date);   // per-day boat
  const up=!!_O.upgrade;
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
  const PAL=[['#EEEDFE','#534AB7'],['#FAEEDA','#854F0B'],['#FBEAF0','#993556'],['#E6F1FB','#185FA5'],['#E1F5EE','#0F6E56'],['#FAECE7','#993C1D']];
  const rowsH = pool.length ? pool.map((x,ix)=>{ const c=PAL[ix%PAL.length]; const cap=x.boat.cap||0; const load=(typeof baAssignedPax==='function')?baAssignedPax(date,x.boatId):0; const rid2=x.routeId; const r2=(typeof getRoute==='function'?getRoute(rid2):null);
    return `<div onclick="bookingV2BoatPickSet('${bkId}','${x.boatId}','${date}')" style="display:flex;align-items:center;gap:9px;padding:9px 13px;cursor:pointer;border-top:1px solid #f0eee7;${cur===x.boatId?'background:#F3FBF7':''}" onmouseover="this.style.background='#f7f7f4'" onmouseout="this.style.background='${cur===x.boatId?'#F3FBF7':'#fff'}'">
      <span style="width:10px;height:10px;border-radius:50%;background:${c[1]};flex:none"></span>
      <span style="flex:1;font-weight:700;font-size:13px;color:${c[1]}">${e(x.boat.name||x.boatId)}${(wide&&rid2!==routeId)?` <span style="font-weight:500;color:#999;font-size:11px">· ${e(r2?r2.name:rid2)}</span>`:''}</span>
      <span style="font-size:11px;color:#8a8a82;font-family:'DM Mono',monospace;white-space:nowrap">${_baPierShort(x.boat.pier)} · ${load}/${cap}</span>
      ${cur===x.boatId?'<span style="color:#0F6E56;font-size:13px">&#10003;</span>':''}
    </div>`; }).join('') : '<div style="padding:16px 13px;text-align:center;color:#A32D2D;font-size:12px;line-height:1.6">'
      +(wide ? 'ยังไม่มีเรือลำไหนวิ่งในวันนี้เลย<br><span style="color:#8a8a82">ไปผูกเรือกับวันนี้ที่ Boat Operation ก่อน</span>'
             : 'เส้นทางนี้ยังไม่มีเรือในวันนี้<br><span style="color:#8a8a82">ไปผูกเรือกับเส้นทางที่ Boat Operation ก่อน</span>')
      +'</div>';
  const ov=document.createElement('div'); ov.id='bkv2-boatpick';
  ov.style.cssText='position:fixed;inset:0;z-index:600;background:transparent';
  ov.innerHTML=`<div id="bkv2-boatpick-panel" style="position:fixed;width:288px;max-width:92vw;background:#fff;border:1px solid #e0ddd4;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;font-family:'DM Sans',sans-serif">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 13px;border-bottom:1px solid #eee">
      <div style="font-size:12px;font-weight:800;color:#185FA5">&#128676; Select boat${up?' <span style="color:#6B289A;font-size:9px;background:#F4E8FB;padding:1px 6px;border-radius:6px">all routes</span>':(_ovnFallback?' <span style="color:#8A5B00;font-size:9px;background:#FBEAD5;padding:1px 6px;border-radius:6px" title="เส้นทางเดิมไม่ได้วิ่งวันนี้ · เลือกเรือลำอื่นพากลับได้">OVN · ทั้งวัน</span>':'')}</div>
      <button onclick="document.getElementById('bkv2-boatpick').remove()" style="background:transparent;border:none;font-size:18px;color:#999;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="max-height:50vh;overflow-y:auto">${rowsH}</div>
    ${cur?`<div onclick="bookingV2BoatPickSet('${bkId}','')" style="padding:9px 13px;border-top:1px solid #f0eee7;cursor:pointer;color:#A32D2D;font-size:12px;font-weight:600" onmouseover="this.style.background='#FCEBEB'" onmouseout="this.style.background='#fff'">&times; Unassign</div>`:''}
  </div>`;
  ov.addEventListener('mousedown',ev=>{ ov._d=(ev.target===ov); });
  ov.onclick=ev=>{ if(ev.target===ov && ov._d) ov.remove(); };
  document.body.appendChild(ov);
  // position next to the button (right side · flip left / clamp if off-screen)
  try{
    const panel=document.getElementById('bkv2-boatpick-panel'); const r=el.getBoundingClientRect(); const pw=panel.offsetWidth||288, ph=panel.offsetHeight||300;
    let left=r.right+8; if(left+pw>window.innerWidth-8) left=Math.max(8, r.left-pw-8);
    let top=r.top; if(top+ph>window.innerHeight-8) top=Math.max(8, window.innerHeight-ph-8);
    panel.style.left=left+'px'; panel.style.top=top+'px';
  }catch(_){}
}
