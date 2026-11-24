/* ══════════════════════════════════════════════════════════════════════════
   §pickupOneParser (2026-11-24) · the one reader of a typed pickup text
   ──────────────────────────────────────────────────────────────────────────
   Legacy keeps a pickup as one text, filled from the pickup-area table (bookingV2GetPickupTime) or typed by the
   dispatcher; operation-backend keeps it as three fields (migration 024): pickup_time, pickup_time_end,
   pickup_at_pier. This file is the only place that reads the text and joins the fields back, so every adapter
   splits and shows a pickup the same way. 00-ops-core.js exposes it as laOps.clock / laOps.pickupWindow /
   laOps.pickupText; 40-ops-bookings.js uses it for a trip's and a final pickup. It has no dependencies, so a unit
   test that loads 40-ops-bookings.js without the core loads this file first.

   Shapes (the same as the server's importer, operation-backend src/tools/legacy-pickup.ts):
     '07:30', '7:30', '07.30', '07:30:00', '08.00 a.m.', '1:30 p.m.' → one time
     '07:30-07:45' (or '–', or '+' typed for '-')                    → a window
     '08:20-'                                                          → a window with no end yet: its start
     'Before 08:30 at pier'                                            → a pier deadline
   and legacy's typing slips: '07.40 a.m..' (a doubled dot), '04:00 s.m.' (s beside a). */
(function(){
  'use strict';
  var CLOCK_RE = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([as]\.?m\.{0,2}|p\.?m\.{0,2})?$/i;
  /* One typed time of day as HH:MM; '' for an empty text (clear); null for anything else (a window, a pier
     deadline, a half-typed '07:', text). */
  function clock(text){
    var t = String(text == null ? '' : text).trim(), m;
    if(!t) return '';
    if(!(m = CLOCK_RE.exec(t))) return null;
    var h = Number(m[1]), min = Number(m[2]);
    if(m[3]){ if(h < 1 || h > 12) return null; h = /^p/i.test(m[3]) ? (h % 12) + 12 : h % 12; }
    if(h > 23 || min > 59) return null;
    return String(h).padStart(2, '0') + ':' + m[2];
  }
  /* A typed pickup as the three fields: {pickupTime}, {pickupTime, pickupTimeEnd}, {pickupTimeEnd, pickupAtPier};
     {} for no pickup; null when the text is none of legacy's shapes (a half-typed '07:15-0' included) or a window
     ends at or before its start. */
  function pickupWindow(text){
    var t = String(text == null ? '' : text).trim(), m, s, e;
    if(!t) return {};
    if((s = clock(t))) return { pickupTime: s };
    if((m = /^before\s+(.+?)\s+at\s+(?:the\s+)?pier$/i.exec(t))){ e = clock(m[1]); return e ? { pickupTimeEnd: e, pickupAtPier: true } : null; }
    if((m = /^(.+?)\s*[-–+]\s*(.*)$/.exec(t))){
      s = clock(m[1]); if(!s) return null;
      if(!m[2]) return { pickupTime: s };
      e = clock(m[2]); return e && e > s ? { pickupTime: s, pickupTimeEnd: e } : null;
    }
    return null;
  }
  /* The three fields as legacy's text: '07:30', '07:15-07:30', 'Before 08:30 at pier'; '' with none. */
  function pickupText(start, end, atPier){
    if(atPier && end) return 'Before ' + end + ' at pier';
    if(start && end) return start + '-' + end;
    return start || '';
  }
  window.laOpsPickup = { clock: clock, pickupWindow: pickupWindow, pickupText: pickupText };
})();
