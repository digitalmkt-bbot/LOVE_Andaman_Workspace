// แถวสรุปใต้แถวบุคกิ้งในหน้า By trip date
function bookingV2B2CStripRow(bk, colN, date){
  const p=bookingV2B2CPending(bk); if(!p) return '';
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const can=(typeof acctCanEditBookings!=='function') || acctCanEditBookings();
  const id=esc(bk.id);
  return `<tr class="t2-b2cchg k-${bookingV2B2CKind(p)}" data-bk="${id}"><td colspan="${colN}"><div class="b2cl">`
    + `<span class="b2cwho">${bookingV2B2CWho(p)} &middot; ${esc(bookingV2B2CWhen(p.at))}</span>`
    + bookingV2B2CBodyHtml(bk, p, date)
    + (can?`<button class="b2cok" onclick="event.stopPropagation();bookingV2B2CSeen('${id}')" title="รับทราบแล้ว · บรรทัดนี้จะหายไปสำหรับทุกคน และบันทึกในประวัติของใบนี้">&#10003; รับทราบ</button>`:'')
    + `</div></td></tr>`;
}
