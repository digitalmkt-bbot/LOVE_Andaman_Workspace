function bookingV2BoatSplitDelPart(i){ if(!_bkBoatM) return; if(_bkBoatM.parts.length<=1) return; _bkBoatM.parts.splice(i,1); bookingV2BoatSplitRender(); }
