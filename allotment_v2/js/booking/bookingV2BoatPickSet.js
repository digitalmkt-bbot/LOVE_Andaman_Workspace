function bookingV2BoatPickSet(bkId, boatId, date){ const ov=document.getElementById('bkv2-boatpick'); if(ov) ov.remove(); bookingV2AssignBoat(bkId, boatId, date||''); }
