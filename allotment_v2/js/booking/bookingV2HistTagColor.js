// Tag → [bg,fg] chip colors for the booking history timeline
function bookingV2HistTagColor(tag){
  const m={
    'Created':['#E6F1FB','#185FA5'], 'Edited':['#EDE7FB','#5B289A'], 'Confirmed':['#E1F5EE','#0F6E56'],
    'Invoice':['#FBF0DD','#7A4A00'], 'Payment':['#E1F5EE','#0F6E56'],
    'Reschedule':['#E6F1FB','#185FA5'], 'Cancel':['#FCEBEB','#A32D2D'], 'Refund':['#FCEBEB','#A32D2D'],
    'Credit':['#FAEEDA','#854F0B'], 'Notify':['#FBF0DD','#7A4A00'], 'Weather':['#FCEBEB','#A32D2D'],
    'FOC':['#FAEEDA','#854F0B'], 'Extra':['#E1F5EE','#0F6E56']
  };
  return m[tag]||['#F1EFE8','#5F5E5A'];
}
