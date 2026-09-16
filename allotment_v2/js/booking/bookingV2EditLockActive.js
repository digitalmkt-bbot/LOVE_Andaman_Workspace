function bookingV2EditLockActive(bk){   // → {by,mins} if someone ELSE holds a fresh lock, else null
  const L = bk && bk.editLock; if(!L || !L.at) return null;
  if(Date.now() - L.at > BK_EDITLOCK_TTL) return null;            // stale → ignore
  const me=_bkV2MeUid(); if(me && L.uid && L.uid===me) return null;   // my own lock
  return { by:L.by||L.uid||'someone', mins:Math.max(1,Math.round((Date.now()-L.at)/60000)) };
}
