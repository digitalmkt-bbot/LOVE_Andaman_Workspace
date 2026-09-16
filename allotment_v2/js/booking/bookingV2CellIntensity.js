function bookingV2CellIntensity(total){
  if(total === 0) return 'empty';
  if(total <= 10) return 'lo';
  if(total <= 24) return 'mid';
  if(total <= 50) return 'hi';
  return 'peak';
}
