function bookingV2EditDiffRows(L, d){
  var e=bookingV2EditDiffEsc, NAVY='#16265C', BD='#E6E7EB', MONO="font-family:'DM Mono',monospace;";
  var em='<span style="color:#A9ADB8;font-style:italic;font-weight:400">ว่าง</span>';
  return (L||[]).filter(function(c){ return c.tone!=='money'; }).map(function(c){
    if(c.tone==='warn'){
      var toSelf=!!(d&&d.pickupSelf), hotel=String((d&&d.hotelName)||'').trim();
      return '<div style="padding:11px 0;border-top:1px solid '+BD+'">'+bookingV2EditDiffLab(c.lab)
        +'<div style="display:flex;align-items:center;gap:9px;margin-top:6px"><span style="font-size:12.5px;color:#9A9FAB;text-decoration:line-through">'+e(c.from)+'</span><span style="color:'+NAVY+';font-weight:700">&rarr;</span></div>'
        +'<div style="margin-top:7px;background:#EAF1FB;border:1.5px solid #2D5BA8;border-radius:10px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start">'
          +'<span style="width:17px;height:17px;border-radius:4px;background:'+(toSelf?NAVY:'#fff')+';border:1.5px solid '+NAVY+';box-sizing:border-box;color:#fff;font-size:12px;line-height:14px;text-align:center;flex:none;margin-top:1px">'+(toSelf?'&check;':'')+'</span>'
          +'<div><div style="font-size:13.5px;font-weight:700;color:#1E4A8C">'+(toSelf?'&#128694; ขารับ: ลูกค้ามาเองที่ท่าเรือ (self-arrive)':'&#128656; ขารับ: รถไปรับที่จุดรับ (เอาติ๊กมาเองออก)')+'</div>'
          +'<div style="font-size:11.5px;color:#5B6170;margin-top:2px">'+(toSelf?'No van on the way out · the full rate still applies':'Van picks up at the hotel / pickup location')+'</div></div></div>'
        +(toSelf
          ? '<div style="margin-top:7px;background:#FBE3E0;border-radius:10px;padding:8px 12px;font-size:12px;color:#8E2019;line-height:1.45">&#9888; ขาไป<b>ไม่ขึ้นในใบงานรถ</b>'+(hotel?(' · ขากลับรถยังส่งที่ <b>'+e(hotel)+'</b>'):'')+'</div>'
          : '<div style="margin-top:7px;background:#E6F5EE;border-radius:10px;padding:8px 12px;font-size:12px;color:#0B5A43;line-height:1.45">รถจะไปรับ'+(hotel?('ที่ <b>'+e(hotel)+'</b>'):'ที่จุดรับ')+' และ<b>ขึ้นในใบงานรถขาไป</b></div>')
        +'</div>';
    }
    var m=(c.tone==='mono')?MONO:'';
    return '<div style="padding:11px 0;border-top:1px solid '+BD+'">'
      +'<div style="display:flex;align-items:center">'+bookingV2EditDiffLab(c.lab)+(c.chip?('<span style="margin-left:auto;background:#EEF1F8;color:'+NAVY+';font-size:10.5px;font-weight:700;border-radius:4px;padding:1px 7px;'+MONO+'">'+e(c.chip)+'</span>'):'')+'</div>'
      +'<div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin-top:4px">'
        +'<span style="'+m+'font-size:12.5px;color:#9A9FAB;text-decoration:line-through;overflow-wrap:anywhere">'+(c.from?e(c.from):em)+'</span>'
        +'<span style="color:'+NAVY+';font-weight:700;flex:none">&rarr;</span>'
        +'<span style="'+m+'font-size:14px;font-weight:700;color:#0F1B3D;overflow-wrap:anywhere">'+(c.to?e(c.to):em)+'</span>'
      +'</div></div>';
  }).join('');
}
