// Persist bookings (single source) · acctPersistBookings if present, else manual read-modify-write of sb_bookings
function bookingV2PersistBookings(){
  if(typeof acctPersistBookings==='function'){ acctPersistBookings(); return; }
  try{ const k=(typeof LS_KEY!=='undefined'?LS_KEY:'loveandaman_v2'); const o=JSON.parse(localStorage.getItem(k)||'{}'); o.sb_bookings=SB_BOOKINGS; localStorage.setItem(k, JSON.stringify(o)); }catch(e){ console.warn('bookingV2PersistBookings failed', e); }
}
