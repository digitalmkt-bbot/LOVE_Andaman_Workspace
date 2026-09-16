// ════ By trip date · per-row payment action (create invoice/PFM · record payment) ════
function bookingV2PayChip(bk){
  const inv=(typeof acctBookingInvoice==='function')?acctBookingInvoice(bk.id):null;
  const a=(typeof sbGetAgent==='function')?sbGetAgent(bk.agentId):null;
  let txt,bg,fg;
  let bd='var(--border)';
  let paidChip='';
  // Staff trips that carry no charge (FOC within quota / inspection) → label FREE clearly, not "COT"
  const _staffTotal = bk.total || (bk.priceBreakdown&&bk.priceBreakdown.total) || 0;
  const _isStaffFree = (bk.purpose==='staff_welfare' || bk.purpose==='staff_inspection' || bk.staffId) && !inv && _staffTotal<=0;
  if(_isStaffFree){
    const insp = bk.staffPurpose==='inspection' || bk.purpose==='staff_inspection';
    const t2 = insp ? 'Inspection · FREE' : 'FOC · Welfare';
    const c = insp ? ['#EEE9FB','#6c5ce7','#D9CFFA'] : ['#FCE9B5','#7A5A12','#EAD7A8'];
    return `<span class="t2-pay" style="background:${c[0]};color:${c[1]};border:1px solid ${c[2]};cursor:pointer;font-weight:600" onclick="event.stopPropagation();bookingV2RowPayAction('${bk.id}')" title="Staff trip · no charge">${t2}</span>`;
  }
  // ── PFM (proforma) — mirror the Daily PFM steps so status managed there shows here too ──
  const _pfm=(bk.ops&&bk.ops.pfm)||null;
  if((a&&a.payType==='proforma') || _pfm){
    const _bal = inv?acctInvoiceBalance(inv):acctBookingTotal(bk);
    const _unpaid=_bal>0;
    const _held=_pfm&&_pfm.decision==='hold';
    const _appr=_pfm&&_pfm.decision==='approved';
    const _td=(bk.trips||[]).map(t=>t.date||'').filter(Boolean).sort()[0]||'';
    const _past = _td && (typeof pfmCutoff==='function') && (new Date() > pfmCutoff(_td));
    let pm;
    if(_held) pm=['On hold','#FCEBEB','#A32D2D','#E6C9C3'];
    else if(_appr) pm=['Extended','#E1F5EE','#0F6E56','#9FE1CB'];
    else if(!_unpaid && inv) pm=['Paid','#E1F5EE','#0F6E56','#9FE1CB'];
    else if(_unpaid && _past) pm=['&#9888; เลย cutoff','#FCEBEB','#A32D2D','#E6C9C3'];
    else if(inv) pm=['Awaiting','#FBF0DD','#7A4A00','#EAD7A8'];
    else pm=['Pro Forma','#FBF0DD','#7A4A00','#EAD7A8'];
    return `<span class="t2-pay" style="background:${pm[1]};color:${pm[2]};border:1px solid ${pm[3]};cursor:pointer;font-weight:600" onclick="event.stopPropagation();bookingV2RowPayAction('${bk.id}')" title="สถานะ PFM · จัดการที่หน้า Daily PFM (Extend/Hold) หรือคลิกเพื่อออก/รับเงิน">${pm[0]}</span>`;
  }
  if(inv){ const st=acctInvoiceState(inv); const m=({issued:['Awaiting','#FBF0DD','#7A4A00'],partial:['Partial','#E6F1FB','#185FA5'],paid:['Paid','#E1F5EE','#0F6E56'],void:['Void','#F1EFE8','#5F5E5A']})[st]||['—','#F1EFE8','#5F5E5A']; txt=m[0];bg=m[1];fg=m[2]; }
  else {
    // B2C: every synced booking hangs off the a_b2c house agent (payType 'cot'), so the agent default
    // would mask the customer's real choice — B2C sends a per-booking payment_type into
    // paymentSnapshot.method. Booking-level wins for B2C only; B2B still follows the agent contract.
    const _b2cPt = (bk.agentId==='a_b2c') ? (bk.paymentSnapshot&&bk.paymentSnapshot.method) : '';
    const pt=_b2cPt || (a&&a.payType)|| bk.payment || (bk.paymentSnapshot&&bk.paymentSnapshot.method);
    txt=bookingV2PayLabel(pt);
    // Color by payment type: Invoice=blue · Proforma/PFM=amber · COT=cyan · Bank=neutral
    const pm=({invoice:['#E6F1FB','#185FA5','#BBD7F0'],credit:['#E6F1FB','#185FA5','#BBD7F0'],proforma:['#FBF0DD','#7A4A00','#EAD7A8'],prepaid:['#FBF0DD','#7A4A00','#EAD7A8'],cot:['#E0F7FA','#00838F','#9FE3EC'],bt:['#F1EFE8','#5F5E5A','#E0DDD4']})[pt]||['#fff','#5F5E5A','var(--border)'];
    bg=pm[0];fg=pm[1];bd=pm[2];
    // ...but that chip is the BILLING TERM only ("cot" = pay on tour, not "collected"). Whether money
    // actually arrived is derived server-side (paymentSnapshot.paidStatus = total vs payments +
    // credits applied) and gets its own chip, so the term is never read as a payment state.
    if(bk.agentId==='a_b2c'){
      const _ps=(bk.paymentSnapshot&&bk.paymentSnapshot.paidStatus)||'';
      const _sm=({paid:['Paid','#E1F5EE','#0F6E56','#9FE1CB'],deposit:['Deposit','#E6F1FB','#185FA5','#BBD7F0'],unpaid:['Unpaid','#FCEBEB','#A32D2D','#E6C9C3']})[_ps];
      if(_sm){
        // Amount is order-level and rides on the first line only — a multi-item order would otherwise
        // report its money once per line. The STATUS is on every line.
        const _amt=Number(bk.paymentSnapshot&&bk.paymentSnapshot.paid)||0;
        const _tip=`B2C received ${_amt?'THB '+_amt.toLocaleString():'THB 0'} of the order total (payments + credits). Billing term is ${txt}.`;
        // §จ่ายครบแล้ว = ทิ้งป้าย term ไปเลย · "COT" บน booking ที่จ่ายครบ สั่งให้ไกด์ไปเก็บเงินที่เข้ามา
        // แล้ว. เหลือแค่ป้าย Paid (term ยังดูได้ใน tooltip). Deposit/Unpaid ยังโชว์ COT เพราะยังมี
        // ยอดค้างต้องเก็บจริง.
        const _paidOnly=(_ps==='paid');
        paidChip=`<span class="t2-pay" style="background:${_sm[1]};color:${_sm[2]};border:1px solid ${_sm[3]};font-weight:600;${_paidOnly?'cursor:pointer':'margin-left:3px'}" title="${_tip}"${_paidOnly?` onclick="event.stopPropagation();bookingV2RowPayAction('${bk.id}')"`:''}>${_sm[0]}</span>`;
        if(_paidOnly) return paidChip;
      }
    }
  }
  return `<span class="t2-pay" style="background:${bg};color:${fg};border:1px solid ${bd};cursor:pointer;font-weight:600" onclick="event.stopPropagation();bookingV2RowPayAction('${bk.id}')" title="จัดการการชำระเงิน">${txt}</span>${paidChip}`;
}
