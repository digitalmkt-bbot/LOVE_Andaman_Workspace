function bookingV2LockReleasedForDate(l, tripDate){
  const c = bookingV2LockReleaseCutoff(l, tripDate);
  return c ? (Date.now() >= c.getTime()) : false;
}
