// Format a Date as YYYY-MM-DD using LOCAL components (avoid UTC shift from toISOString in +07:00)
function bookingV2LocalYMD(dt){ return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }
