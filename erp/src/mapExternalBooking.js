'use strict';
// mapExternalBooking.js
// Converts an external platform booking into the internal SB_BOOKINGS shape.
// hotel / third_party items are logged as notes — no native equivalent yet.

const STATUS_MAP = {
  confirmed: 'confirmed',
  pending:   'pending',
  cancelled: 'cancelled',
};

const PAY_MAP = {
  'PM-CASH':     'cash',
  'PM-TRANSFER': 'transfer',
  'PM-CARD':     'card',
  'PM-QR':       'qr',
};

function newId() {
  return 'BK-W' + Date.now().toString(36).toUpperCase();
}

/**
 * Distribute paxThai / paxForeign across adult → child → infant buckets.
 * Returns { adTh, adFr, chdTh, chdFr, infTh, infFr }
 */
function splitThaiForeign(paxAdult, paxChild, paxInfant, paxThai) {
  let thLeft = paxThai || 0;
  const adTh  = Math.min(paxAdult,  thLeft); thLeft -= adTh;
  const chdTh = Math.min(paxChild,  thLeft); thLeft -= chdTh;
  const infTh = Math.min(paxInfant, thLeft);
  return {
    adTh,  adFr:  paxAdult  - adTh,
    chdTh, chdFr: paxChild  - chdTh,
    infTh, infFr: paxInfant - infTh,
  };
}

function mapDayTrip(item, fallbackDate) {
  const adult  = item.paxAdult  || 0;
  const child  = item.paxChild  || 0;
  const infant = item.paxInfant || 0;
  const foc    = item.paxFoc    || 0;
  const { adTh, adFr, chdTh, chdFr, infTh, infFr } =
    splitThaiForeign(adult, child, infant, item.paxThai || 0);

  const trip = {
    routeId:     item.programId,
    date:        item.travelDate || fallbackDate,
    zone:        'PK',
    pax: {
      ad_fr: adFr,  ad_th: adTh,
      chd_fr: chdFr, chd_th: chdTh,
      inf_fr: infFr, inf_th: infTh,
      foc_fr: foc,   foc_th: 0,
    },
    pickupTime:  '',
    bookingMode: 'seat',
    subtotal:    0,
    seatSource:  { locked: 0, general: adult + child + infant + foc },
    lockDraws:   [],
  };

  const addOns = (item.addonsSelected || []).map(ao => ({
    type:   ao.addonId,
    label:  ao.addonId,
    amount: 0,
    qty:    ao.qty || 1,
  }));

  return { trip, addOns };
}

/**
 * @param {object} ext  — raw external booking object
 * @returns {object}    — internal SB_BOOKINGS record
 */
function mapExternalBooking(ext) {
  const now  = new Date().toISOString();
  const trips  = [];
  const addOns = [];
  const skipped = [];

  for (const item of (ext.items || [])) {
    if (item.type === 'day_trip') {
      const { trip, addOns: aos } = mapDayTrip(item, ext.travelDate);
      trips.push(trip);
      addOns.push(...aos);
    } else {
      // hotel / third_party — no native equivalent; surface in notes
      skipped.push(item.type);
    }
  }

  const noteParts = [ext.remark || ''];
  if (skipped.length) noteParts.push('[webhook] unsupported items: ' + skipped.join(', '));

  return {
    id:            newId(),
    schemaVer:     2,
    createdAt:     ext.createdAt || now,
    createdBy:     'webhook',
    voucherRef:    ext.id,                          // preserve external ID
    agentId:       ext.channelId || '',
    rateTypeRef:   '',
    leadPax:       ext.customer?.name        || '',
    leadNationality: ext.customer?.nationality || '',
    leadType:      'AD',
    leadFoc:       false,
    leadPhone:     ext.customer?.phone       || '',
    leadEmail:     ext.customer?.email       || '',
    pickupAreaId:  '',
    pickupSelf:    false,
    pickupArea:    '',
    pickupZone:    'PK',
    hotelName:     '',
    roomNumber:    '',
    dropoffSame:   true,
    guides:        { english: false, russian: false, chinese: false, otherLang: '' },
    notes:         noteParts.filter(Boolean).join('\n'),
    specialMeals:  { veg: 0, vegan: 0, halal: 0, allergies: '', allergyList: [] },
    largeLuggage:  0,
    cashOnTour:    null,
    paymentSnapshot: {
      method: PAY_MAP[ext.paymentMethod] || ext.paymentMethod || '',
      source: 'webhook',
    },
    priceBreakdown: {
      seat:        ext.subtotal           || 0,
      addOn:       0,
      focDiscount: 0,
      discount:    ext.discount?.amount   || 0,
      extra:       ext.surcharge?.amount  || 0,
      total:       ext.total              || 0,
    },
    status:        STATUS_MAP[ext.status] || ext.status || 'confirmed',
    total:         ext.total              || 0,
    bookingDate:   (ext.createdAt || now).slice(0, 10),
    marketSnapshot: {
      market:   ext.channelId   || '',
      sub:      ext.channelName || '',
      agentId:  ext.channelId   || '',
      at:       now,
    },
    trips,
    addOns,
    passengers: (ext.passengers || []).map(p => ({
      name:        p.name        || '',
      nationality: p.nationality || '',
      type:        'AD',
      foc:         false,
    })),
    adjustments:    [],
    history: [{
      at:   now,
      kind: 'created',
      text: `Imported from ${ext.channelName || ext.channelId || 'external'} · ref ${ext.id}`,
      tag:  'Created',
      by:   'webhook',
    }],
    upgrades:       [],
    feeItems:       [],
    partialCancels: [],
  };
}

module.exports = { mapExternalBooking };
