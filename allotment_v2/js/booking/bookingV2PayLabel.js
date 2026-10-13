// ── Tab 2 · By trip + date · Trip header + passenger manifest ──
// Pay method label: contract 'credit' -> Invoice, 'prepaid' -> PFM (prepaid full)
function bookingV2PayLabel(m){
  if(!m) return '—';
  const map = { credit:'Invoice', invoice:'Invoice', prepaid:'PFM', proforma:'Proforma', bt:'Bank transfer', cot:'COT' };
  return map[m] || m;
}
