// Routes shown in Tab 1 (Calendar + Matrix) · derived live from ROUTES + Rate Types + bookings
// Single source of truth: ROUTES (same as Agent · Rate Type pages)
function bookingV2ShortenRouteName(name){
  if(!name) return '';
  return name
    .replace('Whale Shark Phi Phi Maiton Sunset','Whale Shark')
    .replace('Similan Islands by Speedboat','Similan SB')
    .replace('Similan Islands by Catamaran','Similan Cat')
    .replace('Similan Islands - PG','Similan PG')
    .replace('Early Tratato Similan Islands','Early Tratato')
    .replace('Early Tiger Similan Islands','Early Tiger')
    .replace('Surin Islands by Speedboat','Surin SB')
    .replace('Phi Phi Bamboo by Speedboat','Phi Phi SB')
    .replace('Phi Phi Bamboo - FS','Phi Phi FS')
    .replace('Early SY Phi Phi Bamboo','Early SY')
    .replace('Early OTA Phi Phi Bamboo','Early OTA')
    .replace('Early Krabi + Phang Nga','Early Krabi+PN');
}
