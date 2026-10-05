function bookingV2BoatLockRouteNm(rid){ const r=(typeof ROUTES!=='undefined'?ROUTES:[]).find(x=>x&&x.id===rid); return (r&&r.name)||rid||''; }
