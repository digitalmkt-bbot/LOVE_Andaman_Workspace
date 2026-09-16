function bookingV2AddOnFlags(bk, routeId){
  let join=false, charter=false, transfer=false, charterQty=0;
  (bk.addOns||[]).forEach(a=>{ const ty=String(a.type||''); const lbl=String(a.label||'');
    if(ty==='longtail-charter'){ charter=true; charterQty+=(+a.qty||1); }
    else if(ty==='longtail-join') join=true;
    else if(ty.indexOf('transfer-')===0) transfer=true;
    else if(/longtail|หางยาว/i.test(ty)||/longtail|หางยาว/i.test(lbl)) join=true;
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
  return {join, charter, transfer, charterQty};
}
