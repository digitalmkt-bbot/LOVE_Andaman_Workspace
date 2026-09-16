// ── Document attachments (New Booking · B2B/agent) · files stored server-side, booking keeps only refs ──
function bookingV2AttachDraftId(){ return _bkV2.editingId || (_bkV2.newBooking && _bkV2.newBooking.code) || ''; }
