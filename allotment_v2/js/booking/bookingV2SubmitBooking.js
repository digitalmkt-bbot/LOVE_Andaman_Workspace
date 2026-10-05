function bookingV2SubmitBooking(){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  const quote = bookingV2CalcQuote();
  const hasFoc = quote.totalFoc > 0;
  if(hasFoc && !(d.focReason||'').trim()){ alert('Please enter FOC reason'); return; }
  /* §chManualNoRate · ใบเหมาที่เรือไม่มีเรทเหมา และยังไม่ได้กรอกราคาเอง = ทริปนั้นจะบันทึกเป็น ฿0
     เดิมผ่านไปเงียบ ๆ · ถามก่อนทุกครั้ง (ไม่ห้าม เพราะเหมาฟรีมีจริง แต่ต้องเป็นการตัดสินใจ ไม่ใช่อุบัติเหตุ) */
  if(!quote.manual){
    const _nr = (d.trips||[]).map((t,i)=>({t, sub:(quote.perTrip||[])[i]}))
      .filter(x => x.t && x.t.bookingMode==='charter' && x.sub && x.sub.error==='no charter rate');
    if(_nr.length){
      const _ln = _nr.map(x => '- ' + (((typeof getRoute==='function' && getRoute(x.t.routeId))||{}).name || x.t.routeId) + ' ' + x.t.date + ' / ' + (x.sub.boatName||'boat')).join('\n');
      if(!confirm('WARNING - charter trip will be saved at 0 THB\n\n' + _ln + '\n\nThis boat type has no charter rate in the agent\'s Rate Type and no agreed price was entered.\n\nPress Cancel to go back and enter the agreed charter price in the red box.\nPress OK only if this charter is really free.')) return;
    }
  }
  /* §rtKeep · ราคาในชุดถูกแก้หลังใบนี้บันทึก · ถามก่อนเขียนยอดใหม่ทับ (ข้อความเตือนอยู่บนฟอร์มแล้ว นี่คือด่านสุดท้าย) */
  const _K = d._rtKeep;
  if(_bkV2.editingId && _K && _K.drift && _K.mode==='keep' && d.priceMode!=='manual'){
    const _was = Math.round(_K.total), _now = Math.round(quote.grandTotal);
    if(_was !== _now && !confirm('Saved total: THB '+_was.toLocaleString()+'\nTotal at current rates: THB '+_now.toLocaleString()
        +'\n\nPrices in this rate type changed after the booking was saved.\nSave with the new total?')) return;
  }
  bookingV2CommitBooking(hasFoc ? 'pending_foc' : 'confirmed');
}
