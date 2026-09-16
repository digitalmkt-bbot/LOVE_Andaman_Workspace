// True when a booking's assigned boat was pulled from Boat Operation for that date
// (removed from TRIPS · now chartered · or now serving a different route). Used to flag "จัดเรือใหม่".
function bookingV2BoatPulled(bk, date){
  // §boatSplit · บุคกิ้งที่แยกลงหลายลำ · ลำไหนโดนถอดก็ต้องเตือน
  const _ids=(typeof bkBoatIdsOn==='function')?bkBoatIdsOn(bk,date):[];
  if(_ids.length>1) return _ids.some(function(id){ return _bkV2BoatPulled1(bk,date,id); });
  return _bkV2BoatPulled1(bk, date, _ids[0]||'');
}
