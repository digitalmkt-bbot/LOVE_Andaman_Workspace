function bookingV2BoatOf(id){ return (typeof BOATS!=='undefined'?BOATS:[]).find(b=>b&&b.id===id)||null; }
