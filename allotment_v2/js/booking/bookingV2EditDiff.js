// Right-column live Review · summarizes what's been filled
/* ══ §nbDiff · ป้าย "มีการแก้ไข" ในแผง Booking Review ═══════════════════════
   ผู้ใช้ขอ 19 พ.ย. · ตอนแก้บุคกิ้ง ให้เห็นก่อนกด Update ว่าแก้อะไร จากอะไรเป็นอะไร
   (ที่มา: เคสติ๊ก "มาเอง" โดยไม่ตั้งใจ แล้วไม่มีใครเห็นจนใบงานรถออก)
   เทียบร่างในฟอร์มกับภาพที่ถ่ายไว้ตอนกด Edit · ไม่เทียบกับ SB_BOOKINGS สด
   เพราะถ้าคนอื่นแก้ใบเดียวกันระหว่างนั้น จะขึ้นเป็นว่าเราแก้ทั้งที่ไม่ได้แตะ
   เทียบเฉพาะช่องที่คนกรอกเอง · ไม่เทียบช่องที่ฟอร์มเติมค่าให้อัตโนมัติ */
function bookingV2EditDiff(o, d){
  var out=[]; if(!o||!d) return out;
  var S=function(x){ return String(x==null?'':x).trim(); };
  var add=function(lab,a,b,tone){ if(S(a)!==S(b)) out.push({lab:lab, from:S(a), to:S(b), tone:tone||''}); };
  var agN=function(id){ try{ var a=id&&typeof sbGetAgent==='function'?sbGetAgent(id):null; return a?(a.name||id):S(id); }catch(_){ return S(id); } };
  var rtN=function(id){ try{ var r=id&&typeof SB_RATE_TYPES!=='undefined'?(SB_RATE_TYPES||[]).find(function(x){ return x.id===id; }):null; return r?(r.name||id):S(id); }catch(_){ return S(id); } };
  var arN=function(id){ try{ var a=id&&typeof bookingV2GetArea==='function'?bookingV2GetArea(id):null; return a?(a.name||id):S(id); }catch(_){ return S(id); } };
  var roN=function(id){ try{ var r=id&&typeof ROUTES!=='undefined'?ROUTES.find(function(x){ return x.id===id; }):null; return r?(r.name||id):S(id); }catch(_){ return S(id); } };
  var dmy=function(x){ return x?((typeof bkNbfDMY==='function')?bkNbfDMY(x):x):''; };
  var px=function(p){ var L={ad:'AD',chd:'CHD',inf:'INF',foc:'FOC'}, r=[]; ['ad','chd','inf','foc'].forEach(function(k){ var n=0; try{ n=(typeof bookingV2PaxTot==='function')?(+bookingV2PaxTot(p||{},k)||0):0; }catch(_){ } if(n) r.push(n+' '+L[k]); }); return r.join(' · ')||'0'; };
  var pxN=function(p){ var n=0; ['ad','chd','inf','foc'].forEach(function(k){ try{ n+=(typeof bookingV2PaxTot==='function')?(+bookingV2PaxTot(p||{},k)||0):0; }catch(_){ } }); return n; };
  if(S(o.agentId)!==S(d.agentId)) add('Agent', agN(o.agentId), agN(d.agentId));
  add('Voucher', o.voucherRef, d.voucherRef, 'mono');
  if(S(o.rateTypeRef)!==S(d.rateTypeRef)) add('Rate type', rtN(o.rateTypeRef), rtN(d.rateTypeRef));
  add('ชื่อลูกค้า', o.leadPax, d.leadPax);
  add('เบอร์โทร', o.leadPhone, d.leadPhone, 'mono');
  add('อีเมล', o.leadEmail, d.leadEmail);
  add('สัญชาติ', o.leadNationality, d.leadNationality);
  /* ทริป */
  var ot=(o.trips||[]), dt=(d.trips||[]).filter(function(t){ return t&&t.routeId; });
  if(ot.length!==dt.length) add('จำนวนทริป', ot.length+' ทริป', dt.length+' ทริป');
  for(var i=0;i<Math.min(ot.length,dt.length);i++){
    var a=ot[i]||{}, b=dt[i]||{}, pre=(Math.max(ot.length,dt.length)>1)?('ทริป '+(i+1)+' · '):'';
    if(S(a.routeId)!==S(b.routeId)) add(pre+'โปรแกรม', roN(a.routeId), roN(b.routeId));
    if(S(a.date)!==S(b.date)) add(pre+'วันเดินทาง', dmy(a.date), dmy(b.date), 'mono');
    if(px(a.pax)!==px(b.pax)){ var _dn=pxN(b.pax)-pxN(a.pax); out.push({lab:pre+'จำนวนคน', from:px(a.pax), to:px(b.pax), tone:'mono', chip:_dn?((_dn>0?'+':'')+_dn+' pax'):''}); }
    if(S(a.bookingMode||'seat')!==S(b.bookingMode||'seat')) add(pre+'รูปแบบ', a.bookingMode==='charter'?'เหมาลำ':'ที่นั่ง', b.bookingMode==='charter'?'เหมาลำ':'ที่นั่ง');
    if(b.pickupTimeEdited && S(a.pickupTime)!==S(b.pickupTime)) add(pre+'เวลารับ', a.pickupTime, b.pickupTime, 'mono');
  }
  /* รับ-ส่ง */
  if(!!o.pickupSelf!==!!d.pickupSelf) out.push({lab:'ขารับ', from:o.pickupSelf?'ลูกค้ามาเองที่ท่าเรือ':'รถไปรับที่จุดรับ', to:d.pickupSelf?'ลูกค้ามาเองที่ท่าเรือ':'รถไปรับที่จุดรับ', tone:'warn', note:d.pickupSelf?'ขาไปจะไม่มีรถไปรับ และไม่ขึ้นในใบงานรถขาไป':'รถจะไปรับที่จุดรับ และขึ้นในใบงานรถขาไป'});
  if(S(o.pickupAreaId)!==S(d.pickupAreaId)) add('พื้นที่รับ', arN(o.pickupAreaId), arN(d.pickupAreaId));
  add('โรงแรม / จุดรับ', o.hotelName, d.hotelName);
  add('ห้อง', o.roomNumber, d.roomNumber, 'mono');
  var dr=function(x){ return (x.dropoffSame!==false && !x.dropoffAreaId && !S(x.dropoffHotelName)) || x.dropoffSame===true ? 'เหมือนจุดรับ' : (S(x.dropoffHotelName)||arN(x.dropoffAreaId)||'—'); };
  add('จุดส่งกลับ', dr(o), dr(d));
  add('กระเป๋าใหญ่', o.largeLuggage||'', d.largeLuggage||'');
  add('หมายเหตุ', o.notes, d.notes);
  var J=function(x){ try{ return JSON.stringify(x||[]); }catch(_){ return ''; } };
  var nAlt=function(x){ return (Array.isArray(x)?x:[]).filter(function(a){ return a&&(S(a.who)||S(a.place)||a.areaId); }).length; };
  if(J((o.altPickups||[]))!==J((d.altPickups||[])) && (nAlt(o.altPickups)||nAlt(d.altPickups))) out.push({lab:'รับหลายจุด', from:nAlt(o.altPickups)+' จุด', to:nAlt(d.altPickups)+' จุด'+(nAlt(o.altPickups)===nAlt(d.altPickups)?' (แก้รายละเอียด)':'')});
  var nAdj=function(x){ return (Array.isArray(x)?x:[]).filter(function(a){ return a&&(+a.value||0); }).length; };
  if(J(o.adjustments)!==J(d.adjustments) && (nAdj(o.adjustments)||nAdj(d.adjustments))) out.push({lab:'ส่วนลด / ค่าใช้จ่ายเพิ่ม', from:nAdj(o.adjustments)+' รายการ', to:nAdj(d.adjustments)+' รายการ'+(nAdj(o.adjustments)===nAdj(d.adjustments)?' (แก้ยอด)':'')});
  /* ยอดเงิน · ข้ามถ้าใบนี้มีธงราคาเคลื่อน (§rtKeep) เพราะยอดต่างตั้งแต่ยังไม่แตะอะไร */
  try{
    if(!(d._rtKeep && d._rtKeep.drift) && typeof bookingV2CalcQuote==='function'){
      var was=Math.round(+o.total||0), now=Math.round(+(bookingV2CalcQuote()||{}).grandTotal||0);
      if(was!==now && isFinite(now)) out.push({lab:'ยอดรวม', from:'฿'+was.toLocaleString(), to:'฿'+now.toLocaleString(), tone:'money'});
    }
  }catch(_){}
  return out;
}
