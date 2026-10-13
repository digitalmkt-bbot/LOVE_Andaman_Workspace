function bookingV2B2CWho(p){
  return p.cancelled ? '&#10005; B2C ยกเลิก' : p.isNew ? '&#65291; ใบใหม่จาก B2C' : '&#9998; B2C แก้ไข';
}
