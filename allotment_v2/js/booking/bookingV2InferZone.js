// Pickup string → zone (PK / KL / NT)
function bookingV2InferZone(bk){
  const pickup = (bk.pickup || '').toLowerCase();
  if(pickup.includes('khao lak') || pickup.startsWith('kl ')) return 'KL';
  if(pickup.includes('walk-in') || pickup.includes('pier') || pickup.includes('no transfer')) return 'NT';
  return 'PK';
}
