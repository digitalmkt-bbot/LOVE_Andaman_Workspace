// Contribution to the sellable-pool reduction · counted at the parent/standalone level ONLY (children live inside the parent → 0)
function bookingV2LockPoolHold(l, date){ return l.parentId ? 0 : bookingV2LockHeldRemaining(l, date); }
