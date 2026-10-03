function bookingV2PaidLine(bk){
  const x=bookingV2PaidSplit(bk); if(!x) return '';
  const f=n=>'&#3647;'+bookingV2FmtTHB(Math.round(n));
  const tip=x.multi?` title="ใบรวม ${x.invNo} · ${x.multi} booking · ยอดจ่าย/ค้างเป็นของทั้งใบ"`:'';
  const bal = x.bal>0 ? `<span style="color:#A32D2D">ค้าง ${f(x.bal)}</span>` : `<span style="color:#0F6E56">ครบ</span>`;
  /* §btClip · ตัวเลขเงินห้ามถูกตัดกลางคัน · "ค้าง ฿3,200" ที่โดนตัดเหลือ "ค้าง ฿3"
     อ่านได้เป็นจำนวนอื่นโดยไม่มีอะไรบอกว่าถูกตัด (ไม่มีจุดไข่ปลา เพราะ nowrap + overflow:hidden)
     ยอมให้ตกบรรทัดแทนการตัด · กว้างไม่พอเมื่อไหร่ก็ขึ้นบรรทัดใหม่ เลขยังครบเสมอ
     และคำว่า "จ่าย"/"ค้าง" ผูกกับตัวเลขของมันด้วย nowrap รายก้อน จะได้ไม่แยกคนละบรรทัด */
  const _plain = (x.multi?'ใบรวม '+x.invNo+' · ':'')+'จ่าย '+bookingV2FmtTHB(Math.round(x.paid))
    +' · '+(x.bal>0?('ค้าง '+bookingV2FmtTHB(Math.round(x.bal))):'ครบ');
  return `<div${tip||` title="${_plain}"`} style="font-size:10.5px;line-height:1.35;margin-top:2px;white-space:normal"><span style="white-space:nowrap;color:${x.paid>0?'#0F6E56':'#9a988f'}">จ่าย ${f(x.paid)}</span> · <span style="white-space:nowrap">${bal}</span>${x.multi?' <span style="color:#9a988f;white-space:nowrap">(ใบรวม)</span>':''}${x.order?' <span style="color:#9a988f;white-space:nowrap">(ทั้งออเดอร์ '+x.order+' รายการ)</span>':''}</div>`;
}
