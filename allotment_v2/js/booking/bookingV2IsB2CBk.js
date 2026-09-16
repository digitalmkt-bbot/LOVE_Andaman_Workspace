// §b2cEdit · booking ที่มาจาก B2C · id ขึ้นต้นด้วย b2c_ เสมอ (relSyncB2C เป็นคนตั้ง)
function bookingV2IsB2CBk(bk){ return /^b2c_/.test(String((bk&&bk.id)||'')); }
