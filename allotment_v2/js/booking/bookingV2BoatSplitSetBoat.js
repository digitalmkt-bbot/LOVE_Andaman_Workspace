function bookingV2BoatSplitSetBoat(i, id){ if(!_bkBoatM||!_bkBoatM.parts[i]) return; _bkBoatM.parts[i].boatId=id||''; bookingV2BoatSplitRender(); }
