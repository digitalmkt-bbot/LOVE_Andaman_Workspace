function bookingV2FmtClock(iso){ const d = new Date(iso); return isNaN(d) ? '' : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
