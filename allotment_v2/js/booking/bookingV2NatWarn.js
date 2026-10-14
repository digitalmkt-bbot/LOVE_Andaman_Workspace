/* §natRow · เตือนเมื่อคนที่จ่ายเรท TH จะถูกซื้อตั๋วอุทยานแบบ ตปท. (nat ไทย < หัวแถว TH)
   คืน null เมื่อไม่มี nat หรือ nat เท่าแถวราคา · bad=false คือทางกลับกัน (จ่ายเรท FR แต่เป็นไทย) แค่บอก */
function bookingV2NatWarn(t){
  if(!t || !t.pax || !bkNatHas(t)) return null;
  if(typeof bkNatSameAsPrice==='function' && bkNatSameAsPrice(t)) return null;
  const px=t.pax, K=['ad','chd','inf','foc'];
  const th=K.reduce((a,k)=>a+bkNatTH(t,k),0);
  const thPrice=K.reduce((a,k)=>a+(+px[k+'_th']||0),0);
  const all=K.reduce((a,k)=>a+(+px[k+'_th']||0)+(+px[k+'_fr']||0)+(+px[k]||0),0);
  return { th:th, fr:Math.max(0,all-th), thPrice:thPrice, bad: th < thPrice };
}
