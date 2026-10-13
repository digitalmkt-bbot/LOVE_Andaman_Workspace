function bookingV2UpgradesFor(bkId){ const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); return (bk&&Array.isArray(bk.upgrades))?bk.upgrades:[]; }
