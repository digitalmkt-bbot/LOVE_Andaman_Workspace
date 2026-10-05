function bookingV2UpgModal(){
  var U=_bkUpg; if(!U) return;
  var e=function(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var b=SB_BOOKINGS.find(function(x){ return x.id===U.bkId; }), t=bkUpgTripOn(b, U.date, U.from);
  var pax=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot((t&&t.pax)||{}):0;
  var T=bookingV2UpgTargets(U.date, U.from, U.bkId);
  var old=document.getElementById('bkv2-upg-ov'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='bkv2-upg-ov'; ov.className='la-modal';
  ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(20,24,22,.42);display:flex;align-items:center;justify-content:center;padding:20px';
  /* §upgPier · ผู้ใช้ขอ "ควรจะแยกท่าเรือให้หน่อย กลัวสับสน" · จัดกลุ่มตามท่า ท่าเดียวกับโปรแกรมเดิมขึ้นก่อน
     ต่างท่า = ลูกค้าต้องไปขึ้นเรืออีกท่าหนึ่ง (รถรับ/เวลารับเปลี่ยน) จึงติดป้ายเตือนที่หัวกลุ่ม */
  var fromPier=bkUpgPierOf(U.from), pnm=function(p){ return (typeof laPierName==='function')?laPierName(p):p; };
  var piers=[]; T.forEach(function(x){ if(piers.indexOf(x.pier)<0) piers.push(x.pier); });
  piers.sort(function(a,c){ return (a===fromPier?0:1)-(c===fromPier?0:1); });
  var one=function(x){ var full=(x.free!=null && x.free<pax);
      return '<label data-upg-to="'+e(x.rid)+'" style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid '+(U.to===x.rid?'#6B289A':'#E4E1D9')+';background:'+(U.to===x.rid?'#F7F1FC':(full?'#FAFAF8':'#fff'))+';border-radius:10px;cursor:'+(full?'not-allowed':'pointer')+';opacity:'+(full?'.6':'1')+'">'
        +'<input type="radio" name="bkupg-to" value="'+e(x.rid)+'" '+(U.to===x.rid?'checked':'')+(full?' disabled':'')+' onchange="_bkUpg.to=this.value;bookingV2UpgModal()" style="accent-color:#6B289A">'
        +'<span style="flex:1;font-weight:700;font-size:13px">'+e(x.name)+'</span>'
        +'<span style="font-size:11px;font-family:\'DM Mono\',monospace;color:'+(full?'#A32D2D':'#0F6E56')+'">'+(x.free==null?'-':(x.free+' free'))+'</span></label>'; };
  var opts=T.length?piers.map(function(p){ var same=(p===fromPier);
      return '<div data-upg-pier="'+e(p)+'" style="display:flex;flex-direction:column;gap:6px">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-top:4px"><span style="font-size:11.5px;font-weight:800;color:'+(same?'#0F6E56':'#8A5B00')+'">&#9875; '+e(pnm(p))+'</span>'
        +'<span data-upg-piertag="'+(same?'same':'other')+'" style="font-size:9.5px;font-weight:800;border-radius:6px;padding:1px 7px;background:'+(same?'#DCF4E8':'#FBF0DD')+';color:'+(same?'#0C6B47':'#7A4A00')+'">'+(same?laT('ท่าเดียวกับโปรแกรมเดิม'):laT('ต่างท่า · ต้องเปลี่ยนจุดขึ้นเรือ'))+'</span></div>'
        +T.filter(function(x){ return x.pier===p; }).map(one).join('')+'</div>'; }).join('')
    : '<div style="padding:14px;text-align:center;color:#A32D2D;font-size:12.5px">'+laT('วันนี้ไม่มีโปรแกรมอื่นที่มีเรือวิ่ง')+'</div>';
  ov.innerHTML='<div style="background:#fff;border-radius:16px;width:min(480px,96vw);max-height:92vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:\'DM Sans\',sans-serif">'
    +'<div style="padding:16px 20px;border-bottom:1px solid #EFECE4"><div style="font-size:15px;font-weight:800;color:#4A1D6E">&#10548; Upgrade &middot; '+laT('ย้ายไปเส้นทางอื่น')+'</div>'
    +'<div style="font-size:11.5px;color:#8a8a82;margin-top:3px">'+e((b&&(b.leadPax||b.customerName))||U.bkId)+' &middot; '+pax+' pax &middot; '+e(U.date)+' &middot; '+laT('จาก')+' <b>'+e(bkUpgRouteName(U.from))+'</b> &middot; &#9875; '+e((typeof laPierName==='function')?laPierName(bkUpgPierOf(U.from)):bkUpgPierOf(U.from))+'</div></div>'
    +'<div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">'
    +'<div><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+laT('ไปโปรแกรม')+'</div><div style="display:flex;flex-direction:column;gap:6px">'+opts+'</div></div>'
    +'<div><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+laT('เหตุผล')+'</div>'
    +'<input id="bkupg-reason" type="text" value="'+e(U.reason)+'" oninput="_bkUpg.reason=this.value" placeholder="'+laT('เช่น ทริปเดิมไม่ออก · ลูกค้าขอเปลี่ยน')+'" style="width:100%;border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:13px;box-sizing:border-box;font-family:inherit"></div>'
    +'<div><div style="font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+laT('เก็บเพิ่ม (บาท) · 0 = ไม่เก็บ')+'</div>'
    +'<input id="bkupg-charge" type="number" min="0" value="'+e(U.charge)+'" oninput="_bkUpg.charge=this.value" placeholder="0" style="width:140px;border:1px solid #E4E1D9;border-radius:9px;padding:9px 11px;font-size:15px;font-weight:700;font-family:\'DM Mono\',monospace;box-sizing:border-box"></div>'
    +'<div style="font-size:11px;color:#8a8a82;line-height:1.5">'+laT('ราคาใบจองไม่เปลี่ยน ยึดราคาที่จองไว้ · ยอดเก็บเพิ่มจะขึ้นเป็นรายการอัปเกรดที่ต้องเก็บหน้าท่า · เรือที่จัดไว้เดิมจะถูกล้าง ต้องจัดเรือใหม่ในโปรแกรมปลายทาง')+'</div>'
    +'</div>'
    +'<div style="padding:12px 20px 18px;display:flex;gap:9px;justify-content:flex-end">'
    +'<button onclick="bookingV2UpgModalClose()" style="border:1px solid #E4E1D9;background:#fff;color:#5F5E5A;border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">'+laT('ยกเลิก')+'</button>'
    +'<button data-upg-go="1" onclick="bookingV2UpgApply()" style="border:none;background:#6B289A;color:#fff;border-radius:9px;padding:9px 20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">Upgrade</button>'
    +'</div></div>';
  document.body.appendChild(ov);
}
