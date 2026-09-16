// Boat avatar (matches Boat Status style) · colored round initials + stable color per boat
function bookingV2BoatInitials(name){ name=String(name||''); const w=name.trim().split(/\s+/); if(w.length>=2) return (w[0][0]+w[1][0]).toUpperCase(); if(name.length>=2&&/\d/.test(name)) return (name.match(/[A-Z]/g)?.[0]||name[0])+name.slice(-1); return name.slice(0,2).toUpperCase(); }
