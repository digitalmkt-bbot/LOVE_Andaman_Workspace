function bookingV2DayIntensity(total){
  if(total === 0) return 'empty';
  if(total <= 40) return 'lo';
  if(total <= 70) return 'mid';
  if(total <= 84) return 'hi';
  return 'peak';
}
