function bookingV2ZoneLabel(z){   /* §rnZone */
  return ({ PK:'Phuket', KL:'Khao Lak', RN:'Ranong', NoTransfer:'Own transportation', NT:'Own transportation' })[z] || z || 'Own transportation';
}
