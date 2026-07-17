import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ContractWizard.css';
import { CT_DOC_SECTIONS, PAGE_GROUPS, SECTION_I18N_KEYS } from './contractConstants';
import { ctDocT, ctDocFmtDate } from './contractI18n';
import { SectionBody } from './ContractSections';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sectionMeta(sId, a, rt) {
  switch (sId) {
    case 'cover':       return { sub: 'Title page · letterhead + version' };
    case 'parties':     return { sub: `Operator · Agent (${a.code || a.name})` };
    case 'eligibility': return { sub: 'Children rate · Health restrictions', tag: 'warning' };
    case 'programs':    return { sub: `${(a.programPeriods || []).length} routes`, tag: 'from contract' };
    case 'pricing':     return { sub: rt ? `from ${rt.code}` : 'no rate type bound', tag: rt ? 'from RT' : '' };
    case 'addons':      return { sub: rt && Object.keys(rt.addOns || {}).length ? `${Object.keys(rt.addOns).length} services` : '—', tag: rt ? 'from RT' : '' };
    case 'payment':     return { sub: a.payType ? `${a.payType.toUpperCase()} · credit ${a.creditDays || 0}d` : '—' };
    case 'booking':     return { sub: 'method · cutoff · cancel' };
    case 'cancel':      return { sub: 'optional clause' };
    case 'custom':      return { sub: 'free-form additions' };
    case 'signature':   return { sub: 'sales person + agent signatory' };
    default:            return { sub: '' };
  }
}

function countPages(sections) {
  const ids = new Set(Object.keys(sections).filter(k => sections[k]));
  return PAGE_GROUPS.filter(g => g.sections.some(s => ids.has(s))).length;
}

function cleanFilename(s) {
  return (s || '').replace(/[^A-Za-z0-9฀-๿._-]+/g, '_').replace(/^_+|_+$/g, '');
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * ContractWizard — standalone React contract generator.
 *
 * Props:
 *   agent          {object}   required — agent record (id, name, code, companyInfo, rateTypeId, ...)
 *   rateType       {object}   required — rate type record (code, name, seatRates, charterRates, addOns, ...)
 *   routes         {array}    [{id, name, pier}] — list of all routes
 *   addonDefs      {array}    optional — mirrors RT_ADDON_DEFS; each entry with .contract(rt, ctx) → html string
 *   getSales       {function} optional — (salesId) => sales object for parties/signature sections
 *   onClose        {function} called when the user closes the wizard
 *   onArtifactSave {function} optional — (artifact) => void  called after Export PDF with the artifact object
 */
export default function ContractWizard({ agent, rateType, routes = [], addonDefs = [], getSales, onClose, onArtifactSave }) {
  const [lang, setLang] = useState('en');
  const [sections, setSections] = useState(() => {
    const s = {};
    CT_DOC_SECTIONS.forEach(sec => { s[sec.id] = sec.required || sec.defaultOn; });
    return s;
  });
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [customClauses, setCustomClauses] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const T = useCallback(k => ctDocT(k, lang), [lang]);
  const fmt = useCallback(iso => ctDocFmtDate(iso, lang), [lang]);

  const showToast = msg => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const toggleSection = sId => {
    if (CT_DOC_SECTIONS.find(s => s.id === sId)?.required) return;
    setSections(prev => ({ ...prev, [sId]: !prev[sId] }));
  };

  const handleOverride = (key, value) => {
    setOverrides(prev => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  // Build visible page groups from enabled sections
  const enabledIds = new Set(Object.keys(sections).filter(k => sections[k]));
  const visibleGroups = PAGE_GROUPS
    .map(g => ({ ...g, sections: g.sections.filter(s => enabledIds.has(s)) }))
    .filter(g => g.sections.length > 0);
  const totalPages = visibleGroups.length;

  // Print/PDF — uses body class trick so @media print CSS can target the modal
  // The modal is rendered via createPortal as a direct body child, so the
  // CSS selector `body.ct-doc-printing > *:not(#ct-doc-modal)` works correctly.
  const printFlow = setupFn => {
    document.body.classList.add('ct-doc-printing');
    const cleanup = setupFn ? setupFn() : null;
    const restore = () => {
      document.body.classList.remove('ct-doc-printing');
      if (typeof cleanup === 'function') cleanup();
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    setTimeout(() => window.print(), 80);
  };

  const handleExportPDF = () => {
    const fname = `Contract_${cleanFilename(agent.code || agent.name)}_${cleanFilename(agent.contractVersion || 'draft')}.pdf`;
    showToast(`Choose "Save as PDF" · Suggested filename: ${fname}`);
    printFlow(() => {
      const origTitle = document.title;
      document.title = fname.replace(/\.pdf$/, '');
      return () => {
        document.title = origTitle;
        const artifact = {
          id: 'gc_' + Date.now(),
          version: agent.contractVersion || 'draft',
          generatedAt: new Date().toISOString(),
          lang,
          sections: { ...sections },
          overrides: { ...overrides },
          customClauses: [...customClauses],
          rateTypeRef: rateType ? rateType.code : null,
          rateTypeName: rateType ? rateType.name : null,
          pageCount: countPages(sections),
        };
        if (onArtifactSave) onArtifactSave(artifact);
        showToast(`✓ Contract saved to history · ${agent.code} ${agent.contractVersion}`);
      };
    });
  };

  // Shared props passed to every section component
  const sectionProps = {
    a: agent,
    rt: rateType,
    lang,
    T,
    fmt,
    routes,
    addonDefs,
    getSales,
    editMode,
    overrides,
    onOverride: handleOverride,
    customClauses,
    onCustomClausesChange: setCustomClauses,
  };

  const enabledCount = CT_DOC_SECTIONS.filter(s => sections[s.id]).length;
  const navy = '#1A2B43';
  const navySoft = '#A3B7D6';

  const modal = (
    <div id="ct-doc-modal" className="ct-doc-modal">
      <div className="ct-doc-backdrop" onClick={onClose} />
      <div className="ct-doc-card">

        {/* ── Header ── */}
        <div className="ct-doc-hd">
          <div className="ct-doc-hd-l">
            <div className="ct-doc-hd-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ct-doc-hd-ttl">Contract Document · {agent.name}</div>
              <div className="ct-doc-hd-sub">
                {agent.contractVersion || 'v—'} · {rateType ? `Rate Type ${rateType.code}` : 'no rate type'} · {agent.code || ''}
              </div>
            </div>
          </div>
          <div className="ct-doc-hd-actions">
            <button
              className="ct-doc-act"
              onClick={() => setEditMode(e => !e)}
              type="button"
              style={editMode ? { background: '#FFF5EB', color: '#854F0B', borderColor: '#F5C896', fontWeight: 700 } : {}}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}>
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {editMode ? 'Edit mode: ON' : 'Edit text'}
            </button>
            <div className="ct-doc-lang">
              <button className={`ct-doc-lang-btn${lang === 'en' ? ' on' : ''}`} onClick={() => setLang('en')} type="button">🇬🇧 English</button>
              <button className={`ct-doc-lang-btn${lang === 'th' ? ' on' : ''}`} onClick={() => setLang('th')} type="button">🇹🇭 Thai</button>
            </div>
            <button className="ct-doc-act" onClick={() => printFlow()} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}>
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print preview
            </button>
            <button className="ct-doc-act primary" onClick={handleExportPDF} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Export PDF
            </button>
            <button className="ct-doc-x" onClick={onClose} type="button" title="Close">✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="ct-doc-body">

          {/* Sidebar */}
          <div className="ct-doc-side">
            <div className="ct-doc-side-hd">Sections · {enabledCount} / {CT_DOC_SECTIONS.length}</div>
            {CT_DOC_SECTIONS.map(s => {
              const on = !!sections[s.id];
              const meta = sectionMeta(s.id, agent, rateType);
              const cls = `ct-doc-sec${s.required ? ' required' : on ? ' on' : ''}`;
              return (
                <div key={s.id} className={cls} onClick={() => toggleSection(s.id)}>
                  <span className="ct-doc-sec-num">{s.num}</span>
                  <span className="ct-doc-sec-cb" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ct-doc-sec-name">{s.name}</div>
                    {meta.sub && <div className="ct-doc-sec-meta">{meta.sub}</div>}
                  </div>
                  {s.required
                    ? <span className="ct-doc-sec-tag">required</span>
                    : meta.tag
                    ? <span className="ct-doc-sec-tag" style={{ background: '#F5F4EE', color: '#5F5E5A' }}>{meta.tag}</span>
                    : null}
                </div>
              );
            })}
          </div>

          {/* Preview */}
          <div id="ct-doc-preview" className="ct-doc-preview">
            {visibleGroups.map((group, pageIdx) => (
              <div key={group.id} className="ct-doc-page">

                {/* Navy sidebar */}
                <aside style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 56, background: navy, color: navySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', textOrientation: 'mixed', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase', fontFamily: 'Manrope,system-ui,sans-serif', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontStyle: 'italic' }}>Your Experience, Our Passion</span>
                </aside>

                {/* Page header */}
                <div style={{ padding: '14px 36px 12px 76px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #E0DED8', flexShrink: 0 }}>
                  <img src="assets/logo.png" alt="LOVE andaman" style={{ height: 38, width: 'auto', flexShrink: 0, filter: 'invert(10%) sepia(38%) saturate(1200%) hue-rotate(195deg) brightness(95%) contrast(95%)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: '#5F5E5A', letterSpacing: '.06em', textTransform: 'uppercase' }}>Marine Tour Operator · Phuket · Thailand</div>
                    <div style={{ fontSize: '8.5px', color: '#9b9590', letterSpacing: '.04em', marginTop: 3 }}>TAT License No. 31/00986</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: navy, letterSpacing: '-0.005em' }}>{T('docTitle')}</div>
                    <div style={{ fontSize: '9.5px', color: '#5F5E5A', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{agent.contractVersion || 'v—'} · {fmt(agent.contractStart)}</div>
                  </div>
                </div>

                {/* Page content */}
                <div style={{ padding: '18px 32px 40px 76px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {group.sections.map((sId, secIdx) => {
                    const isCover = sId === 'cover';
                    const isLast = secIdx === group.sections.length - 1;
                    const secDef = CT_DOC_SECTIONS.find(s => s.id === sId);
                    return (
                      <React.Fragment key={sId}>
                        {!isCover && (
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, padding: '8px 0 6px', borderTop: `2px solid ${navy}`, borderBottom: '1px solid #E0DED8' }}>
                            <span style={{ background: navy, color: '#fff', fontSize: '9.5px', fontWeight: 700, letterSpacing: '.08em', padding: '3px 9px', borderRadius: 3, fontVariantNumeric: 'tabular-nums' }}>§ {secDef?.num}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F1419', letterSpacing: '-0.01em' }}>{T(SECTION_I18N_KEYS[sId]) || sId}</span>
                          </div>
                        )}
                        <div style={isCover ? { flex: 1, display: 'flex', flexDirection: 'column' } : {}}>
                          <SectionBody sId={sId} {...sectionProps} />
                        </div>
                        {!isLast && <div style={{ height: 20, borderBottom: '1px solid #F2F0EA', marginBottom: 18 }} />}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Page footer */}
                <div className="ct-doc-page-foot">{T('pageFooter')} {agent.contractVersion || 'v—'}</div>
                <div className="ct-doc-page-num">{T('page')} {pageIdx + 1} / {totalPages}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div id="ct-doc-toast" style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1A2B43', color: '#fff', fontSize: 12, fontWeight: 600, padding: '10px 20px', borderRadius: 20, boxShadow: '0 4px 16px rgba(0,0,0,.25)', zIndex: 10, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );

  // Render as a portal directly under <body> so the @media print CSS works:
  // `body.ct-doc-printing > *:not(#ct-doc-modal)` hides everything else.
  return createPortal(modal, document.body);
}
