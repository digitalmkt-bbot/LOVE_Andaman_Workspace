/* ช่องพิมพ์ไม่ render ใหม่ · ไม่งั้น cursor เด้งออกทุกตัวอักษร (ของเดิมในฟอร์มที่นั่งก็ทำแบบนี้) */
function bookingV2BoatLockSetQ(f,v){ if(_bkBoatForm){ _bkBoatForm[f]=v; if(f==='minCap') _bkBoatForm.capTouched=true; } }
