function bookingV2PickAgentByText(txt){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  const prevAgentId = d.agentId;
  const trimmed = String(txt||'').trim();
  if(!trimmed){
    d.agentId = null;
    bookingV2ApplyAgentRules(null);   /* §agentOne */
    if(prevAgentId) bookingV2ResetAgentScopedData();
    bookingV2Render(); return;
  }
  /* §agentTrim (2026-11-02) · owner "ทำไม Lime tour ไม่มีรายละเอียด" · ชื่อเอเยนต์ในข้อมูลมีช่องว่างท้าย ('LIME TOUR PHUKET ')
     ช่องค้นหา trim ข้อความที่พิมพ์ แต่ชื่อที่เอามาเทียบไม่ได้ trim → ไม่ตรงกันเลยสักแบบ · ชื่อโชว์ในช่องแต่ agentId ไม่ถูกตั้ง
     หน้าทริป/รีวิวจึงบอก "Pick an agent first" ทั้งที่เลือกแล้ว (LIMETOUR, LUXEVOYA โดน) · เทียบแบบ trim + ยุบช่องว่างทั้งสองฝั่ง */
  const _nz = v => String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  const norm = _nz(trimmed);
  const a = (SB_AGENTS||[]).find(x => {
    if(x.active === false) return false;
    const mkt = (typeof SB_MARKETS!=='undefined' && SB_MARKETS.find(m=>m.id===x.market)?.name) || x.market || '';
    const full = _nz(`[${mkt}] ${x.code} · ${x.name}`);
    const short = _nz(`${x.code} · ${x.name}`);
    return full === norm || short === norm
        || _nz(x.code) === norm
        || _nz(x.name) === norm;
  });
  if(a){
    const isNewAgent = prevAgentId !== a.id;
    d.agentId = a.id;
    bookingV2ApplyAgentRules(a);      /* §agentOne · เดิมที่นี่ตั้งแค่ rateTypeRef · priceMode จึงค้าง */
    if(isNewAgent) bookingV2ResetAgentScopedData();
    bookingV2Render();
  }
}
