// ── Passenger list (rows = total AD - 1 · lead handled separately) ──
// Charter displacement confirmation modal · shown when chartering a boat with existing seat bookings
function bookingV2RenderCharterConfirmModal(){
  const c = _bkV2CharterConfirm;
  if(!c) return '';
  const escapeHTML = s => String(s||'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const route = (typeof ROUTES !== 'undefined') ? ROUTES.find(r => r.id === c.routeId) : null;
  const isOversold = c.oversold > 0;
  return `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto" onclick="if(event.target===this)bookingV2CancelCharterConfirm()">
      <div style="background:#fff;border-radius:8px;width:580px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden">
        <div style="padding:16px 22px;background:#F4E8FB;border-bottom:1px solid #D7B5F0;display:flex;align-items:center;gap:12px">
          <div style="font-size:24px">⚠️</div>
          <div style="flex:1">
            <div style="font-size:9px;color:#6B289A;font-weight:700;letter-spacing:.08em">CHARTER CONFIRMATION REQUIRED</div>
            <div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-top:2px">Existing seat bookings will be affected</div>
          </div>
        </div>
        <div style="padding:18px 22px">
          <div style="font-size:12px;color:#5A5A52;line-height:1.6;margin-bottom:14px">
            You're chartering <strong style="color:#1a1a1a">${escapeHTML(c.boatName)}</strong> (${c.boatCapacity} cap) on <strong style="font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">${escapeHTML(c.date)}</strong> for <strong style="color:#1a1a1a">${escapeHTML(route?.name||c.routeId)}</strong>.
            This will <strong style="color:#6B289A">reduce seat capacity</strong> for existing bookings on this route+date.
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
            <div style="background:#fafafa;border:1px solid var(--border);border-radius:5px;padding:9px 11px">
              <div style="font-size:8px;color:var(--ink-soft);font-weight:700;letter-spacing:.08em;text-transform:uppercase">Pool before</div>
              <div style="font-family:Manrope,sans-serif;font-size:17px;font-weight:700;color:#1a1a1a;font-variant-numeric:tabular-nums;margin-top:3px">${c.currentAvailable}</div>
              <div style="font-size:10px;color:var(--ink-soft);font-family:Manrope,sans-serif;font-variant-numeric:tabular-nums">${c.seatsConsumed} booked</div>
            </div>
            <div style="background:#F4E8FB;border:1px solid #D7B5F0;border-radius:5px;padding:9px 11px">
              <div style="font-size:8px;color:#6B289A;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Charter removes</div>
              <div style="font-family:Manrope,sans-serif;font-size:17px;font-weight:700;color:#6B289A;font-variant-numeric:tabular-nums;margin-top:3px">−${c.boatCapacity}</div>
              <div style="font-size:10px;color:#6B289A">${escapeHTML(c.boatName)}</div>
            </div>
            <div style="background:${isOversold?'#FDE7E7':'#E1F5EE'};border:1px solid ${isOversold?'#F5B7B7':'#B8E5D2'};border-radius:5px;padding:9px 11px">
              <div style="font-size:8px;color:${isOversold?'#a32d2d':'#0F6E56'};font-weight:700;letter-spacing:.08em;text-transform:uppercase">Pool after</div>
              <div style="font-family:Manrope,sans-serif;font-size:17px;font-weight:700;color:${isOversold?'#a32d2d':'#0F6E56'};font-variant-numeric:tabular-nums;margin-top:3px">${c.availAfter}</div>
              <div style="font-size:10px;color:${isOversold?'#a32d2d':'#0F6E56'}">${isOversold?`OVERSOLD by ${c.oversold}`:'still ok'}</div>
            </div>
          </div>

          ${isOversold ? `
            <div style="background:#FDE7E7;border:1px solid #F5B7B7;border-radius:5px;padding:10px 13px;margin-bottom:14px;font-size:11px;color:#a32d2d;line-height:1.5">
              <strong>⚠ Capacity oversold by ${c.oversold} seat${c.oversold===1?'':'s'}.</strong>
              After this charter, existing seat bookings (${c.seatsConsumed} pax) exceed remaining pool (${c.availAfter} seats). Dispatcher must <strong>move some bookings to another boat</strong> or <strong>add a rental boat</strong> in Boat Operation before this date.
            </div>
          ` : `
            <div style="background:#E1F5EE;border:1px solid #B8E5D2;border-radius:5px;padding:10px 13px;margin-bottom:14px;font-size:11px;color:#0F6E56;line-height:1.5">
              ✓ Remaining pool (${c.availAfter} seats) still covers existing bookings (${c.seatsConsumed} pax). Safe to charter.
            </div>
          `}

          <div style="font-size:9px;color:var(--ink-soft);font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">Affected bookings · ${c.affectedBookings.length}</div>
          <div style="background:#fafafa;border:1px solid var(--border);border-radius:5px;max-height:200px;overflow-y:auto">
            ${c.affectedBookings.length === 0 ? '<div style="padding:14px;text-align:center;color:var(--ink-soft);font-style:italic;font-size:11px">No existing bookings affected</div>' :
              c.affectedBookings.map(bk => `
                <div style="padding:8px 12px;border-bottom:1px solid #f5f3ef;display:flex;align-items:center;gap:10px;font-size:11px">
                  <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ink-soft);min-width:90px">${escapeHTML(bk.bookingId)}</div>
                  <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    <div style="font-weight:600;color:#1a1a1a" title="${escapeHTML(bk.customerName)}">${escapeHTML(bk.customerName)}</div>
                    <div style="font-size:10px;color:var(--ink-soft)">${escapeHTML(bk.agentName)} ${bk.voucherRef?'· '+escapeHTML(bk.voucherRef):''}</div>
                  </div>
                  <div style="font-family:Manrope,sans-serif;font-weight:700;font-size:13px;color:var(--bk-navy);font-variant-numeric:tabular-nums">${bk.pax} pax</div>
                  <div style="background:${bk.status==='confirmed'?'#E1F5EE':'#FFF6E5'};color:${bk.status==='confirmed'?'#0F6E56':'#A05A1A'};font-size:8px;padding:2px 6px;border-radius:3px;font-weight:700;letter-spacing:.04em">${escapeHTML(bk.status||'').toUpperCase()}</div>
                </div>
              `).join('')}
          </div>
        </div>
        <div style="padding:13px 22px;background:#fafafa;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
          <button onclick="bookingV2CancelCharterConfirm()" style="padding:8px 16px;font-size:12px;font-weight:600;background:transparent;border:1px solid rgba(0,0,0,.15);border-radius:5px;cursor:pointer;font-family:inherit;color:#5A5A52">Cancel</button>
          <button onclick="bookingV2ConfirmCharter()" style="padding:8px 16px;font-size:12px;font-weight:700;background:#6B289A;border:1px solid #6B289A;border-radius:5px;cursor:pointer;font-family:inherit;color:#fff">${isOversold ? 'Confirm anyway · Notify dispatcher' : 'Confirm charter'}</button>
        </div>
      </div>
    </div>
  `;
}
