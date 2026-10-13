/* เส้นทางที่ใช้คิดราคา · ใบที่ upgrade อยู่ = เส้นทางที่ขาย ไม่ใช่เส้นทางที่วิ่งจริง */
function bookingV2PrRoute(t){ return bkUpgActive(t) ? t.upg.fromRouteId : ((t&&t.routeId)||''); }
