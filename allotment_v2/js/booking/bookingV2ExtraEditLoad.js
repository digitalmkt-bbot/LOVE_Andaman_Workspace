function bookingV2ExtraEditLoad(id, bkId){ _bkExtraEditId=id; _bkExtraBk=bkId; _bkxPayReset(bookingV2ExtrasFor(bkId).find(function(x){ return x.id===id; })); bookingV2ExtraRender(); }
