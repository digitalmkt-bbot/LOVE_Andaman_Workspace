function bookingV2SyncAltPickupSplits(b){
  if(!b) return false;
  var _before=_bkV2AltSnap(b.ops);
  var r=_bkV2SyncAltPickupSplitsRaw(b);
  return !!r && _bkV2AltSnap(b.ops)!==_before;
}
