/* ความเคลื่อนไหวล่าสุดของใบ · {at, kind, text, by} · เลือกตัวที่เวลาใหม่สุดจาก history[] / updatedAt / cancellation / createdAt */
function bookingV2LastAct(raw, b){
  const out = { at: String((b && b.createdAt) || (raw && raw.createdAt) || ''), kind: 'create', text: '', by: (raw && raw.createdBy) || '' };
  if(!raw) return out;
  const take = (at, kind, text, by) => { if(at && String(at) > out.at){ out.at = String(at); out.kind = kind; out.text = text || ''; out.by = by || ''; } };
  if(raw.updatedAt) take(raw.updatedAt, 'edit', 'Edited booking details', raw.updatedBy);
  if(Array.isArray(raw.history)) for(const h of raw.history){ if(h) take(h.at, h.kind || 'note', h.text, h.by); }
  const cx = raw.cancellation; if(cx && typeof cx === 'object') take(cx.at, 'cancel', cx.reason ? ('ยกเลิก · ' + cx.reason) : 'ยกเลิก', cx.by);
  return out;
}
