function bookingV2LockHolderName(l){
  if(l.holderType==='office') return 'Office hold';
  if(l.holderType==='global') return 'Global pool';
  return (typeof sbGetAgent==='function' ? (sbGetAgent(l.holderId)?.name || l.holderId) : l.holderId) || 'Agent';
}
