// P2 · New Booking form handlers
function bookingV2NewBooking(){
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  _bkV2.newBooking = {
    code: bookingV2GenerateBookingCode(),
    bookingDate: new Date().toISOString().slice(0,10),   // วันที่จอง · default = วันนี้ · editable
    createdBy: '',              // Submitted by · keyed manually (NOT auto)
    confirmedBy: bookingV2LoginUser(), // Confirmed by · auto = logged-in user from the start (editable)
    voucherRef: '',             // agent's voucher reference (optional · e.g. 'AT-VC-25060042')
    soldBy: '',                 // salesperson credited (override · for walk-in/direct sales · blank = derive from agent.sales)
    priceMode: 'rate',          // 'rate' (from Rate Type) | 'manual' (free-style · type total · walk-in)
    manualTotal: 0,             // used when priceMode==='manual'
    staffId: '',                // staff member (when agent = Staff/Welfare house account)
    staffPurpose: 'welfare',    // 'welfare' (uses yearly quota) | 'inspection' (no quota · counts seat)
    agentId: null,
    rateTypeRef: null,
    leadPax: '',
    leadPhone: '',
    leadEmail: '',
    leadNationality: '',        // ISO-like 2-letter code · matches BKV2_NATIONALITIES
    passengers: [],             // [{ name, nationality }] · rows = total AD pax across trips (excluding lead)
    pickupAreaId: null,         // derived zone from area
    pickupSelf: false,          // ขารับ · ลูกค้ามาเองที่ท่าเรือ (self-arrive) · เก็บเรทเต็ม · ไม่มีรถไปรับใน ① ขาไป
    pickupZoneFilter: 'PK',     // current zone selection · filters pickup area dropdown
    hotelName: '',              // hotel name + room
    roomNumber: '',
    dropoffSame: true,          // most cases yes
    dropoffAreaId: null,        // only if dropoffSame === false
    dropoffHotelName: '',       // drop-off location text (when separate)
    altPickups: [],             // §altPickups · [{who, place}] · บางคนในบุคกิ้งรับคนละที่
    guides: { english:false, russian:false, chinese:false, otherLang:'' },
    notes: '',
    specialMeals: { veg:0, vegan:0, halal:0, allergies:'', allergyList:[] },
    largeLuggage: 0,
    cashOnTour: null,           // null = none; { amount, currency, handling:'deduct'|'separate' }
    trips: [bookingV2NewTrip()],
    addOns: [],
    adjustments: [],           // [{kind:'discount'|'extra', mode:'amount'|'percent', value, label, note}]
    focReason: '',
    createdAt: new Date().toISOString()
  };
  bookingV2Render();
}
