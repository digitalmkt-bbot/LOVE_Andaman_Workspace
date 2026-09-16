/* §pkNat · ตั้งจำนวนคนไทยจริงของทริป · ไม่แตะ pax และไม่แตะราคาเลย
   ครั้งแรกที่แตะ ต้องหล่อทั้งสี่ช่องจากแถว TH ก่อน แล้วค่อยบวก/ลบ
   ถ้าปล่อยให้มีแค่ช่องเดียว อีกสามช่องจะกลายเป็น 0 ทันที (bkNatHas เป็นจริงแล้ว)
   เด็กไทยที่คีย์ไว้ในแถว TH ก็จะหายไปเงียบ ๆ ทั้งที่คนกดไม่ได้ตั้งใจ */
function bookingV2BumpNat(idx, k, delta){
  if(!_bkV2.newBooking) return;
  const t = _bkV2.newBooking.trips[idx];
  if(!t || !t.pax) return;
  const px = t.pax;
  if(!bkNatHas(t)){
    t.nat = { ad:+px.ad_th||0, chd:+px.chd_th||0, inf:+px.inf_th||0, foc:+px.foc_th||0 };
  }
  const all = (+px[k+'_th']||0) + (+px[k+'_fr']||0) + (+px[k]||0);
  t.nat[k] = Math.max(0, Math.min(all, (+t.nat[k]||0) + delta));
  bookingV2Render();
}
