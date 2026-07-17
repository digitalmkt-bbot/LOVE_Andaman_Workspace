export const CT_DOC_SECTIONS = [
  { id: 'cover',       name: 'Cover Page',                    required: true,  defaultOn: true,  num: '01' },
  { id: 'parties',     name: 'Parties',                       required: true,  defaultOn: true,  num: '02' },
  { id: 'programs',    name: 'Programs in Contract',          required: false, defaultOn: true,  num: '03' },
  { id: 'pricing',     name: 'Pricing · Seat + Charter',      required: false, defaultOn: true,  num: '04' },
  { id: 'eligibility', name: 'Guest Eligibility · Important', required: true,  defaultOn: true,  num: '05' },
  { id: 'addons',      name: 'Add-on Services',               required: false, defaultOn: true,  num: '06' },
  { id: 'payment',     name: 'Payment Terms',                 required: false, defaultOn: true,  num: '07' },
  { id: 'booking',     name: 'Booking Channel',               required: false, defaultOn: true,  num: '08' },
  { id: 'cancel',      name: 'Cancellation Policy',           required: false, defaultOn: false, num: '09' },
  { id: 'custom',      name: 'Custom Clauses',                required: false, defaultOn: false, num: '10' },
  { id: 'signature',   name: 'Signature Page',                required: true,  defaultOn: true,  num: '11' },
];

export const PAGE_GROUPS = [
  { id: 'p1', sections: ['cover'] },
  { id: 'p2', sections: ['parties', 'programs'] },
  { id: 'p3', sections: ['pricing', 'eligibility'] },
  { id: 'p4', sections: ['addons', 'payment'] },
  { id: 'p5', sections: ['booking', 'cancel', 'custom'] },
  { id: 'p6', sections: ['signature'] },
];

export const SECTION_I18N_KEYS = {
  cover: 'docTitle', parties: 'parties', eligibility: 'eligibility',
  programs: 'programs', pricing: 'pricing', addons: 'addOns',
  payment: 'paymentTerms', booking: 'booking', cancel: 'cancelPolicy',
  custom: 'customClauses', signature: 'signature',
};
