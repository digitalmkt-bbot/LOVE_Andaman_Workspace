function bookingV2EnsureApproval(b){
  if(!b) return null;
  if(!b.approval || typeof b.approval!=='object'){
    var why=bookingV2PendReason(b);
    b.approval={ status:'pending', reason:why,
      requestedBy:(/^b2c_/.test(String(b.id||''))?'B2C · ระบบพักไว้':'ระบบ'),
      requestedAt:(b.createdAt||b.bookingDate||new Date().toISOString()) };
  }
  return b.approval;
}
