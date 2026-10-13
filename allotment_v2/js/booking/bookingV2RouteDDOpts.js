function bookingV2RouteDDOpts(){
  if(typeof ROUTES === 'undefined') return [];
  return bookingV2BookableRoutes().ids
    .map(rid => ROUTES.find(r => r.id === rid)).filter(Boolean)
    .filter(r => (typeof laIsLandRoute!=='function') || (laIsLandRoute(r.id)===_bkV2CityTourOnly))   // §cityTourView · marine page offers marine routes only · land page offers land routes only
    /* §routeOrd · เดิมเรียงตามลำดับแถวใน Programs sold / Rate Type ซึ่งคือลำดับที่คนกดเพิ่ม
       ท่าจึงปนกันกลางรายการ · วัดแล้ว 302 เอเยนต์มีลำดับไม่ตรงกับลำดับโปรแกรมในระบบ
       ตอนนี้เรียงท่าก่อน แล้วตามลำดับของหน้า Program Config · ลำดับใน Agent List ไม่ถูกแตะ */
    .sort((a,b) => (typeof laRouteOrdCmp==='function') ? laRouteOrdCmp(a,b) : 0)
    .map(r => ({ id: r.id, label: r.name, pier: bookingV2PierTag(r.pier),
                 pierId: ((typeof laIsLandRoute==='function' && laIsLandRoute(r.id)) ? 'other' : (r.pier || 'other')) }));
}
