/* §upgConfirm2 · หน้าสรุปก่อนยืนยัน · วาดทับเนื้อในของหน้าต่าง Upgrade เดิม (กลับไปแก้ได้ ค่าที่กรอกยังอยู่) */
function bookingV2UpgConfirmView(c){
  var ov=document.getElementById('bkv2-upg-ov'); if(!ov) return;
  var e=function(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); };
  var diff=(c.pf!==c.pt);
  var card=function(lbl, nm, pier, on){
    return '<div style="flex:1;min-width:0;border:1px solid '+(on?'#CDB4E6':'#E4E1D9')+';background:'+(on?'#F7F1FC':'#FAFAF8')+';border-radius:12px;padding:10px 12px">'
      +'<div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:'+(on?'#6B289A':'#8a8a82')+'">'+e(lbl)+'</div>'
      +'<div style="font-size:14px;font-weight:800;line-height:1.3;margin-top:3px;color:'+(on?'#3E1563':'#5F5E5A')+'">'+e(nm)+'</div>'
      +'<div style="margin-top:6px"><span style="font-size:10.5px;font-weight:800;border-radius:6px;padding:2px 8px;background:'+(on&&diff?'#FBF0DD':'#EEF2F1')+';color:'+(on&&diff?'#7A4A00':'#3F5B52')+'">&#9875; '+e(pier)+'</span></div></div>';
  };
  var row=function(k,v){ return '<div style="display:flex;gap:12px;padding:7px 0;border-top:1px solid #F1EFE9;font-size:13px">'
    +'<span style="width:96px;flex-shrink:0;color:#8a8a82">'+e(k)+'</span><span style="flex:1;min-width:0;font-weight:700;color:#2C2C2A">'+v+'</span></div>'; };
  var who=(c.b&&(c.b.leadPax||c.b.customerName||c.b.voucherRef||c.b.id))||'';
  ov.innerHTML='<div data-upg-confirm="1" role="dialog" aria-modal="true" style="background:#fff;border-radius:16px;width:min(480px,96vw);max-height:92vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:\'DM Sans\',sans-serif">'
    +'<div style="padding:16px 20px;border-bottom:1px solid #EFECE4"><div style="font-size:15px;font-weight:800;color:#4A1D6E">&#10548; '+e(laT('ยืนยันการ Upgrade'))+'</div>'
    +'<div style="font-size:11.5px;color:#8a8a82;margin-top:3px">'+e(laT('ตรวจอีกครั้งก่อนย้าย'))+'</div></div>'
    +'<div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">'
    +'<div style="display:flex;align-items:stretch;gap:8px">'
      +card(laT('จากโปรแกรม'), c.fromNm, c.pf, false)
      +'<div aria-hidden="true" style="align-self:center;font-size:18px;color:#6B289A;font-weight:800">&rarr;</div>'
      +card(laT('ไปโปรแกรม'), c.toNm, c.pt, true)
    +'</div>'
    +(diff?('<div data-upg-diffpier="1" style="display:flex;gap:9px;align-items:flex-start;background:#FFF6E5;border:1px solid #F0D9A8;border-radius:10px;padding:9px 12px;font-size:12.5px;color:#6B4500;line-height:1.45">'
      +'<span aria-hidden="true" style="font-size:15px">&#9888;</span><span><b>'+e(laT('ต่างท่า · ต้องเปลี่ยนจุดขึ้นเรือ'))+'</b><br>'+e(laT('รถรับและเวลารับอาจต้องแก้ใหม่'))+'</span></div>'):'')
    +'<div>'
      +row(laT('ลูกค้า'), e(who)+' <span style="font-weight:600;color:#8a8a82">&middot; '+c.pax+' pax</span>')
      +row(laT('วันที่เดินทาง'), e(c.date))
      +row(laT('เก็บเพิ่ม'), c.charge>0?('<span style="color:#7A4A00">&#3647;'+e(c.charge.toLocaleString())+'</span>'):('<span style="font-weight:600;color:#8a8a82">'+e(laT('ไม่เก็บ'))+'</span>'))
      +row(laT('เหตุผล'), e(c.reason))
    +'</div>'
    +'<div style="font-size:11.5px;color:#8a8a82;line-height:1.5">'+e(laT('กดยืนยันแล้ว ที่นั่งย้ายไปโปรแกรมใหม่ทันที · เรือเดิมถูกล้าง ต้องจัดเรือใหม่ในโปรแกรมปลายทาง'))+'</div>'
    +'</div>'
    +'<div style="padding:12px 20px 18px;display:flex;gap:9px;justify-content:flex-end">'
    +'<button type="button" data-upg-back="1" onclick="bookingV2UpgModal()" style="border:1px solid #E4E1D9;background:#fff;color:#5F5E5A;border-radius:9px;padding:10px 16px;min-height:40px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">&larr; '+e(laT('กลับไปแก้'))+'</button>'
    +'<button type="button" data-upg-do="1" onclick="bookingV2UpgApply(true)" style="border:none;background:#6B289A;color:#fff;border-radius:9px;padding:10px 20px;min-height:40px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit">'+e(laT('ยืนยัน Upgrade'))+'</button>'
    +'</div></div>';
  try{ var bt=ov.querySelector('[data-upg-do]'); if(bt) bt.focus(); }catch(_){}
}
