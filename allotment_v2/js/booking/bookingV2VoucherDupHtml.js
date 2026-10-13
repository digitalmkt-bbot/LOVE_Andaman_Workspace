// Live voucher-duplicate check (under the Voucher ref field) — exact voucher match only · updates a warn div without re-render (keeps input focus)
function bookingV2VoucherDupHtml(val){
  const v=String(val||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!v) return '';
  const excl=_bkV2.editingId||null;
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const hits=(SB_BOOKINGS||[]).filter(b=>{ if(b.id===excl) return false; if(['cancelled','rejected','cancelled_weather'].includes(b.status)) return false; const bv=String(b.voucherRef||b.code||'').trim().toLowerCase().replace(/\s+/g,' '); return bv && bv===v; });
  if(!hits.length) return '';
  const b=hits[0]; const _t0=(b.trips||[])[0]||{}; const _rn=((typeof getRoute==='function'&&getRoute(_t0.routeId))||{}).name||'';
  const more=hits.length>1?(' · และอีก '+(hits.length-1)):'';
  return `<div style="display:flex;align-items:flex-start;gap:6px;background:#FCEBEB;border:1px solid #F0C9C9;border-radius:7px;padding:5px 9px;font-size:11px;color:#A32D2D;font-weight:600">&#9888;<span>เลข Voucher นี้มีอยู่แล้ว: ${esc(b.leadPax||'-')}${_t0.date?(' · '+esc(_t0.date)):''}${_rn?(' · '+esc(_rn)):''}${more} — ตรวจว่าไม่ใช่การลงซ้ำ</span></div>`;
}
