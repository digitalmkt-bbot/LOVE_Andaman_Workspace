import React from 'react';

// ─── Editable text field ──────────────────────────────────────────────────────
// In edit mode: contenteditable with dashed outline. onBlur saves to overrides.
// Pass value=undefined to onOverride to revert to default.
export function EditableField({ fieldKey, defaultText, block = false, style = {}, editMode, overrides, onOverride }) {
  const value = (overrides && overrides[fieldKey] !== undefined) ? overrides[fieldKey] : (defaultText || '');
  const isOverridden = overrides && overrides[fieldKey] !== undefined;
  const Tag = block ? 'div' : 'span';

  if (!editMode) {
    return <Tag style={style} dangerouslySetInnerHTML={{ __html: String(value).replace(/\n/g, '<br>') }} />;
  }
  return (
    <>
      <Tag
        contentEditable
        suppressContentEditableWarning
        className="ct-doc-edit"
        style={{ ...style, display: block ? 'block' : undefined }}
        onBlur={e => onOverride(fieldKey, e.currentTarget.textContent)}
      >
        {value}
      </Tag>
      {isOverridden && (
        <button
          onClick={() => onOverride(fieldKey, undefined)}
          title="Revert to default"
          style={{ background: 'transparent', border: 'none', color: '#A32D2D', fontSize: '9.5px', cursor: 'pointer', marginLeft: 4, padding: 0, fontFamily: 'inherit' }}
        >↺</button>
      )}
    </>
  );
}

// ─── Cover ───────────────────────────────────────────────────────────────────
export function CoverSection({ a, T, fmt, editMode, overrides, onOverride }) {
  const ci = a.companyInfo || {};
  return (
    <div style={{ textAlign: 'center', padding: '36px 24px 28px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', color: '#5F5E5A', textTransform: 'uppercase' }}>
          <EditableField fieldKey="cover.kicker" defaultText={T('contractTitle')} editMode={editMode} overrides={overrides} onOverride={onOverride} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F1419', marginTop: 14 }}>
          <EditableField fieldKey="cover.title" defaultText={T('docTitle')} editMode={editMode} overrides={overrides} onOverride={onOverride} />
        </div>
        <div style={{ fontSize: 11, color: '#7a7770', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
          {T('version')} {a.contractVersion || '—'} · {T('effective')} {fmt(a.contractStart)} → {fmt(a.contractEnd)}
        </div>
      </div>
      <div style={{ margin: '8px auto', width: '60%', borderTop: '1px solid #C8C6BF' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 30, textAlign: 'left' }}>
        <div style={{ flex: 1, padding: '16px 18px', background: '#FAFAF6', border: '1px solid #E0DED8', borderRadius: 6 }}>
          <div style={{ fontSize: '9.5px', color: '#5F5E5A', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{T('between')}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419' }}>Love Island Co., Ltd.</div>
          <div style={{ fontSize: '10.5px', color: '#5F5E5A', marginTop: 5, lineHeight: 1.5 }}>
            9/239-240 Sakdidet Rd · T.Talat Nuea<br />A.Muang · Phuket 83000 · Thailand<br />TAT License No. 31/00986
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', alignSelf: 'center' }}>{T('and')}</div>
        <div style={{ flex: 1, padding: '16px 18px', background: '#FAFAF6', border: '1px solid #E0DED8', borderRadius: 6 }}>
          <div style={{ fontSize: '9.5px', color: '#5F5E5A', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{T('and')}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419' }}>{ci.legalName || a.name}</div>
          <div style={{ fontSize: '10.5px', color: '#5F5E5A', marginTop: 5, lineHeight: 1.5 }}>{ci.address || '—'}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#9b9590', marginTop: 18, fontStyle: 'italic', lineHeight: 1.6 }}>
        This agreement is made between the parties named above and is effective as of the date stated. Both parties agree to the terms set forth in the following pages.
      </div>
    </div>
  );
}

// ─── Parties ─────────────────────────────────────────────────────────────────
export function PartiesSection({ a, T, fmt, getSales }) {
  const ci = a.companyInfo || {};
  const sig = a.agentSignatory || {};
  const sales = getSales ? getSales(a.sales) : null;

  const Block = ({ title, children }) => (
    <div style={{ background: '#FAFAF6', border: '1px solid #E0DED8', borderRadius: 4, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#5F5E5A', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
  const Row = ({ label, value }) => (
    <div style={{ display: 'flex', gap: 14, fontSize: 11, lineHeight: 1.7 }}>
      <span style={{ minWidth: 120, color: '#7a7770' }}>{label}</span>
      <span style={{ color: '#0F1419', fontWeight: 500 }}>{value || '—'}</span>
    </div>
  );

  return (
    <>
      <Block title={`1. ${T('operator')}`}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginBottom: 6 }}>Love Island Co., Ltd.</div>
        <Row label={T('address')} value="9/239-240 Sakdidet Rd, T.Talat Nuea, A.Muang, Phuket 83000, Thailand" />
        <Row label={T('tatLicense')} value="31/00986" />
        <Row label={T('telephone')} value="076-390 250, 076-390 260" />
        <Row label="Hotline" value="088-765 4678, 081-970 9977" />
        <Row label="Fax" value="076-390 280" />
        <Row label={T('email')} value="book@loveandaman.com" />
        <Row label={T('website')} value="www.loveandaman.com" />
      </Block>
      <Block title={`2. ${T('agent')}`}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginBottom: 6 }}>{ci.legalName || a.name}</div>
        <Row label={T('address')} value={ci.address} />
        <Row label={T('tatLicense')} value={ci.tatLicense} />
        <Row label={T('telephone')} value={ci.tel} />
        <Row label={T('email')} value={a.email} />
        <Row label={T('website')} value={ci.website} />
      </Block>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
        <Block title={T('salesPerson')}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0F1419', marginBottom: 4 }}>{sales?.fullName || sales?.name || '—'}</div>
          <Row label={T('position')} value={sales?.designation} />
          <Row label={T('email')} value={sales?.email} />
          <Row label={T('telephone')} value={sales?.tel} />
        </Block>
        <Block title={T('agentSignatory')}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0F1419', marginBottom: 4 }}>{sig.name || '—'}</div>
          <Row label={T('position')} value={sig.designation} />
          <Row label={T('date')} value={fmt(sig.signedDate)} />
          <Row label={T('telephone')} value={sig.tel} />
        </Block>
      </div>
    </>
  );
}

// ─── Eligibility ─────────────────────────────────────────────────────────────
export function EligibilitySection({ T }) {
  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #E0DED8', borderRadius: 6, padding: '12px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ background: '#185FA5', color: '#fff', fontSize: '9.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 6, letterSpacing: '.05em' }}>5.1</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', letterSpacing: '-0.005em' }}>{T('childRateTitle')}</span>
        </div>
        <div style={{ fontSize: '11.5px', color: '#0F1419', lineHeight: 1.7, paddingLeft: 2 }}>{T('childRateBody')}</div>
      </div>
      <div style={{ background: '#FCEBEB', border: '1.5px solid #F5BCBC', borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ background: '#A32D2D', color: '#fff', fontSize: '9.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 6, letterSpacing: '.05em' }}>5.2</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', letterSpacing: '-0.005em' }}>{T('specialTitle')}</span>
        </div>
        <div style={{ background: '#fff', borderLeft: '4px solid #A8773B', borderRadius: 4, padding: '11px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ background: '#A8773B', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 5 }}>{T('notRecLabel')}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {T('notRecItems').map((item, i) => (
              <span key={i} style={{ background: '#FFF7E8', color: '#854F0B', fontSize: '12.5px', fontWeight: 700, padding: '6px 13px', borderRadius: 6, border: '1.5px solid #A8773B', letterSpacing: '.005em', lineHeight: 1.2 }}>{item}</span>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', borderLeft: '4px solid #A32D2D', borderRadius: 4, padding: '11px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ background: '#A32D2D', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 5 }}>⚠ {T('notAllowedLabel')}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {T('notAllowedItems').map((item, i) => (
              <span key={i} style={{ background: '#FDECEA', color: '#7A1E1E', fontSize: '12.5px', fontWeight: 700, padding: '6px 13px', borderRadius: 6, border: '1.5px solid #A32D2D', letterSpacing: '.005em', lineHeight: 1.2, textTransform: 'uppercase' }}>{item}</span>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', borderLeft: '3px solid #5F5E5A', borderRadius: 4, padding: '8px 12px' }}>
          <span style={{ background: '#F1EFE8', color: '#5F5E5A', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, marginRight: 8 }}>{T('foodAllergyLabel')}</span>
          <span style={{ fontSize: '11.5px', color: '#0F1419', lineHeight: 1.6 }}>{T('foodAllergyBody')}</span>
        </div>
      </div>
    </>
  );
}

// ─── Programs ────────────────────────────────────────────────────────────────
export function ProgramsSection({ a, rt, T, fmt, routes }) {
  const rvMap = rt ? (rt.routeValidity || {}) : {};
  const periods = (a.programPeriods || []).map(p => {
    const rv = rvMap[p.routeId];
    if (rv) return { ...p, travelFrom: rv.from || '', travelTo: rv.to || '' };
    if (rt) return { ...p, travelFrom: '', travelTo: '' };
    return p;
  });
  const rName = rId => (routes.find(r => r.id === rId) || {}).name || rId;
  const rPier = rId => {
    const r = routes.find(x => x.id === rId);
    return (r?.pier || '').toUpperCase().replace('TUBLAMU', 'Tub Lamu').replace('PANWA', 'Visit Panwa');
  };
  const cols = [T('program'), T('bookingPeriod'), T('travelPeriod'), T('notes')];

  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <colgroup>
          <col style={{ width: '34%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /><col />
        </colgroup>
        <thead>
          <tr>
            {cols.map((h, i) => (
              <th key={h} style={{ padding: i > 0 ? '6px 10px' : '6px 0', textAlign: 'left', fontSize: '9.5px', fontWeight: 700, color: '#5F5E5A', letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1.5px solid #1A2B43' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p, i) => (
            <tr key={i} style={{ borderTop: '1px solid #F2F0EA' }}>
              <td style={{ padding: '8px 0', fontSize: 11, fontWeight: 600, color: '#0F1419' }}>
                {rName(p.routeId)}
                <div style={{ fontSize: '9.5px', color: '#7a7770', fontWeight: 500, marginTop: 1 }}>{rPier(p.routeId)}</div>
              </td>
              <td style={{ padding: '8px 10px', fontSize: '10.5px', fontVariantNumeric: 'tabular-nums', color: '#5F5E5A' }}>{fmt(p.bookFrom)} → {fmt(p.bookTo)}</td>
              <td style={{ padding: '8px 10px', fontSize: '10.5px', fontVariantNumeric: 'tabular-nums', color: '#5F5E5A' }}>
                {p.travelFrom || p.travelTo
                  ? <>{fmt(p.travelFrom)} → {fmt(p.travelTo)}</>
                  : <span style={{ color: '#A32D2D' }}>{T('notSet')}</span>}
              </td>
              <td style={{ padding: '8px 0', fontSize: 10, color: '#5F5E5A', fontStyle: 'italic' }}>{p.note || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rt && <div style={{ marginTop: 10, fontSize: '9.5px', color: '#7a7770', fontStyle: 'italic' }}>⌗ {T('inheritFromRT')}: <strong>{rt.code} · {rt.name}</strong></div>}
    </>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────
export function PricingSection({ a, rt, T, routes }) {
  if (!rt) return <div style={{ padding: 30, textAlign: 'center', color: '#A32D2D', fontStyle: 'italic' }}>No Rate Type bound · cannot render pricing</div>;

  const rName = rId => (routes.find(r => r.id === rId) || {}).name || rId;
  const fmtN = n => (n || 0).toLocaleString();
  const TH_FG = '#143F73', FR_FG = '#854F0B';
  const agentRouteIds = (a.programPeriods || []).map(p => p.routeId).filter(Boolean);
  const ZONES = ['PK', 'KL', 'NoTransfer'];
  const PAX = ['adult-thai', 'child-thai', 'adult-fr', 'child-fr'];

  const seatData = [];
  (rt.routes || []).filter(rId => agentRouteIds.includes(rId)).forEach(rId => {
    const rr = rt.seatRates && rt.seatRates[rId];
    if (!rr) return;
    const presentZones = ZONES.filter(z => rr[z]);
    if (presentZones.length) seatData.push({ rId, zones: presentZones, rr });
  });

  const charterData = [];
  Object.keys(rt.charterRates || {}).filter(rId => agentRouteIds.includes(rId)).forEach(rId => {
    Object.keys(rt.charterRates[rId]).forEach(bt => charterData.push({ rId, bt, ch: rt.charterRates[rId][bt] }));
  });

  const thStyle = (align = 'left', extra = {}) => ({
    padding: '6px 10px', textAlign: align, fontSize: '9px', fontWeight: 700,
    color: '#5F5E5A', letterSpacing: '.06em', textTransform: 'uppercase',
    borderBottom: '1.5px solid #1A2B43', ...extra,
  });

  return (
    <>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#5F5E5A', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{T('seatRates')}</div>
      {seatData.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...thStyle(), verticalAlign: 'bottom', padding: '6px 0' }}>{T('route')}</th>
              <th rowSpan={2} style={{ ...thStyle(), verticalAlign: 'bottom' }}>{T('zone')}</th>
              <th colSpan={2} style={{ padding: '5px 10px', textAlign: 'center', fontSize: '9.5px', fontWeight: 700, color: TH_FG, letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: `1.5px solid ${TH_FG}` }}>{T('thai')}</th>
              <th colSpan={2} style={{ padding: '5px 10px', textAlign: 'center', fontSize: '9.5px', fontWeight: 700, color: FR_FG, letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: `1.5px solid ${FR_FG}`, borderLeft: '1px solid #F2F0EA' }}>{T('foreigner')}</th>
            </tr>
            <tr>
              <th style={{ padding: '4px 10px', textAlign: 'right', fontSize: '8.5px', fontWeight: 600, color: '#5F5E5A' }}>{T('adult')}</th>
              <th style={{ padding: '4px 18px 4px 10px', textAlign: 'right', fontSize: '8.5px', fontWeight: 600, color: '#5F5E5A' }}>{T('child')}</th>
              <th style={{ padding: '4px 10px', textAlign: 'right', fontSize: '8.5px', fontWeight: 600, color: '#5F5E5A', borderLeft: '1px solid #F2F0EA' }}>{T('adult')}</th>
              <th style={{ padding: '4px 10px', textAlign: 'right', fontSize: '8.5px', fontWeight: 600, color: '#5F5E5A' }}>{T('child')}</th>
            </tr>
          </thead>
          <tbody>
            {seatData.map(({ rId, zones, rr }) =>
              zones.map((z, idx) => (
                <tr key={`${rId}-${z}`} style={{ borderTop: idx === 0 ? '1px solid #E0DED8' : '1px solid #F2F0EA' }}>
                  {idx === 0 && (
                    <td rowSpan={zones.length} style={{ padding: '8px 12px 8px 0', verticalAlign: 'top', fontSize: 11, fontWeight: 600, color: '#0F1419', lineHeight: 1.3 }}>{rName(rId)}</td>
                  )}
                  <td style={{ padding: '5px 10px', fontSize: '9.5px', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{z === 'NoTransfer' ? 'No tr.' : z}</td>
                  {PAX.map((p, pi) => (
                    <td key={p} style={{ padding: pi === 1 ? '5px 18px 5px 10px' : '5px 10px', textAlign: 'right', fontSize: '10.5px', fontVariantNumeric: 'tabular-nums', color: '#0F1419' }}>
                      {fmtN(rr[z] && rr[z][p])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 11, color: '#9b9590', fontStyle: 'italic', padding: '8px 0' }}>No seat rates in this rate type</div>
      )}

      {charterData.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#5F5E5A', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>{T('charterRates')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle('left', { padding: '6px 0' })}>{T('route')}</th>
                <th style={thStyle()}>{T('vessel')}</th>
                <th style={thStyle('right')}>{T('starterPrice')}</th>
                <th style={thStyle('right')}>{T('includes')}</th>
                <th style={thStyle('right', { padding: '6px 0' })}>{T('marginal')}</th>
              </tr>
            </thead>
            <tbody>
              {charterData.map(({ rId, bt, ch }, i) => (
                <tr key={i} style={{ borderTop: '1px solid #F2F0EA' }}>
                  <td style={{ padding: '7px 0', fontSize: 11, fontWeight: 500, color: '#0F1419' }}>{rName(rId)}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: '#5F5E5A', textTransform: 'capitalize' }}>{bt}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: '#0F1419' }}>{fmtN(ch.starterPrice)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 10, fontVariantNumeric: 'tabular-nums', color: '#5F5E5A' }}>{ch.starterIncludes || 4} pax</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', fontSize: '10.5px', fontVariantNumeric: 'tabular-nums', color: '#0F1419' }}>+{fmtN(ch.extraPerPax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div style={{ marginTop: 10, fontSize: '9.5px', color: '#7a7770', fontStyle: 'italic' }}>⌗ Sourced from Rate Type · <strong>{rt.code} · {rt.name}</strong></div>
    </>
  );
}

// ─── AddOns ──────────────────────────────────────────────────────────────────
// addonDefs mirrors RT_ADDON_DEFS from allotment_v2: each entry with a
// .contract(rt, ctx) function that returns an HTML string.
export function AddOnsSection({ rt, T, routes, addonDefs = [] }) {
  if (!rt) return <div style={{ padding: 20, textAlign: 'center', color: '#9b9590', fontStyle: 'italic' }}>No Rate Type bound</div>;
  const rName = rId => (routes.find(r => r.id === rId) || {}).name || rId;
  const fmtN = n => (n || 0).toLocaleString();
  const ctx = { T, fmtN, rName };
  const html = addonDefs.filter(d => d.contract).map(d => d.contract(rt, ctx)).filter(Boolean).join('');
  if (!html) return <div style={{ padding: 20, color: '#9b9590', fontStyle: 'italic', textAlign: 'center' }}>No add-ons in this rate type</div>;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Payment ─────────────────────────────────────────────────────────────────
export function PaymentSection({ a, lang, T, editMode, overrides, onOverride }) {
  const payLbl = { invoice: 'Invoice (Credit)', cot: 'Cash on Tour', proforma: 'Proforma Invoice' }[a.payType] || a.payType || '—';
  const Row = ({ label, value }) => (
    <tr style={{ borderTop: '1px solid #F2F0EA' }}>
      <td style={{ padding: '9px 0', fontSize: 11, color: '#5F5E5A' }}>{label}</td>
      <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: '11.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#0F1419' }}>{value}</td>
    </tr>
  );
  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          <Row label={T('paymentMethod')} value={payLbl} />
          <Row label={T('creditDays')} value={(a.creditDays || 0) + ' days'} />
          <Row label={T('creditLimit')} value={'฿' + (a.creditLimit || 0).toLocaleString()} />
          <Row label={T('latePayment')} value="15% p.a. + ฿1,000/month reminder fee" />
          <Row label="Credit card surcharge" value="3% (customer pays)" />
        </tbody>
      </table>
      <div style={{ background: '#F4F8FB', borderLeft: '3px solid #185FA5', borderRadius: 4, padding: '10px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#185FA5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 5 }}>Bank transfer details</div>
        <div style={{ fontSize: 11, color: '#0F1419', lineHeight: 1.55 }}>
          <strong>Kasikorn Bank</strong> · Lotus Chaofa Branch{lang === 'th' ? ' · สาขาโลตัส เจ้าฟ้า' : ''}<br />
          Account name: <strong>Love Island Co., Ltd.</strong><br />
          Account number: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>574-2-18462-7</strong>
        </div>
      </div>
      <EditableField
        fieldKey="payment.note"
        defaultText={T('paymentNote')}
        block
        style={{ fontSize: '10.5px', color: '#5F5E5A', lineHeight: 1.7 }}
        editMode={editMode}
        overrides={overrides}
        onOverride={onOverride}
      />
    </>
  );
}

// ─── Booking ─────────────────────────────────────────────────────────────────
export function BookingSection({ a, lang, T }) {
  const bc = a.bookingChannel || {};
  const Row = ({ label, value }) => (
    <tr style={{ borderTop: '1px solid #F2F0EA' }}>
      <td style={{ padding: '9px 0', fontSize: 11, color: '#5F5E5A', width: '36%' }}>{label}</td>
      <td style={{ padding: '9px 10px', fontSize: '11.5px', color: '#0F1419', fontWeight: 500 }}>{value || '—'}</td>
    </tr>
  );
  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          <Row label={T('bookingMethod')} value={bc.method || 'Email + Phone'} />
          <Row label={T('cutoff')} value={bc.cutoff || '1 day in advance · before 18:00'} />
          <Row label={T('bookingEmail')} value={bc.email || 'book@loveandaman.com'} />
          <Row label={T('bookingPhone')} value={bc.phone || '+66 88 765 4678, +66 81 970 9977'} />
        </tbody>
      </table>
      <div style={{ fontSize: '10.5px', color: '#5F5E5A', lineHeight: 1.7 }}>
        {lang === 'th'
          ? 'ตัวแทนจำหน่ายต้องติดต่อแผนกรับจองล่วงหน้าเพื่อทำการจองโดยใช้เอกสารการจองของตัวแทนพร้อมรายละเอียดส่งไปยังช่องทางการจองข้างต้น · การจองทุกรายการต้องแจ้งล่วงหน้าอย่างน้อย 1 วัน ก่อน 18:00 น.'
          : '"Agent" must contact reservation office to make a booking in advance and submit its voucher(s) and details via Love Andaman booking channel listed above. All bookings need to be submitted at least 1 day in advance before 18:00.'}
      </div>
    </>
  );
}

// ─── Cancel ──────────────────────────────────────────────────────────────────
export function CancelSection({ a, lang, T, editMode, overrides, onOverride }) {
  const bc = a.bookingChannel || {};
  const defaultText = lang === 'th'
    ? 'กรณียกเลิกทริปต้องแจ้งเป็นลายลักษณ์อักษรก่อน 1 วันล่วงหน้า · กรณีการแจ้งน้อยกว่า 1 วัน บริษัทจะคิดราคาค่าทัวร์จำนวน 50 เปอร์เซ็นต์ · บริษัทคิดราคาเต็มจำนวนสำหรับลูกค้าที่ยกเลิกในวันเดินทาง (No-show)'
    : 'Cancellation & No-show policy: one (1) day cancellation notice is required. Any cancellation less than one day will incur a 50% cancellation fee. Full charge will be imposed for No-show.';
  return (
    <>
      <EditableField
        fieldKey="cancel.body"
        defaultText={bc.cancelPolicy || defaultText}
        block
        style={{ fontSize: '11.5px', color: '#0F1419', lineHeight: 1.7, marginBottom: 12 }}
        editMode={editMode}
        overrides={overrides}
        onOverride={onOverride}
      />
      <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.7, padding: '10px 14px', background: '#FFF5EB', borderLeft: '3px solid #854F0B', borderRadius: 4 }}>
        {lang === 'th'
          ? <><strong>Compensation:</strong> ในกรณีลูกค้ายังไม่ได้จ่ายเงินเต็มจำนวน บริษัทจะปรับเงินเต็มจำนวนโดยการเก็บเงินที่เหลือจากผู้ขาย หรือหักจากค่าคอมมิชชั่นของผู้ขายโดยตรง</>
          : <><strong>Compensation:</strong> In case that the guest(s) do not make full payment due to "No-show" or other reasons, the company will charge the balance or deduct commission directly to the agent.</>}
      </div>
    </>
  );
}

// ─── Custom ───────────────────────────────────────────────────────────────────
function standardClauses(lang) {
  return lang === 'th' ? [
    { title: '1. อายุเด็ก', body: 'เด็ก หมายถึง ผู้ที่มีอายุระหว่าง 4-11 ปี · ราคาในตารางคิดในอัตราเด็ก' },
    { title: '2. ข้อพิจารณาพิเศษ', body: 'เด็กอายุต่ำกว่า 1 ปี · ผู้สูงอายุมากกว่า 65 ปี · สัตว์เลี้ยง ไม่แนะนำให้เดินทาง · ลูกค้าที่เป็นโรคความดันโลหิตสูง โรคหัวใจ ตั้งครรภ์ บริษัทไม่อนุญาตให้เดินทาง' },
    { title: '3. การคืนเงินกรณีบริษัทยกเลิกทริป', body: 'กรณีบริษัทยกเลิกเนื่องจากสภาพอากาศ บริษัทจะคืนเงินเต็มจำนวนสำหรับทริปนั้น' },
    { title: '4. ราคาขึ้นกับปัจจัย', body: 'ราคาอาจมีการเปลี่ยนแปลงขึ้นอยู่กับปัจจัยด้านราคาน้ำมัน' },
    { title: '5. ความลับของสัญญา', body: 'ราคาในสัญญาฉบับนี้เป็นเอกสารลับระหว่างคู่สัญญา · ไม่สามารถเปิดเผยต่อบุคคลภายนอกได้' },
    { title: '6. การยอมรับสัญญา', body: 'กรุณาเซ็นและส่งสำเนากลับมาภายใน 15 วัน นับจากวันได้รับสัญญา' },
  ] : [
    { title: '1. Children Rates', body: 'Children between 4-11 years old are charged a child rate as listed in the pricing tables above.' },
    { title: '2. Special Consideration', body: 'Infants under 1 year, elderly over 65, and pets are not recommended. Guests with high blood pressure, heart disease, pregnancy, asthma, or bone/orthopedic conditions are not allowed.' },
    { title: '3. Company Cancellation Refund', body: 'The Company may cancel due to bad weather or urgent reasons with 100% refund for the day trip only.' },
    { title: '4. Pricing Adjustment', body: 'Prices are subject to change based on fuel price and other related expenses.' },
    { title: '5. Confidentiality', body: 'The rates stated in this agreement are confidential and shall not be disclosed to any third parties.' },
    { title: '6. Acceptance', body: 'Kindly sign and return a duplicated copy of this offer within 15 days from the date of this offer.' },
  ];
}

export function CustomSection({ lang, T, editMode, customClauses, onCustomClausesChange }) {
  const addClause = () => {
    const id = 'cl_' + Date.now();
    onCustomClausesChange([...customClauses, { id, title: 'New clause', body: '' }]);
  };
  const removeClause = id => onCustomClausesChange(customClauses.filter(c => c.id !== id));
  const setField = (id, field, value) => onCustomClausesChange(customClauses.map(c => c.id === id ? { ...c, [field]: value } : c));
  const fillStandard = () => onCustomClausesChange(standardClauses(lang).map((c, i) => ({ id: 'std_' + i, ...c })));

  if (!customClauses.length) {
    return editMode ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="ct-doc-add-clause" onClick={addClause} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><path d="M12 5v14M5 12h14" /></svg>
          Add a custom clause
        </button>
        <button className="ct-doc-add-clause" onClick={fillStandard} type="button" style={{ borderStyle: 'solid', borderColor: '#185FA5', color: '#185FA5', background: '#F4F8FB' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
          Fill with standard clauses
        </button>
      </div>
    ) : (
      <div style={{ padding: 20, background: '#FAFAF6', border: '1px dashed #C8C6BF', borderRadius: 4, color: '#9b9590', fontStyle: 'italic', textAlign: 'center', fontSize: 11 }}>{T('customDefault')}</div>
    );
  }

  return (
    <>
      {customClauses.map((c, i) => (
        <div key={c.id} className="ct-doc-clause-card">
          {editMode && <button className="ct-doc-clause-rm" onClick={() => removeClause(c.id)} type="button" title="Remove">✕</button>}
          {editMode ? (
            <>
              <div contentEditable suppressContentEditableWarning className="ct-doc-edit"
                style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F1419', marginBottom: 6, paddingRight: 24 }}
                onBlur={e => setField(c.id, 'title', e.currentTarget.textContent)}>{c.title}</div>
              <div contentEditable suppressContentEditableWarning className="ct-doc-edit"
                style={{ fontSize: 11, color: '#0F1419', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                onBlur={e => setField(c.id, 'body', e.currentTarget.textContent)}>{c.body}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F1419', marginBottom: 6 }}>{i + 1}. {c.title}</div>
              <div style={{ fontSize: 11, color: '#0F1419', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.body}</div>
            </>
          )}
        </div>
      ))}
      {editMode && (
        <button className="ct-doc-add-clause" onClick={addClause} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><path d="M12 5v14M5 12h14" /></svg>
          Add another clause
        </button>
      )}
    </>
  );
}

// ─── Signature ───────────────────────────────────────────────────────────────
export function SignatureSection({ a, T, fmt, getSales }) {
  const sig = a.agentSignatory || {};
  const sales = getSales ? getSales(a.sales) : null;

  const Block = ({ titleParty, name, position, date }) => (
    <div style={{ background: '#FAFAF6', border: '1px solid #E0DED8', borderRadius: 4, padding: '18px 20px' }}>
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#5F5E5A', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 32 }}>{T('signedFor')} {titleParty}</div>
      <div style={{ borderBottom: '1px solid #5F5E5A', height: 36, marginBottom: 8 }} />
      <div style={{ fontSize: '9.5px', color: '#7a7770', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>{T('signature_x')}</div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: '#5F5E5A' }}>{T('name')}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F1419', marginTop: 1 }}>{name || '—'}</div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, color: '#5F5E5A' }}>{T('position')}</div>
        <div style={{ fontSize: '11.5px', color: '#0F1419', marginTop: 1 }}>{position || '—'}</div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, color: '#5F5E5A' }}>{T('date')}</div>
        <div style={{ fontSize: '11.5px', fontVariantNumeric: 'tabular-nums', color: '#0F1419', marginTop: 1 }}>{date || '__ / __ / ____'}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, paddingTop: 8 }}>
      <Block titleParty="Love Andaman" name={sales?.fullName || sales?.name} position={sales?.designation} date="" />
      <Block titleParty={a.companyInfo?.legalName || a.name} name={sig.name} position={sig.designation} date={fmt(sig.signedDate)} />
    </div>
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
export function SectionBody({ sId, ...props }) {
  switch (sId) {
    case 'cover':       return <CoverSection {...props} />;
    case 'parties':     return <PartiesSection {...props} />;
    case 'eligibility': return <EligibilitySection {...props} />;
    case 'programs':    return <ProgramsSection {...props} />;
    case 'pricing':     return <PricingSection {...props} />;
    case 'addons':      return <AddOnsSection {...props} />;
    case 'payment':     return <PaymentSection {...props} />;
    case 'booking':     return <BookingSection {...props} />;
    case 'cancel':      return <CancelSection {...props} />;
    case 'custom':      return <CustomSection {...props} />;
    case 'signature':   return <SignatureSection {...props} />;
    default:            return null;
  }
}
