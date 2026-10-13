function bookingV2RouteFamilyGuess(r){
  const n = (r && r.name) || '';
  if(n.includes('Nyaung') || n.includes('Oo Phee')) return window._BKV2_FAMILIES[6];
  if(n.includes('Se La Va') || n.includes('SeLaVa')) return window._BKV2_FAMILIES[5];
  if(n.includes('Whale')) return window._BKV2_FAMILIES[4];
  if(n.includes('Similan')) return window._BKV2_FAMILIES[0];
  if(n.includes('Surin')) return window._BKV2_FAMILIES[1];
  if(n.includes('Phi Phi')) return window._BKV2_FAMILIES[2];
  if(n.includes('Krabi') || n.includes('Phang Nga')) return window._BKV2_FAMILIES[3];
  return null;
}
