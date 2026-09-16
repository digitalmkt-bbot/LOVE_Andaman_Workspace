// Logged-in user's display name (for Submitted/Confirmed by auto-fill) · '' when no login (localhost)
function bookingV2LoginUser(){ return (window.LA_ME && (window.LA_ME.name||window.LA_ME.username)) || ''; }
