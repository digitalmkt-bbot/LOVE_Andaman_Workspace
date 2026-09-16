// ── Flag SVG helpers (simple stylized · matches BuildAxis aesthetic) ──
function bookingV2FlagSVG(code){
  const flags = {
    uk: `<svg width="14" height="10" viewBox="0 0 30 20" style="border-radius:2px"><rect width="30" height="20" fill="#012169"/><path d="M0,0 L30,20 M30,0 L0,20" stroke="#FFF" stroke-width="3"/><path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" stroke-width="1.5"/><path d="M15,0 V20 M0,10 H30" stroke="#FFF" stroke-width="5"/><path d="M15,0 V20 M0,10 H30" stroke="#C8102E" stroke-width="3"/></svg>`,
    ru: `<svg width="14" height="10" viewBox="0 0 30 20" style="border-radius:2px"><rect width="30" height="6.67" y="0" fill="#FFF"/><rect width="30" height="6.67" y="6.67" fill="#0039A6"/><rect width="30" height="6.67" y="13.33" fill="#D52B1E"/></svg>`,
    cn: `<svg width="14" height="10" viewBox="0 0 30 20" style="border-radius:2px"><rect width="30" height="20" fill="#DE2910"/><polygon points="5,3 6,5.5 8.5,5.5 6.5,7 7.5,9.5 5,8 2.5,9.5 3.5,7 1.5,5.5 4,5.5" fill="#FFDE00"/></svg>`
  };
  return flags[code] || '';
}
