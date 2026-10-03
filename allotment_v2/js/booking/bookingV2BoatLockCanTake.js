function bookingV2BoatLockCanTake(date, boatId, routeId, exceptId){
  const B = bookingV2BoatLockBlockers(date, boatId, routeId, exceptId);
  return !(B.charterOf || B.holdOf || B.pax>0 || B.cellBooked>0 || B.short>0);
}
