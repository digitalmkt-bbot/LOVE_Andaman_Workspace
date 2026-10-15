function bookingV2Dow(d){ if(!d) return ''; const dt = new Date(String(d).length <= 10 ? d + 'T00:00' : d); return isNaN(dt) ? '' : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]; }
