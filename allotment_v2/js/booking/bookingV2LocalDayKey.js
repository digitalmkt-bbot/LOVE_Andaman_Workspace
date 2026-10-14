function bookingV2LocalDayKey(iso){ if(!iso) return ''; const d = new Date(iso); return isNaN(d) ? String(iso).slice(0,10) : bookingV2LocalYMD(d); }
