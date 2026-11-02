function bookingV2UpgKindHtml(U, pax, e){
  var k=U.kind||'fill';
  var lab='font-size:10px;font-weight:700;color:#8a8a82;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  var card=function(v,t,d,c){ var on=(k===v);
    return '<label data-upg-kind="'+v+'" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;border:'+(on?('2px solid '+c[0]):'1px solid #E4E1D9')+';background:'+(on?c[1]:'#fff')+';border-radius:10px;padding:'+(on?'8px 10px':'9px 11px')+';cursor:pointer">'
      +'<span style="display:flex;align-items:center;gap:7px"><input type="radio" name="bkupg-kind" '+(on?'checked':'')+' onchange="_bkUpg.kind=\''+v+'\';bookingV2UpgModal()" style="accent-color:'+c[0]+'"><b style="font-size:13px;color:'+c[2]+'">'+t+'</b></span>'
      +'<span style="font-size:11px;color:#6B6B65;line-height:1.45">'+d+'</span></label>'; };
  var h='<div><div style="'+lab+'">'+laT('ประเภท Upgrade')+'</div><div style="display:flex;gap:8px">'
    +card('fill', laT('เติมที่นั่ง'), laT('ย้ายเพื่อให้เรือเต็ม · ย้ายเรือ / ย้ายกลับได้ตามปกติ'), ['#6B289A','#F7F1FC','#4A1D6E'])
    +card('promise', '<span style="color:#EAB308">&#9733;</span> '+laT('สัญญากับลูกค้า'), laT('บอกลูกค้าแล้วว่าได้ลำนี้แน่นอน · ระบบไม่ย้ายลำให้อัตโนมัติ'), ['#0F766E','#F0FDFA','#115E59'])
    +'</div></div>';
  if(k!=='promise') return h;
  if(!U.to) return h+'<div style="font-size:12px;color:#8a8a82">'+laT('เลือกโปรแกรมปลายทางก่อน แล้วเลือกเรือที่สัญญา')+'</div>';
  var B=(typeof baBoatsForRoute==='function')?baBoatsForRoute(U.date, U.to):[];
  h+='<div><div style="'+lab+'">'+laT('เรือที่สัญญาไว้')+' <span style="color:#B42318">*</span></div>';
  if(!B.length) return h+'<div style="font-size:12px;color:#A32D2D">'+laT('โปรแกรมนี้ยังไม่มีเรือวิ่งวันนั้น · จัดเรือที่ Boat Operation ก่อน')+'</div></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px">'+B.map(function(x){
    var cap=(typeof boatCapFor==='function')?boatCapFor(x.boatId,U.date):(+x.boat.cap||0);
    var free=cap-((typeof baAssignedPax==='function')?baAssignedPax(U.date,x.boatId):0), full=(cap>0 && free<pax), on=(U.boat===x.boatId);
    return '<label data-upg-boat="'+e(x.boatId)+'" style="display:flex;flex-direction:column;gap:1px;border:'+(on?'2px solid #0F766E':'1px solid #E4E1D9')+';background:'+(on?'#F0FDFA':(full?'#FAFAF8':'#fff'))+';border-radius:9px;padding:'+(on?'6px 9px':'7px 10px')+';cursor:'+(full?'not-allowed':'pointer')+';opacity:'+(full?'.55':'1')+'">'
      +'<span style="display:flex;align-items:center;gap:6px"><input type="radio" name="bkupg-boat" '+(on?'checked':'')+(full?' disabled':'')+' onchange="_bkUpg.boat=\''+e(x.boatId)+'\';bookingV2UpgModal()" style="accent-color:#0F766E"><b style="font-size:12.5px">'+e(x.boat.name||x.boatId)+'</b></span>'
      +'<span style="font-size:11px;color:'+(full?'#A32D2D':'#5F5E5A')+'">'+(cap?(laT('ว่าง')+' '+Math.max(0,free)+' / '+cap):'-')+'</span></label>'; }).join('')+'</div></div>';
  return h;
}
