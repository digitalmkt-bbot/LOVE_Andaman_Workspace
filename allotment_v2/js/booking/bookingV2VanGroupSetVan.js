function bookingV2VanGroupSetVan(date, routeId, zone, gid, vanId){
  if(vanId){
    const v=(typeof vehGet==='function')?vehGet(vanId):null; const cap=(v&&v.capacity)||0;
    const pax=bookingV2VanGroupPax(date,routeId,zone,gid);
    if(cap && pax>cap){ alert('ที่นั่งไม่พอ · กรุ๊ปนี้มี '+pax+' คน แต่รถ '+((v&&v.name)||vanId)+' มี '+cap+' ที่นั่ง\n\nแยกคน (✂ แยกคน) หรือเลือกรถที่ใหญ่กว่า'); if(typeof bookingV2Render==='function') bookingV2Render(); return; }
    /* ══ §vgRound · รถคันเดิมลงกรุ๊ปที่สองของโปรแกรมเดียวกัน = ให้วิ่งอีกรอบ ══
       ของเดิมห้ามด้วยกฎ "1 รถ = 1 กรุ๊ป" ปิดช่องเลือกทิ้งไปเลย
       แต่มันไปปิดเคสจริงด้วย: รอบแรกรับป่าตอง 07:30 · ส่งถึงท่า ~08:15
       แล้ววิ่งอีกรอบรับพันวา 08:20 ได้สบาย เพราะพันวาอยู่ติดท่าเรือ
       เปลี่ยนจาก "ห้าม" เป็น "ถามให้แน่ใจ" · เผลอกดผิดคันยังกันได้เหมือนเดิม
       แต่คนที่ตั้งใจจริงไม่ถูกขวาง · ที่นั่งเช็คแยกรายกรุ๊ปอยู่แล้ว (บรรทัดบน) */
    var _oth=(typeof _bkV2VanOtherGroups==='function')?_bkV2VanOtherGroups(date,routeId,vanId,gid):[];
    if(_oth.length){
      var _vn=((v&&v.name)||vanId);
      var _lb=_oth.map(function(o){ return 'กรุ๊ป '+o.g+(o.tm?(' · '+o.tm):' · ยังไม่ตั้งเวลา'); }).join('\n  ');
      if(!confirm(_vn+' อยู่กรุ๊ปอื่นของโปรแกรมนี้แล้ว\n  '+_lb
        +'\n\nเลือกต่อ = ให้วิ่งอีกรอบ รวมเป็น '+(_oth.length+1)+' รอบวันนี้'
        +'\nแต่ละรอบแยกใบงานคนละใบ · อย่าลืมตั้งเวลารับให้ต่างกัน'
        +'\n\nยืนยันหรือไม่?')){
        if(typeof bookingV2Render==='function') bookingV2Render(); return;
      }
    }
  }
  _bkV2GrpApply(date,routeId,zone,gid,(b,s,o)=>{ if(s) s.vanId=vanId||null; else o.vanId=vanId||null; }); acctPersistBookings(); if(typeof bookingV2Render==='function') bookingV2Render();
}
