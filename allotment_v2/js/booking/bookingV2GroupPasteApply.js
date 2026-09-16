function bookingV2GroupPasteApply(){
  if(!_bkV2.newBooking) return;
  const ta=document.getElementById('bkv2-grouppaste-ta'); if(!ta) return;
  const lines=String(ta.value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length){ alert('วางรายชื่ออย่างน้อย 1 คน'); return; }
  const entries=lines.map(line=>{ const parts=line.split(/[,\t|]/).map(s=>s.trim()); const name=parts[0]||''; return {name, nat:_bkV2GrpNat(parts[1]||'', name)}; });
  const N=entries.length;
  const d=_bkV2.newBooking;
  if(!d.trips || !d.trips.length){ d.trips=[bookingV2NewTrip()]; }
  const thai=entries.filter(e=>e.nat==='TH').length;
  const t=d.trips[0]; t.pax=t.pax||{};
  // ⚠ Names fewer than the already-specified pax → warn (don't silently shrink the head count)
  const _curTot=(typeof bookingV2PaxAllTot==='function')?bookingV2PaxAllTot(t.pax):0;
  if(_curTot>N){
    const keep=confirm('วางรายชื่อ '+N+' คน · แต่ trip นี้ระบุไว้ '+_curTot+' คน\n\n⚠ ชื่อไม่ครบตามจำนวนที่ระบุ\n\nOK = คงจำนวน '+_curTot+' (เติมชื่อเท่าที่วาง '+N+' · ที่เหลือเว้นว่าง)\nCancel = ปรับจำนวนเป็น '+N+' ตามชื่อที่วาง');
    if(keep){
      d.leadPax=entries[0].name; if(entries[0].nat) d.leadNationality=entries[0].nat;
      bookingV2SyncPassengers();
      for(let i=1;i<N;i++){ const p=d.passengers[i-1]; if(p){ p.name=entries[i].name; if(entries[i].nat) p.nationality=entries[i].nat; } }
      bookingV2GroupPasteClose();
      if(typeof bookingV2Render==='function') bookingV2Render();
      return;
    }
  }
  // The pasted N names = the WHOLE group · CHD/INF/FOC seats already set (in Trips) are PART of N, not on top
  // → adults = N − (chd+inf+foc) so the head count stays exactly N
  // (was: only subtracting FOC → child/infant double-counted → "เด้ง Lead เพิ่ม 1 คน" e.g. 3AD+1CHD pasted as 4 → 5)
  const focN = (t.pax.foc||0)+(t.pax.foc_fr||0)+(t.pax.foc_th||0);
  const chdN = (t.pax.chd||0)+(t.pax.chd_fr||0)+(t.pax.chd_th||0);
  const infN = (t.pax.inf||0)+(t.pax.inf_fr||0)+(t.pax.inf_th||0);
  const otherN = focN + chdN + infN;   // non-adult heads already configured (counted within N)
  const adultN = Math.max(0, N - otherN);
  const adThai = Math.min(thai, adultN);
  t.pax.ad=0; t.pax.ad_th=adThai; t.pax.ad_fr=adultN-adThai;
  d.leadPax=entries[0].name; if(entries[0].nat) d.leadNationality=entries[0].nat;
  bookingV2SyncPassengers();
  for(let i=1;i<N;i++){ const p=d.passengers[i-1]; if(p){ p.name=entries[i].name; if(entries[i].nat) p.nationality=entries[i].nat; } }
  bookingV2GroupPasteClose();
  if(typeof bookingV2Render==='function') bookingV2Render();
}
