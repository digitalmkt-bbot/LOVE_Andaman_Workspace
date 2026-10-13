function bookingV2GetRT(){
  /* §internal · ใบของบริษัทเองใช้ชุดสังเคราะห์เสมอ ต่อให้มีคนไปผูก rate type ไว้ในหน้า Agent List
     เพราะราคาของใบพวกนี้มาจากช่อง Total ทุกใบ (ปุ่ม Pricing ล็อกเป็น Manual แล้ว)
     เรทที่ผูกไว้จึงมีผลอย่างเดียวคือ "จำกัดรายการเส้นทาง" ซึ่งไม่ควรเกิด
     วัดเรทจริงแล้ว ชุดที่ครอบมากสุดได้ 7 เส้นทางจาก 57 ที่เปิดใช้ · แขก/PR ไปโปรแกรมไหนก็ได้ */
  if(typeof laIsCompanyBk==='function' && laIsCompanyBk(_bkV2.newBooking)) return laManualRT();
  if(!_bkV2.newBooking?.rateTypeRef) return null;
  return (SB_RATE_TYPES||[]).find(r => r.id === _bkV2.newBooking.rateTypeRef) || null;
}
