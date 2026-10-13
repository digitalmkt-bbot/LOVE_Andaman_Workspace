function bookingV2B2CHeadChip(){
  const n=bookingV2B2CList().length; if(!n) return '';
  return `<button class="bt-b2cbtn" onclick="bookingV2B2COpen()" title="บุคกิ้ง B2C ที่ถูกแก้/ยกเลิก/เข้ามาใหม่ และยังไม่มีคนรับทราบ · ทุกวันเดินทาง">&#128276; B2C changes <i>${n}</i> to review</button>`;
}
