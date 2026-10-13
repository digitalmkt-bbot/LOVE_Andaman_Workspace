function bookingV2StatusLabel(st){
  return ({
    'quote': 'Quote',
    'pending_foc': 'Pending FOC',
    'confirmed': 'Confirmed',
    'completed': 'Completed',
    'rejected': 'Rejected',
    'cancelled': 'Cancelled'
  })[st] || st;
}
