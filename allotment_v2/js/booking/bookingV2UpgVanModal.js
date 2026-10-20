function bookingV2UpgVanModal(){
  var U=_bkUpgVan; if(!U) return;
  var e=function(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var m=bkUpgVanMembers(U.date, U.from, U.gid), okM=m.filter(function(x){ return !x.why; }), badM=m.filter(function(x){ return !!x.why; });
  var pax=okM.reduce(function(s,x){ return s+x.pax; },0);
  var T=bookingV2UpgTargets(U.date, U.from, '');
  var old=document.getElementById('bkv2-upgvan-ov');
  var sc=(old && old.firstElementChild && !old.querySelector('[data-upg-confirm]'))?old.firstElementChild.scrollTop:0;
  if(old) old.remove();
  var ov=document.createElement('div'); ov.id='bkv2-upgvan-ov'; ov.className='la-modal';
  ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(20,24,22,.42);display:flex;align-items:center;justify-content:center;padding:20px';
  var fromPier=bkUpgPierOf(U.from), pnm=function(p){ return (typeof laPierName==='function')?laPierName(p):p; };
  var vnm=U.vanId?(((typeof vehGet==='function'?vehGet(U.vanId):null)||{}).name||U.vanId):laT('ยังไม่เลือกรถ');
  var dFrom=bkUpgVanDepart(U.from);
  var piers=[]; T.forEach(function(x){ if(piers.indexOf(x.pier)<0) piers.push(x.pier); });
  piers.sort(function(a,c){ return (a===fromPier?0:1)-(c===fromPier?0:1); });
  var one=function(x){ var full=(x.free!=null && x.free<pax), on=(U.to===x.rid), dT=bkUpgVanDepart(x.rid);
      return '<label data-upgvan-to="'+e(x.rid)+'" style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid '+(on?'#6B289A':'#E4E1D9')+';background:'+(on?'#F7F1FC':(full?'#FAFAF8':'#fff'))+';border-radius:10px;cursor:'+(full?'not-allowed':'pointer')+';opacity:'+(full?'.6':'1')+'">'
        +'<input type="radio" name="bkupgvan-to" value="'+e(x.rid)+'" '+(on?'checked':'')+(full?' disabled':'')+' onchange="_bkUpgVan.to=this.value;bookingV2UpgVanModal()" style="accent-color:#6B289A">'
        +'<span style="flex:1;min-width:0"><span style="font-weight:700;font-size:13px">'+e(x.name)+'</span>'+(dT?('<span style="margin-left:6px;font-size:10.5px;color:#8a8a82;font-family:\'DM Mono\',monospace">'+laT('ออก')+' '+e(dT)+'</span>'):'')+'</span>'
        +'<span style="font-size:11px;font-family:\'DM Mono\',monospace;color:'+(full?'#A32D2D':'#0F6E56')+';white-space:nowrap">'+(x.free==null?'-':(x.free+' '+laT('ว่าง')+(on?(' &rarr; '+(x.free-pax)):'')))+'</span></label>'; };
  var opts=T.length?piers.map(function(p){ var same=(p===fromPier);
      return '<div data-upgvan-pier="'+e(p)+'" style="display:flex;flex-direction:column;gap:6px">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-top:4px"><span style="font-size:11.5px;font-weight:800;color:'+(same?'#0F6E56':'#8A5B00')+'">&#9875; '+e(pnm(p))+'</span>'
        +'<span style="font-size:9.5px;font-weight:800;border-radius:6px;padding:1px 7px;background:'+(same?'#DCF4E8':'#FBF0DD')+';color:'+(same?'#0C6B47':'#7A4A00')+'">'+(same?laT('ท่าเดียวกัน · รถคันเดิมไปได้'):laT('ต่างท่า · รถต้องวิ่งอีกท่า เช็คเวลาก่อน'))+'</span></div>'
        +T.filter(function(x){ return x.pier===p; }).map(one).join('')+'</div>'; }).join('')
    : '<div style="padding:14px;text-align:center;color:#A32D2D;font-size:12.5px">'+laT('วันนี้ไม่มีโปรแกรมอื่นที่มีเรือวิ่ง')+'</div>';
  /* ตัวเลขช่วยตัดสินใจ · โปรแกรมเดิมเหลือกี่คน ใช้เรืออย่างน้อยกี่ลำ */
  var alF=(typeof getAllotment==='function')?getAllotment(U.from, U.date, null):null;
  var bkF=(alF&&alF.hasAllotment)?(+alF.seatsConsumed||0):null;
  var leftF=(bkF==null)?null:Math.max(0,bkF-pax);
  var needNow=(bkF==null)?null:bkUpgVanBoatsNeed(U.date,U.from,bkF), needAfter=(leftF==null)?null:bkUpgVanBoatsNeed(U.date,U.from,leftF);
  var nBoats=((typeof baBoatsForRoute==='function')?baBoatsForRoute(U.date,U.from):[]).length;
  var fx=function(n){ return n==null?'-':(n<0?laT('เรือไม่พอ'):(n+' '+laT('ลำ'))); };
  var math=(bkF==null)?'':('<div data-upgvan-math="1" style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:140px;border:1px solid #E4E1D9;border-radius:10px;padding:8px 11px;background:#FAFAF8"><div style="font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8a8a82">'+e(bkUpgRouteName(U.from))+' &middot; '+laT('ตอนนี้')+'</div><div style="font-size:13px;font-weight:800;margin-top:2px">'+bkF+' '+laT('คน')+' <span style="font-weight:600;color:#8a8a82">&middot; '+laT('วางเรือ')+' '+nBoats+' '+laT('ลำ')+' &middot; '+laT('ใช้อย่างน้อย')+' '+fx(needNow)+'</span></div></div>'
      +'<div style="flex:1;min-width:140px;border:1px solid #CDB4E6;border-radius:10px;padding:8px 11px;background:#F7F1FC"><div style="font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#6B289A">'+laT('หลังย้ายคันนี้')+'</div><div style="font-size:13px;font-weight:800;margin-top:2px;color:#3E1563">'+leftF+' '+laT('คน')+' <span style="font-weight:600;color:#6B289A">&middot; '+laT('ใช้อย่างน้อย')+' <b data-upgvan-need="'+(needAfter==null?'':needAfter)+'">'+fx(needAfter)+'</b></span></div></div>'
      +'</div>');
  var dTo=U.to?bkUpgVanDepart(U.to):'';
  var timeWarn=(U.to && dFrom && dTo && dFrom!==dTo)?('<div data-upgvan-timewarn="1" style="display:flex;gap:9px;align-items:flex-start;background:#FFF6E5;border:1px solid #F0D9A8;border-radius:10px;padding:9px 12px;font-size:12px;color:#6B4500;line-height:1.45"><span aria-hidden="true" style="font-size:15px">&#9888;</span><span><b>'+laT('เวลาออกเรือไม่เท่ากัน')+'</b> &middot; '+e(bkUpgRouteName(U.from))+' '+e(dFrom)+' &rarr; '+e(bkUpgRouteName(U.to))+' '+e(dTo)+'<br>'+laT('ตั้งเวลารับใหม่ให้ทั้งคันด้านล่าง แล้วแจ้งลูกค้า/คนขับ')+'</span></div>'):'';
  var badHtml=badM.length?('<div data-upgvan-blocked="'+badM.length+'" style="background:#FCEBEB;border:1px solid #E6C9C3;border-radius:10px;padding:9px 12px;font-size:12px;color:#A32D2D;line-height:1.5"><b>'+laT('ย้ายทั้งคันไม่ได้')+' &middot; '+badM.length+' '+laT('ใบติดเงื่อนไข')+'</b><br>'
      +badM.map(function(x){ return e((x.b.leadPax||x.b.customerName||x.b.voucherRef||x.b.id))+' &middot; '+e(x.why); }).join('<br>')+'<br><span style="font-weight:600;color:#7a3a3a">'+laT('แก้ใบพวกนี้ก่อน (หรือเอาออกจากกรุ๊ป) แล้วค่อยย้าย')+'</span></div>'):'';
  ov.innerHTML='<div style="background:#fff;border-radius:16px;width:min(540px,96vw);max-height:92vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:\'DM Sans\',sans-serif">'
    +'<div style="padding:16px 20px;border-bottom:1px solid #EFECE4"><div style="font-size:15px;font-weight:800;color:#4A1D6E">&#10548; '+laT('Upgrade ทั้งคัน')+' &middot; '+laT('กรุ๊ป')+' '+U.gid+'</div>'
    +'<div style="font-size:11.5px;color:#8a8a82;margin-top:3px">&#128656; <b>'+e(vnm)+'</b> &middot; '+okM.length+' '+laT('ใบ')+' &middot; <b>'+pax+' pax</b> &middot; '+e(U.date)+' &middot; '+laT('จาก')+' <b>'+e(bkUpgRouteName(U.from))+'</b>'+(dFrom?(' '+e(dFrom)):'')+' &middot; &#9875; '+e(pnm(fromPier))+'</div></div>'
    +'<div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">'
    +badHtml
    +'<div><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+laT('ไปโปรแกรม')+'</div><div style="display:flex;flex-direction:column;gap:6px">'+opts+'</div></div>'
    +math
    +timeWarn
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
    +'<div style="flex:1;min-width:150px"><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+laT('เวลารับทั้งคัน')+'</div>'
    +'<input id="bkupgvan-pick" type="text" value="'+e(U.pick)+'" oninput="_bkUpgVan.pick=this.value" placeholder="'+laT('เหมือนเดิม')+'" style="width:100%;border:1px solid '+((U.pick||'')!==(U.pick0||'')?'#6B289A':'#E4E1D9')+';border-radius:9px;padding:9px 11px;font-size:14px;font-weight:700;font-family:\'DM Mono\',monospace;box-sizing:border-box">'
    +'<div style="font-size:10.5px;color:#8a8a82;margin-top:4px">'+laT('ตอนนี้')+' '+(U.pick0?e(U.pick0):'-')+' &middot; '+laT('เปลี่ยนแล้วใช้กับทุกใบในคัน')+'</div></div>'
    +'<div style="width:150px"><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+laT('เก็บเพิ่ม/ใบ (บาท)')+'</div>'
    +'<input id="bkupgvan-charge" type="number" min="0" value="'+e(U.charge)+'" oninput="_bkUpgVan.charge=this.value" placeholder="0" style="width:100%;border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:15px;font-weight:700;font-family:\'DM Mono\',monospace;box-sizing:border-box">'
    +'<div style="font-size:10.5px;color:#8a8a82;margin-top:4px">'+laT('บริษัทย้ายเอง = 0')+'</div></div>'
    +'</div>'
    +'<div><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+laT('เหตุผล')+'</div>'
    +'<input id="bkupgvan-reason" type="text" value="'+e(U.reason)+'" oninput="_bkUpgVan.reason=this.value" placeholder="'+laT('เช่น ลดเรือ Speed เหลือ 3 ลำ')+'" style="width:100%;border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:13px;box-sizing:border-box;font-family:inherit"></div>'
    +'<div style="font-size:11px;color:#8a8a82;line-height:1.5">'+laT('ราคาใบจองไม่เปลี่ยน ยึดราคาที่จองไว้ · รถคันเดิม ลำดับรับเดิม ไปเปิดเป็นกรุ๊ปใหม่ใต้โปรแกรมปลายทาง · เรือที่จัดไว้ถูกล้าง ต้องจัดเรือใหม่ในโปรแกรมปลายทาง · ย้อนกลับได้ทั้งคันที่หัวกรุ๊ปฝั่งปลายทาง')+'</div>'
    +'</div>'
    +'<div style="padding:12px 20px 18px;display:flex;gap:9px;justify-content:flex-end">'
    +'<button type="button" onclick="bookingV2UpgVanClose()" style="border:1px solid #E4E1D9;background:#fff;color:#5F5E5A;border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">'+laT('ยกเลิก')+'</button>'
    +'<button type="button" data-upgvan-go="1" onclick="bookingV2UpgVanApply()" '+(badM.length?'disabled':'')+' style="border:none;background:'+(badM.length?'#C9BFD9':'#6B289A')+';color:#fff;border-radius:9px;padding:9px 20px;font-size:12.5px;font-weight:700;cursor:'+(badM.length?'not-allowed':'pointer')+';font-family:inherit">'+laT('Upgrade ทั้งคัน')+'</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  if(sc && ov.firstElementChild) ov.firstElementChild.scrollTop=sc;
}
