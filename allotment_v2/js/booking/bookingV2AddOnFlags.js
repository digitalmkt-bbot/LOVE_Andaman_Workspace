function bookingV2AddOnFlags(bk, routeId){
  let join=false, charter=false, transfer=false, charterQty=0, joinPax=null;
  (bk.addOns||[]).forEach(a=>{ const ty=String(a.type||''); const lbl=String(a.label||'');
    const _k=bookingV2LtAddOnKind(ty);
    if(_k==='charter'){ charter=true; charterQty+=(+a.qty||1); }
    else if(_k==='charter-pax') charter=true;          /* §ltCode · คนเพิ่มในลำเดิม ไม่ใช่ลำใหม่ */
    /* §ltJoinQty · จำนวนคนที่ลงจอยจริง · null = ใบเก่าที่ไม่เคยระบุ → คิดทุกหัวเหมือนเดิม */
    else if(_k==='join'){ join=true;
      if(a.jAd!=null || a.jChd!=null) joinPax=Math.max(0,(+a.jAd||0)+(+a.jChd||0)); }
    else if(ty.indexOf('transfer-')===0) transfer=true;
    else if(/longtail|หางยาว/i.test(ty)||/longtail|หางยาว/i.test(lbl)){
      /* §ltCode · รหัสที่ยังไม่รู้จัก · อ่านจากชื่อแทนที่จะเดาว่า "จอย" ทั้งที่ชื่อเขียนว่า Charter */
      if(/เหมา|charter|private|ไพรเวท|ส่วนตัว/i.test(ty+' '+lbl)){ charter=true; charterQty+=(+a.qty||1); }
      else join=true;
    }
  });
  const tr=(bk.trips||[]).find(t=>t.routeId===routeId)||{};
  if(tr.bundle&&tr.bundle.type==='longtail') join=true;
  if(tr.longtailManual) join=true;
  if(!join&&!charter){   // forced Longtail bundle at the Rate Type level (not materialised on the trip)
    const rtId=bk.rateTypeRef||(bk.agentId&&typeof sbGetAgent==='function'?((sbGetAgent(bk.agentId)||{}).rateTypeId):null);
    const rtB=(rtId&&typeof getRateType==='function')?getRateType(rtId):null;
    const _lbF=rtB&&rtB.routeBundles&&rtB.routeBundles[routeId]&&rtB.routeBundles[routeId].longtail;
    if(_lbF && _rtBundleAppliesTo(_lbF, tr.bookingMode==='charter')) join=true;
  }
  if(charter) join=false;
  return {join, charter, transfer, charterQty, joinPax};
}
