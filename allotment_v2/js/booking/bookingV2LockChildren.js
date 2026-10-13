// ── Parent / child sub-locks (Option A) · a lock with children is an umbrella; children carve out its qty ──
function bookingV2LockChildren(parentId){ return SB_SEAT_LOCKS.filter(x=>x.parentId===parentId); }
